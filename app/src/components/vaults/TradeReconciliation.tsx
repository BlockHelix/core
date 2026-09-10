'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { clsx } from 'clsx';
import { fetcher, FetchError } from '@/lib/swr-fetcher';
import { timeAgo, truncateAddress } from '@/lib/format';
import { explorerTx } from '@/lib/vault-types';
import { LastUpdated, RefreshButton, useFreshness } from '@/components/dashboard/Freshness';
import type {
  ReconciledTrade,
  ReconciliationRollup,
  ReconciliationState,
  ReconciliationSummary,
  TradeReconciliationResponse,
} from '@/lib/server/trade-reconciliation';

const GREEN = 'text-[#10c689]';
const RED = 'text-[#b82214]';

/** Null is unmeasured. It renders as a dash, never as a zero, because a zero here would read as
 *  "the trade came in exactly as promised" on a trade nobody could check. */
function fmtBps(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (Math.round(a * 10) === 0) return '0';
  const s = a >= 10 ? String(Math.round(a)) : a.toFixed(1).replace(/\.0$/, '');
  return (v > 0 ? '+' : '-') + s;
}

function tone(v: number | null): string {
  if (v === null) return 'text-zinc-300';
  if (Math.round(v * 10) === 0) return 'text-zinc-500';
  return v > 0 ? GREEN : RED;
}

const STATE_LABEL: Record<ReconciliationState, string> = {
  ok: 'matched',
  flag: 'worse than promised',
  block: 'broke its prediction',
  unreconcilable: 'not measurable',
  'not-checked': 'never checked',
};

// Only `ok` is green. The two unmeasured states are amber and grey on purpose: a check that could
// not run must never look like a check that passed.
const STATE_CHIP: Record<ReconciliationState, string> = {
  ok: 'border-[#10c689]/25 bg-[#eafaf3] text-[#10c689]',
  flag: 'border-amber-300 bg-amber-50 text-amber-900',
  block: 'border-[#b82214]/30 bg-[#fdeeeb] text-[#9a1c10]',
  unreconcilable: 'border-amber-300 bg-amber-50 text-amber-900',
  'not-checked': 'border-black/[0.10] bg-[#f7f7f8] text-zinc-500',
};

const GAP_LABEL: Record<string, string> = {
  'no-prediction': 'stated no prediction',
  'no-basis': 'no denominator to restate the prediction onto NAV',
  'no-outcome': 'share price unreadable on one side',
  'not-recorded': 'no verdict recorded',
  unreadable: 'verdict could not be read',
};

function StateChip({ state }: { state: ReconciliationState }) {
  return (
    <span
      className={clsx(
        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        STATE_CHIP[state],
      )}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

/** The headline. `unproven` is the honest reading of a book where nothing could be measured, and
 *  it is deliberately not green: zero blocks out of zero checks is not a clean record. */
function Verdict({ r }: { r: ReconciliationRollup }) {
  if (r.state === 'block') {
    return (
      <div className="rounded-lg border border-[#b82214]/30 border-l-4 border-l-[#b82214] bg-[#fdeeeb] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider-2 text-[#9a1c10]">
          Trade broke its own prediction
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#9a1c10]">
          {r.block} trade{r.block === 1 ? '' : 's'} came in past the block bound. Worst miss{' '}
          <span className="font-data font-semibold tabular-nums">{fmtBps(r.worstDivergenceBps)} bps</span> of NAV.
          The model that priced {r.block === 1 ? 'it' : 'them'} should not price another trade until this is understood.
        </p>
      </div>
    );
  }
  if (r.state === 'flag') {
    return (
      <div className="rounded-lg border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider-2 text-amber-900">
          Worse than promised
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-amber-900">
          {r.flag} trade{r.flag === 1 ? '' : 's'} missed past the flag bound. Worst{' '}
          <span className="font-data font-semibold tabular-nums">{fmtBps(r.worstDivergenceBps)} bps</span> of NAV.
        </p>
      </div>
    );
  }
  if (r.state === 'unproven') {
    return (
      <div className="rounded-lg border border-amber-300 border-l-4 border-l-amber-400 bg-amber-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider-2 text-amber-900">Nothing measured</p>
        <p className="mt-1.5 text-xs leading-relaxed text-amber-900">
          None of the {r.trades} confirmed trade{r.trades === 1 ? '' : 's'} on this book could be checked against a
          prediction. This is not a clean record, it is an absent one.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[#10c689]/25 border-l-4 border-l-[#10c689] bg-[#eafaf3] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider-2 text-[#10c689]">Predictions held</p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
        {r.checked} of {r.trades} confirmed trade{r.trades === 1 ? '' : 's'} measured, none past the flag bound.
        {r.unreconcilable + r.notChecked > 0 && (
          <> The other {r.unreconcilable + r.notChecked} could not be checked and are not counted as passes.</>
        )}
      </p>
    </div>
  );
}

function Count({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">{label}</div>
      <div className={clsx('mt-1 font-data text-sm font-medium tabular-nums', className ?? 'text-zinc-800')}>
        {value}
      </div>
    </div>
  );
}

function Row({ t, chainId }: { t: ReconciledTrade; chainId: number }) {
  const r: ReconciliationSummary = t.reconciliation;
  const [open, setOpen] = useState(false);
  const detail = r.reason ?? (r.gap ? GAP_LABEL[r.gap] : null);

  return (
    <div className={clsx('py-2.5', r.state === 'block' && '-mx-2 rounded-md bg-[#fdeeeb] px-2')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="min-w-[6.5rem] font-data text-[11px] text-zinc-400" title={new Date(t.createdAt).toLocaleString()}>
          {t.createdAt ? timeAgo(t.createdAt) : '—'}
        </span>
        <span
          className="max-w-[140px] shrink-0 truncate rounded-md border border-black/[0.08] bg-[#f7f7f8] px-2 py-0.5 font-data text-[11px] text-zinc-600"
          title={t.kind}
        >
          {t.kind}
        </span>

        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">said</span>
          <span className={clsx('w-12 text-right font-data text-[13px] tabular-nums', tone(r.predictedBps))}>
            {fmtBps(r.predictedBps)}
          </span>
        </span>
        <span aria-hidden className="text-zinc-300">→</span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">got</span>
          <span className={clsx('w-12 text-right font-data text-[13px] tabular-nums', tone(r.realizedBps))}>
            {fmtBps(r.realizedBps)}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">diff</span>
          <span
            className={clsx(
              'w-14 text-right font-data text-[13px] font-semibold tabular-nums',
              tone(r.divergenceBps),
            )}
          >
            {fmtBps(r.divergenceBps)}
          </span>
        </span>

        <span className="ml-auto flex items-center gap-2">
          {t.txHash && (
            <a
              href={explorerTx(chainId, t.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-data text-[11px] text-[#10c689]"
              title={t.txHash}
            >
              {truncateAddress(t.txHash, 4)}
            </a>
          )}
          <StateChip state={r.state} />
        </span>
      </div>

      {detail && (
        <div className="mt-1 flex items-start gap-2 pl-[7rem]">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-700"
          >
            {open ? 'less' : 'why'}
          </button>
          {open && (
            <p className="text-[11px] leading-relaxed text-zinc-500">
              {detail}
              {r.source && (
                <>
                  {' '}The claim came from{' '}
                  <span className="font-data text-zinc-700">{r.source}</span>
                  {r.basis && <> stated in bps of {r.basis}</>}.
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const corner = 'pointer-events-none absolute h-2.5 w-2.5 border-black/[0.15]';
  return (
    <div className="relative mt-4 rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <span aria-hidden className={`${corner} left-2 top-2 border-l border-t`} />
      <span aria-hidden className={`${corner} right-2 top-2 border-r border-t`} />
      <span aria-hidden className={`${corner} bottom-2 left-2 border-b border-l`} />
      <span aria-hidden className={`${corner} bottom-2 right-2 border-b border-r`} />
      {children}
    </div>
  );
}

// What each trade promised before it broadcast against what the share price actually did. The
// worker has recorded this comparison on every confirmed trade for a while and it reached a log
// line and an alert topic and no screen. This is the screen.
export default function TradeReconciliation({ id, chainId }: { id: string; chainId: number }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<TradeReconciliationResponse>(
    `/api/vaults/${encodeURIComponent(id)}/trade-reconciliation`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000, refreshInterval: 60_000 },
  );
  const updatedAt = useFreshness(isValidating, !!data);
  const notFound = error instanceof FetchError && error.status === 404;
  const [showAll, setShowAll] = useState(false);

  const rows = data?.trades ?? [];
  const visible = showAll ? rows : rows.slice(0, 8);
  const rollup = data?.rollup ?? null;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
          Trade Reconciliation
          <span className="ml-2 text-zinc-300">{'// predicted vs realized'}</span>
        </h2>
        <span className="flex items-center gap-1">
          <LastUpdated since={updatedAt} />
          <RefreshButton onClick={() => void mutate()} spinning={isValidating} />
        </span>
      </div>

      {error && !notFound ? (
        <Card>
          <p className="text-sm text-zinc-500">
            {(error as { message?: string })?.message ?? 'Could not load reconciliation.'} This refreshes
            automatically.
          </p>
        </Card>
      ) : isLoading && !data ? (
        <Card>
          <p className="text-sm text-zinc-500">Reading trade verdicts…</p>
        </Card>
      ) : notFound || rows.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No trades recorded yet.</p>
        </Card>
      ) : (
        <Card>
          {rollup ? (
            <Verdict r={rollup} />
          ) : (
            <div className="rounded-lg border border-black/[0.08] bg-[#f7f7f8] p-4">
              <p className="text-xs text-zinc-500">
                No confirmed trade on this book yet, so there is nothing to check.
              </p>
            </div>
          )}

          {rollup && (
            <div className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-5">
              <Count label="matched" value={rollup.ok} className={rollup.ok > 0 ? GREEN : 'text-zinc-300'} />
              <Count label="flagged" value={rollup.flag} className={rollup.flag > 0 ? 'text-amber-700' : 'text-zinc-300'} />
              <Count label="blocked" value={rollup.block} className={rollup.block > 0 ? RED : 'text-zinc-300'} />
              <Count
                label="unmeasurable"
                value={rollup.unreconcilable}
                className={rollup.unreconcilable > 0 ? 'text-amber-700' : 'text-zinc-300'}
              />
              <Count
                label="unchecked"
                value={rollup.notChecked}
                className={rollup.notChecked > 0 ? 'text-amber-700' : 'text-zinc-300'}
              />
            </div>
          )}

          <div className="mt-4 divide-y divide-black/[0.05] border-t border-black/[0.05]">
            {visible.map((t) => (
              <Row key={t.id} t={t} chainId={chainId} />
            ))}
          </div>

          {rows.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
            >
              {showAll ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
            Said is what the trade committed to before it broadcast, restated as bps of NAV. Got is what the share
            price actually did over the same event. Diff is got minus said, so negative is worse than promised. A
            dash means the number was never measured; it is not a zero. Not measurable and never checked are holes
            in the check, not passes.
          </p>
        </Card>
      )}
    </div>
  );
}
