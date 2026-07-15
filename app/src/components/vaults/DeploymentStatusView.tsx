'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import StatusBadge from './StatusBadge';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { LastUpdated, RefreshButton } from '@/components/dashboard/Freshness';
import { useEventStream, type StreamEvent } from '@/lib/use-event-stream';
import { requeueVault } from '@/lib/vault-requeue';
import {
  BASESCAN_URL,
  COMPONENT_LABELS,
  PROGRESS_STEPS,
  statusLabel,
  TERMINAL_STATUSES,
  type DeploymentRecord,
} from '@/lib/vault-types';

// Slow safety net only — the SSE stream drives the real-time updates now.
const POLL_MS = 30_000;

export default function DeploymentStatusView({ id }: { id: string }) {
  const toast = useToast();
  const [record, setRecord] = useState<DeploymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requeuing, setRequeuing] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  // Bumping this restarts the safety poll (e.g. after a re-run sends the record
  // back through queued -> ...).
  const [pollNonce, setPollNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One fetch of the record. Returns how the poll loop should proceed:
  // 'terminal'/'stop' end the loop; 'active'/'error' keep it going.
  const refetch = useCallback(async (): Promise<'terminal' | 'active' | 'stop' | 'error'> => {
    try {
      const res = await fetch(`/api/vaults/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? `Request failed (${res.status})`);
        // Auth / not-found are permanent for this session.
        if (res.status === 404 || res.status === 401 || res.status === 403) return 'stop';
        return 'error';
      }
      if (body) {
        setError(null);
        setRecord(body as DeploymentRecord);
        setUpdatedAt(Date.now());
        return TERMINAL_STATUSES.includes((body as DeploymentRecord).status) ? 'terminal' : 'active';
      }
      return 'error';
    } catch {
      setError('Network error while polling; retrying…');
      return 'error';
    }
  }, [id]);

  // Slow safety poll. The stream (below) does the real-time work; this only
  // catches a missed event. It stops once the deployment reaches a terminal
  // state (or a permanent error) and restarts when pollNonce changes.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const result = await refetch();
      if (stopped) return;
      if (result === 'terminal' || result === 'stop') return;
      timer.current = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refetch, pollNonce]);

  // Live stream: refetch instantly when an event targets THIS deployment, so the
  // stepper advances the moment the backend reports progress.
  useEventStream(
    useCallback(
      (evt: StreamEvent) => {
        if (evt.type === 'deployment' && evt.deploymentId === id) {
          void refetch();
        }
      },
      [id, refetch],
    ),
  );

  const manualRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const rerun = useCallback(
    async (force: boolean) => {
      setRequeuing(true);
      const result = await requeueVault(id, force);
      setRequeuing(false);
      if (result.ok) {
        setForceOpen(false);
        toast('Re-running deployment — same vault, no new quota used', 'success');
        setError(null);
        // The record goes back through queued → … ; restart the safety poll
        // (the stream also pushes the new progress live).
        setPollNonce((n) => n + 1);
        return;
      }
      if (result.needsForce) {
        setForceOpen(true);
        return;
      }
      setForceOpen(false);
      toast(result.error, 'error');
    },
    [id, toast],
  );

  if (!record) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-white p-8 shadow-soft">
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <p className="text-sm text-zinc-500">Loading deployment…</p>
        )}
      </div>
    );
  }

  const failed = record.status === 'failed';
  const activeIndex = failed ? -1 : PROGRESS_STEPS.indexOf(record.status);

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">{record.vaultName}</h1>
            <p className="mt-1 font-data text-xs text-zinc-400">
              {record.vaultSymbol} · Base ({record.chainId}) · {record.id}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={record.status} />
            <span className="flex items-center gap-1">
              <LastUpdated since={updatedAt} />
              <RefreshButton onClick={manualRefresh} spinning={refreshing} />
            </span>
          </div>
        </div>

        <ol className="mt-8 space-y-0">
          {PROGRESS_STEPS.map((step, i) => {
            const done = !failed && activeIndex > i;
            const active = !failed && activeIndex === i && record.status !== 'complete';
            const completed = record.status === 'complete' && step === 'complete';
            const isLast = i === PROGRESS_STEPS.length - 1;
            return (
              <li key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={clsx(
                      'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-mono',
                      (done || completed) && 'border-emerald-600 bg-emerald-600 text-white',
                      active && 'border-blue-500 text-blue-600 status-pulse',
                      !done && !active && !completed && 'border-black/[0.12] text-zinc-300',
                    )}
                  >
                    {done || completed ? '✓' : i + 1}
                  </div>
                  {!isLast && (
                    <div className={clsx('min-h-5 w-px flex-1', done ? 'bg-emerald-600/40' : 'bg-black/[0.08]')} />
                  )}
                </div>
                <div className="pb-5">
                  <p
                    className={clsx(
                      'text-xs font-medium uppercase leading-6 tracking-wider-2',
                      (done || completed) && 'text-emerald-700',
                      active && 'text-blue-600',
                      !done && !active && !completed && 'text-zinc-400',
                    )}
                  >
                    {statusLabel(step)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {failed && (
          <div className="mt-4 rounded-lg border border-red-600/20 bg-red-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider-2 text-red-700">Deployment Failed</p>
            <p className="mt-2 whitespace-pre-wrap break-all font-data text-sm text-red-600">
              {record.failureReason ?? 'No failure reason reported.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={requeuing}
                onClick={() => rerun(false)}
                className="bh-btn-primary rounded-lg px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2"
              >
                {requeuing ? 'Re-running…' : '↻ Re-run deployment'}
              </button>
              <span className="text-xs text-zinc-500">
                Retries this same vault — it won&apos;t create a new one or use another quota slot.
              </span>
            </div>
          </div>
        )}
      </div>

      {record.status === 'complete' && record.addresses && (
        <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
          <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Deployed Components</h2>
          <div className="mt-4 divide-y divide-black/[0.05]">
            {Object.entries(record.addresses).map(([key, address]) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-4 py-3">
                <span className="text-sm text-zinc-700">{COMPONENT_LABELS[key] ?? key}</span>
                <a
                  href={`${BASESCAN_URL}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-data text-xs text-emerald-700 hover:text-emerald-800"
                >
                  {address} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.transactionHashes.length > 0 && (
        <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
          <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Transactions</h2>
          <div className="mt-4 space-y-2">
            {record.transactionHashes.map((hash) => (
              <a
                key={hash}
                href={`${BASESCAN_URL}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all font-data text-xs text-zinc-500 hover:text-emerald-700"
              >
                {hash} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {error && record && <p className="text-xs text-amber-600">{error}</p>}

      <p className="text-[11px] text-zinc-400">
        Type: Veda ·{' '}
        <a
          href="https://github.com/Veda-Labs/boring-vault/tree/bdc38405a02366cb5b25b358aa8e4a0b5ee3ae77"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 underline underline-offset-2 hover:text-emerald-700"
        >
          codebase ↗
        </a>
      </p>

      <Modal
        open={forceOpen}
        onClose={() => setForceOpen(false)}
        title="Retry this deployment?"
        description="The backend didn't accept a plain re-run for this vault (it may already be queued or in progress). Retrying with force restarts the SAME vault — it won't create a new one or use another quota slot."
      >
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setForceOpen(false)}
            className="text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={requeuing}
            onClick={() => rerun(true)}
            className="bh-btn-primary rounded-lg px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2"
          >
            {requeuing ? 'Retrying…' : 'Retry with force'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
