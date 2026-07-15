'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { clsx } from 'clsx';
import { timeAgo } from '@/lib/format';
import { fetcher } from '@/lib/swr-fetcher';
import { maskKey, type ApiKey, type ApiKeysListResponse } from '@/lib/api-keys-types';
import CreateKeyModal from './CreateKeyModal';
import RevokeKeyModal from './RevokeKeyModal';
import CurlQuickstart from './CurlQuickstart';

const GRID = 'grid-cols-[1.3fr_1.7fr_0.9fr_0.9fr_0.7fr_auto]';

export default function ApiKeysManager() {
  // SWR's in-memory cache renders the last list instantly on tab switches, then
  // revalidates. mutate() replaces the manual refetch after create/revoke.
  const { data, error, mutate } = useSWR<ApiKeysListResponse>('/api/keys', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const onRevoked = useCallback(
    (id: string) => {
      // Optimistic: flip status immediately, then reconcile with the server.
      void mutate(
        (current) =>
          current
            ? { keys: current.keys.map((k) => (k.id === id ? { ...k, revoked: true } : k)) }
            : current,
        { revalidate: true },
      );
    },
    [mutate],
  );

  const loading = !data && !error;
  const keys = data?.keys ?? [];
  const activeCount = keys.filter((k) => !k.revoked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">API keys</h2>
          <p className="mt-1.5 max-w-xl text-sm text-zinc-600 leading-relaxed">
            Authenticate requests to the BlockHelix risk-layer API. Pass a key as{' '}
            <code className="font-data text-zinc-900">Authorization: Bearer bh_live_…</code>. Free plan is
            capped at 5 requests/day.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bh-btn-primary inline-flex shrink-0 items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2"
        >
          <span aria-hidden className="text-sm leading-none">+</span> Create key
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-soft">
        {loading && <SkeletonTable />}

        {error && !data && (
          <div className="p-6">
            <div className="rounded-lg border border-red-600/20 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error.message}
            </div>
            <button
              type="button"
              onClick={() => mutate()}
              className="mt-4 text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
            >
              ↻ Retry
            </button>
          </div>
        )}

        {data && keys.length === 0 && (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        )}

        {data && keys.length > 0 && (
          <>
            <div className={clsx('hidden gap-4 border-b border-black/[0.06] bg-[#f7f7f8] px-5 py-3 md:grid', GRID)}>
              {['Name', 'Key', 'Created', 'Last used', 'Status', ''].map((h, i) => (
                <span
                  key={i}
                  className={clsx(
                    'text-[11px] uppercase tracking-wider-2 text-zinc-400',
                    i === 5 && 'text-right',
                  )}
                >
                  {h}
                </span>
              ))}
            </div>
            <ul>
              {keys.map((k) => (
                <KeyRow key={k.id} apiKey={k} onRevoke={() => setRevokeTarget(k)} />
              ))}
            </ul>
          </>
        )}
      </div>

      {data && keys.length > 0 && (
        <p className="text-xs text-zinc-500">
          {activeCount} active key{activeCount === 1 ? '' : 's'} · {keys.length} total
        </p>
      )}

      <CreateKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => mutate()}
      />
      <RevokeKeyModal
        apiKey={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onRevoked={onRevoked}
      />
    </div>
  );
}

function KeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: () => void }) {
  const label = 'text-[10px] uppercase tracking-wider-2 text-zinc-400 md:hidden';
  return (
    <li
      className={clsx(
        'grid grid-cols-1 gap-2 border-b border-black/[0.05] px-5 py-4 transition-colors last:border-b-0 md:items-center md:gap-4',
        GRID,
        apiKey.revoked ? 'opacity-55' : 'hover:bg-black/[0.015]',
      )}
    >
      <div className="min-w-0">
        <span className={label}>Name</span>
        <p className="truncate text-sm font-medium text-zinc-900">{apiKey.name || 'Untitled key'}</p>
      </div>
      <div className="min-w-0">
        <span className={label}>Key</span>
        <p className="truncate font-data text-xs text-zinc-600">{maskKey(apiKey.keyPrefix)}</p>
      </div>
      <div>
        <span className={label}>Created</span>
        <p className="text-xs text-zinc-500">{apiKey.createdAt ? timeAgo(apiKey.createdAt) : '—'}</p>
      </div>
      <div>
        <span className={label}>Last used</span>
        <p className="text-xs text-zinc-500">{apiKey.lastUsedAt ? timeAgo(apiKey.lastUsedAt) : 'Never'}</p>
      </div>
      <div>
        <span className={label}>Status</span>
        <StatusPill revoked={apiKey.revoked} />
      </div>
      <div className="mt-1 md:mt-0 md:text-right">
        {apiKey.revoked ? (
          <span className="text-[11px] uppercase tracking-wider-2 text-zinc-300">Revoked</span>
        ) : (
          <button
            type="button"
            onClick={onRevoke}
            className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-red-600"
          >
            Revoke
          </button>
        )}
      </div>
    </li>
  );
}

function StatusPill({ revoked }: { revoked: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider-2 font-medium',
        revoked
          ? 'border-black/[0.08] text-zinc-400'
          : 'border-emerald-600/25 bg-emerald-50 text-emerald-700',
      )}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', revoked ? 'bg-zinc-300' : 'bg-emerald-600')}
      />
      {revoked ? 'Revoked' : 'Active'}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-6 sm:p-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-600/20 bg-emerald-50 text-emerald-700">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 7a4 4 0 11-3.9 5H8v2H6v2H3v-3l5.1-5.1A4 4 0 0115 7z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="15.5" cy="6.5" r="0.9" fill="currentColor" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-950">Create your first API key</h3>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          API keys let your services call the BlockHelix risk layer. Create one, then drop it into the
          request below to spin up your first vault.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="bh-btn-primary mt-5 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2"
        >
          <span aria-hidden>+</span> Create API key
        </button>
      </div>
      <div className="mx-auto mt-8 max-w-xl text-left">
        <CurlQuickstart />
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="divide-y divide-black/[0.05]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 flex-1 skeleton" />
          <div className="hidden h-4 w-40 skeleton md:block" />
          <div className="hidden h-4 w-20 skeleton sm:block" />
          <div className="h-5 w-16 skeleton" />
        </div>
      ))}
    </div>
  );
}
