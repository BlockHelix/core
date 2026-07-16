// Server-only reader for a vault's live on-chain state on Base (8453) via viem.
// Uses the server-only Alchemy RPC (BASE_RPC_URL); all reads run here, never in the
// browser. Component addresses come from the vault record's `addresses` map.

import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from 'viem';
import type { Address } from 'viem';
import { base } from 'viem/chains';
import type { TokenBalance, VaultState } from '@/lib/onchain-types';

const RPC_URL =
  process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

// Base-mainnet tokens we surface a balance for. Decimals hardcoded (well-known)
// to avoid extra reads.
const TOKENS: { symbol: string; address: Address; decimals: number }[] = [
  { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6 },
  { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  { symbol: 'cbBTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8 },
];

const ACCOUNTANT_ABI = [
  { type: 'function', name: 'getRate', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'base', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'accountantState',
    stateMutability: 'view',
    inputs: [],
    // Order matters: isPaused is index 8. Field int-sizes match
    // AccountantWithRateProviders.AccountantState so viem can decode.
    outputs: [
      { name: 'payoutAddress', type: 'address' },
      { name: 'highwaterMark', type: 'uint96' },
      { name: 'feesOwedInBase', type: 'uint128' },
      { name: 'totalSharesLastUpdate', type: 'uint128' },
      { name: 'exchangeRate', type: 'uint96' },
      { name: 'allowedExchangeRateChangeUpper', type: 'uint16' },
      { name: 'allowedExchangeRateChangeLower', type: 'uint16' },
      { name: 'lastUpdateTimestamp', type: 'uint64' },
      { name: 'isPaused', type: 'bool' },
      { name: 'minimumUpdateDelayInSeconds', type: 'uint24' },
      { name: 'managementFee', type: 'uint16' },
      { name: 'performanceFee', type: 'uint16' },
    ],
  },
] as const;

const PAUSED_ABI = [
  { type: 'function', name: 'isPaused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const;

function addr(value: string | null | undefined): Address | null {
  return value && isAddress(value) ? (value as Address) : null;
}

// Any failed read (bad address, non-conforming contract, RPC hiccup) resolves to
// null so one missing value never blanks the whole panel.
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function trimAmount(raw: bigint, decimals: number): string {
  const s = formatUnits(raw, decimals);
  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n > 0 && n < 0.0001) return '<0.0001';
    return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  return s;
}

function emptyState(error?: string): VaultState {
  return {
    sharePrice: null,
    baseSymbol: null,
    baseDecimals: null,
    paused: { teller: null, manager: null, accountant: null },
    shares: null,
    tvl: null,
    balances: [],
    error,
  };
}

export async function readVaultState(addresses: Record<string, string | null>): Promise<VaultState> {
  const boringVault = addr(addresses.boringVault);
  const accountant = addr(addresses.accountant);
  const teller = addr(addresses.teller);
  const manager = addr(addresses.manager);

  if (!boringVault) return emptyState('Vault not deployed yet.');

  const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

  const [rate, baseAsset, accountantState, tellerPaused, managerPaused, totalSupply, vaultDecimals, ethBalance] =
    await Promise.all([
      accountant
        ? safe(() => client.readContract({ address: accountant, abi: ACCOUNTANT_ABI, functionName: 'getRate' }))
        : null,
      accountant
        ? safe(() => client.readContract({ address: accountant, abi: ACCOUNTANT_ABI, functionName: 'base' }))
        : null,
      accountant
        ? safe(() => client.readContract({ address: accountant, abi: ACCOUNTANT_ABI, functionName: 'accountantState' }))
        : null,
      teller
        ? safe(() => client.readContract({ address: teller, abi: PAUSED_ABI, functionName: 'isPaused' }))
        : null,
      manager
        ? safe(() => client.readContract({ address: manager, abi: PAUSED_ABI, functionName: 'isPaused' }))
        : null,
      safe(() => client.readContract({ address: boringVault, abi: erc20Abi, functionName: 'totalSupply' })),
      safe(() => client.readContract({ address: boringVault, abi: erc20Abi, functionName: 'decimals' })),
      safe(() => client.getBalance({ address: boringVault })),
    ]);

  // accountantState decodes to a named tuple; isPaused is index 8.
  const accountantPaused =
    accountantState && typeof accountantState[8] === 'boolean' ? accountantState[8] : null;

  // Base-asset metadata (symbol + decimals) needs the address from the first read.
  const baseAddr = addr(baseAsset as string | null);
  const [baseDecimalsRaw, baseSymbolRaw] = baseAddr
    ? await Promise.all([
        safe(() => client.readContract({ address: baseAddr, abi: erc20Abi, functionName: 'decimals' })),
        safe(() => client.readContract({ address: baseAddr, abi: erc20Abi, functionName: 'symbol' })),
      ])
    : [null, null];
  const baseDecimals = baseDecimalsRaw != null ? Number(baseDecimalsRaw) : null;
  const baseSymbol = baseSymbolRaw != null ? String(baseSymbolRaw) : null;

  // Token balances held by the vault.
  const tokenBalances = await Promise.all(
    TOKENS.map((t) =>
      safe(() => client.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [boringVault] })),
    ),
  );

  const priceDecimals = baseDecimals ?? (vaultDecimals != null ? Number(vaultDecimals) : 18);
  const sharePrice =
    rate != null ? { raw: rate.toString(), formatted: trimAmount(rate, priceDecimals) } : null;

  const shares =
    totalSupply != null && vaultDecimals != null
      ? {
          raw: totalSupply.toString(),
          formatted: trimAmount(totalSupply, Number(vaultDecimals)),
          decimals: Number(vaultDecimals),
        }
      : null;

  // TVL (base units) ~= totalSupply * getRate / 10^vaultDecimals.
  let tvl: VaultState['tvl'] = null;
  if (rate != null && totalSupply != null && vaultDecimals != null) {
    const tvlRaw = (totalSupply * rate) / 10n ** BigInt(Number(vaultDecimals));
    tvl = { raw: tvlRaw.toString(), formatted: trimAmount(tvlRaw, priceDecimals) };
  }

  const balances: TokenBalance[] = [];
  const eth = (ethBalance ?? 0n) as bigint;
  balances.push({ symbol: 'ETH', address: null, decimals: 18, raw: eth.toString(), formatted: trimAmount(eth, 18) });
  TOKENS.forEach((t, i) => {
    const bal = tokenBalances[i];
    if (bal == null) return;
    balances.push({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
      raw: bal.toString(),
      formatted: trimAmount(bal, t.decimals),
    });
  });

  return {
    sharePrice,
    baseSymbol,
    baseDecimals,
    paused: { teller: tellerPaused, manager: managerPaused, accountant: accountantPaused },
    shares,
    tvl,
    balances,
  };
}
