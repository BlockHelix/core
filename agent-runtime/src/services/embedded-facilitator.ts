import { x402Facilitator } from '@x402/core/facilitator';
import { ExactSvmScheme } from '@x402/svm/exact/facilitator';
import { toFacilitatorSvmSigner } from '@x402/svm';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import type { PaymentPayload, PaymentRequirements, VerifyResponse, SettleResponse } from '@x402/core/types';

const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet' ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

let embeddedFacilitator: x402Facilitator | null = null;
let initPromise: Promise<x402Facilitator> | null = null;

async function initFacilitator(): Promise<x402Facilitator> {
  const privateKeyEnv = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!privateKeyEnv) {
    throw new Error('AGENT_WALLET_PRIVATE_KEY required for embedded facilitator');
  }

  const secretKey = Uint8Array.from(JSON.parse(privateKeyEnv));
  const keypairSigner = await createKeyPairSignerFromBytes(secretKey);
  const svmSigner = toFacilitatorSvmSigner(keypairSigner, { defaultRpcUrl: RPC_URL });

  const facilitator = new x402Facilitator();
  facilitator.register(NETWORK, new ExactSvmScheme(svmSigner));

  console.log(`[facilitator] Embedded facilitator initialized for ${NETWORK}`);
  console.log(`[facilitator] Fee payer: ${keypairSigner.address}`);

  return facilitator;
}

export async function getEmbeddedFacilitator(): Promise<x402Facilitator> {
  if (embeddedFacilitator) return embeddedFacilitator;
  if (initPromise) return initPromise;

  initPromise = initFacilitator();
  embeddedFacilitator = await initPromise;
  return embeddedFacilitator;
}

export class EmbeddedFacilitatorClient {
  private facilitator: x402Facilitator | null = null;

  async verify(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): Promise<VerifyResponse> {
    if (!this.facilitator) {
      this.facilitator = await getEmbeddedFacilitator();
    }
    return this.facilitator.verify(paymentPayload, paymentRequirements);
  }

  async settle(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): Promise<SettleResponse> {
    if (!this.facilitator) {
      this.facilitator = await getEmbeddedFacilitator();
    }
    return this.facilitator.settle(paymentPayload, paymentRequirements);
  }

  async getSupported() {
    if (!this.facilitator) {
      this.facilitator = await getEmbeddedFacilitator();
    }
    return this.facilitator.getSupported();
  }
}
