'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PublicKey } from '@solana/web3.js';
import { formatUSDC, formatShares } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import { RevenueChart } from '@/components/RevenueChart';
import { ReceiptTable } from '@/components/ReceiptTable';
import { InvestWithdrawForm } from '@/components/InvestWithdrawForm';
import { cn } from '@/lib/cn';
import { useAgentDetails, useJobReceipts } from '@/hooks/useAgentData';
import { findVaultState, findRegistryState } from '@/lib/pda';

export default function AgentDetailContent() {
  const params = useParams();
  const agentWalletStr = params.id as string;

  let agentWallet: PublicKey | null = null;
  let isValidAddress = true;
  try {
    agentWallet = new PublicKey(agentWalletStr);
  } catch {
    isValidAddress = false;
  }

  const { agentMetadata, vaultState, totalAssets, totalShares, isLoading, error } = useAgentDetails(agentWallet);

  const vaultPubkey = agentWallet ? findVaultState(agentWallet)[0] : null;
  const registryPubkey = vaultPubkey ? findRegistryState(vaultPubkey)[0] : null;

  const { receipts } = useJobReceipts(registryPubkey);

  if (!isValidAddress) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="border border-red-500/30 bg-red-500/5 p-12 text-center">
            <p className="text-red-400 mb-4">Invalid agent address</p>
            <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Back to Agents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="border border-red-500/30 bg-red-500/5 p-12 text-center">
            <p className="text-red-400 mb-4">Error loading agent: {error}</p>
            <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">
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

  if (!agentMetadata || !vaultState) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="border border-white/10 p-12 text-center">
            <p className="text-white/60 mb-4">Agent not found</p>
            <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Back to Agents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const sharePrice = totalShares > 0 ? totalAssets / totalShares : 1;
  const revenueHistory: { date: string; revenue: number }[] = [];

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-10 border-b border-white/10 pb-6">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors uppercase tracking-widest font-mono">
              <span>←</span>
              <span>BACK</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  !vaultState.paused ? 'bg-emerald-400' : 'bg-amber-400'
                )} />
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold font-mono",
                  !vaultState.paused ? 'text-emerald-400' : 'text-amber-400'
                )}>
                  {vaultState.paused ? 'PAUSED' : 'LIVE'}
                </span>
              </div>
              <div className="text-white/20">|</div>
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-mono">ON-CHAIN</span>
            </div>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">{agentMetadata.name}</h1>
            <CopyButton value={agentMetadata.agentWallet.toString()} />
          </div>
          <div className="space-y-2 text-sm text-white/60">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-white/40 w-20 font-mono">GitHub</span>
              <a
                href={`https://github.com/${agentMetadata.githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-mono"
              >
                @{agentMetadata.githubHandle}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-white/40 w-20 font-mono">Endpoint</span>
              <a
                href={agentMetadata.endpointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 transition-colors font-mono text-xs"
              >
                {agentMetadata.endpointUrl}
              </a>
            </div>
          </div>
        </div>

        <div className="mb-8 border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold font-mono">VAULT METRICS</span>
            </div>
            <span className="text-[9px] text-white/20 font-mono">SHARES = PROPORTIONAL CLAIM ON NET VAULT ASSETS</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-white/10">
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">TVL</div>
              <div className="text-lg font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(totalAssets)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">SHARES</div>
              <div className="text-lg font-bold text-violet-400 font-mono tabular-nums">{formatShares(totalShares)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">PRICE</div>
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">${formatUSDC(sharePrice)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">REVENUE</div>
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">${formatUSDC(vaultState.totalRevenue / 1_000_000)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">BOND</div>
              <div className="text-lg font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(vaultState.operatorBond / 1_000_000)}</div>
            </div>
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">JOBS</div>
              <div className="text-lg font-bold text-cyan-400 font-mono tabular-nums">{vaultState.totalJobs.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[10px] text-white/25 font-mono leading-relaxed">
            PRICE reflects NAV per share: (vault USDC balance) / (shares outstanding). Revenue from x402 jobs increases the vault balance without minting new shares, so PRICE rises. Deposits mint shares at current NAV, preserving PRICE for existing holders. BOND is the operator&apos;s slashable collateral -- first-loss protection for depositors.
          </p>
        </div>

        {revenueHistory.length > 0 && (
          <div className="mb-12">
            <RevenueChart data={revenueHistory} />
          </div>
        )}

        <div className="mb-12">
          <InvestWithdrawForm
            vaultPubkey={vaultPubkey}
            shareMint={vaultState.shareMint}
            sharePrice={sharePrice}
          />
        </div>

        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 mb-6 font-mono">JOB RECEIPTS</h2>
          <ReceiptTable receipts={receipts} />
        </div>
      </div>
    </main>
  );
}
