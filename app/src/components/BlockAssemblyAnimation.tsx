'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function BlockAssemblyAnimation() {
  const [displayText, setDisplayText] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const fullText = 'JOB 0x7f3a → WORK DELIVERED → RECEIPT RECORDED → REVENUE SPLIT ENFORCED → NAV UPDATED'

  useEffect(() => {
    let i = 0
    const typingInterval = setInterval(() => {
      if (i < fullText.length) {
        setDisplayText(fullText.slice(0, i + 1))
        i++
      } else {
        setTimeout(() => {
          setIsVisible(false)
          setTimeout(() => {
            i = 0
            setDisplayText('')
            setIsVisible(true)
          }, 300)
        }, 2500)
      }
    }, 60)

    return () => clearInterval(typingInterval)
  }, [])

  const stages = [
    { label: 'PAY', x: 100 },
    { label: 'WORK', x: 240 },
    { label: 'RECEIPT', x: 380 },
    { label: 'SPLIT', x: 520 },
    { label: 'NAV', x: 660 },
  ]

  return (
    <section className="relative border-t border-white/10 py-20 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 800 200"
          className="w-full h-full max-w-6xl opacity-60"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="nodeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>

          {stages.map((stage, i) => {
            const nextStage = stages[i + 1]
            const hasNext = i < stages.length - 1

            return (
              <g key={stage.label}>
                <motion.circle
                  cx={stage.x}
                  cy="100"
                  r="12"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  filter="url(#nodeGlow)"
                  initial={{ opacity: 0.2 }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{
                    duration: 5,
                    delay: i * 0.5,
                    repeat: Infinity,
                    repeatDelay: 2.5,
                    ease: 'easeInOut',
                  }}
                />

                <motion.circle
                  cx={stage.x}
                  cy="100"
                  r="6"
                  fill="#22d3ee"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.8, 0] }}
                  transition={{
                    duration: 5,
                    delay: i * 0.5,
                    repeat: Infinity,
                    repeatDelay: 2.5,
                    ease: 'easeInOut',
                  }}
                />

                {hasNext && (
                  <>
                    <line
                      x1={stage.x + 16}
                      y1="100"
                      x2={nextStage!.x - 16}
                      y2="100"
                      stroke="#22d3ee"
                      strokeWidth="1"
                      opacity="0.2"
                    />

                    <motion.line
                      x1={stage.x + 16}
                      y1="100"
                      x2={nextStage!.x - 16}
                      y2="100"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: [0, 1, 0], opacity: [0, 1, 0] }}
                      transition={{
                        duration: 5,
                        delay: i * 0.5 + 0.3,
                        repeat: Infinity,
                        repeatDelay: 2.5,
                        ease: 'easeInOut',
                      }}
                    />
                  </>
                )}

                <motion.text
                  x={stage.x}
                  y="140"
                  textAnchor="middle"
                  className="text-[9px] font-mono fill-cyan-400/50"
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{
                    duration: 5,
                    delay: i * 0.5,
                    repeat: Infinity,
                    repeatDelay: 2.5,
                    ease: 'easeInOut',
                  }}
                >
                  {stage.label}
                </motion.text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center">
          <div className="h-8 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {isVisible && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs font-mono text-cyan-400 tracking-wider"
                >
                  {displayText}
                  {displayText && <span className="animate-pulse">_</span>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
    </section>
  )
}
