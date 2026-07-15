'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { CopyField } from '@/components/ui/CopyButton';
import { useToast } from '@/components/ui/Toast';
import {
  API_KEY_NAME_RE,
  MAX_API_KEY_NAME_LEN,
  type CreatedApiKey,
} from '@/lib/api-keys-types';

type Phase =
  | { kind: 'form' }
  | { kind: 'created'; key: CreatedApiKey };

export default function CreateKeyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });

  const trimmed = name.trim();
  const nameValid =
    trimmed.length > 0 && trimmed.length <= MAX_API_KEY_NAME_LEN && API_KEY_NAME_RE.test(trimmed);

  function reset() {
    setName('');
    setError(null);
    setSubmitting(false);
    setPhase({ kind: 'form' });
  }

  function handleClose() {
    // If a key was just revealed, closing means the list should refresh.
    if (phase.kind === 'created') onCreated();
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.key) {
        setError(body?.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      setPhase({ kind: 'created', key: body as CreatedApiKey });
      setSubmitting(false);
      toast('API key created', 'success');
    } catch {
      setError('Network error, try again');
      setSubmitting(false);
    }
  }

  const created = phase.kind === 'created';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      dismissible={!created}
      title={created ? 'Save your API key' : 'Create API key'}
      description={
        created
          ? undefined
          : 'Give this key a name so you can recognize it later — e.g. “Production” or “Local dev”.'
      }
    >
      {phase.kind === 'form' ? (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label
              htmlFor="key-name"
              className="mb-2 block text-[11px] uppercase tracking-wider-2 font-medium text-zinc-500"
            >
              Key name
            </label>
            <input
              id="key-name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production"
              maxLength={MAX_API_KEY_NAME_LEN}
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
            {name && !nameValid && (
              <p className="mt-2 text-xs text-red-600">
                1-{MAX_API_KEY_NAME_LEN} chars: letters, numbers, spaces, ._-
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-600/20 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!nameValid || submitting}
              className="bh-btn-primary rounded-lg px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2"
            >
              {submitting ? 'Creating…' : 'Create key'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3">
            <span aria-hidden className="mt-0.5 text-amber-600">⚠</span>
            <p className="text-sm text-amber-800 leading-relaxed">
              Copy this key now. For your security,{' '}
              <span className="font-medium text-amber-900">you won&apos;t be able to see it again.</span>
            </p>
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider-2 font-medium text-zinc-500">
              {phase.key.name}
            </p>
            <CopyField
              value={phase.key.key}
              onCopied={(ok) => toast(ok ? 'Key copied to clipboard' : 'Copy failed', ok ? 'success' : 'error')}
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="bh-btn-primary rounded-lg px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2"
            >
              Done — I saved it
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
