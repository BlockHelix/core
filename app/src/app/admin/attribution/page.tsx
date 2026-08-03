import NavLine, { type NavPoint } from '@/components/charts/NavLine';
import AttributionTrace, { type Row } from '@/components/charts/AttributionTrace';
import { getAttribution } from '@/lib/server/admin';

export const metadata = { title: 'Attribution | BlockHelix Admin' };
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DRIVER_LABEL: Record<string, string> = {
  carry: 'carry',
  mark: 'price move',
  borrow_interest: 'borrow',
  execution: 'execution',
  friction: 'execution', // engine <= v2 rows
  fees: 'fees',
  incidents: 'incidents',
};
const DRIVER_REF: Record<string, string> = {
  carry: 'collateral yield accrued',
  mark: 'collateral mark to oracle',
  borrow_interest: 'interest accrued · Morpho',
  execution: 'swap legs + fees · measured from transfer logs',
  friction: 'loop swap cost · engine v2 lower bound',
  fees: 'protocol fees',
  incidents: 'liquidations',
};

const CHAIN_LABEL: Record<number, string> = {
  1: 'Ethereum mainnet',
  4663: 'Robinhood Chain',
};

// Unpriced upside is chain- and collateral-specific: Ethena sats only accrue to Ethena
// collateral, the airdrop only to Robinhood Chain activity.
function upsideNote(chainId: number, collateral: string | null): string | null {
  const sats = collateral === 'sUSDe' || collateral === 'USDe';
  if (chainId === 4663) {
    return sats
      ? 'Ethena sats and the Robinhood airdrop are unpriced upside on top.'
      : 'The Robinhood airdrop is unpriced upside on top.';
  }
  return sats ? 'Ethena sats are unpriced upside on top.' : null;
}

const GREEN = '#10c689';
const RED = '#b82214';
const compact = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}k` : a.toFixed(0);
  return (v < 0 ? '−$' : '$') + s;
};
const full = (v: number) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
const fmtDate = (t?: number) =>
  t ? new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase() : '';

export default async function AdminAttributionPage() {
  const { loaded, items } = await getAttribution();

  const chains = [...new Set(items.map((s) => s.chainId))].sort((a, b) => a - b);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-3">{'// Attribution modelling'}</p>
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 mb-3">Debug the yield.</h2>
      <p className="text-sm text-gray-500 max-w-xl mb-8 leading-relaxed">
        Every position&apos;s ΔNAV modelled into named drivers tied to their on-chain source, a residual near zero is the
        proof it&apos;s honest. Reward streams live off the NAV, so we add them back to show the true economic return.
      </p>

      {!loaded || items.length === 0 ? (
        <div className="border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No decompositions yet. Run the engine:{' '}
          <code className="font-mono text-[12px] text-gray-700">pnpm --filter worker attribution</code>
        </div>
      ) : (
        <div className="space-y-12">
          {chains.map((chainId) => {
            const chainItems = items.filter((s) => s.chainId === chainId);
            return (
              <section key={chainId}>
                <div className="mb-5 flex items-baseline gap-3 border-b border-gray-200 pb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                    {CHAIN_LABEL[chainId] ?? `Chain ${chainId}`}
                  </h3>
                  <span className="font-mono text-[11px] text-gray-400">
                    chain {chainId} · {chainItems.length} books
                  </span>
                </div>
                <div className="space-y-10">
                  {chainItems.map((s) => {
                    const m = s.metrics ?? {};
                    const drivers = s.drivers ?? {};
                    const address = s.id.split(':')[1] ?? s.id;
                    const rewards = m.rewards_usd ?? 0;
                    const netEconomic = m.net_economic_usd ?? (s.deltaNav ?? 0) + rewards;
                    const residualOk = s.residual != null && Math.abs(s.residual) < 1;

                    const rawSeries = m.series ?? [];
                    const series: NavPoint[] = rawSeries.length > 1 ? rawSeries : [{ t: 0, v: 0 }, { t: 1, v: netEconomic }];
                    const upside = upsideNote(s.chainId, s.collateralAsset);
                    const heldDays = Math.round(m.holding_days ?? 0);
                    // Annualizing a days-old book is noise, and Merkl posts rewards in epochs,
                    // so early realized systematically lags. Show the rate only once it means something.
                    const tooYoung = (m.holding_days ?? 0) < 7;

                    const rows: Row[] = [
                      ...Object.entries(drivers).map(([k, v]) => ({ driver: DRIVER_LABEL[k] ?? k, v, ref: DRIVER_REF[k] ?? '' })),
                      { driver: 'rewards', v: rewards, ref: 'Merkl · off-NAV, this market only' },
                    ];

                    const stat = (label: string, value: string, color?: string) => (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">{label}</div>
                        <div className="mt-1.5 font-data text-lg font-semibold tabular-nums" style={color ? { color } : undefined}>
                          {value}
                        </div>
                      </div>
                    );

                    return (
                      <div key={s.id} className="border border-gray-200 shadow-sm bg-white">
                        {/* header */}
                        <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-4 sm:px-6">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{s.label ?? s.id}</div>
                            <div className="mt-0.5 font-mono text-[11px] text-gray-400">
                              {s.collateralAsset}/{s.loanAsset} · chain {s.chainId} ·{' '}
                              <a
                                href={`https://app.merkl.xyz/users/${address}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-500 underline decoration-dotted underline-offset-2 hover:text-gray-900"
                              >
                                {address.slice(0, 6)}…{address.slice(-4)} ↗
                              </a>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-data text-xl font-semibold tabular-nums" style={{ color: netEconomic < 0 ? RED : GREEN }}>
                              {compact(netEconomic)}
                            </div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">net economic return</div>
                          </div>
                        </div>

                        {/* metrics strip */}
                        <div className="grid grid-cols-2 gap-y-5 gap-x-4 border-t border-dashed border-gray-200 px-4 py-5 sm:grid-cols-3 lg:grid-cols-6 sm:px-6">
                          {stat('leverage', `${(m.leverage ?? 0).toFixed(1)}x`)}
                          {stat('equity', compact(m.equity_usd ?? 0))}
                          {stat('borrow apr', `${(m.borrow_apr ?? 0).toFixed(2)}%`, RED)}
                          {stat('reward apr', `${(m.reward_apr ?? 0).toFixed(2)}%`, GREEN)}
                          {tooYoung
                            ? stat(`realized apy · ${heldDays}d held`, '— too young')
                            : stat(`realized apy · ${heldDays}d held`, pct(m.net_apy ?? 0), (m.net_apy ?? 0) < 0 ? RED : GREEN)}
                          {stat('fwd apy · $1 now', pct(m.forward_apy ?? 0), (m.forward_apy ?? 0) < 0 ? RED : GREEN)}
                        </div>

                        {/* NAV curve: book size through time (flows in/out + P&L drift) */}
                        {(m.equity_series?.length ?? 0) > 1 && (
                          <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                            <NavLine
                              series={m.equity_series}
                              refValue={0}
                              title={`// NAV · money in/out + P&L · ${address.slice(0, 6)}…`}
                              startLabel={fmtDate(m.equity_series?.[0]?.t)}
                              endLabel={fmtDate(m.equity_series?.[m.equity_series.length - 1]?.t)}
                              markerLabel="FLOW"
                              format={compact}
                            />
                          </div>
                        )}

                        {/* economic-value line */}
                        <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                          <NavLine
                            series={series}
                            refValue={0}
                            title={`// ECON P&L · ${address.slice(0, 6)}… · ${fmtDate(series[0]?.t)}–${fmtDate(series[series.length - 1]?.t)}`}
                            startLabel={fmtDate(series[0]?.t)}
                            endLabel={fmtDate(series[series.length - 1]?.t)}
                            markerLabel="SHIFT"
                            format={compact}
                          />
                        </div>

                        {/* realized APY over time: what a dollar in the book was earning, annualized */}
                        {(m.apy_series?.length ?? 0) > 1 && (
                          <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                            <NavLine
                              series={m.apy_series}
                              refValue={0}
                              title={`// REALIZED APY · 30D ROLLING · ${address.slice(0, 6)}…`}
                              startLabel={fmtDate(m.apy_series?.[0]?.t)}
                              endLabel={fmtDate(m.apy_series?.[m.apy_series.length - 1]?.t)}
                              markerLabel=""
                              format={pct}
                            />
                          </div>
                        )}

                        {/* itemised trace */}
                        <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                          <AttributionTrace rows={rows} residual={s.residual ?? 0} />
                        </div>

                        {/* analyst note */}
                        <div className="flex items-start gap-3 border-t border-dashed border-gray-200 bg-gray-50 px-6 py-4">
                          <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-widest text-gray-400 font-mono">Analyst</span>
                          <p className="text-sm text-gray-900 leading-relaxed">
                            Cash P&amp;L is {full(s.deltaNav ?? 0)} ({residualOk ? 'residual $0' : 'residual off'}).{' '}
                            {rewards > 1 ? (
                              <>
                                {full(rewards)} of Merkl rewards from this market, already claimed,{' '}
                                {(s.deltaNav ?? 0) >= 0
                                  ? 'add to'
                                  : rewards + (s.deltaNav ?? 0) >= 0
                                    ? 'more than cover'
                                    : 'partly offset'}{' '}
                                it:{' '}
                              </>
                            ) : (
                              <>No Merkl rewards attributable to this market: </>
                            )}
                            <span className="font-semibold" style={{ color: netEconomic < 0 ? RED : GREEN }}>
                              net {full(netEconomic)}
                            </span>{' '}
                            at {(m.leverage ?? 0).toFixed(1)}x.{' '}
                            {tooYoung ? (
                              <>
                                The book is {heldDays === 1 ? '1 day' : `${heldDays} days`} old: annualized rates are
                                not meaningful yet, and Merkl posts rewards in epochs, so the early tally lags what the
                                position is really earning.{' '}
                              </>
                            ) : (
                              <>
                                Realized APY is measured on the time-weighted equity, so it is what a dollar in the book
                                actually earned.{' '}
                              </>
                            )}
                            A dollar added now makes about{' '}
                            <span className="font-semibold" style={{ color: (m.forward_apy ?? 0) < 0 ? RED : GREEN }}>
                              {pct(m.forward_apy ?? 0)}
                            </span>{' '}
                            at current rates and this leverage.{upside ? ` ${upside}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
