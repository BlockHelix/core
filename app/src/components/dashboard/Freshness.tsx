'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

// Stamps the moment each SWR revalidation lands, for <LastUpdated since={…} />.
// Keyed on the isValidating true->false edge rather than on `data`: SWR preserves the
// previous object reference when a refetch returns deep-equal data, so watching `data`
// would leave the counter climbing even though we just refreshed successfully.
//
// This measures when WE FETCHED, which is not when the data was true. On a statically
// revalidated page those are different by however long the cached HTML has been served, and
// on 2026-09-30 the public record said "Updated just now" beside vault ages that were 12 days
// out of date. Every payload carries its own `asOf`; prefer <DataAsOf> below, which reads it.
export function useFreshness(isValidating: boolean, hasData: boolean): number {
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const wasValidating = useRef(isValidating);
  useEffect(() => {
    if (wasValidating.current && !isValidating && hasData) setUpdatedAt(Date.now());
    wasValidating.current = isValidating;
  }, [isValidating, hasData]);
  return updatedAt;
}

function ago(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  // A 12-day-old page used to read "288h ago", which scans as a big number rather than as
  // twelve days. Say the unit a reader actually thinks in.
  const days = Math.floor(hrs / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/**
 * Age of the DATA, from the timestamp the API stamped on it.
 *
 * The distinction is the whole point: a fetch that just completed can return a figure computed
 * hours ago, and a page served from cache can be days old while its clock says "just now". This
 * reads the payload's own `asOf`, so a stale record announces itself instead of looking fresh.
 *
 * Past the threshold it stops being a muted timestamp and says so in words, because a reader
 * scanning a page will not do the subtraction.
 */
export function DataAsOf({
  asOf,
  staleAfterSeconds = 900,
  className,
}: {
  asOf: string | number | null | undefined;
  staleAfterSeconds?: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const at = asOf === null || asOf === undefined ? NaN : new Date(asOf).getTime();
  // No timestamp is not freshness. Say the age is unknown rather than implying it is zero.
  if (!Number.isFinite(at)) {
    return <span className={clsx('text-[11px] text-zinc-500', className)}>age unknown</span>;
  }
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  const stale = seconds > staleAfterSeconds;
  return (
    <span
      className={clsx(
        'text-[11px] tabular-nums',
        stale ? 'font-medium text-amber-700' : 'text-zinc-500',
        className,
      )}
      title={new Date(at).toISOString()}
    >
      {stale ? `STALE — measured ${ago(seconds)}` : `Measured ${ago(seconds)}`}
    </span>
  );
}

// Muted, understated freshness read-out. Ticks up every second from `since`,
// which callers reset whenever the view's data refreshes. No "Live" dot — the
// number itself reads near 0s when the stream is pushing, grows if it stalls.
export function LastUpdated({
  since,
  asOf,
  className,
}: {
  since: number;
  /** The timestamp the API stamped on this payload. Preferred over `since` whenever present. */
  asOf?: string | number | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // When the payload says when it was true, that is the answer. `since` only knows when we
  // asked, and the two differ by however long the figure sat upstream.
  if (asOf !== undefined && asOf !== null) return <DataAsOf asOf={asOf} className={className} />;

  const seconds = Math.max(0, Math.round((now - since) / 1000));
  // "Fetched", not "Updated": without an asOf this is the age of the REQUEST, and calling a
  // request an update is how a twelve-day-old record read "Updated just now".
  return (
    <span className={clsx('text-[11px] tabular-nums text-zinc-500', className)}>
      Fetched {ago(seconds)}
    </span>
  );
}

// Circular-arrow refresh button. Subtle spin while `spinning`; that's the whole
// affordance — freshness reads from the timestamp, not a colored badge.
export function RefreshButton({
  onClick,
  spinning,
  className,
}: {
  onClick: () => void;
  spinning: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={spinning}
      aria-label="Refresh"
      title="Refresh"
      className={clsx(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-black/[0.04] hover:text-zinc-700 disabled:cursor-default',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={clsx('h-3.5 w-3.5', spinning && 'animate-spin')}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
