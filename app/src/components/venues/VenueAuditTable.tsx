'use client';

import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher } from '@/lib/swr-fetcher';
import type { VenueAuditResponse, VenueAuditRow } from '@/lib/server/vault-factory';

// The cross-chain venue screen. Solana rows are unexecutable until we have execution there and
// say so; "measured" rows are the registered venues the full scanner guards. Nulls render as
// em-dash placeholders, never zeros.

function pct(v: number | null, digits = 1): string {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`;
}

function usd0(v: number | null): string {
  if (v === null || v === undefined) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(v / 1000)}k`;
}

const STATUS_STYLES: Record<VenueAuditRow['status'], string> = {
  measured: 'bg-[#10c689]/10 text-[#0a8f63]',
  screened: 'bg-zinc-100 text-zinc-600',
  'screened-unexecutable': 'bg-amber-50 text-amber-700',
};

const STATUS_LABELS: Record<VenueAuditRow['status'], string> = {
  measured: 'measured',
  screened: 'screened',
  'screened-unexecutable': 'screened · no execution',
};

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
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-[11px] uppercase tracking-wider-2 text-zinc-400">
              <th className="px-4 py-3 font-medium">Venue</th>
              <th className="px-2 py-3 font-medium">Chain</th>
              <th className="px-2 py-3 text-right font-medium">Earn</th>
              <th className="px-2 py-3 text-right font-medium">Borrow</th>
              <th className="px-2 py-3 text-right font-medium">Lev</th>
              <th className="px-2 py-3 text-right font-medium">Net carry</th>
              <th className="px-2 py-3 text-right font-medium">Liquidity</th>
              <th className="px-2 py-3 text-right font-medium">Expiry</th>
              <th className="px-4 py-3 text-right font-medium">Status</th>
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
                <td className="px-2 py-2.5 text-right font-data text-[13px]">{pct(r.collateralApy)}</td>
                <td className="px-2 py-2.5 text-right font-data text-[13px]">{pct(r.borrowApy)}</td>
                <td className="px-2 py-2.5 text-right font-data text-[13px]">{r.leverage === null ? '—' : `${r.leverage.toFixed(1)}x`}</td>
                <td
                  className={clsx(
                    'px-2 py-2.5 text-right font-data text-[13px] font-semibold',
                    r.netCarryApy !== null && r.netCarryApy > 0 ? 'text-[#0a8f63]' : 'text-zinc-500',
                  )}
                >
                  {pct(r.netCarryApy)}
                </td>
                <td className="px-2 py-2.5 text-right font-data text-[13px] text-zinc-600">{usd0(r.liquidityUsd)}</td>
                <td className="px-2 py-2.5 text-right text-xs text-zinc-500">
                  {r.expiry ? new Date(r.expiry).toISOString().slice(0, 10) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={clsx('rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider-2', STATUS_STYLES[r.status])}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-zinc-400">
        Net carry = earn × leverage − borrow × (leverage − 1) at LLTV minus a 3pp buffer, capped
        8x. Screened rows are rate reads only: no routed quotes, no entry bounds, no venue-depth
        checks. Solana rows have no execution path today.
      </p>
    </div>
  );
}
