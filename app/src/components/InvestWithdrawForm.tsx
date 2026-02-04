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
    <div className="bg-helix-card border border-helix-border rounded-lg overflow-hidden">
      <div className="flex border-b border-helix-border">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'deposit'
              ? 'bg-helix-elevated text-helix-cyan border-b-2 border-helix-cyan'
              : 'text-helix-secondary hover:text-helix-primary'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'withdraw'
              ? 'bg-helix-elevated text-helix-cyan border-b-2 border-helix-cyan'
              : 'text-helix-secondary hover:text-helix-primary'
          }`}
        >
          Withdraw
        </button>
      </div>

      <div className="p-8">
        {activeTab === 'deposit' ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-helix-secondary mb-2">USDC Amount</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-helix-terminal border border-helix-border rounded-md px-4 py-3 font-data text-helix-primary placeholder:text-helix-tertiary focus:outline-none focus:border-helix-cyan transition-colors"
                disabled={!connected || isLoading}
              />
              {depositAmount && (
                <div className="mt-2 text-sm text-helix-secondary">
                  Estimated shares: <span className="font-data text-helix-cyan">{formatShares(estimatedShares)}</span>
                </div>
              )}
            </div>

            {connected ? (
              <button
                onClick={handleDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isLoading}
                className="w-full bg-helix-cyan text-helix-bg font-medium py-3 rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? 'Processing...' : 'Deposit USDC'}
              </button>
            ) : (
              <div className="w-full bg-helix-elevated border border-helix-border text-helix-secondary text-center font-medium py-3 rounded-md">
                Connect wallet to deposit
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-helix-secondary mb-2">Shares Amount</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.0000"
                className="w-full bg-helix-terminal border border-helix-border rounded-md px-4 py-3 font-data text-helix-primary placeholder:text-helix-tertiary focus:outline-none focus:border-helix-cyan transition-colors"
                disabled={!connected || isLoading}
              />
              {withdrawAmount && (
                <div className="mt-2 text-sm text-helix-secondary">
                  Estimated USDC: <span className="font-data text-helix-cyan">${formatUSDC(estimatedUsdc)}</span>
                </div>
              )}
            </div>

            {connected ? (
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isLoading}
                className="w-full bg-helix-violet text-helix-bg font-medium py-3 rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? 'Processing...' : 'Withdraw Shares'}
              </button>
            ) : (
              <div className="w-full bg-helix-elevated border border-helix-border text-helix-secondary text-center font-medium py-3 rounded-md">
                Connect wallet to withdraw
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
