'use client';

import { useEffect, useState, useCallback } from 'react';
import { getOpsSummary, setTaskAction, type OpsSummary } from '@/lib/runtime';
import { CopyButton } from '@/components/CopyButton';

interface Props {
  vault: string;
}

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

const STATUS_COLORS: Record<string, string> = {
  running: 'text-emerald-400 bg-emerald-400/10',
  paused: 'text-amber-400 bg-amber-400/10',
  completed: 'text-white/50 bg-white/10',
  budget_exhausted: 'text-red-400 bg-red-400/10',
  failed: 'text-red-400 bg-red-400/10',
};

export function AgentOpsPanel({ vault }: Props) {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getOpsSummary(vault);
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [vault]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const act = async (action: 'pause' | 'resume' | 'complete') => {
    if (busy) return;
    setBusy(true);
    try {
      await setTaskAction(vault, action);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="mt-4 border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400 font-mono">
        {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mt-4 border border-white/5 bg-white/[0.02] p-3 text-xs text-white/30 font-mono">
        Loading ops data...
      </div>
    );
  }

  const b = summary.budget;
  const taskStatus = summary.agent.taskStatus;
  const spentPct = b && b.total > 0 ? (b.spent / b.total) * 100 : 0;
  const reservedPct = b && b.total > 0 ? (b.reserved / b.total) * 100 : 0;

  return (
    <div className="mt-4 border border-white/10 bg-white/[0.01] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-white/40 font-mono">
          Budget &amp; Ops
        </div>
        <span className={`text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 ${STATUS_COLORS[taskStatus] || 'text-white/40 bg-white/10'}`}>
          {taskStatus}
        </span>
      </div>

      {b && (
        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-white/50">
              <span className="text-emerald-400">{fmtUsdc(b.spent)}</span> spent /{' '}
              <span className="text-white">{fmtUsdc(b.total)}</span>
              {b.reserved > 0 && (
                <> · <span className="text-amber-400">{fmtUsdc(b.reserved)}</span> reserved</>
              )}
            </span>
            <span className="text-white/30">
              {fmtUsdc(b.available)} available
            </span>
          </div>
          <div className="w-full h-2 bg-white/5 overflow-hidden">
            <div
              className="h-full bg-emerald-400/80 inline-block align-top"
              style={{ width: `${Math.min(100, spentPct)}%` }}
            />
            <div
              className="h-full bg-amber-400/60 inline-block align-top"
              style={{ width: `${Math.min(100 - spentPct, reservedPct)}%` }}
            />
          </div>
          <div className="text-[10px] text-white/30 font-mono mt-2">
            Approval threshold: {fmtUsdc(b.threshold)}
          </div>
        </div>
      )}

      {summary.agent.agentWallet && (
        <div className="border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-mono mb-1">
              Fund agent wallet
            </div>
            <div className="text-xs font-mono text-white/70 truncate">
              {summary.agent.agentWallet}
            </div>
          </div>
          <CopyButton value={summary.agent.agentWallet} />
        </div>
      )}

      {summary.pendingApprovals.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-amber-400 font-mono mb-2">
            Pending approvals ({summary.pendingApprovals.length})
          </div>
          <div className="space-y-2">
            {summary.pendingApprovals.map((a) => (
              <div key={a.id} className="border border-amber-400/20 bg-amber-400/[0.03] p-3 text-xs font-mono">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-400">#{a.id}</span>
                  <span className="text-white/70">{fmtUsdc(a.amountMicro)}</span>
                </div>
                <div className="text-white/50 truncate">{a.reason}</div>
                <div className="text-white/30 mt-1">
                  Reply <span className="text-emerald-400">YES {a.id}</span> or{' '}
                  <span className="text-red-400">NO {a.id}</span> in Telegram
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.spends.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-mono mb-2">
            Recent spends
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {summary.spends.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs font-mono py-1 border-b border-white/5 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-white/70 truncate">{s.reason || '(no reason)'}</div>
                  <div className="text-[10px] text-white/30">
                    {relTime(s.createdAt)}
                    {s.recipient && <> · {s.recipient}</>}
                  </div>
                </div>
                <div className="ml-3 text-right">
                  <div className={
                    s.status === 'settled' ? 'text-emerald-400' :
                    s.status === 'pending' ? 'text-amber-400' :
                    'text-red-400'
                  }>
                    {fmtUsdc(s.amountMicro)}
                  </div>
                  <div className="text-[10px] text-white/30">{s.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {taskStatus === 'running' && (
          <button
            onClick={() => act('pause')}
            disabled={busy}
            className="px-3 py-1.5 border border-white/20 text-white/70 text-[10px] uppercase tracking-widest font-mono hover:border-white/40 hover:text-white transition-colors disabled:opacity-40"
          >
            Pause
          </button>
        )}
        {taskStatus === 'paused' && (
          <button
            onClick={() => act('resume')}
            disabled={busy}
            className="px-3 py-1.5 border border-emerald-400/40 text-emerald-400 text-[10px] uppercase tracking-widest font-mono hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
          >
            Resume
          </button>
        )}
        {(taskStatus === 'running' || taskStatus === 'paused') && (
          <button
            onClick={() => act('complete')}
            disabled={busy}
            className="px-3 py-1.5 border border-white/20 text-white/50 text-[10px] uppercase tracking-widest font-mono hover:border-white/40 hover:text-white transition-colors disabled:opacity-40"
          >
            Mark complete
          </button>
        )}
      </div>
    </div>
  );
}
