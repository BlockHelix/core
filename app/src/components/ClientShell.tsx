'use client';

import { useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { initPosthog } from '@/lib/posthog';

const Providers = dynamic(() => import('@/components/Providers'), { ssr: false });

const WALLET_PATH_PREFIXES = [
  '/dashboard',
  '/deploy',
  '/agent',
  '/jobs',
  '/v',
];

function needsWallet(pathname: string): boolean {
  return WALLET_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const walletEnabled = useMemo(() => needsWallet(pathname), [pathname]);

  useEffect(() => { initPosthog(); }, []);

  const content = (
    <>
      <Header showWallet={walletEnabled} />
      <div className="pt-14 min-h-screen">
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
