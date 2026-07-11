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
        'flex items-start gap-3 border px-4 py-3 text-sm backdrop-blur-md bg-[#0a0a0a]/90 transition-all duration-300',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        toast.kind === 'success' && 'border-emerald-400/40 text-emerald-300',
        toast.kind === 'error' && 'border-red-400/40 text-red-300',
        toast.kind === 'info' && 'border-white/15 text-white/80',
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
        className="text-white/30 hover:text-white/70 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
