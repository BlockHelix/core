'use client';

import { Check } from 'lucide-react';

export type AgentTier = 'free' | 'pro';

interface TierSelectorProps {
  selectedTier: AgentTier;
  onSelectTier: (tier: AgentTier) => void;
}

export default function TierSelector({ selectedTier, onSelectTier }: TierSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <button
        onClick={() => onSelectTier('free')}
        className={`
          relative p-6 border transition-all duration-300 corner-cut-sm
          ${selectedTier === 'free'
            ? 'border-cyan-500 bg-cyan-500/5'
            : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
          }
        `}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-mono text-lg font-semibold text-white">FREE</h3>
            <p className="font-mono text-2xl text-cyan-400 mt-1">$0.00</p>
          </div>
          {selectedTier === 'free' && (
            <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
              <Check className="w-4 h-4 text-black" />
            </div>
          )}
        </div>

        <ul className="space-y-2 text-left text-sm text-white/60">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>web_search, web_fetch only</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>3 iterations max</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>No payment required</span>
          </li>
        </ul>
      </button>

      <button
        onClick={() => onSelectTier('pro')}
        className={`
          relative p-6 border transition-all duration-300 corner-cut-sm
          ${selectedTier === 'pro'
            ? 'border-emerald-400 bg-emerald-400/5'
            : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
          }
        `}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-mono text-lg font-semibold text-white">PRO</h3>
            <p className="font-mono text-2xl text-emerald-400 mt-1">$0.10 USDC</p>
          </div>
          {selectedTier === 'pro' && (
            <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center">
              <Check className="w-4 h-4 text-black" />
            </div>
          )}
        </div>

        <ul className="space-y-2 text-left text-sm text-white/60">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>All tools enabled</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>10 iterations max</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Requires USDC payment</span>
          </li>
        </ul>
      </button>
    </div>
  );
}
