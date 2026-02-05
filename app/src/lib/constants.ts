import { PublicKey } from '@solana/web3.js';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'devnet';

const DEFAULT_VAULT_PROGRAM_ID = '11111111111111111111111111111111';
const DEFAULT_REGISTRY_PROGRAM_ID = '11111111111111111111111111111111';
const DEFAULT_FACTORY_PROGRAM_ID = '11111111111111111111111111111111';
const DEFAULT_USDC_MINT = 'BSjQ9jamHdSaWzgTueKsDBKNWZ74ZW73gkHPvd5qPs53';

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
