'use client';

import { usePrivy } from '@privy-io/react-auth';

export function useAuth() {
  try {
    const privy = usePrivy();
    return {
      authenticated: privy.authenticated,
      login: privy.login,
      logout: privy.logout,
      user: privy.user,
      walletAddress: privy.user?.wallet?.address,
    };
  } catch {
    return {
      authenticated: false,
      login: () => {},
      logout: () => {},
      user: null,
      walletAddress: undefined,
    };
  }
}
