'use client';

import { useState } from 'react';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useWallets } from '@privy-io/react-auth/solana';
import { useAuth } from '@/hooks/useAuth';
import { USDC_MINT, RPC_URL } from '@/lib/anchor';
import { toast, toastTx } from '@/lib/toast';

interface Props {
  agentWallet: string;
  vaultName: string;
}

type Mode = 'idle' | 'pick' | 'custom';

const PRESETS = [
  { label: '$5', usdc: 5 },
  { label: '$20', usdc: 20 },
  { label: '$50', usdc: 50 },
];

export default function FundButton({ agentWallet, vaultName }: Props) {
  const { walletAddress, login, authenticated } = useAuth();
  const { wallets } = useWallets();
  const signer = wallets[0];
  const [mode, setMode] = useState<Mode>('idle');
  const [customAmount, setCustomAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const sendUsdc = async (amount: number) => {
    if (!walletAddress || !signer) {
      toast('connect wallet first', 'error');
      return;
    }
    if (amount <= 0 || amount > 10_000) {
      toast('amount must be between $0.01 and $10,000', 'error');
      return;
    }

    setBusy(true);
    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const from = new PublicKey(walletAddress);
      const to = new PublicKey(agentWallet);
      const microUsdc = Math.floor(amount * 1_000_000);

      const fromAta = await getAssociatedTokenAddress(USDC_MINT, from);
      const toAta = await getAssociatedTokenAddress(USDC_MINT, to);

      const tx = new Transaction();

      // Create the recipient's ATA if it doesn't exist
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          from, toAta, to, USDC_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );

      tx.add(
        createTransferInstruction(fromAta, toAta, from, BigInt(microUsdc)),
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = from;

      const serialized = tx.serialize({ requireAllSignatures: false });
      const result = await signer.signTransaction({ transaction: serialized });
      const signed = Transaction.from(result.signedTransaction);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

      toastTx(`sent $${amount} USDC to ${vaultName}`, sig);
      setMode('idle');
      setCustomAmount('');
    } catch (err: any) {
      toast(err?.message || 'transfer failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="px-6 py-2.5 border border-white/20 text-white/50 text-xs rounded-full hover:border-white/40 transition-colors"
      >
        connect to fund
      </button>
    );
  }

  if (mode === 'idle') {
    return (
      <button
        onClick={() => setMode('pick')}
        className="px-6 py-2.5 border border-emerald-400/30 text-emerald-200/70 text-xs rounded-full hover:border-emerald-400/60 hover:bg-emerald-400/5 transition-colors"
      >
        fund agent
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-[10px] uppercase tracking-widest text-white/30">
        send USDC to {vaultName}
      </div>
      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.usdc}
            onClick={() => sendUsdc(p.usdc)}
            disabled={busy}
            className="px-4 py-2 border border-white/20 text-white/70 text-xs rounded-full hover:border-emerald-400/50 hover:bg-emerald-400/5 transition-colors disabled:opacity-40"
          >
            {busy ? '…' : p.label}
          </button>
        ))}
      </div>
      {mode !== 'custom' ? (
        <button
          onClick={() => setMode('custom')}
          className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
        >
          custom amount
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="USDC"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-24 bg-white/5 border border-white/10 px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-400/50 rounded-full text-center"
            min={0.01}
            step={0.01}
          />
          <button
            onClick={() => sendUsdc(parseFloat(customAmount) || 0)}
            disabled={busy || !customAmount}
            className="px-4 py-2 bg-white text-black text-xs font-medium rounded-full disabled:opacity-30"
          >
            {busy ? '…' : 'send'}
          </button>
        </div>
      )}
      <button
        onClick={() => { setMode('idle'); setCustomAmount(''); }}
        className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
      >
        cancel
      </button>
    </div>
  );
}
