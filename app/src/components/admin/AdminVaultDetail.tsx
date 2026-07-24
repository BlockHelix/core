'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAccount } from 'wagmi';
import type { Address, Hex } from 'viem';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import StatusBadge from '@/components/vaults/StatusBadge';
import TxTable from '@/components/vaults/TxTable';
import ConnectButton from '@/components/wallet/ConnectButton';
import { usePauseVault, useUnpauseVault, useUpdateExchangeRate } from '@/lib/wallet/hooks';
import { fetcher } from '@/lib/swr-fetcher';
import { BASESCAN_URL, BASE_CHAIN_ID, COMPONENT_LABELS, type DeploymentStatus } from '@/lib/vault-types';
import type { AdminVault, AdminVaultsResponse } from '@/lib/admin-types';
import type { TxListResponse, VaultState } from '@/lib/onchain-types';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const UINT96_MAX = (1n << 96n) - 1n;

// Components that carry pause()/unpause() in the Veda stack.
const PAUSABLE_KEYS = ['manager', 'teller', 'accountant'] as const;

function asAddress(value: string | null | undefined): Address | null {
  return value && ADDRESS_RE.test(value) ? (value as Address) : null;
}

export default function AdminVaultDetail({ id }: { id: string }) {
  const { data, error } = useSWR<AdminVaultsResponse>('/api/admin/vaults', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  if (error && !data) {
    return (
      <div className="rounded-lg border border-[#b82214]/20 bg-[#fdeeeb] px-4 py-3 text-sm text-[#9a1c10]">
        {error.message}
      </div>
    );
  }
  if (!data) {
    return <div className="h-64 skeleton rounded-xl" />;
  }

  const vault = data.vaults.find((v) => v.id === id);
  if (!vault) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-white p-8 text-sm text-zinc-500 shadow-soft">
        Vault not found.
      </div>
    );
  }

  return <VaultDetailBody vault={vault} />;
}

function VaultDetailBody({ vault }: { vault: AdminVault }) {
  const addresses = vault.addresses ?? {};
  const pausableTargets = useMemo(
    () => {
      const addrs = vault.addresses ?? {};
      return PAUSABLE_KEYS.map((k) => ({ key: k, address: asAddress(addrs[k]) })).filter(
        (t): t is { key: (typeof PAUSABLE_KEYS)[number]; address: Address } => t.address !== null,
      );
    },
    [vault.addresses],
  );
  const accountant = asAddress(addresses.accountant);
  const componentEntries = Object.entries(addresses).filter(
    (e): e is [string, string] => typeof e[1] === 'string' && !!e[1],
  );

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Link href="/admin" className="inline-flex items-center gap-1 transition-colors hover:text-zinc-900">
            <span aria-hidden>←</span> Vaults
          </Link>
          <span aria-hidden className="text-zinc-300">/</span>
          <span className="font-data text-zinc-400">{vault.id}</span>
        </nav>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">{vault.vaultName || '—'}</h1>
            <p className="mt-1 font-data text-xs text-zinc-400">
              {vault.vaultSymbol} · Base ({vault.chainId})
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Owner: {vault.email ?? '—'} <span className="font-data text-xs text-zinc-400">({vault.userId})</span>
            </p>
          </div>
          <StatusBadge status={vault.status as DeploymentStatus} />
        </div>
      </div>

      {/* Live on-chain state */}
      <VaultStatePanel id={vault.id} />

      {/* Etherscan activity */}
      <VaultActivityPanel id={vault.id} />

      {/* Components */}
      {componentEntries.length > 0 && (
        <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
          <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Component addresses</h2>
          <div className="mt-4 divide-y divide-black/[0.05]">
            {componentEntries.map(([key, address]) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-4 py-3">
                <span className="text-sm text-zinc-700">{COMPONENT_LABELS[key] ?? key}</span>
                <a
                  href={`${BASESCAN_URL}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-data text-xs text-[#10c689] hover:text-[#10c689]"
                >
                  {address} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On-chain actions */}
      <OnChainActions pausableTargets={pausableTargets} accountant={accountant} />

      {/* Transactions */}
      {vault.transactionHashes.length > 0 && (
        <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
          <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Deployment transactions</h2>
          <div className="mt-4 space-y-2">
            {vault.transactionHashes.map((hash) => (
              <a
                key={hash}
                href={`${BASESCAN_URL}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all font-data text-xs text-zinc-500 hover:text-[#10c689]"
              >
                {hash} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Danger zone — DB-only cleanup for test/failed vaults */}
      <DeleteDeploymentSection id={vault.id} />
    </div>
  );
}

// Delete only the DB record. The on-chain vault is immutable and unaffected.
function DeleteDeploymentSection({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vaults/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) {
        toast('Deployment record deleted', 'success');
        router.push('/admin');
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error ?? `Request failed (${res.status})`);
      setSubmitting(false);
    } catch {
      setError('Network error, try again');
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Danger zone</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Remove this deployment record from the dashboard. The on-chain vault is immutable and unaffected.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="rounded-lg border border-[#b82214]/30 bg-[#fdeeeb] px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-[#9a1c10] transition-colors hover:bg-[#fad9d4]"
        >
          Delete deployment
        </button>
      </div>

      <Modal
        open={confirm}
        onClose={() => {
          if (submitting) return;
          setError(null);
          setConfirm(false);
        }}
        title="Delete deployment record?"
        description="Delete this deployment record? The on-chain vault is immutable and unaffected — this only removes it from the dashboard."
      >
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg border border-[#b82214]/20 bg-[#fdeeeb] px-4 py-3 text-sm text-[#9a1c10]">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirm(false);
              }}
              disabled={submitting}
              className="text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={submitting}
              className="rounded-lg border border-[#b82214]/30 bg-[#b82214] px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-white transition-colors hover:bg-[#9a1c10] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Deleting…' : 'Delete deployment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PausedBadge({ paused }: { paused: boolean | null }) {
  if (paused == null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">
        Unknown
      </span>
    );
  }
  return paused ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#b82214]/25 bg-[#fdeeeb] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider-2 text-[#9a1c10]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#d62e1f]" /> Paused
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10c689]/25 bg-[#eafaf3] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider-2 text-[#10c689]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#10c689]" /> Active
    </span>
  );
}

// Live on-chain state (share price, per-component pause status, TVL, balances).
function VaultStatePanel({ id }: { id: string }) {
  const { data, error, isValidating, mutate } = useSWR<VaultState>(
    `/api/admin/vaults/${id}/state`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 10_000 },
  );

  if (error && !data) {
    return (
      <Panel title="On-chain state">
        <p className="text-sm text-[#b82214]">{error.message}</p>
      </Panel>
    );
  }
  if (!data) {
    return (
      <Panel title="On-chain state">
        <div className="h-24 skeleton rounded-lg" />
      </Panel>
    );
  }

  const price = data.sharePrice;
  const symbol = data.baseSymbol ?? '';
  const balances = data.balances ?? [];
  const nonZero = balances.filter((b) => b.raw !== '0');
  const zero = balances.filter((b) => b.raw === '0');

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">On-chain state</h2>
        <button
          type="button"
          onClick={() => void mutate()}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
        >
          {isValidating ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {data.error && <p className="mt-4 text-sm text-zinc-500">{data.error}</p>}

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wider-2 text-zinc-400">Share price</dt>
          <dd className="mt-1 font-data text-sm text-zinc-900">
            {price ? `${price.formatted}${symbol ? ` ${symbol}` : ''}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider-2 text-zinc-400">TVL</dt>
          <dd className="mt-1 font-data text-sm text-zinc-900">
            {data.tvl ? `${data.tvl.formatted}${symbol ? ` ${symbol}` : ''}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider-2 text-zinc-400">Shares outstanding</dt>
          <dd className="mt-1 font-data text-sm text-zinc-900">{data.shares ? data.shares.formatted : '—'}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wider-2 text-zinc-400">Pause status</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
          {(['teller', 'manager', 'accountant'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">{COMPONENT_LABELS[k] ?? k}</span>
              <PausedBadge paused={data.paused[k]} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wider-2 text-zinc-400">Token balances</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
          {nonZero.length === 0 && zero.length === 0 && <span className="text-sm text-zinc-400">—</span>}
          {nonZero.map((b) => (
            <span key={b.symbol} className="font-data text-sm text-zinc-800">
              {b.formatted} <span className="text-zinc-400">{b.symbol}</span>
            </span>
          ))}
          {zero.map((b) => (
            <span key={b.symbol} className="font-data text-sm text-zinc-300">
              0 {b.symbol}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Etherscan-style activity, rendered with the shared <TxTable>.
function VaultActivityPanel({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<TxListResponse>(
    `/api/admin/vaults/${id}/txs`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 15_000 },
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">Activity</h2>
        <button
          type="button"
          onClick={() => void mutate()}
          className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
        >
          {isValidating ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
      <div className="mt-4">
        <TxTable txs={data?.txs} loading={isLoading} error={error ? error.message : null} />
      </div>
    </div>
  );
}

function TxHashLinks({ hashes }: { hashes: Hex[] }) {
  if (hashes.length === 0) return null;
  return (
    <div className="mt-3 space-y-1">
      {hashes.map((h) => (
        <a
          key={h}
          href={`${BASESCAN_URL}/tx/${h}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all font-data text-xs text-[#10c689] hover:text-[#10c689]"
        >
          {h} ↗
        </a>
      ))}
    </div>
  );
}

function OnChainActions({
  pausableTargets,
  accountant,
}: {
  pausableTargets: { key: string; address: Address }[];
  accountant: Address | null;
}) {
  const toast = useToast();
  const { isConnected } = useAccount();
  const pause = usePauseVault();
  const unpause = useUnpauseVault();
  const rate = useUpdateExchangeRate();

  const [confirm, setConfirm] = useState<null | 'pause' | 'unpause'>(null);
  const [newRate, setNewRate] = useState('');

  const targetAddrs = pausableTargets.map((t) => t.address);
  const targetLabels = pausableTargets.map((t) => COMPONENT_LABELS[t.key] ?? t.key).join(', ');
  const busy = pause.isPending || unpause.isPending || rate.isPending;

  const runPause = async () => {
    setConfirm(null);
    try {
      await pause.pause(targetAddrs);
      toast('Pause transactions submitted', 'success');
    } catch {
      /* error surfaced via pause.error */
    }
  };
  const runUnpause = async () => {
    setConfirm(null);
    try {
      await unpause.unpause(targetAddrs);
      toast('Unpause transactions submitted', 'success');
    } catch {
      /* error surfaced via unpause.error */
    }
  };

  const rateValid = (() => {
    if (newRate.trim() === '') return false;
    try {
      const v = BigInt(newRate.trim());
      return v >= 0n && v <= UINT96_MAX;
    } catch {
      return false;
    }
  })();

  const runUpdateRate = async () => {
    if (!accountant || !rateValid) return;
    try {
      await rate.updateExchangeRate(accountant, BigInt(newRate.trim()));
      toast('Exchange rate update submitted', 'success');
    } catch {
      /* error surfaced via rate.error */
    }
  };

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-soft md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400">On-chain actions</h2>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <p className="mt-4 text-sm text-zinc-500">
          Connect a wallet (Base) to pause/unpause the vault or update its exchange rate. A Gnosis Safe can
          connect via WalletConnect.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Pause / Unpause */}
          <section>
            <h3 className="text-sm font-medium text-zinc-800">Pause controls</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {pausableTargets.length > 0
                ? `Calls pause()/unpause() on: ${targetLabels}.`
                : 'No manager/teller/accountant addresses on record — pause controls unavailable.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy || pausableTargets.length === 0}
                onClick={() => setConfirm('pause')}
                className="rounded-lg border border-[#b82214]/30 bg-[#fdeeeb] px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-[#9a1c10] transition-colors hover:bg-[#fad9d4] disabled:opacity-40"
              >
                {pause.isPending ? 'Pausing…' : 'Pause'}
              </button>
              <button
                type="button"
                disabled={busy || pausableTargets.length === 0}
                onClick={() => setConfirm('unpause')}
                className="rounded-lg border border-[#10c689]/30 bg-[#eafaf3] px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-[#10c689] transition-colors hover:bg-[#d3f5e6] disabled:opacity-40"
              >
                {unpause.isPending ? 'Unpausing…' : 'Unpause'}
              </button>
            </div>
            {pause.error && <p className="mt-2 text-xs text-[#b82214]">{pause.error}</p>}
            {unpause.error && <p className="mt-2 text-xs text-[#b82214]">{unpause.error}</p>}
            <TxHashLinks hashes={pause.hashes.length ? pause.hashes : unpause.hashes} />
          </section>

          <div className="h-px bg-black/[0.06]" />

          {/* Update exchange rate */}
          <section>
            <h3 className="text-sm font-medium text-zinc-800">Update exchange rate</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {accountant
                ? 'Calls accountant.updateExchangeRate(uint96 newExchangeRate).'
                : 'No accountant address on record — rate update unavailable.'}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider-2 text-zinc-400">
                  New exchange rate (uint96)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 1000000000000000000"
                  disabled={!accountant || rate.isPending}
                  className="w-72 max-w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 font-data text-sm text-zinc-800 outline-none focus:border-[#10c689] disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                disabled={!accountant || !rateValid || busy}
                onClick={runUpdateRate}
                className="bh-btn-primary rounded-lg px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2"
              >
                {rate.isPending ? 'Updating…' : 'Update rate'}
              </button>
            </div>
            {newRate.trim() !== '' && !rateValid && (
              <p className="mt-2 text-xs text-amber-600">Must be an integer between 0 and 2^96 − 1.</p>
            )}
            {rate.error && <p className="mt-2 text-xs text-[#b82214]">{rate.error}</p>}
            {rate.hash && <TxHashLinks hashes={[rate.hash]} />}
          </section>

          <p className="text-[11px] text-zinc-400">
            Chain: Base ({BASE_CHAIN_ID}). Each target component is a separate transaction.
          </p>
        </div>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'pause' ? 'Pause this vault?' : 'Unpause this vault?'}
        description={
          confirm === 'pause'
            ? `This sends a pause() transaction to each of: ${targetLabels}. Deposits/withdrawals will be halted.`
            : `This sends an unpause() transaction to each of: ${targetLabels}.`
        }
      >
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className="text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm === 'pause' ? runPause : runUnpause}
            className="bh-btn-primary rounded-lg px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2"
          >
            {confirm === 'pause' ? 'Confirm pause' : 'Confirm unpause'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
