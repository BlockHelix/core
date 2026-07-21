import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import ClientShell from '@/components/ClientShell';
import { clerkAppearance } from '@/lib/clerk-appearance';
import { CONSENT_REQUIRED_REGIONS } from '@/lib/consent';
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
  metadataBase: new URL('https://blockhelix.tech'),
  title: 'BlockHelix: Execution policy for onchain vaults',
  description:
    'Execution policy as infrastructure for onchain vaults. Every trade is checked before it runs and re-verified by the vault on-chain, with an audit trail your depositors can read.',
  applicationName: 'BlockHelix',
  keywords: [
    'onchain vaults',
    'DeFi execution policy',
    'trade policy enforcement',
    'slippage protection',
    'ERC-4626',
    'BoringVault',
    'vault infrastructure',
  ],
  authors: [{ name: 'DeFi Data Ltd' }],
  openGraph: {
    type: 'website',
    url: 'https://blockhelix.tech',
    siteName: 'BlockHelix',
    title: 'BlockHelix: Execution policy for onchain vaults',
    description:
      'Every trade is checked before it runs and re-verified by the vault on-chain, with an audit trail your depositors can read.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@BlockHelix',
    creator: '@BlockHelix',
    title: 'BlockHelix: Execution policy for onchain vaults',
    description: 'Execution policy as infrastructure for onchain vaults.',
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BlockHelix',
  legalName: 'DeFi Data Ltd',
  url: 'https://blockhelix.tech',
  logo: 'https://blockhelix.tech/favicon.ico',
  description: 'Execution policy as infrastructure for onchain vaults.',
  sameAs: ['https://github.com/BlockHelix', 'https://x.com/BlockHelix'],
  address: {
    '@type': 'PostalAddress',
    streetAddress: '66 Paul Street',
    addressLocality: 'London',
    addressRegion: 'England',
    postalCode: 'EC2A 4NA',
    addressCountry: 'GB',
  },
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
        <Script id="consent-mode" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
            gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${JSON.stringify(CONSENT_REQUIRED_REGIONS)},wait_for_update:500});
            gtag('js', new Date());
            gtag('config','G-V3XFQ98GWK');
          `}
        </Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-V3XFQ98GWK" strategy="afterInteractive" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="font-sans antialiased bg-white text-gray-900">
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
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {page}
    </ClerkProvider>
  );
}
