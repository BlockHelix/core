import Reveal from '@/components/ui/Reveal';

const MONITOR: { t: string; k: string; v: string; s: 'ok' | 'warn' | 'breach' | 'act'; note?: string }[] = [
  { t: '12:04:02', k: 'exit liquidity', v: 'unwind 38 bps', s: 'ok' },
  { t: '12:04:14', k: 'oracle vs pool', v: 'USDe 0.9994', s: 'ok' },
  { t: '12:04:26', k: 'aave utilization', v: '88%', s: 'ok' },
  { t: '12:04:38', k: 'borrow rate', v: '5.6%', s: 'ok' },
  { t: '12:11:07', k: 'exit liquidity', v: 'unwind 74 bps', s: 'warn', note: 'widening' },
  { t: '12:11:19', k: 'aave utilization', v: '96%', s: 'warn', note: 'near 100%' },
  { t: '12:11:31', k: 'oracle vs pool', v: 'USDe 0.9871 · -129 bps', s: 'breach', note: 'peg' },
  { t: '12:11:31', k: 'action', v: 'unwind queued · exposure capped · depositors notified', s: 'act' },
];

export default function MonitoringSection() {
  return (
    <>
      {/* Continuous monitoring: watched every block */}
      <section className="py-20 lg:py-32 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-5">
              <Reveal>
                <p className="text-xs uppercase tracking-[0.15em] font-mono text-emerald-400/70 mb-8">{'// Between trades'}</p>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">
                  The engine watches liquidity, prices, and exposure every block.
                </h2>
                <p className="text-lg text-white/50 leading-relaxed">
                  Bounds are re-evaluated as state moves. A vault that crosses
                  them halts before the next trade is even submitted.
                </p>
              </Reveal>
            </div>
            <div className="lg:col-span-7">
              <Reveal delay={0.1}>
                <div className="border-y border-white/10">
                  <div className="flex items-center justify-between py-3 font-mono text-[11px]">
                    <span className="text-white/50">
                      <span className="text-emerald-400">MONITOR</span> vault 0x8f3a · every block
                    </span>
                  </div>
                  <div className="py-5 border-t border-white/10 font-mono text-[12.5px] leading-[2.1] overflow-x-auto">
                    <div className="min-w-[560px]">
                      {MONITOR.map((r, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-5${i === 4 ? ' mt-3 pt-3 border-t border-white/5' : ''}`}
                        >
                          <span className="text-white/25 w-[64px] shrink-0">{r.t}</span>
                          {r.s === 'act' ? (
                            <span className="text-emerald-300">▸ {r.v}</span>
                          ) : (
                            <>
                              <span className="text-sky-300 w-[136px] shrink-0">{r.k}</span>
                              <span className="text-gray-300 flex-1">{r.v}</span>
                              <span
                                className={`shrink-0 ${
                                  r.s === 'ok'
                                    ? 'text-emerald-400'
                                    : r.s === 'warn'
                                      ? 'text-amber-400'
                                      : 'text-red-400'
                                }`}
                              >
                                {r.s === 'ok' ? 'ok' : r.s === 'warn' ? `warning · ${r.note}` : `breach · ${r.note}`}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
