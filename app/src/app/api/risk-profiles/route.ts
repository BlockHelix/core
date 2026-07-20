import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listRiskProfilesUpstream, UpstreamError } from '@/lib/server/vault-factory';

export const runtime = 'nodejs';

// Curated trade-policy profiles for the deploy dropdown. Proxies the backend (its
// merkle templates are the source of truth) so the shown permissions match the root.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ profiles: await listRiskProfilesUpstream(userId) });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/risk-profiles]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
