'use client';

import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher } from '@/lib/swr-fetcher';
import type { VenueAuditResponse, VenueAuditRow } from '@/lib/server/vault-factory';

// The cross-chain venue screen. Solana rows are unexecutable until we have execution there and
// say so. Nulls render as em-dash placeholders, never zeros, and a null net carry names the term
// it is missing.

function pct(v: number | null, digits = 1): string {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`;
}

function usd0(v: number | null): string {
  if (v === null || v === undefined) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(v / 1000)}k`;
}

// "measured" means a drift was observed on that market, never that the market is one of ours.
// A registered venue with no attributed book yet is "registered": tradeable, not yet measured.
const STATUS_STYLES: Record<VenueAuditRow['status'], string> = {
  measured: 'bg-[#10c689]/10 text-[#0a8f63]',
  registered: 'bg-[#10c689]/5 text-[#0a8f63]/70 ring-1 ring-inset ring-[#10c689]/20',
  screened: 'bg-zinc-100 text-zinc-600',
  'screened-unexecutable': 'bg-amber-50 text-amber-700',
};

const STATUS_LABELS: Record<VenueAuditRow['status'], string> = {
  measured: 'measured',
  registered: 'registered',
  screened: 'screened',
  'screened-unexecutable': 'no exec',
};

// Hand-researched credit screen, deliberately not a scanner output: the sweep can read a rate but
// not what stands behind it. The apyUSD book proved the gap — 62% net carry was the market pricing
// Strategy STRC preferred, not alpha. Keyed by collateral symbol; anything absent reads as
// unscreened, never as safe.
type BackingTier = 'concentrated' | 'transparent' | 'unscreened';

const BACKING: Record<string, { issuer: string; backing: string; tier: BackingTier }> = {
  apyUSD: { issuer: 'apyx', backing: 'Strategy STRC preferred', tier: 'concentrated' },
  apxUSD: { issuer: 'apyx', backing: 'Strategy STRC preferred', tier: 'concentrated' },
  USD3: { issuer: '3jane', backing: '3Jane unsecured credit', tier: 'concentrated' },
  reUSD: { issuer: 'resupply', backing: 'Resupply CDP \u00b7 prior exploit', tier: 'concentrated' },
  sUSDD: { issuer: 'tron', backing: 'USDD \u00b7 ~64% TRX reserve', tier: 'concentrated' },
  USDD: { issuer: 'tron', backing: 'USDD \u00b7 ~64% TRX reserve', tier: 'concentrated' },
  USDG: { issuer: 'paxos', backing: 'Paxos fiat reserve', tier: 'transparent' },
  sUSDS: { issuer: 'sky', backing: 'Sky over-collateralized', tier: 'transparent' },
  USDS: { issuer: 'sky', backing: 'Sky over-collateralized', tier: 'transparent' },
  // Saturn Credit splits the two deliberately and they are NOT the same credit.
  USDat: { issuer: 'saturn', backing: 'Saturn \u00b7 US Treasuries', tier: 'transparent' },
  sUSDat: { issuer: 'saturn', backing: 'Saturn \u00b7 100% Strategy STRC', tier: 'concentrated' },
  srUSDat: { issuer: 'saturn', backing: 'Saturn STRC \u00b7 senior tranche', tier: 'concentrated' },
  jrUSDat: { issuer: 'saturn', backing: 'Saturn STRC \u00b7 JUNIOR, first loss', tier: 'concentrated' },
  syrupUSDC: { issuer: 'maple', backing: 'Maple private credit', tier: 'concentrated' },
  syrupUSDT: { issuer: 'maple', backing: 'Maple private credit', tier: 'concentrated' },
  nOPAL: { issuer: 'nest', backing: 'Nest credit fund', tier: 'concentrated' },
  EUTBL: { issuer: 'spiko', backing: 'Spiko \u00b7 EU T-bills', tier: 'transparent' },
};

const BACKING_STYLES: Record<BackingTier, string> = {
  concentrated: 'text-amber-700',
  transparent: 'text-zinc-600',
  unscreened: 'italic text-zinc-400',
};

// "PT-apyUSD-5NOV2026/apxUSD" -> collateral apyUSD, debt apxUSD. Non-PT rows have no PT leg.
function legs(pair: string): { collateral: string | null; debt: string | null } {
  const [left, right] = pair.split('/');
  if (!left?.startsWith('PT-')) return { collateral: null, debt: right ?? null };
  return { collateral: left.slice(3).replace(/-\d{1,2}[A-Z]{3}\d{4}$/, ''), debt: right ?? null };
}

// Collateral and debt resolving to one issuer is the trap the apxUSD book fell into: leverage
// concentrates that credit instead of diversifying it, and the market's ratchet oracle means price
// can never liquidate you out of it.
function Backing({ pair }: { pair: string }) {
  const { collateral, debt } = legs(pair);
  const entry = collateral ? BACKING[collateral] : undefined;
  if (!entry) return <span className="italic text-zinc-400">not screened</span>;
  const debtEntry = debt ? BACKING[debt] : undefined;
  return (
    <span className={BACKING_STYLES[entry.tier]}>
      {entry.backing}
      {debtEntry && debtEntry.issuer === entry.issuer && (
        <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider-2 text-amber-700">
          same issuer as debt
        </span>
      )}
    </span>
  );
}

export default function VenueAuditTable() {
  const { data, error, isLoading } = useSWR<VenueAuditResponse | null>('/api/fund/venues', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    refreshInterval: 300_000,
  });

  if (isLoading) {
    return <p className="mt-6 text-sm text-zinc-500">Loading audit…</p>;
  }
  if (error) {
    return <p className="mt-6 text-sm text-[#9a1c10]">Failed to load the venue audit.</p>;
  }
  if (!data || !Array.isArray(data.rows)) {
    return (
      <div className="mt-6 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft">
        <p className="text-sm text-zinc-500">
          No audit has landed yet. The worker sweeps every 6 hours; no sweep is not an empty
          universe.
        </p>
      </div>
    );
  }

  const down = Object.entries(data.sources ?? {}).filter(([, ok]) => !ok).map(([k]) => k);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
          swept {new Date(data.scannedAt).toLocaleString()} · {data.rows.length} venues
        </p>
        {down.length > 0 && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium uppercase tracking-wider-2 text-amber-700">
            sources down: {down.join(', ')} — their venues are missing, not absent
          </p>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-black/[0.06] bg-white shadow-soft">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-[11px] uppercase tracking-wider-2 text-zinc-400">
              <th className="px-4 py-3 font-medium">Venue</th>
              <th className="px-2 py-3 font-medium">Chain</th>
              <th className="px-2 py-3 font-medium">Backing</th>
              <th className="px-2 py-3 text-right font-medium">Earn</th>
              <th className="px-2 py-3 text-right font-medium">Borrow</th>
              <th className="px-2 py-3 text-right font-medium">Lev</th>
              <th className="px-2 py-3 text-right font-medium">Gross carry</th>
              <th className="px-2 py-3 text-right font-medium">Net of mark</th>
              <th className="px-2 py-3 text-right font-medium">Liquidity</th>
              <th className="px-2 py-3 text-right font-medium">Expiry</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={`${r.pair}-${r.project}-${i}`} className="border-b border-black/[0.04] last:border-b-0">
                <td className="px-4 py-2.5">
                  <span className="font-data text-[13px] text-zinc-950">{r.pair}</span>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">{r.project}</span>
                </td>
                <td className="px-2 py-2.5 text-xs text-zinc-500">{r.chain}</td>
                <td className="px-2 py-2.5 text-xs"><Backing pair={r.pair} /></td>
                <td className="px-2 py-2.5 text-right font-data text-[13px]">{pct(r.collateralApy)}</td>
                <td className="px-2 py-2.5 text-right font-data text-[13px]">{pct(r.borrowApy)}</td>
                <td className="px-2 py-2.5 text-right font-data text-[13px]">{r.leverage === null ? '—' : `${r.leverage.toFixed(1)}x`}</td>
                {/* Gross is never the green "this is your return" number. Only net of mark
                    earns the colour, and only where a book was actually measured. */}
                <td className="px-2 py-2.5 text-right font-data text-[13px] text-zinc-500">{pct(r.grossCarryApy)}</td>
                <td
                  className={clsx(
                    'px-2 py-2.5 text-right font-data text-[13px] font-semibold',
                    r.netOfMarkApy === null || r.netOfMarkApy === undefined
                      ? 'text-zinc-400'
                      : r.netOfMarkApy > 0
                        ? 'text-[#0a8f63]'
                        : 'text-[#9a1c10]',
                  )}
                >
                  {pct(r.netOfMarkApy)}
                  {r.markDriftDays != null && (
                    <span className="ml-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                      {r.markDriftDays.toFixed(0)}d
                    </span>
                  )}
                  {r.netOfMarkApy === null && r.netOfMarkNote ? (
                    <span className="mt-0.5 block whitespace-normal font-sans text-[10px] font-normal leading-tight text-zinc-400">
                      {r.netOfMarkNote}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2.5 text-right font-data text-[13px] text-zinc-600">{usd0(r.liquidityUsd)}</td>
                <td className="px-2 py-2.5 text-right text-xs text-zinc-500">
                  {r.expiry ? new Date(r.expiry).toISOString().slice(0, 10) : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <span className={clsx('inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider-2', STATUS_STYLES[r.status])}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-zinc-400">
        Gross carry = earn × leverage − borrow × (leverage − 1) at LLTV minus a 3pp buffer, capped
        8x. It is a RATE SPREAD and it is not a return: it carries no term for what the collateral
        mark does. Net of mark subtracts the collateral drift our attribution engine actually
        measured, levered, with the window in days beside it. It reads “—” with its reason on any
        market we have not measured, because an unmeasured drift is not a zero drift. A row reads
        “measured” only where a drift was observed; “registered” is a venue we may trade with no
        attributed book yet. Rows are ranked
        on gross, the one basis every row shares. Screened rows are rate reads only: no routed
        quotes, no entry bounds, no venue-depth checks. Solana rows have no execution path today.
        Backing is a hand-researched credit screen, not a scanner read: it names what stands behind
        the collateral. Rows with no entry read “not screened” and are not implied safe. Gross carry
        ranks close to inversely against backing quality, which is the market pricing credit rather
        than offering alpha.
      </p>
    </div>
  );
}
