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
      console.log('[createAgent] Starting...');
      const agentWallet = new PublicKey(wallet.address);
      console.log('[createAgent] Agent wallet:', agentWallet.toBase58());

      const factoryStateResult = findFactoryState();
      console.log('[createAgent] Factory state result:', factoryStateResult);
      const [factoryState] = factoryStateResult;
      console.log('[createAgent] Factory state:', factoryState.toBase58());

      const factoryData = await factoryProgram.account.factoryState.fetch(factoryState);
      console.log('[createAgent] Factory data:', factoryData);
      const agentCount = factoryData.agentCount;
      console.log('[createAgent] Agent count:', agentCount?.toString());

      console.log('[createAgent] Finding PDAs...');
      const agentMetadataResult = findAgentMetadata(factoryState, agentCount.toNumber());
      const [agentMetadata] = agentMetadataResult;
      console.log('[createAgent] Agent metadata:', agentMetadata.toBase58());

      const vaultStateResult = findVaultState(agentWallet);
      const [vaultState] = vaultStateResult;
      console.log('[createAgent] Vault state:', vaultState.toBase58());

      const shareMintResult = findShareMint(vaultState);
      const [shareMint] = shareMintResult;
      console.log('[createAgent] Share mint:', shareMint.toBase58());

      const registryStateResult = findRegistryState(vaultState);
      const [registryState] = registryStateResult;
      console.log('[createAgent] Registry state:', registryState.toBase58());

      const vaultUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        vaultState,
        true
      );
      console.log('[createAgent] Vault USDC account:', vaultUsdcAccount.toBase58());

      console.log('[createAgent] Building transaction...');
      console.log('[createAgent] factoryProgram.methods:', Object.keys(factoryProgram.methods || {}));

      console.log('[createAgent] Calling createAgent method...');
      const method = factoryProgram.methods.createAgent(
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
      );
      console.log('[createAgent] Method created:', method);

      console.log('[createAgent] Setting accounts...');
      const accountsObj = {
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
      };
      console.log('[createAgent] Accounts object keys:', Object.keys(accountsObj));
      const methodBuilder = method.accountsStrict(accountsObj);
      console.log('[createAgent] Method builder created');

      console.log('[createAgent] Getting transaction...');
      const transaction = await methodBuilder.transaction();
      console.log('[createAgent] Transaction built:', transaction);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = agentWallet;

      console.log('[createAgent] Signing transaction...');
      const serializedTx = transaction.serialize({ requireAllSignatures: false });
      const signResult = await wallet.signTransaction({ transaction: serializedTx });
      console.log('[createAgent] Transaction signed');

      console.log('[createAgent] Sending transaction...');
      const txSig = await connection.sendRawTransaction(signResult.signedTransaction);
      console.log('[createAgent] Transaction sent:', txSig);

      await connection.confirmTransaction({
        signature: txSig,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      console.log('[createAgent] Transaction confirmed');

      const tx = txSig;

      return {
        signature: tx,
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
