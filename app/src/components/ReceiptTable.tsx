'use client';

import { ExternalLink } from 'lucide-react';
import { formatUSDC, truncateAddress, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { JobReceipt } from '@/hooks/useAgentData';

interface ReceiptTableProps {
  receipts: JobReceipt[];
  className?: string;
}

export function ReceiptTable({ receipts, className }: ReceiptTableProps) {
  if (receipts.length === 0) {
    return (
      <div className={cn('bg-helix-card border border-helix-border rounded-lg p-12 text-center', className)}>
        <p className="text-helix-secondary">No job receipts yet</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-helix-card border border-helix-border rounded-lg overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-helix-border">
              <th className="text-left px-6 py-4 text-sm font-medium text-helix-secondary">Job Type</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-helix-secondary">Revenue</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-helix-secondary">Time</th>
              <th className="text-center px-6 py-4 text-sm font-medium text-helix-secondary">Status</th>
              <th className="text-center px-6 py-4 text-sm font-medium text-helix-secondary">TX</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt, index) => {
              const timestamp = new Date(receipt.createdAt * 1000);
              const statusText = typeof receipt.status === 'object'
                ? (receipt.status.finalized !== undefined ? 'completed' : 'active')
                : 'active';
              const txHash = receipt.paymentTx && receipt.paymentTx.length > 0
                ? Buffer.from(receipt.paymentTx).toString('hex').slice(0, 64)
                : receipt.registry.toString();

              return (
                <tr
                  key={receipt.jobId}
                  className={cn(
                    'border-b border-helix-border last:border-b-0',
                    index % 2 === 0 ? 'bg-helix-card' : 'bg-helix-elevated'
                  )}
                >
                  <td className="px-6 py-4 text-sm text-helix-primary">Job #{receipt.jobId}</td>
                  <td className="px-6 py-4 text-sm text-right font-data text-helix-green">
                    ${formatUSDC(receipt.paymentAmount / 1_000_000)}
                  </td>
                  <td className="px-6 py-4 text-sm text-helix-secondary">{timeAgo(timestamp)}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={cn(
                        'inline-block px-2.5 py-1 rounded text-xs font-medium',
                        statusText === 'completed' && 'bg-helix-green/10 text-helix-green',
                        statusText === 'active' && 'bg-helix-amber/10 text-helix-amber'
                      )}
                    >
                      {statusText}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a
                      href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-data text-xs text-helix-cyan hover:text-helix-violet transition-colors"
                    >
                      {truncateAddress(txHash, 4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
