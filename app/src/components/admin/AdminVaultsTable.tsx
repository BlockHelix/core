'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { clsx } from 'clsx';
import StatusBadge from '@/components/vaults/StatusBadge';
import { fetcher } from '@/lib/swr-fetcher';
import { timeAgo } from '@/lib/format';
import { BASESCAN_URL, COMPONENT_LABELS, type DeploymentStatus } from '@/lib/vault-types';
import type { AdminVault, AdminVaultsResponse } from '@/lib/admin-types';

const GRID = 'sm:grid-cols-[1.5fr_1.4fr_0.9fr_0.7fr_auto]';

export default function AdminVaultsTable() {
  const { data, error, isValidating, mutate } = useSWR<AdminVaultsResponse>('/api/admin/vaults', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

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

  const vaults = data.vaults;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[11px] uppercase tracking-wider-2 text-zinc-500">
          {vaults.length} vault{vaults.length === 1 ? '' : 's'} across all users
        </p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
        >
          {isValidating ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {vaults.length === 0 ? (
        <div className="rounded-xl border border-black/[0.06] bg-white p-12 text-center text-sm text-zinc-500 shadow-soft">
          No vaults yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-soft">
          <div className={clsx('hidden gap-4 border-b border-black/[0.06] bg-[#f7f7f8] px-5 py-3 sm:grid', GRID)}>
            {['Vault', 'Owner', 'Status', 'Chain', ''].map((h, i) => (
              <span
                key={i}
                className={clsx('text-[11px] uppercase tracking-wider-2 text-zinc-400', i === 4 && 'text-right')}
              >
                {h}
              </span>
            ))}
          </div>
          <ul>
            {vaults.map((v) => (
              <AdminVaultRow key={v.id} v={v} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AdminVaultRow({ v }: { v: AdminVault }) {
  const label = 'text-[10px] uppercase tracking-wider-2 text-zinc-400 sm:hidden';
  const components = v.addresses
    ? Object.entries(v.addresses).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1])
    : [];

  return (
    <li className={clsx('grid grid-cols-1 gap-3 border-b border-black/[0.05] px-5 py-4 last:border-b-0 sm:items-center sm:gap-4', GRID)}>
      <div className="min-w-0">
        <span className={label}>Vault</span>
        <p className="truncate text-sm font-medium text-zinc-900">{v.vaultName || '—'}</p>
        <p className="mt-0.5 truncate font-data text-xs text-zinc-400">{v.vaultSymbol}</p>
        {components.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {components.map(([key, address]) => (
              <a
                key={key}
                href={`${BASESCAN_URL}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-data text-[11px] text-emerald-700 hover:text-emerald-800"
                title={address}
              >
                {COMPONENT_LABELS[key] ?? key} ↗
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <span className={label}>Owner</span>
        <p className="truncate text-sm text-zinc-700">{v.email ?? '—'}</p>
        <p className="mt-0.5 truncate font-data text-xs text-zinc-400">{v.userId}</p>
      </div>
      <div>
        <span className={label}>Status</span>
        <StatusBadge status={v.status as DeploymentStatus} />
      </div>
      <div>
        <span className={label}>Chain</span>
        <p className="text-xs text-zinc-500">Base ({v.chainId})</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">{v.createdAt ? timeAgo(v.createdAt) : ''}</p>
      </div>
      <div className="mt-1 flex items-center sm:mt-0 sm:justify-end">
        <Link
          href={`/admin/vaults/${v.id}`}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-emerald-700 transition-colors hover:text-emerald-800"
        >
          Manage →
        </Link>
      </div>
    </li>
  );
}
