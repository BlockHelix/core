import { clsx } from 'clsx';
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
const usd = (v: number) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default async function AdminAttributionPage() {
  const { loaded, items } = await getAttribution();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs uppercase tracking-wider-2 font-medium text-[#10c689]">P&amp;L attribution</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Each position&apos;s ΔNAV decomposed into named drivers that sum back to the total, a residual near zero is the
          proof the decomposition is honest. Reconstructed from on-chain state (DEF-107).
        </p>
      </div>

      {!loaded || items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/[0.1] p-8 text-center text-sm text-zinc-500">
          No decompositions yet. Run the engine to populate them:{' '}
          <code className="font-mono text-[12px] text-zinc-700">pnpm --filter worker attribution</code>
        </div>
      ) : (
        items.map((s) => {
          const drivers = s.drivers ?? {};
          const navStart = s.navEnd != null && s.deltaNav != null ? s.navEnd - s.deltaNav : 0;
          const entries = Object.entries(drivers);
          const steps: Step[] = entries
            .filter(([k, v]) => v !== 0 || k === 'carry' || k === 'borrow_interest')
            .map(([k, v]) => ({ k: DRIVER_LABEL[k] ?? k, v }));
          const rows: Row[] = entries.map(([k, v]) => ({ driver: DRIVER_LABEL[k] ?? k, v, ref: DRIVER_REF[k] ?? '' }));
          const residualOk = s.residual != null && Math.abs(s.residual) < 1;
          return (
            <div key={s.id} className="rounded-lg border border-black/[0.06] p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-zinc-900">{s.label ?? s.id}</div>
                  <div className="font-mono text-[11px] text-zinc-400">
                    {s.collateralAsset}/{s.loanAsset} · chain {s.chainId} · {s.kind}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-data text-lg font-semibold tabular-nums"
                    style={{ color: (s.deltaNav ?? 0) < 0 ? '#b82214' : '#10c689' }}
                  >
                    {usd(s.deltaNav ?? 0)} <span className="text-[11px] font-normal text-zinc-400">ΔNAV</span>
                  </div>
                  <div
                    className={clsx(
                      'font-mono text-[10px] uppercase tracking-widest',
                      residualOk ? 'text-[#10c689]' : 'text-amber-600',
                    )}
                  >
                    residual {usd(s.residual ?? 0)}
                    {residualOk ? ' ✓' : ''}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid items-center gap-6 lg:grid-cols-[1fr_320px]">
                <WaterfallChart data={steps} start={navStart} ariaLabel={`${s.label ?? s.id} P&L waterfall`} />
                <AttributionTrace rows={rows} residual={s.residual ?? 0} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
