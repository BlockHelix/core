'use client';

import { useMemo, useCallback } from 'react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useWallets } from '@privy-io/react-auth/solana';
import { PROGRAM_IDS, RPC_URL } from '@/lib/anchor';
import { AgentVault } from '@/lib/idl/agent_vault';
import { AgentFactory } from '@/lib/idl/agent_factory';
import { ReceiptRegistry } from '@/lib/idl/receipt_registry';
import AgentVaultIDL from '@/lib/idl/agent_vault.json';
import AgentFactoryIDL from '@/lib/idl/agent_factory.json';
import ReceiptRegistryIDL from '@/lib/idl/receipt_registry.json';

export function usePrograms() {
  const { wallets } = useWallets();
  const wallet = wallets[0];

  return useMemo(() => {
    const connection = new Connection(RPC_URL, 'confirmed');

    if (!wallet) {
      const dummyProvider = new AnchorProvider(
        connection,
        {} as any,
        { commitment: 'confirmed' }
      );

      return {
        connection,
        wallet: null,
        vaultProgram: new Program(AgentVaultIDL as AgentVault, dummyProvider),
        factoryProgram: new Program(AgentFactoryIDL as AgentFactory, dummyProvider),
        registryProgram: new Program(ReceiptRegistryIDL as ReceiptRegistry, dummyProvider),
      };
    }

    const anchorWallet = {
      publicKey: new PublicKey(wallet.address),
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        const serialized = tx.serialize({ requireAllSignatures: false });
        const result = await wallet.signTransaction({ transaction: serialized });
        return Transaction.from(result.signedTransaction) as T;
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        const results = await Promise.all(txs.map(async (tx) => {
          const serialized = tx.serialize({ requireAllSignatures: false });
          const result = await wallet.signTransaction({ transaction: serialized });
          return Transaction.from(result.signedTransaction) as T;
        }));
        return results;
      },
    };

    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: 'confirmed',
      skipPreflight: false,
    });

    return {
      connection,
      provider,
      wallet,
      vaultProgram: new Program(AgentVaultIDL as AgentVault, provider),
      factoryProgram: new Program(AgentFactoryIDL as AgentFactory, provider),
      registryProgram: new Program(ReceiptRegistryIDL as ReceiptRegistry, provider),
    };
  }, [wallet]);
}

export function useVaultProgram() {
  const { vaultProgram } = usePrograms();
  return vaultProgram;
}

export function useFactoryProgram() {
  const { factoryProgram } = usePrograms();
  return factoryProgram;
}

export function useRegistryProgram() {
  const { registryProgram } = usePrograms();
  return registryProgram;
}
