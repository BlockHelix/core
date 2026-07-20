import { scaleLinear } from 'd3-scale';
import { line, curveMonotoneX } from 'd3-shape';

// NAV over the run: carry lifts it, rebalance costs drag it back below entry.
const NAV = [10000, 10080, 10160, 10040, 9960, 9990, 9900, 9850, 9838];
const START = 10000;

const GRID = '#e5e7eb';
const REF = '#cbd5e1';
const MUT = '#94a3b8';
const GREEN = '#059669';
const RED = '#dc2626';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

const W = 820;
const H = 196;
const L = 16;
const R = 726;
const T = 48;
const B = 150;

const nx = scaleLinear().domain([0, NAV.length - 1]).range([L, R]);
const ny = scaleLinear().domain([9780, 10220]).range([B, T]);
const Y_TICKS: [number, string][] = [
  [10100, '10,100'],
  [START, '10,000'],
  [9900, '9,900'],
];

const num = (v: number) => v.toLocaleString('en-US');

export default function NavLine() {
  const path = line<number>().x((_d, i) => nx(i)).y((v) => ny(v)).curve(curveMonotoneX)(NAV) ?? '';
  const end = NAV[NAV.length - 1];
  const eY = ny(START);

  // biggest single-step drop marks a rebalance
  let dip = 1;
  for (let i = 2; i < NAV.length; i++) {
    if (NAV[i] - NAV[i - 1] < NAV[dip] - NAV[dip - 1]) dip = i;
  }

  const bracket = (x: number, y: number, dx: number, dy: number) => `M ${x + dx} ${y} L ${x} ${y} L ${x} ${y + dy}`;
  const corners = [
    bracket(L, T, 10, 10),
    bracket(R, T, -10, 10),
    bracket(L, B, 10, -10),
    bracket(R, B, -10, -10),
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`NAV from $10,000 to $${num(end)} over June 12 to July 12. Green above entry, red below, with a rebalance marked.`}
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
        {'// NAV · 0x8F3A · JUN 12–JUL 12'}
      </text>

      {[10100, 9900].map((v) => (
        <line key={v} x1={L} x2={R} y1={ny(v)} y2={ny(v)} stroke={GRID} strokeWidth={1} strokeDasharray="1 4" />
      ))}
      <line x1={L} x2={R} y1={eY} y2={eY} stroke={REF} strokeWidth={1} strokeDasharray="1 3" />
      {Y_TICKS.map(([v, t]) => (
        <text key={t} x={R + 8} y={ny(v) + 3} fontSize={9} fill={MUT} fontFamily={MONO}>
          {t}
        </text>
      ))}

      {corners.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={REF} strokeWidth={1.5} />
      ))}

      <line x1={nx(dip)} x2={nx(dip)} y1={T} y2={B} stroke={REF} strokeWidth={1} strokeDasharray="2 3" />
      <text x={nx(dip) + 6} y={T + 10} fontSize={9} letterSpacing="0.1em" fill={RED} fontFamily={MONO}>
        REBAL
      </text>

      <path
        d={path}
        fill="none"
        stroke={GREEN}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath="url(#navAbove)"
      />
      <path
        d={path}
        fill="none"
        stroke={RED}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath="url(#navBelow)"
      />

      <rect x={nx(dip) - 4} y={ny(NAV[dip]) - 4} width={8} height={8} fill="#ffffff" stroke={RED} strokeWidth={1.5} />
      <rect x={nx(NAV.length - 1) - 3.5} y={ny(end) - 3.5} width={7} height={7} fill={RED} />
      <text x={R + 8} y={ny(end) + 3} fontSize={9} fontWeight={700} fill={RED} fontFamily={MONO}>
        {num(end)}
      </text>

      <text x={L} y={B + 18} fontSize={9} letterSpacing="0.12em" fill={MUT} fontFamily={MONO}>
        JUN 12
      </text>
      <text x={R} y={B + 18} textAnchor="end" fontSize={9} letterSpacing="0.12em" fill={MUT} fontFamily={MONO}>
        JUL 12
      </text>
    </svg>
  );
}
