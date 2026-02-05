'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletButton from './WalletButton';
import { clsx } from 'clsx';

export default function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/jobs', label: 'HIRE' },
    { href: '/dashboard', label: 'DASHBOARD' },
    { href: '/create', label: 'DEPLOY' },
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

          <div className="flex items-center gap-4">
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
