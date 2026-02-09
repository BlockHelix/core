'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ChevronDown } from 'lucide-react';
import { useAgentListAPI, type APIAgent } from '@/hooks/useAgentAPI';
import { formatUSDC } from '@/lib/format';
import { getTier, TIER_COLORS, TIER_LABELS, type Tier } from '@/lib/reputation';

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

function matchesQuery(agent: APIAgent, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return agent.name.toLowerCase().includes(lower) ||
    (agent.agentId || '').toLowerCase().includes(lower) ||
    (agent.operator || '').toLowerCase().includes(lower);
}

export default function SearchContent() {
  const { agents, isLoading, error } = useAgentListAPI();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [sortOpen, setSortOpen] = useState(false);

  const ranked = useMemo(() => {
    const active = agents.filter(a => a.isActive);
    const q = query.trim();

    let results = active
      .filter(agent => matchesQuery(agent, q))
      .map(agent => {
        const tvl = agent.vaultStats?.tvl ?? 0;
        const revenue = agent.vaultStats?.revenue ?? 0;
        const jobs = agent.vaultStats?.jobs ?? 0;
        const score = Math.min((tvl + revenue) / 1_000_000_000 + jobs / 100, 1);
        return { agent, score, tier: getTier(score) };
      });

    switch (sortMode) {
      case 'relevance':
      case 'tvl':
        results.sort((a, b) => (b.agent.vaultStats?.tvl ?? 0) - (a.agent.vaultStats?.tvl ?? 0));
        break;
      case 'revenue':
        results.sort((a, b) => (b.agent.vaultStats?.revenue ?? 0) - (a.agent.vaultStats?.revenue ?? 0));
        break;
      case 'newest':
        results.reverse();
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
            Browse registered agents. Each agent has a vault, operator bond, and on-chain receipts.
          </p>

          <div className="flex gap-3 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name..."
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

          {error ? (
            <div className="border border-red-400/20 p-16 text-center">
              <p className="text-red-400/80 mb-2 font-mono text-sm">{error}</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 skeleton" />
              ))}
            </div>
          ) : ranked.length === 0 ? (
            <div className="border border-white/10 p-16 text-center">
              <p className="text-white/60 mb-2 font-mono">
                {query.trim() ? `No agents matching "${query}"` : 'No agents registered yet'}
              </p>
              {!query.trim() && (
                <p className="text-white/30 text-sm">
                  Be the first to deploy
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-0 border border-white/10 divide-y divide-white/[0.06]">
              {ranked.map(({ agent, score, tier }) => {
                const tvl = (agent.vaultStats?.tvl ?? 0) / 1_000_000;
                const linkId = agent.operator || agent.agentId;
                return (
                  <Link
                    key={agent.agentId}
                    href={`/agent/${linkId}`}
                    className="group flex items-center gap-4 px-5 py-4 bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-200"
                  >
                    <TierBadge tier={tier} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white font-mono group-hover:text-emerald-400 transition-colors truncate">
                          {agent.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {agent.operator && (
                          <span className="text-[10px] text-white/20 font-mono">
                            {agent.operator.slice(0, 4)}...{agent.operator.slice(-4)}
                          </span>
                        )}
                        <span className="text-white/10 mx-1">·</span>
                        <span className="text-[10px] text-white/25 font-mono" title={TIER_LABELS[tier]}>
                          {TIER_LABELS[tier]} ({(score * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                      <div className="text-right w-24">
                        <div className="text-[9px] uppercase tracking-widest text-white/25 font-mono">TVL</div>
                        <div className="text-xs font-mono text-white/60 tabular-nums">${formatUSDC(tvl)}</div>
                      </div>
                      <div className="text-right w-24">
                        <div className="text-[9px] uppercase tracking-widest text-white/25 font-mono">REVENUE</div>
                        <div className="text-xs font-mono text-emerald-400 tabular-nums">${formatUSDC((agent.vaultStats?.revenue ?? 0) / 1_000_000)}</div>
                      </div>
                      <div className="text-right w-16">
                        <div className="text-[9px] uppercase tracking-widest text-white/25 font-mono">JOBS</div>
                        <div className="text-xs font-mono text-cyan-400 tabular-nums">{(agent.vaultStats?.jobs ?? 0).toLocaleString()}</div>
                      </div>
                    </div>

                    <span className="text-xs text-white/20 group-hover:text-emerald-400 transition-colors font-mono flex-shrink-0">
                      →
                    </span>
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
