'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Copy, ExternalLink, LogOut } from 'lucide-react';

export default function WalletButton() {
  const { login, logout, authenticated, walletAddress } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (authenticated && walletAddress) {
    const display = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="px-5 py-3 text-xs uppercase tracking-wider-2 font-medium text-white/70 border border-white/20 hover:border-emerald-400 hover:text-white transition-all duration-300"
        >
          <span className="font-mono tabular-nums">{display}</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] border border-white/20 shadow-xl z-50">
            <button
              onClick={copyAddress}
              className="w-full px-4 py-3 text-left text-xs font-mono text-white/70 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            <a
              href={`https://explorer.solana.com/address/${walletAddress}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-3 text-left text-xs font-mono text-white/70 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Explorer
            </a>
            <div className="border-t border-white/10" />
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="w-full px-4 py-3 text-left text-xs font-mono text-red-400/70 hover:bg-white/5 hover:text-red-400 flex items-center gap-3 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-5 py-3 text-xs uppercase tracking-wider-2 font-medium bg-white text-black hover:bg-emerald-400 transition-colors duration-300"
    >
      CONNECT
    </button>
  );
}
