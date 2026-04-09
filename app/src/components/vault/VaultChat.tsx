'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || 'https://agents.blockhelix.tech';

interface Props {
  agentId: string;
  vaultName: string;
  open: boolean;
  onClose: () => void;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export default function VaultChat({ agentId, vaultName, open, onClose }: Props) {
  const { walletAddress } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [tier, setTier] = useState<'holder' | 'public' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const history = messages.slice(-20);
    const next: Msg[] = [...messages, { role: 'user', content: text }, { role: 'assistant', content: '' }];
    setMessages(next);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch(`${RUNTIME_URL}/v1/vaults/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, wallet: walletAddress || undefined, history }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `chat failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          let event = 'message';
          let data = '';
          for (const l of lines) {
            if (l.startsWith('event: ')) event = l.slice(7);
            else if (l.startsWith('data: ')) data = l.slice(6);
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (event === 'start') setTier(parsed.tier);
            else if (event === 'delta') {
              acc += parsed.text;
              setMessages((m) => {
                const copy = m.slice();
                copy[copy.length - 1] = { role: 'assistant', content: acc };
                return copy;
              });
            } else if (event === 'error') {
              throw new Error(parsed.message);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: 'assistant', content: `[error: ${err?.message || 'failed'}]` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-[85vh] md:h-[70vh] bg-[#0a0a0a] border border-white/10 md:rounded-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="text-sm text-white/70 lowercase font-light tracking-wide">{vaultName}</div>
            {tier && (
              <div className={`text-[9px] uppercase tracking-widest ${tier === 'holder' ? 'text-emerald-300/70' : 'text-white/30'}`}>
                {tier}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xs">close</button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-white/20 text-xs mt-10">say hello.</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[85%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-white/10 text-white/90 rounded-2xl rounded-br-sm'
                    : 'text-white/70'
                }`}
              >
                {m.content}
                {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                  <span className="inline-block w-[6px] h-[14px] bg-white/60 ml-[2px] align-middle animate-pulse" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="message…"
              disabled={streaming}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none max-h-32"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="px-4 py-2.5 bg-white text-black text-xs font-medium rounded-full disabled:opacity-30 hover:bg-white/90"
            >
              {streaming ? '…' : 'send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
