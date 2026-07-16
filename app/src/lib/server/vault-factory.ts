import { clerkClient } from '@clerk/nextjs/server';
import type { DeploymentRecord } from '@/lib/vault-types';

const DEFAULT_API_URL = 'https://api.blockhelix.tech';

export const FREE_VAULT_LIMIT = 1;

export function vaultApiConfig(): { url: string; apiKey: string } | null {
  const apiKey = process.env.VAULT_API_KEY;
  if (!apiKey) return null;
  const url = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  return { url, apiKey };
}

export class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function upstream(path: string, userId: string, init?: RequestInit): Promise<unknown> {
  const config = vaultApiConfig();
  if (!config) {
    throw new UpstreamError(503, 'Vault deployment service is not configured');
  }
  let res: Response;
  try {
    res = await fetch(`${config.url}${path}`, {
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
    throw new UpstreamError(502, 'Vault deployment service is unreachable');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const message =
      bodyObj && typeof bodyObj.message === 'string'
        ? bodyObj.message
        : bodyObj && typeof bodyObj.error === 'string'
          ? bodyObj.error
          : `Vault deployment service returned ${res.status}`;
    // Pass through client errors (validation, quota, not-found, conflict); mask the rest.
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new UpstreamError(status, message);
  }
  return body;
}

// Mint a short-lived (HMAC) token the browser uses to open the SSE stream. The
// service key (X-API-Key) stays server-side; only the token + the public events
// URL cross to the client. The token expires in ~5 min, so the browser re-mints
// and reconnects before then (see useEventStream).
export async function mintStreamTokenUpstream(
  userId: string,
): Promise<{ token: string; expiresIn: number; streamUrl: string }> {
  const config = vaultApiConfig();
  if (!config) {
    throw new UpstreamError(503, 'Vault deployment service is not configured');
  }
  const body = (await upstream('/stream-token', userId, { method: 'POST' })) as
    | { token?: unknown; expiresIn?: unknown }
    | null;
  if (!body || typeof body.token !== 'string') {
    throw new UpstreamError(502, 'Vault deployment service returned an unexpected response');
  }
  const expiresIn = typeof body.expiresIn === 'number' ? body.expiresIn : 300;
  return { token: body.token, expiresIn, streamUrl: `${config.url}/events` };
}

export async function createVaultUpstream(payload: unknown, userId: string): Promise<{ deploymentId: string; status: string }> {
  const body = (await upstream('/vaults', userId, {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as { deploymentId?: string; status?: string } | null;
  if (!body?.deploymentId) {
    throw new UpstreamError(502, 'Vault deployment service returned an unexpected response');
  }
  return { deploymentId: body.deploymentId, status: body.status ?? 'queued' };
}

// Retry an existing deployment (same vault, no new quota slot). The backend may
// require `force=true` to requeue a non-failed record and answers 400/409 then;
// UpstreamError carries that status straight through to the caller.
export async function requeueVaultUpstream(
  id: string,
  userId: string,
  force: boolean,
): Promise<{ status: string }> {
  const query = force ? '?force=true' : '';
  const body = (await upstream(`/vaults/${encodeURIComponent(id)}/requeue${query}`, userId, {
    method: 'POST',
  })) as { status?: string } | null;
  return { status: body?.status ?? 'queued' };
}

// Whitelist the fields we expose; the raw record includes internal config
// (configJson, configHash, vedaCommit, artifactPath) that stays server-side.
export async function getDeploymentUpstream(id: string, userId: string): Promise<DeploymentRecord> {
  const r = (await upstream(`/vaults/${encodeURIComponent(id)}`, userId)) as Record<string, unknown>;
  return {
    id: String(r.id ?? id),
    chainId: Number(r.chainId ?? 0),
    status: (r.status as DeploymentRecord['status']) ?? 'queued',
    vaultName: String(r.vaultName ?? ''),
    vaultSymbol: String(r.vaultSymbol ?? ''),
    baseAsset: String(r.baseAsset ?? ''),
    pauserAddress: String(r.pauserAddress ?? ''),
    payoutAddress: String(r.payoutAddress ?? ''),
    platformFeeBps: Number(r.platformFeeBps ?? 0),
    performanceFeeBps: Number(r.performanceFeeBps ?? 0),
    addresses: (r.addresses as Record<string, string> | null) ?? null,
    transactionHashes: Array.isArray(r.transactionHashes) ? (r.transactionHashes as string[]) : [],
    failureReason: (r.failureReason as string | null) ?? null,
    createdAt: String(r.createdAt ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
  };
}

// List all of the user's deployments in one backend call. The backend scopes by
// X-User-Id, so this replaces the old getUser + per-id fan-out (N+1). The list
// endpoint returns a lighter record than the detail endpoint; we fill the
// detail-only fields with defaults so the shape stays a DeploymentRecord (the
// list UI only reads id/status/name/symbol/chainId/createdAt).
export async function listVaultsUpstream(userId: string): Promise<DeploymentRecord[]> {
  const body = (await upstream('/vaults', userId)) as { deployments?: unknown } | null;
  const raw = Array.isArray(body?.deployments) ? body.deployments : [];
  return raw.map((item) => {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? ''),
      chainId: Number(r.chainId ?? 0),
      status: (r.status as DeploymentRecord['status']) ?? 'queued',
      vaultName: String(r.vaultName ?? ''),
      vaultSymbol: String(r.vaultSymbol ?? ''),
      baseAsset: '',
      pauserAddress: '',
      payoutAddress: '',
      platformFeeBps: 0,
      performanceFeeBps: 0,
      addresses: null,
      transactionHashes: [],
      failureReason: null,
      createdAt: String(r.createdAt ?? ''),
      updatedAt: String(r.updatedAt ?? ''),
    };
  });
}

export async function getUserDeploymentIds(userId: string): Promise<string[]> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const ids = user.privateMetadata?.vaultDeployments;
  return Array.isArray(ids) ? ids.filter((v): v is string => typeof v === 'string') : [];
}

export async function appendUserDeploymentId(userId: string, deploymentId: string): Promise<void> {
  const client = await clerkClient();
  const existing = await getUserDeploymentIds(userId);
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { vaultDeployments: [...existing, deploymentId] },
  });
}
