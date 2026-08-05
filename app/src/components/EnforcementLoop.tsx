const INK = '#10c689';
const SUB = '#8A8577';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

// Slab vertical centers, top→bottom: Blockchain, Invariants, Simulation, AI.
const Y = [170, 430, 690, 950];
const CX = 500;
const HW = 250; // slab half-width
const HH = 95; // slab half-height
const T = 24; // slab thickness

// Exploded isometric stack in the thin-line diagram style. Flow runs
// top→down; a dashed backprop line runs from AI around the left margin
// back into Invariants.
export default function EnforcementLoop() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px] max-w-3xl mx-auto">
        <svg
          viewBox="0 0 1000 1150"
          className="w-full h-auto"
          role="img"
          aria-label="Diagram: the blockchain layer enforces invariants, simulation explores execution paths, AI operators trade within the bounds, and AI outcomes loop back to update the invariants."
        >
          <defs>
            <linearGradient id="faceL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={INK} stopOpacity="0.13" />
              <stop offset="1" stopColor={INK} stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="faceR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={INK} stopOpacity="0.2" />
              <stop offset="1" stopColor={INK} stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {Y.map((cy) => (
            <g key={cy}>
              {/* left + right side faces, then top face */}
              <path d={`M 250 ${cy} L 500 ${cy + HH} L 500 ${cy + HH + T} L 250 ${cy + T} Z`} fill="url(#faceL)" stroke={INK} strokeOpacity="0.45" />
              <path d={`M 500 ${cy + HH} L 750 ${cy} L 750 ${cy + T} L 500 ${cy + HH + T} Z`} fill="url(#faceR)" stroke={INK} strokeOpacity="0.45" />
              <path
                d={`M 500 ${cy - HH} L 750 ${cy} L 500 ${cy + HH} L 250 ${cy} Z`}
                fill={cy === Y[1] ? INK : '#0a0a0a'}
                fillOpacity={cy === Y[1] ? 0.05 : 1}
                stroke={INK}
                strokeWidth="1.5"
              />
            </g>
          ))}

          {/* Flow: each layer feeds the next, top→down */}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <path d={`M 500 ${Y[i] + 126} L 500 ${Y[i] + 151}`} fill="none" stroke={INK} strokeOpacity="0.7" strokeWidth="1.25" />
              <path d={`M 500 ${Y[i] + 160} L 496.5 ${Y[i] + 151} L 503.5 ${Y[i] + 151} Z`} fill={INK} fillOpacity="0.7" />
            </g>
          ))}

          {/* Glyph: Blockchain — mini stacked layers on the slab */}
          <g stroke={INK} strokeWidth="1.5" fill="none">
            {[Y[0] - 36, Y[0] - 12, Y[0] + 12].map((cy) => (
              <g key={cy}>
                <path d={`M 500 ${cy - 38} L 600 ${cy} L 500 ${cy + 38} L 400 ${cy} Z`} fill={INK} fillOpacity="0.04" />
                <path d={`M 400 ${cy} L 400 ${cy + 8} M 600 ${cy} L 600 ${cy + 8} M 500 ${cy + 38} L 500 ${cy + 46}`} />
              </g>
            ))}
          </g>

          {/* Glyph: Invariants — rigid lattice, iso-projected onto the slab */}
          <g transform={`translate(500 ${Y[1]}) scale(1 0.38) rotate(45)`}>
            <path
              d="M-110 -110V110 M-66 -110V110 M-22 -110V110 M22 -110V110 M66 -110V110 M110 -110V110 M-110 -110H110 M-110 -66H110 M-110 -22H110 M-110 22H110 M-110 66H110 M-110 110H110"
              fill="none"
              stroke={INK}
              strokeWidth="3"
            />
          </g>

          {/* Glyph: Simulation — Monte Carlo path fan, iso-projected.
              Shared origin + shared control point, so the paths nest without crossing. */}
          <g transform={`translate(500 ${Y[2]}) scale(1 0.38) rotate(45)`}>
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
          <g transform={`translate(500 ${Y[3]}) scale(1 0.38) rotate(45)`}>
            <g fill="none" stroke={INK} strokeWidth="2" strokeOpacity="0.5">
              {[0, 1].flatMap((ci) =>
                [-75, 0, 75].flatMap((y1) =>
                  [-75, 0, 75].map((y2) => (
                    <path key={`${ci}-${y1}-${y2}`} d={`M ${[-85, 0, 85][ci]} ${y1} L ${[-85, 0, 85][ci + 1]} ${y2}`} />
                  )),
                ),
              )}
            </g>
            {[-85, 0, 85].flatMap((x) =>
              [-75, 0, 75].map((y) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="8" fill="#0a0a0a" stroke={INK} strokeWidth="3.5" />
              )),
            )}
          </g>

          {/* Backprop: AI loops back around the left margin into Invariants */}
          <path
            d={`M 248 ${Y[3] + T} L 60 ${Y[3] + T} L 60 ${Y[1] + T} L 239 ${Y[1] + T}`}
            fill="none"
            stroke="#2beead"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          >
            <animate attributeName="stroke-dashoffset" values="11;0" dur="0.9s" repeatCount="indefinite" />
          </path>
          <circle cx="248" cy={Y[3] + T} r="2.5" fill="#2beead" />
          <path d={`M 248 ${Y[1] + T} L 239 ${Y[1] + T - 3.5} L 239 ${Y[1] + T + 3.5} Z`} fill="#2beead" />
          <text
            transform={`rotate(-90 42 ${(Y[1] + Y[3]) / 2})`}
            x="42"
            y={(Y[1] + Y[3]) / 2}
            textAnchor="middle"
            fontSize="11"
            letterSpacing="0.25em"
            fill="#2beead"
            style={{ fontFamily: MONO }}
          >
            BACKPROP · POLICY UPDATES
          </text>

          {/* Figure caption */}
          <text x="60" y="46" fontSize="11" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
            FIG. 01
          </text>
          <text x="60" y="64" fontSize="11" letterSpacing="0.25em" fill={SUB} style={{ fontFamily: MONO }}>
            ENFORCEMENT LOOP
          </text>

          {/* Labels — left side: Blockchain, Simulation */}
          {[
            { cy: Y[0], n: '01', title: 'BLOCKCHAIN', sub: 'BASE · ERC-4626' },
            { cy: Y[2], n: '03', title: 'SIMULATION', sub: 'MONTE CARLO PATHS' },
          ].map(({ cy, n, title, sub }) => (
            <g key={title}>
              <text x="214" y={cy - 34} textAnchor="end" fontSize="10" letterSpacing="0.25em" fill={SUB} style={{ fontFamily: MONO }}>
                {n}
              </text>
              <text x="214" y={cy - 12} textAnchor="end" fontSize="14" fontWeight="600" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
                {title}
              </text>
              <text x="214" y={cy + 10} textAnchor="end" fontSize="11" letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
                {sub}
              </text>
              <path d={`M 224 ${cy - 16} L 279 ${cy - 16}`} fill="none" stroke={INK} strokeWidth="1.25" />
              <path d={`M 288 ${cy - 16} L 279 ${cy - 19} L 279 ${cy - 13} Z`} fill={INK} />
            </g>
          ))}

          {/* Labels — right side: Invariants, AI */}
          {[
            { cy: Y[1], n: '02', title: 'INVARIANTS', sub: 'BOUNDS ON EVERY TRADE' },
            { cy: Y[3], n: '04', title: 'AI', sub: 'AGENT OPERATORS' },
          ].map(({ cy, n, title, sub }) => (
            <g key={title}>
              <text x="786" y={cy - 34} fontSize="10" letterSpacing="0.25em" fill={SUB} style={{ fontFamily: MONO }}>
                {n}
              </text>
              <text x="786" y={cy - 12} fontSize="14" fontWeight="600" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
                {title}
              </text>
              <text x="786" y={cy + 10} fontSize="11" letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
                {sub}
              </text>
              <path d={`M 776 ${cy - 16} L 721 ${cy - 16}`} fill="none" stroke={INK} strokeWidth="1.25" />
              <path d={`M 712 ${cy - 16} L 721 ${cy - 19} L 721 ${cy - 13} Z`} fill={INK} />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
