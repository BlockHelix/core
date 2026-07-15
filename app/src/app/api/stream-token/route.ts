import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mintStreamTokenUpstream, UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Proxies the browser's request for a stream token: authenticates the Clerk
// session, then mints a short-lived HMAC token from the backend using the
// server-only service key. Returns only the token + public events URL to the
// client — VAULT_API_KEY never reaches the browser.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`stream-token:${userId}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }

  try {
    const { token, expiresIn, streamUrl } = await mintStreamTokenUpstream(userId);
    return NextResponse.json({ token, expiresIn, streamUrl });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/stream-token]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
