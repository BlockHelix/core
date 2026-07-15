'use client';

import { useCallbackRef } from '@/lib/use-callback-ref';
import { useEffect, useId, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  // When false the backdrop/Escape won't close (used mid-flow, e.g. reveal step).
  dismissible?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const close = useCallbackRef(onClose);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first focusable element inside the dialog for keyboard users.
    const focusable = panel?.querySelector<HTMLElement>(
      'input, button, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      // Basic focus trap.
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, dismissible, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-6 md:pt-24"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) close();
      }}
    >
      <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-sm" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative w-full max-w-lg rounded-xl border border-black/[0.08] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] px-6 py-5">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-zinc-950">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs text-zinc-500 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={close}
              aria-label="Close dialog"
              className="-mr-1 -mt-1 p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
