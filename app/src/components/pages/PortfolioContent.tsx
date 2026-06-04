'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import WalletButton from '@/components/WalletButton';
import { formatShares, formatUSDC } from '@/lib/format';

export default function PortfolioContent() {
  const { authenticated } = useAuth();
  const { positions, isLoading } = useDashboardData();

  if (!authenticated) {
    return (
      <main className="min-h-screen py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="border border-white/10 p-12 text-center bg-white/[0.01]">
            <p className="text-xs uppercase tracking-widest text-white/30 font-mono mb-4">Portfolio</p>
            <h1 className="text-3xl font-bold text-white font-mono mb-4">Connect wallet</h1>
            <p className="text-white/60 text-sm mb-8">
              View your vault positions, live value, and withdraw paths.
            </p>
            <WalletButton />
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 space-y-5">
          <div className="h-10 skeleton w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 skeleton" />
            <div className="h-24 skeleton" />
            <div className="h-24 skeleton" />
          </div>
          <div className="h-80 skeleton" />
        </div>
      </main>
    );
  }

  const totalValue = positions.reduce((sum, p) => sum + p.usdcValue, 0);
  const totalDeposited = positions.reduce((sum, p) => sum + p.deposited, 0);
  const pnl = totalValue - totalDeposited;

  return (
    <main className="min-h-screen py-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-widest text-white/30 font-mono mb-3">Portfolio</p>
          <h1 className="text-3xl font-bold text-white font-mono mb-2">Your positions</h1>
          <p className="text-white/55 text-sm">
            Vaults you hold shares in, current value, P/L, and direct withdraw actions.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="border border-white/10 p-5 bg-white/[0.01]">
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-2">Current Value</div>
            <div className="text-2xl font-mono text-white">${formatUSDC(totalValue)}</div>
          </div>
          <div className="border border-white/10 p-5 bg-white/[0.01]">
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-2">Deposited</div>
            <div className="text-2xl font-mono text-white">${formatUSDC(totalDeposited)}</div>
          </div>
          <div className="border border-white/10 p-5 bg-white/[0.01]">
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-2">P/L</div>
            <div className={`text-2xl font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}${formatUSDC(pnl)}
            </div>
          </div>
        </section>

        {positions.length === 0 ? (
          <div className="border border-white/10 p-12 text-center">
            <p className="text-white/60 mb-5">No portfolio positions yet.</p>
            <Link
              href="/"
              className="inline-flex items-center px-5 py-2 text-xs uppercase tracking-widest font-mono border border-emerald-400/40 text-emerald-400 hover:border-emerald-400 transition-colors"
            >
              Browse vaults
            </Link>
          </div>
        ) : (
          <div className="border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 font-mono font-normal">Vault</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 font-mono font-normal">Shares</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 font-mono font-normal">Value</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 font-mono font-normal">Deposited</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 font-mono font-normal">P/L</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 font-mono font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const gain = position.usdcValue - position.deposited;
                    const vaultId = position.vaultState.toString();
                    return (
                      <tr key={vaultId} className="border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-sm text-white/85">{position.agentName}</td>
                        <td className="px-4 py-3 text-right text-sm text-white/70 font-mono tabular-nums">{formatShares(position.shareBalance)}</td>
                        <td className="px-4 py-3 text-right text-sm text-white font-mono tabular-nums">${formatUSDC(position.usdcValue)}</td>
                        <td className="px-4 py-3 text-right text-sm text-white/65 font-mono tabular-nums">${formatUSDC(position.deposited)}</td>
                        <td className={`px-4 py-3 text-right text-sm font-mono tabular-nums ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {gain >= 0 ? '+' : ''}${formatUSDC(gain)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/v/${vaultId}`}
                            className="inline-flex items-center px-3 py-1.5 text-[10px] uppercase tracking-widest font-mono border border-emerald-400/30 text-emerald-400/80 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
                          >
                            Withdraw
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
