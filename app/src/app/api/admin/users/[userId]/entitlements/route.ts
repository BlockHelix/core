import { NextResponse } from 'next/server';
import { clearEntitlements, getAdminUserId, setEntitlements } from '@/lib/server/admin';
import { UpstreamError } from '@/lib/server/vault-factory';
import type { AdminEntitlementInput } from '@/lib/admin-types';

export const runtime = 'nodejs';

function errorJson(err: unknown, tag: string): NextResponse {
  if (err instanceof UpstreamError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(tag, err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

function validate(body: unknown): { error: string } | { input: AdminEntitlementInput } {
  if (!body || typeof body !== 'object') return { error: 'Invalid JSON body' };
  const b = body as Record<string, unknown>;
  const input: AdminEntitlementInput = {};

  if (b.unlimited !== undefined) {
    if (typeof b.unlimited !== 'boolean') return { error: 'unlimited must be a boolean' };
    input.unlimited = b.unlimited;
  }
  if (b.vaultsTotal !== undefined && b.vaultsTotal !== null && b.vaultsTotal !== '') {
    const n = Number(b.vaultsTotal);
    if (!Number.isInteger(n) || n < 0) return { error: 'vaultsTotal must be a non-negative integer' };
    input.vaultsTotal = n;
  }
  if (b.tradesPerDay !== undefined && b.tradesPerDay !== null && b.tradesPerDay !== '') {
    const n = Number(b.tradesPerDay);
    if (!Number.isInteger(n) || n < 0) return { error: 'tradesPerDay must be a non-negative integer' };
    input.tradesPerDay = n;
  }
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== 'string' || b.note.length > 280) return { error: 'note must be a string up to 280 chars' };
    if (b.note.trim()) input.note = b.note.trim();
  }
  return { input };
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId } = await params;
  const body = await req.json().catch(() => null);
  const result = validate(body);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  try {
    await setEntitlements(userId, result.input);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, '[api/admin/entitlements:POST]');
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const adminId = await getAdminUserId();
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId } = await params;
  try {
    await clearEntitlements(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, '[api/admin/entitlements:DELETE]');
  }
}
