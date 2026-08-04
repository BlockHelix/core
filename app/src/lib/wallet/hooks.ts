'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import type { Address, Hex } from 'viem';
import { BASE_CHAIN_ID } from '@/lib/vault-types';
import { ACCOUNTANT_ABI, DELAYED_WITHDRAW_ABI, ERC20_ABI, PAUSABLE_ABI, TELLER_ABI } from './abi';

function errMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { shortMessage?: unknown; message?: unknown };
    if (typeof e.shortMessage === 'string') return e.shortMessage;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Transaction failed';
}

// Wait for the mined receipt and throw if it reverted. A reverted tx still gets a
// hash and is still mined, so without this check a failed write resolves as success
// and the UI shows it as complete.
async function assertMined(
  publicClient: ReturnType<typeof usePublicClient>,
  hash: Hex,
  revertMsg: string,
): Promise<void> {
  if (!publicClient) return;
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(revertMsg);
}

// Make sure the connected wallet is on the VAULT'S chain before sending a write. Every hook
// here used to pin BASE_CHAIN_ID, so against a mainnet vault the reads hit Base and an
// allowance() on mainnet USDC returned '0x' (no code at that address on Base).
function useEnsureChain(chainId: number) {
  const { chainId: current } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  return useCallback(async () => {
    if (current !== chainId) {
      await switchChainAsync({ chainId });
    }
  }, [current, chainId, switchChainAsync]);
}

interface MultiTxState {
  isPending: boolean;
  error: string | null;
  hashes: Hex[];
}

// Shared implementation for pause()/unpause(): calls the no-arg function on each
// target component (manager, teller, accountant) sequentially, collecting hashes.
function usePausableAction(functionName: 'pause' | 'unpause', chainId: number = BASE_CHAIN_ID) {
  const ensureBase = useEnsureChain(chainId);
  const { address: account } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const [state, setState] = useState<MultiTxState>({ isPending: false, error: null, hashes: [] });

  const run = useCallback(
    async (targets: Address[]): Promise<Hex[]> => {
      setState({ isPending: true, error: null, hashes: [] });
      try {
        if (!publicClient) throw new Error('No RPC client available');
        await ensureBase();
        const hashes: Hex[] = [];
        for (const address of targets) {
          await publicClient.simulateContract({
            account,
            address,
            abi: PAUSABLE_ABI,
            functionName,
            args: [],
          });
          const hash = await writeContractAsync({
            address,
            abi: PAUSABLE_ABI,
            functionName,
            args: [],
            chainId,
          });
          hashes.push(hash);
          setState((s) => ({ ...s, hashes: [...s.hashes, hash] }));
          await assertMined(publicClient, hash, `${functionName} reverted`);
        }
        void queryClient.invalidateQueries();
        setState((s) => ({ ...s, isPending: false }));
        return hashes;
      } catch (err) {
        setState((s) => ({ ...s, isPending: false, error: errMessage(err) }));
        throw err;
      }
    },
    [account, ensureBase, functionName, publicClient, queryClient, writeContractAsync],
  );

  const reset = useCallback(() => setState({ isPending: false, error: null, hashes: [] }), []);

  return { run, reset, ...state };
}

// pause() across the vault's manager, teller and accountant.
export function usePauseVault(chainId: number = BASE_CHAIN_ID) {
  const { run, ...rest } = usePausableAction('pause', chainId);
  return { pause: run, ...rest };
}

// unpause() across the vault's manager, teller and accountant.
export function useUnpauseVault(chainId: number = BASE_CHAIN_ID) {
  const { run, ...rest } = usePausableAction('unpause', chainId);
  return { unpause: run, ...rest };
}

interface SingleTxState {
  isPending: boolean;
  error: string | null;
  hash: Hex | null;
}

// accountant.updateExchangeRate(uint96 newExchangeRate).
export function useUpdateExchangeRate(chainId: number = BASE_CHAIN_ID) {
  const ensureBase = useEnsureChain(chainId);
  const { address: account } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const [state, setState] = useState<SingleTxState>({ isPending: false, error: null, hash: null });

  const updateExchangeRate = useCallback(
    async (accountant: Address, newExchangeRate: bigint): Promise<Hex> => {
      setState({ isPending: true, error: null, hash: null });
      try {
        if (!publicClient) throw new Error('No RPC client available');
        await ensureBase();
        await publicClient.simulateContract({
          account,
          address: accountant,
          abi: ACCOUNTANT_ABI,
          functionName: 'updateExchangeRate',
          args: [newExchangeRate],
        });
        const hash = await writeContractAsync({
          address: accountant,
          abi: ACCOUNTANT_ABI,
          functionName: 'updateExchangeRate',
          args: [newExchangeRate],
          chainId,
        });
        setState({ isPending: true, error: null, hash });
        await assertMined(publicClient, hash, 'updateExchangeRate reverted');
        void queryClient.invalidateQueries();
        setState({ isPending: false, error: null, hash });
        return hash;
      } catch (err) {
        setState({ isPending: false, error: errMessage(err), hash: null });
        throw err;
      }
    },
    [account, ensureBase, publicClient, queryClient, writeContractAsync],
  );

  const reset = useCallback(() => setState({ isPending: false, error: null, hash: null }), []);

  return { updateExchangeRate, reset, ...state };
}

export type DepositPhase = 'idle' | 'approving' | 'depositing' | 'done';

interface DepositState {
  phase: DepositPhase;
  error: string | null;
  hashes: Hex[];
}

// Deposit `amount` (base units) of `asset` into the vault. Veda's boringVault pulls the asset via
// transferFrom, so we approve the VAULT (not the teller) when the allowance is short, then call
// teller.deposit(asset, amount, 0). Waits for each receipt so the caller can refresh NAV after.
export function useDeposit(chainId: number = BASE_CHAIN_ID) {
  const ensureBase = useEnsureChain(chainId);
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const [state, setState] = useState<DepositState>({ phase: 'idle', error: null, hashes: [] });

  const deposit = useCallback(
    async (params: { vault: Address; teller: Address; asset: Address; amount: bigint }): Promise<Hex> => {
      const { vault, teller, asset, amount } = params;
      setState({ phase: 'approving', error: null, hashes: [] });
      try {
        if (!address) throw new Error('Connect a wallet first');
        if (!publicClient) throw new Error('No RPC client available');
        await ensureBase();

        const hashes: Hex[] = [];
        const allowance = (await publicClient.readContract({
          address: asset,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, vault],
        })) as bigint;

        if (allowance < amount) {
          const approveHash = await writeContractAsync({
            address: asset,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [vault, amount],
            chainId,
          });
          hashes.push(approveHash);
          setState({ phase: 'approving', error: null, hashes: [...hashes] });
          await assertMined(publicClient, approveHash, 'Approval reverted');
        }

        setState((s) => ({ ...s, phase: 'depositing' }));
        // Pre-flight the deposit now that the allowance is set, so a revert surfaces before signing.
        await publicClient.simulateContract({
          account: address,
          address: teller,
          abi: TELLER_ABI,
          functionName: 'deposit',
          args: [asset, amount, 0n],
        });
        const depositHash = await writeContractAsync({
          address: teller,
          abi: TELLER_ABI,
          functionName: 'deposit',
          args: [asset, amount, 0n],
          chainId,
        });
        hashes.push(depositHash);
        setState({ phase: 'depositing', error: null, hashes: [...hashes] });
        await assertMined(publicClient, depositHash, 'Deposit transaction reverted');

        void queryClient.invalidateQueries();
        setState({ phase: 'done', error: null, hashes });
        return depositHash;
      } catch (err) {
        setState((s) => ({ ...s, phase: 'idle', error: errMessage(err) }));
        throw err;
      }
    },
    [address, ensureBase, publicClient, queryClient, writeContractAsync],
  );

  const reset = useCallback(() => setState({ phase: 'idle', error: null, hashes: [] }), []);

  return { deposit, reset, ...state };
}

// Request a DelayedWithdraw: escrow `shares` (approve the delayedWithdrawer to spend vault shares
// if needed) then requestWithdraw(asset, shares, 0, true). maxLoss 0 uses the vault's global cap;
// allowThirdPartyToComplete=true so a keeper OR the user can complete after maturity.
export function useRequestWithdraw(chainId: number = BASE_CHAIN_ID) {
  const ensureBase = useEnsureChain(chainId);
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const [state, setState] = useState<DepositState>({ phase: 'idle', error: null, hashes: [] });

  const requestWithdraw = useCallback(
    async (params: {
      shareToken: Address;
      delayedWithdrawer: Address;
      asset: Address;
      shares: bigint;
    }): Promise<Hex> => {
      const { shareToken, delayedWithdrawer, asset, shares } = params;
      setState({ phase: 'approving', error: null, hashes: [] });
      try {
        if (!address) throw new Error('Connect a wallet first');
        if (!publicClient) throw new Error('No RPC client available');
        await ensureBase();

        const hashes: Hex[] = [];
        const allowance = (await publicClient.readContract({
          address: shareToken,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, delayedWithdrawer],
        })) as bigint;

        if (allowance < shares) {
          const approveHash = await writeContractAsync({
            address: shareToken,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [delayedWithdrawer, shares],
            chainId,
          });
          hashes.push(approveHash);
          setState({ phase: 'approving', error: null, hashes: [...hashes] });
          await assertMined(publicClient, approveHash, 'Approval reverted');
        }

        setState((s) => ({ ...s, phase: 'depositing' }));
        // Pre-flight the request now that the share allowance is set.
        await publicClient.simulateContract({
          account: address,
          address: delayedWithdrawer,
          abi: DELAYED_WITHDRAW_ABI,
          functionName: 'requestWithdraw',
          args: [asset, shares, 0, true],
        });
        const reqHash = await writeContractAsync({
          address: delayedWithdrawer,
          abi: DELAYED_WITHDRAW_ABI,
          functionName: 'requestWithdraw',
          args: [asset, shares, 0, true],
          chainId,
        });
        hashes.push(reqHash);
        setState({ phase: 'depositing', error: null, hashes: [...hashes] });
        await assertMined(publicClient, reqHash, 'Withdraw request reverted');

        void queryClient.invalidateQueries();
        setState({ phase: 'done', error: null, hashes });
        return reqHash;
      } catch (err) {
        setState((s) => ({ ...s, phase: 'idle', error: errMessage(err) }));
        throw err;
      }
    },
    [address, ensureBase, publicClient, queryClient, writeContractAsync],
  );

  const reset = useCallback(() => setState({ phase: 'idle', error: null, hashes: [] }), []);
  return { requestWithdraw, reset, ...state };
}

// completeWithdraw(asset, account) — callable once past maturity, within the completion window.
export function useCompleteWithdraw(chainId: number = BASE_CHAIN_ID) {
  const ensureBase = useEnsureChain(chainId);
  const { address: caller } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const [state, setState] = useState<SingleTxState>({ isPending: false, error: null, hash: null });

  const completeWithdraw = useCallback(
    async (params: { delayedWithdrawer: Address; asset: Address; account: Address }): Promise<Hex> => {
      setState({ isPending: true, error: null, hash: null });
      try {
        if (!publicClient) throw new Error('No RPC client available');
        await ensureBase();
        await publicClient.simulateContract({
          account: caller,
          address: params.delayedWithdrawer,
          abi: DELAYED_WITHDRAW_ABI,
          functionName: 'completeWithdraw',
          args: [params.asset, params.account],
        });
        const hash = await writeContractAsync({
          address: params.delayedWithdrawer,
          abi: DELAYED_WITHDRAW_ABI,
          functionName: 'completeWithdraw',
          args: [params.asset, params.account],
          chainId,
        });
        setState({ isPending: true, error: null, hash });
        await assertMined(publicClient, hash, 'Withdraw completion reverted');
        void queryClient.invalidateQueries();
        setState({ isPending: false, error: null, hash });
        return hash;
      } catch (err) {
        setState({ isPending: false, error: errMessage(err), hash: null });
        throw err;
      }
    },
    [caller, ensureBase, publicClient, queryClient, writeContractAsync],
  );
  const reset = useCallback(() => setState({ isPending: false, error: null, hash: null }), []);
  return { completeWithdraw, reset, ...state };
}

// cancelWithdraw(asset) — reclaim the escrowed shares.
export function useCancelWithdraw(chainId: number = BASE_CHAIN_ID) {
  const ensureBase = useEnsureChain(chainId);
  const { address: caller } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const [state, setState] = useState<SingleTxState>({ isPending: false, error: null, hash: null });

  const cancelWithdraw = useCallback(
    async (params: { delayedWithdrawer: Address; asset: Address }): Promise<Hex> => {
      setState({ isPending: true, error: null, hash: null });
      try {
        if (!publicClient) throw new Error('No RPC client available');
        await ensureBase();
        await publicClient.simulateContract({
          account: caller,
          address: params.delayedWithdrawer,
          abi: DELAYED_WITHDRAW_ABI,
          functionName: 'cancelWithdraw',
          args: [params.asset],
        });
        const hash = await writeContractAsync({
          address: params.delayedWithdrawer,
          abi: DELAYED_WITHDRAW_ABI,
          functionName: 'cancelWithdraw',
          args: [params.asset],
          chainId,
        });
        setState({ isPending: true, error: null, hash });
        await assertMined(publicClient, hash, 'Withdraw cancellation reverted');
        void queryClient.invalidateQueries();
        setState({ isPending: false, error: null, hash });
        return hash;
      } catch (err) {
        setState({ isPending: false, error: errMessage(err), hash: null });
        throw err;
      }
    },
    [caller, ensureBase, publicClient, queryClient, writeContractAsync],
  );
  const reset = useCallback(() => setState({ isPending: false, error: null, hash: null }), []);
  return { cancelWithdraw, reset, ...state };
}
