import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getVenueRiskUpstream, UpstreamError } from '@/lib/server/vault-factory';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Latest venue peg-health scan for the fund's live loop. null body = scanner has not run;
// the panel renders that as "not scanned", never as healthy.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`fund-risk:${userId}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 });
  }
  try {
    return NextResponse.json(await getVenueRiskUpstream(userId));
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
