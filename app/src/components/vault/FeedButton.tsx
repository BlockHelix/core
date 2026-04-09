'use client';

import { useState } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { useAuth } from '@/hooks/useAuth';
import { useWallets } from '@privy-io/react-auth/solana';
import { RPC_URL } from '@/lib/anchor';
import { toast, toastTx } from '@/lib/toast';
import { posthog } from '@/lib/posthog';

interface Props {
  vaultId: string;
  agentWallet: string;
  vaultName: string;
  amountSol?: number;
  variant?: 'primary' | 'subtle';
  onFed?: () => void;
}

export default function FeedButton({
  vaultId,
  agentWallet,
  vaultName,
  amountSol = 0.05,
  variant = 'primary',
  onFed,
}: Props) {
  const { authenticated, login } = useAuth();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [busy, setBusy] = useState(false);

  const handleFeed = async () => {
    if (!authenticated || !wallet) {
      posthog?.capture('feed_login_required', { vaultId });
      await login();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const payer = new PublicKey(wallet.address);
      const recipient = new PublicKey(agentWallet);

      const tx = new Transaction();
      tx.add(SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: recipient,
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
      }));
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = payer;

      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const signed = await wallet.signTransaction({ transaction: serialized as any });
      const sig = await connection.sendRawTransaction(signed as unknown as Uint8Array, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(sig, 'confirmed');

      posthog?.capture('vault_fed', { vaultId, amountSol, sig });
      toastTx(`Fed ${vaultName} ${amountSol} SOL`, sig);
      onFed?.();
    } catch (err: any) {
      console.error('feed error', err);
      const raw = err?.message || 'Feed failed';
      let friendly = raw;
      if (/no record of a prior credit|insufficient/i.test(raw)) {
        friendly = `Your wallet needs SOL too. Get some from faucet.solana.com first.`;
      } else if (/User rejected|denied|declined/i.test(raw)) {
        friendly = 'Feeding cancelled.';
      }
      toast(friendly, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'subtle') {
    return (
      <button
        onClick={handleFeed}
        disabled={busy}
        className="text-xs text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
      >
        {busy ? 'feeding…' : `feed ${amountSol} SOL`}
      </button>
    );
  }

  return (
    <button
      onClick={handleFeed}
      disabled={busy}
      className="px-8 py-3.5 bg-white text-black font-medium text-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed rounded-full"
    >
      {busy
        ? 'feeding…'
        : authenticated
          ? `feed ${vaultName.toLowerCase()} (${amountSol} SOL)`
          : `connect wallet to feed`}
    </button>
  );
}
