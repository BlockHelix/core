'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { clsx } from 'clsx';
import StatusBadge from '@/components/vaults/StatusBadge';
import { EditLimitsModal, overrideSummary } from '@/components/admin/EntitlementEditor';
import { fetcher } from '@/lib/swr-fetcher';
import { timeAgo } from '@/lib/format';
import type { DeploymentStatus } from '@/lib/vault-types';
import type { AdminUser, AdminUsersResponse, AdminVault, AdminVaultsResponse } from '@/lib/admin-types';

const GRID = 'sm:grid-cols-[1.6fr_1fr_0.8fr_auto]';

export default function AdminUserDetail({ userId }: { userId: string }) {
  const usersQuery = useSWR<AdminUsersResponse>('/api/admin/users', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
  const vaultsQuery = useSWR<AdminVaultsResponse>('/api/admin/vaults', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const user = usersQuery.data?.users.find((u) => u.userId === userId) ?? null;
  const userVaults = useMemo(
    () => (vaultsQuery.data?.vaults ?? []).filter((v) => v.userId === userId),
    [vaultsQuery.data, userId],
  );

  if (usersQuery.error && !usersQuery.data) {
    return (
      <div className="rounded-lg border border-[#b82214]/20 bg-[#fdeeeb] px-4 py-3 text-sm text-[#9a1c10]">
        {usersQuery.error.message}
      </div>
    );
  }
  if (!usersQuery.data) {
    return <div className="h-64 skeleton rounded-xl" />;
  }
  if (!user) {
    return (
      <div className="space-y-6">
        <BreadCrumb userId={userId} />
        <div className="rounded-xl border border-black/[0.06] bg-white p-8 text-sm text-zinc-500 shadow-soft">
          User not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BreadCrumb userId={userId} email={user.email} />

      {/* User summary + entitlement */}
      <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-950">{user.email ?? '—'}</h1>
            <p className="mt-1 break-all font-data text-xs text-zinc-400">{user.userId}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(user)}
            className="bh-btn-primary rounded-lg px-4 py-2 text-[11px] font-medium uppercase tracking-wider-2"
          >
            Edit limits
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Tier">
            <span className="inline-flex items-center rounded-full border border-black/[0.08] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-600">
              {user.tier || 'free'}
            </span>
          </Stat>
          <Stat label="Vaults used">
            <span className="font-data text-sm text-zinc-800">{user.vaultsUsed}</span>
          </Stat>
          <Stat label="Override">
            <span className="text-sm text-zinc-700">{overrideSummary(user.entitlement)}</span>
          </Stat>
        </dl>
        {user.entitlement?.note && (
          <p className="mt-3 text-xs italic text-zinc-400">Note: {user.entitlement.note}</p>
        )}
      </div>

      {/* This user's vaults */}
      <div>
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          Vaults ({userVaults.length})
        </h2>
        <div className="mt-4">
          {!vaultsQuery.data ? (
            <div className="h-32 skeleton rounded-xl" />
          ) : userVaults.length === 0 ? (
            <div className="rounded-xl border border-black/[0.06] bg-white p-10 text-center text-sm text-zinc-500 shadow-soft">
              This user has no vaults.
            </div>
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
                {userVaults.map((v) => (
                  <VaultRow key={v.id} v={v} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <EditLimitsModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void usersQuery.mutate();
        }}
      />
    </div>
  );
}

function BreadCrumb({ userId, email }: { userId: string; email?: string | null }) {
  return (
    <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500">
      <Link href="/admin/users" className="inline-flex items-center gap-1 transition-colors hover:text-zinc-900">
        <span aria-hidden>←</span> Users
      </Link>
      <span aria-hidden className="text-zinc-300">/</span>
      <span className="truncate font-data text-zinc-400">{email ?? userId}</span>
    </nav>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider-2 text-zinc-400">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function VaultRow({ v }: { v: AdminVault }) {
  const label = 'text-[10px] uppercase tracking-wider-2 text-zinc-400 sm:hidden';
  return (
    <li className={clsx('grid grid-cols-1 gap-3 border-b border-black/[0.05] px-5 py-4 last:border-b-0 sm:items-center sm:gap-4', GRID)}>
      <div className="min-w-0">
        <span className={label}>Vault</span>
        <p className="truncate text-sm font-medium text-zinc-900">{v.vaultName || '—'}</p>
        <p className="mt-0.5 truncate font-data text-xs text-zinc-400">{v.vaultSymbol}</p>
      </div>
      <div>
        <span className={label}>Status</span>
        <StatusBadge status={v.status as DeploymentStatus} />
      </div>
      <div>
        <span className={label}>Created</span>
        <p className="text-xs text-zinc-500">{v.createdAt ? timeAgo(v.createdAt) : '—'}</p>
      </div>
      <div className="mt-1 flex items-center sm:mt-0 sm:justify-end">
        <Link
          href={`/admin/vaults/${v.id}`}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-[#10c689] transition-colors hover:text-[#10c689]"
        >
          Manage →
        </Link>
      </div>
    </li>
  );
}
