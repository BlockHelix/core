'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletButton from './WalletButton';
import { clsx } from 'clsx';

export default function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Directory' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/create', label: 'Create Agent' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-helix-bg/80 backdrop-blur-md border-b border-helix-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <CubeIcon />
            <span className="font-display text-xl font-bold text-helix-accent group-hover:text-helix-accent/80 transition-colors">
              BlockHelix
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'text-sm font-medium transition-colors hover:text-helix-accent',
                  pathname === link.href
                    ? 'text-helix-accent'
                    : 'text-helix-secondary'
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
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform group-hover:rotate-12"
    >
      <defs>
        <linearGradient id="cubeGradientSmall" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4EC9B0" />
          <stop offset="100%" stopColor="#C586C0" />
        </linearGradient>
      </defs>

      <path
        d="M16 2L30 9V23L16 30L2 23V9L16 2Z"
        fill="url(#cubeGradientSmall)"
        fillOpacity="0"
      />

      <path
        d="M16 2L30 9L16 16L2 9L16 2Z"
        fill="url(#cubeGradientSmall)"
        fillOpacity="0.0"
      />

      <path
        d="M16 16V30L2 23V9L16 16Z"
        fill="url(#cubeGradientSmall)"
        fillOpacity="0.0"
      />

      <path
        d="M16 16V30L30 23V9L16 16Z"
        fill="url(#cubeGradientSmall)"
        fillOpacity="0.0"
      />

      <path
        d="M16 2L30 9V23L16 30L2 23V9L16 2Z M16 16L30 9M16 16L2 9M16 16V30"
        stroke="url(#cubeGradientSmall)"
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 1"
      />
    </svg>
  );
}
