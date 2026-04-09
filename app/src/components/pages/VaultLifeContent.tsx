'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import MoodOrb from '@/components/vault/MoodOrb';
import FeedButton from '@/components/vault/FeedButton';
import { explainVault } from '@/lib/vault-state';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || 'https://agents.blockhelix.tech';

interface LifeResponse {
  vault: {
    id: string;
    name: string;
    agentId: string;
    agentWallet: string | null;
    archetype: string | null;
    operator: string | null;
    taskStatus: string;
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

const TONE_TEXT: Record<string, string> = {
  good: 'text-emerald-300',
  caution: 'text-amber-300',
  critical: 'text-red-300',
  neutral: 'text-white/60',
};

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
  const [showDetails, setShowDetails] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${RUNTIME_URL}/v1/vaults/${agentId}/life`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : null);
    }
  }, [agentId]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white/30 text-sm">{error ? `error: ${error}` : 'loading…'}</p>
      </main>
    );
  }

  const { vault, state, recentActivity } = data;
  const explain = explainVault(vault.name, state);
  const toneClass = TONE_TEXT[explain.tone] || TONE_TEXT.neutral;

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Hero — only the orb, name, one-line state, and the action */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <MoodOrb
          mood={state?.mood || 'neutral'}
          hunger={state?.hunger || 'full'}
          balanceSol={state?.balanceSol || 0}
          minutesSinceActivity={state?.minutesSinceActivity ?? null}
          size={260}
        />

        <h1 className="text-3xl md:text-4xl font-light text-white mt-12 tracking-wide">
          {vault.name.toLowerCase()}
        </h1>

        {state && (
          <p className="text-xs text-white/30 mt-2 font-mono">
            {state.title.toLowerCase()} · {state.daysAlive === 0 ? 'born today' : `${state.daysAlive}d alive`}
          </p>
        )}

        <p className={`max-w-md mt-10 text-base md:text-lg leading-relaxed ${toneClass}`}>
          {explain.headline}
        </p>
        {explain.detail && (
          <p className="max-w-md mt-2 text-sm text-white/40">
            {explain.detail}
          </p>
        )}

        {explain.action === 'feed' && vault.agentWallet && state && (
          <div className="mt-10">
            <FeedButton
              vaultId={vault.id}
              agentWallet={vault.agentWallet}
              vaultName={vault.name}
              amountSol={0.05}
              onFed={() => setTimeout(refresh, 2000)}
            />
          </div>
        )}

        {explain.action === 'chat' && (
          <button
            disabled
            className="mt-10 px-8 py-3.5 border border-white/20 text-white/40 text-sm rounded-full"
            title="Coming soon"
          >
            say hello (soon)
          </button>
        )}

        <button
          onClick={() => setShowDetails((s) => !s)}
          className="mt-16 text-[11px] uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors"
        >
          {showDetails ? 'hide details' : 'details'}
        </button>
      </section>

      {/* Details — secondary info, only on demand */}
      {showDetails && state && (
        <section className="px-6 pb-20 max-w-2xl mx-auto w-full">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/20 mb-1">SOL</div>
              <div className="text-white/70 font-mono tabular-nums">{state.balanceSol.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/20 mb-1">USDC</div>
              <div className="text-white/70 font-mono tabular-nums">${state.balanceUsdc.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/20 mb-1">spent</div>
              <div className="text-white/70 font-mono tabular-nums">${(state.revenueTotalMicro / 1_000_000).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/20 mb-1">today</div>
              <div className="text-white/70 font-mono tabular-nums">{state.spendsTodayCount}</div>
            </div>
          </div>

          {vault.agentWallet && (
            <div className="mt-10 text-center">
              <div className="text-[10px] uppercase tracking-widest text-white/20 mb-2">wallet</div>
              <div className="text-[11px] font-mono text-white/40 break-all">{vault.agentWallet}</div>
              {vault.agentWallet && (
                <div className="mt-3">
                  <FeedButton
                    vaultId={vault.id}
                    agentWallet={vault.agentWallet}
                    vaultName={vault.name}
                    amountSol={0.05}
                    variant="subtle"
                    onFed={() => setTimeout(refresh, 2000)}
                  />
                </div>
              )}
            </div>
          )}

          {recentActivity.length > 0 && (
            <div className="mt-10">
              <div className="text-[10px] uppercase tracking-widest text-white/20 mb-3 text-center">
                recent
              </div>
              <div className="space-y-2 text-center">
                {recentActivity.slice(0, 5).map((a) => (
                  <div key={a.id} className="text-xs text-white/30 italic">
                    “{a.reason || 'something'}” · {relTime(a.createdAt)} · ${(a.amountMicro / 1_000_000).toFixed(3)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="px-6 py-6 text-center text-[10px] text-white/15 font-mono">
        <Link href="/" className="hover:text-white/40 transition-colors">
          blockhelix
        </Link>
      </footer>
    </main>
  );
}
