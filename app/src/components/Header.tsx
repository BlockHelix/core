'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import WalletButton from './WalletButton';
import { clsx } from 'clsx';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !searchOpen && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  }

  const navLinks = [
    { href: '/dashboard', label: 'DASHBOARD' },
    { href: '/deploy', label: 'CREATE' },
    { href: '/whitepaper', label: 'WHITEPAPER' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-3 group">
            <CubeIcon />
            <span className="text-xs uppercase tracking-wider-2 font-medium text-white group-hover:text-emerald-400 transition-colors duration-300">
              BlockHelix
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'text-xs uppercase tracking-wider-2 font-medium transition-colors duration-300',
                  pathname === link.href
                    ? 'text-emerald-400'
                    : 'text-white/60 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {searchOpen ? (
              <form onSubmit={handleSubmit} className="flex items-center">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search agents..."
                    className="w-48 bg-black/40 border border-white/20 pl-8 pr-8 py-1.5 text-white font-mono text-xs focus:border-emerald-400 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                title="Search agents (press /)"
              >
                <Search className="w-4 h-4" />
                <kbd className="hidden md:inline text-[10px] font-mono text-white/20 border border-white/10 px-1.5 py-0.5">/</kbd>
              </button>
            )}
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}

function CubeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cubeGradientSmall" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      <path
        d="M16 2L30 9V23L16 30L2 23V9L16 2Z M16 16L30 9M16 16L2 9M16 16V30"
        stroke="url(#cubeGradientSmall)"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 1"
      />
    </svg>
  );
}
