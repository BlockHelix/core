// Server-only proxy to the BlockHelix backend ADMIN endpoints plus the Clerk
// admin-role gate and userId -> email enrichment. The service key (X-API-Key)
// stays server-side and is NEVER exposed to the browser.
//
// These are GLOBAL admin calls. The backend's ServiceUserGuard requires BOTH the
// service key (X-API-Key) AND a non-empty X-User-Id, so we forward the acting
// admin's Clerk id. The admin *scope* is enforced upstream by getAdminUserId() /
// the middleware; X-User-Id here just satisfies the service-caller requirement.

import { auth, clerkClient } from '@clerk/nextjs/server';
import { UpstreamError, vaultApiConfig } from '@/lib/server/vault-factory';
import type { AdminEntitlement, AdminEntitlementInput, AdminUser, AdminVault } from '@/lib/admin-types';

async function adminUpstream(path: string, init?: RequestInit): Promise<unknown> {
  const config = vaultApiConfig();
  if (!config) {
    throw new UpstreamError(503, 'The BlockHelix API is not configured');
  }
  // ServiceUserGuard requires a non-empty X-User-Id; use the acting admin's Clerk id.
  const { userId } = await auth();
  let res: Response;
  try {
    res = await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-User-Id': userId ?? '',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new UpstreamError(502, 'The BlockHelix API is unreachable');
  }

  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const message =
      bodyObj && typeof bodyObj.message === 'string'
        ? bodyObj.message
        : bodyObj && typeof bodyObj.error === 'string'
          ? bodyObj.error
          : `The BlockHelix API returned ${res.status}`;
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new UpstreamError(status, message);
  }
  return body;
}

// Returns the signed-in user's id only if they carry publicMetadata.role === 'admin'.
// We read the role off the freshly-fetched user (rather than the session token) so
// the gate works without customising Clerk session claims.
export async function getAdminUserId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata as { role?: unknown } | null)?.role;
  return role === 'admin' ? userId : null;
}

function primaryEmail(user: {
  emailAddresses?: { id: string; emailAddress: string }[];
  primaryEmailAddressId?: string | null;
}): string | null {
  const list = user.emailAddresses ?? [];
  const primary = list.find((e) => e.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? list[0]?.emailAddress ?? null;
}

// Batch userId -> email. Clerk caps getUserList at 100 ids/call, so we page.
async function emailMap(userIds: string[]): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map: Record<string, string | null> = {};
  if (unique.length === 0) return map;
  const client = await clerkClient();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data } = await client.users.getUserList({ userId: chunk, limit: chunk.length });
    for (const u of data) {
      map[u.id] = primaryEmail(u);
    }
  }
  return map;
}

function toEntitlement(raw: unknown): AdminEntitlement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    vaultsTotal: r.vaultsTotal == null ? undefined : Number(r.vaultsTotal),
    tradesPerDay: r.tradesPerDay == null ? undefined : Number(r.tradesPerDay),
    unlimited: Boolean(r.unlimited),
    note: typeof r.note === 'string' ? r.note : undefined,
  };
}

// Fetch + normalise the raw admin vault rows (no Clerk email enrichment). Kept
// separate so hot per-vault routes (state/txs) can look up addresses without
// paying for a Clerk getUserList call.
async function fetchAdminVaultRows(): Promise<Omit<AdminVault, 'email'>[]> {
  const body = await adminUpstream('/admin/vaults');
  // Backend returns { items, nextCursor }. (Bare array / { vaults } kept as fallbacks.)
  const raw = Array.isArray(body)
    ? body
    : Array.isArray((body as { items?: unknown })?.items)
      ? (body as { items: unknown[] }).items
      : Array.isArray((body as { vaults?: unknown })?.vaults)
        ? (body as { vaults: unknown[] }).vaults
        : [];
  return raw
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    .map((r) => ({
      id: String(r.id ?? ''),
      userId: String(r.userId ?? ''),
      status: String(r.status ?? ''),
      vaultName: String(r.vaultName ?? ''),
      vaultSymbol: String(r.vaultSymbol ?? ''),
      chainId: Number(r.chainId ?? 0),
      addresses: (r.addresses as Record<string, string | null> | null) ?? null,
      transactionHashes: Array.isArray(r.transactionHashes) ? (r.transactionHashes as string[]) : [],
      createdAt: String(r.createdAt ?? ''),
    }));
}

export async function listAdminVaults(): Promise<AdminVault[]> {
  const rows = await fetchAdminVaultRows();
  const emails = await emailMap(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, email: emails[r.userId] ?? null }));
}

// Component addresses for a single vault id (admin scope). null if the id is
// unknown. Used by the server-side state route.
export async function getAdminVaultAddresses(id: string): Promise<Record<string, string | null> | null> {
  const rows = await fetchAdminVaultRows();
  const row = rows.find((r) => r.id === id);
  return row ? (row.addresses ?? {}) : null;
}

// The two activity sources for a vault: its boringVault address (for the live
// transfer feed) and the deploy transaction hashes on record. null if unknown.
export async function getAdminVaultTxSources(
  id: string,
): Promise<{ boringVault: string | null; transactionHashes: string[] } | null> {
  const rows = await fetchAdminVaultRows();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  return { boringVault: row.addresses?.boringVault ?? null, transactionHashes: row.transactionHashes };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const body = await adminUpstream('/admin/users');
  const raw = Array.isArray(body) ? body : Array.isArray((body as { users?: unknown })?.users) ? (body as { users: unknown[] }).users : [];
  const rows = raw
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    .map((r) => ({
      userId: String(r.userId ?? ''),
      tier: String(r.tier ?? 'free'),
      vaultsUsed: Number(r.vaultsUsed ?? 0),
      entitlement: toEntitlement(r.entitlement),
    }));
  const emails = await emailMap(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, email: emails[r.userId] ?? null }));
}

// Delete a deployment record (DB-only). The on-chain vault is immutable and
// unaffected. Idempotent upstream (204 even if already gone).
export async function deleteDeployment(id: string): Promise<void> {
  await adminUpstream(`/admin/vaults/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function setEntitlements(userId: string, input: AdminEntitlementInput): Promise<void> {
  await adminUpstream(`/admin/users/${encodeURIComponent(userId)}/entitlements`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function clearEntitlements(userId: string): Promise<void> {
  await adminUpstream(`/admin/users/${encodeURIComponent(userId)}/entitlements`, {
    method: 'DELETE',
  });
}
