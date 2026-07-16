import { NextResponse } from 'next/server';
import { deleteDeployment, getAdminUserId } from '@/lib/server/admin';
import { UpstreamError } from '@/lib/server/vault-factory';

export const runtime = 'nodejs';

function errorJson(err: unknown, tag: string): NextResponse {
  if (err instanceof UpstreamError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(tag, err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

// Delete a deployment record (DB-only; the on-chain vault is immutable and
// unaffected). Admin-gated here, then proxied to the backend admin surface.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    await deleteDeployment(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorJson(err, '[api/admin/vaults/:id:DELETE]');
  }
}
