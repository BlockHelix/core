import { Mppx, solana } from '@solana/mpp/server';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response, NextFunction } from 'express';

const SOLANA_NETWORK = process.env.SOLANA_NETWORK === 'mainnet' ? 'mainnet-beta' : 'devnet';
const AGENT_WALLET = process.env.AGENT_WALLET || '97hcopf5v277jJhDD91DzXMwCJs5UR6659Lzdny14oYm';
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT = SOLANA_NETWORK === 'mainnet-beta' ? USDC_MAINNET : USDC_DEVNET;
const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY || process.env.ENCRYPTION_KEY || 'blockhelix-mpp-dev';

let mppInstance: any = null;

function getMpp() {
  if (mppInstance) return mppInstance;

  mppInstance = Mppx.create({
    methods: [
      solana.charge({
        recipient: AGENT_WALLET,
        currency: USDC_MINT,
        decimals: 6,
        network: SOLANA_NETWORK,
      }),
    ],
    secretKey: MPP_SECRET_KEY,
  });

  console.log(`[mpp] Initialized for ${SOLANA_NETWORK}, recipient=${AGENT_WALLET}`);
  return mppInstance;
}

export function mppPaymentMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const hasPaymentAuth = authHeader && authHeader.startsWith('Payment ');
    const isPaymentChallenge = !hasPaymentAuth;

    if (!req.path.match(/\/v1\/agent\/.*\/run/) || req.method !== 'POST') {
      return next();
    }

    const mpp = getMpp();
    const agentId = req.params.agentId || req.path.split('/')[3];
    const price = req.headers['x-agent-price'] as string || '100000';

    const handler = mpp.solana.charge({
      amount: price,
      currency: USDC_MINT,
      recipient: AGENT_WALLET,
      description: `BlockHelix agent ${agentId} run`,
    });

    const nodeHandler = Mppx.toNodeListener(handler);
    const result = await nodeHandler(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    );

    if (result.status === 402) {
      return;
    }

    (req as any).mppPayment = true;
    next();
  };
}

export function isMppRequest(req: Request): boolean {
  const authHeader = req.headers['authorization'];
  return !!(authHeader && authHeader.startsWith('Payment '));
}

export function isX402Request(req: Request): boolean {
  return !!(req.headers['payment-signature'] || req.headers['x-payment']);
}
