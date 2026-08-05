import { ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';

// Facts, not features. 'Policy engine / curated policy per vault' told the reader nothing they
// could check. A licensed operator wants to know it runs, on what, and who audited the base.
// The hackathon placing moved out: it is already in the hero, and to a fund COO 'hackathon
// project' reads as a risk rather than a credential.
const STATS: { v: string; k: string; href?: string }[] = [
  { v: 'Live', k: 'mainnet vault, enforcing' },
  { v: '276', k: 'legs merkle-verified in one transaction' },
  { v: 'Veda core', k: 'audited Arctic base · MIT' },
  { v: 'Pre-trade', k: 'checked before the vault signs' },
];

export default function StatsStrip() {
  return (
    <>
      {/* Enforcement stats strip */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200">
            {STATS.map((s, i) => {
              const body = (
                <>
                  <p className="text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900 font-data">{s.v}</p>
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 mt-2 flex items-center gap-1.5">
                    {s.k}
                    {s.href && (
                      <ArrowUpRight
                        className="w-3 h-3 text-gray-300 group-hover:text-gray-900 transition-colors"
                        strokeWidth={2}
                      />
                    )}
                  </p>
                </>
              );
              return (
                <Reveal key={s.k} delay={i * 0.08} className="bg-white px-6 py-8 lg:px-8 lg:py-10">
                  {s.href ? (
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="group block">
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
