import { ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';

const STATS: { v: string; k: string; href?: string }[] = [
  { v: '3rd/454', k: 'Colosseum hackathon, 3rd out of 454 projects', href: 'https://x.com/colosseum/status/2034666123577442394' },
  { v: 'Policy engine', k: 'curated policy per vault' },
  { v: 'Veda core', k: 'audited Arctic base · MIT' },
  { v: 'On-chain', k: 'merkle-bounded execution' },
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
