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
    <main className="min-h-screen py-32 lg:py-48">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-16 border-b border-white/10 pb-8">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors">
              <span>←</span>
              <span className="uppercase tracking-widest">BACK</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  !vaultState.paused ? 'bg-emerald-400 status-pulse' : 'bg-amber-400'
                )} />
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold",
                  !vaultState.paused ? 'text-emerald-400' : 'text-amber-400'
                )}>
                  {vaultState.paused ? 'PAUSED' : 'LIVE'}
                </span>
              </div>
              <div className="text-white/20">|</div>
              <span className="text-[10px] uppercase tracking-widest text-white/30">ON-CHAIN</span>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-4">{agentMetadata.name}</h1>
            <CopyButton value={agentMetadata.agentWallet.toString()} />
          </div>
          <div className="space-y-4 text-lg text-white/60">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider-2 text-white/40 w-24">GitHub</span>
              <a
                href={`https://github.com/${agentMetadata.githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                @{agentMetadata.githubHandle}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider-2 text-white/40 w-24">Endpoint</span>
              <a
                href={agentMetadata.endpointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 transition-colors font-mono text-sm"
              >
                {agentMetadata.endpointUrl}
              </a>
            </div>
          </div>
        </div>

        <div className="mb-12 border border-white/10 corner-cut overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">VAULT METRICS</span>
            </div>
            <span className="text-[10px] text-white/20 font-mono">SHARES = PROPORTIONAL CLAIM ON NET VAULT ASSETS</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-white/10">
            <div className="px-6 py-6">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">TVL</div>
              <div className="text-2xl font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(totalAssets)}</div>
            </div>
            <div className="px-6 py-6">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">SHARES</div>
              <div className="text-2xl font-bold text-violet-400 font-mono tabular-nums">{formatShares(totalShares)}</div>
            </div>
            <div className="px-6 py-6">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">PRICE</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">${formatUSDC(sharePrice)}</div>
            </div>
            <div className="px-6 py-6">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">REVENUE</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">${formatUSDC(vaultState.totalRevenue / 1_000_000)}</div>
            </div>
            <div className="px-6 py-6">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">BOND</div>
              <div className="text-2xl font-bold text-violet-400 font-mono tabular-nums">${formatUSDC(vaultState.operatorBond / 1_000_000)}</div>
            </div>
            <div className="px-6 py-6">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">JOBS</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono tabular-nums">{vaultState.totalJobs.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="mb-12 px-1">
          <p className="text-[11px] text-white/25 font-mono leading-relaxed">
            PRICE reflects NAV per share: (vault USDC balance) / (shares outstanding). Revenue from x402 jobs increases the vault balance without minting new shares, so PRICE rises. Deposits mint shares at current NAV, preserving PRICE for existing holders. BOND is the operator&apos;s slashable collateral -- first-loss protection for depositors.
          </p>
        </div>

        {revenueHistory.length > 0 && (
          <div className="mb-20">
            <RevenueChart data={revenueHistory} />
          </div>
        )}

        <div className="mb-20">
          <InvestWithdrawForm
            vaultPubkey={vaultPubkey}
            shareMint={vaultState.shareMint}
            sharePrice={sharePrice}
          />
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-wider-2 text-white/40 mb-8">JOB RECEIPTS</h2>
          <ReceiptTable receipts={receipts} />
        </div>
      </div>
    </main>
  );
}
