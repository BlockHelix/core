import Link from 'next/link';
import Reveal from '@/components/ui/Reveal';

// The check library, not strategy templates.
//
// This section used to sell "spin up a vault, pick a profile". That is not the product: operators
// already run their own vaults, and nobody is switching platform to get a policy engine. Charles
// River does not hand a manager a portfolio, it checks the orders they were going to send anyway.
//
// So what belongs here is the list of things we can TEST. Every entry below runs today and ran on
// the live mainnet position; nothing is aspirational, because the check list IS the product and
// overstating it is the one lie a compliance buyer will definitely catch.
const TEMPLATES = [
  {
    tag: 'Execution',
    tagColor: 'text-[#059669]',
    accent: 'bg-[#10c689]',
    title: 'Price impact',
    desc: 'Simulated at the size actually being traded, marginal against effective, both fee-inclusive. Refuses above the bound instead of discovering the cost afterwards.',
    meta: 'Measured pre-trade',
  },
  {
    tag: 'Pricing',
    tagColor: 'text-[#0891b2]',
    accent: 'bg-[#35c4e2]',
    title: 'Oracle dislocation',
    desc: 'Spot mid against the TWAP, fee-exclusive on both sides so the comparison means something. A good quote on a dislocated book is refused.',
    meta: 'Measured pre-trade',
  },
  {
    tag: 'Liquidity',
    tagColor: 'text-[#6d28d9]',
    accent: 'bg-[#8b5cf6]',
    title: 'Depth and ticks crossed',
    desc: 'How far a fill sweeps the book before it lands. Over the limit, the order is refused rather than sliced blindly at whatever the pool offers.',
    meta: 'Measured pre-trade',
  },
  {
    tag: 'Position',
    tagColor: 'text-[#b45309]',
    accent: 'bg-[#f59e0b]',
    title: 'Leverage and health',
    desc: 'Projected LTV against the market liquidation threshold, forward across every leg of a multi-step trade, not just the one being signed.',
    meta: 'Projected pre-trade',
  },
  {
    tag: 'Mandate',
    tagColor: 'text-[#475569]',
    accent: 'bg-[#94a3b8]',
    title: 'Venue and function bounds',
    desc: 'The strategy can call these contracts and these functions, and nothing else. The vault checks this itself, so the limit holds even if our service is down.',
    meta: 'Enforced on-chain',
  },
  {
    tag: 'Concentration',
    tagColor: 'text-[#b82214]',
    accent: 'bg-[#ef4444]',
    title: 'Issuer look-through',
    desc: 'A wrapper hides its issuer. sUSDe is an ERC-4626 over USDe, so holding it is holding Ethena — and a position with sUSDe collateral against a USDtb borrow is three tokens and one balance sheet.',
    meta: 'Coming',
  },
  {
    tag: 'Contagion',
    tagColor: 'text-[#be185d]',
    accent: 'bg-[#ec4899]',
    title: 'Correlated liquidation',
    desc: 'If your collateral depegs, every other borrower in that market is liquidated at the same moment and the exit liquidity you were counting on is gone. We measure how much of the market looks like you.',
    meta: 'Coming',
  },
];

export default function TemplatesSection() {
  return (
    <>
      {/* Policy templates */}
      <section className="py-20 lg:py-48 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-8">{'// The checks'}</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
              What we test before you sign.
            </h2>
            <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl mb-16 lg:mb-24">
              Your strategy proposes a trade. These run against it first, on your own vault, and the
              measured values are written down whether the trade passes or not.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {TEMPLATES.map((t, i) => (
              <Reveal key={t.title} delay={(i % 3) * 0.08}>
                <div className="border border-gray-200 p-6 lg:p-8 bg-white shadow-soft transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-gray-300 h-full">
                  <div className={`h-0.5 w-8 ${t.accent} mb-5`} />
                  <div className={`text-[10px] uppercase tracking-widest ${t.tagColor} font-mono font-bold mb-3`}>{t.tag}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{t.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{t.desc}</p>
                  <div className="text-xs text-gray-400 font-mono">{t.meta}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-16 lg:mt-24 flex items-center justify-end">
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-black transition-all duration-300"
              >
                Read the docs
                <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
