// Client-safe types shared by the admin + customer on-chain panels and the Next
// route handlers that read chain/Etherscan data. No server-only imports here.

export interface NormalizedTx {
  hash: string;
  method: string;
  timeStamp: number; // unix seconds
  from: string;
  to: string;
  value: string; // display-ready amount
  valueSymbol: string; // 'ETH' or token symbol
  isError: boolean;
  kind: 'native' | 'token';
}

export interface TxListResponse {
  txs: NormalizedTx[];
  message?: string;
}

export interface TokenBalance {
  symbol: string;
  address: string | null; // null for native ETH
  decimals: number;
  raw: string; // bigint as string
  formatted: string;
}

export interface VaultState {
  sharePrice: { raw: string; formatted: string } | null;
  baseSymbol: string | null;
  baseDecimals: number | null;
  paused: {
    teller: boolean | null;
    manager: boolean | null;
    accountant: boolean | null;
  };
  shares: { raw: string; formatted: string; decimals: number } | null;
  tvl: { raw: string; formatted: string } | null;
  balances: TokenBalance[];
  error?: string;
}
