'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from './StatusBadge';
import { timeAgo } from '@/lib/format';
import type { VaultListResponse } from '@/lib/vault-types';

export default function VaultList() {
  const [data, setData] = useState<VaultListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vaults', { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(body?.error ?? `Request failed (${res.status})`);
        } else {
          setData(body as VaultListResponse);
        }
      } catch {
        if (!cancelled) setError('Network error, refresh to retry');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-400">{error}</div>
    );
  }
  if (!data) {
    return <div className="border border-white/10 p-8 text-sm text-white/50">Loading vaults…</div>;
  }

  const quotaReached = data.quota.used >= data.quota.limit;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-white/50 uppercase tracking-wider-2">
          {data.quota.used} of {data.quota.limit} free vault{data.quota.limit === 1 ? '' : 's'} used
        </p>
        {quotaReached ? (
          <span className="text-xs text-white/40 uppercase tracking-wider-2 border border-white/10 px-4 py-2">
            Free vault used
          </span>
        ) : (
          <Link
            href="/dashboard/new-vault"
            className="text-xs uppercase tracking-wider-2 font-medium px-4 py-2 bg-emerald-400 text-black hover:bg-emerald-300 transition-colors"
          >
            + New Vault
          </Link>
        )}
      </div>

      {data.deployments.length === 0 ? (
        <div className="border border-white/10 p-12 text-center">
          <p className="text-sm text-white/50">No vaults yet.</p>
          {!quotaReached && (
            <Link
              href="/dashboard/new-vault"
              className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300"
            >
              Deploy your first vault →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {data.deployments.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/vaults/${d.id}`}
              className="block border border-white/10 hover:border-emerald-400/40 transition-colors p-5"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-white">{d.vaultName}</p>
                  <p className="mt-1 text-xs text-white/40 font-data">
                    {d.vaultSymbol} · Base ({d.chainId}){d.createdAt ? ` · ${timeAgo(d.createdAt)}` : ''}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
