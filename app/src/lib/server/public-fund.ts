const DEFAULT_API_URL = 'https://api.blockhelix.tech';

export interface PublicAgent {
  vault: string;
  name: string;
  symbol: string;
  chainId: number;
  baseAsset: string | null;
  navBase: number | null;
  navUsd: number | null;
  sharePriceLive: number | null;
  sharePriceOfficial: number | null;
  daysLive: number | null;
  grossCarryApy: number | null;
  deployedRatio: number | null;
  unmodelled: string[];
  books: Array<{
    market: string;
    leverage: number;
    ltv: number;
    lltv: number;
    bufferPp: number;
    oracleKind: 'linear-discount' | 'market' | null;
    /** How far the collateral price can fall before liquidation. */
    priceFallToLiqPct?: number | null;
    reversalHeadroomPp: number | null;
    verdict: 'ok' | 'warn' | 'reversing' | null;
  }>;
  drivers: { carry: number; mark: number; borrow: number; execution: number; net: number } | null;
  /** When the drivers were COMPUTED, which is not when the page was read. */
  driversComputedAt?: string | null;
  driversAgeHours?: number | null;
  driversStale?: boolean;
  driversNote?: string;
  /** Markdown inside navUsd that reverses on a known date, not a trading loss. */
  pendingRecovery?: { usd: number; byIso: string; note: string } | null;
  /** The official price moves at most one band per push, so a wide gap takes several pushes. */
  rateWalk?: { gapBps: number; pushesRemaining: number; convergedAtIso: string; direction: string; note: string } | null;
  deposits: 'closed';
}

// Unauthenticated upstream by design: it serves only what anyone holding the vault address could
// already read on chain. No key travels with this request, so the page can be static-revalidated.
export async function fetchAgents(): Promise<{ asOf: string; agents: PublicAgent[] } | null> {
  const url = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/public/fund/agents`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as { asOf: string; agents: PublicAgent[] };
  } catch {
    return null;
  }
}

/** A published vault as the public record page addresses it. No strategist, no pauser, no
 *  component addresses, no deployment status: name, chain, base asset and age. */
export interface PublishedVaultMeta {
  symbol: string;
  name: string;
  vault: string;
  chainId: number;
  /** Ticker, not the address. null when the backend cannot name the token. */
  baseAsset: string | null;
  daysLive: number | null;
  deposits: 'closed';
}

/** Not-published and could-not-read are different answers and the page renders them differently.
 *  Collapsing an outage into a 404 tells a reader the vault does not exist, which is a lie. */
export type PublishedVaultLookup =
  | { state: 'ok'; meta: PublishedVaultMeta }
  | { state: 'not-published' }
  | { state: 'unavailable' };

export async function fetchPublishedVault(symbol: string): Promise<PublishedVaultLookup> {
  const url = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/public/fund/vaults/${encodeURIComponent(symbol)}`, {
      next: { revalidate: 300 },
    });
    if (res.status === 404) return { state: 'not-published' };
    if (!res.ok) return { state: 'unavailable' };
    return { state: 'ok', meta: (await res.json()) as PublishedVaultMeta };
  } catch {
    return { state: 'unavailable' };
  }
}

/** Every published vault. Empty on any failure: the caller shows nothing rather than a stale list. */
export async function fetchPublishedVaults(): Promise<PublishedVaultMeta[]> {
  const url = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/public/fund/vaults`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { vaults?: PublishedVaultMeta[] };
    return Array.isArray(body.vaults) ? body.vaults : [];
  } catch {
    return [];
  }
}
