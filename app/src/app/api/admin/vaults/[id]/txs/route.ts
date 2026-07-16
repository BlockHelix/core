import { NextResponse } from 'next/server';
import { getAdminUserId, getAdminVaultTxSources } from '@/lib/server/admin';
import { deployTxs, fetchVaultTransfers } from '@/lib/server/onchain-txs';
import { UpstreamError } from '@/lib/server/vault-factory';

export const runtime = 'nodejs';

// Admin-gated vault activity: deploy txs (from the DB record) + live transfers
// (Alchemy getAssetTransfers). All RPC access is server-side.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const src = await getAdminVaultTxSources(id);
    if (!src) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    const deploy = deployTxs(src.transactionHashes);
    const activity = src.boringVault ? await fetchVaultTransfers(src.boringVault) : [];
    return NextResponse.json({ txs: [...deploy, ...activity] });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/admin/vaults/:id/txs]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
