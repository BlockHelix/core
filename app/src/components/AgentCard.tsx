'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatUSDC } from '@/lib/format';
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
  variant?: 'dark' | 'light';
}

export default function AgentCard({ agent, index = 0, variant = 'dark' }: AgentCardProps) {
  const agentId = agent.id || agent.agentWallet?.toString() || '';
  const status = agent.isActive ? 'active' : 'inactive';
  const totalRevenue = agent.totalRevenue ? Number(agent.totalRevenue) / 1_000_000 : 0;
  const totalJobs = agent.totalJobs ? Number(agent.totalJobs) : 0;
  const light = variant === 'light';

  return (
    <Link href={`/agent/${agentId}`} className="group block">
      <div className={cn(
        "relative border p-6 transition-colors duration-300 cursor-pointer",
        light
          ? "border-black/10 hover:border-black/25 bg-white"
          : "border-white/10 hover:border-white/20"
      )}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className={cn(
              "text-lg font-bold tracking-tight mb-2",
              light ? "text-[#0a0a0a]" : "text-white"
            )}>
              {agent.name}
            </h3>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-medium font-mono",
                status === 'active' ? 'text-emerald-500' : light ? 'text-black/30' : 'text-white/40'
              )}>
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  status === 'active' ? 'bg-emerald-500' : light ? 'bg-black/30' : 'bg-white/40'
                )} />
                {status === 'active' ? 'LIVE' : 'OFFLINE'}
              </div>
              <div className={cn("text-[10px]", light ? "text-black/15" : "text-white/20")}>|</div>
              <div className={cn("text-[10px] uppercase tracking-widest font-mono", light ? "text-black/30" : "text-white/30")}>
                ID: {agentId.slice(0, 4)}
              </div>
            </div>
          </div>
        </div>

        <p className={cn(
          "text-xs mb-6 line-clamp-2 min-h-[2rem] leading-relaxed",
          light ? "text-black/50" : "text-white/50"
        )}>
          {agent.description || 'Autonomous agent with on-chain vault. Deposit USDC, receive revenue shares.'}
        </p>

        <div className={cn(
          "grid grid-cols-2 gap-4 mb-6 pb-6 border-b",
          light ? "border-black/10" : "border-white/10"
        )}>
          <div>
            <div className={cn("text-[10px] uppercase tracking-widest mb-1.5 font-mono", light ? "text-black/30" : "text-white/30")}>REVENUE</div>
            <div className="text-lg font-bold text-emerald-500 font-mono tabular-nums">
              ${formatUSDC(totalRevenue)}
            </div>
          </div>
          <div>
            <div className={cn("text-[10px] uppercase tracking-widest mb-1.5 font-mono", light ? "text-black/30" : "text-white/30")}>JOBS</div>
            <div className="text-lg font-bold text-cyan-500 font-mono tabular-nums">
              {totalJobs.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex items-center text-[10px] font-medium text-emerald-500 uppercase tracking-widest font-mono">
          <span>ACCESS VAULT</span>
          <ArrowRight className="w-3 h-3 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
