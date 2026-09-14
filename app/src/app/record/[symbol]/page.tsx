import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicVaultRecord from '@/components/pages/PublicVaultRecord';
import { fetchPublishedVault, fetchPublishedVaults } from '@/lib/server/public-fund';

export const revalidate = 300;

export async function generateStaticParams() {
  return (await fetchPublishedVaults()).map((v) => ({ symbol: v.symbol }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const found = await fetchPublishedVault(symbol);
  if (found.state !== 'ok') return { title: 'The record | BlockHelix' };
  return {
    title: `${found.meta.name} (${found.meta.symbol}) | BlockHelix`,
    description:
      `Live from chain: NAV, share price, per-book leverage and liquidation buffer, trade ` +
      `reconciliation and the full P&L decomposition for ${found.meta.name}. Own capital, deposits closed.`,
  };
}

export default async function RecordPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const found = await fetchPublishedVault(symbol);

  if (found.state === 'not-published') notFound();

  if (found.state === 'unavailable') {
    return (
      <main className="bg-white">
        <section className="mx-auto max-w-4xl px-6 pb-24 pt-28 lg:px-8">
          <p className="font-mono text-sm text-gray-400">
            The live record could not be read just now. Nothing is shown rather than a stale figure.
          </p>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-gray-400">
            <Link href="/agents" className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600">
              every vault
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return <PublicVaultRecord meta={found.meta} />;
}
