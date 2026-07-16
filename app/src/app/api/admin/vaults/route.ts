import { NextResponse } from 'next/server';
import { getAdminUserId, listAdminVaults } from '@/lib/server/admin';
import { UpstreamError } from '@/lib/server/vault-factory';

export const runtime = 'nodejs';

export async function GET() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const vaults = await listAdminVaults();
    return NextResponse.json({ vaults });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/admin/vaults]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
