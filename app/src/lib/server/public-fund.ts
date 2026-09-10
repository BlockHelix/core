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
