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
  friction: 'slippage',
  fees: 'fees',
  incidents: 'incidents',
};
const DRIVER_REF: Record<string, string> = {
  carry: 'collateral yield accrued',
  mark: 'collateral mark to oracle',
  borrow_interest: 'interest accrued · Morpho',
  friction: 'entry-swap slippage',
  fees: 'protocol fees',
  incidents: 'liquidations',
};

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
        <div className="space-y-10">
          {items.map((s) => {
            const m = s.metrics ?? {};
            const drivers = s.drivers ?? {};
            const address = s.id.split(':')[1] ?? s.id;
            const rewards = m.rewards_usd ?? 0;
            const netEconomic = m.net_economic_usd ?? (s.deltaNav ?? 0) + rewards;
            const residualOk = s.residual != null && Math.abs(s.residual) < 1;

            const rawSeries = m.series ?? [];
            const series: NavPoint[] = rawSeries.length > 1 ? rawSeries : [{ t: 0, v: 0 }, { t: 1, v: netEconomic }];

            const rows: Row[] = [
              ...Object.entries(drivers).map(([k, v]) => ({ driver: DRIVER_LABEL[k] ?? k, v, ref: DRIVER_REF[k] ?? '' })),
              { driver: 'rewards', v: rewards, ref: 'Merkl · off-NAV, claimed' },
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
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 border-t border-dashed border-gray-200 px-4 py-5 sm:grid-cols-5 sm:px-6">
                  {stat('leverage', `${(m.leverage ?? 0).toFixed(1)}x`)}
                  {stat('equity', compact(m.equity_usd ?? 0))}
                  {stat('borrow apr', `${(m.borrow_apr ?? 0).toFixed(2)}%`, RED)}
                  {stat('reward apr', `${(m.reward_apr ?? 0).toFixed(2)}%`, GREEN)}
                  {stat('net apy', pct(m.net_apy ?? 0), (m.net_apy ?? 0) < 0 ? RED : GREEN)}
                </div>

                {/* economic-value line */}
                <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                  <NavLine
                    series={series}
                    refValue={0}
                    title={`// ECON P&L · ${address.slice(0, 6)}… · ${fmtDate(series[0]?.t)}–${fmtDate(series[series.length - 1]?.t)}`}
                    startLabel={fmtDate(series[0]?.t)}
                    endLabel={fmtDate(series[series.length - 1]?.t)}
                    markerLabel="SCALE-UP"
                    format={compact}
                  />
                </div>

                {/* itemised trace */}
                <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                  <AttributionTrace rows={rows} residual={s.residual ?? 0} />
                </div>

                {/* analyst note */}
                <div className="flex items-start gap-3 border-t border-dashed border-gray-200 bg-gray-50 px-6 py-4">
                  <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-widest text-gray-400 font-mono">Analyst</span>
                  <p className="text-sm text-gray-900 leading-relaxed">
                    Cash P&amp;L is {full(s.deltaNav ?? 0)} (borrow interest, {residualOk ? 'residual $0' : 'residual off'}). But{' '}
                    {full(rewards)} of Merkl rewards, already claimed,{' '}
                    {rewards + (s.deltaNav ?? 0) >= 0 ? 'more than cover' : 'partly offset'} it:{' '}
                    <span className="font-semibold" style={{ color: netEconomic < 0 ? RED : GREEN }}>
                      net {full(netEconomic)}
                    </span>{' '}
                    at {(m.leverage ?? 0).toFixed(1)}x. Ethena sats and the Robinhood airdrop are unpriced upside on top.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
