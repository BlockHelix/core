'use client';

import { ExternalLink } from 'lucide-react';
import { MockJobReceipt } from '@/lib/mock';
import { formatUSDC, truncateAddress, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ReceiptTableProps {
  receipts: MockJobReceipt[];
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
            {receipts.map((receipt, index) => (
              <tr
                key={receipt.id}
                className={cn(
                  'border-b border-helix-border last:border-b-0',
                  index % 2 === 0 ? 'bg-helix-card' : 'bg-helix-elevated'
                )}
              >
                <td className="px-6 py-4 text-sm text-helix-primary">{receipt.jobType}</td>
                <td className="px-6 py-4 text-sm text-right font-data text-helix-green">
                  ${formatUSDC(receipt.revenue)}
                </td>
                <td className="px-6 py-4 text-sm text-helix-secondary">{timeAgo(receipt.timestamp)}</td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={cn(
                      'inline-block px-2.5 py-1 rounded text-xs font-medium',
                      receipt.status === 'completed' && 'bg-helix-green/10 text-helix-green',
                      receipt.status === 'pending' && 'bg-helix-amber/10 text-helix-amber',
                      receipt.status === 'failed' && 'bg-helix-red/10 text-helix-red'
                    )}
                  >
                    {receipt.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <a
                    href={`https://explorer.solana.com/tx/${receipt.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-data text-xs text-helix-cyan hover:text-helix-violet transition-colors"
                  >
                    {truncateAddress(receipt.txSignature, 4)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
