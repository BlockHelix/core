'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConsentManager from '@/components/consent/ConsentManager';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="pt-14 min-h-screen">
        {children}
      </div>
      <Footer />
      <ConsentManager />
    </>
  );
}
