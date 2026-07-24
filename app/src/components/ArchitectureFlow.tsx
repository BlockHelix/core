const INK = '#10c689';
const SUB = '#8A8577';
const GRAY_400 = '#9CA3AF';
const RED = '#DC2626';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

// Five slabs, top→bottom. Gap between slabs 2 and 3 holds the off/on-chain divider.
const STAGES = [
  { cy: 150, side: 'left', title: '1. TRADE INTENT', sub: 'Strategist · Agent · API · MCP' },
  { cy: 390, side: 'right', title: '2. POLICY ENGINE', sub: '5 checks · off-chain' },
  { cy: 670, side: 'left', title: '3. VAULT RE-VERIFY', sub: 'on-chain · same root' },
  { cy: 910, side: 'right', title: '4. EXECUTION', sub: 'bounded settlement' },
  { cy: 1150, side: 'left', title: '5. STATE / AUDIT', sub: 'NAV · exposure · audit' },
];

function Slab({ cx, cy, color, hw = 250, hh = 85, t = 22, core = false }: { cx: number; cy: number; color: string; hw?: number; hh?: number; t?: number; core?: boolean }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + hh + t + 16} rx={hw * 0.85} ry="10" fill="#0F172A" opacity="0.05" />
      <path d={`M ${cx - hw} ${cy} L ${cx} ${cy + hh} L ${cx} ${cy + hh + t} L ${cx - hw} ${cy + t} Z`} fill={color} fillOpacity="0.08" stroke={color} strokeOpacity="0.45" />
      <path d={`M ${cx} ${cy + hh} L ${cx + hw} ${cy} L ${cx + hw} ${cy + t} L ${cx} ${cy + hh + t} Z`} fill={color} fillOpacity="0.15" stroke={color} strokeOpacity="0.45" />
      <path
        d={`M ${cx} ${cy - hh} L ${cx + hw} ${cy} L ${cx} ${cy + hh} L ${cx - hw} ${cy} Z`}
        fill={core ? color : '#FCFBF8'}
        fillOpacity={core ? 0.05 : 1}
        stroke={color}
        strokeWidth="1.5"
      />
    </g>
  );
}

// Icons drawn in a square design space and iso-projected onto the slab face.
function Glyph({ cx, cy, s, color, sw = 9, children }: { cx: number; cy: number; s: number; color: string; sw?: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(1 ${s}) rotate(45)`}>
      <g fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </g>
  );
}

export default function ArchitectureFlow() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px] max-w-3xl mx-auto">
        <svg
          viewBox="-80 0 1080 1480"
          className="w-full h-auto"
          role="img"
          aria-label="Five stacked layers: trade intent, the off-chain policy engine, the on-chain vault re-verify, execution, and state and audit. An oracle feeds prices into policy, depositors fund the vault, reverts drop out of policy and vault, state feeds back into policy, and a read-only AI analyst advises from outside the enforcement path."
        >
          {/* The five slabs */}
          {STAGES.map((s) => (
            <Slab key={s.cy} cx={500} cy={s.cy} color={INK} core={s.cy === 390} />
          ))}

          {/* Off-chain / on-chain divider between slabs 2 and 3 */}
          <line x1="140" y1="542" x2="860" y2="542" stroke={SUB} strokeOpacity="0.5" strokeDasharray="3 5" />
          <text x="855" y="528" textAnchor="end" fontSize="11" letterSpacing="0.2em" fill={SUB} style={{ fontFamily: MONO }}>
            OFF-CHAIN
          </text>
          <text x="855" y="562" textAnchor="end" fontSize="11" letterSpacing="0.2em" fill={INK} style={{ fontFamily: MONO }}>
            ON-CHAIN
          </text>

          {/* Glyphs */}
          <Glyph cx={500} cy={150} s={0.34} color={INK}>
            <circle r="80" />
            <path d="M0 -130 V-82 M0 82 V130 M-130 0 H-82 M82 0 H130" />
          </Glyph>
          <Glyph cx={500} cy={390} s={0.34} color={INK}>
            <path d="M0 -110 L84 -70 V14 C84 70 40 100 0 120 C-40 100 -84 70 -84 14 V-70 Z" />
            <path d="M-40 6 L-10 40 L52 -32" />
          </Glyph>
          <Glyph cx={500} cy={670} s={0.34} color={INK}>
            <rect x="-70" y="-14" width="140" height="104" rx="12" />
            <path d="M-38 -14 V-50 a38 38 0 0 1 76 0 V-14" />
          </Glyph>
          <Glyph cx={500} cy={910} s={0.34} color={INK}>
            <path d="M26 -110 L-58 18 H-6 L-26 110 L62 -24 H6 Z" />
          </Glyph>
          <Glyph cx={500} cy={1150} s={0.34} color={INK}>
            <ellipse cx="0" cy="-60" rx="78" ry="30" />
            <path d="M-78 -60 V56 C-78 78 78 78 78 56 V-60" />
            <path d="M-78 -2 C-78 20 78 20 78 -2" />
          </Glyph>

          {/* Stage labels — alternating sides */}
          {STAGES.map((s) =>
            s.side === 'left' ? (
              <g key={s.title}>
                <text x="210" y={s.cy - 12} textAnchor="end" fontSize="14" fontWeight="600" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
                  {s.title}
                </text>
                <text x="210" y={s.cy + 10} textAnchor="end" fontSize="11" letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
                  {s.sub}
                </text>
                <path d={`M 218 ${s.cy - 16} L 276 ${s.cy - 16} M 268 ${s.cy - 21} L 276 ${s.cy - 16} L 268 ${s.cy - 11}`} fill="none" stroke={INK} strokeWidth="1.5" />
              </g>
            ) : (
              <g key={s.title}>
                <text x="790" y={s.cy - 12} fontSize="14" fontWeight="600" letterSpacing="0.25em" fill={INK} style={{ fontFamily: MONO }}>
                  {s.title}
                </text>
                <text x="790" y={s.cy + 10} fontSize="11" letterSpacing="0.15em" fill={SUB} style={{ fontFamily: MONO }}>
                  {s.sub}
                </text>
                <path d={`M 782 ${s.cy - 16} L 724 ${s.cy - 16} M 732 ${s.cy - 21} L 724 ${s.cy - 16} L 732 ${s.cy - 11}`} fill="none" stroke={INK} strokeWidth="1.5" />
              </g>
            )
          )}

          {/* Independent Oracle — feeds the policy slab */}
          <Slab cx={760} cy={90} color={INK} hw={64} hh={32} t={10} />
          <Glyph cx={760} cy={90} s={0.5} color={INK} sw={4}>
            <path d="M-26 18 L-8 -2 L4 8 L26 -16" />
            <path d="M-30 26 H30" />
          </Glyph>
          <text x="836" y="82" fontSize="11" fontWeight="600" letterSpacing="0.12em" fill={INK} style={{ fontFamily: MONO }}>
            INDEPENDENT ORACLE
          </text>
          <text x="836" y="98" fontSize="9.5" letterSpacing="0.08em" fill={SUB} style={{ fontFamily: MONO }}>
            price · liquidity
          </text>
          <path d="M 760 138 Q 745 250 631 336" fill="none" stroke={INK} strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 640 335 L 631 336 L 635 328" fill="none" stroke={INK} strokeWidth="1.5" />

          {/* Depositors — feed the state slab */}
          <Slab cx={840} cy={1010} color={INK} hw={64} hh={32} t={10} />
          <Glyph cx={840} cy={1010} s={0.5} color={INK} sw={4}>
            <circle cx="-10" cy="-8" r="8" />
            <circle cx="12" cy="-4" r="9" />
            <path d="M-24 18 C-24 6 4 6 4 18 M8 20 C8 8 30 10 30 20" />
          </Glyph>
          <text x="840" y="1090" textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="0.12em" fill={INK} style={{ fontFamily: MONO }}>
            DEPOSITORS
          </text>
          <text x="840" y="1106" textAnchor="middle" fontSize="9.5" letterSpacing="0.08em" fill={SUB} style={{ fontFamily: MONO }}>
            deposit · redeem
          </text>
          <path d="M 776 1014 Q 690 1060 631 1106" fill="none" stroke={INK} strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 640 1105 L 631 1106 L 634 1098" fill="none" stroke={INK} strokeWidth="1.5" />

          {/* Revert callouts */}
          <path d="M 290 405 L 152 501" fill="none" stroke={RED} strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 161 500 L 152 501 L 156 493" fill="none" stroke={RED} strokeWidth="1.5" />
          <rect x="70" y="505" width="140" height="30" rx="6" fill="#FCFBF8" stroke={RED} />
          <text x="140" y="524" textAnchor="middle" fontSize="9.5" letterSpacing="0.08em" fill={RED} style={{ fontFamily: MONO }}>
            NO PASS, NO TRADE
          </text>
          <path d="M 710 687 L 736 734" fill="none" stroke={RED} strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 736 725 L 736 734 L 728 729" fill="none" stroke={RED} strokeWidth="1.5" />
          <rect x="688" y="738" width="232" height="30" rx="6" fill="#FCFBF8" stroke={RED} />
          <text x="804" y="757" textAnchor="middle" fontSize="9.5" letterSpacing="0.08em" fill={RED} style={{ fontFamily: MONO }}>
            ON-CHAIN REVERT · NO SETTLEMENT
          </text>

          {/* State feedback: recurrent loop up the right margin into policy */}
          <path d="M 756 1156 L 968 1156 L 968 410 L 700 410" fill="none" stroke="#0891B2" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 708 405 L 700 410 L 708 414" fill="none" stroke="#0891B2" strokeWidth="1.5" />
          <text
            transform="rotate(-90 984 776)"
            x="984"
            y="776"
            textAnchor="middle"
            fontSize="11"
            letterSpacing="0.25em"
            fill="#0891B2"
            style={{ fontFamily: MONO }}
          >
            CURRENT NAV · DRAWDOWN · EXPOSURE
          </text>

          {/* Analyst — read-only, outside the enforcement path */}
          <Slab cx={500} cy={1340} color={GRAY_400} hw={64} hh={32} t={10} />
          <Glyph cx={500} cy={1340} s={0.5} color={GRAY_400} sw={4}>
            <path d="M0 -26 L6 -6 L26 0 L6 6 L0 26 L-6 6 L-26 0 L-6 -6 Z" />
            <path d="M18 -30 L20 -22 L28 -20 L20 -18 L18 -10 L16 -18 L8 -20 L16 -22 Z" />
          </Glyph>
          <text x="500" y="1426" textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="0.12em" fill={SUB} style={{ fontFamily: MONO }}>
            ANALYST
          </text>
          <text x="500" y="1446" textAnchor="middle" fontSize="9" letterSpacing="0.1em" fill={GRAY_400} style={{ fontFamily: MONO }}>
            LLM + TOOLS · READ-ONLY · OUTSIDE THE ENFORCEMENT PATH
          </text>
          <path d="M 436 1336 L -20 1336 L -20 400 L 246 394" fill="none" stroke={GRAY_400} strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 238 390 L 246 394 L 238 399" fill="none" stroke={GRAY_400} strokeWidth="1.5" />
          <text
            transform="rotate(-90 -52 868)"
            x="-52"
            y="868"
            textAnchor="middle"
            fontSize="11"
            letterSpacing="0.25em"
            fill={GRAY_400}
            style={{ fontFamily: MONO }}
          >
            READ-ONLY · ADVISORY
          </text>
          <path d="M 500 1304 L 500 1261" fill="none" stroke={GRAY_400} strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 494 1269 L 500 1261 L 506 1269" fill="none" stroke={GRAY_400} strokeWidth="1.5" />
          <text x="516" y="1284" fontSize="9" letterSpacing="0.1em" fill={GRAY_400} style={{ fontFamily: MONO }}>
            READ-ONLY
          </text>
        </svg>
      </div>
    </div>
  );
}
