import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getVenueAuditUpstream, UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Latest cross-chain venue audit table. null = the sweep has not run; the page renders that
// as "no audit yet", never as an empty universe.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`venues:${userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }
  try {
    return NextResponse.json(await getVenueAuditUpstream(userId));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
