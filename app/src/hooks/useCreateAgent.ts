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
      console.log('[createAgent] Starting...');
      const agentWallet = new PublicKey(wallet.address);
      console.log('[createAgent] Agent wallet:', agentWallet.toBase58());

      const factoryStateResult = findFactoryState();
      console.log('[createAgent] Factory state result:', factoryStateResult);
      const [factoryState] = factoryStateResult;
      console.log('[createAgent] Factory state:', factoryState.toBase58());

      const factoryData = await factoryProgram.account.FactoryState.fetch(factoryState);
      console.log('[createAgent] Factory data:', factoryData);
      const agentCount = factoryData.agent_count;
      console.log('[createAgent] Agent count:', agentCount?.toString());

      console.log('[createAgent] Finding PDAs...');
      const agentMetadataResult = findAgentMetadata(factoryState, agentCount.toNumber());
      const [agentMetadata] = agentMetadataResult;
      console.log('[createAgent] Agent metadata:', agentMetadata.toBase58());

      const nonce = agentCount.toNumber();
      const vaultStateResult = findVaultState(agentWallet, nonce);
      const [vaultState] = vaultStateResult;
      console.log('[createAgent] Vault state:', vaultState.toBase58(), 'nonce:', nonce);

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
      console.log('[createAgent] factoryProgram:', factoryProgram);
      console.log('[createAgent] factoryProgram.methods:', factoryProgram?.methods);
      console.log('[createAgent] factoryProgram.idl:', factoryProgram?.idl);

      const dump = (x: any) => ({
        t: typeof x,
        isArray: Array.isArray(x),
        ctor: x?.constructor?.name,
        val: String(x).slice(0, 50),
      });

      console.log('[createAgent] args dump', {
        name: dump(params.name),
        githubHandle: dump(params.githubHandle),
        endpointUrl: dump(params.endpointUrl),
        agentFeeBps: dump(params.agentFeeBps),
        protocolFeeBps: dump(params.protocolFeeBps),
        challengeWindow: dump(params.challengeWindow),
        maxTvl: dump(params.maxTvl),
        lockupEpochs: dump(params.lockupEpochs),
        epochLength: dump(params.epochLength),
        arbitrator: dump(params.arbitrator),
      });

      console.log('[createAgent] Calling createAgent method...');
      const jobSignerArg = params.jobSigner ? new PublicKey(params.jobSigner) : null;
      const method = factoryProgram.methods.create_agent(
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
      );
      console.log('[createAgent] Method created:', method);

      console.log('[createAgent] Setting accounts...');
      const accountsObj = {
        factory_state: factoryState,
        agent_metadata: agentMetadata,
        operator: agentWallet,
        vault_state: vaultState,
        share_mint: shareMint,
        usdc_mint: USDC_MINT,
        vault_usdc_account: vaultUsdcAccount,
        protocol_treasury: PROTOCOL_TREASURY,
        registry_state: registryState,
        vault_program: PROGRAM_IDS.VAULT,
        registry_program: PROGRAM_IDS.REGISTRY,
        token_program: TOKEN_PROGRAM_ID,
        associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
        system_program: SystemProgram.programId,
      };
      console.log('[createAgent] Accounts object keys:', Object.keys(accountsObj));
      const methodBuilder = method.accountsStrict(accountsObj);
      console.log('[createAgent] Method builder created');

      console.log('[createAgent] Trying instruction() first...');
      try {
        const ix = await methodBuilder.instruction();
        console.log('[createAgent] instruction() succeeded:', ix);
      } catch (ixErr: any) {
        console.error('[createAgent] instruction() failed:', ixErr?.message);
      }

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
