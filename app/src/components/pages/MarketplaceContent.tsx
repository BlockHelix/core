'use client';

import { useState } from 'react';
import Link from 'next/link';

const POLICY_TEMPLATES = [
  {
    name: 'Bluechip',
    hooks: 'Swap only',
    description: 'USDC ↔ WETH/cbBTC, top-liquidity pools, ≤50 bps slippage',
    risk: 'Conservative',
    riskColor: '#4ade80',
  },
  {
    name: 'All Yield',
    hooks: 'Yield only',
    description: 'Morpho, Aave v3, Moonwell whitelisted markets — no directional swaps',
    risk: 'Conservative–Moderate',
    riskColor: '#4ade80',
  },
  {
    name: 'Balanced',
    hooks: 'Swap + Yield',
    description: 'Bluechip pairs plus yield sources, per-tx notional caps',
    risk: 'Moderate',
    riskColor: '#fbbf24',
  },
  {
    name: 'Midcap Momentum',
    hooks: 'Swap',
    description: 'Curated liquidity-screened midcap list, tighter caps, wider slippage band',
    risk: 'Aggressive',
    riskColor: '#f87171',
  },
  {
    name: 'Perps Midcap',
    hooks: 'Swap + Perps',
    description: 'Midcap perp markets, max 3× leverage, mandatory exit leaves — v2',
    risk: 'Aggressive',
    riskColor: '#f87171',
    v2: true,
  },
  {
    name: 'Custom',
    hooks: 'Any',
    description: 'Operator-defined rows validated by the config service',
    risk: 'Advanced',
    riskColor: '#a78bfa',
  },
];

const CODE_SNIPPET = `POST /v1/vaults/:id/trade/swap
{
  "tokenIn":  "USDC",
  "tokenOut": "WETH",
  "amount":   "5000000000",
  "maxSlippageBps": 50
}

// executor verifies leaf ∈ merkle root, routes via CoW
// returns { orderId, status: "queued" }`;

export default function MarketplaceContent() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7]">
      <HeroSection />
      <PillarsSection />
      <PolicySection />
      <WaitlistSection />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative border-b border-[#1e1e2e] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,211,238,0.07) 0%, transparent 70%)',
        }}
      />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-32 pb-24">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <span
              className="text-[10px] uppercase tracking-widest font-mono px-2 py-1 border"
              style={{ color: '#22d3ee', borderColor: 'rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.05)' }}
            >
              Coming to Base
            </span>
            <span className="text-[10px] uppercase tracking-widest font-mono text-[#52525b]">
              Pre-launch · Join the waitlist below
            </span>
          </div>

          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ fontFamily: 'var(--font-jetbrains-mono)', letterSpacing: '-0.02em' }}
          >
            The vault API
            <br />
            <span style={{ color: '#22d3ee' }}>for the agentic era</span>
          </h1>

          <p className="text-base md:text-lg text-[#a1a1aa] leading-relaxed mb-10 max-w-2xl">
            Non-custodial ERC-4626 vaults on Base where any program — quant script, TradingView webhook, LLM agent — can run an on-chain fund via a REST API. Operators can only execute merkle-authorized, slippage-capped actions. Depositors see every policy change 24 hours before it takes effect.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#waitlist"
              className="px-6 py-3 text-sm font-mono font-semibold rounded-md transition-all duration-200"
              style={{
                background: '#22d3ee',
                color: '#0a0a0f',
              }}
            >
              Join the waitlist
            </a>
            <Link
              href="/docs"
              className="px-6 py-3 text-sm font-mono border rounded-md transition-all duration-200 text-[#a1a1aa] hover:text-[#e4e4e7]"
              style={{ borderColor: '#1e1e2e' }}
            >
              Read the docs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PillarsSection() {
  return (
    <section className="border-b border-[#1e1e2e]">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-20">
        <p className="text-[10px] uppercase tracking-widest font-mono text-[#52525b] mb-12">
          Three pillars
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1e1e2e]">
          <PillarCard
            number="01"
            title="API-first"
            subtitle="POST /trade/swap"
            body="Any program with an HTTP client can run an on-chain fund. One endpoint drives swaps, yield deposits, and perp positions — quotes routed via CoW Protocol, MEV-protected."
            accent="#22d3ee"
            code={CODE_SNIPPET}
          />
          <PillarCard
            number="02"
            title="Agent-native"
            subtitle="MCP-native, wallet-auth"
            body="An AI agent can create a vault, draft a policy config, wait out the timelock, and trade — all without human intervention. Auth is just a wallet signature — no signup, no human onboarding."
            accent="#a78bfa"
          />
          <PillarCard
            number="03"
            title="Legible policy"
            subtitle="Trust the policy, not the manager"
            body='Merkle-authorized leaf sets are human-readable. Pending root changes surface as banners — "adds: swap USDC→WETH on Uni v3 0.05%, cap $10k/tx." Depositors have 24 h to exit before any change executes.'
            accent="#4ade80"
          />
        </div>
      </div>
    </section>
  );
}

function PillarCard({
  number,
  title,
  subtitle,
  body,
  accent,
  code,
}: {
  number: string;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  code?: string;
}) {
  return (
    <div
      className="bg-[#12121a] p-8 flex flex-col gap-5 transition-all duration-200 group"
      style={{
        ['--accent' as string]: accent,
      }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-mono text-[#52525b]">{number}</span>
        <span
          className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded"
          style={{ color: accent, background: `${accent}15` }}
        >
          {subtitle}
        </span>
      </div>
      <h3
        className="text-xl font-bold"
        style={{ fontFamily: 'var(--font-jetbrains-mono)', color: accent }}
      >
        {title}
      </h3>
      <p className="text-sm text-[#a1a1aa] leading-relaxed">{body}</p>
      {code && (
        <pre
          className="mt-2 p-4 rounded text-[11px] leading-relaxed overflow-x-auto"
          style={{ background: '#0d1117', color: '#22d3ee', fontFamily: 'var(--font-jetbrains-mono)' }}
        >
          {code}
        </pre>
      )}
    </div>
  );
}

function PolicySection() {
  return (
    <section className="border-b border-[#1e1e2e]">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-20">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-mono text-[#52525b] mb-3">
              Policy templates
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold"
              style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
            >
              No merkle expertise required
            </h2>
          </div>
          <p className="text-sm text-[#a1a1aa] max-w-sm">
            Pick a risk profile. We generate and maintain the leaf set. Operators one-click adopt template updates through the normal 24 h timelock flow.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {POLICY_TEMPLATES.map((t) => (
            <PolicyCard key={t.name} template={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PolicyCard({
  template,
}: {
  template: (typeof POLICY_TEMPLATES)[number];
}) {
  return (
    <div
      className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 flex flex-col gap-4 transition-all duration-200 hover:border-[#2a2a3e] hover:bg-[#1a1a28]"
    >
      <div className="flex items-center justify-between">
        <span
          className="text-base font-bold"
          style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
        >
          {template.name}
          {template.v2 && (
            <span className="ml-2 text-[9px] font-mono text-[#52525b] align-middle">v2</span>
          )}
        </span>
        <span
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
          style={{ color: template.riskColor, background: `${template.riskColor}15` }}
        >
          {template.risk}
        </span>
      </div>
      <div
        className="text-[10px] font-mono uppercase tracking-widest text-[#52525b]"
      >
        {template.hooks}
      </div>
      <p className="text-xs text-[#a1a1aa] leading-relaxed">{template.description}</p>
    </div>
  );
}

function WaitlistSection() {
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
    <section id="waitlist" className="py-24">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
        <div
          className="max-w-2xl mx-auto text-center border border-[#1e1e2e] rounded-lg p-12"
          style={{ background: 'rgba(34,211,238,0.03)' }}
        >
          <p className="text-[10px] uppercase tracking-widest font-mono mb-4" style={{ color: '#22d3ee' }}>
            Pre-launch · Base mainnet beta
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
          >
            Get early access
          </h2>
          <p className="text-sm text-[#a1a1aa] mb-8 leading-relaxed">
            Guarded launch with a $25k TVL cap per vault, allowlisted operators, and the protocol guardian active. Audit before real TVL.
          </p>
          {status === 'done' ? (
            <p className="text-sm font-mono mb-8" style={{ color: '#22d3ee' }}>
              You&apos;re on the list. We&apos;ll be in touch.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 justify-center mb-3 max-w-md mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.xyz"
                className="flex-1 px-4 py-3 text-sm font-mono rounded-md bg-black/40 border text-[#e4e4e7] focus:outline-none transition-colors"
                style={{ borderColor: '#1e1e2e' }}
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="px-6 py-3 text-sm font-mono font-semibold rounded-md transition-all duration-200 disabled:opacity-60"
                style={{ background: '#22d3ee', color: '#0a0a0f' }}
              >
                {status === 'sending' ? 'Joining…' : 'Request access'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p className="text-xs font-mono text-red-400 mb-3">Something went wrong — try again.</p>
          )}
          <div className="flex justify-center">
            <Link
              href="/docs"
              className="px-6 py-3 text-sm font-mono border rounded-md transition-all duration-200 text-center text-[#a1a1aa] hover:text-[#e4e4e7]"
              style={{ borderColor: '#1e1e2e' }}
            >
              Read the docs
            </Link>
          </div>
          <p className="text-[10px] font-mono text-[#52525b] mt-6">
            Legacy Solana devnet runtime is frozen — existing vaults are archived.
          </p>
        </div>
      </div>
    </section>
  );
}
