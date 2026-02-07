'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useAgentList } from '@/hooks/useAgentData';
import { formatUSDC } from '@/lib/format';

export default function SearchContent() {
  const { agents, isLoading } = useAgentList();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    const active = agents.filter(a => a.isActive);
    if (!query.trim()) return active;
    const q = query.toLowerCase();
    return active.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.githubHandle?.toLowerCase().includes(q)
    );
  }, [agents, query]);

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

          <div className="relative mb-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or github handle..."
              className="w-full bg-black/30 border border-white/20 pl-12 pr-4 py-3 text-white font-mono text-sm focus:border-emerald-400 focus:outline-none transition-colors duration-300"
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 skeleton" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
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
              {filtered.map((agent) => (
                <Link
                  key={agent.agentWallet.toString()}
                  href={`/agent/${agent.agentWallet.toString()}`}
                  className="group border border-white/10 p-6 bg-white/[0.01] hover:bg-white/[0.03] hover:border-emerald-400/30 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white font-mono group-hover:text-emerald-400 transition-colors">
                      {agent.name}
                    </h3>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>

                  <div className="text-xs text-white/40 font-mono mb-4">
                    @{agent.githubHandle || 'blockhelix'}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
