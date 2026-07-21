import Link from 'next/link';
import Reveal from '@/components/ui/Reveal';

const TEMPLATES = [
  {
    tag: 'Bluechip',
    tagColor: 'text-cyan-600',
    accent: 'bg-cyan-500',
    title: 'Bluechip',
    desc: 'USDC ↔ WETH/cbBTC on top-liquidity pools only. Slippage capped at 50 bps per trade.',
    meta: 'Risk: conservative · Hooks: swap',
  },
  {
    tag: 'Yield',
    tagColor: 'text-emerald-600',
    accent: 'bg-emerald-500',
    title: 'All Yield',
    desc: 'Morpho, Aave v3, and Moonwell whitelisted markets. No directional swaps.',
    meta: 'Risk: conservative–moderate · Hooks: yield',
  },
  {
    tag: 'Balanced',
    tagColor: 'text-violet-600',
    accent: 'bg-violet-500',
    title: 'Balanced',
    desc: 'Bluechip pairs plus yield sources, with per-transaction notional caps.',
    meta: 'Risk: moderate · Hooks: swap + yield',
  },
  {
    tag: 'Momentum',
    tagColor: 'text-amber-600',
    accent: 'bg-amber-500',
    title: 'Midcap Momentum',
    desc: 'Curated, liquidity-screened midcap list. Tighter caps, wider slippage band.',
    meta: 'Risk: aggressive · Hooks: swap',
  },
  {
    tag: 'Perps',
    tagColor: 'text-red-600',
    accent: 'bg-red-500',
    title: 'Perps Midcap',
    desc: 'Midcap perp markets, max 3× leverage, mandatory exit leaves. Ships in v2.',
    meta: 'Risk: aggressive · Hooks: swap + perps',
  },
  {
    tag: 'Custom',
    tagColor: 'text-cyan-600',
    accent: 'bg-cyan-500',
    title: 'Custom',
    desc: 'Define your own bounds. Validated by the config service, activated via timelock.',
    meta: 'Risk: you decide · Hooks: any',
  },
];

export default function TemplatesSection() {
  return (
    <>
      {/* Policy templates */}
      <section className="py-20 lg:py-48 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-8">{'// Policy templates'}</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
              Start from a risk profile.
            </h2>
            <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl mb-16 lg:mb-24">
              Compose your own bounds, or start from a maintained template. We version the
              leaf sets and publish vetted updates operators adopt through the timelock.
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
            <div className="mt-16 lg:mt-24 flex items-center justify-between flex-wrap gap-8">
              <p className="text-lg text-gray-500 max-w-xl">Now building.</p>
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-widest bg-gray-900 text-white hover:bg-black transition-all duration-300"
              >
                READ THE API DRAFT
                <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
