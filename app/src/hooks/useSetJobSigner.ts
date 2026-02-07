'use client';

import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { usePrograms } from './usePrograms';
import { findRegistryState } from '@/lib/pda';

export function useSetJobSigner() {
  const { registryProgram } = usePrograms();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setJobSigner = async (vaultPubkey: PublicKey, newSignerPubkey: PublicKey): Promise<string | null> => {
    if (!registryProgram) {
      setError('Registry program not available');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [registryState] = findRegistryState(vaultPubkey);

      const tx = await (registryProgram.methods as any)
        .setJobSigner(newSignerPubkey)
        .accounts({
          registryState,
        })
        .rpc();

      return tx;
    } catch (err: any) {
      console.error('setJobSigner failed:', err);
      setError(err.message || 'Failed to set job signer');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { setJobSigner, isLoading, error };
}
