// Server-only proxy to the BlockHelix risk-layer API for API-key management and
// account usage. Mirrors vault-factory.ts but additionally forwards the Clerk
// user id (X-User-Id) so the backend scopes keys/usage to the signed-in user.
// The service key (X-API-Key) is NEVER exposed to the browser.

import { UpstreamError, vaultApiConfig } from '@/lib/server/vault-factory';
import type { AccountUsage, ApiKey, CreatedApiKey } from '@/lib/api-keys-types';

async function upstream(userId: string, path: string, init?: RequestInit): Promise<Response> {
  const config = vaultApiConfig();
  if (!config) {
    throw new UpstreamError(503, 'The BlockHelix API is not configured');
  }
  try {
    return await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-User-Id': userId,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new UpstreamError(502, 'The BlockHelix API is unreachable');
  }
}

async function parse(res: Response): Promise<unknown> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : `The BlockHelix API returned ${res.status}`;
    // Pass through client errors (validation, not-found, conflict); mask 5xx.
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new UpstreamError(status, message);
  }
  return body;
}

function toApiKey(r: Record<string, unknown>): ApiKey {
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    keyPrefix: String(r.keyPrefix ?? ''),
    tier: String(r.tier ?? 'free'),
    createdAt: String(r.createdAt ?? ''),
    lastUsedAt: r.lastUsedAt == null ? null : String(r.lastUsedAt),
    revoked: Boolean(r.revoked),
  };
}

export async function listKeys(userId: string): Promise<ApiKey[]> {
  const body = (await parse(await upstream(userId, '/keys'))) as { keys?: unknown } | null;
  const keys = Array.isArray(body?.keys) ? body!.keys : [];
  return keys
    .filter((k): k is Record<string, unknown> => !!k && typeof k === 'object')
    .map(toApiKey);
}

export async function createKey(userId: string, name: string): Promise<CreatedApiKey> {
  const r = (await parse(
    await upstream(userId, '/keys', { method: 'POST', body: JSON.stringify({ name }) }),
  )) as Record<string, unknown> | null;
  if (!r || typeof r.key !== 'string') {
    throw new UpstreamError(502, 'The BlockHelix API returned an unexpected response');
  }
  return { ...toApiKey(r), key: r.key };
}

export async function deleteKey(userId: string, id: string): Promise<void> {
  const res = await upstream(userId, `/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (res.ok) return; // 204 (or any 2xx)
  await parse(res); // throws a mapped UpstreamError
}

export async function getUsage(userId: string): Promise<AccountUsage> {
  const r = (await parse(await upstream(userId, '/account/usage'))) as Record<string, unknown> | null;
  const unlimited = Boolean(r?.unlimited);
  return {
    tier: String(r?.tier ?? 'free'),
    limitPerDay: unlimited || r?.limitPerDay == null ? null : Number(r.limitPerDay),
    usedToday: Number(r?.usedToday ?? 0),
    remainingToday: unlimited || r?.remainingToday == null ? null : Number(r.remainingToday),
    resetsAt: String(r?.resetsAt ?? ''),
    unlimited,
  };
}
