import { notFound } from 'next/navigation';
import { getMockAgentById, getMockJobReceipts, getMockRevenueHistory } from '@/lib/mock';
import { formatUSDC, formatShares, formatPercent } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import { RevenueChart } from '@/components/RevenueChart';
import { ReceiptTable } from '@/components/ReceiptTable';
import { InvestWithdrawForm } from '@/components/InvestWithdrawForm';
import { cn } from '@/lib/cn';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetail({ params }: PageProps) {
  const { id } = await params;
  const agent = getMockAgentById(id);

  if (!agent) {
    notFound();
  }

  const receipts = getMockJobReceipts(id);
  const revenueHistory = getMockRevenueHistory(id);
  const sharePrice = agent.totalShares > 0 ? agent.tvl / agent.totalShares : 1;

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-data text-helix-primary mb-3">{agent.name}</h1>
              <div className="flex items-center gap-3 mb-4">
                <CopyButton value={agent.authority} />
                <span
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium',
                    agent.status === 'active' && 'bg-helix-green/10 text-helix-green',
                    agent.status === 'paused' && 'bg-helix-amber/10 text-helix-amber',
                    agent.status === 'inactive' && 'bg-helix-red/10 text-helix-red'
                  )}
                >
                  {agent.status}
                </span>
              </div>
            </div>
          </div>
          <p className="text-helix-secondary text-base leading-relaxed max-w-3xl">{agent.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Total Value Locked</div>
            <div className="text-3xl font-data text-helix-cyan">${formatUSDC(agent.tvl)}</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Total Shares</div>
            <div className="text-3xl font-data text-helix-primary">{formatShares(agent.totalShares)}</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Share Price</div>
            <div className="text-3xl font-data text-helix-violet">${formatUSDC(sharePrice)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Total Revenue</div>
            <div className="text-3xl font-data text-helix-green">${formatUSDC(agent.totalRevenue)}</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">APY</div>
            <div className="text-3xl font-data text-helix-green">{formatPercent(agent.apy)}%</div>
          </div>
          <div className="bg-helix-card border border-helix-border rounded-lg p-6">
            <div className="text-sm text-helix-secondary mb-2">Jobs Completed</div>
            <div className="text-3xl font-data text-helix-primary">{agent.jobsCompleted.toLocaleString()}</div>
          </div>
        </div>

        <div className="mb-12">
          <RevenueChart data={revenueHistory} />
        </div>

        <div className="mb-12">
          <InvestWithdrawForm agentId={agent.id} sharePrice={sharePrice} />
        </div>

        <div>
          <h2 className="text-2xl font-data text-helix-primary mb-6">Job Receipts</h2>
          <ReceiptTable receipts={receipts} />
        </div>
      </div>
    </main>
  );
}
