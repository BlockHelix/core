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
        className="px-5 py-3 text-xs uppercase tracking-wider-2 font-medium text-white/70 border border-white/20 hover:border-emerald-400 hover:text-white transition-all duration-300"
      >
        <span className="font-mono tabular-nums">{display}</span>
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="px-5 py-3 text-xs uppercase tracking-wider-2 font-medium bg-white text-black hover:bg-emerald-400 transition-colors duration-300"
    >
      CONNECT
    </button>
  );
}
