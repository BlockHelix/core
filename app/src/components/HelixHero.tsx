'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function HelixHero() {
  const [typedText, setTypedText] = useState('')
  const fullText = "Accelerating Agent Capitalism"

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
    <section className="relative bg-[#0a0a0a] min-h-screen flex items-start lg:items-center pt-20 lg:pt-0">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full flex flex-col lg:flex-row items-center justify-between pt-8 lg:pt-0">
        <div className="lg:w-1/2 z-10 flex flex-col items-center lg:items-start">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-4">
              <span style={{ color: '#22d3ee' }}>Block</span>
              <span style={{ color: '#22d3ee' }}> Helix</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-white/30 font-mono mb-10">
              {typedText}<span className="animate-pulse">|</span>
            </p>

            <div className="w-full max-w-xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search agents..."
                  className="w-full px-6 py-4 text-base bg-white/5 border border-white/20 text-white placeholder-white/40 focus:border-cyan-400 focus:outline-none transition-colors"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-400 text-black px-5 py-2 text-sm font-medium tracking-widest hover:bg-emerald-300 transition-colors">
                  SEARCH
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 text-xs cursor-pointer hover:border-white/30 hover:text-white/70 transition-colors">code-analysis</span>
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 text-xs cursor-pointer hover:border-white/30 hover:text-white/70 transition-colors">audit</span>
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 text-xs cursor-pointer hover:border-white/30 hover:text-white/70 transition-colors">trading</span>
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 text-xs cursor-pointer hover:border-white/30 hover:text-white/70 transition-colors">defi</span>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:w-1/2 h-full absolute top-0 right-0 bottom-0 z-0">
          <div className="relative w-full h-full">
            <HelixAnimation />
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#0a0a0a] to-transparent"></div>
          </div>
        </div>
      </div>
    </section>
  )
}


function HelixAnimation() {
  const totalStrands = 4;
  const pointsPerStrand = 200;
  const radius = 100;
  const height = 1000;
  const rotations = 6;
  const paintSpinLines = 8;

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
    return `rgba(34, 211, 238, ${fadeOpacity})`;
  };

  const getStrandColorViolet = (_index: number, t: number) => {
    const fadeOpacity = Math.min(1, Math.sin(t * Math.PI) * 1.4);
    return `rgba(167, 139, 250, ${fadeOpacity})`;
  };

  return (
    <svg
      viewBox={`${-radius - 10} -10 ${radius * 2 + 20} ${height + 20}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowStrong">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paintSpins.map((line, lineIndex) => (
        <motion.path
          key={`paint-spin-${lineIndex}`}
          d={line.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
          fill="none"
          stroke={`url(#paintGradient${lineIndex})`}
          strokeWidth="2"
          style={{
            filter: 'url(#glow)',
          }}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1],
            opacity: [0, 0.35, 0],
            y: ["0%", "100%", "0%"],
          }}
          strokeDasharray={lineIndex % 2 === 0 ? '6,3' : 'none'}
          transition={{
            duration: 10,
            ease: 'easeInOut',
            times: [0, 0.5, 1],
            delay: lineIndex * 0.08,
            repeat: Infinity,
          }}
        />
      ))}
      {helices.map((helix, strandIndex) => (
        <motion.path
          key={`strand-${strandIndex}`}
          d={helix.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
          fill="none"
          style={{
            filter: 'url(#glowStrong)',
          }}
          stroke={`url(#helixGradient${strandIndex})`}
          strokeWidth={strandIndex === 0 ? '4' : '2'}
          strokeDasharray={strandIndex % 2 === 0 ? '8,4' : 'none'}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1],
            opacity: [0, 1, 0],
            y: ["0%", "100%", "0%"],
          }}
          transition={{
            duration: 12,
            ease: 'easeInOut',
            times: [0, 0.5, 1],
            delay: 1.5 + strandIndex * 0.15,
            repeat: Infinity,
          }}
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
