import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUsage } from '@/lib/server/api-account';
import { UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`usage:get:${userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }
  try {
    const usage = await getUsage(userId);
    return NextResponse.json(usage);
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/account/usage]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
