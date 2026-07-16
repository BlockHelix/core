import { NextResponse } from 'next/server';
import { getAdminUserId, getAdminVaultAddresses } from '@/lib/server/admin';
import { fetchVaultTxs } from '@/lib/server/etherscan';
import { UpstreamError } from '@/lib/server/vault-factory';

export const runtime = 'nodejs';

// Admin-gated Etherscan activity for one vault. ETHERSCAN_API_KEY stays server-side.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const addresses = await getAdminVaultAddresses(id);
    if (!addresses) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    const boringVault = addresses.boringVault;
    if (!boringVault) {
      return NextResponse.json({ txs: [] });
    }
    const txs = await fetchVaultTxs(boringVault);
    return NextResponse.json({ txs });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/admin/vaults/:id/txs]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
