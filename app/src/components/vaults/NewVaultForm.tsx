'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkSafeOnBase, type SafeCheck } from '@/lib/safe';
import { truncateAddress } from '@/lib/format';
import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  MAX_PERFORMANCE_FEE_BPS,
  MAX_PLATFORM_FEE_BPS,
  VAULT_NAME_RE,
  VAULT_SYMBOL_RE,
} from '@/lib/vault-types';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// Versioned localStorage key for the in-progress deploy form. Only the user's
// input is persisted — never the transient Safe-check / validation state.
const DRAFT_KEY = 'bh:new-vault-draft';

type SafeState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'done'; result: SafeCheck };

interface RiskProfileSummary {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

function bpsToPercent(bps: number): string {
  return (bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function NewVaultForm() {
  const router = useRouter();
  const [vaultName, setVaultName] = useState('');
  const [vaultSymbol, setVaultSymbol] = useState('');
  const [pauserAddress, setPauserAddress] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [platformFeeBps, setPlatformFeeBps] = useState(100);
  const [performanceFeeBps, setPerformanceFeeBps] = useState(1000);
  const [safeState, setSafeState] = useState<SafeState>({ phase: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<RiskProfileSummary[]>([]);
  const [riskProfileId, setRiskProfileId] = useState('');
  const checkSeq = useRef(0);
  const hydrated = useRef(false);

  // Load curated risk profiles (backend is source of truth) and default to the first.
  useEffect(() => {
    let active = true;
    fetch('/api/risk-profiles')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { profiles?: RiskProfileSummary[] } | null) => {
        if (!active || !body?.profiles?.length) return;
        setProfiles(body.profiles);
        setRiskProfileId((cur) => cur || body.profiles![0].id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Restore a saved draft on mount so navigating back after a failure keeps input.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (d && typeof d === 'object') {
          if (typeof d.vaultName === 'string') setVaultName(d.vaultName);
          if (typeof d.vaultSymbol === 'string') setVaultSymbol(d.vaultSymbol);
          if (typeof d.pauserAddress === 'string') setPauserAddress(d.pauserAddress);
          if (typeof d.payoutAddress === 'string') setPayoutAddress(d.payoutAddress);
          if (typeof d.platformFeeBps === 'number') setPlatformFeeBps(d.platformFeeBps);
          if (typeof d.performanceFeeBps === 'number') setPerformanceFeeBps(d.performanceFeeBps);
        }
      }
    } catch {
      // Ignore malformed drafts.
    }
    hydrated.current = true;
  }, []);

  // Persist the draft (debounced) on any field change, once hydrated.
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            vaultName,
            vaultSymbol,
            pauserAddress,
            payoutAddress,
            platformFeeBps,
            performanceFeeBps,
          }),
        );
      } catch {
        // Storage full / unavailable — draft persistence is best-effort.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [vaultName, vaultSymbol, pauserAddress, payoutAddress, platformFeeBps, performanceFeeBps]);

  useEffect(() => {
    const addr = pauserAddress.trim();
    if (!addr) {
      setSafeState({ phase: 'idle' });
      return;
    }
    if (!ADDRESS_RE.test(addr)) {
      setSafeState({ phase: 'done', result: { ok: false, reason: 'Not a valid Ethereum address.' } });
      return;
    }
    setSafeState({ phase: 'checking' });
    const seq = ++checkSeq.current;
    const timer = setTimeout(async () => {
      const result = await checkSafeOnBase(addr);
      if (checkSeq.current === seq) {
        setSafeState({ phase: 'done', result });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [pauserAddress]);

  const nameValid = vaultName.trim().length > 0 && vaultName.trim().length <= 64 && VAULT_NAME_RE.test(vaultName.trim());
  const symbolValid = vaultSymbol.trim().length > 0 && vaultSymbol.trim().length <= 16 && VAULT_SYMBOL_RE.test(vaultSymbol.trim());
  const payoutValid = ADDRESS_RE.test(payoutAddress.trim());
  const platformValid = Number.isInteger(platformFeeBps) && platformFeeBps >= 0 && platformFeeBps <= MAX_PLATFORM_FEE_BPS;
  const performanceValid = Number.isInteger(performanceFeeBps) && performanceFeeBps >= 0 && performanceFeeBps <= MAX_PERFORMANCE_FEE_BPS;
  const safeOk = safeState.phase === 'done' && safeState.result.ok;

  const canSubmit = nameValid && symbolValid && payoutValid && platformValid && performanceValid && safeOk && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultName: vaultName.trim(),
          vaultSymbol: vaultSymbol.trim(),
          pauserAddress: pauserAddress.trim(),
          payoutAddress: payoutAddress.trim(),
          platformFeeBps,
          performanceFeeBps,
          riskProfileId,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.deploymentId) {
        setSubmitError(body?.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      // Successful submit — clear the saved draft before leaving.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      router.push(`/dashboard/vaults/${body.deploymentId}`);
    } catch {
      setSubmitError('Network error, try again');
      setSubmitting(false);
    }
  }

  const selectedProfile = profiles.find((p) => p.id === riskProfileId);

  const inputClass =
    'w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#10c689] focus:outline-none focus:ring-1 focus:ring-[#10c689]/30 font-data';
  const labelClass = 'block text-[11px] uppercase tracking-wider-2 font-medium text-zinc-500 mb-2';

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="vaultName">Vault Name</label>
          <input
            id="vaultName"
            className={inputClass}
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            placeholder="My USDC Vault"
            maxLength={64}
          />
          {vaultName && !nameValid && (
            <p className="mt-2 text-xs text-[#b82214]">1-64 chars: letters, numbers, spaces, ._-</p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="vaultSymbol">Vault Symbol</label>
          <input
            id="vaultSymbol"
            className={inputClass}
            value={vaultSymbol}
            onChange={(e) => setVaultSymbol(e.target.value)}
            placeholder="MYVLT"
            maxLength={16}
          />
          {vaultSymbol && !symbolValid && (
            <p className="mt-2 text-xs text-[#b82214]">1-16 chars: letters, numbers, ._-</p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Base Asset</label>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-black/[0.06] bg-[#f7f7f8] px-4 py-3">
          <div>
            <span className="text-sm font-medium text-zinc-900">USDC</span>
            <span className="ml-3 text-xs text-zinc-500">Base · chain {BASE_CHAIN_ID}</span>
          </div>
          <span className="break-all font-data text-xs text-zinc-400">{BASE_USDC_ADDRESS}</span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Fixed to USDC on Base for v1.</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="riskProfile">Risk Profile · Trade Policy</label>
        <select
          id="riskProfile"
          className={inputClass}
          value={riskProfileId}
          onChange={(e) => setRiskProfileId(e.target.value)}
        >
          {profiles.length === 0 && <option value="">Loading profiles…</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedProfile && (
          <div className="mt-3 rounded-lg border border-black/[0.06] bg-[#f7f7f8] px-4 py-3">
            <p className="text-xs text-zinc-500">{selectedProfile.description}</p>
            <p className="mt-3 text-[11px] uppercase tracking-wider-2 font-medium text-zinc-400">
              On-chain permissions · merkle-enforced
            </p>
            <ul className="mt-2 space-y-1">
              {selectedProfile.permissions.map((perm, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                  <span className="mt-0.5 text-[#10c689]" aria-hidden>✓</span>
                  <span className="font-data">{perm}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-zinc-400">
              The strategist can perform only these actions on-chain — anything else reverts.
            </p>
          </div>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="pauserAddress">Pauser Safe (Gnosis Safe on Base)</label>
        <input
          id="pauserAddress"
          className={inputClass}
          value={pauserAddress}
          onChange={(e) => setPauserAddress(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
        />
        <div className="mt-2 text-xs">
          {safeState.phase === 'checking' && <p className="text-zinc-500">Checking Safe on Base…</p>}
          {safeState.phase === 'done' && safeState.result.ok && (
            <div className="text-[#10c689]">
              <p>
                ✓ Safe v{safeState.result.version} — {safeState.result.owners.length} owner{safeState.result.owners.length === 1 ? '' : 's'}, threshold {safeState.result.threshold}
              </p>
              <p className="mt-1 font-data text-zinc-500">
                {safeState.result.owners.slice(0, 3).map((o) => truncateAddress(o, 6)).join(' · ')}
                {safeState.result.owners.length > 3 && ` · +${safeState.result.owners.length - 3} more`}
              </p>
            </div>
          )}
          {safeState.phase === 'done' && !safeState.result.ok && (
            <p className="text-[#b82214]">✕ {safeState.result.reason}</p>
          )}
          {safeState.phase === 'idle' && (
            <p className="text-zinc-400">
              Your Safe can pause the vault as an emergency circuit-breaker — it cannot move or withdraw funds. The vault has no owner: once deployed it is immutable and non-custodial. Re-verified on-chain by the deployment service.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="payoutAddress">Payout Address</label>
        <input
          id="payoutAddress"
          className={inputClass}
          value={payoutAddress}
          onChange={(e) => setPayoutAddress(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
        />
        {payoutAddress && !payoutValid && (
          <p className="mt-2 text-xs text-[#b82214]">Must be a valid 0x address</p>
        )}
        <p className="mt-2 text-xs text-zinc-400">Where fees are paid. Can be any Base address.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="platformFee">Platform Fee (bps)</label>
          <input
            id="platformFee"
            type="number"
            min={0}
            max={MAX_PLATFORM_FEE_BPS}
            step={1}
            className={inputClass}
            value={platformFeeBps}
            onChange={(e) => setPlatformFeeBps(Number(e.target.value))}
          />
          <p className="mt-2 text-xs text-zinc-400">
            {platformValid ? `${bpsToPercent(platformFeeBps)}% annual on TVL` : `0 – ${MAX_PLATFORM_FEE_BPS} bps`}
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="performanceFee">Performance Fee (bps)</label>
          <input
            id="performanceFee"
            type="number"
            min={0}
            max={MAX_PERFORMANCE_FEE_BPS}
            step={1}
            className={inputClass}
            value={performanceFeeBps}
            onChange={(e) => setPerformanceFeeBps(Number(e.target.value))}
          />
          <p className="mt-2 text-xs text-zinc-400">
            {performanceValid ? `${bpsToPercent(performanceFeeBps)}% of profits` : `0 – ${MAX_PERFORMANCE_FEE_BPS} bps`}
          </p>
        </div>
      </div>

      {submitError && (
        <div className="rounded-lg border border-[#b82214]/20 bg-[#fdeeeb] px-4 py-3 text-sm text-[#9a1c10]">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="bh-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-sm font-medium uppercase tracking-widest"
      >
        {submitting ? 'Deploying…' : 'Deploy Vault'}
      </button>
    </form>
  );
}
