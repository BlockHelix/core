'use client';

import { useState } from 'react';
import { formatUnits, parseUnits, type Address } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import ConnectButton from '@/components/wallet/ConnectButton';
import { useDeposit } from '@/lib/wallet/hooks';
import { ERC20_ABI } from '@/lib/wallet/abi';
import { BASE_CHAIN_ID, BASESCAN_URL } from '@/lib/vault-types';

export default function VaultDeposit({
  vault,
  teller,
  asset,
  symbol,
  decimals,
  onDeposited,
}: {
  vault: string;
  teller: string;
  asset: string;
  symbol: string;
  decimals: number;
  onDeposited?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const { deposit, phase, error, hashes } = useDeposit();

  const { data: balData, refetch: refetchBal } = useReadContract({
    address: asset as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: BASE_CHAIN_ID,
    query: { enabled: !!address },
  });
  const walletBal = typeof balData === 'bigint' ? balData : 0n;

  let amountUnits = 0n;
  try {
    amountUnits = amount ? parseUnits(amount, decimals) : 0n;
  } catch {
    amountUnits = 0n;
  }
  const busy = phase === 'approving' || phase === 'depositing';
  const overBalance = amountUnits > walletBal;
  const canDeposit = isConnected && amountUnits > 0n && !overBalance && !busy;

  const submit = async () => {
    try {
      await deposit({
        vault: vault as Address,
        teller: teller as Address,
        asset: asset as Address,
        amount: amountUnits,
      });
      setAmount('');
      await refetchBal();
      onDeposited?.();
    } catch {
      // error is surfaced from the hook state below
    }
  };

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Deposit {symbol}</h2>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <p className="mt-3 text-sm text-zinc-500">Connect your wallet to deposit {symbol} into this vault.</p>
      ) : (
        <>
          <div className="mt-4 flex items-stretch gap-3">
            <div className="flex flex-1 items-center rounded-lg border border-black/[0.1] px-3 focus-within:border-emerald-500/50">
              <input
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full bg-transparent py-2.5 font-data text-lg text-zinc-950 outline-none"
              />
              <span className="font-data text-sm text-zinc-400">{symbol}</span>
            </div>
            <button
              type="button"
              disabled={!canDeposit}
              onClick={submit}
              className="bh-btn-primary rounded-lg px-6 text-xs font-medium uppercase tracking-wider-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === 'approving' ? 'Approving…' : phase === 'depositing' ? 'Depositing…' : 'Deposit'}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Wallet:{' '}
              <span className="font-data text-zinc-600">
                {formatUnits(walletBal, decimals)} {symbol}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAmount(formatUnits(walletBal, decimals))}
              className="uppercase tracking-wider-2 transition-colors hover:text-zinc-700"
            >
              Max
            </button>
          </div>

          {overBalance && <p className="mt-3 text-sm text-amber-600">Amount exceeds your wallet balance.</p>}
          {error && <p className="mt-3 break-words text-sm text-red-700">{error}</p>}
          {phase === 'done' && (
            <p className="mt-3 text-sm text-emerald-700">Deposit confirmed. The snapshot updates shortly.</p>
          )}
          {hashes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-4">
              {hashes.map((h, i) => (
                <a
                  key={h}
                  href={`${BASESCAN_URL}/tx/${h}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-data text-[11px] text-emerald-700 hover:text-emerald-800"
                >
                  {i === 0 && hashes.length > 1 ? 'approve' : 'deposit'} {h.slice(0, 10)}… ↗
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
