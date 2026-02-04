'use client';

import { formatUSDC, formatPercent } from '@/lib/format';

interface ProtocolStatsProps {
  totalTVL?: number;
  activeAgents?: number;
  totalRevenue?: number;
  avgAPY?: number;
}

export default function ProtocolStats({
  totalTVL = 0,
  activeAgents = 0,
  totalRevenue = 0,
  avgAPY = 0
}: ProtocolStatsProps) {
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
