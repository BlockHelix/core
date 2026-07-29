import { scaleLinear } from 'd3-scale';
import { line, curveMonotoneX } from 'd3-shape';

export type NavPoint = { t: number; v: number };

// Homepage sample (NAV over a run: carry lifts it, rebalance costs drag it below entry). The
// admin attribution page passes a real cumulative-P&L series via props.
const DEFAULT_SERIES: NavPoint[] = [10000, 10080, 10160, 10040, 9960, 9990, 9900, 9850, 9838].map((v, i) => ({ t: i, v }));

const GRID = '#e5e7eb';
const REF = '#cbd5e1';
const MUT = '#94a3b8';
const GREEN = '#10c689';
const RED = '#b82214';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

const W = 820;
const H = 196;
const L = 16;
const R = 726;
const T = 48;
const B = 150;

export default function NavLine({
  series = DEFAULT_SERIES,
  refValue,
  title = '// NAV · 0x8F3A · JUN 12–JUL 12',
  startLabel = 'JUN 12',
  endLabel = 'JUL 12',
  markerLabel = 'REBAL',
  format = (v: number) => v.toLocaleString('en-US'),
}: {
  series?: NavPoint[];
  refValue?: number;
  title?: string;
  startLabel?: string;
  endLabel?: string;
  markerLabel?: string;
  format?: (v: number) => string;
}) {
  const pts = series.length ? series : DEFAULT_SERIES;
  const values = pts.map((p) => p.v);
  const ref = refValue ?? values[0];
  const lo = Math.min(...values, ref);
  const hi = Math.max(...values, ref);
  const pad = (hi - lo) * 0.35 || Math.max(Math.abs(hi), 1) * 0.1;

  const nx = scaleLinear().domain([0, pts.length - 1]).range([L, R]);
  const ny = scaleLinear().domain([lo - pad, hi + pad]).range([B, T]);
  const eY = ny(ref);
  const path = line<NavPoint>().x((_d, i) => nx(i)).y((p) => ny(p.v)).curve(curveMonotoneX)(pts) ?? '';
  const end = values[values.length - 1];

  const ticks = [hi, ref, lo].filter((v, i, a) => a.indexOf(v) === i);

  // biggest single-step move (a rebalance on the homepage; a scale-up on the real series)
  let dip = 1;
  for (let i = 2; i < pts.length; i++) {
    if (Math.abs(values[i] - values[i - 1]) > Math.abs(values[dip] - values[dip - 1])) dip = i;
  }
  const showMarker = pts.length > 2 && markerLabel;

  const bracket = (x: number, y: number, dx: number, dy: number) => `M ${x + dx} ${y} L ${x} ${y} L ${x} ${y + dy}`;
  const corners = [bracket(L, T, 10, 10), bracket(R, T, -10, 10), bracket(L, B, 10, -10), bracket(R, B, -10, -10)];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`${title}. Value from ${format(values[0])} to ${format(end)}, green above the reference, red below.`}
    >
      <defs>
        <clipPath id="navAbove">
          <rect x={0} y={0} width={W} height={eY} />
        </clipPath>
        <clipPath id="navBelow">
          <rect x={0} y={eY} width={W} height={H - eY} />
        </clipPath>
      </defs>

      <text x={L} y={22} fontSize={10} letterSpacing="0.18em" fill={MUT} fontFamily={MONO}>
        {title}
      </text>

      {ticks.filter((v) => v !== ref).map((v) => (
        <line key={v} x1={L} x2={R} y1={ny(v)} y2={ny(v)} stroke={GRID} strokeWidth={1} strokeDasharray="1 4" />
      ))}
      <line x1={L} x2={R} y1={eY} y2={eY} stroke={REF} strokeWidth={1} strokeDasharray="1 3" />
      {ticks.map((v) => (
        <text key={`t${v}`} x={R + 8} y={ny(v) + 3} fontSize={9} fill={MUT} fontFamily={MONO}>
          {format(v)}
        </text>
      ))}

      {corners.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={REF} strokeWidth={1.5} />
      ))}

      {showMarker && (
        <>
          <line x1={nx(dip)} x2={nx(dip)} y1={T} y2={B} stroke={REF} strokeWidth={1} strokeDasharray="2 3" />
          <text x={nx(dip) + 6} y={T + 10} fontSize={9} letterSpacing="0.1em" fill={MUT} fontFamily={MONO}>
            {markerLabel}
          </text>
        </>
      )}

      <path d={path} fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#navAbove)" />
      <path d={path} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" clipPath="url(#navBelow)" />

      <rect x={nx(pts.length - 1) - 3.5} y={ny(end) - 3.5} width={7} height={7} fill={end >= ref ? GREEN : RED} />
      <text x={R + 8} y={ny(end) + 3} fontSize={9} fontWeight={700} fill={end >= ref ? GREEN : RED} fontFamily={MONO}>
        {format(end)}
      </text>

      <text x={L} y={B + 18} fontSize={9} letterSpacing="0.12em" fill={MUT} fontFamily={MONO}>
        {startLabel}
      </text>
      <text x={R} y={B + 18} textAnchor="end" fontSize={9} letterSpacing="0.12em" fill={MUT} fontFamily={MONO}>
        {endLabel}
      </text>
    </svg>
  );
}
