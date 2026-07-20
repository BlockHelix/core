import Reveal from '@/components/ui/Reveal';

const CONTROLS = [
  { k: 'Slippage', v: 'Every swap is checked against an oracle price. A trade that returns less than the bound reverts.' },
  { k: 'Size', v: 'Per-trade and per-asset notional caps. No single action can exceed them.' },
  { k: 'Venues & assets', v: 'Explicit allowlists. Unlisted routes and tokens are rejected before execution.' },
  { k: 'Leverage', v: 'A hard ceiling on perp exposure, enforced when the position opens.' },
  { k: 'Drawdown', v: 'Trading halts and positions unwind once losses pass a set threshold.' },
];

export default function AuthorizedSection() {
  return (
    <>
      {/* Authorized is not safe */}
      <section className="py-20 lg:py-48 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-8">{'// Authorized is not safe'}</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
              Allowlisting the action<br /><span className="text-red-600">is not enough.</span>
            </h2>
            <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl mb-16 lg:mb-24">
              In January 2026, a vault lost $3.7M on a single swap:{' '}
              <span className="bg-gray-900 text-white px-3 py-1">3.84M in, 112K out</span>. No exploit.
              The trade was authorized and executed exactly as approved. Nothing verified what it
              returned. A function-level allowlist would have approved it too.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            <Reveal>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">Enforced on every trade</h3>
              <div className="space-y-5">
                {CONTROLS.map((c) => (
                  <div key={c.k} className="flex items-start gap-5">
                    <span className="text-emerald-600 font-mono text-sm font-semibold w-32 flex-shrink-0 pt-0.5">{c.k}</span>
                    <p className="text-gray-500 leading-relaxed">{c.v}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">The check, on the real trade</h3>
              <div className="relative bg-white border border-gray-200 shadow-soft p-6 lg:p-8 border-l-2 border-l-red-600">
                <span aria-hidden className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t border-gray-400" />
                <span aria-hidden className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r border-gray-400" />
                <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-6">{'// Swap · stkGHO → USDC'}</p>
                <div className="space-y-3 text-sm font-mono">
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Input</span><span className="text-gray-800">3,840,651 stkGHO</span></div>
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Returned</span><span className="text-gray-800">112,036 USDC</span></div>
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Oracle floor</span><span className="text-gray-800">≈ 3,801,000 USDC</span></div>
                  <div className="flex justify-between gap-4 pt-3 border-t border-gray-200">
                    <span className="text-gray-400">Result</span>
                    <span className="text-red-600 font-semibold">reverted, 97% below floor</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-4 leading-relaxed">
                The same trade that cost $3.7M in production fails the slippage check and never settles.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
