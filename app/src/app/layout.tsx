import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
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
          <div className="pt-20">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
