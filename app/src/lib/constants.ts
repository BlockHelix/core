import { PublicKey } from '@solana/web3.js';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

const DEFAULT_VAULT_PROGRAM_ID = 'HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS';
const DEFAULT_REGISTRY_PROGRAM_ID = 'jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9';
const DEFAULT_FACTORY_PROGRAM_ID = '7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j';
const DEFAULT_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

function createPublicKey(key: string | undefined, defaultKey: string): PublicKey {
  try {
    return new PublicKey(key || defaultKey);
  } catch (error) {
    console.warn(`Invalid public key: ${key}, using default: ${defaultKey}`);
    return new PublicKey(defaultKey);
  }
}

export const VAULT_PROGRAM_ID = createPublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID,
  DEFAULT_VAULT_PROGRAM_ID
);

export const REGISTRY_PROGRAM_ID = createPublicKey(
  process.env.NEXT_PUBLIC_REGISTRY_PROGRAM_ID,
  DEFAULT_REGISTRY_PROGRAM_ID
);

export const FACTORY_PROGRAM_ID = createPublicKey(
  process.env.NEXT_PUBLIC_FACTORY_PROGRAM_ID,
  DEFAULT_FACTORY_PROGRAM_ID
);

export const USDC_MINT = createPublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT,
  DEFAULT_USDC_MINT
);
