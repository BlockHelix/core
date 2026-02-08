import { PublicKey } from '@solana/web3.js';

export const NETWORK = process.env.NETWORK || 'devnet';

const DEVNET_CONFIG = {
  rpcUrl: 'https://api.devnet.solana.com',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  programIds: {
    vault: 'HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS',
    registry: 'jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9',
    factory: '7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j',
  },
};

const MAINNET_CONFIG = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  programIds: {
    vault: '',
    registry: '',
    factory: '',
  },
};

const config = NETWORK === 'mainnet' ? MAINNET_CONFIG : DEVNET_CONFIG;

if (NETWORK === 'mainnet' && !config.programIds.vault) {
  throw new Error('Mainnet program IDs not configured');
}

export const RPC_URL = process.env.ANCHOR_PROVIDER_URL || config.rpcUrl;
export const USDC_MINT = new PublicKey(process.env.USDC_MINT || config.usdcMint);
export const VAULT_PROGRAM_ID = new PublicKey(process.env.VAULT_PROGRAM_ID || config.programIds.vault);
export const REGISTRY_PROGRAM_ID = new PublicKey(process.env.REGISTRY_PROGRAM_ID || config.programIds.registry);
export const FACTORY_PROGRAM_ID = new PublicKey(process.env.FACTORY_PROGRAM_ID || config.programIds.factory);
