'use client';

import { useState } from 'react';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { usePrograms } from './usePrograms';
import { useWallets } from '@privy-io/react-auth/solana';
import { USDC_MINT, PROTOCOL_TREASURY, PROGRAM_IDS } from '@/lib/anchor';
import { findVaultState, findShareMint, findRegistryState } from '@/lib/pda';

export interface CreateAgentParams {
  name: string;
  githubHandle: string;
  endpointUrl: string;
  agentFeeBps: number;
  protocolFeeBps: number;
  challengeWindow: number;
  maxTvl: number;
  lockupEpochs: number;
  epochLength: number;
}

export function useCreateAgent() {
  const { vaultProgram, registryProgram, connection } = usePrograms();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAgent = async (params: CreateAgentParams) => {
    if (!wallet || !vaultProgram || !registryProgram) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const agentWallet = new PublicKey(wallet.address);

      const [vaultState] = findVaultState(agentWallet);
      const [shareMint] = findShareMint(vaultState);
      const [registryState] = findRegistryState(vaultState);

      const vaultUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        vaultState,
        true
      );

      const vaultTx = await vaultProgram.methods
        .initialize(
          params.agentFeeBps,
          params.protocolFeeBps,
          new BN(params.maxTvl),
          params.lockupEpochs,
          new BN(params.epochLength)
        )
        .accountsPartial({
          agentWallet,
          vaultState,
          shareMint,
          usdcMint: USDC_MINT,
          vaultUsdcAccount,
          protocolTreasury: PROTOCOL_TREASURY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(vaultTx, 'confirmed');

      const registryTx = await registryProgram.methods
        .initializeRegistry(new BN(params.challengeWindow))
        .accountsPartial({
          registryState,
          vault: vaultState,
          agentWallet,
          protocolAuthority: PROTOCOL_TREASURY,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(registryTx, 'confirmed');

      const agentUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        agentWallet
      );

      const bondAmount = new BN(10_000 * 1_000_000);

      const bondTx = await vaultProgram.methods
        .stakeBond(bondAmount)
        .accountsPartial({
          vaultState,
          agentWallet,
          agentUsdcAccount,
          vaultUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await connection.confirmTransaction(bondTx, 'confirmed');

      return {
        signature: bondTx,
        agentWallet,
        vaultState,
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to create agent';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { createAgent, isLoading, error };
}
