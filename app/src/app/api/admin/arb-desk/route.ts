import { NextResponse } from 'next/server';
import { getAdminUserId, getArbDesk } from '@/lib/server/admin';
import { UpstreamError } from '@/lib/server/vault-factory';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await getAdminUserId())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json(await getArbDesk());
  } catch (err) {
    if (err instanceof UpstreamError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
