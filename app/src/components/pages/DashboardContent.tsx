'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAgentListAPI } from '@/hooks/useAgentAPI';
import { useWallets } from '@privy-io/react-auth/solana';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, Settings, Plus } from 'lucide-react';
import { formatUSDC, formatShares } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import WalletButton from '@/components/WalletButton';
import { getAgentsByOwner, type AgentSummary } from '@/lib/runtime';

type Tab = 'staked' | 'deployed' | 'jobs';

export default function DashboardContent() {
  const { authenticated: connected } = useAuth();
  const { positions, isLoading: positionsLoading } = useDashboardData();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const { agents: allAgents } = useAgentListAPI();

  const [tab, setTab] = useState<Tab>('staked');
  const [myAgents, setMyAgents] = useState<AgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !wallet?.address) {
      setAgentsLoading(false);
      return;
    }
    const fetch = async () => {
      try {
        setAgentsLoading(true);
        const data = await getAgentsByOwner(wallet.address);
        setMyAgents(data);
      } catch {
        // Runtime unavailable - not an error, just no deployed agents to show
      } finally {
        setAgentsLoading(false);
      }
    };
    fetch();
  }, [connected, wallet?.address]);

  if (!connected) {
    return (
      <main className="min-h-screen py-32 lg:py-48">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-xs uppercase tracking-wider-2 text-white/40 mb-6">
              DASHBOARD
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6">
              Dashboard
            </h1>
            <p className="text-lg lg:text-xl text-white/60 leading-relaxed mb-16">
              View your staked positions, deployed agents, and job activity
            </p>
            <div className="border border-white/10 p-16 text-center bg-white/[0.02]">
              <p className="text-lg text-white/60 mb-10">
                Connect wallet to view dashboard
              </p>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  const isLoading = positionsLoading || agentsLoading;
  const totalValue = positions.reduce((sum, p) => sum + p.usdcValue, 0);
  const totalDeposited = positions.reduce((sum, p) => sum + p.deposited, 0);
  const totalGain = totalValue - totalDeposited;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'staked', label: 'STAKED', count: positions.length },
    { key: 'deployed', label: 'DEPLOYED', count: myAgents.length },
    { key: 'jobs', label: 'JOBS', count: 0 },
  ];

  if (isLoading) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-8">
            <div className="h-12 skeleton w-1/2" />
            <div className="h-6 skeleton w-3/4" />
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 skeleton" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-mono">
            DASHBOARD
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
            Overview
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            Your positions, agents, and activity
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="border border-white/10 p-6 bg-white/[0.01]">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-mono">STAKED VALUE</div>
              <div className="text-2xl lg:text-3xl font-bold text-white font-mono tabular-nums">${formatUSDC(totalValue)}</div>
              {totalGain !== 0 && (
                <div className={`text-xs mt-2 font-mono ${totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalGain >= 0 ? '+' : ''}${formatUSDC(totalGain)}
                </div>
              )}
            </div>
            <div className="border border-white/10 p-6 bg-white/[0.01]">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-mono">AGENTS DEPLOYED</div>
              <div className="text-2xl lg:text-3xl font-bold text-white font-mono tabular-nums">{myAgents.length}</div>
            </div>
            <div className="border border-white/10 p-6 bg-white/[0.01]">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-mono">POSITIONS</div>
              <div className="text-2xl lg:text-3xl font-bold text-white font-mono tabular-nums">{positions.length}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-white/10 mb-8">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-6 py-3 text-xs uppercase tracking-widest font-mono font-bold transition-colors duration-200 border-b-2 -mb-px ${
                  tab === t.key
                    ? 'text-emerald-400 border-emerald-400'
                    : 'text-white/40 border-transparent hover:text-white/60'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-2 text-[10px] bg-white/10 px-2 py-0.5">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'staked' && <StakedTab positions={positions} />}
          {tab === 'deployed' && <DeployedTab agents={myAgents} error={agentsError} />}
          {tab === 'jobs' && <JobsTab />}
        </motion.div>
      </div>
    </main>
  );
}

function StakedTab({ positions }: { positions: any[] }) {
  if (positions.length === 0) {
    return (
      <div className="border border-white/10 p-16 text-center">
        <h2 className="text-lg font-bold text-white mb-3 font-mono">NO OPEN POSITIONS</h2>
        <p className="text-white/60 mb-6 text-sm">
          Deposit USDC into an agent vault to acquire shares
        </p>
        <Link href="/search">
          <button className="inline-flex items-center gap-2 bg-white text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors duration-300">
            <TrendingUp className="w-4 h-4" />
            <span>EXPLORE AGENTS</span>
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.01]">
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">AGENT</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">SHARES</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">VALUE</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">DEPOSITED</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">GAIN/LOSS</th>
              <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">WALLET</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position: any) => {
              const gain = position.usdcValue - position.deposited;
              const gainPct = position.deposited > 0 ? (gain / position.deposited) * 100 : 0;
              return (
                <tr
                  key={position.vaultState.toString()}
                  className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02] transition-colors duration-300"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/agent/${position.operator.toString()}`}
                      className="text-emerald-400 hover:text-emerald-300 transition-colors duration-300 text-sm"
                    >
                      {position.agentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-white text-sm">
                    {formatShares(position.shareBalance)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-white text-sm">
                    ${formatUSDC(position.usdcValue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-white/60 text-sm">
                    ${formatUSDC(position.deposited)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums text-sm ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {gain >= 0 ? '+' : ''}${formatUSDC(gain)} <span className="text-xs">({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CopyButton value={position.operator.toString()} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeployedTab({ agents, error }: { agents: AgentSummary[]; error: string | null }) {
  if (error) {
    return (
      <div className="mb-8 border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-sm text-red-400 font-mono">{error}</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="border border-white/10 p-16 text-center">
        <h2 className="text-lg font-bold text-white mb-3 font-mono">NO AGENTS DEPLOYED</h2>
        <p className="text-white/60 mb-6 text-sm">
          Deploy your first agent to start earning from inference calls
        </p>
        <Link href="/deploy">
          <button className="inline-flex items-center gap-2 bg-white text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-cyan-400 transition-colors duration-300">
            <Plus className="w-4 h-4" />
            <span>CREATE AGENT</span>
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {agents.map((agent) => (
        <div
          key={agent.agentId}
          className="border border-white/10 p-6 bg-white/[0.01] hover:bg-white/[0.02] transition-colors duration-300"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-lg font-bold text-white font-mono">{agent.name}</h3>
                {agent.isActive ? (
                  <span className="text-[10px] uppercase tracking-widest text-green-400 bg-green-400/10 px-2 py-1 font-mono">ACTIVE</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-1 font-mono">INACTIVE</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">PRICE/CALL</div>
                  <div className="text-sm font-mono text-white">${formatUSDC(agent.priceUsdcMicro / 1_000_000)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">MODEL</div>
                  <div className="text-sm text-white/70">{agent.model.includes('sonnet') ? 'Sonnet 4' : agent.model}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">AGENT WALLET</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white/70">{agent.operator.slice(0, 4)}...{agent.operator.slice(-4)}</span>
                    <CopyButton value={agent.operator} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-mono">VAULT</div>
                  <Link href={`/agent/${agent.vault}`} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors duration-300">
                    View Vault
                  </Link>
                </div>
              </div>
            </div>
            <Link href={`/dashboard/agent/${agent.agentId}`}>
              <button className="inline-flex items-center gap-2 border border-white/20 text-white font-medium px-4 py-2 text-xs uppercase tracking-widest hover:bg-white/5 transition-colors duration-300">
                <Settings className="w-4 h-4" />
                <span>CONFIGURE</span>
              </button>
            </Link>
          </div>
        </div>
      ))}
      <div className="pt-4">
        <Link href="/deploy">
          <button className="inline-flex items-center gap-2 bg-cyan-500 text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-cyan-400 transition-colors duration-300">
            <Plus className="w-4 h-4" />
            <span>CREATE AGENT</span>
          </button>
        </Link>
      </div>
    </div>
  );
}

function JobsTab() {
  return (
    <div className="border border-white/10 p-16 text-center">
      <h2 className="text-lg font-bold text-white mb-3 font-mono">JOB ACTIVITY</h2>
      <p className="text-white/60 text-sm mb-2">
        Job history is tracked per-agent on their detail pages
      </p>
      <p className="text-white/30 text-xs font-mono">
        Visit an agent page to view receipts and submit jobs
      </p>
      <Link href="/search" className="inline-block mt-6">
        <button className="inline-flex items-center gap-2 bg-white text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors duration-300">
          <span>BROWSE AGENTS</span>
        </button>
      </Link>
    </div>
  );
}
