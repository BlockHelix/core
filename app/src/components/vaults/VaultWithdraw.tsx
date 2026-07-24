'use client';

import { useEffect, useState } from 'react';
import { formatUnits, parseUnits, type Address } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import ConnectButton from '@/components/wallet/ConnectButton';
import { useCancelWithdraw, useCompleteWithdraw, useRequestWithdraw } from '@/lib/wallet/hooks';
import { DELAYED_WITHDRAW_ABI, ERC20_ABI } from '@/lib/wallet/abi';
import { BASE_CHAIN_ID, BASESCAN_URL } from '@/lib/vault-types';

// Vault default: a completed request stays completable for 7 days past maturity.
const COMPLETION_WINDOW = 7 * 24 * 60 * 60;

function fmtEta(seconds: number): string {
  if (seconds <= 0) return 'now';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function VaultWithdraw({
  vault,
  delayedWithdrawer,
  asset,
  symbol,
  shareDecimals,
  onChanged,
}: {
  vault: string;
  delayedWithdrawer: string;
  asset: string;
  symbol: string;
  shareDecimals: number;
  onChanged?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const req = useRequestWithdraw();
  const comp = useCompleteWithdraw();
  const canc = useCancelWithdraw();

  const { data: balData, refetch: refetchBal } = useReadContract({
    address: vault as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: BASE_CHAIN_ID,
    query: { enabled: !!address },
  });
  const shareBal = typeof balData === 'bigint' ? balData : 0n;

  const { data: reqData, refetch: refetchReq } = useReadContract({
    address: delayedWithdrawer as Address,
    abi: DELAYED_WITHDRAW_ABI,
    functionName: 'withdrawRequests',
    args: address ? [address as Address, asset as Address] : undefined,
    chainId: BASE_CHAIN_ID,
    query: { enabled: !!address },
  });
  // Public mapping getter returns the struct fields as a tuple:
  // [allowThirdPartyToComplete, maxLoss, maturity, shares, exchangeRateAtTimeOfRequest]
  const tuple = Array.isArray(reqData) ? (reqData as unknown[]) : [];
  const asNum = (v: unknown): number => (typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : 0);
  const asBig = (v: unknown): bigint =>
    typeof v === 'bigint' ? v : typeof v === 'number' ? BigInt(Math.trunc(v)) : 0n;
  const pendingShares = asBig(tuple[3]);
  const maturity = asNum(tuple[2]);
  const hasPending = pendingShares > 0n;

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);
  const matured = now >= maturity;
  const expired = now > maturity + COMPLETION_WINDOW;

  const refresh = async () => {
    await Promise.all([refetchBal(), refetchReq()]);
    onChanged?.();
  };

  let requestUnits = 0n;
  try {
    requestUnits = amount ? parseUnits(amount, shareDecimals) : 0n;
  } catch {
    requestUnits = 0n;
  }
  const overBalance = requestUnits > shareBal;
  const requestBusy = req.phase === 'approving' || req.phase === 'depositing';
  const canRequest = isConnected && requestUnits > 0n && !overBalance && !requestBusy;

  const submitRequest = async () => {
    try {
      await req.requestWithdraw({
        shareToken: vault as Address,
        delayedWithdrawer: delayedWithdrawer as Address,
        asset: asset as Address,
        shares: requestUnits,
      });
      setAmount('');
      await refresh();
    } catch {
      /* surfaced below */
    }
  };
  const submitComplete = async () => {
    if (!address) return;
    try {
      await comp.completeWithdraw({
        delayedWithdrawer: delayedWithdrawer as Address,
        asset: asset as Address,
        account: address,
      });
      await refresh();
    } catch {
      /* surfaced below */
    }
  };
  const submitCancel = async () => {
    try {
      await canc.cancelWithdraw({ delayedWithdrawer: delayedWithdrawer as Address, asset: asset as Address });
      await refresh();
    } catch {
      /* surfaced below */
    }
  };

  const txLink = (hash: string, label: string) => (
    <a
      key={hash}
      href={`${BASESCAN_URL}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-data text-[11px] text-[#10c689] hover:text-[#10c689]"
    >
      {label} {hash.slice(0, 10)}… ↗
    </a>
  );

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Withdraw {symbol}</h2>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <p className="mt-3 text-sm text-zinc-500">Connect your wallet to withdraw from this vault.</p>
      ) : hasPending ? (
        <>
          <div className="mt-4 rounded-lg border border-black/[0.06] bg-zinc-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-data text-lg text-zinc-950">{formatUnits(pendingShares, shareDecimals)}</span>
              <span className="text-[11px] uppercase tracking-wider-2 text-zinc-400">shares pending</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {expired
                ? 'Request expired — cancel to reclaim your shares.'
                : matured
                  ? 'Matured — ready to complete.'
                  : `Completable in ${fmtEta(maturity - now)}.`}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!matured || expired || comp.isPending}
              onClick={submitComplete}
              className="bh-btn-primary rounded-lg px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {comp.isPending ? 'Completing…' : 'Complete withdraw'}
            </button>
            <button
              type="button"
              disabled={canc.isPending}
              onClick={submitCancel}
              className="rounded-lg border border-black/[0.12] px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-zinc-600 transition-colors hover:bg-black/[0.03] disabled:opacity-40"
            >
              {canc.isPending ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
          {(comp.error || canc.error) && (
            <p className="mt-3 break-words text-sm text-[#9a1c10]">{comp.error ?? canc.error}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-4">
            {comp.hash && txLink(comp.hash, 'complete')}
            {canc.hash && txLink(canc.hash, 'cancel')}
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 flex items-stretch gap-3">
            <div className="flex flex-1 items-center rounded-lg border border-black/[0.1] px-3 focus-within:border-[#10c689]/50">
              <input
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full bg-transparent py-2.5 font-data text-lg text-zinc-950 outline-none"
              />
              <span className="font-data text-sm text-zinc-400">shares</span>
            </div>
            <button
              type="button"
              disabled={!canRequest}
              onClick={submitRequest}
              className="bh-btn-primary rounded-lg px-6 text-xs font-medium uppercase tracking-wider-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {req.phase === 'approving' ? 'Approving…' : req.phase === 'depositing' ? 'Requesting…' : 'Request'}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Your shares:{' '}
              <span className="font-data text-zinc-600">{formatUnits(shareBal, shareDecimals)}</span>
            </span>
            <button
              type="button"
              onClick={() => setAmount(formatUnits(shareBal, shareDecimals))}
              className="uppercase tracking-wider-2 transition-colors hover:text-zinc-700"
            >
              Max
            </button>
          </div>
          {overBalance && <p className="mt-3 text-sm text-amber-600">Amount exceeds your share balance.</p>}
          {req.error && <p className="mt-3 break-words text-sm text-[#9a1c10]">{req.error}</p>}
          <p className="mt-3 text-xs text-zinc-400">
            Withdrawals settle after a 3-day delay (the strategist unwinds Aave first), then you complete the
            withdrawal. Shares are held in escrow meanwhile and can be cancelled.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">{req.hashes.map((h, i) => txLink(h, i === 0 && req.hashes.length > 1 ? 'approve' : 'request'))}</div>
        </>
      )}
    </div>
  );
}
