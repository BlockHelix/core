'use client';

import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { clsx } from 'clsx';
import type { RateAttributionInterval } from '@/lib/vault-types';

const SURFACE = '#ffffff';
const GRID = '#f0f1f3';
const ZERO = '#cbd5e1';
const MUT = '#94a3b8';
const GREEN = '#10c689';
const RED = '#b82214';
const CLAMP = '#b45309';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

// Fixed series order and colors. Validated palette, never reassigned.
const SERIES = [
  { label: 'apxUSD', color: '#0891b2' },
  { label: 'PT-apyUSD', color: '#f59e0b' },
  { label: 'USDtb', color: '#8b5cf6' },
  { label: 'sUSDe', color: '#35c4e2' },
  { label: 'Other', color: '#be185d' },
  { label: 'Residual', color: '#9ca3af' },
] as const;

const W = 820;
const H = 214;
const L = 16;
const R = 756;
const T = 18;
const B = 186;
const GAP = 2;

function aggregate(iv: RateAttributionInterval): number[] {
  const v = [0, 0, 0, 0, 0, 0];
  for (const e of iv.effects) {
    const c = e.priceBps + e.quantityBps;
    if (e.symbol === 'apxUSD') v[0] += c;
    else if (e.symbol.startsWith('PT-')) v[1] += c;
    else if (e.symbol === 'USDtb') v[2] += c;
    else if (e.symbol === 'sUSDe') v[3] += c;
    else v[4] += c;
  }
  v[4] += iv.sharesBps;
  v[5] = iv.residualBps;
  return v;
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const a = Math.abs(v);
  if (Math.round(a * 10) === 0) return '0';
  const s = a >= 10 ? String(Math.round(a)) : a.toFixed(1).replace(/\.0$/, '');
  return (v > 0 ? '+' : '-') + s;
}

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo || 1;
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step / 1e6; t += step) {
    out.push(Math.abs(t) < step / 1e6 ? 0 : Number(t.toFixed(6)));
  }
  return out;
}

function topRounded(x: number, y: number, w: number, h: number): string {
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M ${x},${y + r} Q ${x},${y} ${x + r},${y} H ${x + w - r} Q ${x + w},${y} ${x + w},${y + r} V ${y + h} H ${x} Z`;
}

function botRounded(x: number, y: number, w: number, h: number): string {
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M ${x},${y} H ${x + w} V ${y + h - r} Q ${x + w},${y + h} ${x + w - r},${y + h} H ${x + r} Q ${x},${y + h} ${x},${y + h - r} Z`;
}

type Seg = { si: number; d?: string; rect?: { x: number; y: number; w: number; h: number } };

// One SVG stacked bar per rate push. Positive drivers stack up from zero, negative
// down. The diamond is the net on-chain move; the stack is what produced it.
export default function AttributionStack({ intervals }: { intervals: RateAttributionInterval[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = intervals.length;
  if (n === 0) return null;

  const cols = intervals.map((iv) => {
    const vals = aggregate(iv);
    const net = iv.actualBps ?? iv.trueBps;
    const posSum = vals.reduce((s, v) => s + Math.max(v, 0), 0);
    const negSum = vals.reduce((s, v) => s + Math.min(v, 0), 0);
    return { iv, vals, net, posSum, negSum, clamped: Math.abs(iv.capClampBps) > 1 };
  });

  let lo = Math.min(0, ...cols.map((c) => Math.min(c.negSum, c.net)));
  let hi = Math.max(0, ...cols.map((c) => Math.max(c.posSum, c.net)));
  const pad = (hi - lo) * 0.14 || 1;
  lo -= pad;
  hi += pad;

  const y = scaleLinear().domain([lo, hi]).range([B, T]);
  const slotW = (R - L) / n;
  const barW = Math.min(24, Math.max(3, slotW - GAP));
  const xAt = (i: number) => L + i * slotW + (slotW - barW) / 2;
  const cxAt = (i: number) => L + i * slotW + slotW / 2;

  const ticks = niceTicks(lo, hi);

  let dayIdx: number[] = [];
  let prevDay = '';
  cols.forEach((c, i) => {
    const d = new Date(c.iv.toCreatedAt).toDateString();
    if (d !== prevDay) {
      if (prevDay !== '') dayIdx.push(i);
      prevDay = d;
    }
  });
  if (dayIdx.length > 6) {
    const step = Math.ceil(dayIdx.length / 6);
    dayIdx = dayIdx.filter((_, k) => k % step === 0);
  }
  const dayLabel = (i: number) =>
    new Date(cols[i].iv.toCreatedAt)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase();

  const segsFor = (ci: number): Seg[] => {
    const c = cols[ci];
    const x = xAt(ci);
    const out: Seg[] = [];
    for (const sign of [1, -1] as const) {
      const parts = c.vals
        .map((v, si) => ({ si, v }))
        .filter((p) => (sign > 0 ? p.v > 0 : p.v < 0));
      let cum = 0;
      parts.forEach((p, k) => {
        const y0 = y(cum);
        const y1 = y(cum + p.v);
        cum += p.v;
        let top = Math.min(y0, y1);
        let bot = Math.max(y0, y1);
        const outer = k === parts.length - 1;
        // 2px surface gap at internal boundaries, square at zero, rounded outer end
        if (sign > 0) {
          if (k > 0) bot -= 1;
          if (!outer) top += 1;
        } else {
          if (k > 0) top += 1;
          if (!outer) bot -= 1;
        }
        const h = bot - top;
        if (h < 0.5) return;
        if (outer) {
          out.push({
            si: p.si,
            d: sign > 0 ? topRounded(x, top, barW, h) : botRounded(x, top, barW, h),
          });
        } else {
          out.push({ si: p.si, rect: { x, y: top, w: barW, h } });
        }
      });
    }
    return out;
  };

  const hovered = hover != null && hover < n ? cols[hover] : null;
  const tipLeft = hovered && hover != null ? (cxAt(hover) / W) * 100 : 0;
  const tipFlip = hovered && hover != null && cxAt(hover) > W * 0.62;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {SERIES.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-zinc-500">{s.label}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rotate-45" style={{ backgroundColor: GREEN }} />
          <span className="text-[10px] text-zinc-500">net move</span>
        </span>
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          aria-label="Share price attribution, one stacked column per rate push, in bps."
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t, k) => (
            <g key={t}>
              <line
                x1={L}
                x2={R}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? ZERO : GRID}
                strokeWidth={1}
              />
              <text x={R + 8} y={y(t) + 3} fontSize={9} fill={MUT} fontFamily={MONO}>
                {t > 0 ? `+${t}` : String(t)}
                {k === ticks.length - 1 ? ' bps' : ''}
              </text>
            </g>
          ))}

          {hover != null && (
            <rect
              x={L + hover * slotW}
              y={T}
              width={slotW}
              height={B - T}
              fill="#000000"
              opacity={0.035}
            />
          )}

          {cols.map((c, ci) =>
            segsFor(ci).map((s, k) =>
              s.d ? (
                <path key={`${ci}-${k}`} d={s.d} fill={SERIES[s.si].color} />
              ) : (
                <rect
                  key={`${ci}-${k}`}
                  x={s.rect!.x}
                  y={s.rect!.y}
                  width={s.rect!.w}
                  height={s.rect!.h}
                  fill={SERIES[s.si].color}
                />
              ),
            ),
          )}

          {cols.map((c, ci) => {
            const cx = cxAt(ci);
            const cy = y(c.net);
            return (
              <path
                key={`d${ci}`}
                d={`M ${cx},${cy - 4.5} L ${cx + 4.5},${cy} L ${cx},${cy + 4.5} L ${cx - 4.5},${cy} Z`}
                fill={c.net >= 0 ? GREEN : RED}
                stroke={SURFACE}
                strokeWidth={4}
                paintOrder="stroke"
              />
            );
          })}

          {cols.map((c, ci) => {
            if (!c.clamped) return null;
            const cx = cxAt(ci);
            const top = Math.min(y(Math.max(c.posSum, c.net, 0)), y(0)) - 6;
            return (
              <path
                key={`w${ci}`}
                d={`M ${cx},${top - 6} L ${cx + 4},${top} L ${cx - 4},${top} Z`}
                fill={CLAMP}
              />
            );
          })}

          {dayIdx.map((i) => (
            <text
              key={`x${i}`}
              x={cxAt(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              letterSpacing="0.1em"
              fill={MUT}
              fontFamily={MONO}
            >
              {dayLabel(i)}
            </text>
          ))}

          {cols.map((c, ci) => (
            <rect
              key={`h${ci}`}
              x={L + ci * slotW}
              y={T}
              width={slotW}
              height={B - T}
              fill="transparent"
              tabIndex={0}
              aria-label={`${new Date(c.iv.toCreatedAt).toLocaleString()}: net ${fmt(c.net)} bps`}
              onMouseEnter={() => setHover(ci)}
              onFocus={() => setHover(ci)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>

        {hovered && hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[11rem] rounded-md border border-black/[0.08] bg-white p-2.5 shadow-soft"
            style={{
              left: `${tipLeft}%`,
              transform: tipFlip ? 'translateX(-100%)' : 'translateX(8px)',
            }}
          >
            <p className="font-data text-[10px] text-zinc-400">
              {new Date(hovered.iv.toCreatedAt).toLocaleString()}
            </p>
            <div className="mt-1.5 space-y-0.5">
              {SERIES.map((s, si) => (
                <p key={s.label} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-[3px] w-2" style={{ backgroundColor: s.color }} />
                  <span className="text-zinc-500">{s.label}</span>
                  <span className="ml-auto font-data tabular-nums text-zinc-800">
                    {fmt(hovered.vals[si])}
                  </span>
                </p>
              ))}
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 border-t border-black/[0.06] pt-1.5 text-[11px]">
              <span className="text-zinc-500">net</span>
              <span
                className={clsx(
                  'ml-auto font-data font-medium tabular-nums',
                  Math.round(hovered.net * 10) === 0
                    ? 'text-zinc-500'
                    : hovered.net > 0
                      ? 'text-[#10c689]'
                      : 'text-[#b82214]',
                )}
              >
                {fmt(hovered.net)} bps
              </span>
            </p>
            {hovered.clamped && (
              <p className="mt-1 text-[10px] leading-snug text-amber-800">
                The accountant band clamped this push by {fmt(hovered.iv.capClampBps)} bps. The
                remainder spills into later pushes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
