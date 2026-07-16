// Server-only vault activity feed. Uses the Alchemy Base RPC
// (NEXT_PUBLIC_BASE_RPC_URL) via alchemy_getAssetTransfers — free on Base, no
// Etherscan/paid plan. Deploy transactions (0-value contract calls that transfer
// APIs don't surface) come from the deployment record's transactionHashes.

import type { NormalizedTx } from '@/lib/onchain-types';

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const CATEGORIES = ['external', 'erc20', 'erc721', 'erc1155'];

interface RawTransfer {
  blockNum?: string;
  uniqueId?: string;
  hash?: string;
  from?: string;
  to?: string | null;
  value?: number | null;
  asset?: string | null;
  category?: string;
  metadata?: { blockTimestamp?: string | null };
}

// One alchemy_getAssetTransfers POST. Never throws — returns [] on any RPC error
// (including non-Alchemy RPCs that don't support the method).
async function getAssetTransfers(params: Record<string, unknown>): Promise<RawTransfer[]> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'alchemy_getAssetTransfers', params: [params] }),
    });
    const body = await res.json().catch(() => null);
    const transfers = body?.result?.transfers;
    return Array.isArray(transfers) ? (transfers as RawTransfer[]) : [];
  } catch {
    return [];
  }
}

function methodLabel(category: string): string {
  if (!category) return 'transfer';
  return category === 'external' ? 'transfer' : `${category} transfer`;
}

function formatValue(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value === 0) return '0';
  if (value > 0 && value < 0.0001) return '<0.0001';
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function toTimeStamp(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function normalize(t: RawTransfer): NormalizedTx {
  const isNft = t.category === 'erc721' || t.category === 'erc1155';
  return {
    hash: t.hash ?? '',
    method: methodLabel(t.category ?? ''),
    timeStamp: toTimeStamp(t.metadata?.blockTimestamp),
    from: t.from ?? '',
    to: t.to ?? '',
    value: isNft ? '—' : formatValue(t.value),
    valueSymbol: isNft ? '' : (t.asset ?? ''),
    isError: false,
    kind: 'transfer',
  };
}

// Deposits / withdrawals / trades to & from the vault, merged newest-first.
export async function fetchVaultTransfers(vault: string, limit = 40): Promise<NormalizedTx[]> {
  if (!vault) return [];
  const common = { category: CATEGORIES, withMetadata: true, maxCount: '0x64', order: 'desc' };
  const [incoming, outgoing] = await Promise.all([
    getAssetTransfers({ ...common, toAddress: vault }),
    getAssetTransfers({ ...common, fromAddress: vault }),
  ]);

  const seen = new Set<string>();
  const merged: RawTransfer[] = [];
  for (const t of [...incoming, ...outgoing]) {
    const key = t.uniqueId || t.hash || '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(t);
  }
  merged.sort((a, b) => {
    const an = a.blockNum ? BigInt(a.blockNum) : 0n;
    const bn = b.blockNum ? BigInt(b.blockNum) : 0n;
    return an < bn ? 1 : an > bn ? -1 : 0;
  });
  return merged.slice(0, limit).map(normalize);
}

// Deployment transactions from the record. Not RPC-enriched (a vault can have
// ~100 of these) — hash + "deploy" label is enough; the shared <TxTable> links
// each to Basescan.
export function deployTxs(hashes: string[]): NormalizedTx[] {
  return hashes.filter(Boolean).map((hash) => ({
    hash,
    method: 'deploy',
    timeStamp: 0,
    from: '',
    to: '',
    value: '—',
    valueSymbol: '',
    isError: false,
    kind: 'deploy',
  }));
}
