// Reown AppKit + wagmi config for the admin section. Base (8453) only, with
// WalletConnect enabled so a Gnosis Safe can connect. This module is imported
// by the client-only WalletProvider; nothing here touches server secrets.

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';

// Route client reads through our same-origin server proxy (/api/rpc) so the Alchemy
// key stays server-side. Relative in the browser; absolute for any SSR read.
const RPC_PROXY = typeof window === 'undefined' ? 'https://blockhelix.tech/api/rpc' : '/api/rpc';

// NOTE: set NEXT_PUBLIC_REOWN_PROJECT_ID from https://dashboard.reown.com.
// The placeholder keeps `npm run build` green but WalletConnect will not work
// until a real project id is provided.
export const REOWN_PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? 'REPLACE_WITH_REOWN_PROJECT_ID';

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: REOWN_PROJECT_ID,
  ssr: true,
  transports: { [base.id]: http(RPC_PROXY) },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
