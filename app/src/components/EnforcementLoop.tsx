const INK = '#047857';
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
          {Y.map((cy) => (
            <g key={cy}>
              {/* left + right side faces, then top face */}
              <path d={`M 250 ${cy} L 500 ${cy + HH} L 500 ${cy + HH + T} L 250 ${cy + T} Z`} fill={INK} fillOpacity="0.08" stroke={INK} strokeOpacity="0.45" />
              <path d={`M 500 ${cy + HH} L 750 ${cy} L 750 ${cy + T} L 500 ${cy + HH + T} Z`} fill={INK} fillOpacity="0.15" stroke={INK} strokeOpacity="0.45" />
              <path
                d={`M 500 ${cy - HH} L 750 ${cy} L 500 ${cy + HH} L 250 ${cy} Z`}
                fill={cy === Y[1] ? INK : '#FCFBF8'}
                fillOpacity={cy === Y[1] ? 0.05 : 1}
                stroke={INK}
                strokeWidth="1.5"
              />
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

          {/* Glyph: Simulation — Monte Carlo path fan, iso-projected */}
          <g transform={`translate(500 ${Y[2]}) scale(1 0.38) rotate(45)`}>
            <g fill="none" stroke={INK} strokeWidth="3">
              <path d="M-95 85 Q 20 30, 110 -100" />
              <path d="M-95 85 Q 25 40, 115 -60" />
              <path d="M-95 85 Q 30 50, 118 -20" />
              <path d="M-95 85 Q 25 60, 115 20" />
              <path d="M-95 85 Q 20 70, 110 60" />
            </g>
            <circle cx="-95" cy="85" r="7" fill={INK} />
            {[[110, -100], [115, -60], [118, -20], [115, 20], [110, 60]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill={INK} />
            ))}
          </g>

          {/* Glyph: AI — neural mesh / attention pattern, iso-projected */}
          <g transform={`translate(500 ${Y[3]}) scale(1 0.38) rotate(45)`}>
            <g fill="none" stroke={INK} strokeWidth="2.5" strokeOpacity="0.6">
              <path d="M-85 -75 L85 -75 M-85 -75 L85 0 M-85 -75 L85 75" />
              <path d="M-85 0 L85 -75 M-85 0 L85 0 M-85 0 L85 75" />
              <path d="M-85 75 L85 -75 M-85 75 L85 0 M-85 75 L85 75" />
            </g>
            {[[-85, -75], [-85, 0], [-85, 75], [85, -75], [85, 0], [85, 75]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="#FAF9F6" stroke={INK} strokeWidth="4" />
            ))}
          </g>

          {/* Backprop: AI loops back around the left margin into Invariants */}
          <path
            d={`M 318 ${Y[3] + 26} L 100 ${Y[3] + 26} L 100 ${Y[1] + 30} L 329 ${Y[1] + 30}`}
            fill="none"
            stroke="#0891B2"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          >
            <animate attributeName="stroke-dashoffset" values="11;0" dur="0.9s" repeatCount="indefinite" />
          </path>
          <path d={`M 321 ${Y[1] + 26} L 329 ${Y[1] + 30} L 321 ${Y[1] + 34}`} fill="none" stroke="#0891B2" strokeWidth="1.5" />
          <text
            transform={`rotate(-90 82 ${(Y[1] + Y[3]) / 2})`}
            x="82"
            y={(Y[1] + Y[3]) / 2}
            textAnchor="middle"
            fontSize="11"
            letterSpacing="0.25em"
            fill="#0891B2"
            style={{ fontFamily: MONO }}
          >
            BACKPROP · POLICY UPDATES
          </text>

          {/* Labels — left side: Blockchain, Simulation */}
          {[
            { cy: Y[0], title: 'BLOCKCHAIN', sub: 'BASE · ERC-4626' },
            { cy: Y[2], title: 'SIMULATION', sub: 'MONTE CARLO PATHS' },
          ].map(({ cy, title, sub }) => (
            <g key={title}>
              <text x="140" y={cy - 12} fontSize="14" fontWeight="600" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
                {title}
              </text>
              <text x="140" y={cy + 10} fontSize="11" letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
                {sub}
              </text>
              <path d={`M 360 ${cy - 16} L 296 ${cy - 16} M 304 ${cy - 21} L 296 ${cy - 16} L 304 ${cy - 11}`} fill="none" stroke={INK} strokeWidth="1.5" />
            </g>
          ))}

          {/* Labels — right side: Invariants, AI */}
          {[
            { cy: Y[1], title: 'INVARIANTS', sub: 'BOUNDS ON EVERY TRADE' },
            { cy: Y[3], title: 'AI', sub: 'AGENT OPERATORS' },
          ].map(({ cy, title, sub }) => (
            <g key={title}>
              <text x="800" y={cy - 12} fontSize="14" fontWeight="600" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
                {title}
              </text>
              <text x="800" y={cy + 10} fontSize="11" letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
                {sub}
              </text>
              <path d={`M 790 ${cy - 16} L 724 ${cy - 16} M 732 ${cy - 21} L 724 ${cy - 16} L 732 ${cy - 11}`} fill="none" stroke={INK} strokeWidth="1.5" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
