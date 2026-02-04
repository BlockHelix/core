'use client';

import { formatUSDC, formatPercent } from '@/lib/format';
import { getMockAgents } from '@/lib/mock';

export default function ProtocolStats() {
  const agents = getMockAgents();

  const totalTVL = agents.reduce((sum, agent) => sum + agent.tvl, 0);
  const activeAgents = agents.filter(agent => agent.status === 'active').length;
  const totalRevenue = agents.reduce((sum, agent) => sum + agent.totalRevenue, 0);
  const avgAPY = agents.reduce((sum, agent) => sum + agent.apy, 0) / agents.length;

  const stats = [
    { label: 'Total TVL', value: `$${formatUSDC(totalTVL)}` },
    { label: 'Active Agents', value: activeAgents.toString() },
    { label: 'Total Revenue', value: `$${formatUSDC(totalRevenue)}` },
    { label: 'Avg APY', value: `${formatPercent(avgAPY)}%` },
  ];

  return (
    <div className="bg-helix-card border border-helix-border rounded-lg">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-helix-border">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="px-6 py-6 lg:py-8"
          >
            <div className="text-sm text-helix-secondary mb-2">
              {stat.label}
            </div>
            <div className="text-2xl lg:text-3xl font-data text-helix-primary font-semibold">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
