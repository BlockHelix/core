'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import Modal from '@/components/ui/Modal';
import { timeUntil } from '@/lib/format';
import type { AccountUsage } from '@/lib/api-keys-types';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; usage: AccountUsage };

export default function PlanUsageBar() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/usage', { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setState({ phase: 'error', message: body?.error ?? `Request failed (${res.status})` });
        } else {
          setState({ phase: 'ready', usage: body as AccountUsage });
        }
      } catch {
        if (!cancelled) setState({ phase: 'error', message: 'Could not load plan usage' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="border border-white/10 bg-white/[0.02] corner-cut">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between md:p-7">
          <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
            <PlanBadge state={state} />
            <div className="hidden h-10 w-px bg-white/10 sm:block" />
            <UsageMeter state={state} />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="whitespace-nowrap border border-emerald-400/40 bg-emerald-400/10 px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-emerald-300 transition-colors hover:bg-emerald-400/20"
            >
              Upgrade
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Higher limits are coming"
        description="Paid plans are almost ready. Tell us what you need and we'll get you set up."
      >
        <div className="space-y-5">
          <div className="border border-white/10 bg-white/[0.02] p-4">
            <p className="text-[11px] uppercase tracking-wider-2 text-white/40">What&apos;s coming</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li className="flex gap-2"><span className="text-emerald-400">›</span> Thousands of requests/day</li>
              <li className="flex gap-2"><span className="text-emerald-400">›</span> Multiple production keys</li>
              <li className="flex gap-2"><span className="text-emerald-400">›</span> Priority risk-engine throughput &amp; SLAs</li>
            </ul>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Self-serve billing isn&apos;t live yet. Need a higher tier today? Reach out and we&apos;ll
            provision it manually.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="mailto:founders@blockhelix.tech?subject=BlockHelix%20API%20—%20higher%20limits"
              className="inline-flex items-center gap-2 bg-emerald-400 px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-black transition-colors hover:bg-emerald-300"
            >
              Contact the team
            </a>
            <button
              type="button"
              onClick={() => setUpgradeOpen(false)}
              className="text-xs font-medium uppercase tracking-wider-2 text-white/50 transition-colors hover:text-white"
            >
              Maybe later
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function tierLabel(tier: string): string {
  return tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Free';
}

function PlanBadge({ state }: { state: State }) {
  const tier = state.phase === 'ready' ? state.usage.tier : 'free';
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider-2 text-white/40">Current plan</p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <span className="inline-flex items-center gap-2 border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wider-2 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {state.phase === 'loading' ? '···' : tierLabel(tier)}
        </span>
      </div>
    </div>
  );
}

function UsageMeter({ state }: { state: State }) {
  if (state.phase === 'error') {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider-2 text-white/40">Requests today</p>
        <p className="mt-1.5 text-sm text-white/40">Usage unavailable — {state.message}</p>
      </div>
    );
  }

  const loading = state.phase === 'loading';
  const usage = state.phase === 'ready' ? state.usage : null;
  const used = usage?.usedToday ?? 0;
  const limit = usage?.limitPerDay ?? 5;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = limit > 0 && used / limit >= 0.8;

  return (
    <div className="min-w-[200px] flex-1 sm:max-w-xs">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider-2 text-white/40">Requests today</p>
        <p className="font-data text-xs text-white/50">
          {loading ? '—' : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden bg-white/10">
        <div
          className={clsx(
            'h-full transition-all duration-500',
            loading ? 'skeleton w-1/3' : nearLimit ? 'bg-amber-400' : 'bg-emerald-400',
          )}
          style={loading ? undefined : { width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-white/40">
        {loading
          ? 'Loading usage…'
          : usage?.resetsAt
            ? `Resets ${timeUntil(usage.resetsAt)}`
            : 'Rate limit resets daily'}
      </p>
    </div>
  );
}
