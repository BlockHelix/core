import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getUserDeploymentIds,
  requeueVaultUpstream,
  UpstreamError,
} from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Retry (requeue) an existing deployment — same vault, no new quota slot.
// Verifies the id belongs to the signed-in user, then forwards to the backend
// with the service key + user id. `?force=true` is passed straight through.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`requeue:${userId}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const { id } = await params;
  const force = new URL(req.url).searchParams.get('force') === 'true';

  try {
    const ids = await getUserDeploymentIds(userId);
    if (!ids.includes(id)) {
      // Same response as a missing record so ids can't be probed.
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }
    const result = await requeueVaultUpstream(id, userId, force);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/vaults/:id/requeue]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
