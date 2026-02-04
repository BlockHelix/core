'use client';

import { useMemo } from 'react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
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
        vaultProgram: new Program(AgentVaultIDL as AgentVault, dummyProvider),
        factoryProgram: new Program(AgentFactoryIDL as AgentFactory, dummyProvider),
        registryProgram: new Program(ReceiptRegistryIDL as ReceiptRegistry, dummyProvider),
      };
    }

    const anchorWallet = {
      publicKey: new PublicKey(wallet.address),
      signTransaction: async (tx: any) => {
        const result: any = await wallet.signTransaction({
          transaction: tx as any,
        });
        return (result.transaction || result);
      },
      signAllTransactions: async (txs: any[]) => {
        const results: any[] = await Promise.all(
          txs.map((tx) =>
            wallet.signTransaction({
              transaction: tx as any,
            })
          )
        );
        return results.map((r) => r.transaction || r);
      },
    };

    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: 'confirmed',
    });

    return {
      connection,
      provider,
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
