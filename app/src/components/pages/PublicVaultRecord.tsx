import Link from 'next/link';
import VaultSnapshot from '@/components/vaults/VaultSnapshot';
import PegHealthCard from '@/components/vaults/PegHealthCard';
import TradeReconciliation from '@/components/vaults/TradeReconciliation';
import RateAttribution from '@/components/vaults/RateAttribution';
import PnlAttribution from '@/components/vaults/PnlAttribution';
import { publicRecordBasePath } from '@/lib/vault-data-source';
import { chainLabel, explorerAddress } from '@/lib/vault-types';
import type { PublishedVaultMeta } from '@/lib/server/public-fund';

/**
 * The vault dashboard, served to anyone.
 *
 * Same components the private dashboard runs, pointed at the public proxy instead of the
 * owner-scoped routes. Deposit and withdraw, the deployment log, the component registry and the
 * transaction list are absent by construction: this page never renders them, so there is no
 * state in which a reader reaches an action.
 */
export default function PublicVaultRecord({ meta }: { meta: PublishedVaultMeta }) {
  const base = publicRecordBasePath(meta.symbol);
  const riskPath = `${base}/peg-health`;

  return (
    <main className="bg-white">
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-28 lg:px-8">
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.17em] text-gray-400">
          <Link href="/agents" className="hover:text-gray-600">
            {'// The record'}
          </Link>
          <span className="text-gray-300"> / </span>
          {meta.symbol}
        </p>

        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">{meta.name}</h1>
          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">
            deposits closed
          </span>
        </div>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-gray-400">
          {meta.symbol} · {meta.baseAsset} · {chainLabel(meta.chainId)} · {meta.daysLive ?? '—'} days
        </p>
        <p className="mt-3 font-data text-xs">
          <a
            href={explorerAddress(meta.chainId, meta.vault)}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[#10c689] hover:underline"
          >
            {meta.vault} ↗
          </a>
        </p>

        <p className="mt-6 max-w-xl text-[13px] leading-relaxed text-gray-500">
          Our own capital, read live from chain. Deposits are closed and there is no fee, so this is
          a record of what this book did and not an offer or an invitation. Anything we cannot
          measure is named rather than scored, because a zero in an unmeasured row reads as healthy.
        </p>

        <div className="mt-14 space-y-8">
          <VaultSnapshot id={meta.symbol} basePath={base} />
          <PegHealthCard id={meta.symbol} chainId={meta.chainId} basePath={base} riskPath={riskPath} />
          <TradeReconciliation id={meta.symbol} chainId={meta.chainId} basePath={base} />
          <RateAttribution id={meta.symbol} basePath={base} />
          <PnlAttribution id={meta.symbol} basePath={base} />
        </div>

        <div className="mt-20 border-t border-black/[0.08] pt-8">
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400">
            <Link href="/agents" className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600">
              every vault
            </Link>
            {' · '}
            <Link href="/" className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600">
              blockhelix
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
