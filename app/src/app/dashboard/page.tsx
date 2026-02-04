'use client';

import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, Coins, Plus } from 'lucide-react';
import AgentCard from '@/components/AgentCard';
import WalletButton from '@/components/WalletButton';
import { getMockAgents } from '@/lib/mock';
import { formatUSDC, formatShares, formatPercent, timeAgo } from '@/lib/format';

const mockInvestments = [
  {
    agentId: 'agent_mev_arbitrage',
    agentName: 'MEV Arbitrage Bot',
    sharesHeld: 2500.5000,
    shareValue: 3128.42,
    apy: 31.25,
    profitLoss: 628.42,
    profitLossPercent: 25.1,
  },
  {
    agentId: 'agent_defi_optimizer',
    agentName: 'DeFi Yield Optimizer',
    sharesHeld: 1200.2500,
    shareValue: 1284.18,
    apy: 18.42,
    profitLoss: 84.18,
    profitLossPercent: 7.0,
  },
  {
    agentId: 'agent_staking_compounder',
    agentName: 'Staking Compounder',
    sharesHeld: 850.7500,
    shareValue: 792.35,
    apy: 19.95,
    profitLoss: -58.65,
    profitLossPercent: -6.9,
  },
];

const recentActivity = [
  {
    type: 'deposit',
    icon: ArrowUpRight,
    description: 'Deposited 500 USDC into DeFi Yield Optimizer',
    timestamp: new Date('2026-02-04T10:00:00Z'),
  },
  {
    type: 'revenue',
    icon: Coins,
    description: 'Received 12.50 USDC revenue from MEV Arbitrage Bot',
    timestamp: new Date('2026-02-04T07:00:00Z'),
  },
  {
    type: 'withdraw',
    icon: ArrowDownRight,
    description: 'Withdrew 100 shares from Liquidation Guardian',
    timestamp: new Date('2026-02-03T18:00:00Z'),
  },
  {
    type: 'revenue',
    icon: Coins,
    description: 'Received 8.75 USDC revenue from DeFi Yield Optimizer',
    timestamp: new Date('2026-02-03T14:00:00Z'),
  },
  {
    type: 'deposit',
    icon: ArrowUpRight,
    description: 'Deposited 1000 USDC into MEV Arbitrage Bot',
    timestamp: new Date('2026-02-02T22:00:00Z'),
  },
  {
    type: 'revenue',
    icon: Coins,
    description: 'Received 15.25 USDC revenue from Staking Compounder',
    timestamp: new Date('2026-02-02T16:00:00Z'),
  },
];

export default function Dashboard() {
  const { authenticated: connected } = useAuth();
  const agents = getMockAgents();
  const myAgents = agents.slice(0, 2);

  if (!connected) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-4xl font-bold text-helix-primary mb-3">
              My Dashboard
            </h1>
            <p className="text-helix-secondary mb-8">
              View your agents, investments, and activity
            </p>

            <div className="bg-helix-card border border-helix-border rounded-lg p-8 text-center">
              <p className="text-helix-secondary mb-6">
                Connect your wallet to view your dashboard
              </p>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-display text-4xl font-bold text-helix-primary mb-3">
            My Dashboard
          </h1>
          <p className="text-helix-secondary mb-12">
            View your agents, investments, and activity
          </p>

          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl font-bold text-helix-primary">
                My Agents
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {myAgents.map((agent, index) => (
                <AgentCard key={agent.id} agent={agent} index={index} />
              ))}
            </div>

            <Link href="/create">
              <button className="flex items-center gap-2 bg-helix-card border border-helix-border rounded-lg px-6 py-3 text-helix-cyan font-medium transition-all hover:border-helix-cyan/30 hover:bg-helix-elevated">
                <Plus className="w-5 h-5" />
                <span>Create New Agent</span>
              </button>
            </Link>
          </section>

          <section className="mb-16">
            <h2 className="font-display text-2xl font-bold text-helix-primary mb-6">
              My Investments
            </h2>

            <div className="bg-helix-card border border-helix-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-helix-border bg-helix-terminal">
                      <th className="text-left px-6 py-4 text-sm font-medium text-helix-secondary">
                        Agent
                      </th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-helix-secondary">
                        Shares Held
                      </th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-helix-secondary">
                        Value (USDC)
                      </th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-helix-secondary">
                        APY
                      </th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-helix-secondary">
                        P&L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockInvestments.map((investment, index) => (
                      <motion.tr
                        key={investment.agentId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="border-b border-helix-border last:border-0 hover:bg-helix-elevated/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/agent/${investment.agentId}`}
                            className="text-helix-primary hover:text-helix-cyan transition-colors"
                          >
                            {investment.agentName}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-right font-data text-helix-primary">
                          {formatShares(investment.sharesHeld)}
                        </td>
                        <td className="px-6 py-4 text-right font-data text-helix-primary">
                          ${formatUSDC(investment.shareValue)}
                        </td>
                        <td className="px-6 py-4 text-right font-data text-helix-green">
                          {formatPercent(investment.apy)}%
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={investment.profitLoss >= 0 ? 'text-helix-green' : 'text-helix-red'}>
                            <div className="font-data">
                              {investment.profitLoss >= 0 ? '+' : ''}${formatUSDC(Math.abs(investment.profitLoss))}
                            </div>
                            <div className="text-xs font-data">
                              ({investment.profitLossPercent >= 0 ? '+' : ''}{formatPercent(investment.profitLossPercent)}%)
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-helix-primary mb-6">
              Recent Activity
            </h2>

            <div className="bg-helix-card border border-helix-border rounded-lg p-6">
              <div className="relative">
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-helix-border" />

                <div className="space-y-6">
                  {recentActivity.map((activity, index) => {
                    const Icon = activity.icon;
                    const iconColors: Record<typeof activity.type, string> = {
                      deposit: 'text-helix-cyan bg-helix-cyan/10',
                      withdraw: 'text-helix-violet bg-helix-violet/10',
                      revenue: 'text-helix-green bg-helix-green/10',
                    };

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="relative flex gap-4"
                      >
                        <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${iconColors[activity.type]}`}>
                          <Icon className="w-3 h-3" />
                        </div>

                        <div className="flex-1 pb-2">
                          <p className="text-helix-primary mb-1">
                            {activity.description}
                          </p>
                          <p className="text-sm text-helix-tertiary font-data">
                            {timeAgo(activity.timestamp)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </motion.div>
      </div>
    </main>
  );
}
