'use client';

import { useMemo, useState } from 'react';
import { scaleLinear, scaleTime } from 'd3-scale';
import { line } from 'd3-shape';

export interface ReturnSeries {
  symbol: string;
  color: string;
  /** Return since launch at each official push: share price / starting price - 1. */
  points: { t: number; r: number }[];
  /** The live share price, not yet pushed on-chain. Drawn dashed. */
  live: { t: number; r: number } | null;
}

const W = 820;
const H = 280;
const L = 8;
const R = 760;
const T = 16;
const B = 244;
const GRID = '#eef0f3';
const MUT = '#94a3b8';
const INK = '#111827';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

const pct = (r: number) => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%`;
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function ReturnChart({ series }: { series: ReturnSeries[] }) {
  const [hoverT, setHoverT] = useState<number | null>(null);

  const all = useMemo(() => series.flatMap((s) => [...s.points, ...(s.live ? [s.live] : [])]), [series]);
  const { x, y, ticks } = useMemo(() => {
    const ts = all.map((p) => p.t);
    const rs = all.map((p) => p.r).concat(0);
    const lo = Math.min(...rs);
    const hi = Math.max(...rs);
    const pad = (hi - lo) * 0.12 || 0.01;
    const x = scaleTime().domain([Math.min(...ts), Math.max(...ts)]).range([L, R]);
    const y = scaleLinear().domain([lo - pad, hi + pad]).range([B, T]).nice();
    return { x, y, ticks: y.ticks(5) };
  }, [all]);

  if (all.length < 2) return null;

  const path = line<{ t: number; r: number }>().x((p) => x(p.t)).y((p) => y(p.r));
  const xTicks = x.ticks(6);

  const at = (s: ReturnSeries, t: number) => {
    const pts = [...s.points, ...(s.live ? [s.live] : [])].filter((p) => p.t <= t);
    return pts.length ? pts[pts.length - 1] : null;
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    if (px < L || px > R) return setHoverT(null);
    setHoverT(x.invert(px).getTime());
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Return since launch: ${series.map((s) => `${s.symbol} ${pct((s.live ?? s.points[s.points.length - 1]).r)}`).join(', ')}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverT(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#cbd5e1' : GRID} strokeWidth={1} strokeDasharray={v === 0 ? undefined : '2 4'} />
            <text x={R + 8} y={y(v) + 3} fontSize={10} fill={MUT} fontFamily={MONO}>{pct(v)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={+t} x={x(t)} y={B + 22} fontSize={10} fill={MUT} fontFamily={MONO} textAnchor="middle">{day(+t)}</text>
        ))}

        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.symbol}>
              <path d={path(s.points) ?? ''} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {s.live && last ? (
                <path d={path([last, s.live]) ?? ''} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray="3 4" />
              ) : null}
              {(() => {
                const end = s.live ?? last;
                return end ? <circle cx={x(end.t)} cy={y(end.r)} r={3.5} fill={s.color} /> : null;
              })()}
            </g>
          );
        })}

        {hoverT !== null ? (
          <g>
            <line x1={x(hoverT)} x2={x(hoverT)} y1={T} y2={B} stroke="#cbd5e1" strokeWidth={1} />
            {series.map((s) => {
              const p = at(s, hoverT);
              return p ? <circle key={s.symbol} cx={x(p.t)} cy={y(p.r)} r={4} fill="white" stroke={s.color} strokeWidth={2} /> : null;
            })}
          </g>
        ) : null}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-gray-500">
        {hoverT !== null ? <span className="text-gray-400">{day(hoverT)}</span> : null}
        {series.map((s) => {
          const p = hoverT !== null ? at(s, hoverT) : (s.live ?? s.points[s.points.length - 1]);
          return (
            <span key={s.symbol} className="inline-flex items-center gap-2">
              <span className="inline-block h-[3px] w-4 rounded" style={{ background: s.color }} />
              <span style={{ color: INK }}>{s.symbol}</span>
              <span className="tabular-nums">{p ? pct(p.r) : 'not yet live'}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-2 text-gray-400">
          <svg width="16" height="4"><line x1="0" x2="16" y1="2" y2="2" stroke={MUT} strokeWidth="2" strokeDasharray="3 3" /></svg>
          live, not yet pushed on-chain
        </span>
      </div>
    </div>
  );
}
