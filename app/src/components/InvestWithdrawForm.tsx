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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Withdraw failed';
      toast(`Withdraw failed: ${errorMsg}`, 'error');
    }
  };

  const isLoading = depositLoading || withdrawLoading;

  return (
    <div className="border border-white/10 overflow-hidden corner-cut relative">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 px-6 py-3 text-[10px] uppercase tracking-widest font-bold transition-all duration-300 ${
            activeTab === 'deposit'
              ? 'bg-emerald-400/10 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          DEPOSIT
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-1 px-6 py-3 text-[10px] uppercase tracking-widest font-bold transition-all duration-300 ${
            activeTab === 'withdraw'
              ? 'bg-emerald-400/10 text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          WITHDRAW
        </button>
      </div>

      <div className="p-8 lg:p-10">
        {activeTab === 'deposit' ? (
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">USDC AMOUNT</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-black/30 border border-white/30 px-4 py-3 font-mono tabular-nums text-lg text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-400 transition-colors duration-300 corner-cut-sm"
                disabled={!connected || isLoading}
              />
              {depositAmount && (
                <div className="mt-3 flex items-baseline gap-2 text-sm">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">Est. Shares:</span>
                  <span className="font-mono text-emerald-400 tabular-nums">{formatShares(estimatedShares)}</span>
                </div>
              )}
            </div>

            <div className="text-[10px] text-white/30 p-4 border border-amber-400/20 bg-amber-400/5 corner-cut-sm uppercase tracking-wider leading-relaxed">
              <span className="text-amber-400 font-bold">RISK WARNING:</span> Revenue participation subject to agent performance risk and operator slashing.
            </div>

            {connected ? (
              <button
                onClick={handleDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isLoading}
                className="w-full bg-emerald-400 text-black font-bold py-3.5 text-xs tracking-widest hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 corner-cut-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                {isLoading ? 'PROCESSING...' : 'EXECUTE DEPOSIT'}
              </button>
            ) : (
              <div className="w-full border border-white/30 text-white/40 text-center font-bold py-3.5 text-[10px] tracking-widest corner-cut-sm">
                WALLET CONNECTION REQUIRED
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/30 mb-3">SHARES AMOUNT</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.0000"
                className="w-full bg-black/30 border border-white/30 px-4 py-3 font-mono tabular-nums text-lg text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-400 transition-colors duration-300 corner-cut-sm"
                disabled={!connected || isLoading}
              />
              {withdrawAmount && (
                <div className="mt-3 flex items-baseline gap-2 text-sm">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">Est. USDC:</span>
                  <span className="font-mono text-emerald-400 tabular-nums">${formatUSDC(estimatedUsdc)}</span>
                </div>
              )}
            </div>

            {connected ? (
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isLoading}
                className="w-full bg-emerald-400 text-black font-bold py-3.5 text-xs tracking-widest hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 corner-cut-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                {isLoading ? 'PROCESSING...' : 'EXECUTE WITHDRAWAL'}
              </button>
            ) : (
              <div className="w-full border border-white/30 text-white/40 text-center font-bold py-3.5 text-[10px] tracking-widest corner-cut-sm">
                WALLET CONNECTION REQUIRED
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
