'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWallets } from '@privy-io/react-auth/solana';
import { toast } from '@/lib/toast';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL || 'https://agents.blockhelix.tech';

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
function Linkify({ text }: { text: string }) {
  if (!text) return null;
  const parts: Array<string | { url: string }> = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    if (match.index! > last) parts.push(text.slice(last, match.index!));
    parts.push({ url: match[0] });
    last = match.index! + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200">
            {p.url.length > 60 ? p.url.slice(0, 57) + '…' : p.url}
          </a>
        ),
      )}
    </>
  );
}

interface Props {
  agentId: string;
  vaultName: string;
  open: boolean;
  onClose: () => void;
}

interface Msg {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  toolDone?: boolean;
}

export default function VaultChat({ agentId, vaultName, open, onClose }: Props) {
  const { walletAddress } = useAuth();
  const { wallets } = useWallets();
  const signerWallet = wallets[0];
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [tier, setTier] = useState<'holder' | 'public' | null>(null);
  const [session, setSession] = useState<{ signature: string; expAt: number; wallet: string } | null>(null);
  const [signingSession, setSigningSession] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Sign a 1-hour chat session when the drawer opens with a connected wallet.
  // This is what proves to the server that the caller owns the wallet they
  // claim, so the vault can unlock the holder voice + holder API key.
  useEffect(() => {
    if (!open || !walletAddress || !signerWallet) return;
    if (session && session.wallet === walletAddress && session.expAt > Date.now() + 60_000) return;

    let cancelled = false;
    (async () => {
      setSigningSession(true);
      try {
        const expAt = Date.now() + 60 * 60 * 1000;
        const message = `BlockHelix-chat:${agentId}:${expAt}`;
        const encoded = new TextEncoder().encode(message);
        const result = await signerWallet.signMessage({ message: encoded });
        const bs58 = (await import('bs58')).default;
        const raw: unknown = (result as any)?.signature ?? result;
        let sigBytes: Uint8Array;
        if (raw instanceof Uint8Array) sigBytes = raw;
        else if (Array.isArray(raw)) sigBytes = Uint8Array.from(raw);
        else if (typeof raw === 'string') {
          try { sigBytes = bs58.decode(raw); }
          catch { sigBytes = Uint8Array.from(Buffer.from(raw, 'base64')); }
        } else throw new Error('unexpected signature shape');
        if (cancelled) return;
        setSession({ signature: bs58.encode(sigBytes), expAt, wallet: walletAddress });
      } catch (err: any) {
        if (!cancelled) toast(err?.message || 'failed to sign chat session', 'error');
      } finally {
        if (!cancelled) setSigningSession(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, walletAddress, signerWallet, agentId, session]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    // Only plain user/assistant text goes into history sent to the server —
    // tool events are server-side state, not part of the conversation log.
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.content && m.content.trim())
      .slice(-20);
    const next: Msg[] = [...messages, { role: 'user', content: text }, { role: 'assistant', content: '' }];
    setMessages(next);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch(`${RUNTIME_URL}/v1/vaults/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          ...(session && session.wallet === walletAddress && session.expAt > Date.now()
            ? {
                wallet: session.wallet,
                sessionSignature: session.signature,
                sessionExpAt: session.expAt,
              }
            : {}),
        }),
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
            if (event === 'start') {
              setTier(parsed.tier);
            } else if (event === 'delta') {
              acc += parsed.text;
              setMessages((m) => {
                const copy = m.slice();
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant' && !last.toolName) {
                  copy[copy.length - 1] = { role: 'assistant', content: acc };
                } else {
                  // previous bubble was a tool call — start a fresh assistant bubble
                  copy.push({ role: 'assistant', content: acc });
                }
                return copy;
              });
            } else if (event === 'tool_use') {
              // New tool call — flush current text accumulator and insert a tool chip
              acc = '';
              setMessages((m) => {
                const copy = m.slice();
                const last = copy[copy.length - 1];
                // Drop trailing empty assistant bubble if any
                if (last && last.role === 'assistant' && !last.content) copy.pop();
                copy.push({
                  role: 'tool',
                  content: '',
                  toolName: parsed.name,
                  toolInput: parsed.input,
                  toolDone: false,
                });
                return copy;
              });
            } else if (event === 'tool_result') {
              setMessages((m) => {
                const copy = m.slice();
                // Mark the most recent matching tool call as done
                for (let i = copy.length - 1; i >= 0; i--) {
                  if (copy[i].role === 'tool' && copy[i].toolName === parsed.name && !copy[i].toolDone) {
                    copy[i] = { ...copy[i], toolDone: true, toolResult: parsed.result };
                    break;
                  }
                }
                return copy;
              });
            } else if (event === 'error') {
              throw new Error(parsed.message);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      const raw = err?.message || 'something went wrong';
      const friendly = raw.includes('Failed to fetch') || raw.includes('network')
        ? 'couldn\'t reach the agent — it might be waking up. try again in a moment.'
        : raw;
      setMessages((m) => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          copy[copy.length - 1] = { role: 'assistant', content: friendly };
        } else {
          copy.push({ role: 'assistant', content: friendly });
        }
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
            <div className="text-center text-white/20 text-xs mt-10">
              {signingSession ? 'signing chat session…' : 'say hello.'}
            </div>
          )}
          {messages.map((m, i) => {
            if (m.role === 'tool') {
              const label = m.toolName || 'tool';
              const inputStr =
                m.toolInput && typeof m.toolInput === 'object'
                  ? Object.entries(m.toolInput)
                      .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v).slice(0, 60)}`)
                      .join(' ')
                  : '';
              return (
                <div key={i} className="text-left">
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono rounded-full border ${
                      m.toolDone
                        ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200/70'
                        : 'border-white/10 bg-white/5 text-white/40'
                    }`}
                  >
                    <span
                      className={`inline-block w-[6px] h-[6px] rounded-full ${
                        m.toolDone ? 'bg-emerald-400' : 'bg-white/40 animate-pulse'
                      }`}
                    />
                    <span>{label}{inputStr ? ` · ${inputStr}` : ''}</span>
                  </div>
                </div>
              );
            }
            return (
            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[85%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-white/10 text-white/90 rounded-2xl rounded-br-sm'
                    : 'text-white/70'
                }`}
              >
                <Linkify text={m.content} />
                {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                  <span className="inline-block w-[6px] h-[14px] bg-white/60 ml-[2px] align-middle animate-pulse" />
                )}
              </div>
            </div>
            );
          })}
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
