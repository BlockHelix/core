'use client';

import { useState } from 'react';
import Link from 'next/link';
import HelixHero from '@/components/HelixHero';

const TEMPLATES = [
  {
    tag: 'Bluechip',
    tagColor: 'text-cyan-600',
    title: 'Bluechip',
    desc: 'USDC ↔ WETH/cbBTC on top-liquidity pools only. Slippage capped at 50 bps per trade.',
    meta: 'Risk: conservative · Hooks: swap',
  },
  {
    tag: 'Yield',
    tagColor: 'text-emerald-600',
    title: 'All Yield',
    desc: 'Morpho, Aave v3, and Moonwell whitelisted markets. No directional swaps.',
    meta: 'Risk: conservative–moderate · Hooks: yield',
  },
  {
    tag: 'Balanced',
    tagColor: 'text-violet-600',
    title: 'Balanced',
    desc: 'Bluechip pairs plus yield sources, with per-transaction notional caps.',
    meta: 'Risk: moderate · Hooks: swap + yield',
  },
  {
    tag: 'Momentum',
    tagColor: 'text-amber-600',
    title: 'Midcap Momentum',
    desc: 'Curated, liquidity-screened midcap list. Tighter caps, wider slippage band.',
    meta: 'Risk: aggressive · Hooks: swap',
  },
  {
    tag: 'Perps',
    tagColor: 'text-red-600',
    title: 'Perps Midcap',
    desc: 'Midcap perp markets, max 3× leverage, mandatory exit leaves. Ships in v2.',
    meta: 'Risk: aggressive · Hooks: swap + perps',
  },
  {
    tag: 'Custom',
    tagColor: 'text-cyan-600',
    title: 'Custom',
    desc: 'Define your own bounds. Validated by the config service, activated via timelock.',
    meta: 'Risk: you decide · Hooks: any',
  },
];

const CONTROLS = [
  { k: 'Slippage', v: 'Every swap is checked against an oracle price. A trade that returns less than the bound reverts.' },
  { k: 'Size', v: 'Per-trade and per-asset notional caps. No single action can exceed them.' },
  { k: 'Venues & assets', v: 'Explicit allowlists. Unlisted routes and tokens are rejected before execution.' },
  { k: 'Leverage', v: 'A hard ceiling on perp exposure, enforced when the position opens.' },
  { k: 'Drawdown', v: 'Trading halts and positions unwind once losses pass a set threshold.' },
];

export default function HomeContent() {
  return (
    <main className="min-h-screen">
      <HelixHero />

      {/* The problem → API */}
      <section className="py-20 lg:py-48 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/40 mb-8">The problem</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-black mb-8 lg:mb-12">
            Execution controls are<br />undifferentiated work.
          </h2>
          <p className="text-xl lg:text-2xl text-black/60 leading-relaxed max-w-3xl mb-16 lg:mb-24">
            Most vault operators end up building the same execution plumbing: slippage
            checks, size limits, drawdown controls. It&apos;s undifferentiated work, and
            getting it wrong is expensive. We&apos;ve turned it into an API — submit a trade,
            the policy is enforced before execution, with hard bounds{' '}
            <span className="bg-black text-white px-3 py-1">verified by the vault contract itself</span>.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-black mb-8">How a trade flows</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">01</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Submit</p>
                    <p className="text-black/50">Your agent or script posts the trade to the API — one call per action.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">02</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Enforce</p>
                    <p className="text-black/50">The policy checks venue, size, slippage against an oracle, leverage, and exposure. Anything outside the bounds is rejected.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">03</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Verify &amp; settle</p>
                    <p className="text-black/50">The vault contract re-checks the hard bounds on-chain and settles — <span className="bg-black text-white px-2 py-0.5">no pass, no trade</span>.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-black mb-8">Two ways to plug in</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">&rarr;</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Bring your own vault</p>
                    <p className="text-black/50">Attach the policy to your existing Safe or smart account. Trades that breach it revert. No custody migration.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">&rarr;</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Spin up a vault</p>
                    <p className="text-black/50">Launch a non-custodial ERC-4626 vault with the policy set at creation. Capital stays in the contract, bounded by the policy.</p>
                  </div>
                </div>
              </div>

              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 mt-10 px-8 py-4 text-sm font-medium tracking-widest bg-black text-white hover:bg-gray-900 transition-all duration-300"
              >
                GET STARTED
                <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Authorized is not safe */}
      <section className="py-20 lg:py-48 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-8">Authorized is not safe</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
            Allowlisting the action<br /><span className="text-cyan-600">is not enough.</span>
          </h2>
          <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl mb-16 lg:mb-24">
            In January 2026, a vault lost $3.7M on a single swap:{' '}
            <span className="bg-gray-900 text-white px-3 py-1">3.84M in, 112K out</span>. No exploit —
            the trade was authorized and executed exactly as approved. Nothing verified what it
            returned. A function-level allowlist would have approved it too.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">Enforced on every trade</h3>
              <div className="space-y-5">
                {CONTROLS.map((c) => (
                  <div key={c.k} className="flex items-start gap-5">
                    <span className="text-cyan-600 font-mono text-sm font-semibold w-32 flex-shrink-0 pt-0.5">{c.k}</span>
                    <p className="text-gray-500 leading-relaxed">{c.v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">The check, on the real trade</h3>
              <div className="bg-gray-50 border border-gray-200 p-6 lg:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-6">Swap · stkGHO → USDC</p>
                <div className="space-y-3 text-sm font-mono">
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Input</span><span className="text-gray-800">3,840,651 stkGHO</span></div>
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Returned</span><span className="text-gray-800">112,036 USDC</span></div>
                  <div className="flex justify-between gap-4"><span className="text-gray-400">Oracle floor</span><span className="text-gray-800">≈ 3,801,000 USDC</span></div>
                  <div className="flex justify-between gap-4 pt-3 border-t border-gray-200">
                    <span className="text-gray-400">Result</span>
                    <span className="text-red-600 font-semibold">reverted — 97% below floor</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-4 leading-relaxed">
                The same trade that cost $3.7M in production fails the slippage check and never settles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Where enforcement lives */}
      <section className="py-20 lg:py-48 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-8">Architecture</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
            Enforcement is on-chain,<br />not in our servers.
          </h2>
          <p className="text-xl text-white/50 mb-16 lg:mb-24 max-w-2xl">
            The policy is committed to the vault contract. Bounds are re-verified on Base at
            execution — so a compromised key, a bad quote, or a broken agent still cannot move
            funds outside them.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">01</span>
                <div className="h-px flex-1 bg-white/10 group-hover:bg-emerald-400/50 transition-colors" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Vault</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                Non-custodial ERC-4626 over USDC. Deposit, receive shares, redeem against
                idle liquidity or the async queue. Or attach the policy to a Safe you already run.
              </p>
            </div>

            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">02</span>
                <div className="h-px flex-1 bg-white/10 group-hover:bg-emerald-400/50 transition-colors" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Policy</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                Size, slippage, venue, leverage, and drawdown bounds committed on-chain.
                Changes go through a <span className="text-emerald-400">24-hour timelock</span> depositors can see.
              </p>
            </div>

            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">03</span>
                <div className="h-px flex-1 bg-white/10 group-hover:bg-emerald-400/50 transition-colors" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">API</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                <span className="bg-white text-black px-2 py-0.5 font-mono font-medium">POST /trade/swap</span> —
                one call per action. MCP tools for agents. Wallet-signature auth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Policy templates */}
      <section className="py-20 lg:py-48 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-8">Policy templates</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
            Start from a risk profile.
          </h2>
          <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl mb-16 lg:mb-24">
            Compose your own bounds, or start from a maintained template. We version the
            leaf sets and publish vetted updates operators adopt through the timelock.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {TEMPLATES.map((t) => (
              <div key={t.title} className="border border-gray-200 p-6 lg:p-8 bg-gray-50">
                <div className={`text-[10px] uppercase tracking-widest ${t.tagColor} font-mono font-bold mb-3`}>{t.tag}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{t.desc}</p>
                <div className="text-xs text-gray-400 font-mono">{t.meta}</div>
              </div>
            ))}
          </div>

          <div className="mt-16 lg:mt-24 flex items-center justify-between flex-wrap gap-6">
            <p className="text-lg text-gray-500 max-w-xl">
              3rd place at the{' '}
              <span className="text-gray-900 font-semibold">Colosseum Solana Agent Hackathon</span>
              {' '}out of 454 projects. Now building on Base.
            </p>
            <Link
              href="/docs"
              className="group inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-widest bg-gray-900 text-white hover:bg-black transition-all duration-300"
            >
              READ THE API DRAFT
              <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
            </Link>
          </div>
        </div>
      </section>

      <WaitlistSection />
    </main>
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
    <section id="waitlist" className="py-20 lg:py-48 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-8">Pre-launch · Base mainnet beta</p>
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-8">
          Request access.
        </h2>
        <p className="text-xl text-white/50 mb-12 max-w-2xl mx-auto">
          Guarded launch: $25k TVL cap per vault, allowlisted operators, protocol guardian
          active. Independent audit before real TVL.
        </p>

        {status === 'done' ? (
          <p className="text-emerald-400 font-mono text-lg">You&apos;re on the list. We&apos;ll be in touch.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.xyz"
              className="flex-1 px-6 py-4 text-sm bg-white text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-medium tracking-widest bg-emerald-400 text-black hover:bg-emerald-300 transition-all duration-300 disabled:opacity-60 whitespace-nowrap"
            >
              {status === 'sending' ? 'SENDING…' : 'REQUEST ACCESS'}
              <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="text-red-400 font-mono text-sm mt-4">Something went wrong — try again.</p>
        )}
        <p className="text-xs text-white/30 font-mono mt-10">
          Legacy Solana devnet runtime is frozen — existing vaults are archived.
        </p>
      </div>
    </section>
  );
}
