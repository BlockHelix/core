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
  carryByPosition?: {
    positions: Array<{ market: string; navShare: number; leverage: number; carryApy: number | null; contributionApy: number }>;
    idleNavShare?: number;
  } | null;
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
/**
 * The published vaults, and WHEN the API said they were true.
 *
 * asOf used to be dropped here, which left the page with no way to know the age of what it was
 * rendering. It showed "Updated just now" from the browser's clock instead, and on 2026-09-30
 * that sat beside vault ages twelve days out of date: the page was served from cache with a
 * stale-while-revalidate window of 365 days, so a failed revalidation simply kept serving.
 *
 * The timestamp travels with the data now. A page cannot claim freshness it has not measured.
 */
export async function fetchPublishedVaults(): Promise<{ vaults: PublishedVaultMeta[]; asOf: string | null }> {
  const url = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/public/fund/vaults`, { next: { revalidate: 300 } });
    if (!res.ok) return { vaults: [], asOf: null };
    const body = (await res.json()) as { vaults?: PublishedVaultMeta[]; asOf?: string };
    return {
      vaults: Array.isArray(body.vaults) ? body.vaults : [],
      asOf: typeof body.asOf === 'string' ? body.asOf : null,
    };
  } catch {
    return { vaults: [], asOf: null };
  }
}

/**
 * One published vault's headline figures, read on the SERVER.
 *
 * From /agents, not /vaults/:key/nav. The nav endpoint returns the on-chain composition — share
 * price, holdings, per-position risk — and carries none of navUsd, daysLive or the carry rate.
 * Pointing the summary card at it produced a card that correctly said every figure was
 * unreadable, which was the honesty guard working and the wiring being wrong.
 */
export interface PublicVaultHeadline {
  symbol: string;
  name: string;
  navUsd: number | null;
  sharePriceLive: number | null;
  daysLive: number | null;
  grossCarryApy: number | null;
  deployedRatio: number | null;
  baseAsset: string | null;
  navVsMarketVerdict: string | null;
  /** Thinnest liquidation buffer across this vault's books, in percentage points. */
  worstBufferPp: number | null;
  asOf: string | null;
}

export async function fetchPublicVaultHeadline(symbol: string): Promise<PublicVaultHeadline | null> {
  const url = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/public/fund/agents`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      asOf?: string;
      agents?: Array<Record<string, unknown>>;
    };
    const a = (body.agents ?? []).find((x) => x.symbol === symbol);
    if (!a) return null;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const books = Array.isArray(a.books) ? (a.books as Array<{ bufferPp?: number }>) : [];
    const buffers = books.map((b) => b.bufferPp).filter((b): b is number => typeof b === 'number');
    return {
      symbol,
      name: typeof a.name === 'string' ? a.name : symbol,
      navUsd: num(a.navUsd),
      sharePriceLive: num(a.sharePriceLive),
      daysLive: num(a.daysLive),
      grossCarryApy: num(a.grossCarryApy),
      deployedRatio: num(a.deployedRatio),
      baseAsset: typeof a.baseAsset === 'string' ? a.baseAsset : null,
      navVsMarketVerdict:
        a.navVsMarket && typeof (a.navVsMarket as { verdict?: unknown }).verdict === 'string'
          ? ((a.navVsMarket as { verdict: string }).verdict)
          : null,
      worstBufferPp: buffers.length ? Math.min(...buffers) : null,
      asOf: typeof body.asOf === 'string' ? body.asOf : null,
    };
  } catch {
    // Null, never a shape full of zeros: the card shows nothing rather than a false figure.
    return null;
  }
}

export interface SharePricePoint {
  at: string;
  sharePrice: number;
  block: number;
  txHash: string;
}

export interface SharePriceHistory {
  startSharePrice: number | null;
  points: SharePricePoint[];
  asOf: string;
}

/** Every official share price push, from the accountant's own on-chain events. Null on any failure. */
export async function fetchSharePriceHistory(symbol: string): Promise<SharePriceHistory | null> {
  const url = (process.env.VAULT_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/public/fund/vaults/${encodeURIComponent(symbol)}/share-price`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as SharePriceHistory;
    return Array.isArray(body.points) ? body : null;
  } catch {
    return null;
  }
}
