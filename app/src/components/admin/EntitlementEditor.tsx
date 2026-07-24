'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { AdminEntitlement, AdminUser } from '@/lib/admin-types';

// One-line summary of a user's entitlement override, shared by the users table
// and the user-detail page.
export function overrideSummary(e: AdminEntitlement | null): string {
  if (!e) return '—';
  if (e.unlimited) return 'Unlimited';
  const parts: string[] = [];
  if (e.vaultsTotal != null) parts.push(`${e.vaultsTotal} vaults`);
  if (e.tradesPerDay != null) parts.push(`${e.tradesPerDay} trades/day`);
  return parts.length ? parts.join(' · ') : 'Custom';
}

// Entitlement editor dialog. Reused wherever an admin edits a user's caps.
export function EditLimitsModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [unlimited, setUnlimited] = useState(false);
  const [vaultsTotal, setVaultsTotal] = useState('');
  const [tradesPerDay, setTradesPerDay] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'save' | 'clear'>(null);
  const [initKey, setInitKey] = useState<string | null>(null);

  // Prefill from the user's current entitlement whenever a new row opens.
  if (user && initKey !== user.userId) {
    const e = user.entitlement;
    setUnlimited(!!e?.unlimited);
    setVaultsTotal(e?.vaultsTotal != null ? String(e.vaultsTotal) : '');
    setTradesPerDay(e?.tradesPerDay != null ? String(e.tradesPerDay) : '');
    setNote(e?.note ?? '');
    setInitKey(user.userId);
  }

  const close = () => {
    setInitKey(null);
    onClose();
  };

  const save = async () => {
    if (!user) return;
    setBusy('save');
    const body: Record<string, unknown> = { unlimited };
    if (!unlimited) {
      if (vaultsTotal.trim() !== '') body.vaultsTotal = Number(vaultsTotal);
      if (tradesPerDay.trim() !== '') body.tradesPerDay = Number(tradesPerDay);
    }
    if (note.trim() !== '') body.note = note.trim();

    const res = await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}/entitlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (res.ok) {
      toast('Entitlements updated', 'success');
      onSaved();
    } else {
      const b = await res.json().catch(() => null);
      toast(b?.error ?? 'Failed to update entitlements', 'error');
    }
  };

  const clear = async () => {
    if (!user) return;
    setBusy('clear');
    const res = await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}/entitlements`, {
      method: 'DELETE',
    });
    setBusy(null);
    if (res.ok) {
      toast('Override cleared', 'success');
      onSaved();
    } else {
      const b = await res.json().catch(() => null);
      toast(b?.error ?? 'Failed to clear override', 'error');
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={close}
      title="Edit entitlements"
      description={user ? `${user.email ?? user.userId}` : undefined}
    >
      <div className="space-y-5">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-black/[0.06] bg-[#f7f7f8] px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-zinc-800">Unlimited</span>
            <span className="block text-xs text-zinc-500">Remove all vault and trade caps for this user.</span>
          </span>
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
            className="h-4 w-4 accent-[#10c689]"
          />
        </label>

        <div className={clsx('grid grid-cols-2 gap-4 transition-opacity', unlimited && 'pointer-events-none opacity-40')}>
          <Field
            label="Vaults total"
            value={vaultsTotal}
            onChange={setVaultsTotal}
            placeholder="e.g. 5"
            disabled={unlimited}
          />
          <Field
            label="Trades / day"
            value={tradesPerDay}
            onChange={setTradesPerDay}
            placeholder="e.g. 100"
            disabled={unlimited}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wider-2 text-zinc-400">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for the override"
            maxLength={280}
            className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#10c689]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={busy !== null || !user?.entitlement}
            onClick={clear}
            className="text-xs font-medium uppercase tracking-wider-2 text-[#b82214] transition-colors hover:text-[#9a1c10] disabled:opacity-40"
            title={user?.entitlement ? 'Remove the override entirely' : 'No override to clear'}
          >
            {busy === 'clear' ? 'Clearing…' : 'Clear override'}
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={close}
              className="text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={save}
              className="bh-btn-primary rounded-lg px-5 py-2.5 text-xs font-medium uppercase tracking-wider-2"
            >
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider-2 text-zinc-400">{label}</label>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 font-data text-sm text-zinc-800 outline-none focus:border-[#10c689]"
      />
    </div>
  );
}
