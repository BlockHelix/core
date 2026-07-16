'use client';

import { useCallback, useState } from 'react';
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi';
import type { Address, Hex } from 'viem';
import { BASE_CHAIN_ID } from '@/lib/vault-types';
import { ACCOUNTANT_ABI, PAUSABLE_ABI } from './abi';

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
