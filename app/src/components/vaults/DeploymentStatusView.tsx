'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import StatusBadge from './StatusBadge';
import {
  BASESCAN_URL,
  COMPONENT_LABELS,
  PROGRESS_STEPS,
  statusLabel,
  TERMINAL_STATUSES,
  type DeploymentRecord,
} from '@/lib/vault-types';

const POLL_MS = 5000;

export default function DeploymentStatusView({ id }: { id: string }) {
  const [record, setRecord] = useState<DeploymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/vaults/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? `Request failed (${res.status})`);
        if (res.status === 404 || res.status === 401 || res.status === 403) return;
      } else if (body) {
        setError(null);
        setRecord(body as DeploymentRecord);
        if (TERMINAL_STATUSES.includes((body as DeploymentRecord).status)) return;
      }
    } catch {
      setError('Network error while polling; retrying…');
    }
    timer.current = setTimeout(poll, POLL_MS);
  }, [id]);

  useEffect(() => {
    poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  if (!record) {
    return (
      <div className="border border-white/10 p-8">
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <p className="text-sm text-white/50">Loading deployment…</p>
        )}
      </div>
    );
  }

  const failed = record.status === 'failed';
  // On failure the record keeps its last in-flight stage? No — status becomes
  // 'failed'; we mark every non-complete step as inactive and show the reason.
  const activeIndex = failed ? -1 : PROGRESS_STEPS.indexOf(record.status);

  return (
    <div className="space-y-8">
      <div className="border border-white/10 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-medium text-white">{record.vaultName}</h1>
            <p className="mt-1 text-xs text-white/50 font-data">
              {record.vaultSymbol} · Base ({record.chainId}) · {record.id}
            </p>
          </div>
          <StatusBadge status={record.status} />
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
                      'w-6 h-6 flex items-center justify-center border text-[10px] font-mono',
                      (done || completed) && 'border-emerald-400 bg-emerald-400 text-black',
                      active && 'border-cyan-300 text-cyan-300 status-pulse',
                      !done && !active && !completed && 'border-white/15 text-white/30',
                    )}
                  >
                    {done || completed ? '✓' : i + 1}
                  </div>
                  {!isLast && (
                    <div className={clsx('w-px flex-1 min-h-5', done ? 'bg-emerald-400/50' : 'bg-white/10')} />
                  )}
                </div>
                <div className="pb-5">
                  <p
                    className={clsx(
                      'text-xs uppercase tracking-wider-2 font-medium leading-6',
                      (done || completed) && 'text-emerald-400',
                      active && 'text-cyan-300',
                      !done && !active && !completed && 'text-white/40',
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
          <div className="mt-4 border border-red-400/40 bg-red-400/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider-2 font-medium text-red-400">Deployment Failed</p>
            <p className="mt-2 text-sm text-red-300/90 font-data break-all whitespace-pre-wrap">
              {record.failureReason ?? 'No failure reason reported.'}
            </p>
          </div>
        )}
      </div>

      {record.status === 'complete' && record.addresses && (
        <div className="border border-white/10 p-6 md:p-8">
          <h2 className="text-[11px] uppercase tracking-wider-2 font-medium text-white/50">Deployed Components</h2>
          <div className="mt-4 divide-y divide-white/5">
            {Object.entries(record.addresses).map(([key, address]) => (
              <div key={key} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm text-white/80">{COMPONENT_LABELS[key] ?? key}</span>
                <a
                  href={`${BASESCAN_URL}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-data text-emerald-400 hover:text-emerald-300 break-all"
                >
                  {address} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.transactionHashes.length > 0 && (
        <div className="border border-white/10 p-6 md:p-8">
          <h2 className="text-[11px] uppercase tracking-wider-2 font-medium text-white/50">Transactions</h2>
          <div className="mt-4 space-y-2">
            {record.transactionHashes.map((hash) => (
              <a
                key={hash}
                href={`${BASESCAN_URL}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-data text-white/60 hover:text-emerald-400 break-all"
              >
                {hash} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {error && record && <p className="text-xs text-amber-400/80">{error}</p>}

      <p className="text-[11px] leading-relaxed text-white/40">
        Vault type: Veda BoringVault — Arctic Architecture. Deployed from the pinned source at{' '}
        <a
          href="https://github.com/Veda-Labs/boring-vault/tree/6413774882380af8051bd7b386a4d07e5fac30c1"
          target="_blank"
          rel="noopener noreferrer"
          className="font-data text-white/60 hover:text-emerald-400 underline underline-offset-2"
        >
          Veda-Labs/boring-vault@6413774 ↗
        </a>
        .
      </p>

      <Link
        href="/dashboard/vaults"
        className="inline-block text-xs uppercase tracking-wider-2 font-medium text-white/60 hover:text-white transition-colors"
      >
        ← Back to vaults
      </Link>
    </div>
  );
}
