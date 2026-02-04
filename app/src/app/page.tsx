'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const HelixHero = dynamic(() => import('@/components/HelixHero'), { ssr: false });
import ProtocolStats from '@/components/ProtocolStats';
import AgentCard from '@/components/AgentCard';
import { getMockAgents } from '@/lib/mock';

type SortOption = 'tvl' | 'apy' | 'revenue' | 'newest';

export default function Home() {
  const [sortBy, setSortBy] = useState<SortOption>('tvl');
  const agents = getMockAgents();

  const sortedAgents = useMemo(() => {
    const sorted = [...agents];
    switch (sortBy) {
      case 'tvl':
        return sorted.sort((a, b) => b.tvl - a.tvl);
      case 'apy':
        return sorted.sort((a, b) => b.apy - a.apy);
      case 'revenue':
        return sorted.sort((a, b) => b.totalRevenue - a.totalRevenue);
      case 'newest':
        return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      default:
        return sorted;
    }
  }, [agents, sortBy]);

  return (
    <main className="min-h-screen">
      <HelixHero />

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ProtocolStats />
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
              <option value="tvl">TVL</option>
              <option value="apy">APY</option>
              <option value="revenue">Revenue</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAgents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} index={index} />
          ))}
        </div>
      </section>
    </main>
  );
}
