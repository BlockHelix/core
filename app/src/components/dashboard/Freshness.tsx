'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

function ago(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// Muted, understated freshness read-out. Ticks up every second from `since`,
// which callers reset whenever the view's data refreshes. No "Live" dot — the
// number itself reads near 0s when the stream is pushing, grows if it stalls.
export function LastUpdated({ since, className }: { since: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.round((now - since) / 1000));
  return (
    <span className={clsx('text-[11px] tabular-nums text-zinc-500', className)}>
      Updated {ago(seconds)}
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
