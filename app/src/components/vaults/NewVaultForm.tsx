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

type SafeState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'done'; result: SafeCheck };

function bpsToPercent(bps: number): string {
  return (bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function NewVaultForm() {
  const router = useRouter();
  const [vaultName, setVaultName] = useState('');
  const [vaultSymbol, setVaultSymbol] = useState('');
  const [adminAddress, setAdminAddress] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [platformFeeBps, setPlatformFeeBps] = useState(100);
  const [performanceFeeBps, setPerformanceFeeBps] = useState(1000);
  const [safeState, setSafeState] = useState<SafeState>({ phase: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const checkSeq = useRef(0);

  useEffect(() => {
    const addr = adminAddress.trim();
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
  }, [adminAddress]);

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
          adminAddress: adminAddress.trim(),
          payoutAddress: payoutAddress.trim(),
          platformFeeBps,
          performanceFeeBps,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.deploymentId) {
        setSubmitError(body?.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      router.push(`/dashboard/vaults/${body.deploymentId}`);
    } catch {
      setSubmitError('Network error, try again');
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full bg-[#0a0a0a] border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/60 focus:outline-none font-data';
  const labelClass = 'block text-[11px] uppercase tracking-wider-2 font-medium text-white/50 mb-2';

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
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
            <p className="mt-2 text-xs text-red-400">1-64 chars: letters, numbers, spaces, ._-</p>
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
            <p className="mt-2 text-xs text-red-400">1-16 chars: letters, numbers, ._-</p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Base Asset</label>
        <div className="border border-white/10 bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-sm text-white font-medium">USDC</span>
            <span className="ml-3 text-xs text-white/50">Base · chain {BASE_CHAIN_ID}</span>
          </div>
          <span className="text-xs text-white/40 font-data break-all">{BASE_USDC_ADDRESS}</span>
        </div>
        <p className="mt-2 text-xs text-white/40">Fixed to USDC on Base for v1.</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="adminAddress">Admin Address (Gnosis Safe on Base)</label>
        <input
          id="adminAddress"
          className={inputClass}
          value={adminAddress}
          onChange={(e) => setAdminAddress(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
        />
        <div className="mt-2 text-xs">
          {safeState.phase === 'checking' && <p className="text-white/50">Checking Safe on Base…</p>}
          {safeState.phase === 'done' && safeState.result.ok && (
            <div className="text-emerald-400">
              <p>
                ✓ Safe v{safeState.result.version} — {safeState.result.owners.length} owner{safeState.result.owners.length === 1 ? '' : 's'}, threshold {safeState.result.threshold}
              </p>
              <p className="mt-1 text-white/50 font-data">
                {safeState.result.owners.slice(0, 3).map((o) => truncateAddress(o, 6)).join(' · ')}
                {safeState.result.owners.length > 3 && ` · +${safeState.result.owners.length - 3} more`}
              </p>
            </div>
          )}
          {safeState.phase === 'done' && !safeState.result.ok && (
            <p className="text-red-400">✕ {safeState.result.reason}</p>
          )}
          {safeState.phase === 'idle' && (
            <p className="text-white/40">
              The Safe becomes the vault admin (RolesAuthority owner). It is re-verified on-chain by the deployment service.
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
          <p className="mt-2 text-xs text-red-400">Must be a valid 0x address</p>
        )}
        <p className="mt-2 text-xs text-white/40">Where fees are paid. Can be any Base address.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
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
          <p className="mt-2 text-xs text-white/40">
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
          <p className="mt-2 text-xs text-white/40">
            {performanceValid ? `${bpsToPercent(performanceFeeBps)}% of profits` : `0 – ${MAX_PERFORMANCE_FEE_BPS} bps`}
          </p>
        </div>
      </div>

      {submitError && (
        <div className="border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium tracking-widest uppercase bg-emerald-400 text-black hover:bg-emerald-300 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Deploying…' : 'Deploy Vault'}
      </button>
    </form>
  );
}
