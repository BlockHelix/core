'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || 'https://agents.blockhelix.tech';

interface LifeResponse {
  vault: {
    id: string;
    name: string;
    agentId: string;
    agentWallet: string | null;
    archetype: string | null;
    operator: string | null;
    operatorTelegram: string | null;
    taskStatus: string;
  };
  identity: {
    birth: string | null;
    purpose: string | null;
    memory: string | null;
  };
  state: {
    mood: string;
    hunger: string;
    level: number;
    title: string;
    balanceSol: number;
    balanceUsdc: number;
    revenueTotalMicro: number;
    revenueTodayMicro: number;
    spendsTodayCount: number;
    daysAlive: number;
    lastActivityAt: string | null;
    minutesSinceActivity: number | null;
    bornAt: string | null;
    emoji: string;
  } | null;
  recentActivity: Array<{
    id: number;
    amountMicro: number;
    recipient: string | null;
    reason: string | null;
    status: string;
    createdAt: string;
  }>;
}

const MOOD_COLORS: Record<string, string> = {
  happy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  content: 'text-white bg-white/10 border-white/30',
  neutral: 'text-white/60 bg-white/5 border-white/20',
  anxious: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  sad: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  hungry: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  starving: 'text-red-400 bg-red-400/10 border-red-400/30',
  coma: 'text-white/30 bg-white/5 border-white/10',
};

const HUNGER_LABEL: Record<string, string> = {
  full: 'well fed',
  low: 'peckish',
  hungry: 'hungry',
  starving: 'starving',
  coma: 'in coma',
};

function fmtUsdc(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface Props {
  agentId: string;
  initialData: LifeResponse | null;
}

export default function VaultLifeContent({ agentId, initialData }: Props) {
  const [data, setData] = useState<LifeResponse | null>(initialData);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${RUNTIME_URL}/v1/vaults/${agentId}/life`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [agentId]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] py-24">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-white/40 font-mono text-sm">
            {error ? `Error: ${error}` : 'Loading vault…'}
          </p>
        </div>
      </main>
    );
  }

  const { vault, identity, state, recentActivity } = data;
  const moodClass = state ? MOOD_COLORS[state.mood] || MOOD_COLORS.neutral : MOOD_COLORS.neutral;

  return (
    <main className="min-h-screen bg-[#0a0a0a] py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-6 space-y-10">
        {/* Hero strip */}
        <div className="flex items-start gap-6 pb-8 border-b border-white/10">
          <div className="text-7xl leading-none" aria-label={state?.mood || 'neutral'}>
            {state?.emoji || '◯'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl lg:text-5xl font-bold text-white font-mono mb-2 break-words">
              {vault.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {vault.archetype && (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 border border-white/20 text-white/60 font-mono">
                  {vault.archetype}
                </span>
              )}
              {state && (
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 border font-mono ${moodClass}`}>
                  {state.mood}
                </span>
              )}
              {state && (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 border border-white/20 text-white/50 font-mono">
                  {HUNGER_LABEL[state.hunger] || state.hunger}
                </span>
              )}
              {state && (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 border border-white/20 text-white/50 font-mono">
                  lvl {state.level} · {state.title}
                </span>
              )}
            </div>
            {state?.bornAt && (
              <p className="text-xs text-white/30 font-mono">
                born {new Date(state.bornAt).toLocaleDateString()} · {state.daysAlive} days alive
              </p>
            )}
          </div>
        </div>

        {/* Birth / bio */}
        {identity.birth && (
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-3">
              Who am I
            </h2>
            <div className="p-5 border border-white/10 bg-white/[0.02] text-white/80 font-mono text-sm whitespace-pre-wrap leading-relaxed">
              {identity.birth}
            </div>
          </section>
        )}

        {/* Purpose */}
        {identity.purpose && (
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-3">
              My purpose
            </h2>
            <div className="p-5 border border-emerald-500/20 bg-emerald-500/[0.03] text-white/80 font-mono text-sm whitespace-pre-wrap leading-relaxed">
              {identity.purpose}
            </div>
          </section>
        )}

        {/* Wallet + stats strip */}
        {state && (
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-3">
              Treasury
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 border border-white/10 divide-x divide-white/10">
              <div className="px-4 py-4">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-mono">SOL</div>
                <div className="text-lg font-bold text-white font-mono tabular-nums">
                  {state.balanceSol.toFixed(4)}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-mono">USDC</div>
                <div className="text-lg font-bold text-white font-mono tabular-nums">
                  ${state.balanceUsdc.toFixed(2)}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-mono">Spent total</div>
                <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
                  {fmtUsdc(state.revenueTotalMicro)}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-mono">Today</div>
                <div className="text-lg font-bold text-cyan-400 font-mono tabular-nums">
                  {state.spendsTodayCount} actions
                </div>
              </div>
            </div>
            {vault.agentWallet && (
              <p className="text-[10px] text-white/30 font-mono mt-3 break-all">
                wallet: {vault.agentWallet}
              </p>
            )}
          </section>
        )}

        {/* Memory */}
        {identity.memory && (
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-3">
              What I&apos;ve learned
            </h2>
            <div className="p-5 border border-white/10 bg-white/[0.02] text-white/70 font-mono text-xs whitespace-pre-wrap leading-relaxed">
              {identity.memory}
            </div>
          </section>
        )}

        {/* Recent activity */}
        <section>
          <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-3">
            Recent activity
          </h2>
          {recentActivity.length === 0 ? (
            <div className="p-5 border border-white/10 bg-white/[0.02] text-white/30 font-mono text-xs">
              Nothing yet. Still waking up.
            </div>
          ) : (
            <div className="border border-white/10 bg-white/[0.01] divide-y divide-white/5">
              {recentActivity.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between text-xs font-mono">
                  <div className="flex-1 min-w-0">
                    <div className="text-white/70 truncate">{a.reason || '(no reason)'}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {relTime(a.createdAt)}
                      {a.recipient && <> · {a.recipient}</>}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className={
                      a.status === 'settled' ? 'text-emerald-400' :
                      a.status === 'pending' ? 'text-amber-400' :
                      'text-red-400'
                    }>
                      {fmtUsdc(a.amountMicro)}
                    </div>
                    <div className="text-[10px] text-white/30">{a.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer link */}
        <div className="pt-8 border-t border-white/10 flex items-center justify-between text-[10px] text-white/30 font-mono">
          <Link href="/" className="hover:text-white/60 transition-colors">
            ← blockhelix
          </Link>
          <span>updates every 20s</span>
        </div>
      </div>
    </main>
  );
}
