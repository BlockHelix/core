'use client';

import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher } from '@/lib/swr-fetcher';
import { LastUpdated, RefreshButton, useFreshness } from '@/components/dashboard/Freshness';

interface NavBalance {
  symbol: string;
  token: string;
  decimals: number;
  idle: string;
  supplied: string;
  supplyApy?: number | null;
}

interface NavPosition {
  protocol: string;
  symbol: string;
  kind: string;
  market?: string;
  amount: string; // SIGNED base units: collateral positive, debt negative
  decimals: number;
  usdValue: number | null;
}

interface NavResponse {
  baseAsset: { symbol: string; decimals: number } | null;
  sharePrice: string; // official on-chain getRate (~6h)
  liveSharePrice?: string; // true per-share value now (holdings / shares)
  totalShares: string;
  shareDecimals: number;
  nav: string; // live NAV/TVL
  yield?: { blendedApy: number; deployedRatio: number; unmodelled?: string[] };
  balances: NavBalance[];
  positions?: NavPosition[];
  unvalued?: { protocol: string; reason: string }[];
  navIsLive?: boolean;
  /** Per market, worst buffer first. Markets liquidate independently; never blend them. */
  risks?: {
    market: string; leverage: number; ltv: number; lltv: number; bufferPp: number;
    collateralBase: number; debtBase: number; equityBase: number;
  }[];
  markCheck?: {
    verdict: 'ok' | 'flag' | 'block';
    worstNavImpactBps: number;
    worstOverstatementBps?: number;
    netNavImpactBps: number;
    sharePriceAtVenue: string | null;
    disagreements: { symbol: string; feedRate: number; venueRate: number; venue: string; deviationBps: number; navImpactBps: number }[];
    unchecked: { symbol: string; exposureBase: number; reason: string }[];
  } | null;
  /** MMF-style dual NAV: liveSharePrice with EVERY leg at its venue price. Same restatement as
   *  markCheck.sharePriceAtVenue, so the headline and the detail rows cannot disagree. */
  shadow?: {
    sharePrice: string;
    navUsd: number;
    bridgePp: number;
    note: string;
  } | null;
  /** Accounting basis behind liveSharePrice and the on-chain rate. Risk stays oracle-based. */
  markBasis?: 'conservative' | 'execution';
  asOf: string;
}

function usd(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// A share price on its own is a hypothesis: it is only as good as the prices it was computed
// from, and nothing upstream had ever asked whether those prices were obtainable. On this vault
// the feed and the venue differed by under 6bps on the borrowed leg, which at 8.66x leverage was
// 51bps of NAV — 0.9928 against ~0.9990. This panel puts the two numbers beside each other so the
// error bar is visible instead of implied.
function MarkCheck({ data, baseSym, baseDec }: { data: NavResponse; baseSym: string; baseDec: number }) {
  const mc = data.markCheck;
  if (!mc) {
    return (
      <div className="border-t border-black/[0.06] bg-white px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Mark check</p>
        <p className="mt-2 text-xs text-zinc-500">
          Not checked. No position leg had a venue deep enough to price against, so the share price
          above is unverified rather than confirmed.
        </p>
      </div>
    );
  }
  const flagged = mc.verdict !== 'ok';
  // Direction decides tone: marks that OVERSTATE NAV are the dangerous kind (amber). Marks below
  // venue are the deliberate conservative basis and can be any size without being a warning.
  const overstate = mc.worstOverstatementBps ?? mc.worstNavImpactBps;
  const chip = flagged
    ? overstate >= 1
      ? `overstates ${overstate.toFixed(0)}bps of NAV`
      : 'unchecked exposure'
    : mc.disagreements.length && mc.netNavImpactBps > 0
      ? `conservative by ${mc.netNavImpactBps.toFixed(0)}bps`
      : 'agrees with venue';
  return (
    <div className="border-t border-black/[0.06] bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Mark check</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${flagged ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
          {chip}
        </span>
      </div>

      {mc.sharePriceAtVenue && (
        <p className="mt-3 font-data text-sm text-zinc-950">
          {fmt(data.liveSharePrice ?? data.sharePrice, baseDec, 6)}
          <span className="mx-2 text-zinc-400">at our marks vs</span>
          {fmt(mc.sharePriceAtVenue, baseDec, 6)}
          <span className="ml-2 text-zinc-400">at venue prices</span>
        </p>
      )}

      {mc.disagreements.map((d) => (
        <p key={d.symbol} className="mt-2 text-xs text-zinc-500">
          <span className="text-zinc-950">{d.symbol}</span> marked {d.feedRate.toFixed(6)}, {d.venue} says{' '}
          {d.venueRate.toFixed(6)} ({d.deviationBps >= 0 ? '+' : ''}{d.deviationBps.toFixed(2)}bps) ={' '}
          <span className="text-zinc-950">{d.navImpactBps >= 0 ? '+' : ''}{d.navImpactBps.toFixed(0)}bps of NAV</span>
        </p>
      ))}

      {mc.unchecked.map((u) => (
        <p key={u.symbol} className="mt-2 text-xs text-zinc-500">
          <span className="text-zinc-950">{u.symbol}</span> {usd(Math.abs(u.exposureBase))} unchecked: {u.reason}
        </p>
      ))}

      <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
        Prices are never changed by this check. A leg with no venue deep enough to quote is reported
        unchecked rather than treated as agreeing.
      </p>
    </div>
  );
}

// NAV says what the position is worth. This says whether it survives, which is the only thing
// that decides the outcome of a levered book. One block PER market: markets liquidate
// independently, and a blended average once showed an 8.2pp buffer while the hot leg sat 1.8pp
// from its LLTV — wrong in exactly the direction a risk panel exists to prevent.
function RiskLevels({ risks }: { risks: NonNullable<NavResponse['risks']> }) {
  return (
    <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Risk levels</p>
      {risks.map((risk) => {
        // A liquidation buffer is not a linear scale: 2pp is comfortable at 3x and thin at 10x,
        // because the same LTV move is a larger share of equity when equity is a smaller share.
        const tone = risk.bufferPp < 1 ? 'text-red-600' : risk.bufferPp < 2.5 ? 'text-amber-600' : 'text-zinc-950';
        return (
          <div key={risk.market} className="mt-4 border-t border-black/[0.05] pt-4 first:mt-2 first:border-t-0 first:pt-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">{risk.market}</p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <p className="font-data text-2xl font-semibold tracking-tight text-zinc-950">{risk.leverage.toFixed(2)}x</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider-2 text-zinc-400">Leverage</p>
              </div>
              <div>
                <p className="font-data text-2xl font-semibold tracking-tight text-zinc-950">{(risk.ltv * 100).toFixed(2)}%</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider-2 text-zinc-400">LTV</p>
              </div>
              <div>
                <p className="font-data text-2xl font-semibold tracking-tight text-zinc-500">{(risk.lltv * 100).toFixed(2)}%</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider-2 text-zinc-400">Liquidation at</p>
              </div>
              <div>
                <p className={`font-data text-2xl font-semibold tracking-tight ${tone}`}>{risk.bufferPp.toFixed(2)}pp</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider-2 text-zinc-400">Buffer</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-zinc-400">
              {usd(risk.collateralBase)} collateral against {usd(risk.debtBase)} debt ={' '}
              <span className="text-zinc-950">{usd(risk.equityBase)}</span> equity. Collateral can fall{' '}
              <span className="text-zinc-950">{(((risk.lltv - risk.ltv) / risk.lltv) * 100).toFixed(2)}%</span> before liquidation.
            </p>
          </div>
        );
      })}
    </div>
  );
}

// "nothing deployed" is only true when the vault holds nothing that earns. It used to render
// whenever the blend summed to zero, which swallowed the case that matters most: a book that IS
// deployed, into something the API has no rate model for. The yield field only ever summed Aave's
// supplyApy, so a vault whose whole position was a levered Pendle PT loop summed to zero and the
// tile printed "nothing deployed" over a live 2.8x book, directly above a Deposit button.
// An unmodelled leg now says it is unmodelled and names itself.

function yieldValue(y: NavResponse['yield']): { value: string; unit?: string } {
  if (!y) return { value: '—' };
  // A blend over nothing modelled is an unknown, not a zero. Never print 0.00% over a live book.
  if (y.blendedApy === 0 && (y.unmodelled?.length ?? 0) > 0) return { value: '—' };
  return { value: pct(y.blendedApy), unit: y.blendedApy > 0 ? '% APY' : undefined };
}

function yieldSub(y: NavResponse['yield']): string | undefined {
  if (!y) return undefined;
  const unmodelled = y.unmodelled ?? [];
  if (y.blendedApy === 0 && unmodelled.length > 0) return `not modelled · ${unmodelled.join(', ')}`;
  // The vault's OWN capital at work over NAV, so it reconciles with the blend beside it: this
  // ratio times the deployed rate has to land on the headline. Borrowed collateral is not the
  // vault's capital, and counting it read 90% deployed next to a 4.9% blend on a 79% idle book.
  const scale = y.deployedRatio > 0 ? `${(y.deployedRatio * 100).toFixed(0)}% deployed` : 'nothing deployed';
  return unmodelled.length > 0 ? `blended · ${scale} · partial` : `blended · ${scale}`;
}

export default function VaultSnapshot({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<NavResponse>(
    `/api/vaults/${encodeURIComponent(id)}/nav`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15_000, refreshInterval: 30_000 },
  );

  const updatedAt = useFreshness(isValidating, !!data);

  const baseDec = data?.baseAsset?.decimals ?? 6;
  const baseSym = data?.baseAsset?.symbol ?? '';
  // What the VAULT earns on its whole NAV. The headline Aave rate is what an asset earns once
  // supplied; idle assets earn nothing, so quoting it as the vault's yield overstates it by
  // NAV/deployed. Server computes the value-weighted blend through the same Pyth path as NAV.
  // Absent (older API) is NOT the same as zero — say nothing rather than claim nothing is deployed.
  const yieldInfo = data?.yield;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          Vault Snapshot
          <span className="ml-2 text-zinc-300">{'// on-chain'}</span>
        </h2>
        <span className="flex items-center gap-1">
          <LastUpdated since={updatedAt} />
          <RefreshButton onClick={() => void mutate()} spinning={isValidating} />
        </span>
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
            <Tile
              label="NAV / TVL"
              value={fmt(data.nav, baseDec, 2)}
              unit={baseSym}
              // Never label a fallback as a measurement: when anything is unvalued the figure is
              // the stale on-chain rate, not a reading of what the vault holds.
              sub={data.navIsLive === false ? 'incomplete · see below' : 'live · on-chain'}
            />
            <Tile label="Share price" value={fmt(data.sharePrice, baseDec, 6)} unit={baseSym} sub="official · ~6h" />
            <Tile label="Shares outstanding" value={fmt(data.totalShares, data.shareDecimals, 2)} />
            <Tile label="Current yield" {...yieldValue(yieldInfo)} sub={yieldSub(yieldInfo)} />
          </div>
          {data.liveSharePrice && data.liveSharePrice !== data.sharePrice && (
            <p className="mt-3 text-xs text-zinc-500">
              Live share price{' '}
              <span className="font-data text-zinc-800">
                {fmt(data.liveSharePrice, baseDec, 6)} {baseSym}
              </span>{' '}
              — marks current holdings; the official rate catches up on its next update (~6h).
            </p>
          )}

          {/* Money-market funds publish amortised cost AND shadow NAV; same discipline here. The
              official basis marks PT collateral at the liquidation oracle, which its issuer sets
              below market by design, so the official share price understates until maturity. This
              panel shows the market's answer beside it instead of leaving the gap to be discovered
              as a "loss". The shadow number never feeds the official rate. */}
          {data.shadow && (
            <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
                  Share price · two bases
                </p>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                  dual NAV
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-black/[0.06] bg-black/[0.06] sm:grid-cols-2">
                <Tile
                  label={data.markBasis === 'execution' ? 'Official (exit value)' : 'Official (conservative)'}
                  value={fmt(data.liveSharePrice ?? data.sharePrice, baseDec, 6)}
                  unit={baseSym}
                  sub={data.markBasis === 'execution' ? 'what an orderly sale nets now' : 'collateral at the liquidation oracle'}
                />
                <Tile
                  label="Mark-to-market"
                  value={fmt(data.shadow.sharePrice, baseDec, 6)}
                  unit={baseSym}
                  sub="every leg at its venue mid"
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                {data.shadow.note} The{' '}
                <span className="font-data text-zinc-800">
                  {data.shadow.bridgePp >= 0 ? '+' : ''}{data.shadow.bridgePp.toFixed(2)}pp
                </span>{' '}
                gap is an accounting choice, not a loss. The mark-to-market number is published for
                disclosure and never feeds the official rate; the mark check below itemises it leg
                by leg.
              </p>
            </div>
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
                          supplied{' '}
                          <span className={clsx('ml-1', supplied ? 'text-[#10c689]' : 'text-zinc-300')}>
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

          {(data.positions?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
              <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
                Protocol positions
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Held by the protocol, not the vault — these never appear in a wallet or on a block explorer.
              </p>
              <div className="mt-3 divide-y divide-black/[0.05]">
                {data.positions!.map((p) => {
                  const isDebt = p.amount.startsWith('-');
                  return (
                    <div key={`${p.protocol}-${p.symbol}-${p.kind}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span className="flex items-baseline gap-2">
                        <span className="font-data text-sm font-medium text-zinc-800">{p.symbol}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                          {p.protocol} · {p.kind}{p.market ? ` · ${p.market}` : ''}
                        </span>
                      </span>
                      <span className="flex items-baseline gap-3">
                        <span className={clsx('font-data text-xs tabular-nums', isDebt ? 'text-[#b82214]/70' : 'text-zinc-400')}>
                          {fmt(p.amount, p.decimals, 4)}
                        </span>
                        <span className={clsx('w-28 text-right font-data text-sm tabular-nums', isDebt ? 'text-[#b82214]' : 'text-zinc-900')}>
                          {p.usdValue == null ? '—' : usd(p.usdValue)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {data.positions!.every((p) => p.usdValue != null) && (
                <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3">
                  <span className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Net position</span>
                  <span className="font-data text-sm font-medium tabular-nums text-zinc-900">
                    {usd(data.positions!.reduce((n, p) => n + (p.usdValue ?? 0), 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          {(data.risks?.length ?? 0) > 0 && <RiskLevels risks={data.risks!} />}

          <div className="mt-4 overflow-hidden rounded-xl border border-black/[0.06] shadow-soft">
            <MarkCheck data={data} baseSym={baseSym} baseDec={baseDec} />
          </div>

          {(data.unvalued?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-50/60 p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider-2 text-amber-700">
                NAV incomplete
              </p>
              <p className="mt-1.5 text-sm text-amber-900">
                Part of this vault could not be valued, so NAV and the live share price fall back to the
                last official rate. The share price will not update until this resolves.
              </p>
              <ul className="mt-2 space-y-1">
                {data.unvalued!.map((u, i) => (
                  <li key={i} className="font-data text-xs text-amber-800">
                    {u.protocol}: {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </>
      )}
    </div>
  );
}
