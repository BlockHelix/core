import { PublicKey } from '@solana/web3.js';

export const PROGRAM_IDS = {
  VAULT: new PublicKey('HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS'),
  REGISTRY: new PublicKey('jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9'),
  FACTORY: new PublicKey('7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j'),
};

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);
export const PROTOCOL_TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_PROTOCOL_TREASURY || '8MYvV1Z1CkNwi8BC9R9Lz71Ag59LWwzTBiui6QpHr1Tg'
);
