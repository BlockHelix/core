'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  onCopied,
  label = 'Copy',
  className,
}: {
  value: string;
  onCopied?: (ok: boolean) => void;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handle() {
    const ok = await copyText(value);
    onCopied?.(ok);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={copied ? 'Copied' : label}
      className={clsx(
        'inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider-2 font-medium transition-colors',
        copied ? 'text-emerald-400' : 'text-white/60 hover:text-white',
        className,
      )}
    >
      <span aria-hidden className="font-data">{copied ? '✓' : '⧉'}</span>
      {copied ? 'Copied' : label}
    </button>
  );
}

// A read-only value field with an inline copy affordance — used for the raw key.
export function CopyField({
  value,
  onCopied,
  mono = true,
}: {
  value: string;
  onCopied?: (ok: boolean) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-stretch border border-white/15 bg-[#0a0a0a]">
      <code
        className={clsx(
          'flex-1 min-w-0 overflow-x-auto whitespace-nowrap px-3 py-3 text-xs text-white',
          mono && 'font-data',
        )}
      >
        {value}
      </code>
      <div className="flex items-center border-l border-white/15 px-3">
        <CopyButton value={value} onCopied={onCopied} />
      </div>
    </div>
  );
}
