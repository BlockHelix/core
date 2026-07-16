// Reown AppKit + wagmi config for the admin section. Base (8453) only, with
// WalletConnect enabled so a Gnosis Safe can connect. This module is imported
// by the client-only WalletProvider; nothing here touches server secrets.

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

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
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
