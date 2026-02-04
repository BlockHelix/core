'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAgentList } from '@/hooks/useAgentData';

const HelixHero = dynamic(() => import('@/components/HelixHero'), { ssr: false });
import ProtocolStats from '@/components/ProtocolStats';
import AgentCard from '@/components/AgentCard';

type SortOption = 'newest' | 'name';

export default function Home() {
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const { agents, isLoading } = useAgentList();

  const sortedAgents = useMemo(() => {
    const sorted = [...agents];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return sorted;
    }
  }, [agents, sortBy]);

  const totalAgents = agents.length;

  return (
    <main className="min-h-screen">
      <HelixHero />

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ProtocolStats activeAgents={totalAgents} />
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-helix-primary mb-2">
              Explore Agents
            </h2>
            <p className="text-helix-secondary">
              Discover and invest in tokenized autonomous agents
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-helix-secondary">
              Sort by:
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-helix-card border border-helix-border rounded-lg px-4 py-2 text-sm text-helix-primary focus:outline-none focus:ring-2 focus:ring-helix-cyan/50 cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-helix-card border border-helix-border rounded-lg p-6 animate-pulse"
              >
                <div className="h-6 bg-helix-elevated rounded w-3/4 mb-3"></div>
                <div className="h-12 bg-helix-elevated rounded mb-6"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-12 bg-helix-elevated rounded"></div>
                  <div className="h-12 bg-helix-elevated rounded"></div>
                  <div className="h-12 bg-helix-elevated rounded"></div>
                  <div className="h-12 bg-helix-elevated rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 bg-helix-card border border-helix-border rounded-lg">
            <div className="mb-4">
              <p className="text-helix-secondary text-lg mb-2">No agents deployed yet</p>
              <p className="text-helix-tertiary text-sm">Deploy the first tokenized autonomous agent</p>
            </div>
            <a
              href="/create"
              className="inline-block px-6 py-3 bg-helix-cyan text-helix-bg font-medium rounded-lg hover:brightness-110 transition-all"
            >
              Create First Agent
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedAgents.map((agent, index) => (
              <AgentCard key={agent.agentWallet.toString()} agent={agent} index={index} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
