// The category-definition section. This is the strongest available framing because it does not ask
// the reader to believe a new idea — it points at a mature TradFi category and says on-chain is
// missing it. Charles River runs $36T. Nobody argues about whether pre-trade compliance is needed;
// they argue about which vendor. That is a far better argument to be having.
//
// Deliberately does NOT claim regulation mandates us. Charles River is not mandated either. It is
// the thing you buy because trading without it is unprofessional.

import Reveal from '@/components/ui/Reveal';

const TRADFI = [
  {
    layer: 'Custody',
    tradfi: 'State Street, BNY, Northern Trust',
    onchain: 'Fireblocks, Anchorage, Fordefi',
    status: 'solved',
  },
  {
    layer: 'Fund administration',
    tradfi: 'Citco, SS&C',
    onchain: 'Veda, Lagoon, Enzyme, IPOR',
    status: 'solved',
  },
  {
    layer: 'Pre-trade compliance',
    tradfi: 'Charles River, Aladdin, SimCorp',
    onchain: 'Allowlists',
    status: 'missing',
  },
  {
    layer: 'Execution cost analysis',
    tradfi: 'Virtu, Abel Noser, Bloomberg',
    onchain: 'Nothing',
    status: 'missing',
  },
  {
    layer: 'Exposure and concentration',
    tradfi: 'MSCI, Axioma',
    onchain: 'Nothing',
    status: 'missing',
  },
];

export default function CategorySection() {
  return (
    <section className="relative z-10 -mt-16 mx-4 lg:mx-8 rounded-[4rem] bg-[#fafafa] py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:p-10">
              <p className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">The missing layer</p>
              <h2 className="mt-4 text-3xl font-light leading-tight tracking-[-0.02em] text-gray-900 md:text-4xl">
                No institutional manager trades without pre-trade compliance.
                <span className="text-zinc-400"> On-chain, almost everyone does.</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-black/[0.08] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[15px] leading-relaxed text-gray-500">
                  Charles River checks every order against the mandate before it leaves the desk, across
                  roughly 300 managers and{' '}
                  <span className="text-gray-900">$36 trillion in assets</span>.
                </p>
              </div>
              <div className="rounded-2xl border border-black/[0.08] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[15px] leading-relaxed text-gray-500">
                  Every trade can pass and the book can still be wrong. Three different tokens can all
                  resolve to the same balance sheet, so a position that reads as diversified is{' '}
                  <span className="text-gray-900">100% concentrated</span> in a single issuer. No
                  allowlist catches that.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14 overflow-x-auto rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05),0_12px_32px_-16px_rgba(0,0,0,0.08)]">
            <div className="min-w-[42rem]">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1.3fr_1.3fr] items-center gap-6 border-b border-black/[0.06] bg-gray-50/60 px-6 py-4 lg:px-8">
                <span className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Layer</span>
                <span className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Traditional finance</span>
                <span className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">On-chain</span>
              </div>

              {/* Rows */}
              {TRADFI.map((r, i) => {
                const missing = r.status === 'missing';
                return (
                  <div
                    key={r.layer}
                    className={`grid grid-cols-[1fr_1.3fr_1.3fr] items-center gap-6 px-6 py-5 transition-colors lg:px-8 ${
                      i !== TRADFI.length - 1 ? 'border-b border-black/[0.06]' : ''
                    } ${missing ? 'bg-[#f2fdf8] hover:bg-[#eafbf4]' : 'hover:bg-gray-50/70'}`}
                  >
                    <span className={`text-sm font-medium ${missing ? 'text-gray-900' : 'text-zinc-500'}`}>
                      {r.layer}
                    </span>
                    <span className={`font-data text-sm ${missing ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {r.tradfi}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`font-data text-sm ${missing ? 'text-gray-900' : 'text-zinc-400'}`}>
                        {r.onchain}
                      </span>
                      {missing ? (
                        <span className="rounded-full bg-[#adffd9] px-2.5 py-0.5 text-[11px] font-medium text-gray-900">
                          gap
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          live
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
