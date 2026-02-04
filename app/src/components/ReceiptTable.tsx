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
      <div className={cn('border border-white/10 p-12 text-center corner-cut', className)}>
        <p className="text-white/60 text-sm">No job receipts yet</p>
        <p className="text-white/30 text-xs mt-2">Receipt data will appear when agent completes work</p>
      </div>
    );
  }

  return (
    <div className={cn('border border-white/10 overflow-hidden corner-cut', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30">JOB</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30">REVENUE</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30">TIME</th>
              <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30">STATUS</th>
              <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30">TX</th>
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
                    'border-b border-white/10 last:border-b-0 transition-colors duration-300',
                    index % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent',
                    'hover:bg-white/[0.03]'
                  )}
                >
                  <td className="px-4 py-3 text-sm text-white font-mono">#{receipt.jobId}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono tabular-nums text-emerald-400">
                    ${formatUSDC(receipt.paymentAmount / 1_000_000)}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50 font-mono">{timeAgo(timestamp)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-widest font-medium',
                        statusText === 'completed' && 'text-emerald-400',
                        statusText === 'active' && 'text-amber-400'
                      )}
                    >
                      <div className={cn(
                        'w-1 h-1 rounded-full',
                        statusText === 'completed' && 'bg-emerald-400',
                        statusText === 'active' && 'bg-amber-400 status-pulse'
                      )} />
                      {statusText}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <a
                      href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400 hover:text-emerald-300 transition-colors duration-300"
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
