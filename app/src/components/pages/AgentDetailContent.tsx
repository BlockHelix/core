'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { formatUSDC } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import { RevenueChart } from '@/components/RevenueChart';
import { ReceiptTable } from '@/components/ReceiptTable';
import { InvestWithdrawForm } from '@/components/InvestWithdrawForm';
import { TryAgentWidget } from '@/components/agent/TryAgentWidget';
import { cn } from '@/lib/cn';
import { HireAgentForm } from '@/components/agent/HireAgentForm';
import { useAgentDetailAPI } from '@/hooks/useAgentAPI';

export default function AgentDetailContent() {
  const params = useParams();
  const agentIdStr = params.id as string;

  const { agent, isLoading, error } = useAgentDetailAPI(agentIdStr);

  const vaultPubkey = useMemo(() => {
    if (!agent?.vault) return null;
    try { return new PublicKey(agent.vault); } catch { return null; }
  }, [agent?.vault]);

  if (error) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="border border-red-500/30 bg-red-500/5 p-12 text-center">
            <p className="text-red-400 mb-4">Error loading agent: {error}</p>
            <Link href="/search" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Back to Agents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-8">
            <div className="h-12 skeleton w-1/2"></div>
            <div className="h-6 skeleton w-3/4"></div>
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 skeleton"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="border border-white/10 p-12 text-center">
            <p className="text-white/60 mb-4">Agent not found</p>
            <Link href="/search" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Back to Agents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const s = agent.stats;
  const tvl = s?.tvl ?? 0;
  const totalRevenue = s?.totalRevenue ?? 0;
  const operatorBond = s?.operatorBond ?? 0;
  const totalJobs = s?.totalJobs ?? 0;
  const paused = s?.paused ?? false;
  const agentPrice = agent.priceUsdcMicro / 1_000_000;

  const vaultId = agent.vault || agent.agentId;

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-10 border-b border-white/10 pb-6">
          <div className="flex items-center justify-between mb-6">
            <Link href="/search" className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors uppercase tracking-widest font-mono">
              <span>←</span>
              <span>BACK</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  !paused ? 'bg-emerald-400' : 'bg-amber-400'
                )} />
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold font-mono",
                  !paused ? 'text-emerald-400' : 'text-amber-400'
                )}>
                  {paused ? 'PAUSED' : 'LIVE'}
                </span>
              </div>
              <div className="text-white/20">|</div>
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-mono">ON-CHAIN</span>
            </div>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">{agent.name}</h1>
            {agent.operator && <CopyButton value={agent.operator} />}
          </div>
          <div className="space-y-2 text-sm text-white/60">
            {agent.vault && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest text-white/40 w-20 font-mono">Vault</span>
                <span className="text-emerald-400 font-mono text-xs break-all">{agent.vault}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8 border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold font-mono">VAULT METRICS</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-white/10">
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">TVL</div>
              <div className="text-lg font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(tvl)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">REVENUE</div>
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">${formatUSDC(totalRevenue)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">BOND</div>
              <div className="text-lg font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(operatorBond)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">JOBS</div>
              <div className="text-lg font-bold text-cyan-400 font-mono tabular-nums">{totalJobs.toLocaleString()}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">API CALLS</div>
              <div className="text-lg font-bold text-cyan-400 font-mono tabular-nums">{(s?.apiCalls ?? 0).toLocaleString()}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">SLASHED</div>
              <div className="text-lg font-bold text-red-400 font-mono tabular-nums">{s?.slashEvents ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[10px] text-white/25 font-mono leading-relaxed">
            Revenue from x402 jobs increases the vault balance without minting new shares, so share PRICE rises. Deposits mint shares at current NAV, preserving PRICE for existing holders. BOND is the operator&apos;s slashable collateral -- first-loss protection for depositors.
          </p>
        </div>

        {agent.revenueHistory.length > 0 && (
          <div className="mb-12">
            <RevenueChart data={agent.revenueHistory} />
          </div>
        )}

        <div className="mb-12">
          <TryAgentWidget
            agentId={vaultId}
            price={agentPrice}
            endpointUrl="https://agents.blockhelix.tech"
            agentName={agent.name}
          />
        </div>

        <div className="mb-12">
          <HireAgentForm agentId={vaultId} endpointUrl="https://agents.blockhelix.tech" agentName={agent.name} />
        </div>

        {vaultPubkey && (
          <div className="mb-12">
            <InvestWithdrawForm
              vaultPubkey={vaultPubkey}
              shareMint={null}
              sharePrice={1}
            />
          </div>
        )}

        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 mb-6 font-mono">JOB RECEIPTS</h2>
          <ReceiptTable receipts={agent.recentJobs} />
        </div>
      </div>
    </main>
  );
}
