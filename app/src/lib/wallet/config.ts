// Reown AppKit + wagmi config. Base (8453) and Ethereum mainnet (1), with WalletConnect
// enabled so a Gnosis Safe can connect. This module is imported by the client-only
// WalletProvider; nothing here touches server secrets.
//
// Mainnet was missing here when chain 1 was enabled, so 'Switch to Ethereum mainnet' had no
// network to switch TO and silently did nothing — a chain absent from `networks` cannot be
// switched to, connected on, or read from, however correct the rest of the UI is.

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base, mainnet } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';

// Route client reads through our same-origin server proxy (/api/rpc) so the Alchemy
// key stays server-side. Relative in the browser; absolute for any SSR read.
const RPC_BASE = typeof window === 'undefined' ? 'https://blockhelix.tech/api/rpc' : '/api/rpc';
// The proxy routes upstream by ?chainId, so each transport must carry its own.
const rpcFor = (chainId: number) => `${RPC_BASE}?chainId=${chainId}`;

// NOTE: set NEXT_PUBLIC_REOWN_PROJECT_ID from https://dashboard.reown.com.
// The placeholder keeps `npm run build` green but WalletConnect will not work
// until a real project id is provided.
export const REOWN_PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? 'REPLACE_WITH_REOWN_PROJECT_ID';

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base, mainnet];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: REOWN_PROJECT_ID,
  ssr: true,
  transports: {
    [base.id]: http(rpcFor(base.id)),
    [mainnet.id]: http(rpcFor(mainnet.id)),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
