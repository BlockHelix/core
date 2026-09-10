import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { UpstreamError } from '@/lib/server/vault-factory';
import { getTradeReconciliationUpstream } from '@/lib/server/trade-reconciliation';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Predicted-versus-realized for one vault's trades. Ownership is proven upstream: the backend
// scopes every trade query by the caller's user id, so another user's book returns empty rather
// than leaking.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`trade-reconciliation:${userId}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const { id } = await params;
  try {
    return NextResponse.json(await getTradeReconciliationUpstream(id, userId));
  } catch (err) {
    if (err instanceof UpstreamError) {
      if (err.status === 404) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/vaults/:id/trade-reconciliation]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
