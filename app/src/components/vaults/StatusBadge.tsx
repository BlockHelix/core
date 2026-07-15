import { clsx } from 'clsx';
import type { DeploymentStatus } from '@/lib/vault-types';
import { statusLabel } from '@/lib/vault-types';

// Groups every deployment status into one of four visual states:
// queued → amber, in-progress → blue, complete → emerald, failed → red.
export default function StatusBadge({ status }: { status: DeploymentStatus }) {
  const complete = status === 'complete';
  const failed = status === 'failed';
  const queued = status === 'queued';
  const inFlight = !complete && !failed && !queued;

  const style = complete
    ? 'border-emerald-600/25 bg-emerald-50 text-emerald-700'
    : failed
      ? 'border-red-600/25 bg-red-50 text-red-700'
      : queued
        ? 'border-amber-500/30 bg-amber-50 text-amber-700'
        : 'border-blue-500/25 bg-blue-50 text-blue-700';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider-2',
        style,
      )}
    >
      {inFlight && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 status-pulse" />}
      {queued && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
      {complete && <span aria-hidden>✓</span>}
      {failed && <span aria-hidden>✕</span>}
      {statusLabel(status)}
    </span>
  );
}
