'use client';

import { useState } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { usePrograms } from './usePrograms';
import { useWallets } from '@privy-io/react-auth/solana';
import { findDepositRecord } from '@/lib/pda';

export function useDeposit() {
  const { vaultProgram, connection } = usePrograms();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = async (vaultState: PublicKey, shareMint: PublicKey, usdcAmount: number) => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const depositor = new PublicKey(wallet.address);

      const vaultData = await vaultProgram.account.vaultState.fetch(vaultState);
      const usdcMint = vaultData.usdcMint;

      const depositorUsdcAccount = await getAssociatedTokenAddress(
        usdcMint,
        depositor
      );

      const depositorShareAccount = await getAssociatedTokenAddress(
        shareMint,
        depositor
      );

      const vaultUsdcAccount = await getAssociatedTokenAddress(
        usdcMint,
        vaultState,
        true
      );

      const [depositRecord] = findDepositRecord(vaultState, depositor);

      const amountMicroUsdc = new BN(Math.floor(usdcAmount * 1_000_000));

      const tx = await vaultProgram.methods
        .deposit(amountMicroUsdc)
        .accountsPartial({
          vaultState,
          depositor,
          depositorUsdcAccount,
          depositorShareAccount,
        })
        .rpc();

      await connection.confirmTransaction(tx, 'confirmed');

      return { signature: tx };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to deposit';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { deposit, isLoading, error };
}

export function useWithdraw() {
  const { vaultProgram, connection } = usePrograms();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async (vaultState: PublicKey, shareMint: PublicKey, shareAmount: number) => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const withdrawer = new PublicKey(wallet.address);

      const vaultData = await vaultProgram.account.vaultState.fetch(vaultState);
      const usdcMint = vaultData.usdcMint;

      const withdrawerUsdcAccount = await getAssociatedTokenAddress(
        usdcMint,
        withdrawer
      );

      const withdrawerShareAccount = await getAssociatedTokenAddress(
        shareMint,
        withdrawer
      );

      const vaultUsdcAccount = await getAssociatedTokenAddress(
        usdcMint,
        vaultState,
        true
      );

      const [depositRecord] = findDepositRecord(vaultState, withdrawer);

      const shareMicroAmount = new BN(Math.floor(shareAmount * 1_000_000));

      const tx = await vaultProgram.methods
        .withdraw(shareMicroAmount)
        .accountsPartial({
          vaultState,
          withdrawer,
          withdrawerUsdcAccount,
          withdrawerShareAccount,
        })
        .rpc();

      await connection.confirmTransaction(tx, 'confirmed');

      return { signature: tx };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to withdraw';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { withdraw, isLoading, error };
}
