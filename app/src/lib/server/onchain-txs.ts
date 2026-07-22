// Server-only vault activity feed. Uses the Alchemy Base RPC
// (server-only BASE_RPC_URL) via alchemy_getAssetTransfers — free on Base, no
// Etherscan/paid plan. Deploy transactions (0-value contract calls that transfer
// APIs don't surface) come from the deployment record's transactionHashes.

import { keccak256, toBytes, slice, decodeFunctionData } from 'viem';
import type { NormalizedTx } from '@/lib/onchain-types';

// Server-only Alchemy endpoint preferred (getAssetTransfers + large JSON-RPC batches need it,
// and the key stays off the client). Falls back to the public client RPC / base.org.
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Decode a tx's real method from its calldata selector. Deploy/admin/trade calls get their real
// function name; a strategist merkle-manage call is unwrapped to the inner action (supply / swap /
// withdraw), which is the meaningful function. Anything unknown shows its raw 4-byte selector
// (Etherscan-style) — never a made-up label.
const SIGNATURES = [
  // deploy + admin
  'deployContract(string,bytes,bytes,uint256)',
  'setUserRole(address,uint8,bool)',
  'setRoleCapability(uint8,address,bytes4,bool)',
  'setPublicCapability(address,bytes4,bool)',
  'setManageRoot(address,bytes32)',
  'setAuthority(address)',
  'transferOwnership(address)',
  'setBeforeTransferHook(address)',
  'setShareLockPeriod(uint64)',
  'setPullFundsFromVault(bool)',
  'updateExchangeRate(uint96)',
  'pause()',
  'unpause()',
  // trades + vault actions
  'manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])',
  'approve(address,uint256)',
  'transfer(address,uint256)',
  'supply(address,uint256,address,uint16)',
  'withdraw(address,uint256,address)',
  'exactInput((bytes,address,uint256,uint256))',
  'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',
  'deposit(address,uint256,uint256)',
  'bulkDeposit(address,uint256,uint256,address)',
  'bulkWithdraw(address,uint256,uint256,address)',
];

const selectorOf = (sig: string): string => slice(keccak256(toBytes(sig)), 0, 4);
const nameOf = (sig: string): string => sig.slice(0, sig.indexOf('('));

const KNOWN_SELECTORS: Record<string, string> = Object.fromEntries(
  SIGNATURES.map((sig) => [selectorOf(sig), nameOf(sig)]),
);
const MANAGE_SELECTOR = selectorOf(
  'manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])',
);
const MANAGE_ABI = [
  {
    type: 'function',
    name: 'manageVaultWithMerkleVerification',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'manageProofs', type: 'bytes32[][]' },
      { name: 'decodersAndSanitizers', type: 'address[]' },
      { name: 'targets', type: 'address[]' },
      { name: 'targetData', type: 'bytes[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const;

function decodeMethod(input?: string): string {
  if (!input || input.length < 10) return '—';
  const selector = input.slice(0, 10).toLowerCase();
  // A strategist trade is a manage call wrapping approve + the real action — surface the action.
  if (selector === MANAGE_SELECTOR) {
    try {
      const { args } = decodeFunctionData({ abi: MANAGE_ABI, data: input as `0x${string}` });
      const legs = (args[3] as string[] | undefined) ?? [];
      const actions = legs
        .map((d) => KNOWN_SELECTORS[d.slice(0, 10).toLowerCase()] ?? d.slice(0, 10))
        .filter((n) => n !== 'approve');
      if (actions.length) return actions[actions.length - 1];
    } catch {
      /* fall through to the wrapper name */
    }
    return 'manageVaultWithMerkleVerification';
  }
  return KNOWN_SELECTORS[selector] ?? selector;
}

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

// A minimal JSON-RPC tx shape (from eth_getTransactionByHash).
interface RawTx {
  from?: string;
  to?: string | null;
  value?: string;
  blockNumber?: string;
  input?: string;
}

// Batched JSON-RPC (Alchemy accepts request arrays). Chunked to stay under batch
// limits; never throws — missing entries stay null and the row degrades gracefully.
async function rpcBatch(calls: { method: string; params: unknown[] }[]): Promise<unknown[]> {
  const out: unknown[] = new Array(calls.length).fill(null);
  const CHUNK = 50;
  for (let start = 0; start < calls.length; start += CHUNK) {
    const chunk = calls.slice(start, start + CHUNK);
    try {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(chunk.map((c, i) => ({ id: i, jsonrpc: '2.0', ...c }))),
      });
      const body = await res.json().catch(() => null);
      if (Array.isArray(body)) {
        const byId = new Map(body.map((r: { id?: number; result?: unknown }) => [r.id, r.result]));
        chunk.forEach((_, i) => {
          out[start + i] = byId.get(i) ?? null;
        });
      }
    } catch {
      /* leave nulls for this chunk */
    }
  }
  return out;
}

// Deployment transactions from the record, enriched via batched RPC so the shared
// <TxTable> shows real Age / From→To / Value (not just the hash). Deploy calls are
// 0-value contract calls, so Value is typically 0.
export async function deployTxs(hashes: string[]): Promise<NormalizedTx[]> {
  const list = hashes.filter(Boolean);
  if (list.length === 0) return [];

  const txs = (await rpcBatch(
    list.map((h) => ({ method: 'eth_getTransactionByHash', params: [h] })),
  )) as (RawTx | null)[];

  const blockNums = Array.from(
    new Set(txs.map((t) => t?.blockNumber).filter((b): b is string => !!b)),
  );
  const blocks = (await rpcBatch(
    blockNums.map((bn) => ({ method: 'eth_getBlockByNumber', params: [bn, false] })),
  )) as ({ timestamp?: string } | null)[];
  const blockTs = new Map<string, number>();
  blockNums.forEach((bn, i) => {
    const ts = blocks[i]?.timestamp;
    if (ts) blockTs.set(bn, parseInt(ts, 16));
  });

  return list.map((hash, i) => {
    const tx = txs[i];
    const wei = tx?.value ? BigInt(tx.value) : 0n;
    return {
      hash,
      method: decodeMethod(tx?.input),
      timeStamp: tx?.blockNumber ? (blockTs.get(tx.blockNumber) ?? 0) : 0,
      from: tx?.from ?? '',
      to: tx?.to ?? '',
      value: wei === 0n ? '0' : (Number(wei) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 6 }),
      valueSymbol: wei === 0n ? '' : 'ETH',
      isError: false,
      kind: 'deploy' as const,
    };
  });
}
