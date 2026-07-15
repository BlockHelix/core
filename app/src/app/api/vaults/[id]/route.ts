import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDeploymentUpstream, UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`get:${userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const { id } = await params;

  try {
    // The backend scopes by X-User-Id and answers 404 if the caller doesn't own
    // the id, so its response is authoritative — no Clerk-metadata pre-check needed.
    const record = await getDeploymentUpstream(id, userId);
    return NextResponse.json(record);
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/vaults/:id]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
