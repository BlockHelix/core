import { DataAsOf } from '@/components/dashboard/Freshness';
import type { PublicVaultHeadline } from '@/lib/server/public-fund';

/**
 * What this vault is, in words and numbers, above the panels that show the working.
 *
 * The record page opened with four headings a reader has to already understand — "Trade
 * Reconciliation // predicted vs realized", "Share Price Attribution // per push" — and never
 * said what the vault is, whose money is in it, or whether it made any.
 *
 * Design rules it follows, in the order they matter:
 *
 *   ONE THING FIRST. Return since inception is the number a reader came for, so it is the only
 *   large figure. Three supporting numbers sit below it at a common weight. Everything else is
 *   a sentence. A row of equally-sized statistics makes a reader choose what matters, which is
 *   the page's job, not theirs.
 *
 *   NUMBERS ALIGN. Tabular figures throughout, so a column of them can be compared by eye
 *   rather than read one at a time.
 *
 *   ABSENCE IS VISIBLE. A figure that could not be measured renders as "not measured", never
 *   as a zero and never as a dash a reader might take for zero.
 *
 *   COLOUR MEANS ONE THING. Green and red mark direction on the return, and nothing else is
 *   coloured, so colour stays a signal instead of decoration.
 *
 * Server-rendered: the sentence is in the delivered HTML, so a crawler, a link preview or a
 * slow first paint sees the substance rather than a spinner.
 */

const GREEN = '#10c689';
const RED = '#b82214';

function money(n: number | null): string | null {
  if (n === null) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pct(n: number | null, digits = 1): string | null {
  if (n === null) return null;
  return `${(n * 100).toFixed(digits)}%`;
}

/** A measured value, or a plain statement that it is not measured. Never a bare dash. */
function Stat({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={
          value === null
            ? 'mt-1 text-sm text-gray-400'
            : 'mt-1 text-lg font-semibold tabular-nums text-gray-900'
        }
      >
        {value ?? 'not measured'}
      </dd>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

export default function VaultInPlainEnglish({ data }: { data: PublicVaultHeadline | null }) {
  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">
          The live record could not be read. Nothing is shown rather than a stale figure.
        </p>
      </div>
    );
  }

  // Share price starts at 1.0, so the return since inception is simply how far it has moved.
  const ret = data.sharePriceLive === null ? null : data.sharePriceLive - 1;
  const up = ret !== null && ret >= 0;
  const incomplete = data.navVsMarketVerdict === 'flag' || data.navVsMarketVerdict === 'block';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-baseline justify-between gap-4 border-b border-gray-100 px-6 py-3">
        <h2 className="text-sm font-semibold text-gray-900">In plain English</h2>
        <DataAsOf asOf={data.asOf} />
      </div>

      <div className="px-6 py-6">
        {/* The one number a reader came for. Nothing else is this size. */}
        <p className="text-[11px] uppercase tracking-wide text-gray-500">
          Return since launch{data.daysLive ? `, ${data.daysLive} days ago` : ''}
        </p>
        <p
          className="mt-1 text-4xl font-semibold tabular-nums tracking-tight"
          style={{ color: ret === null ? '#9ca3af' : up ? GREEN : RED }}
        >
          {ret === null ? 'not measured' : `${up ? '+' : ''}${(ret * 100).toFixed(2)}%`}
        </p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">
          After every cost we can measure: trading fees, price impact and interest paid. This is our own
          money. No one else&rsquo;s is in it.
        </p>

        <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-gray-100 pt-5 sm:grid-cols-3">
          <Stat label="Size" value={money(data.navUsd)} hint={data.baseAsset ? `held in ${data.baseAsset}` : undefined} />
          <Stat
            label="APY"
            value={pct(data.grossCarryApy)}
            hint="at today's rates"
          />
          <Stat
            label="Room before liquidation"
            value={data.worstBufferPp === null ? null : `${data.worstBufferPp.toFixed(1)}pp`}
            hint="thinnest position"
          />
        </dl>

        {incomplete ? (
          <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            Part of what this vault holds is worth less on the open market than the price used above. The
            panels below say which part, and by how much.
          </p>
        ) : null}
      </div>

      <p className="border-t border-gray-100 bg-gray-50/70 px-6 py-3 text-xs leading-relaxed text-gray-600">
        Everything below is the working: the trades, the prices we got, and where every dollar of profit and
        loss came from. It is published so the numbers above can be checked, not taken.
      </p>
    </div>
  );
}
