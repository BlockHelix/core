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
  arbitrator: string;
  jobSigner?: string;
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

      const [factoryData, { blockhash, lastValidBlockHeight }] = await Promise.all([
        factoryProgram.account.factoryState.fetch(factoryState),
        connection.getLatestBlockhash('confirmed'),
      ]);
      const agentCount = factoryData.agentCount;

      const [agentMetadata] = findAgentMetadata(factoryState, agentCount.toNumber());
      const nonce = agentCount.toNumber();
      const [vaultState] = findVaultState(agentWallet, nonce);
      const [shareMint] = findShareMint(vaultState);
      const [registryState] = findRegistryState(vaultState);

      const vaultUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, vaultState, true);
      const operatorUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, agentWallet);

      const jobSignerArg = params.jobSigner ? new PublicKey(params.jobSigner) : null;
      const transaction = await factoryProgram.methods.createAgent(
        params.name,
        params.githubHandle,
        params.endpointUrl,
        params.agentFeeBps,
        params.protocolFeeBps,
        new BN(params.challengeWindow),
        new BN(params.maxTvl),
        params.lockupEpochs,
        new BN(params.epochLength),
        new PublicKey(params.arbitrator),
        jobSignerArg
      ).accountsPartial({
        factoryState,
        agentMetadata,
        operator: agentWallet,
        vaultState,
        shareMint,
        usdcMint: USDC_MINT,
        vaultUsdcAccount,
        protocolTreasury: PROTOCOL_TREASURY,
        operatorUsdcAccount,
        registryState,
        vaultProgram: PROGRAM_IDS.VAULT,
        registryProgram: PROGRAM_IDS.REGISTRY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).transaction();

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = agentWallet;

      const serializedTx = transaction.serialize({ requireAllSignatures: false });
      const signResult = await wallet.signTransaction({ transaction: serializedTx });
      const txSig = await connection.sendRawTransaction(signResult.signedTransaction);

      await connection.confirmTransaction({
        signature: txSig,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return {
        signature: txSig,
        agentWallet,
        vaultState,
      };
    } catch (err: any) {
      let errorMsg = err?.message || 'Failed to create agent';
      if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction rejected by user';
      } else if (errorMsg.includes('0x1')) {
        errorMsg = 'Insufficient SOL balance for transaction fee';
      } else if (errorMsg.includes('already in use')) {
        errorMsg = 'Agent already exists for this wallet';
      }
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { createAgent, isLoading, error };
}
