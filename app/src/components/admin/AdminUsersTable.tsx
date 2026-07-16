'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher } from '@/lib/swr-fetcher';
import { EditLimitsModal, overrideSummary } from '@/components/admin/EntitlementEditor';
import type { AdminUser, AdminUsersResponse } from '@/lib/admin-types';

const GRID = 'sm:grid-cols-[1.6fr_0.7fr_0.7fr_1.2fr_auto]';

export default function AdminUsersTable() {
  const { data, error, isValidating, mutate } = useSWR<AdminUsersResponse>('/api/admin/users', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = data?.users ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) => u.email?.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q),
    );
  }, [data, query]);
  const users = data?.users ?? [];

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-600/20 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error.message}
      </div>
    );
  }
  if (!data) {
    return <div className="h-40 skeleton rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email or user id…"
          className="w-full max-w-xs rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-emerald-500"
        />
        <div className="flex items-center gap-4">
          <p className="text-[11px] uppercase tracking-wider-2 text-zinc-500">
            {filtered.length} of {users.length} user{users.length === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
          >
            {isValidating ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-black/[0.06] bg-white p-12 text-center text-sm text-zinc-500 shadow-soft">
          {users.length === 0 ? 'No users yet.' : 'No users match your search.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-soft">
          <div className={clsx('hidden gap-4 border-b border-black/[0.06] bg-[#f7f7f8] px-5 py-3 sm:grid', GRID)}>
            {['User', 'Tier', 'Vaults', 'Override', ''].map((h, i) => (
              <span
                key={i}
                className={clsx('text-[11px] uppercase tracking-wider-2 text-zinc-400', i === 4 && 'text-right')}
              >
                {h}
              </span>
            ))}
          </div>
          <ul>
            {filtered.map((u) => (
              <UserRow key={u.userId} u={u} onEdit={() => setEditing(u)} />
            ))}
          </ul>
        </div>
      )}

      <EditLimitsModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void mutate();
        }}
      />
    </div>
  );
}

function UserRow({ u, onEdit }: { u: AdminUser; onEdit: () => void }) {
  const label = 'text-[10px] uppercase tracking-wider-2 text-zinc-400 sm:hidden';
  return (
    <li className={clsx('grid grid-cols-1 gap-3 border-b border-black/[0.05] px-5 py-4 last:border-b-0 sm:items-center sm:gap-4', GRID)}>
      <div className="min-w-0">
        <span className={label}>User</span>
        <Link href={`/admin/users/${encodeURIComponent(u.userId)}`} className="group block">
          <p className="truncate text-sm text-zinc-800 group-hover:text-emerald-700">{u.email ?? '—'}</p>
          <p className="mt-0.5 truncate font-data text-xs text-zinc-400">{u.userId}</p>
        </Link>
      </div>
      <div>
        <span className={label}>Tier</span>
        <span className="inline-flex items-center rounded-full border border-black/[0.08] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-600">
          {u.tier || 'free'}
        </span>
      </div>
      <div>
        <span className={label}>Vaults used</span>
        <p className="font-data text-sm text-zinc-700">{u.vaultsUsed}</p>
      </div>
      <div className="min-w-0">
        <span className={label}>Override</span>
        <p className="truncate text-xs text-zinc-600">{overrideSummary(u.entitlement)}</p>
        {u.entitlement?.note && <p className="mt-0.5 truncate text-[11px] italic text-zinc-400">{u.entitlement.note}</p>}
      </div>
      <div className="mt-1 flex items-center gap-4 sm:mt-0 sm:justify-end">
        <button
          type="button"
          onClick={onEdit}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-emerald-700 transition-colors hover:text-emerald-800"
        >
          Edit limits
        </button>
        <Link
          href={`/admin/users/${encodeURIComponent(u.userId)}`}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
        >
          View →
        </Link>
      </div>
    </li>
  );
}
