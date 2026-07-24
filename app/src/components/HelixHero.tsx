'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import PolicyCheckCard from '@/components/PolicyCheckCard'

// Below the lg breakpoint the 200-point pathLength animation is heavy on
// mobile GPUs. Render a lighter helix there (fewer points/lines).
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
}

export default function HelixHero() {
  return (
    <section className="relative bg-white min-h-screen flex items-start lg:items-center pt-24 pb-16 lg:py-32 overflow-hidden">
      {/* Helix sits behind the policy card on the right; desktop only */}
      <div className="hidden lg:block absolute top-0 right-0 bottom-0 w-1/2 z-0" aria-hidden>
        <HelixAnimation />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 w-full flex flex-col lg:flex-row items-center justify-between gap-16 z-10">
        <div className="lg:w-1/2 flex flex-col items-center lg:items-start">
          <div className="text-center lg:text-left">
            <div className="w-fit mb-6 text-left">
              <h1 className="text-[2.75rem] md:text-[5rem] lg:text-[6.5rem] leading-[0.92] tracking-[-0.04em] font-light text-gray-900 mb-0 -ml-[3px] lg:-ml-[5px]">
                Block<span className="font-bold">Helix</span>
              </h1>
              <p className="text-base md:text-lg lg:text-2xl leading-[1.1] tracking-[-0.01em] font-normal text-gray-900 -mt-1 lg:-mt-2">
                The execution risk layer for automated finance
              </p>
            </div>
            <p className="text-[15px] leading-[1.5] font-normal text-gray-500 max-w-md mb-4">
              Every trade your bots and agents run is checked against the full risk policy and enforced by the vault on-chain.
            </p>
            <p className="text-sm text-gray-900 mb-12">
              Colosseum hackathon <span className="font-medium bg-[#adffd9] text-gray-900 px-1.5 py-0.5 rounded-md">3rd out of 454 projects</span>
            </p>

            <div className="flex items-center justify-center lg:justify-start gap-4">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium bg-[#adffd9] text-gray-900 hover:bg-[#8ceec8] transition-all duration-300 whitespace-nowrap"
              >
                Get started
                <span className="group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
              </Link>
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-medium text-gray-900 border border-gray-300 hover:border-gray-900 transition-all duration-300 whitespace-nowrap"
              >
                Read the docs
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:w-1/2 w-full flex justify-center lg:justify-end">
          <PolicyCheckCard />
        </div>
      </div>
    </section>
  )
}


function HelixAnimation() {
  const reducedMotion = useReducedMotion();
  const lite = useIsMobile();

  const totalStrands = 4;
  const pointsPerStrand = lite ? 80 : 200;
  const radius = 100;
  const height = 1000;
  const rotations = 6;
  const paintSpinLines = lite ? 2 : 8;

  const generateHelix = (strandIndex: number) => {
    return Array.from({ length: pointsPerStrand }, (_, i) => {
      const t = i / (pointsPerStrand - 1);
      const angle = 2 * Math.PI * rotations * t + (2 * Math.PI * strandIndex) / totalStrands;
      const x = radius * Math.cos(angle);
      const y = height * t;
      const z = radius * Math.sin(angle);
      return { x, y, z, t };
    });
  };

  const generatePaintSpin = (lineIndex: number) => {
    return Array.from({ length: pointsPerStrand }, (_, i) => {
      const t = i / (pointsPerStrand - 1);
      const angle = 2 * Math.PI * rotations * t + (2 * Math.PI * lineIndex) / paintSpinLines;
      const x = radius * Math.cos(angle);
      const y = height * t;
      const z = radius * Math.sin(angle);
      return { x, y, z, t };
    });
  };

  const helices = Array.from({ length: totalStrands }, (_, i) => generateHelix(i));
  const paintSpins = Array.from({ length: paintSpinLines }, (_, i) => generatePaintSpin(i));

  const getStrandColorDeep = (_index: number, t: number) => {
    const fadeOpacity = Math.min(1, Math.sin(t * Math.PI) * 1.4);
    return `rgba(16, 198, 137, ${fadeOpacity})`;
  };

  const getStrandColorBright = (_index: number, t: number) => {
    const fadeOpacity = Math.min(1, Math.sin(t * Math.PI) * 1.4);
    return `rgba(43, 238, 173, ${fadeOpacity})`;
  };

  return (
    <svg
      viewBox={`${-radius - 10} -10 ${radius * 2 + 20} ${height + 20}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      {paintSpins.map((line, lineIndex) => (
        <motion.path
          key={`paint-spin-${lineIndex}`}
          d={line.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
          fill="none"
          stroke={`url(#paintGradient${lineIndex})`}
          strokeWidth="2"
          initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={
            reducedMotion
              ? { pathLength: 1, opacity: 0.2 }
              : { pathLength: [0, 1, 1], opacity: [0, 0.35, 0], y: ['0%', '100%', '0%'] }
          }
          strokeDasharray={lineIndex % 2 === 0 ? '6,3' : 'none'}
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  duration: 10,
                  ease: 'easeInOut',
                  times: [0, 0.5, 1],
                  delay: lineIndex * 0.08,
                  repeat: Infinity,
                }
          }
        />
      ))}
      {helices.map((helix, strandIndex) => (
        <motion.path
          key={`strand-${strandIndex}`}
          d={helix.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
          fill="none"
          stroke={`url(#helixGradient${strandIndex})`}
          strokeWidth={strandIndex === 0 ? '4' : '2'}
          strokeDasharray={strandIndex % 2 === 0 ? '8,4' : 'none'}
          initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={
            reducedMotion
              ? { pathLength: 1, opacity: 0.7 }
              : { pathLength: [0, 1, 1], opacity: [0, 1, 0], y: ['0%', '100%', '0%'] }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  duration: 12,
                  ease: 'easeInOut',
                  times: [0, 0.5, 1],
                  delay: 1.5 + strandIndex * 0.15,
                  repeat: Infinity,
                }
          }
        />
      ))}
      <defs>
        {paintSpins.map((line, lineIndex) => (
          <linearGradient key={`paintGradient${lineIndex}`} id={`paintGradient${lineIndex}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            {line.map((p, i) => (
              <stop key={i} offset={`${(i / (line.length - 1)) * 100}%`} stopColor={getStrandColorBright(lineIndex, p.t)} />
            ))}
          </linearGradient>
        ))}
        {helices.map((helix, strandIndex) => (
          <linearGradient key={`helixGradient${strandIndex}`} id={`helixGradient${strandIndex}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            {helix.map((p, i) => (
              <stop key={i} offset={`${(i / (helix.length - 1)) * 100}%`} stopColor={getStrandColorDeep(strandIndex, p.t)} />
            ))}
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}
