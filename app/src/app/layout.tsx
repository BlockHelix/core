import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import ClientShell from '@/components/ClientShell';
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
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-V3XFQ98GWK" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-V3XFQ98GWK');
          `}
        </Script>
      </head>
      <body className="font-sans antialiased bg-[#0a0a0a] text-white">
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}
