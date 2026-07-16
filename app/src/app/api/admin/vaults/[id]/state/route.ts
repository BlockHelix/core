import { NextResponse } from 'next/server';
import { getAdminUserId, getAdminVaultAddresses } from '@/lib/server/admin';
import { readVaultState } from '@/lib/server/vault-state';
import { UpstreamError } from '@/lib/server/vault-factory';

export const runtime = 'nodejs';

// Admin-gated live on-chain state for one vault. All RPC access is server-side.
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
    const state = await readVaultState(addresses);
    return NextResponse.json(state);
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/admin/vaults/:id/state]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
