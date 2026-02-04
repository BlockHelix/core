'use client';

import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { PublicKey } from '@solana/web3.js';
import { formatUSDC, formatShares, formatPercent } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import { RevenueChart } from '@/components/RevenueChart';
import { ReceiptTable } from '@/components/ReceiptTable';
import { InvestWithdrawForm } from '@/components/InvestWithdrawForm';
import { cn } from '@/lib/cn';
import { useAgentDetails, useJobReceipts } from '@/hooks/useAgentData';
import { findVaultState, findRegistryState } from '@/lib/pda';

export default function AgentDetail() {
  const params = useParams();
  const agentWalletStr = params.id as string;

  let agentWallet: PublicKey | null = null;
  let isValidAddress = true;
  try {
    agentWallet = new PublicKey(agentWalletStr);
  } catch (err) {
    isValidAddress = false;
  }

  const { agentMetadata, vaultState, registryState, totalAssets, totalShares, isLoading, error } = useAgentDetails(agentWallet);

  const vaultPubkey = agentWallet ? findVaultState(agentWallet)[0] : null;
  const registryPubkey = vaultPubkey ? findRegistryState(vaultPubkey)[0] : null;

  const { receipts } = useJobReceipts(registryPubkey);

  if (!isValidAddress) {
    return notFound();
  }

  if (error) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="bg-helix-card border border-helix-border rounded-lg p-12 text-center">
            <p className="text-helix-red mb-4">Error loading agent: {error}</p>
            <Link href="/" className="text-helix-cyan hover:underline">
              Back to Agents
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-helix-card rounded w-1/2"></div>
            <div className="h-6 bg-helix-card rounded w-3/4"></div>
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-helix-card rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!agentMetadata || !vaultState) {
    return notFound();
  }

  const sharePrice = totalShares > 0 ? totalAssets / totalShares : 1;
  const revenueHistory: { date: string; revenue: number }[] = [];

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-data text-helix-primary mb-3">{agentMetadata.name}</h1>
              <div className="flex items-center gap-3 mb-4">
                <CopyButton value={agentMetadata.agentWallet.toString()} />
                <span
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium',
                    !vaultState.paused && 'bg-helix-green/10 text-helix-green',
                    vaultState.paused && 'bg-helix-amber/10 text-helix-amber'
                  )}
                >
                  {vaultState.paused ? 'paused' : 'active'}
                </span>
                <span className="px-3 py-1 rounded text-xs font-medium bg-helix-cyan/10 text-helix-cyan">
                  On-chain
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-helix-secondary text-sm">
            <div>
              <span className="text-helix-tertiary">GitHub:</span>{' '}
              <a
                href={`https://github.com/${agentMetadata.githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-helix-cyan hover:underline"
              >
                @{agentMetadata.githubHandle}
              </a>
            </div>
            <div>
              <span className="text-helix-tertiary">Endpoint:</span>{' '}
              <a
                href={agentMetadata.endpointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-helix-cyan hover:underline font-data text-xs"
              >
                {agentMetadata.endpointUrl}
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Total Value Locked</div>
            <div className="text-3xl font-data text-helix-cyan">${formatUSDC(totalAssets)}</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Total Shares</div>
            <div className="text-3xl font-data text-helix-primary">{formatShares(totalShares)}</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Share Price</div>
            <div className="text-3xl font-data text-helix-violet">${formatUSDC(sharePrice)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Total Revenue</div>
            <div className="text-3xl font-data text-helix-green">${formatUSDC(vaultState.totalRevenue / 1_000_000)}</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Operator Bond</div>
            <div className="text-3xl font-data text-helix-amber">${formatUSDC(vaultState.operatorBond / 1_000_000)}</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Jobs Completed</div>
            <div className="text-3xl font-data text-helix-primary">{vaultState.totalJobs.toLocaleString()}</div>
          </div>
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
          <h2 className="text-2xl font-data text-helix-primary mb-6">Job Receipts</h2>
          <ReceiptTable receipts={receipts} />
        </div>
      </div>
    </main>
  );
}
