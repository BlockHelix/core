'use client';

import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher, FetchError } from '@/lib/swr-fetcher';
import { timeAgo } from '@/lib/format';
import { LastUpdated, RefreshButton, useFreshness } from '@/components/dashboard/Freshness';
import type { RateAttributionInterval, RateAttributionResponse } from '@/lib/vault-types';

const GREEN = 'text-[#10c689]';
const RED = 'text-[#b82214]';
const DAY_MS = 24 * 60 * 60 * 1000;

function fmtBps(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const a = Math.abs(v);
  if (Math.round(a * 10) === 0) return '0';
  const s = a >= 10 ? String(Math.round(a)) : a.toFixed(1).replace(/\.0$/, '');
  return (v > 0 ? '+' : '-') + s;
}

function moveTone(v: number): string {
  if (Math.round(v * 10) === 0) return 'text-zinc-500';
  return v > 0 ? GREEN : RED;
}

// Every candidate driver of one interval: price and quantity effect per symbol, plus shares.
function drivers(iv: RateAttributionInterval): { label: string; bps: number }[] {
  const all = iv.effects.flatMap((e) => [
    { label: `${e.symbol} px`, bps: e.priceBps },
    { label: `${e.symbol} qty`, bps: e.quantityBps },
  ]);
  all.push({ label: 'shares', bps: iv.sharesBps });
  return all.sort((a, b) => Math.abs(b.bps) - Math.abs(a.bps)).slice(0, 3);
}

function Summary({ intervals }: { intervals: RateAttributionInterval[] }) {
  const now = Date.now();
  const window = intervals.filter((iv) => now - new Date(iv.toCreatedAt).getTime() <= DAY_MS);
  if (window.length === 0) {
    return <p className="text-xs text-zinc-500">No pushes in the last 24h.</p>;
  }
  const sum = window.reduce((n, iv) => n + (iv.actualBps ?? iv.trueBps), 0);
  const bySymbol = new Map<string, number>();
  for (const iv of window) {
    for (const e of iv.effects) {
      bySymbol.set(e.symbol, (bySymbol.get(e.symbol) ?? 0) + e.priceBps + e.quantityBps);
    }
    bySymbol.set('shares', (bySymbol.get('shares') ?? 0) + iv.sharesBps);
  }
  let top: { symbol: string; bps: number } | null = null;
  for (const [symbol, bps] of bySymbol) {
    if (!top || Math.abs(bps) > Math.abs(top.bps)) top = { symbol, bps };
  }
  return (
    <p className="text-xs text-zinc-500">
      Last 24h <span className={clsx('font-data font-medium tabular-nums', moveTone(sum))}>{fmtBps(sum)} bps</span>{' '}
      over {window.length} push{window.length === 1 ? '' : 'es'}.
      {top && (
        <>
          {' '}Largest driver{' '}
          <span className="font-data text-zinc-800">
            {top.symbol} {fmtBps(top.bps)}
          </span>
          .
        </>
      )}
    </p>
  );
}

function Row({ iv }: { iv: RateAttributionInterval }) {
  const computed = iv.actualBps == null;
  const move = iv.actualBps ?? iv.trueBps;
  const clamped = Math.abs(iv.capClampBps) > 1;
  const residHot = Math.abs(iv.residualBps) >= 5;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <span
        className="min-w-[6.5rem] font-data text-[11px] text-zinc-400"
        title={new Date(iv.toCreatedAt).toLocaleString()}
      >
        {timeAgo(iv.toCreatedAt)}
      </span>
      <span className={clsx('w-14 shrink-0 text-right font-data text-sm font-medium tabular-nums', moveTone(move))}>
        {fmtBps(move)}
      </span>
      {computed && (
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
          computed
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {drivers(iv).map((d) => (
          <span
            key={d.label}
            className="rounded-md border border-black/[0.08] bg-[#f7f7f8] px-2 py-0.5 font-data text-[11px] tabular-nums text-zinc-600"
          >
            {d.label} {fmtBps(d.bps)}
          </span>
        ))}
        {clamped && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900"
            title="The accountant band clamped this push. The remainder spills into later pushes."
          >
            clamped
          </span>
        )}
      </span>
      <span className={clsx('ml-auto font-data text-[11px] tabular-nums', residHot ? RED : 'text-zinc-300')}>
        resid {fmtBps(iv.residualBps)}
      </span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const corner = 'pointer-events-none absolute h-2.5 w-2.5 border-black/[0.15]';
  return (
    <div className="relative mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <span aria-hidden className={`${corner} left-2 top-2 border-l border-t`} />
      <span aria-hidden className={`${corner} right-2 top-2 border-r border-t`} />
      <span aria-hidden className={`${corner} bottom-2 left-2 border-b border-l`} />
      <span aria-hidden className={`${corner} bottom-2 right-2 border-b border-r`} />
      {children}
    </div>
  );
}

// One row per rate push: the on-chain move beside what produced it (per-symbol price and
// quantity effects, shares, clamp, residual). The residual is the honesty term: near zero
// means the decomposition explains the push; large means it does not, so say so in red.
export default function RateAttribution({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<RateAttributionResponse>(
    `/api/vaults/${encodeURIComponent(id)}/rate-attribution`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000, refreshInterval: 60_000 },
  );
  const updatedAt = useFreshness(isValidating, !!data);
  const notFound = error instanceof FetchError && error.status === 404;
  const rows = (data?.intervals ?? [])
    .slice()
    .sort((a, b) => new Date(b.toCreatedAt).getTime() - new Date(a.toCreatedAt).getTime())
    .slice(0, 20);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          Share Price Attribution
          <span className="ml-2 text-zinc-300">{'// per push'}</span>
        </h2>
        <span className="flex items-center gap-1">
          <LastUpdated since={updatedAt} />
          <RefreshButton onClick={() => void mutate()} spinning={isValidating} />
        </span>
      </div>

      {error && !notFound ? (
        <Card>
          <p className="text-sm text-zinc-500">
            {(error as { message?: string })?.message ?? 'Could not load attribution.'} This
            refreshes automatically.
          </p>
        </Card>
      ) : isLoading && !data ? (
        <Card>
          <p className="text-sm text-zinc-500">Reading rate history…</p>
        </Card>
      ) : notFound || rows.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No pushes recorded yet.</p>
        </Card>
      ) : (
        <Card>
          <Summary intervals={data!.intervals} />
          <div className="mt-3 divide-y divide-black/[0.05] border-t border-black/[0.05]">
            {rows.map((iv) => (
              <Row key={`${iv.toBlock}-${iv.toCreatedAt}`} iv={iv} />
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
            Each row is one rate push. Chips show the three largest effects in bps of share
            price. A computed row had no on-chain push recorded, so the move is the model value.
          </p>
        </Card>
      )}
    </div>
  );
}
