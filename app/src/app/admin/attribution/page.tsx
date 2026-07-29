import WaterfallChart, { type Step } from '@/components/charts/WaterfallChart';
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

const compact = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}k` : a.toFixed(0);
  return (v < 0 ? '−$' : '$') + s;
};
const full = (v: number) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1) + '%';
const GREEN = '#10c689';
const RED = '#b82214';

export default async function AdminAttributionPage() {
  const { loaded, items } = await getAttribution();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-3">{'// Attribution modelling'}</p>
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 mb-3">Debug the yield.</h2>
      <p className="text-sm text-gray-500 max-w-xl mb-8">
        Every position&apos;s ΔNAV modelled into named drivers tied to their on-chain source, residual near zero is the
        proof it&apos;s honest. Reward streams live off the NAV, so they&apos;re added back to show the true economic return.
      </p>

      {!loaded || items.length === 0 ? (
        <div className="border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
          No decompositions yet. Run the engine: <code className="font-mono text-[12px] text-gray-700">pnpm --filter worker attribution</code>
        </div>
      ) : (
        <div className="space-y-8">
          {items.map((s) => {
            const m = s.metrics ?? {};
            const drivers = s.drivers ?? {};
            const address = s.id.split(':')[1] ?? s.id;
            const navStart = s.navEnd != null && s.deltaNav != null ? s.navEnd - s.deltaNav : 0;
            const rewards = m.rewards_usd ?? 0;
            const netEconomic = m.net_economic_usd ?? (s.deltaNav ?? 0) + rewards;

            // On-NAV drivers (the residual-zero part), then the off-NAV reward as the recovery step.
            const onNav = Object.entries(drivers).filter(([k, v]) => v !== 0 || k === 'carry' || k === 'borrow_interest');
            const steps: Step[] = [...onNav.map(([k, v]) => ({ k: DRIVER_LABEL[k] ?? k, v })), { k: 'rewards', v: rewards }];
            const rows: Row[] = [
              ...Object.entries(drivers).map(([k, v]) => ({ driver: DRIVER_LABEL[k] ?? k, v, ref: DRIVER_REF[k] ?? '' })),
              { driver: 'rewards', v: rewards, ref: 'Merkl · off-NAV, claimed' },
            ];
            const residualOk = s.residual != null && Math.abs(s.residual) < 1;

            const stat = (label: string, value: string, color?: string) => (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">{label}</div>
                <div className="mt-1 font-data text-lg font-semibold tabular-nums" style={color ? { color } : undefined}>
                  {value}
                </div>
              </div>
            );

            return (
              <div key={s.id} className="border border-gray-200 shadow-sm bg-white">
                {/* header */}
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4 sm:px-6">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.label ?? s.id}</div>
                    <div className="font-mono text-[11px] text-gray-400">
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
                <div className="grid grid-cols-2 gap-4 border-t border-dashed border-gray-200 px-4 py-5 sm:grid-cols-5 sm:px-6">
                  {stat('leverage', `${(m.leverage ?? 0).toFixed(1)}x`)}
                  {stat('equity', compact(m.equity_usd ?? navStart))}
                  {stat('borrow apr', `${(m.borrow_apr ?? 0).toFixed(2)}%`, RED)}
                  {stat('reward apr', `${(m.reward_apr ?? 0).toFixed(2)}%`, GREEN)}
                  {stat('net apy', pct(m.net_apy ?? 0), (m.net_apy ?? 0) < 0 ? RED : GREEN)}
                </div>

                {/* waterfall */}
                <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                  <WaterfallChart data={steps} start={navStart} ariaLabel={`${s.label ?? s.id} economic waterfall`} />
                </div>

                {/* itemised trace */}
                <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                  <AttributionTrace rows={rows} residual={s.residual ?? 0} />
                </div>

                {/* analyst note */}
                <div className="flex items-start gap-3 border-t border-dashed border-gray-200 bg-gray-50 px-6 py-4">
                  <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-widest text-gray-400 font-mono">Analyst</span>
                  <p className="text-sm text-gray-900">
                    Cash P&amp;L is {full(s.deltaNav ?? 0)} (borrow interest, {residualOk ? 'residual $0' : 'residual off'}). But{' '}
                    {full(rewards)} of Merkl rewards, already claimed, {rewards + (s.deltaNav ?? 0) >= 0 ? 'more than cover' : 'partly offset'}{' '}
                    it: <span style={{ color: netEconomic < 0 ? RED : GREEN }}>net {full(netEconomic)}</span> at{' '}
                    {(m.leverage ?? 0).toFixed(1)}x. Ethena sats and the Robinhood airdrop are unpriced upside on top.
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
