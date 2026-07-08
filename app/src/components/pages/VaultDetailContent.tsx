'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { formatUSDC } from '@/lib/format';
import { CopyButton } from '@/components/CopyButton';
import { RevenueChart } from '@/components/RevenueChart';
import { ReceiptTable } from '@/components/ReceiptTable';
import { InvestWithdrawForm } from '@/components/InvestWithdrawForm';
import { findShareMint } from '@/lib/pda';
import { RUNTIME_URL } from '@/lib/network-config';
import { useAgentDetailAPI, type APIAgentDetail } from '@/hooks/useAgentAPI';

interface Props {
  agentId: string;
  initialData?: APIAgentDetail | null;
}

interface AccessInfo {
  tier: 'owner' | 'public';
  canEdit: boolean;
  needsKey: boolean;
  mint: string | null;
  holder: string | null;
  expectedClaimer: string | null;
}

function isValidPubkey(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return '—';
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export default function VaultDetailContent({ agentId, initialData }: Props) {
  const { agent, isLoading, error } = useAgentDetailAPI(agentId, initialData);
  const [access, setAccess] = useState<AccessInfo | null>(null);

  const vaultPubkey = useMemo(() => {
    if (!agent?.vault || !isValidPubkey(agent.vault)) return null;
    try {
      return new PublicKey(agent.vault);
    } catch {
      return null;
    }
  }, [agent?.vault]);

  const shareMintPubkey = useMemo(() => {
    if (!vaultPubkey) return null;
    try {
      return findShareMint(vaultPubkey)[0];
    } catch {
      return null;
    }
  }, [vaultPubkey]);

  const revenue7d = useMemo(() => {
    if (typeof agent?.revenue7d === 'number') return agent.revenue7d;
    const history = agent?.revenueHistory || [];
    if (history.length === 0) return 0;
    const end = history.length - 1;
    const start = Math.max(0, end - 6);
    return history.slice(start).reduce((sum, p) => sum + (p.revenue || 0), 0);
  }, [agent?.revenue7d, agent?.revenueHistory]);

  const navSeries = useMemo(() => {
    if (!agent?.revenueHistory || agent.revenueHistory.length === 0) return [];
    const totalRevenue = agent.stats?.totalRevenue || 0;
    const currentNav = agent.stats?.tvl || 0;
    let cumulative = 0;
    return agent.revenueHistory.map((point) => {
      cumulative += point.revenue;
      const estimatedNav = Math.max(0, currentNav - (totalRevenue - cumulative));
      return { date: point.date, revenue: estimatedNav };
    });
  }, [agent?.revenueHistory, agent?.stats?.totalRevenue, agent?.stats?.tvl]);

  useEffect(() => {
    if (!agent) return;
    const vaultId = agent.id || agent.vault || agent.agentId;
    const walletHint = agent.operator ? `?wallet=${encodeURIComponent(agent.operator)}` : '';
    fetch(`${RUNTIME_URL}/v1/vaults/${vaultId}/access${walletHint}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setAccess(json))
      .catch(() => setAccess(null));
  }, [agent]);

  if (error) {
    return (
      <main className="min-h-screen py-20 lg:py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="border border-red-500/30 bg-red-500/5 p-10 text-center">
            <p className="text-red-400 mb-4">Error loading vault: {error}</p>
            <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Back to marketplace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (isLoading || !agent) {
    return (
      <main className="min-h-screen py-20 lg:py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="space-y-6">
            <div className="h-10 skeleton w-1/2" />
            <div className="h-5 skeleton w-2/3" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <div key={k} className="h-24 skeleton" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const s = agent.stats;
  const vaultId = agent.id || agent.vault || agent.agentId;
  const operatorBond = s?.operatorBond || 0;
  const paused = s?.paused || false;

  return (
    <main className="min-h-screen py-20 lg:py-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/60 hover:text-white transition-colors font-mono"
          >
            <span>←</span>
            <span>Marketplace</span>
          </Link>
        </div>

        <section className="mb-8 border border-white/10 p-6 bg-white/[0.01]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono">{agent.name}</h1>
              <p className="text-sm text-white/55 mt-2">
                {agent.purpose && agent.purpose.trim().length > 0
                  ? agent.purpose
                  : 'Autonomous AI vault earning from machine-to-machine API demand.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className={`text-[10px] uppercase tracking-widest font-bold font-mono ${paused ? 'text-amber-400' : 'text-emerald-400'}`}>
                {paused ? 'PAUSED' : 'LIVE'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="border border-white/10 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">NAV</div>
              <div className="text-lg font-bold text-violet-300 font-mono">${formatUSDC(s?.tvl || 0)}</div>
            </div>
            <div className="border border-white/10 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">Revenue 7d</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">${formatUSDC(revenue7d)}</div>
            </div>
            <div className="border border-white/10 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">Total Revenue</div>
              <div className="text-lg font-bold text-emerald-400/90 font-mono">${formatUSDC(s?.totalRevenue || 0)}</div>
            </div>
            <div className="border border-white/10 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">Operator Bond</div>
              <div className={`text-lg font-bold font-mono ${operatorBond > 0 ? 'text-violet-300' : 'text-red-400'}`}>
                {operatorBond > 0 ? `$${formatUSDC(operatorBond)}` : 'NONE'}
              </div>
            </div>
            <div className="border border-white/10 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">Jobs</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">{(s?.totalJobs || 0).toLocaleString()}</div>
            </div>
            <div className="border border-white/10 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 font-mono">Slash Events</div>
              <div className="text-lg font-bold text-red-400 font-mono">{(s?.slashEvents || 0).toLocaleString()}</div>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="border border-white/10 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3 font-mono">Operator Track Record</div>
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-center justify-between">
                <span>Operator</span>
                <span className="font-mono text-white/80">{shortAddress(agent.operator || null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>API calls</span>
                <span className="font-mono text-white/80">{(s?.apiCalls || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total slashed</span>
                <span className="font-mono text-white/80">${formatUSDC(s?.totalSlashed || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Receipts recorded</span>
                <span className="font-mono text-white/80">{(s?.jobsRecorded || 0).toLocaleString()}</span>
              </div>
            </div>
            {agent.operator && (
              <div className="mt-3">
                <CopyButton value={agent.operator} />
              </div>
            )}
          </div>

          <div className="border border-white/10 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3 font-mono">Holders</div>
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-center justify-between">
                <span>Current holder</span>
                <span className="font-mono text-white/80">{shortAddress(access?.holder || null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Claimer (legacy)</span>
                <span className="font-mono text-white/80">{shortAddress(access?.expectedClaimer || null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>NFT mint</span>
                <span className="font-mono text-white/80">{shortAddress(access?.mint || null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Vault ID</span>
                <span className="font-mono text-white/80">{shortAddress(vaultId)}</span>
              </div>
            </div>
          </div>
        </section>

        {navSeries.length > 0 && (
          <section className="mb-8">
            <RevenueChart
              data={navSeries}
              title="NAV (Estimated from Revenue Path)"
              seriesLabel="NAV"
            />
          </section>
        )}

        {agent.revenueHistory.length > 0 && (
          <section className="mb-8">
            <RevenueChart
              data={agent.revenueHistory}
              title="Revenue History"
              seriesLabel="Revenue"
            />
          </section>
        )}

        {vaultPubkey && (
          <section className="mb-8">
            <div className="text-[10px] uppercase tracking-widest text-white/35 mb-3 font-mono">Invest / Withdraw</div>
            <InvestWithdrawForm
              vaultPubkey={vaultPubkey}
              shareMint={shareMintPubkey}
              sharePrice={1}
              operatorBond={operatorBond}
            />
          </section>
        )}

        <section>
          <div className="text-[10px] uppercase tracking-widest text-white/35 mb-3 font-mono">Revenue Receipts</div>
          <ReceiptTable receipts={agent.recentJobs || []} />
        </section>
      </div>
    </main>
  );
}
