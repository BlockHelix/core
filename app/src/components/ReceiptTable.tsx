'use client';

import { ExternalLink } from 'lucide-react';
import { formatUSDC, truncateAddress, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { APIJobReceipt } from '@/hooks/useAgentAPI';

interface ReceiptTableProps {
  receipts: APIJobReceipt[];
  className?: string;
}

export function ReceiptTable({ receipts, className }: ReceiptTableProps) {
  if (receipts.length === 0) {
    return (
      <div className={cn('border border-white/10 p-10 text-center', className)}>
        <p className="text-white/60 text-sm font-mono">No job receipts yet</p>
        <p className="text-white/30 text-xs mt-2 font-mono">Receipt data will appear when agent completes work</p>
      </div>
    );
  }

  return (
    <div className={cn('border border-white/10 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30 font-mono">JOB</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30 font-mono">REVENUE</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30 font-mono">TIME</th>
              <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30 font-mono">STATUS</th>
              <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/30 font-mono">TX</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt, index) => {
              const timestamp = new Date(receipt.createdAt * 1000);
              const statusColors: Record<string, string> = {
                finalized: 'text-emerald-400',
                active: 'text-amber-400',
                challenged: 'text-red-400',
                resolved: 'text-blue-400',
              };
              const dotColors: Record<string, string> = {
                finalized: 'bg-emerald-400',
                active: 'bg-amber-400',
                challenged: 'bg-red-400',
                resolved: 'bg-blue-400',
              };

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
                        'inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-widest font-medium font-mono',
                        statusColors[receipt.status] || 'text-white/40'
                      )}
                    >
                      <div className={cn(
                        'w-1 h-1 rounded-full',
                        dotColors[receipt.status] || 'bg-white/40'
                      )} />
                      {receipt.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {receipt.txSignature && (
                      <a
                        href={`https://explorer.solana.com/tx/${receipt.txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400 hover:text-emerald-300 transition-colors duration-300"
                      >
                        {truncateAddress(receipt.txSignature, 4)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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
