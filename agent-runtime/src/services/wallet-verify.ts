import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export interface VerifySignatureParams {
  message: string;
  signature: string;
  publicKey: string;
}

export function verifyWalletSignature(params: VerifySignatureParams): boolean {
  try {
    const messageBytes = new TextEncoder().encode(params.message);
    const signatureBytes = bs58.decode(params.signature);
    const publicKeyBytes = new PublicKey(params.publicKey).toBytes();

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('[wallet-verify] Signature verification failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export function createSignMessage(agentId: string, action: string): string {
  const timestamp = Date.now();
  return `BlockHelix: ${action} agent ${agentId} at ${timestamp}`;
}

export function parseSignMessage(message: string): { agentId: string; action: string; timestamp: number } | null {
  const match = message.match(/^BlockHelix: (.+) agent (.+) at (\d+)$/);
  if (!match) return null;

  return {
    action: match[1],
    agentId: match[2],
    timestamp: parseInt(match[3], 10),
  };
}

export function isMessageRecent(timestamp: number, maxAgeMs: number = 60000): boolean {
  return Date.now() - timestamp < maxAgeMs;
}
