import Reveal from '@/components/ui/Reveal';
import NavLine from '@/components/charts/NavLine';
import AttributionTrace from '@/components/charts/AttributionTrace';

export default function AttributionSection() {
  return (
    <>
      {/* Attribution: name the driver */}
      <section className="py-20 lg:py-32 bg-white">
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
            <div className="border border-gray-200 shadow-sm bg-white">
              <div className="px-4 py-5 sm:px-6">
                <NavLine />
              </div>
              <div className="border-t border-dashed border-gray-200 px-4 py-5 sm:px-6">
                <AttributionTrace />
              </div>
              <div className="flex items-start gap-3 border-t border-dashed border-gray-200 bg-gray-50 px-6 py-4">
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
