import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  appendUserDeploymentId,
  createVaultUpstream,
  FREE_VAULT_LIMIT,
  listVaultsUpstream,
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
  pauserAddress?: unknown;
  payoutAddress?: unknown;
  platformFeeBps?: unknown;
  performanceFeeBps?: unknown;
  riskProfileId?: unknown;
};

function validate(body: Body): { error: string } | { payload: Record<string, unknown> } {
  const vaultName = typeof body.vaultName === 'string' ? body.vaultName.trim() : '';
  const vaultSymbol = typeof body.vaultSymbol === 'string' ? body.vaultSymbol.trim() : '';
  const pauserAddress = typeof body.pauserAddress === 'string' ? body.pauserAddress.trim() : '';
  const payoutAddress = typeof body.payoutAddress === 'string' ? body.payoutAddress.trim() : '';
  const platformFeeBps = Number(body.platformFeeBps);
  const performanceFeeBps = Number(body.performanceFeeBps);

  if (!vaultName || vaultName.length > 64 || !VAULT_NAME_RE.test(vaultName)) {
    return { error: 'Vault name must be 1-64 chars: letters, numbers, spaces, ._-' };
  }
  if (!vaultSymbol || vaultSymbol.length > 16 || !VAULT_SYMBOL_RE.test(vaultSymbol)) {
    return { error: 'Vault symbol must be 1-16 chars: letters, numbers, ._-' };
  }
  if (!ADDRESS_RE.test(pauserAddress)) {
    return { error: 'Pauser Safe must be a valid deployed Gnosis Safe on Base' };
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

  // Curated profile id (optional). The backend validates it against its own list and
  // derives the trade policy from it — we just forward the choice.
  const riskProfileId = typeof body.riskProfileId === 'string' ? body.riskProfileId : undefined;

  // chainId and base asset are pinned server-side for v1: USDC on Base.
  return {
    payload: {
      chainId: BASE_CHAIN_ID,
      baseAssetAddress: BASE_USDC_ADDRESS,
      pauserAddress,
      payoutAddress,
      platformFeeBps,
      performanceFeeBps,
      vaultName,
      vaultSymbol,
      ...(riskProfileId ? { riskProfileId } : {}),
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
    // The backend is the single source of truth for quota: it answers 402
    // (vault_quota_exceeded) when the plan limit is reached, counting only
    // NON-FAILED deployments. We never pre-gate on the raw Clerk id count —
    // a failed deployment must not consume a slot or lock the user out.
    const { deploymentId, status } = await createVaultUpstream(result.payload, userId);
    // Track the id so we can list this user's deployments; length is never
    // used for quota (see the GET handler, which excludes failed records).
    await appendUserDeploymentId(userId, deploymentId);
    return NextResponse.json({ deploymentId, status }, { status: 202 });
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 402) {
      return NextResponse.json(
        {
          error:
            "You've reached the free plan's vault limit. Re-running a failed vault doesn't count — upgrade for more capacity.",
        },
        { status: 402 },
      );
    }
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
    // One backend call returns every deployment for this user (X-User-Id scoped),
    // replacing the old getUser + per-id fan-out (N+1).
    const deployments = await listVaultsUpstream(userId);
    // Quota mirrors the backend: only NON-FAILED deployments consume a slot, so
    // a user whose only vault failed sees 0 used and can retry.
    const used = deployments.filter((d) => d.status !== 'failed').length;
    return NextResponse.json({
      deployments,
      quota: { used, limit: FREE_VAULT_LIMIT },
    });
  } catch (err) {
    return errorJson(err);
  }
}
