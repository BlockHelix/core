type Row = { driver: string; v: number; ref: string };

// Each driver, its signed $ impact, and its real source (a tx set for the swaps;
// an accrual for carry/borrow; a valuation for the mark).
const ROWS: Row[] = [
  { driver: 'carry', v: 182, ref: 'yield accrued' },
  { driver: 'slippage', v: -221, ref: '9 rebalance swaps' },
  { driver: 'borrow cost', v: -89, ref: 'interest · Aave' },
  { driver: 'price move', v: -34, ref: 'PT mark to oracle' },
];

const money = (v: number) =>
  (v > 0 ? '+$' : v < 0 ? '−$' : '$') +
  Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const colorFor = (v: number) => (v > 0 ? '#059669' : v < 0 ? '#dc2626' : '#6b7280');

export default function AttributionTrace() {
  const net = ROWS.reduce((a, r) => a + r.v, 0);

  return (
    <div>
      <div className="space-y-3.5">
        {ROWS.map((r) => (
          <div key={r.driver}>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-gray-700">{r.driver}</span>
              <span aria-hidden className="h-px flex-1 -translate-y-[3px] border-b border-dotted border-gray-300" />
              <span
                className="shrink-0 font-data text-[13px] font-semibold tabular-nums"
                style={{ color: colorFor(r.v) }}
              >
                {money(r.v)}
              </span>
            </div>
            <div className="font-mono text-[10.5px] text-gray-400">{r.ref}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-baseline gap-3 border-t border-dashed border-gray-300 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">net · residual $0.00</span>
        <span aria-hidden className="flex-1" />
        <span className="font-data text-sm font-semibold tabular-nums" style={{ color: colorFor(net) }}>
          {money(net)}
        </span>
      </div>
    </div>
  );
}
