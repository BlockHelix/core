import { PublicKey } from '@solana/web3.js';

export type Network = 'devnet' | 'mainnet';

const NETWORK: Network = (process.env.NEXT_PUBLIC_NETWORK as Network) || 'devnet';

const CONFIG = {
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    programIds: {
      vault: 'HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS',
      registry: 'jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9',
      factory: '7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j',
    },
    protocolTreasury: '8MYvV1Z1CkNwi8BC9R9Lz71Ag59LWwzTBiui6QpHr1Tg',
    runtimeUrl: 'https://agents.blockhelix.tech',
    explorerUrl: 'https://explorer.solana.com',
    explorerSuffix: '?cluster=devnet',
  },
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Circle mainnet USDC
    programIds: {
      vault: '', // TODO: deploy to mainnet
      registry: '',
      factory: '',
    },
    protocolTreasury: '', // TODO: set mainnet treasury
    runtimeUrl: 'https://agents.blockhelix.tech', // TODO: mainnet runtime
    explorerUrl: 'https://explorer.solana.com',
    explorerSuffix: '',
  },
} as const;

export const networkConfig = CONFIG[NETWORK];

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || networkConfig.rpcUrl;
export const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT || networkConfig.usdcMint);
export const PROTOCOL_TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_PROTOCOL_TREASURY || networkConfig.protocolTreasury
);

export const PROGRAM_IDS = {
  VAULT: new PublicKey(process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID || networkConfig.programIds.vault),
  REGISTRY: new PublicKey(process.env.NEXT_PUBLIC_REGISTRY_PROGRAM_ID || networkConfig.programIds.registry),
  FACTORY: new PublicKey(process.env.NEXT_PUBLIC_FACTORY_PROGRAM_ID || networkConfig.programIds.factory),
};

export const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || networkConfig.runtimeUrl;

export function getExplorerUrl(address: string, type: 'address' | 'tx' = 'address'): string {
  return `${networkConfig.explorerUrl}/${type}/${address}${networkConfig.explorerSuffix}`;
}

export { NETWORK };
