'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr-fetcher';
import type { AdminUsersResponse, AdminVaultsResponse } from '@/lib/admin-types';

interface Hit {
  href: string;
  primary: string;
  secondary: string;
  kind: 'User' | 'Vault';
}

// Small header search that jumps to a user (email/id) or vault (name/id/address).
// Filters over the already-fetched admin lists client-side.
export default function AdminGlobalSearch() {
  const { data: usersData } = useSWR<AdminUsersResponse>('/api/admin/users', fetcher, {
    dedupingInterval: 5000,
  });
  const { data: vaultsData } = useSWR<AdminVaultsResponse>('/api/admin/vaults', fetcher, {
    dedupingInterval: 5000,
  });
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Hit[] = [];
    for (const u of usersData?.users ?? []) {
      if (u.email?.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q)) {
        out.push({
          href: `/admin/users/${encodeURIComponent(u.userId)}`,
          primary: u.email ?? u.userId,
          secondary: u.userId,
          kind: 'User',
        });
      }
    }
    for (const v of vaultsData?.vaults ?? []) {
      const addrHit = v.addresses
        ? Object.values(v.addresses).some((a) => typeof a === 'string' && a.toLowerCase().includes(q))
        : false;
      if (
        v.vaultName.toLowerCase().includes(q) ||
        v.vaultSymbol.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        addrHit
      ) {
        out.push({
          href: `/admin/vaults/${v.id}`,
          primary: v.vaultName || v.vaultSymbol || v.id,
          secondary: v.vaultSymbol ? `${v.vaultSymbol} · ${v.id}` : v.id,
          kind: 'Vault',
        });
      }
    }
    return out.slice(0, 8);
  }, [query, usersData, vaultsData]);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <div className="relative w-full max-w-xs">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) go(hits[0].href);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Search users or vaults…"
        aria-label="Search users or vaults"
        className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#10c689]"
      />
      {open && query.trim() && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-xl">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-400">No matches.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((h) => (
                <li key={`${h.kind}-${h.href}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (blurTimer.current) clearTimeout(blurTimer.current);
                      go(h.href);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.03]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-800">{h.primary}</span>
                      <span className="block truncate font-data text-[11px] text-zinc-400">{h.secondary}</span>
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider-2 text-zinc-400">{h.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
