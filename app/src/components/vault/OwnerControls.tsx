'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWallets } from '@privy-io/react-auth/solana';
import { getVaultAccess, claimVault, setHolderKey, type VaultAccess } from '@/lib/runtime';
import { toast, toastTx } from '@/lib/toast';

interface Props {
  agentId: string;
  onOwnershipChanged?: () => void;
}

type Panel = 'none' | 'claim' | 'add-key';

export default function OwnerControls({ agentId, onOwnershipChanged }: Props) {
  const { authenticated, login } = useAuth();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [access, setAccess] = useState<VaultAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<Panel>('none');
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Refresh access whenever the connected wallet changes
  useEffect(() => {
    let cancelled = false;
    async function check() {
      setLoading(true);
      try {
        const a = await getVaultAccess(agentId, wallet?.address);
        if (!cancelled) setAccess(a);
      } catch {
        if (!cancelled) setAccess(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [agentId, wallet?.address]);

  const handleClaim = async () => {
    if (!wallet) {
      await login();
      return;
    }
    setBusy(true);
    try {
      const result = await claimVault(agentId, wallet.address, wallet.signMessage.bind(wallet));
      toastTx('vault claimed — NFT minted', result.txSignature);
      // refresh access
      const a = await getVaultAccess(agentId, wallet.address);
      setAccess(a);
      setPanel('none');
      onOwnershipChanged?.();
    } catch (err: any) {
      toast(err?.message || 'claim failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSetKey = async () => {
    if (!wallet || !keyInput.startsWith('sk-ant-')) {
      toast('need a valid Anthropic key', 'error');
      return;
    }
    setBusy(true);
    try {
      await setHolderKey(agentId, wallet.address, keyInput, wallet.signMessage.bind(wallet));
      toast('key saved — unlimited chat unlocked', 'success');
      const a = await getVaultAccess(agentId, wallet.address);
      setAccess(a);
      setPanel('none');
      setKeyInput('');
    } catch (err: any) {
      toast(err?.message || 'save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Not connected — WalletPip in the corner handles the connect prompt.
  // Nothing to render here unless they're the owner.
  if (!authenticated || !wallet) {
    return null;
  }

  if (loading || !access) {
    return null;
  }

  // Not the owner. If there's an expected claimer for an unminted vault
  // (i.e. we know who SHOULD be able to claim), surface that so the user
  // can connect the right wallet. Otherwise hide.
  if (access.tier !== 'owner') {
    if (access.expectedClaimer && !access.mint) {
      const short = `${access.expectedClaimer.slice(0, 4)}…${access.expectedClaimer.slice(-4)}`;
      return (
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="text-[10px] uppercase tracking-widest text-white/30">
            this vault was deployed by {short}
          </div>
          <div className="text-[10px] text-white/20">
            connect that wallet to claim ownership
          </div>
        </div>
      );
    }
    return null;
  }

  // Owner but vault has no NFT yet → offer claim
  if (!access.mint) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="text-[10px] uppercase tracking-widest text-emerald-300/60">
          this is yours
        </div>
        <button
          onClick={handleClaim}
          disabled={busy}
          className="px-6 py-3 border border-emerald-400/40 bg-emerald-400/5 text-emerald-200 text-sm hover:bg-emerald-400/10 hover:border-emerald-400/70 transition-colors disabled:opacity-40 rounded-full"
        >
          {busy ? 'minting…' : 'claim ownership (mint NFT)'}
        </button>
      </div>
    );
  }

  // Owner, NFT minted, but no API key yet → offer to add one
  if (access.needsKey) {
    if (panel !== 'add-key') {
      return (
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="text-[10px] uppercase tracking-widest text-white/30">
            owned by you
          </div>
          <button
            onClick={() => setPanel('add-key')}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            add your Anthropic key for unlimited chat
          </button>
        </div>
      );
    }
    return (
      <div className="mt-8 w-full max-w-md flex flex-col items-center gap-3">
        <div className="text-[10px] uppercase tracking-widest text-white/30">
          your key stays encrypted
        </div>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-400/60 rounded-none"
        />
        <div className="flex gap-3">
          <button
            onClick={handleSetKey}
            disabled={busy}
            className="px-4 py-2 bg-white text-black text-xs font-medium hover:bg-white/90 disabled:opacity-40 rounded-full"
          >
            {busy ? 'saving…' : 'save key'}
          </button>
          <button
            onClick={() => { setPanel('none'); setKeyInput(''); }}
            className="px-4 py-2 text-xs text-white/50 hover:text-white transition-colors"
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  // Owner, NFT minted, key set → everything's good
  return (
    <div className="mt-8 text-[10px] uppercase tracking-widest text-white/30">
      owned by you
    </div>
  );
}
