import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDeploymentUpstream, getVaultNavUpstream, UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Live NAV snapshot for a vault the caller owns. Resolves the deployment (owner-scoped by the
// backend) to the boringVault address, then reads the public /nav endpoint.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`nav:${userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const { id } = await params;

  try {
    const record = await getDeploymentUpstream(id, userId);
    const vault = record.addresses?.boringVault;
    if (!vault) {
      return NextResponse.json({ error: 'Vault is not deployed yet' }, { status: 409 });
    }
    const nav = await getVaultNavUpstream(vault, userId);
    return NextResponse.json(nav);
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/vaults/:id/nav]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
