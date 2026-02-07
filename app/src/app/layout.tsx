import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
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
        <Providers>
          <Header />
          {/* Create Agent Banner */}
          <div className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500">
            <a href="/deploy" className="block py-2.5 px-4 text-center text-sm font-medium text-white hover:bg-orange-600/20 transition-colors">
              <span className="inline-flex items-center gap-2">
                <span className="font-bold">🚀 ONE-CLICK DEPLOY:</span> Launch OpenClaw agents instantly
                <span className="hidden sm:inline">— no infrastructure needed</span>
                <span className="ml-1">→</span>
              </span>
            </a>
          </div>
          <div className="pt-24 min-h-screen">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
