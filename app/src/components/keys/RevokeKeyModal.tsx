'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { maskKey, type ApiKey } from '@/lib/api-keys-types';

export default function RevokeKeyModal({
  apiKey,
  onClose,
  onRevoked,
}: {
  apiKey: ApiKey | null;
  onClose: () => void;
  onRevoked: (id: string) => void;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    if (!apiKey || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(apiKey.id)}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) {
        onRevoked(apiKey.id);
        toast('API key revoked', 'success');
        setSubmitting(false);
        onClose();
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
    <Modal
      open={!!apiKey}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Revoke API key"
      description="This immediately and permanently disables the key. Any service using it will start receiving 401s."
    >
      <div className="space-y-5">
        {apiKey && (
          <div className="rounded-lg border border-black/[0.06] bg-[#f7f7f8] px-4 py-3">
            <p className="text-sm font-medium text-zinc-900">{apiKey.name}</p>
            <p className="mt-1 font-data text-xs text-zinc-500">{maskKey(apiKey.keyPrefix)}</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-600/20 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              onClose();
            }}
            className="text-xs font-medium uppercase tracking-wider-2 text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={revoke}
            disabled={submitting}
            className="rounded-lg border border-red-600/30 bg-red-600 px-6 py-2.5 text-xs font-medium uppercase tracking-wider-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Revoking…' : 'Revoke key'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
