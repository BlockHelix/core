const INK = '#10c689';
const SUB = '#8A8577';
const LOOP = '#2beead';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

const HW = 250; // slab half-width
const HH = 95; // slab half-height
const T = 24; // slab thickness

const LAYERS = [
  { n: '01', title: 'BLOCKCHAIN', sub: 'BASE · ERC-4626', side: 'left' },
  { n: '02', title: 'INVARIANTS', sub: 'BOUNDS ON EVERY TRADE', side: 'right' },
  { n: '03', title: 'SIMULATION', sub: 'MONTE CARLO PATHS', side: 'left' },
  { n: '04', title: 'AI', sub: 'AGENT OPERATORS', side: 'right' },
] as const;

// Side labels need the full 1000-unit width, which on a phone shrinks 14px type to
// about 5px. So the narrow layout stacks the labels over each slab, spaces the slabs
// further apart to make room, and crops the viewBox to the slab band.
const WIDE = { ys: [170, 430, 690, 950], viewBox: '0 0 1000 1150', stacked: false, loopX: 60 };
const NARROW = { ys: [250, 580, 910, 1240], viewBox: '212 0 576 1410', stacked: true, loopX: 240 };

const CAPTION = 'Diagram: the blockchain layer enforces invariants, simulation explores execution paths, AI operators trade within the bounds, and AI outcomes loop back to update the invariants.';

function Stack({ id, ys, viewBox, stacked, loopX }: { id: string; ys: readonly number[]; viewBox: string; stacked: boolean; loopX: number }) {
  const [y0, y1, y2, y3] = ys;
  const lx = stacked ? 10 : 18; // backprop label inset from the loop line
  const type = stacked ? { n: 14, title: 22, sub: 15, caption: 15 } : { n: 10, title: 14, sub: 11, caption: 11 };

  return (
    <svg viewBox={viewBox} className="w-full h-auto" role="img" aria-label={CAPTION}>
      <defs>
        <linearGradient id={`${id}-faceL`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INK} stopOpacity="0.13" />
          <stop offset="1" stopColor={INK} stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={`${id}-faceR`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INK} stopOpacity="0.2" />
          <stop offset="1" stopColor={INK} stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {ys.map((cy) => (
        <g key={cy}>
          {/* left + right side faces, then top face */}
          <path d={`M 250 ${cy} L 500 ${cy + HH} L 500 ${cy + HH + T} L 250 ${cy + T} Z`} fill={`url(#${id}-faceL)`} stroke={INK} strokeOpacity="0.45" />
          <path d={`M 500 ${cy + HH} L 750 ${cy} L 750 ${cy + T} L 500 ${cy + HH + T} Z`} fill={`url(#${id}-faceR)`} stroke={INK} strokeOpacity="0.45" />
          <path
            d={`M 500 ${cy - HH} L 750 ${cy} L 500 ${cy + HH} L 250 ${cy} Z`}
            fill={cy === y1 ? INK : '#0a0a0a'}
            fillOpacity={cy === y1 ? 0.05 : 1}
            stroke={INK}
            strokeWidth="1.5"
          />
        </g>
      ))}

      {/* Flow: each layer feeds the next, top→down */}
      {[0, 1, 2].map((i) => {
        const from = ys[i] + HH + T + 7;
        const to = stacked ? ys[i + 1] - HH - 74 : ys[i + 1] - HH - 33;
        return (
          <g key={i}>
            <path d={`M 500 ${from} L 500 ${to}`} fill="none" stroke={INK} strokeOpacity="0.7" strokeWidth="1.25" />
            <path d={`M 500 ${to + 9} L 496.5 ${to} L 503.5 ${to} Z`} fill={INK} fillOpacity="0.7" />
          </g>
        );
      })}

      {/* Glyph: Blockchain — mini stacked layers on the slab */}
      <g stroke={INK} strokeWidth="1.5" fill="none">
        {[y0 - 36, y0 - 12, y0 + 12].map((cy) => (
          <g key={cy}>
            <path d={`M 500 ${cy - 38} L 600 ${cy} L 500 ${cy + 38} L 400 ${cy} Z`} fill={INK} fillOpacity="0.04" />
            <path d={`M 400 ${cy} L 400 ${cy + 8} M 600 ${cy} L 600 ${cy + 8} M 500 ${cy + 38} L 500 ${cy + 46}`} />
          </g>
        ))}
      </g>

      {/* Glyph: Invariants — rigid lattice, iso-projected onto the slab */}
      <g transform={`translate(500 ${y1}) scale(1 0.38) rotate(45)`}>
        <path
          d="M-110 -110V110 M-66 -110V110 M-22 -110V110 M22 -110V110 M66 -110V110 M110 -110V110 M-110 -110H110 M-110 -66H110 M-110 -22H110 M-110 22H110 M-110 66H110 M-110 110H110"
          fill="none"
          stroke={INK}
          strokeWidth="3"
        />
      </g>

      {/* Glyph: Simulation — Monte Carlo path fan. Shared origin and shared control
          point, so the paths nest without crossing. */}
      <g transform={`translate(500 ${y2}) scale(1 0.38) rotate(45)`}>
        <g fill="none" stroke={INK} strokeWidth="3">
          {[-96, -48, 0, 48, 96].map((ey) => (
            <path key={ey} d={`M -95 85 Q -5 85, 112 ${ey}`} />
          ))}
        </g>
        <circle cx="-95" cy="85" r="7" fill={INK} />
        {[-96, -48, 0, 48, 96].map((ey) => (
          <circle key={ey} cx="112" cy={ey} r="6" fill={INK} />
        ))}
      </g>

      {/* Glyph: AI — symmetric feedforward network, iso-projected */}
      <g transform={`translate(500 ${y3}) scale(1 0.38) rotate(45)`}>
        <g fill="none" stroke={INK} strokeWidth="2" strokeOpacity="0.5">
          {[0, 1].flatMap((ci) =>
            [-75, 0, 75].flatMap((ya) =>
              [-75, 0, 75].map((yb) => (
                <path key={`${ci}-${ya}-${yb}`} d={`M ${[-85, 0, 85][ci]} ${ya} L ${[-85, 0, 85][ci + 1]} ${yb}`} />
              )),
            ),
          )}
        </g>
        {[-85, 0, 85].flatMap((x) =>
          [-75, 0, 75].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="8" fill="#0a0a0a" stroke={INK} strokeWidth="3.5" />),
        )}
      </g>

      {/* Backprop: AI loops back around the left margin into Invariants */}
      <path
        d={`M 248 ${y3 + T} L ${loopX} ${y3 + T} L ${loopX} ${y1 + T} L 239 ${y1 + T}`}
        fill="none"
        stroke={LOOP}
        strokeWidth="1.5"
        strokeDasharray="6 5"
      >
        <animate attributeName="stroke-dashoffset" values="11;0" dur="0.9s" repeatCount="indefinite" />
      </path>
      <circle cx="248" cy={y3 + T} r="2.5" fill={LOOP} />
      <path d={`M 248 ${y1 + T} L 239 ${y1 + T - 3.5} L 239 ${y1 + T + 3.5} Z`} fill={LOOP} />
      <text
        transform={`rotate(-90 ${loopX - lx} ${(y1 + y3) / 2})`}
        x={loopX - lx}
        y={(y1 + y3) / 2}
        textAnchor="middle"
        fontSize={type.caption}
        letterSpacing="0.25em"
        fill={LOOP}
        style={{ fontFamily: MONO }}
      >
        BACKPROP · POLICY UPDATES
      </text>

      {LAYERS.map(({ n, title, sub, side }, i) => {
        const cy = ys[i];
        if (stacked) {
          return (
            <g key={title}>
              <text x="500" y={cy - HH - 36} textAnchor="middle" fontSize={type.title} fontWeight="600" letterSpacing="0.22em" fill={INK} style={{ fontFamily: MONO }}>
                <tspan fill={SUB} fontWeight="400">{n} </tspan>
                {title}
              </text>
              <text x="500" y={cy - HH - 14} textAnchor="middle" fontSize={type.sub} letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
                {sub}
              </text>
            </g>
          );
        }
        const left = side === 'left';
        const tx = left ? 214 : 786;
        return (
          <g key={title}>
            <text x={tx} y={cy - 34} textAnchor={left ? 'end' : 'start'} fontSize={type.n} letterSpacing="0.25em" fill={SUB} style={{ fontFamily: MONO }}>
              {n}
            </text>
            <text x={tx} y={cy - 12} textAnchor={left ? 'end' : 'start'} fontSize={type.title} fontWeight="600" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
              {title}
            </text>
            <text x={tx} y={cy + 10} textAnchor={left ? 'end' : 'start'} fontSize={type.sub} letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
              {sub}
            </text>
            <path d={left ? `M 224 ${cy - 16} L 279 ${cy - 16}` : `M 776 ${cy - 16} L 721 ${cy - 16}`} fill="none" stroke={INK} strokeWidth="1.25" />
            <path
              d={left ? `M 288 ${cy - 16} L 279 ${cy - 19} L 279 ${cy - 13} Z` : `M 712 ${cy - 16} L 721 ${cy - 19} L 721 ${cy - 13} Z`}
              fill={INK}
            />
          </g>
        );
      })}
    </svg>
  );
}

// Exploded isometric stack. Flow runs top→down; a dashed backprop line runs from AI
// around the left margin back into Invariants.
export default function EnforcementLoop() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="sm:hidden">
        <Stack id="loop-sm" {...NARROW} />
      </div>
      <div className="hidden sm:block">
        <Stack id="loop-lg" {...WIDE} />
      </div>
    </div>
  );
}
