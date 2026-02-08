'use client';

import { useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  getMint,
  getAccount,
} from '@solana/spl-token';
import { RPC_URL } from '@/lib/anchor';

const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

interface PaymentOption {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: { feePayer?: string };
}

interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

interface PaymentRequirements {
  x402Version: number;
  resource?: ResourceInfo;
  accepts: PaymentOption[];
}

export function useX402() {
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const selectPaymentOption = useCallback(async (
    connection: Connection,
    payerPubkey: PublicKey,
    options: PaymentOption[]
  ): Promise<PaymentOption | null> => {
    // x402 SVM scheme requires SPL tokens (USDC), not native SOL
    const usdcOption = options.find(o => o.asset === USDC_DEVNET.toString());
    if (usdcOption) {
      try {
        const ata = await getAssociatedTokenAddress(USDC_DEVNET, payerPubkey);
        const account = await getAccount(connection, ata);
        if (account.amount >= BigInt(usdcOption.amount)) {
          return usdcOption;
        }
      } catch {
        // No USDC balance
      }
    }
    return usdcOption || options[0] || null;
  }, []);

  const createPayment = useCallback(async (requirements: PaymentRequirements) => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const payerPubkey = new PublicKey(wallet.address);

    const paymentOption = await selectPaymentOption(connection, payerPubkey, requirements.accepts);
    if (!paymentOption) {
      throw new Error('No payment options available');
    }

    if (paymentOption.scheme !== 'exact') {
      throw new Error(`Unsupported payment scheme: ${paymentOption.scheme}`);
    }

    // x402 requires facilitator as fee payer
    const feePayer = paymentOption.extra?.feePayer;
    if (!feePayer) {
      throw new Error('Payment option missing feePayer');
    }
    const feePayerPubkey = new PublicKey(feePayer);

    const payToPubkey = new PublicKey(paymentOption.payTo);
    const amount = BigInt(paymentOption.amount);
    const mint = new PublicKey(paymentOption.asset);

    const mintInfo = await getMint(connection, mint);
    const sourceAta = await getAssociatedTokenAddress(mint, payerPubkey);
    const destAta = await getAssociatedTokenAddress(mint, payToPubkey);

    // x402 exact SVM scheme requires exactly 4 instructions:
    // 1. ComputeLimit, 2. ComputePrice, 3. TransferChecked, 4. Memo
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        destAta,
        payerPubkey,
        amount,
        mintInfo.decimals
      ),
    ];

    // Add memo for uniqueness
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const memoData = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
    instructions.push({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoData),
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Use VersionedTransaction with v0 message as expected by x402
    const messageV0 = new TransactionMessage({
      payerKey: feePayerPubkey, // Facilitator pays fees
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);

    // Sign with user's wallet (for the transfer authorization)
    const serialized = tx.serialize();
    const signResult = await wallet.signTransaction({ transaction: serialized });
    const signedTx = VersionedTransaction.deserialize(signResult.signedTransaction);

    // Build x402 payment payload
    const payload = {
      x402Version: requirements.x402Version,
      resource: requirements.resource || { url: '', description: '', mimeType: '' },
      accepted: paymentOption,
      payload: {
        transaction: Buffer.from(signedTx.serialize()).toString('base64'),
      },
    };

    return btoa(JSON.stringify(payload));
  }, [wallet, selectPaymentOption]);

  const fetchWithPayment = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const response = await fetch(url, options);

    if (response.status !== 402) {
      return response;
    }

    const paymentRequiredHeader = response.headers.get('PAYMENT-REQUIRED') || response.headers.get('payment-required') || response.headers.get('Payment-Required');
    if (!paymentRequiredHeader) {
      const allHeaders: string[] = [];
      response.headers.forEach((_v, k) => allHeaders.push(k));
      console.error('[x402] payment-required header not found. Visible headers:', allHeaders);
      throw new Error('402 response missing payment-required header');
    }

    const requirements: PaymentRequirements = JSON.parse(atob(paymentRequiredHeader));
    const paymentSignature = await createPayment(requirements);

    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'PAYMENT-SIGNATURE': paymentSignature,
      },
    });

    // Log retry response details
    if (!retryResponse.ok) {
      const retryHeader = retryResponse.headers.get('payment-required');
      if (retryHeader) {
        try {
          const errorDetails = JSON.parse(atob(retryHeader));
          console.error('[x402] Payment rejected:', errorDetails.error);
        } catch {}
      }
    }

    return retryResponse;
  }, [createPayment]);

  return {
    fetchWithPayment,
    createPayment,
    isReady: !!wallet,
  };
}
