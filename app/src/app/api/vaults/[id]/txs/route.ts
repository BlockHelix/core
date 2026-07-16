import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDeploymentUpstream, UpstreamError } from '@/lib/server/vault-factory';
import { deployTxs, fetchVaultTransfers } from '@/lib/server/onchain-txs';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Owner-scoped vault activity: deploy txs (from the record) + live transfers
// (Alchemy getAssetTransfers). Ownership is proven by the per-user backend proxy
// (getDeploymentUpstream answers 404 unless the caller owns the id).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`txs:${userId}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const { id } = await params;
  try {
    const record = await getDeploymentUpstream(id, userId);
    const boringVault = record.addresses?.boringVault;
    const [deploy, activity] = await Promise.all([
      deployTxs(record.transactionHashes),
      boringVault ? fetchVaultTransfers(boringVault) : Promise.resolve([]),
    ]);
    return NextResponse.json({ txs: [...deploy, ...activity] });
  } catch (err) {
    if (err instanceof UpstreamError) {
      // Not owned / not found -> treat as forbidden so we never leak another
      // user's vault activity.
      if (err.status === 404) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/vaults/:id/txs]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
