import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  appendUserDeploymentId,
  createVaultUpstream,
  FREE_VAULT_LIMIT,
  getDeploymentUpstream,
  getUserDeploymentIds,
  UpstreamError,
} from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';
import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  MAX_PERFORMANCE_FEE_BPS,
  MAX_PLATFORM_FEE_BPS,
  VAULT_NAME_RE,
  VAULT_SYMBOL_RE,
} from '@/lib/vault-types';

export const runtime = 'nodejs';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function errorJson(err: unknown): NextResponse {
  if (err instanceof UpstreamError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[api/vaults]', err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

type Body = {
  vaultName?: unknown;
  vaultSymbol?: unknown;
  adminAddress?: unknown;
  payoutAddress?: unknown;
  platformFeeBps?: unknown;
  performanceFeeBps?: unknown;
};

function validate(body: Body): { error: string } | { payload: Record<string, unknown> } {
  const vaultName = typeof body.vaultName === 'string' ? body.vaultName.trim() : '';
  const vaultSymbol = typeof body.vaultSymbol === 'string' ? body.vaultSymbol.trim() : '';
  const adminAddress = typeof body.adminAddress === 'string' ? body.adminAddress.trim() : '';
  const payoutAddress = typeof body.payoutAddress === 'string' ? body.payoutAddress.trim() : '';
  const platformFeeBps = Number(body.platformFeeBps);
  const performanceFeeBps = Number(body.performanceFeeBps);

  if (!vaultName || vaultName.length > 64 || !VAULT_NAME_RE.test(vaultName)) {
    return { error: 'Vault name must be 1-64 chars: letters, numbers, spaces, ._-' };
  }
  if (!vaultSymbol || vaultSymbol.length > 16 || !VAULT_SYMBOL_RE.test(vaultSymbol)) {
    return { error: 'Vault symbol must be 1-16 chars: letters, numbers, ._-' };
  }
  if (!ADDRESS_RE.test(adminAddress)) {
    return { error: 'Admin address must be a valid 0x address (a deployed Safe on Base)' };
  }
  if (!ADDRESS_RE.test(payoutAddress)) {
    return { error: 'Payout address must be a valid 0x address' };
  }
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > MAX_PLATFORM_FEE_BPS) {
    return { error: `Platform fee must be an integer between 0 and ${MAX_PLATFORM_FEE_BPS} bps` };
  }
  if (!Number.isInteger(performanceFeeBps) || performanceFeeBps < 0 || performanceFeeBps > MAX_PERFORMANCE_FEE_BPS) {
    return { error: `Performance fee must be an integer between 0 and ${MAX_PERFORMANCE_FEE_BPS} bps` };
  }

  // chainId and base asset are pinned server-side for v1: USDC on Base.
  return {
    payload: {
      chainId: BASE_CHAIN_ID,
      baseAssetAddress: BASE_USDC_ADDRESS,
      adminAddress,
      payoutAddress,
      platformFeeBps,
      performanceFeeBps,
      vaultName,
      vaultSymbol,
    },
  };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`post:${userId}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const result = validate(body);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    // Check-then-act on Clerk metadata: two simultaneous requests could both
    // pass the check. Acceptable for v1 (worst case: one extra free vault).
    const existing = await getUserDeploymentIds(userId);
    if (existing.length >= FREE_VAULT_LIMIT) {
      return NextResponse.json(
        { error: `Free tier is limited to ${FREE_VAULT_LIMIT} vault per account` },
        { status: 403 },
      );
    }

    const { deploymentId, status } = await createVaultUpstream(result.payload, userId);
    await appendUserDeploymentId(userId, deploymentId);
    return NextResponse.json({ deploymentId, status }, { status: 202 });
  } catch (err) {
    return errorJson(err);
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`get:${userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  try {
    const ids = await getUserDeploymentIds(userId);
    const deployments = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getDeploymentUpstream(id, userId);
        } catch {
          return null;
        }
      }),
    );
    return NextResponse.json({
      deployments: deployments.filter((d) => d !== null),
      quota: { used: ids.length, limit: FREE_VAULT_LIMIT },
    });
  } catch (err) {
    return errorJson(err);
  }
}
