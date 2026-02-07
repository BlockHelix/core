'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';

export function useAuth() {
  const privy = usePrivy();
  const { wallets } = useWallets();

  const walletAddress = wallets[0]?.address || privy.user?.wallet?.address;

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
