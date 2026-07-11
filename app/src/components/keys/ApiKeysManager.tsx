'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { timeAgo } from '@/lib/format';
import { maskKey, type ApiKey } from '@/lib/api-keys-types';
import CreateKeyModal from './CreateKeyModal';
import RevokeKeyModal from './RevokeKeyModal';
import CurlQuickstart from './CurlQuickstart';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; keys: ApiKey[] };

const GRID = 'grid-cols-[1.3fr_1.7fr_0.9fr_0.9fr_0.7fr_auto]';

export default function ApiKeysManager() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => (s.phase === 'ready' ? s : { phase: 'loading' }));
    try {
      const res = await fetch('/api/keys', { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ phase: 'error', message: body?.error ?? `Request failed (${res.status})` });
        return;
      }
      setState({ phase: 'ready', keys: Array.isArray(body?.keys) ? body.keys : [] });
    } catch {
      setState({ phase: 'error', message: 'Network error, refresh to retry' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRevoked = useCallback(
    (id: string) => {
      // Optimistic: flip status immediately, then reconcile with the server.
      setState((s) =>
        s.phase === 'ready'
          ? { phase: 'ready', keys: s.keys.map((k) => (k.id === id ? { ...k, revoked: true } : k)) }
          : s,
      );
      void load(true);
    },
    [load],
  );

  const keys = state.phase === 'ready' ? state.keys : [];
  const activeCount = keys.filter((k) => !k.revoked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">API keys</h2>
          <p className="mt-1.5 max-w-xl text-sm text-white/50 leading-relaxed">
            Authenticate requests to the BlockHelix risk-layer API. Pass a key as{' '}
            <code className="font-data text-white/70">Authorization: Bearer bh_live_…</code>. Free plan is
            capped at 5 requests/day.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 bg-emerald-400 px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-black transition-colors hover:bg-emerald-300"
        >
          <span aria-hidden className="text-sm leading-none">+</span> Create key
        </button>
      </div>

      <div className="border border-white/10">
        {state.phase === 'loading' && <SkeletonTable />}

        {state.phase === 'error' && (
          <div className="p-6">
            <div className="border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-400">
              {state.message}
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="mt-4 text-xs font-medium uppercase tracking-wider-2 text-white/50 transition-colors hover:text-white"
            >
              ↻ Retry
            </button>
          </div>
        )}

        {state.phase === 'ready' && keys.length === 0 && (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        )}

        {state.phase === 'ready' && keys.length > 0 && (
          <>
            <div className={clsx('hidden gap-4 border-b border-white/10 px-5 py-3 md:grid', GRID)}>
              {['Name', 'Key', 'Created', 'Last used', 'Status', ''].map((h, i) => (
                <span
                  key={i}
                  className={clsx(
                    'text-[11px] uppercase tracking-wider-2 text-white/40',
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

      {state.phase === 'ready' && keys.length > 0 && (
        <p className="text-xs text-white/40">
          {activeCount} active key{activeCount === 1 ? '' : 's'} · {keys.length} total
        </p>
      )}

      <CreateKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load(true)}
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
  const label = 'text-[10px] uppercase tracking-wider-2 text-white/30 md:hidden';
  return (
    <li
      className={clsx(
        'grid grid-cols-1 gap-2 border-b border-white/5 px-5 py-4 transition-colors last:border-b-0 md:items-center md:gap-4',
        GRID,
        apiKey.revoked ? 'opacity-55' : 'hover:bg-white/[0.02]',
      )}
    >
      <div className="min-w-0">
        <span className={label}>Name</span>
        <p className="truncate text-sm font-medium text-white">{apiKey.name || 'Untitled key'}</p>
      </div>
      <div className="min-w-0">
        <span className={label}>Key</span>
        <p className="truncate font-data text-xs text-white/60">{maskKey(apiKey.keyPrefix)}</p>
      </div>
      <div>
        <span className={label}>Created</span>
        <p className="text-xs text-white/50">{apiKey.createdAt ? timeAgo(apiKey.createdAt) : '—'}</p>
      </div>
      <div>
        <span className={label}>Last used</span>
        <p className="text-xs text-white/50">{apiKey.lastUsedAt ? timeAgo(apiKey.lastUsedAt) : 'Never'}</p>
      </div>
      <div>
        <span className={label}>Status</span>
        <StatusPill revoked={apiKey.revoked} />
      </div>
      <div className="mt-1 md:mt-0 md:text-right">
        {apiKey.revoked ? (
          <span className="text-[11px] uppercase tracking-wider-2 text-white/25">Revoked</span>
        ) : (
          <button
            type="button"
            onClick={onRevoke}
            className="text-[11px] font-medium uppercase tracking-wider-2 text-white/50 transition-colors hover:text-red-400"
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
        'inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] uppercase tracking-wider-2 font-medium',
        revoked
          ? 'border-white/15 text-white/40'
          : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
      )}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', revoked ? 'bg-white/30' : 'bg-emerald-400')}
      />
      {revoked ? 'Revoked' : 'Active'}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-6 sm:p-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center border border-emerald-400/30 bg-emerald-400/5 text-emerald-400">
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
        <h3 className="mt-4 text-base font-medium text-white">Create your first API key</h3>
        <p className="mt-2 text-sm text-white/50 leading-relaxed">
          API keys let your services call the BlockHelix risk layer. Create one, then drop it into the
          request below to spin up your first vault.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 bg-emerald-400 px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-black transition-colors hover:bg-emerald-300"
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
    <div className="divide-y divide-white/5">
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
