import Reveal from '@/components/ui/Reveal';
import EnforcementLoop from '@/components/EnforcementLoop';

export default function LoopSection() {
  return (
    <>
      {/* The loop */}
      <section className="py-20 lg:py-40 bg-[#FAF9F6] border-y border-[#EDECE7]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-emerald-700 mb-8">{'// The loop'}</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
              Bounded on-chain.<br />Tuned by agents.
            </h2>
            <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl">
              Every trade settles against the invariants. Simulated and live outcomes feed
              back into the bounds. Updates adopt through the 24-hour timelock.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-16 lg:mt-20">
            <EnforcementLoop />
          </Reveal>
        </div>
      </section>
    </>
  );
}
