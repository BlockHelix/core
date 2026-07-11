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
    const message =
      body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : `Vault deployment service returned ${res.status}`;
    // Pass through client errors (validation, not-found, conflict); mask the rest.
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new UpstreamError(status, message);
  }
  return body;
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
    adminAddress: String(r.adminAddress ?? ''),
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
