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
  const [typedText, setTypedText] = useState('')
  const fullText = "The execution risk layer for automated finance."

  useEffect(() => {
    let i = 0
    const typingInterval = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(fullText.slice(0, i + 1))
        i++
      } else {
        clearInterval(typingInterval)
      }
    }, 100)

    return () => clearInterval(typingInterval)
  }, [])

  return (
    <section className="relative bg-white min-h-screen flex items-start lg:items-center pt-8 lg:pt-0 overflow-hidden">
      {/* Faint engineering grid, dissolved toward the left so copy stays clean */}
      <div className="absolute inset-0 bg-grid" aria-hidden />
      <div
        className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent" aria-hidden />

      {/* Helix sits behind the policy card on the right; desktop only */}
      <div className="hidden lg:block absolute top-0 right-0 bottom-0 w-1/2 z-0" aria-hidden>
        <HelixAnimation />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 w-full flex flex-col lg:flex-row items-center justify-between gap-12 pt-8 lg:pt-0 z-10">
        <div className="lg:w-1/2 flex flex-col items-center lg:items-start">
          <div className="text-center lg:text-left">
            <HeroCube />
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 mb-4">
              Block{' '}
              <span className="bg-gradient-to-r from-cyan-600 to-emerald-500 bg-clip-text text-transparent">
                Helix
              </span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-500 font-mono mb-3 min-h-[1.5em]">
              {typedText}<span className="animate-pulse">|</span>
            </p>
            <p className="text-sm sm:text-base text-gray-600 max-w-xl mb-10 leading-relaxed">
              Every trade your bots and agents run is checked against the full risk policy and enforced by the vault on-chain.
Colosseum hackathon 3rd out of 454 projects            </p>

            <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all duration-300 corner-cut-sm whitespace-nowrap"
              >
                GET STARTED
                <span className="group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
              </Link>
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-widest text-gray-900 border border-gray-300 hover:border-gray-900 transition-all duration-300 corner-cut-sm whitespace-nowrap"
              >
                READ THE DOCS
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:w-1/2 w-full flex justify-center lg:justify-end pb-16 lg:pb-0">
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

  const getStrandColorCyan = (_index: number, t: number) => {
    const fadeOpacity = Math.min(1, Math.sin(t * Math.PI) * 1.4);
    return `rgba(8, 145, 178, ${fadeOpacity})`;
  };

  const getStrandColorViolet = (_index: number, t: number) => {
    const fadeOpacity = Math.min(1, Math.sin(t * Math.PI) * 1.4);
    return `rgba(124, 58, 237, ${fadeOpacity})`;
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
              <stop key={i} offset={`${(i / (line.length - 1)) * 100}%`} stopColor={getStrandColorViolet(lineIndex, p.t)} />
            ))}
          </linearGradient>
        ))}
        {helices.map((helix, strandIndex) => (
          <linearGradient key={`helixGradient${strandIndex}`} id={`helixGradient${strandIndex}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            {helix.map((p, i) => (
              <stop key={i} offset={`${(i / (helix.length - 1)) * 100}%`} stopColor={getStrandColorCyan(strandIndex, p.t)} />
            ))}
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}

function HeroCube() {
  return (
    <svg width="300" height="300" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-4">
      <defs>
        <linearGradient id="cubeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M16 2L30 9V23L16 30L2 23V9L16 2Z" fill="url(#cubeGradient)" fillOpacity="0"/>
      <path d="M16 2L30 9L16 16L2 9L16 2Z" fill="url(#cubeGradient)" fillOpacity="0.0"/>
      <path d="M16 16V30L2 23V9L16 16Z" fill="url(#cubeGradient)" fillOpacity="0.0"/>
      <path d="M16 16V30L30 23V9L16 16Z" fill="url(#cubeGradient)" fillOpacity="0.0"/>
      <path d="M16 2L30 9V23L16 30L2 23V9L16 2Z M16 16L30 9M16 16L2 9M16 16V30"
            stroke="url(#cubeGradient)"
            strokeWidth="0.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 1">
        <animate attributeName="stroke-dashoffset" values="5;0" dur="6s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}
