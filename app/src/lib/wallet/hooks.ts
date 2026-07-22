'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import type { Address, Hex } from 'viem';
import { BASE_CHAIN_ID } from '@/lib/vault-types';
import { ACCOUNTANT_ABI, ERC20_ABI, PAUSABLE_ABI, TELLER_ABI } from './abi';

function errMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { shortMessage?: unknown; message?: unknown };
    if (typeof e.shortMessage === 'string') return e.shortMessage;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Transaction failed';
}

// Make sure the connected wallet is on Base before sending a write. wagmi will
// prompt the wallet to switch networks; if it refuses the action surfaces the error.
function useEnsureBase() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  return useCallback(async () => {
    if (chainId !== BASE_CHAIN_ID) {
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
    }
  }, [chainId, switchChainAsync]);
}

interface MultiTxState {
  isPending: boolean;
  error: string | null;
  hashes: Hex[];
}

// Shared implementation for pause()/unpause(): calls the no-arg function on each
// target component (manager, teller, accountant) sequentially, collecting hashes.
function usePausableAction(functionName: 'pause' | 'unpause') {
  const ensureBase = useEnsureBase();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<MultiTxState>({ isPending: false, error: null, hashes: [] });

  const run = useCallback(
    async (targets: Address[]): Promise<Hex[]> => {
      setState({ isPending: true, error: null, hashes: [] });
      try {
        await ensureBase();
        const hashes: Hex[] = [];
        for (const address of targets) {
          const hash = await writeContractAsync({
            address,
            abi: PAUSABLE_ABI,
            functionName,
            args: [],
            chainId: BASE_CHAIN_ID,
          });
          hashes.push(hash);
          setState((s) => ({ ...s, hashes: [...s.hashes, hash] }));
        }
        setState((s) => ({ ...s, isPending: false }));
        return hashes;
      } catch (err) {
        setState((s) => ({ ...s, isPending: false, error: errMessage(err) }));
        throw err;
      }
    },
    [ensureBase, functionName, writeContractAsync],
  );

  const reset = useCallback(() => setState({ isPending: false, error: null, hashes: [] }), []);

  return { run, reset, ...state };
}

// pause() across the vault's manager, teller and accountant.
export function usePauseVault() {
  const { run, ...rest } = usePausableAction('pause');
  return { pause: run, ...rest };
}

// unpause() across the vault's manager, teller and accountant.
export function useUnpauseVault() {
  const { run, ...rest } = usePausableAction('unpause');
  return { unpause: run, ...rest };
}

interface SingleTxState {
  isPending: boolean;
  error: string | null;
  hash: Hex | null;
}

// accountant.updateExchangeRate(uint96 newExchangeRate).
export function useUpdateExchangeRate() {
  const ensureBase = useEnsureBase();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<SingleTxState>({ isPending: false, error: null, hash: null });

  const updateExchangeRate = useCallback(
    async (accountant: Address, newExchangeRate: bigint): Promise<Hex> => {
      setState({ isPending: true, error: null, hash: null });
      try {
        await ensureBase();
        const hash = await writeContractAsync({
          address: accountant,
          abi: ACCOUNTANT_ABI,
          functionName: 'updateExchangeRate',
          args: [newExchangeRate],
          chainId: BASE_CHAIN_ID,
        });
        setState({ isPending: false, error: null, hash });
        return hash;
      } catch (err) {
        setState({ isPending: false, error: errMessage(err), hash: null });
        throw err;
      }
    },
    [ensureBase, writeContractAsync],
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
export function useDeposit() {
  const ensureBase = useEnsureBase();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
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
            chainId: BASE_CHAIN_ID,
          });
          hashes.push(approveHash);
          setState({ phase: 'approving', error: null, hashes: [...hashes] });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        setState((s) => ({ ...s, phase: 'depositing' }));
        const depositHash = await writeContractAsync({
          address: teller,
          abi: TELLER_ABI,
          functionName: 'deposit',
          args: [asset, amount, 0n],
          chainId: BASE_CHAIN_ID,
        });
        hashes.push(depositHash);
        setState({ phase: 'depositing', error: null, hashes: [...hashes] });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
        if (receipt.status !== 'success') throw new Error('Deposit transaction reverted');

        setState({ phase: 'done', error: null, hashes });
        return depositHash;
      } catch (err) {
        setState((s) => ({ ...s, phase: 'idle', error: errMessage(err) }));
        throw err;
      }
    },
    [address, ensureBase, publicClient, writeContractAsync],
  );

  const reset = useCallback(() => setState({ phase: 'idle', error: null, hashes: [] }), []);

  return { deposit, reset, ...state };
}
