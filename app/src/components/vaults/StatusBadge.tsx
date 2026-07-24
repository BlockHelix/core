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
    ? 'border-[#10c689]/25 bg-[#eafaf3] text-[#10c689]'
    : failed
      ? 'border-[#b82214]/25 bg-[#fdeeeb] text-[#9a1c10]'
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
