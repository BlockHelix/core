'use client';

import { useState } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
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
      const usdcMint = vaultData.usdcMint as PublicKey;
      const operator = vaultData.operator as PublicKey;

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

      const operatorShareAccount = await getAssociatedTokenAddress(
        shareMint,
        operator
      );

      const [depositRecord] = findDepositRecord(vaultState, depositor);

      const amountMicroUsdc = new BN(Math.floor(usdcAmount * 1_000_000));

      const createOperatorAta = createAssociatedTokenAccountIdempotentInstruction(
        depositor, operatorShareAccount, operator, shareMint
      );

      const tx = await vaultProgram.methods
        .deposit(amountMicroUsdc, new BN(0))
        .preInstructions([createOperatorAta])
        .accountsPartial({
          vaultState: vaultState,
          shareMint: shareMint,
          vaultUsdcAccount: vaultUsdcAccount,
          depositor: depositor,
          depositorUsdcAccount: depositorUsdcAccount,
          depositorShareAccount: depositorShareAccount,
          operatorShareAccount: operatorShareAccount,
          depositRecord: depositRecord,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(tx, 'confirmed');

      return { signature: tx };
    } catch (err: any) {
      let errorMsg = err?.message || 'Failed to deposit';
      if (errorMsg.includes('insufficient funds')) {
        errorMsg = 'Insufficient USDC balance in wallet';
      } else if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction rejected by user';
      } else if (errorMsg.includes('0x1')) {
        errorMsg = 'Insufficient account balance for transaction fee';
      }
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
      const usdcMint = vaultData.usdcMint as PublicKey;

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
        .withdraw(shareMicroAmount, new BN(0))
        .accountsPartial({
          vaultState: vaultState,
          shareMint: shareMint,
          vaultUsdcAccount: vaultUsdcAccount,
          withdrawer,
          withdrawerUsdcAccount: withdrawerUsdcAccount,
          withdrawerShareAccount: withdrawerShareAccount,
          depositRecord: depositRecord,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await connection.confirmTransaction(tx, 'confirmed');

      return { signature: tx };
    } catch (err: any) {
      let errorMsg = err?.message || 'Failed to withdraw';
      if (errorMsg.includes('insufficient funds')) {
        errorMsg = 'Insufficient share balance';
      } else if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction rejected by user';
      } else if (errorMsg.includes('0x1')) {
        errorMsg = 'Insufficient account balance for transaction fee';
      }
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { withdraw, isLoading, error };
}
