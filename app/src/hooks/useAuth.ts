'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { posthog } from '@/lib/posthog';

export function useAuth() {
  const privy = usePrivy();
  const { wallets } = useWallets();

  const walletAddress = wallets[0]?.address || privy.user?.wallet?.address;

  useEffect(() => {
    if (privy.authenticated && walletAddress) {
      posthog?.identify(walletAddress, { wallet: walletAddress });
      posthog?.capture('wallet_connected', { wallet: walletAddress });
    }
  }, [privy.authenticated, walletAddress]);

  const connect = async () => {
    if (privy.authenticated && !walletAddress) {
      await privy.logout();
    }
    await privy.login();
  };

  return {
    authenticated: privy.authenticated && !!walletAddress,
    ready: privy.ready,
    login: connect,
    logout: privy.logout,
    user: privy.user,
    walletAddress,
  };
}
