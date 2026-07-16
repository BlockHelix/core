'use client';

import { type ReactNode } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { base } from '@reown/appkit/networks';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { networks, REOWN_PROJECT_ID, wagmiAdapter, wagmiConfig } from '@/lib/wallet/config';

const queryClient = new QueryClient();

// createAppKit registers the modal singleton. It must run once, at module scope,
// before any component renders the connect button. Mounted ONLY under /admin.
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: REOWN_PROJECT_ID,
  defaultNetwork: base,
  themeMode: 'light',
  metadata: {
    name: 'BlockHelix Admin',
    description: 'BlockHelix internal vault administration',
    url: 'https://blockhelix.tech',
    icons: ['https://blockhelix.tech/favicon.ico'],
  },
  // Wallet-only: no email/social login. WalletConnect stays on so a Gnosis Safe
  // can pair via the mobile/desktop Safe app.
  features: { analytics: false, email: false, socials: false },
});

export default function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
