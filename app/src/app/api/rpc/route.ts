import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// Server-side JSON-RPC proxy for Base reads. The Alchemy key lives in a server-only
// env var, so it never ships in the client bundle — the browser talks to this
// same-origin endpoint instead. Reads only (wallet writes go through the user's own
// wallet provider, never here) and rate-limited, so it can't be turned into an open
// relay on our RPC quota.
// Per-chain upstreams. ?chainId=1 routes to mainnet; anything else (and no param) stays on
// Base, so existing callers are unaffected.
const UPSTREAMS: Record<number, string> = {
  8453: process.env.RPC_PROXY_URL || process.env.BASE_RPC_URL || '',
  1: process.env.MAINNET_RPC_URL || '',
};
const upstreamFor = (req: Request): string => {
  const raw = new URL(req.url).searchParams.get('chainId');
  const chainId = raw ? Number(raw) : 8453;
  return UPSTREAMS[chainId] ?? '';
};

// An unconfigured chain and an unreachable node are different failures needing different
// fixes, and reporting the first as the second sends you debugging the wrong thing.
const chainIdOf = (req: Request): number => {
  const raw = new URL(req.url).searchParams.get('chainId');
  return raw ? Number(raw) : 8453;
};

// The read methods viem/wagmi issue. Anything else — above all eth_sendRawTransaction
// — is rejected.
const ALLOWED = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_call',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getLogs',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getTransactionCount',
  'eth_getBlockReceipts',
  'eth_getBlockTransactionCountByNumber',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getProof',
  'net_version',
  'web3_clientVersion',
]);

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'unknown';
}

type RpcReq = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

export async function POST(req: Request) {
  const UPSTREAM = upstreamFor(req);
  if (!UPSTREAM) {
    console.error(`[api/rpc] no upstream configured for chain ${chainIdOf(req)} — check the env allowlist in amplify.yml`);
    return NextResponse.json({ error: 'RPC upstream not configured' }, { status: 503 });
  }
  if (!rateLimit(`rpc:${clientIp(req)}`, 300, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: RpcReq | RpcReq[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const batch = Array.isArray(body) ? body : [body];
  if (batch.length === 0 || batch.length > 50) {
    return NextResponse.json({ error: 'Empty or oversized batch' }, { status: 400 });
  }
  const bad = batch.find((r) => typeof r?.method !== 'string' || !ALLOWED.has(r.method));
  if (bad) {
    return NextResponse.json({ error: `Method not allowed: ${bad?.method ?? 'unknown'}` }, { status: 403 });
  }

  try {
    const res = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return NextResponse.json({ error: 'Upstream RPC error' }, { status: 502 });
  }
}
