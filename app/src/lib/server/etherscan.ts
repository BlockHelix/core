// Server-only helper that pulls a vault's recent on-chain activity from the
// Etherscan V2 multichain API (Base, chainid 8453) and normalises it into the
// shape the shared <TxTable> renders. The ETHERSCAN_API_KEY stays server-side.
//
// Shared by the admin route (/api/admin/vaults/:id/txs) and the owner-scoped
// customer route (/api/vaults/:id/txs) so both surfaces show identical activity.

import { formatUnits } from 'viem';
import type { NormalizedTx } from '@/lib/onchain-types';

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
const CHAIN_ID = 8453;

interface RawNormalTx {
  hash?: string;
  timeStamp?: string;
  from?: string;
  to?: string;
  value?: string;
  isError?: string;
  txreceipt_status?: string;
  functionName?: string;
  methodId?: string;
  input?: string;
}

interface RawTokenTx {
  hash?: string;
  timeStamp?: string;
  from?: string;
  to?: string;
  value?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}

// Etherscan answers { status, message, result }. status:"1" => result is an
// array; status:"0" => empty result / rate-limit (result is a string). We treat
// anything that isn't an array as "no rows" rather than an error.
function resultRows(body: unknown): unknown[] {
  if (!body || typeof body !== 'object') return [];
  const result = (body as { result?: unknown }).result;
  return Array.isArray(result) ? result : [];
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store' });
  return res.json().catch(() => null);
}

// "transfer(address,uint256)" -> "transfer"; falls back to methodId, and to
// "Transfer" for a plain value send (empty input).
function deriveMethod(t: RawNormalTx): string {
  const input = t.input ?? '';
  if (input === '' || input === '0x') return 'Transfer';
  const fn = (t.functionName ?? '').trim();
  if (fn) return fn.split('(')[0];
  const mid = (t.methodId ?? '').trim();
  return mid && mid !== '0x' ? mid : 'Contract call';
}

// Compact human amount: full precision, trailing zeros trimmed, tiny non-zero
// values shown as "<0.0001".
function displayAmount(raw: string, decimals: number): string {
  let value: bigint;
  try {
    value = BigInt(raw);
  } catch {
    return '0';
  }
  if (value === 0n) return '0';
  const s = formatUnits(value, decimals);
  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n > 0 && n < 0.0001) return '<0.0001';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  return s;
}

function normalizeNormal(t: RawNormalTx): NormalizedTx {
  return {
    hash: t.hash ?? '',
    method: deriveMethod(t),
    timeStamp: Number(t.timeStamp ?? 0),
    from: t.from ?? '',
    to: t.to ?? '',
    value: displayAmount(t.value ?? '0', 18),
    valueSymbol: 'ETH',
    isError: t.isError === '1' || t.txreceipt_status === '0',
    kind: 'native',
  };
}

function normalizeToken(t: RawTokenTx): NormalizedTx {
  const decimals = Number(t.tokenDecimal ?? '18') || 18;
  return {
    hash: t.hash ?? '',
    method: 'Transfer',
    timeStamp: Number(t.timeStamp ?? 0),
    from: t.from ?? '',
    to: t.to ?? '',
    value: displayAmount(t.value ?? '0', decimals),
    valueSymbol: t.tokenSymbol || 'TOKEN',
    isError: false,
    kind: 'token',
  };
}

// Fetch normal txs + ERC-20 transfers for `boringVault`, merge, de-dupe and
// return newest-first. Returns [] (never throws) when the key is missing or
// Etherscan is rate-limited/unreachable, so callers can render "No transactions".
export async function fetchVaultTxs(boringVault: string, limit = 40): Promise<NormalizedTx[]> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key || !boringVault) return [];

  const base = `${ETHERSCAN_V2}?chainid=${CHAIN_ID}&module=account&address=${boringVault}&sort=desc&page=1&offset=${limit}&apikey=${key}`;

  const [normalRes, tokenRes] = await Promise.allSettled([
    fetchJson(`${base}&action=txlist`),
    fetchJson(`${base}&action=tokentx`),
  ]);

  const normal =
    normalRes.status === 'fulfilled'
      ? resultRows(normalRes.value).map((r) => normalizeNormal(r as RawNormalTx))
      : [];
  const token =
    tokenRes.status === 'fulfilled'
      ? resultRows(tokenRes.value).map((r) => normalizeToken(r as RawTokenTx))
      : [];

  const seen = new Set<string>();
  const out: NormalizedTx[] = [];
  for (const t of [...normal, ...token].sort((a, b) => b.timeStamp - a.timeStamp)) {
    if (!t.hash) continue;
    const dedupe = `${t.hash}:${t.kind}:${t.from}:${t.to}:${t.value}:${t.valueSymbol}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(t);
  }
  return out.slice(0, limit);
}
