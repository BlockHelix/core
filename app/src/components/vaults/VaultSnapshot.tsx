'use client';

import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher } from '@/lib/swr-fetcher';

interface NavBalance {
  symbol: string;
  token: string;
  decimals: number;
  idle: string;
  supplied: string;
  supplyApy?: number | null;
}

interface NavResponse {
  baseAsset: { symbol: string; decimals: number } | null;
  sharePrice: string; // official on-chain getRate (~6h)
  liveSharePrice?: string; // true per-share value now (holdings / shares)
  totalShares: string;
  shareDecimals: number;
  nav: string; // live NAV/TVL
  balances: NavBalance[];
  asOf: string;
}

// Format a bigint base-unit string to a grouped human decimal (tabular). Never throws —
// a malformed value renders as an em-dash placeholder rather than blanking the panel.
function fmt(value: string | undefined, decimals: number, maxFrac = 2): string {
  let v = value ?? '';
  const neg = v.startsWith('-');
  if (neg) v = v.slice(1);
  if (!/^\d+$/.test(v)) return '—';
  const padded = v.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals) || '0';
  let frac = decimals ? padded.slice(padded.length - decimals) : '';
  frac = frac.slice(0, maxFrac).replace(/0+$/, '');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + (frac ? '.' + frac : '');
}

// APY comes as a fraction (0.0432). Render as a percentage, or an em-dash when there's no rate.
function pct(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction) || fraction <= 0) return '—';
  return (fraction * 100).toFixed(2);
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-white px-5 py-6">
      <p className="font-data text-2xl font-semibold tracking-tight text-zinc-950">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-zinc-400">{unit}</span>}
      </p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-400">{sub}</p>}
    </div>
  );
}

export default function VaultSnapshot({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<NavResponse>(
    `/api/vaults/${encodeURIComponent(id)}/nav`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15_000, refreshInterval: 30_000 },
  );

  const baseDec = data?.baseAsset?.decimals ?? 6;
  const baseSym = data?.baseAsset?.symbol ?? '';
  // Current yield = the highest Aave supply APY across the vault's Aave assets (for Conservative,
  // that's USDC). Forward-looking market rate; realized share-price APY needs NAV history (soon).
  const yieldApy = data ? Math.max(0, ...data.balances.map((b) => b.supplyApy ?? 0)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          Vault Snapshot
          <span className="ml-2 text-zinc-300">{'// on-chain'}</span>
        </h2>
        <button
          type="button"
          onClick={() => void mutate()}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
        >
          {isValidating ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft">
          <p className="text-sm text-zinc-500">
            {(error as { message?: string })?.message ?? 'Could not load the vault snapshot.'} It may still be
            indexing — this refreshes automatically.
          </p>
        </div>
      ) : isLoading || !data ? (
        <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft">
          <p className="text-sm text-zinc-500">Reading on-chain state…</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.06] sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="NAV / TVL" value={fmt(data.nav, baseDec, 2)} unit={baseSym} sub="live · on-chain" />
            <Tile label="Share price" value={fmt(data.sharePrice, baseDec, 6)} unit={baseSym} sub="official · ~6h" />
            <Tile label="Shares outstanding" value={fmt(data.totalShares, data.shareDecimals, 2)} />
            <Tile label="Current yield · Aave" value={pct(yieldApy)} unit={yieldApy > 0 ? '% APY' : undefined} />
          </div>
          {data.liveSharePrice && data.liveSharePrice !== data.sharePrice && (
            <p className="mt-3 text-xs text-zinc-500">
              Live share price{' '}
              <span className="font-data text-zinc-800">
                {fmt(data.liveSharePrice, baseDec, 6)} {baseSym}
              </span>{' '}
              — accrued yield isn’t in the official rate until the next update (~6h).
            </p>
          )}

          <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
            <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Holdings</p>
            <div className="mt-3 divide-y divide-black/[0.05]">
              {data.balances.length === 0 ? (
                <p className="py-3 text-sm text-zinc-500">No policy assets to report.</p>
              ) : (
                data.balances.map((b) => {
                  const supplied = b.supplied && b.supplied !== '0';
                  return (
                    <div key={b.token} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span className="font-data text-sm font-medium text-zinc-800">{b.symbol}</span>
                      <div className="flex items-center gap-5 font-data text-xs">
                        <span className="text-zinc-500">
                          idle <span className="ml-1 text-zinc-900">{fmt(b.idle, b.decimals, 2)}</span>
                        </span>
                        <span className="text-zinc-500">
                          Aave{' '}
                          <span className={clsx('ml-1', supplied ? 'text-emerald-700' : 'text-zinc-300')}>
                            {supplied ? fmt(b.supplied, b.decimals, 2) : '—'}
                          </span>
                          {b.supplyApy != null && b.supplyApy > 0 && (
                            <span className="ml-1.5 text-zinc-400">@ {pct(b.supplyApy)}%</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-black/[0.12] bg-zinc-50/60 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Attribution</p>
            <p className="mt-1.5 text-sm text-zinc-500">
              P&amp;L attribution and NAV history — <span className="text-emerald-700">coming soon</span>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
