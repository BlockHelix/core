'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Providers = dynamic(() => import('@/components/Providers'), { ssr: false });

const WALLET_PATH_PREFIXES = [
  '/dashboard',
  '/deploy',
  '/openclaw',
  '/agent',
  '/jobs',
];

function needsWallet(pathname: string): boolean {
  return WALLET_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const walletEnabled = useMemo(() => needsWallet(pathname), [pathname]);

  const content = (
    <>
      <Header showWallet={walletEnabled} />
      <div className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500">
        <a href="/openclaw" className="block py-2.5 px-4 text-center text-sm font-medium text-white hover:bg-orange-600/20 transition-colors">
          <span className="inline-flex items-center gap-2">
            <span className="font-bold">NEW:</span> Launch OpenClaw agents instantly
            <span className="hidden sm:inline">— no infrastructure needed</span>
            <span className="ml-1">→</span>
          </span>
        </a>
      </div>
      <div className="pt-24 min-h-screen">
        {children}
      </div>
      <Footer />
    </>
  );

  if (!walletEnabled) {
    return content;
  }

  return (
    <Providers>
      {content}
    </Providers>
  );
}
