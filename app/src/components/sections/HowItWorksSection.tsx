import Reveal from '@/components/ui/Reveal';
import ArchitectureFlow from '@/components/ArchitectureFlow';

export default function HowItWorksSection() {
  return (
    <>
      {/* How it works: the five-stage flow */}
      <section className="py-20 lg:py-40 bg-[#FAF9F6] border-y border-[#EDECE7]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-[#10c689] mb-8">{'// How it works'}</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
              Five stages. Every trade.
            </h2>
            <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl">
              Intent in, settlement out. The policy is checked off-chain and re-verified
              on-chain against the same committed root. AI advisory stays outside the
              enforcement path.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-16 lg:mt-20">
            <ArchitectureFlow />
          </Reveal>
        </div>
      </section>
    </>
  );
}
