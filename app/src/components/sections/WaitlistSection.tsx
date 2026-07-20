'use client';

import { useState } from 'react';
import Reveal from '@/components/ui/Reveal';

export default function WaitlistSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section id="waitlist" className="py-20 lg:py-48 bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-8">{'// Pre-launch · Base mainnet beta'}</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8">
            Register for updates.
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Guarded launch: $25k TVL cap per vault, allowlisted operators, protocol guardian
            active. Independent audit before real TVL.
          </p>
        </Reveal>

        {status === 'done' ? (
          <p className="text-emerald-600 font-mono text-lg">You&apos;re registered. We&apos;ll send launch updates.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.xyz"
              className="flex-1 px-6 py-4 text-sm bg-white text-gray-900 border border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium tracking-widest bg-gray-900 text-white hover:bg-black transition-all duration-300 disabled:opacity-60 whitespace-nowrap"
            >
              {status === 'sending' ? 'SENDING…' : 'REGISTER'}
              <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="text-red-600 font-mono text-sm mt-4">Something went wrong. Try again.</p>
        )}
        <p className="text-xs text-gray-400 font-mono mt-10">
          Legacy Solana devnet runtime is frozen; existing vaults are archived.
        </p>
      </div>
    </section>
  );
}
