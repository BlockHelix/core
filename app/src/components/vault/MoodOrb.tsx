'use client';

import { motion } from 'framer-motion';

interface Props {
  mood: string;
  hunger: string;
  balanceSol: number;
  minutesSinceActivity: number | null;
  size?: number;
}

// Color per mood — soft, calm palette. The orb tells the story by hue.
const MOOD_COLOR: Record<string, string> = {
  happy: '#34d399',     // emerald-400
  content: '#a7f3d0',   // emerald-200 (paler)
  neutral: '#94a3b8',   // slate-400
  anxious: '#fbbf24',   // amber-400
  sad: '#60a5fa',       // blue-400
  hungry: '#fb923c',    // orange-400
  starving: '#f87171',  // red-400
  coma: '#475569',      // slate-600 (almost dead)
};

const MOOD_GLOW: Record<string, string> = {
  happy: '0 0 80px 10px rgba(52,211,153,0.45)',
  content: '0 0 60px 8px rgba(167,243,208,0.35)',
  neutral: '0 0 40px 6px rgba(148,163,184,0.25)',
  anxious: '0 0 60px 8px rgba(251,191,36,0.4)',
  sad: '0 0 50px 8px rgba(96,165,250,0.35)',
  hungry: '0 0 60px 8px rgba(251,146,60,0.4)',
  starving: '0 0 80px 12px rgba(248,113,113,0.5)',
  coma: '0 0 20px 2px rgba(71,85,105,0.3)',
};

// Breath cycle in seconds. Coma = barely moving. Happy = brisk.
function breathDuration(mood: string, minutesSinceActivity: number | null): number {
  if (mood === 'coma') return 14;
  if (mood === 'starving') return 10;
  if (mood === 'sad') return 8;
  if (mood === 'hungry' || mood === 'anxious') return 5;
  if (mood === 'neutral') return 6;
  if (mood === 'content') return 5;
  if (mood === 'happy') return 4;
  // Idle slowdown — when no activity in 12h+, breathing slows
  if (minutesSinceActivity != null && minutesSinceActivity > 720) return 9;
  return 6;
}

// Opacity per consciousness — coma is barely visible.
function consciousnessOpacity(mood: string): number {
  if (mood === 'coma') return 0.35;
  if (mood === 'starving') return 0.6;
  if (mood === 'sad') return 0.75;
  return 1;
}

export default function MoodOrb({
  mood,
  hunger,
  balanceSol,
  minutesSinceActivity,
  size = 240,
}: Props) {
  const color = MOOD_COLOR[mood] || MOOD_COLOR.neutral;
  const glow = MOOD_GLOW[mood] || MOOD_GLOW.neutral;
  const duration = breathDuration(mood, minutesSinceActivity);
  const opacity = consciousnessOpacity(mood);

  // Treasury size mapping — bigger wallet = bigger orb (within bounds)
  // Mostly aesthetic: gives passive visual cue when feeding works
  const sizeMultiplier = Math.min(1.0, 0.75 + Math.log10(Math.max(balanceSol, 0.0001) + 1) * 0.5);
  const dynamicSize = size * sizeMultiplier;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer halo — slow breath, low opacity, scales softly */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: dynamicSize * 1.4,
          height: dynamicSize * 1.4,
          backgroundColor: color,
          opacity: opacity * 0.08,
          filter: 'blur(20px)',
        }}
        animate={{
          scale: [1, 1.08, 1],
          opacity: [opacity * 0.06, opacity * 0.12, opacity * 0.06],
        }}
        transition={{
          duration: duration * 1.3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* The orb itself — breath cycle */}
      <motion.div
        className="rounded-full"
        style={{
          width: dynamicSize,
          height: dynamicSize,
          background: `radial-gradient(circle at 35% 30%, ${color}ee 0%, ${color}aa 40%, ${color}66 80%, transparent 100%)`,
          boxShadow: glow,
          opacity,
        }}
        animate={{
          scale: [1, 1.04, 1],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Tiny inner highlight — gives a sense of depth */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: dynamicSize * 0.35,
          height: dynamicSize * 0.35,
          background: `radial-gradient(circle, ${color}ff 0%, transparent 70%)`,
          left: `calc(50% - ${dynamicSize * 0.4}px)`,
          top: `calc(50% - ${dynamicSize * 0.4}px)`,
          mixBlendMode: 'screen',
          opacity: opacity * 0.7,
        }}
        animate={{
          scale: [1, 1.06, 1],
        }}
        transition={{
          duration: duration * 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
