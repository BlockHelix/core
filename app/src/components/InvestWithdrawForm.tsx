'use client';

import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useAuth } from '@/hooks/useAuth';
import { useDeposit, useWithdraw } from '@/hooks/useVaultTransactions';
import { formatUSDC, formatShares } from '@/lib/format';
import { toast } from '@/lib/toast';

interface InvestWithdrawFormProps {
  vaultPubkey: PublicKey | null;
  shareMint: PublicKey;
  sharePrice: number;
}

export function InvestWithdrawForm({
  vaultPubkey,
  shareMint,
  sharePrice
}: InvestWithdrawFormProps) {
  const { authenticated: connected } = useAuth();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const { deposit, isLoading: depositLoading } = useDeposit();
  const { withdraw, isLoading: withdrawLoading } = useWithdraw();

  const estimatedShares = depositAmount ? parseFloat(depositAmount) / sharePrice : 0;
  const estimatedUsdc = withdrawAmount ? parseFloat(withdrawAmount) * sharePrice : 0;

  const handleDeposit = async () => {
    if (!vaultPubkey) {
      toast('Vault not available', 'error');
      return;
    }

    try {
      const amount = parseFloat(depositAmount);
      if (amount <= 0) return;

      toast('Confirming deposit transaction...', 'info');
      const result = await deposit(vaultPubkey, shareMint, amount);

      const explorerUrl = `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`;
      toast(`Deposit successful! View on Explorer: ${explorerUrl}`, 'success');

      setDepositAmount('');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Deposit failed';
      toast(`Deposit failed: ${errorMsg}`, 'error');
    }
  };

  const handleWithdraw = async () => {
    if (!vaultPubkey) {
      toast('Vault not available', 'error');
      return;
    }

    try {
      const shares = parseFloat(withdrawAmount);
      if (shares <= 0) return;

      toast('Confirming withdraw transaction...', 'info');
      const result = await withdraw(vaultPubkey, shareMint, shares);

      const explorerUrl = `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`;
      toast(`Withdraw successful! View on Explorer: ${explorerUrl}`, 'success');

      setWithdrawAmount('');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Withdraw failed';
      toast(`Withdraw failed: ${errorMsg}`, 'error');
    }
  };

  const isLoading = depositLoading || withdrawLoading;

  return (
    <div className="border border-white/10 overflow-hidden">
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all duration-300 font-mono ${
            activeTab === 'deposit'
              ? 'bg-emerald-400/10 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          DEPOSIT
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-1 px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all duration-300 font-mono ${
            activeTab === 'withdraw'
              ? 'bg-emerald-400/10 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          WITHDRAW
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'deposit' ? (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">USDC AMOUNT</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-black/30 border border-white/30 px-4 py-2.5 font-mono tabular-nums text-base text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors duration-300"
                disabled={!connected || isLoading}
              />
              {depositAmount && (
                <div className="mt-2 flex items-baseline gap-2 text-sm">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Est. Shares:</span>
                  <span className="font-mono text-emerald-400 tabular-nums">{formatShares(estimatedShares)}</span>
                </div>
              )}
            </div>

            <div className="text-[10px] text-white/30 p-3 border border-amber-400/20 bg-amber-400/5 uppercase tracking-wider leading-relaxed font-mono">
              <span className="text-amber-400 font-bold">RISK WARNING:</span> Revenue participation subject to agent performance risk and operator slashing.
            </div>

            {connected ? (
              <button
                onClick={handleDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isLoading}
                className="w-full bg-emerald-400 text-black font-bold py-3 text-xs tracking-widest hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
              >
                {isLoading ? 'PROCESSING...' : 'EXECUTE DEPOSIT'}
              </button>
            ) : (
              <div className="w-full border border-white/30 text-white/40 text-center font-bold py-3 text-[10px] tracking-widest font-mono">
                WALLET CONNECTION REQUIRED
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">SHARES AMOUNT</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.0000"
                className="w-full bg-black/30 border border-white/30 px-4 py-2.5 font-mono tabular-nums text-base text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors duration-300"
                disabled={!connected || isLoading}
              />
              {withdrawAmount && (
                <div className="mt-2 flex items-baseline gap-2 text-sm">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Est. USDC:</span>
                  <span className="font-mono text-emerald-400 tabular-nums">${formatUSDC(estimatedUsdc)}</span>
                </div>
              )}
            </div>

            {connected ? (
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isLoading}
                className="w-full bg-emerald-400 text-black font-bold py-3 text-xs tracking-widest hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
              >
                {isLoading ? 'PROCESSING...' : 'EXECUTE WITHDRAWAL'}
              </button>
            ) : (
              <div className="w-full border border-white/30 text-white/40 text-center font-bold py-3 text-[10px] tracking-widest font-mono">
                WALLET CONNECTION REQUIRED
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
