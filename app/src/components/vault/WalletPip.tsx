'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Minimal wallet indicator for the calm vault page.
 * - Not connected: faint dot + "connect" label
 * - Connected: dot + truncated pubkey + dropdown with copy + disconnect
 * Stays top-right, stays quiet. Breaks the "no chrome" rule just enough
 * to give the user feedback about whether their wallet is connected.
 */
export default function WalletPip() {
  const { authenticated, walletAddress, login, logout, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside);
      return () => document.removeEventListener('mousedown', onClickOutside);
    }
  }, [open]);

  if (!ready) {
    return (
      <div className="fixed top-4 right-4 z-40 text-[10px] text-white/20 font-mono">
        …
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <button
          onClick={login}
          className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/80 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          connect
        </button>
      </div>
    );
  }

  const display = `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`;

  return (
    <div className="fixed top-4 right-4 z-40" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-white/50 hover:text-white/90 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
        {display}
      </button>
      {open && (
        <div className="mt-2 w-48 border border-white/10 bg-[#0a0a0a] text-xs font-mono">
          <div className="px-3 py-2 text-white/40 break-all text-[10px]">{walletAddress}</div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(walletAddress);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch { /* ignore */ }
            }}
            className="block w-full text-left px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white border-t border-white/5"
          >
            {copied ? 'copied' : 'copy address'}
          </button>
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="block w-full text-left px-3 py-2 text-red-400/70 hover:bg-white/5 hover:text-red-400 border-t border-white/5"
          >
            disconnect
          </button>
        </div>
      )}
    </div>
  );
}
