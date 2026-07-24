import { scaleLinear } from 'd3-scale';

type Step = { k: string; v: number };

const DATA: Step[] = [
  { k: 'carry', v: 6 },
  { k: 'slippage', v: -4 },
  { k: 'borrow cost', v: -3 },
  { k: 'price move', v: -1 },
];
const START = 100;

const UP = '#10c689';
const DOWN = '#d62e1f';
const UP_TEXT = '#10c689';
const DOWN_TEXT = '#9a1c10';
const MUTED = '#9ca3af';
const GRID = '#e5e7eb';
const INK = '#374151';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

const W = 660;
const H = 230;
const M = { top: 36, right: 12, bottom: 30, left: 12 };

// Additive P&L decomposition. Each column floats at its running total, connected
// to the next, so the deltas trace the path from entry NAV to exit NAV.
export default function WaterfallChart() {
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  let run = START;
  const steps = DATA.map((d) => {
    const y0 = run;
    run += d.v;
    return { ...d, y0, y1: run };
  });

  const vals = [START, ...steps.map((s) => s.y1)];
  const dmin = Math.min(...vals);
  const dmax = Math.max(...vals);
  const pad = (dmax - dmin) * 0.5;

  const y = scaleLinear().domain([dmin - pad, dmax + pad]).range([ih, 0]);

  const n = steps.length;
  const step = iw / n;
  const bw = Math.min(step * 0.4, 34);
  const colLeft = (i: number) => i * step + (step - bw) / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Profit and loss attribution waterfall. Carry adds $6.00, slippage subtracts $4.00, borrow cost subtracts $3.00, price move subtracts $1.00, moving NAV from $100.00 to $98.00."
    >
      <g transform={`translate(${M.left},${M.top})`}>
        <line x1={0} x2={iw} y1={y(START)} y2={y(START)} stroke={GRID} strokeWidth={1} />
        {steps.map((s, i) => {
          const cx = colLeft(i);
          const top = y(Math.max(s.y0, s.y1));
          const bot = y(Math.min(s.y0, s.y1));
          const up = s.v > 0;
          const next = steps[i + 1];
          return (
            <g key={s.k}>
              <rect
                x={cx}
                y={top}
                width={bw}
                height={Math.max(bot - top, 2)}
                rx={2}
                fill={up ? UP : DOWN}
                className="transition-opacity hover:opacity-80"
              >
                <title>{`${s.k}: ${up ? '+' : '−'}$${Math.abs(s.v).toFixed(2)} · running $${s.y1.toFixed(2)}`}</title>
              </rect>
              <text
                x={cx + bw / 2}
                y={top - 8}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill={up ? UP_TEXT : DOWN_TEXT}
                fontFamily={MONO}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {(up ? '+' : '−') + '$' + Math.abs(s.v).toFixed(2)}
              </text>
              <text x={cx + bw / 2} y={ih + 18} textAnchor="middle" fontSize={10.5} fill={INK} fontFamily={MONO}>
                {s.k}
              </text>
              {next && (
                <line
                  x1={cx + bw}
                  x2={colLeft(i + 1)}
                  y1={y(s.y1)}
                  y2={y(s.y1)}
                  stroke={MUTED}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
