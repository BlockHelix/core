import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteKey } from '@/lib/server/api-account';
import { UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`keys:delete:${userId}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing key id' }, { status: 400 });
  }

  try {
    await deleteKey(userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/keys/:id]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
