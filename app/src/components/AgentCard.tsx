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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/agent/${agentId}`} className="group block">
        <div className={cn(
          "relative border border-white/10 p-8 lg:p-10 corner-cut",
          "transition-all duration-300",
          "hover:border-emerald-400/50 hover:bg-white/[0.02] hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]",
          "cursor-pointer overflow-hidden"
        )}>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
            <div className="scan-line" />
          </div>

          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
                {agent.name}
              </h3>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-medium",
                  status === 'active' ? 'text-emerald-400' : 'text-white/40'
                )}>
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    status === 'active' ? 'bg-emerald-400 status-pulse' : 'bg-white/40'
                  )} />
                  {status === 'active' ? 'LIVE' : 'OFFLINE'}
                </div>
                <div className="text-[10px] text-white/30">|</div>
                <div className="text-[10px] uppercase tracking-widest text-white/30">
                  ID: {agentId.slice(0, 4)}
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-white/50 mb-8 line-clamp-2 min-h-[2.5rem] leading-relaxed">
            {agent.description || 'Autonomous agent with on-chain vault. Deposit USDC, receive revenue shares.'}
          </p>

          <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-white/10">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">REVENUE</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                ${formatUSDC(totalRevenue)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">JOBS</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono tabular-nums">
                {totalJobs.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center text-xs font-medium text-emerald-400">
            <span className="uppercase tracking-widest">ACCESS VAULT</span>
            <ArrowRight className="w-3.5 h-3.5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
