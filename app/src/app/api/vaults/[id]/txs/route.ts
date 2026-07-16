import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDeploymentUpstream, UpstreamError } from '@/lib/server/vault-factory';
import { fetchVaultTxs } from '@/lib/server/etherscan';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Owner-scoped vault activity. Ownership is proven by the per-user backend proxy
// (getDeploymentUpstream answers 404 unless the caller owns the id); only then do
// we read that vault's txs from Etherscan server-side. ETHERSCAN_API_KEY never
// reaches the browser.
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
    if (!boringVault) {
      return NextResponse.json({ txs: [] });
    }
    const txs = await fetchVaultTxs(boringVault);
    return NextResponse.json({ txs });
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
