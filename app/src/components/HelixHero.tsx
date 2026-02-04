'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function HelixHero() {
  const [typedText, setTypedText] = useState('')
  const fullText = "Tokenized Autonomous Agents"

  const ModernCubeIcon = () => (
    <svg width="300" height="300" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-4">
      <defs>
        <linearGradient id="cubeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4EC9B0" />
          <stop offset="100%" stopColor="#C586C0" />
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
  )

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
    <section className="relative bg-helix-bg h-[600px] flex items-start lg:items-center pt-20 lg:pt-0">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between pt-8 lg:pt-0">
        <div className="lg:w-1/2 z-10 flex flex-col items-center lg:items-start">
          <ModernCubeIcon />
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-4">
              <span style={{ color: 'rgb(78, 201, 176)' }}>Block Helix</span>
            </h1>
            <p className="mt-3 text-xl sm:text-2xl md:text-3xl text-white font-mono max-w-xl">
              {typedText}<span className="animate-pulse">|</span>
            </p>
          </div>
        </div>
        <div className="lg:w-1/2 h-full absolute top-0 right-0 bottom-0 z-0">
          <div className="relative w-full h-full">
            <HelixAnimation />
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-helix-bg to-transparent"></div>
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

  const getStrandColorGreen = (index: number, t: number) => {
    const fadeOpacity = Math.sin(t * Math.PI);
    return `rgba(78, 201, 176, ${fadeOpacity})`;
  };

  const getStrandColorPurple = (index: number, t: number) => {
    const fadeOpacity = Math.sin(t * Math.PI);
    return `rgba(197, 134, 192, ${fadeOpacity})`;
  };

  return (
    <svg
      viewBox={`${-radius - 10} -10 ${radius * 2 + 20} ${height + 20}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
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
          strokeWidth="1"
          style={{
            filter: 'drop-shadow(0 0 6px rgba(197, 134, 192, 1))',
          }}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1],
            opacity: [0, 1, 0],
            y: ["0%", "100%", "0%"],
          }}
          strokeDasharray={lineIndex % 2 === 0 ? '4,2' : 'none'}
          transition={{
            duration: 6,
            ease: 'easeInOut',
            times: [0, 0.5, 1],
            delay: lineIndex * 0.05,
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
            filter: 'drop-shadow(0 0 6px rgba(78, 201, 176, 1))',
          }}
          stroke={`url(#helixGradient${strandIndex})`}
          strokeWidth={strandIndex === 0 ? '3' : '1'}
          strokeDasharray={strandIndex % 2 === 0 ? '5,5' : 'none'}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1],
            opacity: [0, 1, 0],
            y: ["0%", "100%", "0%"],
          }}
          transition={{
            duration: 8,
            ease: 'easeInOut',
            times: [0, 0.5, 1],
            delay: 1 + strandIndex * 0.1,
            repeat: Infinity,
          }}
        />
      ))}
      <defs>
        {paintSpins.map((line, lineIndex) => (
          <linearGradient key={`paintGradient${lineIndex}`} id={`paintGradient${lineIndex}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            {line.map((p, i) => (
              <stop key={i} offset={`${(i / (line.length - 1)) * 100}%`} stopColor={getStrandColorPurple(lineIndex, p.t)} />
            ))}
          </linearGradient>
        ))}
        {helices.map((helix, strandIndex) => (
          <linearGradient key={`helixGradient${strandIndex}`} id={`helixGradient${strandIndex}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            {helix.map((p, i) => (
              <stop key={i} offset={`${(i / (helix.length - 1)) * 100}%`} stopColor={getStrandColorGreen(strandIndex, p.t)} />
            ))}
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}
