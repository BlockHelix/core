import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { createJupiterApiClient } from '@jup-ag/api';

const USDC_MINT = new PublicKey(process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const NATIVE_SOL = 'So11111111111111111111111111111111111111112';
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

const jupiter = createJupiterApiClient();

export interface SwapResult {
  txSignature: string;
  inputAmount: number;
  outputAmount: number;
}

export async function swapSolToUsdc(
  agentKeypair: Keypair,
  solAmount: number
): Promise<SwapResult | null> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');

    const quote = await jupiter.quoteGet({
      inputMint: NATIVE_SOL,
      outputMint: USDC_MINT.toBase58(),
      amount: solAmount,
      slippageBps: 100, // 1% slippage
    });

    if (!quote) {
      console.error('[jupiter] No quote available');
      return null;
    }

    const swapResult = await jupiter.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: agentKeypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      },
    });

    const swapTxBuf = Buffer.from(swapResult.swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(swapTxBuf);
    tx.sign([agentKeypair]);

    const txSig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });

    await connection.confirmTransaction(txSig, 'confirmed');

    console.log(`[jupiter] Swapped ${solAmount} lamports SOL → ${quote.outAmount} USDC, tx: ${txSig}`);

    return {
      txSignature: txSig,
      inputAmount: solAmount,
      outputAmount: parseInt(quote.outAmount),
    };
  } catch (err) {
    console.error('[jupiter] Swap failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getUsdcEquivalent(solAmount: number): Promise<number | null> {
  try {
    const quote = await jupiter.quoteGet({
      inputMint: NATIVE_SOL,
      outputMint: USDC_MINT.toBase58(),
      amount: solAmount,
      slippageBps: 100,
    });
    return quote ? parseInt(quote.outAmount) : null;
  } catch {
    return null;
  }
}
