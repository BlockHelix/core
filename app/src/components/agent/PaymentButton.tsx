'use client';

import { useState } from 'react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { usePrograms } from '@/hooks/usePrograms';
import { useWallets } from '@privy-io/react-auth/solana';
import { USDC_MINT } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface PaymentButtonProps {
  amount: number;
  onPaymentComplete: (signature: string) => void;
}

export default function PaymentButton({ amount, onPaymentComplete }: PaymentButtonProps) {
  const { connection } = usePrograms();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [isProcessing, setIsProcessing] = useState(false);

  const treasuryAddress = process.env.NEXT_PUBLIC_PROTOCOL_TREASURY;

  const handlePayment = async () => {
    if (!wallet) {
      toast('Please connect your wallet first', 'error');
      return;
    }

    if (!treasuryAddress) {
      toast('Treasury address not configured', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const payer = new PublicKey(wallet.address);
      const treasury = new PublicKey(treasuryAddress);

      const payerUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        payer
      );

      const treasuryUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        treasury
      );

      const amountMicroUsdc = Math.floor(amount * 1_000_000);

      const transaction = new Transaction();
      transaction.add(
        createTransferInstruction(
          payerUsdcAccount,
          treasuryUsdcAccount,
          payer,
          amountMicroUsdc,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer;

      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const signedTransaction = await wallet.signTransaction({
        transaction: serialized as any,
      });

      const signature = await connection.sendRawTransaction(signedTransaction as unknown as Uint8Array, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      toast('Confirming payment...', 'info');

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      toast('Payment confirmed!', 'success');
      onPaymentComplete(signature);
    } catch (err: any) {
      console.error('Payment error:', err);
      let errorMsg = 'Payment failed';
      if (err.message?.includes('insufficient funds')) {
        errorMsg = 'Insufficient USDC balance';
      } else if (err.message?.includes('User rejected')) {
        errorMsg = 'Transaction rejected';
      }
      toast(errorMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isProcessing}
      className={`
        w-full px-6 py-4 font-mono text-sm uppercase tracking-wider transition-all duration-300
        ${isProcessing
          ? 'bg-white/10 text-white/40 cursor-not-allowed'
          : 'bg-emerald-400 text-black hover:bg-emerald-300'
        }
      `}
    >
      {isProcessing ? (
        <span className="flex items-center justify-center">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing Payment...
        </span>
      ) : (
        `Pay ${amount.toFixed(2)} USDC`
      )}
    </button>
  );
}
