import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import ClientShell from '@/components/ClientShell';
import { clerkAppearance } from '@/lib/clerk-appearance';
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

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const page = (
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

  // Keeps builds/marketing pages working when Clerk env vars are absent.
  if (!CLERK_ENABLED) {
    return page;
  }

  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      waitlistUrl="/waitlist"
    >
      {page}
    </ClerkProvider>
  );
}
