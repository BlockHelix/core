'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clsx } from 'clsx';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<((message: string, kind?: ToastKind) => void) | null>(null);

export function useToast(): (message: string, kind?: ToastKind) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++seq;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-soft transition-all duration-300',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        toast.kind === 'success' && 'border-emerald-600/25 text-emerald-700',
        toast.kind === 'error' && 'border-red-600/25 text-red-700',
        toast.kind === 'info' && 'border-black/[0.08] text-zinc-700',
      )}
    >
      <span aria-hidden className="mt-0.5 font-data text-xs">
        {toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '✕' : '›'}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
