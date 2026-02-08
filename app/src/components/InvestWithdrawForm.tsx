'use client';

import { useState, useEffect } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useAuth } from '@/hooks/useAuth';
import { useDeposit, useWithdraw } from '@/hooks/useVaultTransactions';
import { formatUSDC, formatShares } from '@/lib/format';
import { toast, toastTx } from '@/lib/toast';
import { RPC_URL } from '@/lib/anchor';
import { ExternalLink } from 'lucide-react';

const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

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
  const { authenticated: connected, walletAddress } = useAuth();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const { deposit, isLoading: depositLoading } = useDeposit();
  const { withdraw, isLoading: withdrawLoading } = useWithdraw();

  useEffect(() => {
    async function fetchBalance() {
      if (!walletAddress) {
        setUsdcBalance(null);
        return;
      }

      setBalanceLoading(true);
      try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const walletPubkey = new PublicKey(walletAddress);
        const ata = await getAssociatedTokenAddress(USDC_MINT, walletPubkey);
        const account = await getAccount(connection, ata);
        setUsdcBalance(Number(account.amount) / 1_000_000);
      } catch {
        setUsdcBalance(0);
      } finally {
        setBalanceLoading(false);
      }
    }

    fetchBalance();
  }, [walletAddress]);

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

      toastTx('Deposit successful!', result.signature);

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

      toastTx('Withdraw successful!', result.signature);

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
  const hasNoUsdc = usdcBalance !== null && usdcBalance === 0;

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
            {connected && hasNoUsdc && (
              <div className="p-4 border border-amber-400/30 bg-amber-400/5">
                <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2 font-mono">
                  NO USDC BALANCE
                </div>
                <p className="text-xs text-white/60 mb-3">
                  You need devnet USDC to deposit. Get free test USDC from Circle&apos;s faucet.
                </p>
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Get Devnet USDC
                </a>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] uppercase tracking-widest text-white/30 font-mono">USDC AMOUNT</label>
                {connected && usdcBalance !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[25, 50, 75].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDepositAmount(((usdcBalance * pct) / 100).toFixed(2))}
                          disabled={usdcBalance === 0}
                          className="px-1.5 py-0.5 text-[9px] font-mono text-white/40 border border-white/20 hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-white/40 font-mono">
                      Bal: <span className="text-white/60">{formatUSDC(usdcBalance)}</span>
                    </span>
                  </div>
                )}
              </div>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-black/30 border border-white/30 px-4 py-2.5 font-mono tabular-nums text-base text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors duration-300"
                disabled={!connected || isLoading || hasNoUsdc}
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
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isLoading || hasNoUsdc}
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
