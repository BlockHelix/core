'use client';

import { clsx } from 'clsx';
import { CopyButton } from '@/components/ui/CopyButton';
import { timeAgo, truncateAddress } from '@/lib/format';
import { BASESCAN_URL } from '@/lib/vault-types';
import type { NormalizedTx } from '@/lib/onchain-types';

// Etherscan-style activity table, shared by the admin vault console and the
// customer vault detail page. Server routes supply already-normalised rows.
export default function TxTable({
  txs,
  loading,
  error,
}: {
  txs?: NormalizedTx[];
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return <div className="h-40 skeleton rounded-xl" />;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-white p-8 text-center text-sm text-zinc-500 shadow-soft">
        {error}
      </div>
    );
  }
  if (!txs || txs.length === 0) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-white p-8 text-center text-sm text-zinc-500 shadow-soft">
        No transactions.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/[0.06] bg-white shadow-soft">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-black/[0.06] bg-[#f7f7f8]">
            {['Txn Hash', 'Method', 'Age', 'From → To', 'Value', 'Status'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-[11px] font-normal uppercase tracking-wider-2 text-zinc-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txs.map((t, i) => (
            <Row key={`${t.hash}-${t.kind}-${i}`} t={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ t }: { t: NormalizedTx }) {
  return (
    <tr className="border-b border-black/[0.05] last:border-b-0 align-middle">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={`${BASESCAN_URL}/tx/${t.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-data text-xs text-[#10c689] hover:text-[#10c689]"
            title={t.hash}
          >
            {truncateAddress(t.hash, 8)}
          </a>
          <CopyButton value={t.hash} label="" />
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-block max-w-[160px] truncate rounded-md border border-black/[0.08] bg-[#f7f7f8] px-2 py-0.5 font-data text-[11px] text-zinc-600"
          title={t.method}
        >
          {t.method}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
        {t.timeStamp ? timeAgo(new Date(t.timeStamp * 1000)) : '—'}
      </td>
      <td className="px-4 py-3">
        {!t.from && !t.to ? (
          <span className="text-zinc-300">—</span>
        ) : (
          <div className="flex items-center gap-1.5 font-data text-xs text-zinc-500">
            <Addr address={t.from} />
            <span aria-hidden className="text-zinc-300">→</span>
            <Addr address={t.to} />
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-700">
        {!t.value || t.value === '0' || t.value === '—' ? (
          <span className="text-zinc-400">{t.value || '—'}</span>
        ) : (
          <>
            <span className="font-data">{t.value}</span>{' '}
            <span className="text-zinc-400">{t.valueSymbol}</span>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={clsx(
            'inline-flex items-center gap-1 text-xs',
            t.isError ? 'text-[#b82214]' : 'text-[#10c689]',
          )}
          title={t.isError ? 'Failed' : 'Success'}
        >
          <span aria-hidden>{t.isError ? '✕' : '✓'}</span>
        </span>
      </td>
    </tr>
  );
}

function Addr({ address }: { address: string }) {
  if (!address) return <span className="text-zinc-300">—</span>;
  return (
    <a
      href={`${BASESCAN_URL}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-[#10c689]"
      title={address}
    >
      {truncateAddress(address, 4)}
    </a>
  );
}
