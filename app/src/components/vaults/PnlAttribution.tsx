'use client';

import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher } from '@/lib/swr-fetcher';
import { LastUpdated, RefreshButton, useFreshness } from '@/components/dashboard/Freshness';
import BreakevenChart from '@/components/charts/BreakevenChart';
import { driverUsd, type PnlAttributionBook, type PnlAttributionResponse, type PnlSeriesPoint, type PnlSeriesResponse } from '@/lib/vault-types';

const GREEN = '#10c689';
const RED = '#b82214';
const GRAY = '#6b7280';

// Same display names as the admin attribution page.
const DRIVER_LABEL: Record<string, string> = {
  carry: 'carry',
  mark: 'price move',
  borrow_interest: 'borrow',
  execution: 'impact',
  fees: 'fees',
  incidents: 'incidents',
};

const money = (v: number) =>
  (v > 0 ? '+$' : v < 0 ? '−$' : '$') +
  Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFull = (v: number) =>
  (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const colorFor = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : GRAY);

function driverRows(drivers: Record<string, unknown>): { key: string; label: string; usd: number | null }[] {
  return Object.entries(drivers)
    .map(([key, v]) => ({ key, label: DRIVER_LABEL[key] ?? key.replace(/_/g, ' '), usd: driverUsd(v) }))
    .sort((a, b) => (b.usd == null ? -Infinity : Math.abs(b.usd)) - (a.usd == null ? -Infinity : Math.abs(a.usd)));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">{label}</div>
      <div className="mt-1 font-data text-sm font-medium tabular-nums text-zinc-800">{value}</div>
    </div>
  );
}

function Leader() {
  return <span aria-hidden className="h-px flex-1 -translate-y-[3px] border-b border-dotted border-zinc-300" />;
}

function Book({ book, points }: { book: PnlAttributionBook; points: PnlSeriesPoint[] | undefined }) {
  const iv = book.interval;
  const st = book.state;
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-800">{book.subject.label}</span>
        <span className="font-data text-[11px] tabular-nums text-zinc-400">
          {iv && <span className="text-zinc-300">{iv.engine_version} · </span>}
          {book.eventCount} event{book.eventCount === 1 ? '' : 's'}
        </span>
      </div>

      {!iv ? (
        <p className="mt-2 text-sm text-zinc-500">Registered, not yet modelled by the engine.</p>
      ) : (
        <>
          {st && (
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              <Stat label="collateral" value={usdFull(st.collateral_usd)} />
              <Stat label="debt" value={usdFull(st.debt_usd)} />
              <Stat label="equity" value={usdFull(st.equity_usd)} />
            </div>
          )}

          {points && points.length > 0 && <BreakevenChart points={points} />}

          <div className="mt-4 space-y-2.5">
            {driverRows(iv.drivers).map((r) => (
              <div key={r.key} className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-600">{r.label}</span>
                <Leader />
                {r.usd == null ? (
                  <span className="shrink-0 font-data text-[13px] tabular-nums text-zinc-300">not modelled</span>
                ) : (
                  <span
                    className="shrink-0 font-data text-[13px] font-semibold tabular-nums"
                    style={{ color: colorFor(r.usd) }}
                  >
                    {money(r.usd)}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2 border-t border-dashed border-zinc-300 pt-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-600">net</span>
              <Leader />
              <span
                className="shrink-0 font-data text-[13px] font-semibold tabular-nums"
                style={{ color: colorFor(iv.delta_nav) }}
              >
                {money(iv.delta_nav)}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">residual</span>
              <Leader />
              <span
                className={clsx(
                  'shrink-0 font-data text-[13px] tabular-nums',
                  Math.abs(iv.residual) < 0.01 ? 'text-zinc-300' : 'text-[#b82214]',
                )}
              >
                {money(iv.residual)}
              </span>
            </div>
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            drivers sum to dNAV. the gap is the residual.
          </p>
        </>
      )}
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

// The attribution engine's per-book P&L record: each book's ΔNAV decomposed into
// named USD drivers. The residual is the honesty term: near zero means the drivers
// explain the P&L; anything else shows in red.
export default function PnlAttribution({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<PnlAttributionResponse>(
    `/api/vaults/${encodeURIComponent(id)}/pnl-attribution`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000, refreshInterval: 300_000 },
  );
  // The breakeven series changes only when the attribution engine runs (a few times a day),
  // and it grows unboundedly — so it ships in its own endpoint, fetched once per book set
  // instead of riding along on the snapshot's 5-minute refresh.
  const { data: seriesData } = useSWR<PnlSeriesResponse>(
    `/api/vaults/${encodeURIComponent(id)}/pnl-attribution/series`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, refreshInterval: 900_000 },
  );
  const seriesByBook = new Map((seriesData?.books ?? []).map((b) => [b.subject.id, b.points]));
  const updatedAt = useFreshness(isValidating, !!data);
  const books = data?.books ?? [];

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          Attribution
          <span className="ml-2 text-zinc-300">{'// audited record'}</span>
        </h2>
        <span className="flex items-center gap-1">
          <LastUpdated since={updatedAt} />
          <RefreshButton onClick={() => void mutate()} spinning={isValidating} />
        </span>
      </div>

      {isLoading && !data && !error ? (
        <Card>
          <p className="text-sm text-zinc-500">Reading the attribution record…</p>
        </Card>
      ) : error || !data?.loaded ? (
        <Card>
          <p className="text-sm text-zinc-500">Attribution engine has not run yet.</p>
        </Card>
      ) : books.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No books registered yet.</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-black/[0.05]">
            {books.map((b) => (
              <Book key={b.subject.id} book={b} points={seriesByBook.get(b.subject.id)} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
