'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const DEVNET_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const DEVNET_WS = DEVNET_RPC.replace('https://', 'wss://').replace('http://', 'ws://');
const MAINNET_RPC = 'https://mainnet.helius-rpc.com/?api-key=961bdec6-492a-4967-b110-349e45035f17';
const MAINNET_WS = 'wss://mainnet.helius-rpc.com/?api-key=961bdec6-492a-4967-b110-349e45035f17';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function Providers({ children }: { children: React.ReactNode }) {
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
          rpcs: {
            'solana:devnet': {
              rpc: createSolanaRpc(DEVNET_RPC),
              rpcSubscriptions: createSolanaRpcSubscriptions(DEVNET_WS),
            },
            'solana:mainnet': {
              rpc: createSolanaRpc(MAINNET_RPC),
              rpcSubscriptions: createSolanaRpcSubscriptions(MAINNET_WS),
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
