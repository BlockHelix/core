'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/swr-fetcher';

interface Desk {
  asOf: string;
  live: { at: string; block: string | null; rows: { symbol: string; perp: string; poolPrice: number | null; perpMid: number | null; gapBps: number | null }[] };
  recorder: { at: number; file: string | null; last: Record<string, { t: number; b: string; a: string }>; counts: Record<string, number> } | null;
  findings: {
    measuredAt: string; window: string; method: string; botProfitPerDayUsd: number; botProfitTotalUsd: number;
    pools: { symbol: string; volumeUsd: number; botProfitUsd: number; topShare: string }[];
    bots: { address: string; profitUsd: number; share: number; edgeBps: number; pools: number }[];
    scaling: { capitalUsd: number; perDayLowUsd: number; perDayHighUsd: number }[];
    caveats: string[];
  };
}

/** Pool fee 5bps + an assumed 9bps Hyperliquid taker: a gap under this cannot be traded at a profit. */
const COST_BPS = 14;
const GREEN = '#10c689';
const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const ago = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      {note ? <p className="mt-1 text-xs text-zinc-500">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ArbDesk() {
  const { data, error } = useSWR<Desk>('/api/admin/arb-desk', fetcher, { refreshInterval: 15_000 });
  if (error) return <p className="text-sm text-zinc-400">The arb desk could not be read. That is not the same as nothing to show.</p>;
  if (!data) return <p className="text-sm text-zinc-400">Loading…</p>;
  const { findings: f, live, recorder } = data;
  const now = Date.parse(data.asOf);
  const recAge = recorder ? now - recorder.at : null;
  const recording = recAge !== null && recAge < 60_000;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Bots make</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{usd(f.botProfitPerDayUsd)}/day</p>
          <p className="text-[11px] text-zinc-500">{f.window}, before hedging</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Top two bots</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{Math.round((f.bots[0].share + f.bots[1].share) * 100)}%</p>
          <p className="text-[11px] text-zinc-500">of that profit</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Recorder</p>
          <p className="mt-1 text-xl font-semibold" style={{ color: recording ? GREEN : '#b82214' }}>{recording ? 'recording' : recorder ? 'stalled' : 'no heartbeat'}</p>
          <p className="text-[11px] text-zinc-500">{recAge !== null ? `heartbeat ${ago(recAge)}` : 'never seen'}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Tick backtest</p>
          <p className="mt-1 text-xl font-semibold">Wed 7 Oct</p>
          <p className="text-[11px] text-zinc-500">needs the Mon and Tue Nasdaq opens</p>
        </div>
      </div>

      <Section title="Live gap: Base pool vs Hyperliquid" note={`Refreshes every 15s. A gap past ${COST_BPS}bps (pool fee plus assumed hedge fee) is tradeable. Base block ${live.block ?? 'unknown'}, ${ago(now - Date.parse(live.at))}.`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="pb-2 font-normal">Pool</th><th className="pb-2 font-normal text-right">Base pool</th><th className="pb-2 font-normal text-right">Hyperliquid</th><th className="pb-2 font-normal text-right">Gap</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {live.rows.map((r) => {
              const hot = r.gapBps !== null && Math.abs(r.gapBps) >= COST_BPS;
              return (
                <tr key={r.symbol} className="border-t border-zinc-100">
                  <td className="py-2 text-zinc-900">{r.symbol}</td>
                  <td className="py-2 text-right">{r.poolPrice === null ? 'not read' : r.poolPrice.toFixed(2)}</td>
                  <td className="py-2 text-right">{r.perpMid === null ? 'not read' : r.perpMid.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono" style={{ color: hot ? GREEN : undefined }}>{r.gapBps === null ? 'not measured' : `${r.gapBps >= 0 ? '+' : ''}${r.gapBps.toFixed(1)}bps`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Where the money is" note={`Bot profit per pool. Measured ${f.measuredAt}. ${f.method}`}>
          <table className="w-full text-sm">
            <tbody className="tabular-nums">
              {f.pools.map((p) => (
                <tr key={p.symbol} className="border-t border-zinc-100 first:border-t-0">
                  <td className="py-1.5 text-zinc-900">{p.symbol}</td>
                  <td className="py-1.5 text-right">{usd(p.botProfitUsd)}</td>
                  <td className="py-1.5 pl-3 text-right text-[11px] text-zinc-500">{p.topShare}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Who takes it" note="Profit across all ten pools, and edge per dollar traded.">
          <table className="w-full text-sm">
            <tbody className="tabular-nums">
              {f.bots.map((b) => (
                <tr key={b.address} className="border-t border-zinc-100 first:border-t-0">
                  <td className="py-1.5"><a className="font-mono text-[11px] text-[#10c689] hover:underline" href={`https://basescan.org/address/${b.address}`} target="_blank" rel="noopener noreferrer">{b.address.slice(0, 6)}…{b.address.slice(-4)}</a></td>
                  <td className="py-1.5 text-right">{usd(b.profitUsd)}</td>
                  <td className="py-1.5 text-right text-zinc-500">{Math.round(b.share * 100)}%</td>
                  <td className="py-1.5 text-right text-zinc-500">{b.edgeBps}bps</td>
                  <td className="py-1.5 text-right text-[11px] text-zinc-400">{b.pools} pools</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <Section title="What it could make us" note="If we win 25% of lasting gaps. Low and high are a 9bps and a 4.5bps hedge fee.">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500"><th className="pb-2 font-normal">Capital</th><th className="pb-2 font-normal text-right">Per day</th><th className="pb-2 font-normal text-right">Per day as % of capital</th></tr></thead>
          <tbody className="tabular-nums">
            {f.scaling.map((s) => (
              <tr key={s.capitalUsd} className="border-t border-zinc-100">
                <td className="py-1.5">{usd(s.capitalUsd)}</td>
                <td className="py-1.5 text-right">{usd(s.perDayLowUsd)} to {usd(s.perDayHighUsd)}</td>
                <td className="py-1.5 text-right text-zinc-500">{((s.perDayLowUsd / s.capitalUsd) * 100).toFixed(2)}% to {((s.perDayHighUsd / s.capitalUsd) * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-4 space-y-1 text-xs text-zinc-500">{f.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
      </Section>

      {recorder ? (
        <Section title="Recorder" note={`Hyperliquid best bid and ask for the ten perps, hourly files on the box. Current file ${recorder.file ?? 'none'}.`}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs tabular-nums sm:grid-cols-5">
            {Object.entries(recorder.last).sort().map(([coin, l]) => (
              <div key={coin} className="flex justify-between gap-2">
                <span className="text-zinc-700">{coin.replace('xyz:', '')}</span>
                <span className="text-zinc-400">{(recorder.counts[coin] ?? 0).toLocaleString()} · {ago(now - l.t)}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
