'use client';

import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { formatUSDC, formatShares } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import WalletButton from '@/components/WalletButton';

export default function DashboardContent() {
  const { authenticated: connected } = useAuth();
  const { positions, isLoading } = useDashboardData();

  if (!connected) {
    return (
      <main className="min-h-screen py-32 lg:py-48">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-xs uppercase tracking-wider-2 text-white/40 mb-6">
              DASHBOARD
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-6">
              Vault Positions
            </h1>
            <p className="text-lg lg:text-xl text-white/60 leading-relaxed mb-16">
              Share balances, NAV, and accrued revenue across your vault deposits
            </p>

            <div className="border border-white/10 p-16 text-center bg-white/[0.02]">
              <p className="text-lg text-white/60 mb-10">
                Connect wallet to view positions
              </p>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  const totalValue = positions.reduce((sum, p) => sum + p.usdcValue, 0);
  const totalDeposited = positions.reduce((sum, p) => sum + p.deposited, 0);
  const totalGain = totalValue - totalDeposited;
  const gainPercent = totalDeposited > 0 ? (totalGain / totalDeposited) * 100 : 0;

  if (isLoading) {
    return (
      <main className="min-h-screen py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-8">
            <div className="h-12 skeleton w-1/2"></div>
            <div className="h-6 skeleton w-3/4"></div>
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 skeleton"></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-mono">
            DASHBOARD
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
            Vault Positions
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-12">
            Share balances, current NAV, and revenue accrual across your deposits
          </p>

          <div className="mb-10">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-6 font-mono">AGGREGATE POSITION</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-white/10 p-6 bg-white/[0.01]">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-mono">CURRENT NAV</div>
                <div className="text-2xl lg:text-3xl font-bold text-white font-mono tabular-nums">${formatUSDC(totalValue)}</div>
              </div>
              <div className="border border-white/10 p-6 bg-white/[0.01]">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-mono">DEPOSITED</div>
                <div className="text-2xl lg:text-3xl font-bold text-white font-mono tabular-nums">${formatUSDC(totalDeposited)}</div>
              </div>
              <div className="border border-white/10 p-6 bg-white/[0.01]">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-mono">GAIN/LOSS</div>
                <div className={`text-2xl lg:text-3xl font-bold font-mono tabular-nums ${totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalGain >= 0 ? '+' : ''}${formatUSDC(totalGain)}
                </div>
                <div className={`text-xs mt-2 font-mono ${totalGain >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          </div>

          {positions.length === 0 ? (
            <section>
              <div className="border border-white/10 p-16 text-center">
                <h2 className="text-lg font-bold text-white mb-3 font-mono">
                  NO OPEN POSITIONS
                </h2>
                <p className="text-white/60 mb-6 text-sm">
                  Deposit USDC into an agent vault to acquire shares
                </p>
                <Link href="/">
                  <button className="inline-flex items-center gap-2 bg-white text-black font-medium px-6 py-3 text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors duration-300">
                    <TrendingUp className="w-4 h-4" />
                    <span>EXPLORE AGENTS</span>
                  </button>
                </Link>
              </div>
            </section>
          ) : (
            <section>
              <h2 className="text-[10px] uppercase tracking-widest text-white/40 mb-6 font-mono">MY POSITIONS</h2>
              <div className="border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.01]">
                        <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">AGENT</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">SHARES</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">VALUE</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">DEPOSITED</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">GAIN/LOSS</th>
                        <th className="text-center px-4 py-3 text-[10px] uppercase tracking-widest font-medium text-white/40 font-mono">WALLET</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((position) => {
                        const gain = position.usdcValue - position.deposited;
                        const gainPct = position.deposited > 0 ? (gain / position.deposited) * 100 : 0;
                        return (
                          <tr
                            key={position.vaultState.toString()}
                            className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02] transition-colors duration-300"
                          >
                            <td className="px-4 py-3">
                              <Link
                                href={`/agent/${position.agentWallet.toString()}`}
                                className="text-emerald-400 hover:text-emerald-300 transition-colors duration-300 text-sm"
                              >
                                {position.agentName}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-white text-sm">
                              {formatShares(position.shareBalance)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-white text-sm">
                              ${formatUSDC(position.usdcValue)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-white/60 text-sm">
                              ${formatUSDC(position.deposited)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono tabular-nums text-sm ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {gain >= 0 ? '+' : ''}${formatUSDC(gain)} <span className="text-xs">({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <CopyButton value={position.agentWallet.toString()} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </div>
    </main>
  );
}
