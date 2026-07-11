'use client';

import { useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { initPosthog } from '@/lib/posthog';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  useEffect(() => { initPosthog(); }, []);

  return (
    <>
      <Header />
      <div className="pt-14 min-h-screen">
        {children}
      </div>
      <Footer />
    </>
  );
}
