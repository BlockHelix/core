'use client';

import { useCallback, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import StatusBadge from './StatusBadge';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { LastUpdated, RefreshButton } from '@/components/dashboard/Freshness';
import { timeAgo } from '@/lib/format';
import { fetcher } from '@/lib/swr-fetcher';
import { useEventStream, type StreamEvent } from '@/lib/use-event-stream';
import { useUpdatedAt } from '@/lib/use-updated-at';
import { requeueVault } from '@/lib/vault-requeue';
import { TERMINAL_STATUSES, type DeploymentRecord, type DeploymentStatus, type VaultListResponse } from '@/lib/vault-types';

const GRID = 'sm:grid-cols-[1.6fr_0.9fr_0.9fr_auto]';

export default function VaultList() {
  const router = useRouter();
  const toast = useToast();
  // SWR keeps the last result in an in-memory cache, so switching back to this
  // tab renders instantly from cache and revalidates in the background.
  const { data, error, mutate, isValidating } = useSWR<VaultListResponse>('/api/vaults', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
  const { mutate: globalMutate } = useSWRConfig();
  const [requeuingId, setRequeuingId] = useState<string | null>(null);
  const [forceTarget, setForceTarget] = useState<DeploymentRecord | null>(null);
  const updatedAt = useUpdatedAt(data);

  // Live stream: any deployment event refreshes the list so a vault ticking
  // queued -> ... -> complete updates without a poll or navigation. Terminal
  // events also refresh the quota meter, since a completed vault consumes a slot.
  useEventStream(
    useCallback(
      (evt: StreamEvent) => {
        if (evt.type !== 'deployment') return;
        void mutate();
        if (evt.status && TERMINAL_STATUSES.includes(evt.status as DeploymentStatus)) {
          void globalMutate('/api/account/usage');
        }
      },
      [mutate, globalMutate],
    ),
  );

  const rerun = useCallback(
    async (d: DeploymentRecord, force: boolean) => {
      setRequeuingId(d.id);
      const result = await requeueVault(d.id, force);
      setRequeuingId(null);
      if (result.ok) {
        setForceTarget(null);
        toast('Re-running deployment — same vault, no new quota used', 'success');
        void mutate();
        router.push(`/dashboard/vaults/${d.id}`);
        return;
      }
      if (result.needsForce) {
        setForceTarget(d);
        return;
      }
      setForceTarget(null);
      toast(result.error, 'error');
    },
    [mutate, router, toast],
  );

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-600/20 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error.message}
      </div>
    );
  }
  if (!data) {
    return <TableSkeleton />;
  }

  const quotaReached = data.quota.used >= data.quota.limit;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-[11px] uppercase tracking-wider-2 text-zinc-500">
            {data.quota.used} of {data.quota.limit} free vault{data.quota.limit === 1 ? '' : 's'} used
          </p>
          <span className="flex items-center gap-1">
            <LastUpdated since={updatedAt} />
            <RefreshButton onClick={() => void mutate()} spinning={isValidating} />
          </span>
        </div>
        {quotaReached ? (
          <span className="rounded-lg border border-black/[0.08] px-4 py-2 text-[11px] uppercase tracking-wider-2 text-zinc-400">
            Free vault used
          </span>
        ) : (
          <Link
            href="/dashboard/new-vault"
            className="bh-btn-primary rounded-lg px-4 py-2 text-[11px] font-medium uppercase tracking-wider-2"
          >
            + New Vault
          </Link>
        )}
      </div>

      {data.deployments.length === 0 ? (
        <EmptyState quotaReached={quotaReached} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-soft">
          <div className={clsx('hidden gap-4 border-b border-black/[0.06] bg-[#f7f7f8] px-5 py-3 sm:grid', GRID)}>
            {['Vault', 'Status', 'Created', ''].map((h, i) => (
              <span
                key={i}
                className={clsx('text-[11px] uppercase tracking-wider-2 text-zinc-400', i === 3 && 'text-right')}
              >
                {h}
              </span>
            ))}
          </div>
          <ul>
            {data.deployments.map((d) => (
              <VaultRow
                key={d.id}
                d={d}
                requeuing={requeuingId === d.id}
                onRerun={() => rerun(d, false)}
                onOpen={() => router.push(`/dashboard/vaults/${d.id}`)}
              />
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={!!forceTarget}
        onClose={() => setForceTarget(null)}
        title="Retry this deployment?"
        description="The backend didn't accept a plain re-run for this vault (it may already be queued or in progress). Retrying with force restarts the SAME vault — it won't create a new one or use another quota slot."
      >
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setForceTarget(null)}
            className="text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!!requeuingId}
            onClick={() => forceTarget && rerun(forceTarget, true)}
            className="bh-btn-primary rounded-lg px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2"
          >
            {requeuingId ? 'Retrying…' : 'Retry with force'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function VaultRow({
  d,
  requeuing,
  onRerun,
  onOpen,
}: {
  d: DeploymentRecord;
  requeuing: boolean;
  onRerun: () => void;
  onOpen: () => void;
}) {
  const label = 'text-[10px] uppercase tracking-wider-2 text-zinc-400 sm:hidden';
  const failed = d.status === 'failed';

  return (
    <li
      onClick={onOpen}
      className={clsx(
        'grid cursor-pointer grid-cols-1 gap-3 border-b border-black/[0.05] px-5 py-4 transition-colors last:border-b-0 hover:bg-black/[0.015] sm:items-center sm:gap-4',
        GRID,
      )}
    >
      <div className="min-w-0">
        <span className={label}>Vault</span>
        <p className="truncate text-sm font-medium text-zinc-900">{d.vaultName}</p>
        <p className="mt-0.5 truncate font-data text-xs text-zinc-400">
          {d.vaultSymbol} · Base ({d.chainId})
        </p>
      </div>
      <div>
        <span className={label}>Status</span>
        <StatusBadge status={d.status} />
      </div>
      <div>
        <span className={label}>Created</span>
        <p className="text-xs text-zinc-500">{d.createdAt ? timeAgo(d.createdAt) : '—'}</p>
      </div>
      <div className="mt-1 flex items-center gap-4 sm:mt-0 sm:justify-end">
        {failed && (
          <button
            type="button"
            disabled={requeuing}
            onClick={(e) => {
              e.stopPropagation();
              onRerun();
            }}
            className="text-[11px] font-medium uppercase tracking-wider-2 text-emerald-700 transition-colors hover:text-emerald-800 disabled:opacity-50"
            title="Retry the same vault — doesn't use another quota slot"
          >
            {requeuing ? 'Re-running…' : '↻ Re-run'}
          </button>
        )}
        <Link
          href={`/dashboard/vaults/${d.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
        >
          View →
        </Link>
      </div>
    </li>
  );
}

function EmptyState({ quotaReached }: { quotaReached: boolean }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-12 text-center shadow-soft">
      <p className="text-sm text-zinc-500">No deployments yet</p>
      {!quotaReached && (
        <Link
          href="/dashboard/new-vault"
          className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          Deploy your first vault →
        </Link>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="h-4 w-40 skeleton" />
        <div className="h-8 w-28 skeleton rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-soft">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-black/[0.05] px-5 py-4 last:border-b-0">
            <div className="h-4 flex-1 skeleton" />
            <div className="hidden h-5 w-20 skeleton sm:block" />
            <div className="hidden h-4 w-16 skeleton sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
