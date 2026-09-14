import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEFAULT_API_URL = 'https://api.blockhelix.tech';

// The panels of the published record, and nothing else. A catch-all that forwarded whatever
// segment it was handed would relay every backend route that ever lands under public/fund,
// including ones added later with no thought for an anonymous reader.
const PANELS = new Set([
  'nav',
  'pnl-attribution',
  'pnl-attribution/series',
  'rate-attribution',
  'trade-reconciliation',
  'peg-health',
]);

// No Clerk call, no service key, no owner resolution. The upstream is itself unauthenticated and
// gated by its own published-vault allowlist, so an unpublished symbol 404s upstream.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string; panel: string[] }> },
) {
  const { symbol, panel } = await params;
  const name = (panel ?? []).join('/');
  if (!PANELS.has(name)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const base = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/public/fund/vaults/${encodeURIComponent(symbol)}/${name}`, {
      next: { revalidate: 60 },
    });
  } catch {
    return NextResponse.json({ error: 'The record service is unreachable' }, { status: 502 });
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const status = res.status === 404 ? 404 : res.status >= 400 && res.status < 500 ? res.status : 502;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'The record service failed' }, { status });
  }
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=240' },
  });
}
