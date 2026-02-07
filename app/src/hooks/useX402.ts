'use client';

import { useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, getMint, getAccount } from '@solana/spl-token';
import { RPC_URL } from '@/lib/anchor';

const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const NATIVE_SOL = 'So11111111111111111111111111111111111111112';

interface PaymentOption {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
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
    // Check SOL balance first (preferred - no ATA needed)
    const solBalance = await connection.getBalance(payerPubkey);
    const solOption = options.find(o => o.asset === NATIVE_SOL);
    if (solOption && solBalance >= BigInt(solOption.amount) + BigInt(10000)) {
      console.log('[x402] Using SOL payment');
      return solOption;
    }

    // Check USDC balance
    const usdcOption = options.find(o => o.asset === USDC_DEVNET.toString());
    if (usdcOption) {
      try {
        const ata = await getAssociatedTokenAddress(USDC_DEVNET, payerPubkey);
        const account = await getAccount(connection, ata);
        if (account.amount >= BigInt(usdcOption.amount)) {
          console.log('[x402] Using USDC payment');
          return usdcOption;
        }
      } catch {
        // ATA doesn't exist or no balance
      }
    }

    // Fall back to first option (will fail but shows error)
    return options[0] || null;
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

    const payToPubkey = new PublicKey(paymentOption.payTo);
    const amount = BigInt(paymentOption.amount);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payerPubkey;

    if (paymentOption.asset === NATIVE_SOL) {
      // Native SOL transfer
      console.log(`[x402] Creating SOL transfer: ${Number(amount) / LAMPORTS_PER_SOL} SOL`);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payerPubkey,
          toPubkey: payToPubkey,
          lamports: amount,
        })
      );
    } else {
      // SPL Token transfer (USDC)
      const mint = new PublicKey(paymentOption.asset);
      const mintInfo = await getMint(connection, mint);
      const sourceAta = await getAssociatedTokenAddress(mint, payerPubkey);
      const destAta = await getAssociatedTokenAddress(mint, payToPubkey);

      console.log(`[x402] Creating USDC transfer: ${Number(amount) / Math.pow(10, mintInfo.decimals)} USDC`);
      tx.add(
        createTransferCheckedInstruction(
          sourceAta,
          mint,
          destAta,
          payerPubkey,
          amount,
          mintInfo.decimals
        )
      );
    }

    const serialized = tx.serialize({ requireAllSignatures: false });
    const signResult = await wallet.signTransaction({ transaction: serialized });
    const signedTx = Transaction.from(signResult.signedTransaction);
    console.log('[x402] Transaction signed, building payment payload...');

    // Build full x402 PaymentPayload
    const payload = {
      x402Version: requirements.x402Version,
      resource: requirements.resource || { url: '', description: '', mimeType: '' },
      accepted: paymentOption,
      payload: {
        transaction: Buffer.from(signedTx.serialize()).toString('base64'),
      },
    };

    console.log('[x402] Payment payload:', JSON.stringify(payload, null, 2));
    return btoa(JSON.stringify(payload));
  }, [wallet, selectPaymentOption]);

  const fetchWithPayment = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const response = await fetch(url, options);

    if (response.status !== 402) {
      return response;
    }

    // Debug: log all available headers
    console.log('[x402] 402 received, available headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value.substring(0, 50)}...`);
    });

    // Try both cases
    const paymentRequiredHeader = response.headers.get('payment-required') || response.headers.get('Payment-Required');
    if (!paymentRequiredHeader) {
      console.error('[x402] payment-required header not found in response');
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
        'X-PAYMENT': paymentSignature,
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
