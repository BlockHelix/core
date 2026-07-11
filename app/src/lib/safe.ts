import { createPublicClient, http, isAddress, type Address } from 'viem';
import { base } from 'viem/chains';

// Client-side preflight only. The vault-factory API re-validates the Safe
// on-chain at POST time, so this is purely UX — never trusted server-side.

const SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'VERSION',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export type SafeCheck =
  | { ok: true; version: string; threshold: number; owners: string[] }
  | { ok: false; reason: string };

function client() {
  const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

export async function checkSafeOnBase(address: string): Promise<SafeCheck> {
  if (!isAddress(address)) {
    return { ok: false, reason: 'Not a valid Ethereum address.' };
  }
  const addr = address as Address;
  const rpc = client();

  let code: string | undefined;
  try {
    code = await rpc.getCode({ address: addr });
  } catch {
    return { ok: false, reason: 'Could not reach Base RPC. Try again.' };
  }
  if (!code || code === '0x') {
    return {
      ok: false,
      reason: 'No contract at this address on Base — looks like an EOA. The vault admin must be a deployed Gnosis Safe.',
    };
  }

  try {
    const [owners, threshold, version] = await Promise.all([
      rpc.readContract({ address: addr, abi: SAFE_ABI, functionName: 'getOwners' }),
      rpc.readContract({ address: addr, abi: SAFE_ABI, functionName: 'getThreshold' }),
      rpc.readContract({ address: addr, abi: SAFE_ABI, functionName: 'VERSION' }),
    ]);
    if (owners.length === 0 || threshold === 0n) {
      return { ok: false, reason: 'Contract responds like a Safe but has no owners or a zero threshold.' };
    }
    return {
      ok: true,
      version,
      threshold: Number(threshold),
      owners: owners.map((o) => o as string),
    };
  } catch {
    return {
      ok: false,
      reason: 'Contract at this address does not implement the Safe interface (getOwners/getThreshold/VERSION).',
    };
  }
}
