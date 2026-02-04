import type { Metadata } from 'next';
import { JetBrains_Mono, Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BlockHelix | Tokenized Agent Platform',
  description:
    'Launch tokenized autonomous agents. Investors deposit USDC, receive shares, and earn revenue from agent work on Solana.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${inter.variable}`}>
      <body className="font-sans antialiased bg-helix-bg text-helix-primary">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
