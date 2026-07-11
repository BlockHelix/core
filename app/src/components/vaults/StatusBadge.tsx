import { clsx } from 'clsx';
import type { DeploymentStatus } from '@/lib/vault-types';
import { statusLabel } from '@/lib/vault-types';

export default function StatusBadge({ status }: { status: DeploymentStatus }) {
  const styles: Record<string, string> = {
    complete: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
    failed: 'text-red-400 border-red-400/40 bg-red-400/10',
  };
  const inFlight = status !== 'complete' && status !== 'failed';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 px-2.5 py-1 border text-[11px] uppercase tracking-wider-2 font-medium',
        styles[status] ?? 'text-cyan-300 border-cyan-300/40 bg-cyan-300/10',
      )}
    >
      {inFlight && <span className="w-1.5 h-1.5 bg-cyan-300 status-pulse" />}
      {status === 'complete' && <span className="text-emerald-400">✓</span>}
      {status === 'failed' && <span className="text-red-400">✕</span>}
      {statusLabel(status)}
    </span>
  );
}
