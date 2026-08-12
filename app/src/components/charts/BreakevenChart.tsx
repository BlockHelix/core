'use client';

import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { driverUsd, type PnlSeriesPoint } from '@/lib/vault-types';

const GRID = '#f0f1f3';
const ZERO = '#cbd5e1';
const MUT = '#94a3b8';
const INK = '#3f3f46';
const GREEN = '#10c689';
const RED = '#b82214';
// Yield/interest hues taken from the AttributionStack palette; the pair with the
// best mutual CVD separation (validated: worst adjacent dE 24.2 tritan).
const YIELD = '#8b5cf6';
const INTEREST = '#f59e0b';
const ENTRY = '#9ca3af';
const MONO = 'var(--font-geist-mono), ui-monospace, monospace';

const W = 820;
const H = 228;
const T = 14;
const B = 192;
const L = 48;
const R = 704;

function toMs(t: number | string): number {
  const n = typeof t === 'number' ? t : Number(t);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  return Date.parse(String(t));
}

const usd = (v: number) =>
  (v < 0 ? '−$' : '$') +
  Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const tickUsd = (v: number) => {
  const a = Math.abs(v);
  const s =
    a >= 1000
      ? (a / 1000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'k'
      : a >= 10
        ? String(Math.round(a))
        : String(Number(a.toFixed(2)));
  return (v < 0 ? '−$' : '$') + s;
};

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

type Pt = { i: number; v: number };

// Cumulative economics of one book: lending yield earned vs debt interest paid,
// against the fixed cost of entering the position. One point per attribution engine run.
export default function BreakevenChart({ points }: { points: PnlSeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const rows = points
    .map((r) => ({ t: toMs(r.computed_at), r }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  const n = rows.length;
  if (n === 0) return null;

  const yieldPts: Pt[] = [];
  const interestPts: Pt[] = [];
  rows.forEach(({ r }, i) => {
    const c = driverUsd(r.drivers['carry']);
    if (c != null) yieldPts.push({ i, v: c });
    const b = driverUsd(r.drivers['borrow_interest']);
    if (b != null) interestPts.push({ i, v: Math.abs(b) });
  });

  const lastDrivers = rows[n - 1].r.drivers;
  const exec = driverUsd(lastDrivers['execution']);
  const fees = driverUsd(lastDrivers['fees']);
  const entry = exec == null && fees == null ? null : Math.abs(exec ?? 0) + Math.abs(fees ?? 0);

  if (yieldPts.length === 0 && interestPts.length === 0 && entry == null) return null;

  const vals = [
    ...yieldPts.map((p) => p.v),
    ...interestPts.map((p) => p.v),
    ...(entry != null ? [entry] : []),
  ];
  const rawLo = Math.min(0, ...vals);
  const rawHi = Math.max(0, ...vals);
  const pad = (rawHi - rawLo) * 0.12 || 1;
  const lo = rawLo < 0 ? rawLo - pad : rawLo;
  const hi = rawHi + pad;

  const y = scaleLinear().domain([lo, hi]).range([B, T]);
  const xScale = scaleLinear().domain([rows[0].t, rows[n - 1].t]).range([L, R]);
  const xAt = (i: number) => (n === 1 ? (L + R) / 2 : xScale(rows[i].t));

  const ticks = niceTicks(lo, hi);

  let dayIdx: number[] = [];
  if (n === 1) {
    dayIdx = [0];
  } else {
    let prevDay = '';
    rows.forEach((x, i) => {
      const d = new Date(x.t).toDateString();
      if (d !== prevDay) {
        if (prevDay !== '') dayIdx.push(i);
        prevDay = d;
      }
    });
    if (dayIdx.length === 0) dayIdx = [0];
    if (dayIdx.length > 6) {
      const step = Math.ceil(dayIdx.length / 6);
      dayIdx = dayIdx.filter((_, k) => k % step === 0);
    }
  }
  const dayLabel = (i: number) =>
    new Date(rows[i].t)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase();

  const pathFor = (pts: Pt[]) =>
    pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${xAt(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  const yMap = new Map(yieldPts.map((p) => [p.i, p.v]));
  const iMap = new Map(interestPts.map((p) => [p.i, p.v]));

  // Direct labels at the right end, nudged apart on collision.
  const labels: { text: string; ly: number }[] = [];
  if (yieldPts.length > 0) labels.push({ text: 'Lending yield', ly: y(yieldPts[yieldPts.length - 1].v) });
  if (interestPts.length > 0)
    labels.push({ text: 'Debt interest', ly: y(interestPts[interestPts.length - 1].v) });
  if (entry != null) labels.push({ text: 'Entry cost', ly: y(entry) });
  labels.sort((a, b) => a.ly - b.ly);
  for (let k = 0; k < labels.length; k++) {
    labels[k].ly = Math.max(T + 8, Math.min(B - 2, labels[k].ly));
    if (k > 0 && labels[k].ly - labels[k - 1].ly < 11) labels[k].ly = labels[k - 1].ly + 11;
  }

  const bounds: number[] = [L];
  for (let i = 1; i < n; i++) bounds.push((xAt(i - 1) + xAt(i)) / 2);
  bounds.push(R);

  const hv = hover != null && hover < n ? hover : null;
  const hvYield = hv != null ? (yMap.get(hv) ?? null) : null;
  const hvInterest = hv != null ? (iMap.get(hv) ?? null) : null;
  const hvNet =
    hvYield != null && hvInterest != null && entry != null ? hvYield - hvInterest - entry : null;
  const tipLeft = hv != null ? (xAt(hv) / W) * 100 : 0;
  const tipFlip = hv != null && xAt(hv) > W * 0.62;

  const legend = [
    { text: 'Lending yield', color: YIELD, dashed: false, show: yieldPts.length > 0 },
    { text: 'Debt interest', color: INTEREST, dashed: false, show: interestPts.length > 0 },
    { text: 'Entry cost', color: ENTRY, dashed: true, show: entry != null },
  ].filter((l) => l.show);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {legend.map((l) => (
          <span key={l.text} className="flex items-center gap-1.5">
            <span
              className="w-3"
              style={
                l.dashed
                  ? { borderTop: `2px dashed ${l.color}` }
                  : { height: 2, backgroundColor: l.color }
              }
            />
            <span className="text-[10px] text-zinc-500">{l.text}</span>
          </span>
        ))}
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          aria-label="Cumulative lending yield and debt interest in USD against the fixed entry cost."
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={R} y1={y(t)} y2={y(t)} stroke={t === 0 ? ZERO : GRID} strokeWidth={1} />
              <text x={L - 8} y={y(t) + 3} textAnchor="end" fontSize={9} fill={MUT} fontFamily={MONO}>
                {tickUsd(t)}
              </text>
            </g>
          ))}

          {hv != null && (
            <line x1={xAt(hv)} x2={xAt(hv)} y1={T} y2={B} stroke={ZERO} strokeWidth={1} />
          )}

          {entry != null && (
            <line
              x1={L}
              x2={R}
              y1={y(entry)}
              y2={y(entry)}
              stroke={ENTRY}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}

          {yieldPts.length >= 2 && (
            <path d={pathFor(yieldPts)} fill="none" stroke={YIELD} strokeWidth={2} strokeLinejoin="round" />
          )}
          {interestPts.length >= 2 && (
            <path d={pathFor(interestPts)} fill="none" stroke={INTEREST} strokeWidth={2} strokeLinejoin="round" />
          )}
          {yieldPts.length === 1 && (
            <circle cx={xAt(yieldPts[0].i)} cy={y(yieldPts[0].v)} r={4} fill={YIELD} stroke="#ffffff" strokeWidth={2} />
          )}
          {interestPts.length === 1 && (
            <circle cx={xAt(interestPts[0].i)} cy={y(interestPts[0].v)} r={4} fill={INTEREST} stroke="#ffffff" strokeWidth={2} />
          )}

          {hv != null && hvYield != null && (
            <circle cx={xAt(hv)} cy={y(hvYield)} r={3.5} fill={YIELD} stroke="#ffffff" strokeWidth={2} />
          )}
          {hv != null && hvInterest != null && (
            <circle cx={xAt(hv)} cy={y(hvInterest)} r={3.5} fill={INTEREST} stroke="#ffffff" strokeWidth={2} />
          )}

          {labels.map((l) => (
            <text key={l.text} x={R + 10} y={l.ly + 3} fontSize={10} fill={INK} fontFamily={MONO}>
              {l.text}
            </text>
          ))}

          {dayIdx.map((i) => (
            <text
              key={`x${i}`}
              x={Math.max(L + 14, Math.min(R - 14, xAt(i)))}
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

          {rows.map((x, i) => (
            <rect
              key={`h${i}`}
              x={bounds[i]}
              y={T}
              width={Math.max(0, bounds[i + 1] - bounds[i])}
              height={B - T}
              fill="transparent"
              tabIndex={0}
              aria-label={`${new Date(x.t).toLocaleString()}: yield ${
                yMap.get(i) != null ? usd(yMap.get(i)!) : 'not modelled'
              }, interest ${iMap.get(i) != null ? usd(iMap.get(i)!) : 'not modelled'}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>

        {hv != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[12rem] rounded-md border border-black/[0.08] bg-white p-2.5 shadow-soft"
            style={{
              left: `${tipLeft}%`,
              transform: tipFlip ? 'translateX(-100%)' : 'translateX(8px)',
            }}
          >
            <p className="font-data text-[10px] text-zinc-400">{new Date(rows[hv].t).toLocaleString()}</p>
            <div className="mt-1.5 space-y-0.5">
              {[
                { text: 'Lending yield', color: YIELD, v: hvYield },
                { text: 'Debt interest', color: INTEREST, v: hvInterest },
                { text: 'Entry cost', color: ENTRY, v: entry },
              ].map((r) => (
                <p key={r.text} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-[3px] w-2" style={{ backgroundColor: r.color }} />
                  <span className="text-zinc-500">{r.text}</span>
                  <span className="ml-auto font-data tabular-nums text-zinc-800">
                    {r.v != null ? usd(r.v) : 'not modelled'}
                  </span>
                </p>
              ))}
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 border-t border-black/[0.06] pt-1.5 text-[11px]">
              <span className="text-zinc-500">net</span>
              <span
                className="ml-auto font-data font-medium tabular-nums"
                style={{ color: hvNet == null ? '#a1a1aa' : hvNet > 0 ? GREEN : hvNet < 0 ? RED : '#71717a' }}
              >
                {hvNet != null ? usd(hvNet) : 'not modelled'}
              </span>
            </p>
            <p className="mt-0.5 font-mono text-[9px] text-zinc-400">net = yield − interest − entry cost</p>
          </div>
        )}
      </div>

      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
        when the lending yield line rises above debt interest plus the fixed line, the position has
        paid for itself.
      </p>
    </div>
  );
}
