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
  isActive?: boolean;
  totalRevenue?: any;
  totalJobs?: any;
  createdAt?: any;
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
  const status = agent.isActive ? 'active' : 'inactive';
  const totalRevenue = agent.totalRevenue ? Number(agent.totalRevenue) / 1_000_000 : 0;
  const totalJobs = agent.totalJobs ? Number(agent.totalJobs) : 0;

  return (
    <Link href={`/agent/${agentId}`} className="group block">
      <div className={cn(
        "relative border border-white/10 p-5",
        "transition-colors duration-300",
        "hover:border-white/20 hover:bg-white/[0.02]",
        "cursor-pointer"
      )}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white tracking-tight mb-2 font-mono">
              {agent.name}
            </h3>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-medium font-mono",
                status === 'active' ? 'text-emerald-400' : 'text-white/40'
              )}>
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  status === 'active' ? 'bg-emerald-400' : 'bg-white/40'
                )} />
                {status === 'active' ? 'LIVE' : 'OFFLINE'}
              </div>
              <div className="text-[10px] text-white/20">|</div>
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono">
                ID: {agentId.slice(0, 4)}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/50 mb-6 line-clamp-2 min-h-[2rem] leading-relaxed">
          {agent.description || 'Autonomous agent with on-chain vault. Deposit USDC, receive revenue shares.'}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-white/10">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5 font-mono">REVENUE</div>
            <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
              ${formatUSDC(totalRevenue)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5 font-mono">JOBS</div>
            <div className="text-lg font-bold text-cyan-400 font-mono tabular-nums">
              {totalJobs.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex items-center text-[10px] font-medium text-emerald-400 uppercase tracking-widest font-mono">
          <span>ACCESS VAULT</span>
          <ArrowRight className="w-3 h-3 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
