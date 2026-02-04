'use client';

import { useAuth } from '@/hooks/useAuth';

export default function WalletButton() {
  const { login, logout, authenticated, walletAddress } = useAuth();

  if (authenticated) {
    const display = walletAddress
      ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      : 'Connected';

    return (
      <button
        onClick={logout}
        className="bg-helix-card border border-helix-border text-helix-primary font-mono text-sm font-medium px-5 py-2.5 rounded-md transition-all hover:border-helix-cyan/30 hover:bg-helix-elevated"
      >
        <span className="font-data">{display}</span>
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="bg-helix-cyan hover:bg-helix-cyan/90 text-helix-bg font-mono text-sm font-medium px-6 py-2.5 rounded-md border border-helix-cyan/50 transition-all hover:border-helix-cyan focus:ring-2 focus:ring-helix-cyan/30 focus:outline-none"
    >
      Connect
    </button>
  );
}
