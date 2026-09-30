'use client';

import useSWR from 'swr';
import { DataAsOf } from '@/components/dashboard/Freshness';

/**
 * What this vault is, in words, above the panels that explain how.
 *
 * The record page opened with four headings a reader has to already understand — "Trade
 * Reconciliation // predicted vs realized", "Share Price Attribution // per push" — and never
 * said what the vault is, whose money is in it, or whether it made any. Somebody who did not
 * build it learns nothing from the first screen.
 *
 * Every figure here is read from the same endpoints the panels below use, so this is a plainer
 * reading of the same record, not a second one. Anything unmeasured says so; nothing is rounded
 * into a claim.
 */

interface Summary {
  navUsd: number | null;
  sharePrice: number | null;
  returnToDate: number | null;
  operatingApy: number | null;
  daysLive: number | null;
  navIsLive?: boolean;
  asOf?: string;
}

const fetcher = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? null : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? null : `${(n * 100).toFixed(digits)}%`;

export default function VaultInPlainEnglish({
  id,
  basePath,
  initial,
}: {
  id: string;
  basePath: string;
  /** Server-rendered figures, so the sentence is in the HTML before any JavaScript runs. */
  initial?: Summary | null;
}) {
  const { data, error, isLoading } = useSWR<Summary>(`${basePath}/vaults/${encodeURIComponent(id)}/nav`, fetcher, {
    refreshInterval: 300_000,
    // Renders immediately from the server's read, then refreshes in place.
    fallbackData: initial ?? undefined,
  });

  if (isLoading && !initial) return <p className="font-data text-sm text-gray-400">Reading the record…</p>;
  // A figure that could not be read is left out entirely. A dash is honest; a zero is not.
  if (error || !data) {
    return (
      <p className="font-data text-sm text-gray-500">
        The live record could not be read. Nothing is shown rather than a stale figure.
      </p>
    );
  }

  const nav = money(data.navUsd);
  const ret = pct(data.returnToDate);
  const apy = pct(data.operatingApy);
  const days = data.daysLive;
  const incomplete = data.navIsLive === false;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-900">In plain English</h2>
        <DataAsOf asOf={data.asOf} />
      </div>

      <div className="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">
        <p>
          {nav ? <>This vault holds <strong>{nav}</strong> of our own money</> : <>The size of this vault could not be read</>}
          {days ? <>, and has been running for <strong>{days} days</strong></> : null}. No one else&rsquo;s money is in it.
        </p>

        {ret ? (
          <p>
            Since it started it is <strong>{ret}</strong> up or down in total, after every cost we can measure —
            trading fees, price impact and interest paid.
          </p>
        ) : (
          <p>How much it has made since it started is not measured yet.</p>
        )}

        {apy ? (
          <p>
            At today&rsquo;s rates it earns about <strong>{apy} a year</strong>. That rate moves with the market and is
            not a promise.
          </p>
        ) : (
          <p>What it earns at today&rsquo;s rates could not be measured.</p>
        )}

        {incomplete ? (
          <p className="font-medium text-amber-700">
            Part of what this vault holds could not be priced just now, so the figures above are incomplete. The
            panels below say which part.
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Everything below is the working: the trades, the prices we got, and where every dollar of profit and loss
        came from. It is published so the numbers above can be checked, not taken.
      </p>
    </div>
  );
}
