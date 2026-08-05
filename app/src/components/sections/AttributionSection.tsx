import Reveal from '@/components/ui/Reveal';
import NavLine from '@/components/charts/NavLine';
import AttributionTrace from '@/components/charts/AttributionTrace';

export default function AttributionSection() {
  return (
    <>
      {/* Attribution: name the driver */}
      <section className="-mt-16 pt-40 pb-20 lg:pt-52 lg:pb-32 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-8">{'// Attribution modelling'}</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
              Debug your yield.
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mb-12">
              A NAV line tells you how much. It cannot tell you why. We model every move into named
              drivers, each tied to its on-chain source, so you see what earned and what bled.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <div className="px-4 py-5 sm:px-6">
                <NavLine />
              </div>
              <div className="border-t border-black/[0.06] px-4 py-5 sm:px-6">
                <AttributionTrace />
              </div>
              <div className="flex items-start gap-3 border-t border-black/[0.06] bg-gray-50/60 px-6 py-4">
                <span className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-400 font-mono">Analyst</span>
                <p className="text-sm text-gray-900">
                  The strategy held its carry. Slippage was the largest cost, not the market.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
