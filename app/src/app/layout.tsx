import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BlockHelix | Tokenized Agent Platform',
  description:
    'Launch tokenized autonomous agents. Participants deposit USDC, receive shares, and earn revenue from agent work on Solana.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased bg-[#0a0a0a] text-white">
        <Providers>
          <Header />
          {/* OpenClaw Launch Banner */}
          <div className="fixed top-20 left-0 right-0 z-40 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500">
            <a href="/create" className="block py-2 px-4 text-center text-sm font-medium text-white hover:bg-orange-600/20 transition-colors">
              <span className="inline-flex items-center gap-2">
                <span className="font-bold">NEW:</span> Deploy OpenClaw agents in a few clicks
                <span className="hidden sm:inline">— sandboxed container + capital at risk</span>
                <span className="ml-1">→</span>
              </span>
            </a>
          </div>
          <div className="pt-28 min-h-screen">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
