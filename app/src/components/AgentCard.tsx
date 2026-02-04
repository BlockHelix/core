'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { formatUSDC, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Agent {
  id?: string;
  agentWallet?: any;
  name: string;
  description?: string;
  status?: 'active' | 'paused' | 'inactive';
  tvl?: number;
  apy?: number;
  totalRevenue?: number;
  jobsCompleted?: number;
}

interface AgentCardProps {
  agent: Agent;
  index?: number;
}

export default function AgentCard({ agent, index = 0 }: AgentCardProps) {
  const statusColors = {
    active: 'bg-helix-green',
    paused: 'bg-helix-amber',
    inactive: 'bg-helix-tertiary',
  };

  const statusLabels = {
    active: 'Active',
    paused: 'Paused',
    inactive: 'Inactive',
  };

  const agentId = agent.id || agent.agentWallet?.toString() || '';
  const status = agent.status || 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/agent/${agentId}`}>
        <div className={cn(
          "bg-helix-card border border-helix-border rounded-lg p-6",
          "transition-all duration-200",
          "hover:scale-[1.01] hover:border-helix-cyan/30 hover:shadow-lg hover:shadow-helix-cyan/10",
          "cursor-pointer"
        )}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-lg text-helix-primary">
              {agent.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", statusColors[status])} />
              <span className="text-xs text-helix-secondary">
                {statusLabels[status]}
              </span>
            </div>
          </div>

          <p className="text-sm text-helix-secondary mb-6 line-clamp-2 min-h-[2.5rem]">
            {agent.description || 'Tokenized autonomous agent'}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-helix-secondary mb-1">TVL</div>
              <div className="font-data text-helix-primary font-semibold">
                ${formatUSDC(agent.tvl || 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-helix-secondary mb-1">APY</div>
              <div className="font-data text-helix-green font-semibold">
                {formatPercent(agent.apy || 0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-helix-secondary mb-1">Revenue</div>
              <div className="font-data text-helix-primary font-semibold">
                ${formatUSDC(agent.totalRevenue || 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-helix-secondary mb-1">Jobs</div>
              <div className="font-data text-helix-primary font-semibold">
                {(agent.jobsCompleted || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center text-sm text-helix-cyan font-medium group">
            <span>View Details</span>
            <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
