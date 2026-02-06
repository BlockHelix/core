'use client';

import { useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, getMint } from '@solana/spl-token';
import { RPC_URL } from '@/lib/anchor';

const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

interface PaymentRequirements {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    extra?: { feePayer?: string };
  }>;
}

export function useX402() {
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const createPayment = useCallback(async (requirements: PaymentRequirements) => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    const paymentOption = requirements.accepts[0];
    if (!paymentOption) {
      throw new Error('No payment options available');
    }

    if (paymentOption.scheme !== 'exact') {
      throw new Error(`Unsupported payment scheme: ${paymentOption.scheme}`);
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const payerPubkey = new PublicKey(wallet.address);
    const payToPubkey = new PublicKey(paymentOption.payTo);
    const amount = BigInt(paymentOption.amount);

    const mint = await getMint(connection, USDC_DEVNET);
    const sourceAta = await getAssociatedTokenAddress(USDC_DEVNET, payerPubkey);
    const destAta = await getAssociatedTokenAddress(USDC_DEVNET, payToPubkey);

    const transferIx = createTransferCheckedInstruction(
      sourceAta,
      USDC_DEVNET,
      destAta,
      payerPubkey,
      amount,
      mint.decimals
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction();
    tx.add(transferIx);
    tx.recentBlockhash = blockhash;
    tx.feePayer = payerPubkey;

    const serialized = tx.serialize({ requireAllSignatures: false });
    const signResult = await wallet.signTransaction({ transaction: serialized });
    const signedTx = Transaction.from(signResult.signedTransaction);

    const txSig = await connection.sendRawTransaction(signedTx.serialize());

    await connection.confirmTransaction({
      signature: txSig,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    const payload = {
      x402Version: requirements.x402Version,
      payload: {
        transaction: Buffer.from(signedTx.serialize()).toString('base64'),
      },
    };

    return btoa(JSON.stringify(payload));
  }, [wallet]);

  const fetchWithPayment = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const response = await fetch(url, options);

    if (response.status !== 402) {
      return response;
    }

    const paymentRequiredHeader = response.headers.get('payment-required');
    if (!paymentRequiredHeader) {
      throw new Error('402 response missing payment-required header');
    }

    const requirements: PaymentRequirements = JSON.parse(atob(paymentRequiredHeader));
    console.log('[x402] Payment required:', requirements);

    const paymentSignature = await createPayment(requirements);
    console.log('[x402] Payment created, retrying request...');

    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'PAYMENT-SIGNATURE': paymentSignature,
      },
    });

    return retryResponse;
  }, [createPayment]);

  return {
    fetchWithPayment,
    createPayment,
    isReady: !!wallet,
  };
}
