'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: '#0a0a0f',
          accentColor: '#22d3ee',
          walletChainType: 'solana-only',
        },
        loginMethods: ['wallet', 'email', 'google'],
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        solana: {
          cluster: 'devnet',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
