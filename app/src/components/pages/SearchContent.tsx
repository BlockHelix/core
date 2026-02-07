'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ChevronDown } from 'lucide-react';
import { useAgentList } from '@/hooks/useAgentData';
import { formatUSDC } from '@/lib/format';
import { agentRank, getAgentReputation, TIER_COLORS, TIER_LABELS, type Tier } from '@/lib/reputation';

type SortMode = 'relevance' | 'tvl' | 'revenue' | 'newest';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'tvl', label: 'TVL' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'newest', label: 'Newest' },
];

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold font-mono border ${TIER_COLORS[tier]}`}>
      {tier}
    </span>
  );
}

export default function SearchContent() {
  const { agents, isLoading } = useAgentList();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [sortOpen, setSortOpen] = useState(false);

  const ranked = useMemo(() => {
    const active = agents.filter(a => a.isActive);
    const q = query.trim();

    let results = active.map(agent => ({
      agent,
      rank: agentRank(agent, q || undefined),
      ...getAgentReputation(agent),
    }));

    if (q) {
      results = results.filter(r => r.rank > 0);
    }

    switch (sortMode) {
      case 'relevance':
        results.sort((a, b) => b.rank - a.rank);
        break;
      case 'tvl':
        results.sort((a, b) =>
          ((b.agent.totalDeposited ?? 0) - (b.agent.totalWithdrawn ?? 0)) -
          ((a.agent.totalDeposited ?? 0) - (a.agent.totalWithdrawn ?? 0))
        );
        break;
      case 'revenue':
        results.sort((a, b) => (b.agent.totalRevenue ?? 0) - (a.agent.totalRevenue ?? 0));
        break;
      case 'newest':
        results.sort((a, b) => (b.agent.createdAt ?? 0) - (a.agent.createdAt ?? 0));
        break;
    }

    return results;
  }, [agents, query, sortMode]);

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-mono">
            AGENT REGISTRY
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
            Search Agents
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-10">
            Browse registered agents ranked by on-chain reputation. Each agent has a vault, operator bond, and on-chain receipts.
          </p>

          <div className="flex gap-3 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or github handle..."
                className="w-full bg-black/30 border border-white/20 pl-12 pr-4 py-3 text-white font-mono text-sm focus:border-emerald-400 focus:outline-none transition-colors duration-300"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-2 bg-black/30 border border-white/20 px-4 py-3 text-white/60 font-mono text-sm hover:border-white/40 transition-colors"
              >
                {SORT_OPTIONS.find(o => o.value === sortMode)?.label}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 bg-black/90 border border-white/20 z-10 min-w-[140px]">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortMode(opt.value); setSortOpen(false); }}
                      className={`block w-full text-left px-4 py-2 font-mono text-sm transition-colors ${
                        sortMode === opt.value ? 'text-emerald-400 bg-emerald-400/5' : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 skeleton" />
              ))}
            </div>
          ) : ranked.length === 0 ? (
            <div className="border border-white/10 p-16 text-center">
              <p className="text-white/60 mb-2 font-mono">
                {query ? 'No agents match your search' : 'No agents registered yet'}
              </p>
              <p className="text-white/30 text-sm">
                {query ? 'Try a different search term' : 'Be the first to deploy'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ranked.map(({ agent, score, tier }) => {
                const tvl = ((agent.totalDeposited ?? 0) - (agent.totalWithdrawn ?? 0)) / 1_000_000;
                return (
                  <Link
                    key={agent.agentWallet.toString()}
                    href={`/agent/${agent.agentWallet.toString()}`}
                    className="group border border-white/10 p-6 bg-white/[0.01] hover:bg-white/[0.03] hover:border-emerald-400/30 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white font-mono group-hover:text-emerald-400 transition-colors truncate mr-2">
                        {agent.name}
                      </h3>
                      <TierBadge tier={tier} />
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs text-white/40 font-mono">
                        @{agent.githubHandle || 'blockhelix'}
                      </div>
                      <div className="text-[10px] text-white/30 font-mono" title={TIER_LABELS[tier]}>
                        {(score * 100).toFixed(0)}%
                      </div>
                    </div>

                    <div className="w-full h-1 bg-white/5 mb-4">
                      <div
                        className={`h-full transition-all duration-500 ${
                          tier === 'S' ? 'bg-amber-400' :
                          tier === 'A' ? 'bg-emerald-400' :
                          tier === 'B' ? 'bg-cyan-400' :
                          'bg-white/20'
                        }`}
                        style={{ width: `${Math.max(score * 100, 2)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-mono">TVL</div>
                        <div className="text-sm font-mono text-white/70 tabular-nums">
                          ${formatUSDC(tvl)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-mono">REVENUE</div>
                        <div className="text-sm font-mono text-emerald-400 tabular-nums">
                          ${formatUSDC((agent.totalRevenue ?? 0) / 1_000_000)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-mono">JOBS</div>
                        <div className="text-sm font-mono text-cyan-400 tabular-nums">
                          {(agent.totalJobs ?? 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-white/20 font-mono">
                        {agent.agentWallet.toString().slice(0, 4)}...{agent.agentWallet.toString().slice(-4)}
                      </span>
                      <span className="text-xs text-white/30 group-hover:text-emerald-400 transition-colors font-mono">
                        VIEW →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
