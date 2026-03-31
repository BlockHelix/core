'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatUSDC, formatPercent } from '@/lib/format';
import { useAgentListAPI, type APIAgent } from '@/hooks/useAgentAPI';
import { posthog } from '@/lib/posthog';

type SortKey = 'revenue' | 'tvl' | 'apy' | 'newest';

function calcAPY(agent: APIAgent): number {
  const tvl = agent.stats?.tvl ?? 0;
  const revenue = agent.stats?.totalRevenue ?? 0;
  if (tvl <= 0) return 0;
  return (revenue / tvl) * 100;
}

function AgentCardSkeleton() {
  return (
    <div className="border border-white/10 p-5 space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-white/10 w-2/3" />
          <div className="h-3 bg-white/5 w-1/3" />
        </div>
        <div className="h-5 bg-white/10 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-1">
            <div className="h-2.5 bg-white/5 w-1/2" />
            <div className="h-4 bg-white/10 w-3/4" />
          </div>
        ))}
      </div>
      <div className="h-px bg-white/5" />
      <div className="flex gap-2">
        <div className="h-8 bg-white/10 flex-1" />
        <div className="h-8 bg-white/5 flex-1" />
      </div>
    </div>
  );
}

function RevenueBar({ revenue, maxRevenue }: { revenue: number; maxRevenue: number }) {
  const pct = maxRevenue > 0 ? Math.min((revenue / maxRevenue) * 100, 100) : 0;
  return (
    <div className="h-1 bg-white/5 w-full">
      <div
        className="h-full bg-emerald-400/70"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AgentCard({ agent, maxRevenue }: { agent: APIAgent; maxRevenue: number }) {
  const tvl = agent.stats?.tvl ?? 0;
  const totalRevenue = agent.stats?.totalRevenue ?? 0;
  const operatorBond = agent.stats?.operatorBond ?? 0;
  const apiCalls = agent.stats?.apiCalls ?? 0;
  const apy = calcAPY(agent);
  const priceUsdc = agent.priceUsdcMicro / 1_000_000;

  return (
    <div className="border border-white/10 hover:border-white/20 bg-[#0f0f0f] transition-colors duration-200 flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white font-mono tracking-tight mb-1">
              {agent.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono">LIVE</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-0.5">PER CALL</div>
            <div className="text-sm font-bold text-cyan-400 font-mono">${priceUsdc.toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-0.5">TVL</div>
            <div className="text-sm font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(tvl)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-0.5">REVENUE</div>
            <div className="text-sm font-bold text-emerald-400 font-mono tabular-nums">${formatUSDC(totalRevenue)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-0.5">BOND</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${operatorBond > 0 ? 'text-white/70' : 'text-red-400'}`}>
              {operatorBond > 0 ? `$${formatUSDC(operatorBond)}` : 'NONE'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-0.5">APY</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${apy > 0 ? 'text-amber-400' : 'text-white/30'}`}>
              {apy > 0 ? `${formatPercent(apy)}%` : '—'}
            </div>
          </div>
        </div>

        <div className="mb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest text-white/20 font-mono">REVENUE SHARE</span>
            <span className="text-[10px] text-white/20 font-mono">{apiCalls.toLocaleString()} calls</span>
          </div>
          <RevenueBar revenue={totalRevenue} maxRevenue={maxRevenue} />
        </div>
      </div>

      <div className="flex border-t border-white/10">
        <Link
          href={`/agent/${agent.id}`}
          onClick={() => posthog?.capture('agent_card_deposit_click', { agentId: agent.id, name: agent.name })}
          className="flex-1 py-2.5 text-center text-[10px] uppercase tracking-widest font-mono font-bold text-emerald-400 hover:bg-emerald-400 hover:text-black transition-colors duration-150"
        >
          Deposit
        </Link>
        <div className="w-px bg-white/10" />
        <Link
          href={`/agent/${agent.id}`}
          onClick={() => posthog?.capture('agent_card_try_click', { agentId: agent.id, name: agent.name })}
          className="flex-1 py-2.5 text-center text-[10px] uppercase tracking-widest font-mono font-bold text-white/50 hover:bg-white/5 hover:text-white transition-colors duration-150"
        >
          Try
        </Link>
      </div>
    </div>
  );
}

export default function HomeContent() {
  const { agents, isLoading } = useAgentListAPI();
  const [sort, setSort] = useState<SortKey>('revenue');

  const activeAgents = agents.filter(a => a.isActive);

  const totalTVL = activeAgents.reduce((s, a) => s + (a.stats?.tvl ?? 0), 0);
  const totalRevenue = activeAgents.reduce((s, a) => s + (a.stats?.totalRevenue ?? 0), 0);
  const maxRevenue = Math.max(...activeAgents.map(a => a.stats?.totalRevenue ?? 0), 0);

  const sorted = [...activeAgents].sort((a, b) => {
    if (sort === 'revenue') return (b.stats?.totalRevenue ?? 0) - (a.stats?.totalRevenue ?? 0);
    if (sort === 'tvl') return (b.stats?.tvl ?? 0) - (a.stats?.tvl ?? 0);
    if (sort === 'apy') return calcAPY(b) - calcAPY(a);
    return 0;
  });

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'tvl', label: 'TVL' },
    { key: 'apy', label: 'APY' },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-14">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">

        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-white font-mono tracking-tight mb-1">
                Invest in AI agents. Earn their revenue.
              </h1>
              <p className="text-xs text-white/40 font-mono">
                Deposit USDC into agent vaults. Revenue from API calls flows back to depositors.
              </p>
            </div>
            <Link
              href="/deploy"
              className="hidden sm:inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-white/40 hover:text-white transition-colors"
            >
              Become an operator <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-3 border border-white/10 divide-x divide-white/10">
            <div className="px-5 py-3">
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-1">Total TVL</div>
              <div className="text-lg font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(totalTVL)}</div>
            </div>
            <div className="px-5 py-3">
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-1">Total Revenue</div>
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">${formatUSDC(totalRevenue)}</div>
            </div>
            <div className="px-5 py-3">
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-1">Active Agents</div>
              <div className="text-lg font-bold text-cyan-400 font-mono tabular-nums">{activeAgents.length}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-mono">
            {isLoading ? 'Loading agents...' : `${sorted.length} agent${sorted.length !== 1 ? 's' : ''}`}
          </h2>
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-widest text-white/20 font-mono mr-2">Sort</span>
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setSort(opt.key); posthog?.capture('sort_changed', { sort: opt.key }); }}
                className={`px-3 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors duration-150 ${
                  sort === opt.key
                    ? 'bg-white/10 text-white'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <AgentCardSkeleton key={i} />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="border border-white/10 py-20 text-center">
            <p className="text-white/30 font-mono text-sm mb-4">No agents live yet.</p>
            <Link
              href="/deploy"
              className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Deploy the first one <span>→</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(agent => (
              <AgentCard key={agent.id} agent={agent} maxRevenue={maxRevenue} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
