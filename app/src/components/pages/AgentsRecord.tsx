import PublicVaultPanels from '@/components/pages/PublicVaultPanels';
import { fetchPublishedVaults } from '@/lib/server/public-fund';

/** Every vault we run, as the dashboard shows them. */
export default async function AgentsRecord() {
  const vaults = await fetchPublishedVaults();

  return (
    <main className="bg-white">
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-28 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.17em] text-gray-400">
          {'// The record'}
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Every vault we run
        </h1>
        <p className="mt-3 font-data text-xs text-gray-500">Own capital, read live from chain.</p>

        {vaults.length === 0 ? (
          <p className="mt-16 font-mono text-sm text-gray-400">
            The live record could not be read just now. Nothing is shown rather than a stale figure.
          </p>
        ) : (
          <div className="mt-16 space-y-24">
            {vaults.map((v) => (
              <PublicVaultPanels key={v.symbol} meta={v} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
