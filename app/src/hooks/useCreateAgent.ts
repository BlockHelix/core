'use client';

import { useState } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { usePrograms } from './usePrograms';
import { useWallets } from '@privy-io/react-auth/solana';
import { USDC_MINT, PROTOCOL_TREASURY, PROGRAM_IDS } from '@/lib/anchor';
import { findVaultState, findShareMint, findRegistryState, findFactoryState, findAgentMetadata } from '@/lib/pda';

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
  targetApyBps: number;
  lendingFloorBps: number;
  arbitrator: string;
}

export function useCreateAgent() {
  const { factoryProgram, connection } = usePrograms();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAgent = async (params: CreateAgentParams) => {
    if (!wallet || !factoryProgram) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const agentWallet = new PublicKey(wallet.address);

      const [factoryState] = findFactoryState();
      const factoryData = await factoryProgram.account.factoryState.fetch(factoryState);
      const agentCount = factoryData.agentCount;

      const [agentMetadata] = findAgentMetadata(factoryState, agentCount.toNumber());
      const [vaultState] = findVaultState(agentWallet);
      const [shareMint] = findShareMint(vaultState);
      const [registryState] = findRegistryState(vaultState);

      const vaultUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        vaultState,
        true
      );

      const tx = await factoryProgram.methods
        .createAgent(
          params.name,
          params.githubHandle,
          params.endpointUrl,
          params.agentFeeBps,
          params.protocolFeeBps,
          new BN(params.challengeWindow),
          new BN(params.maxTvl),
          params.lockupEpochs,
          new BN(params.epochLength),
          params.targetApyBps,
          params.lendingFloorBps,
          new PublicKey(params.arbitrator)
        )
        .accountsPartial({
          factoryState,
          agentMetadata,
          agentWallet,
          vaultState,
          shareMint,
          usdcMint: USDC_MINT,
          vaultUsdcAccount,
          protocolTreasury: PROTOCOL_TREASURY,
          registryState,
          vaultProgram: PROGRAM_IDS.VAULT,
          registryProgram: PROGRAM_IDS.REGISTRY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(tx, 'confirmed');

      return {
        signature: tx,
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
