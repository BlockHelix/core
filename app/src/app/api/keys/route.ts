import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createKey, listKeys } from '@/lib/server/api-account';
import { UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';
import { API_KEY_NAME_RE, MAX_API_KEY_NAME_LEN } from '@/lib/api-keys-types';

export const runtime = 'nodejs';

function errorJson(err: unknown): NextResponse {
  if (err instanceof UpstreamError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[api/keys]', err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`keys:get:${userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }
  try {
    const keys = await listKeys(userId);
    return NextResponse.json({ keys });
  } catch (err) {
    return errorJson(err);
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`keys:post:${userId}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > MAX_API_KEY_NAME_LEN || !API_KEY_NAME_RE.test(name)) {
    return NextResponse.json(
      { error: `Key name must be 1-${MAX_API_KEY_NAME_LEN} chars: letters, numbers, spaces, ._-` },
      { status: 400 },
    );
  }

  try {
    const created = await createKey(userId, name);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorJson(err);
  }
}
