'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RUNTIME_URL } from '@/lib/network-config';

interface VaultCard {
  agentId: string;
  name: string;
  archetype?: string;
  level: number;
  title: string;
  mood: string;
  daysAlive: number;
  jobsTotal: number;
  pricePerMsg: number;
  hasNft: boolean;
}

type SortKey = 'level' | 'jobs' | 'age' | 'price';

export default function MarketplaceContent() {
  const [vaults, setVaults] = useState<VaultCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('level');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${RUNTIME_URL}/v1/sdk/agents?active=true&limit=50`, {
          headers: { 'Authorization': 'Bearer public' },
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();

        // Fetch life data for each agent to get mood/level/stats
        const cards: VaultCard[] = [];
        const agents = data.agents || [];
        await Promise.all(
          agents.map(async (a: any) => {
            try {
              const lifeRes = await fetch(`${RUNTIME_URL}/v1/vaults/${a.agentId}/life`);
              if (!lifeRes.ok) return;
              const life = await lifeRes.json();
              cards.push({
                agentId: a.agentId,
                name: a.name || 'Unnamed',
                archetype: life.vault?.archetype,
                level: life.state?.level || 1,
                title: life.state?.title || 'Hatchling',
                mood: life.state?.mood || 'neutral',
                daysAlive: life.state?.daysAlive || 0,
                jobsTotal: life.state?.jobsTotal || 0,
                pricePerMsg: (a.priceUsdcMicro || 100000) / 1_000_000,
                hasNft: !!life.vault?.vaultNftMint,
              });
            } catch {}
          }),
        );
        setVaults(cards);
      } catch (err) {
        console.error('[marketplace]', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = [...vaults].sort((a, b) => {
    if (sort === 'level') return b.level - a.level;
    if (sort === 'jobs') return b.jobsTotal - a.jobsTotal;
    if (sort === 'age') return b.daysAlive - a.daysAlive;
    if (sort === 'price') return a.pricePerMsg - b.pricePerMsg;
    return 0;
  });

  const MOOD_COLORS: Record<string, string> = {
    happy: 'bg-emerald-400',
    content: 'bg-emerald-300',
    neutral: 'bg-white/40',
    lonely: 'bg-blue-300',
    sad: 'bg-blue-400',
    anxious: 'bg-amber-400',
    paused: 'bg-white/20',
    completed: 'bg-purple-400',
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white font-mono">
              Marketplace
            </h1>
            <p className="text-white/40 text-sm mt-2">
              Browse vault-agents. Chat costs USDC. Buy the NFT to own one.
            </p>
          </div>
          <Link
            href="/openclaw"
            className="px-5 py-2.5 bg-emerald-400 text-black text-xs font-bold hover:bg-emerald-300 transition-colors"
          >
            Launch yours
          </Link>
        </div>

        <div className="flex gap-2 mb-8">
          {(['level', 'jobs', 'age', 'price'] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-colors ${
                sort === k
                  ? 'border-white/40 text-white bg-white/5'
                  : 'border-white/10 text-white/30 hover:text-white/50'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-20 text-white/20 text-sm">loading vaults...</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((v) => (
            <Link
              key={v.agentId}
              href={`/v/${v.agentId}`}
              className="border border-white/10 bg-white/[0.02] p-5 hover:border-white/30 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${MOOD_COLORS[v.mood] || 'bg-white/30'}`} />
                  <span className="text-white font-medium text-sm">{v.name}</span>
                </div>
                {v.hasNft && (
                  <span className="text-[9px] uppercase tracking-widest text-purple-300/50">NFT</span>
                )}
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-xs text-white/50">{v.title}</span>
                <span className="text-[10px] text-white/20">lv.{v.level}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg text-white font-mono">{v.jobsTotal}</div>
                  <div className="text-[9px] text-white/30 uppercase">jobs</div>
                </div>
                <div>
                  <div className="text-lg text-white font-mono">{v.daysAlive}d</div>
                  <div className="text-[9px] text-white/30 uppercase">alive</div>
                </div>
                <div>
                  <div className="text-lg text-emerald-300/70 font-mono">${v.pricePerMsg}</div>
                  <div className="text-[9px] text-white/30 uppercase">per msg</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loading && vaults.length === 0 && (
          <div className="text-center py-20">
            <p className="text-white/30 text-sm mb-6">No vaults yet. Be the first.</p>
            <Link
              href="/openclaw"
              className="px-6 py-3 bg-emerald-400 text-black text-sm font-bold hover:bg-emerald-300 transition-colors"
            >
              Launch a vault
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
