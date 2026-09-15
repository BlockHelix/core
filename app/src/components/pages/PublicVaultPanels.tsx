import VaultSnapshot from '@/components/vaults/VaultSnapshot';
import PegHealthCard from '@/components/vaults/PegHealthCard';
import TradeReconciliation from '@/components/vaults/TradeReconciliation';
import RateAttribution from '@/components/vaults/RateAttribution';
import PnlAttribution from '@/components/vaults/PnlAttribution';
import { publicRecordBasePath } from '@/lib/vault-data-source';
import { chainLabel, explorerAddress } from '@/lib/vault-types';
import type { PublishedVaultMeta } from '@/lib/server/public-fund';

/** One vault, rendered with the same panels the private dashboard runs. */
export default function PublicVaultPanels({ meta }: { meta: PublishedVaultMeta }) {
  const base = publicRecordBasePath(meta.symbol);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{meta.name}</h2>
        <a
          href={explorerAddress(meta.chainId, meta.vault)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-data text-[11px] text-[#10c689] hover:underline"
        >
          {meta.vault.slice(0, 10)}…{meta.vault.slice(-6)} ↗
        </a>
      </div>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-gray-400">
        {meta.symbol} · {meta.baseAsset ?? '—'} · {chainLabel(meta.chainId)} · {meta.daysLive ?? '—'} days · deposits closed
      </p>
      <div className="mt-8 space-y-8">
        <VaultSnapshot id={meta.symbol} basePath={base} />
        <PegHealthCard id={meta.symbol} chainId={meta.chainId} basePath={base} riskPath={`${base}/peg-health`} />
        <TradeReconciliation id={meta.symbol} chainId={meta.chainId} basePath={base} />
        <RateAttribution id={meta.symbol} basePath={base} />
        <PnlAttribution id={meta.symbol} basePath={base} />
      </div>
    </div>
  );
}
