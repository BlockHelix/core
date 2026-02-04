import { HTTPFacilitatorClient } from '@x402/core/server';
import { x402ResourceServer } from '@x402/express';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import type { RoutesConfig } from '@x402/core/server';

const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const AGENT_WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS || '';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet' ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;

export const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

export const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactSvmScheme());

export const routes: RoutesConfig = {
  'POST /analyze': {
    accepts: {
      scheme: 'exact',
      price: '$0.05',
      network: NETWORK,
      payTo: AGENT_WALLET_ADDRESS,
    },
    description: 'DeFi code security analysis powered by Claude',
    mimeType: 'application/json',
  },
  'POST /patch': {
    accepts: {
      scheme: 'exact',
      price: '$0.10',
      network: NETWORK,
      payTo: AGENT_WALLET_ADDRESS,
    },
    description: 'AI-generated code patch for DeFi vulnerabilities',
    mimeType: 'application/json',
  },
};

export const PRICE_ANALYZE_USDC = 50_000; // $0.05 in 6-decimal USDC
export const PRICE_PATCH_USDC = 100_000;  // $0.10 in 6-decimal USDC
