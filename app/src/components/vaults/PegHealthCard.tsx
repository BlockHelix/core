'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/swr-fetcher';
import type { VenueRiskResponse } from '@/lib/server/vault-factory';

// Position-health tripwires for the apxUSD complex behind the PT loop: the issuer's attested
// solvency, the only deep exit venue's depth, and the borrow leg. Every number carries its
// measurement time; a null renders as NOT MEASURED, never as a healthy zero.

const TRIPWIRE_LABELS: Record<string, string> = {
  poolUsdcBelowMin: 'Pool USDC < $500k',
  borrowApyAboveMax: 'Borrow APY > 20%',
  collateralizationBelowMin: 'Collateralization < 90%',
  spotBelowFloor: 'Spot < $0.90',
  largePoolSell: 'Pool sell ≥ $100k',
  whaleUnwinding: 'Whale unwinding',
};

function pct(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`;
}

function usd0(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `$${Math.round(v).toLocaleString('en-US')}`;
}

function Stat({ label, value, tone = 'text-zinc-950' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className={`font-data text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wider-2 text-zinc-400">{label}</p>
    </div>
  );
}

export default function PegHealthCard() {
  const { data, error, isLoading } = useSWR<VenueRiskResponse | null>('/api/fund/risk', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    refreshInterval: 60_000,
  });

  if (isLoading) return null;
  if (error || data === undefined) return null;

  if (data === null) {
    return (
      <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
        <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Peg health</p>
        <p className="mt-3 text-sm text-zinc-500">Venue scanner has not produced a scan yet. Not scanned is not healthy.</p>
      </div>
    );
  }

  const peg = data.peg;
  const tripwires = Object.entries(peg?.tripwires ?? {});
  const breached = tripwires.filter(([, v]) => v === true);
  const unmeasured = tripwires.filter(([, v]) => v === null);

  const spot = peg?.spotUsdcPerApx ?? null;
  const rv = peg?.redemptionValue ?? null;
  const gapTone = peg?.spotVsRvBps != null && peg.spotVsRvBps < -600 ? 'text-red-600' : 'text-zinc-950';
  const crTone =
    peg?.collateralization != null && peg.collateralization < 0.9
      ? 'text-red-600'
      : peg?.collateralization != null && peg.collateralization < 0.95
        ? 'text-amber-600'
        : 'text-zinc-950';
  const poolTone = peg?.poolUsdc != null && peg.poolUsdc < 500_000 ? 'text-red-600' : 'text-zinc-950';
  const borrowTone = data.borrowApy != null && data.borrowApy > 0.2 ? 'text-red-600' : 'text-zinc-950';

  return (
    <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          Peg health // {data.venue}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
          scanned {new Date(data.scannedAt).toLocaleString()}
        </p>
      </div>

      {breached.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider-2 text-red-600">
            Tripwire breached: {breached.map(([k]) => TRIPWIRE_LABELS[k] ?? k).join(' · ')}
          </p>
        </div>
      )}
      {unmeasured.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider-2 text-amber-600">
            Not measured: {unmeasured.map(([k]) => TRIPWIRE_LABELS[k] ?? k).join(' · ')}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Collateralization" value={pct(peg?.collateralization)} tone={crTone} />
        <Stat label="Redemption value" value={rv === null ? '—' : `$${rv.toFixed(4)}`} />
        <Stat
          label="Spot (sell 1 apx)"
          value={spot === null ? '—' : `$${spot.toFixed(4)}`}
          tone={gapTone}
        />
        <Stat
          label="Spot vs RV"
          value={peg?.spotVsRvBps == null ? '—' : `${peg.spotVsRvBps.toFixed(0)}bps`}
          tone={gapTone}
        />
        <Stat label="Pool USDC side" value={usd0(peg?.poolUsdc)} tone={poolTone} />
        <Stat label="Pool apxUSD side" value={usd0(peg?.poolApx)} />
        <Stat label="Borrow APY" value={pct(data.borrowApy)} tone={borrowTone} />
        <Stat label="Utilization" value={pct(data.utilization, 1)} />
        <Stat
          label="Largest pool sell (72min)"
          value={usd0(peg?.largestPoolSellUsdc)}
          tone={peg?.largestPoolSellUsdc != null && peg.largestPoolSellUsdc >= 100_000 ? 'text-red-600' : 'text-zinc-950'}
        />
        <Stat
          label="Whale collateral (PT)"
          value={peg?.whaleCollateralPt == null ? '—' : Math.round(peg.whaleCollateralPt).toLocaleString('en-US')}
          tone={
            peg?.whaleCollateralPt != null &&
            peg?.prevWhaleCollateralPt != null &&
            peg.whaleCollateralPt < peg.prevWhaleCollateralPt * 0.98
              ? 'text-red-600'
              : 'text-zinc-950'
          }
        />
      </div>

      <p className="mt-4 text-[11px] text-zinc-400">
        Redemption value is the issuer&apos;s published pricing policy (Accountable feed
        {peg?.feedTs ? `, ${new Date(peg.feedTs).toLocaleString()}` : ''}), not an on-chain
        mechanism. Spot is the fee-inclusive dust ask on the only deep Curve pool. PT implied{' '}
        {pct(data.impliedPtApy)} vs borrow {pct(data.borrowApy)}.
      </p>
    </div>
  );
}
