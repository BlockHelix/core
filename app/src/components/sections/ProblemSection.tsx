import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';

export default function ProblemSection() {
  return (
    <>
      {/* The problem → API */}
      <section className="py-20 lg:py-48 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-400 mb-8">{'// The problem'}</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
              Your whitelist can&apos;t<br />see a bad trade.
            </h2>
            <p className="text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-3xl">
              Every automated vault runs the same first line of defense: whitelist the protocols,
              whitelist the functions. But a whitelist only checks <em>what</em> gets called, not{' '}
              <span className="bg-gray-900 text-white px-3 py-1">what it costs</span>. An approved
              swap can still fill far below oracle and settle exactly as authorized.
            </p>
          </Reveal>

          {/* Case study: the receipt */}
          <Reveal delay={0.1}>
            <a
              href="https://rekt.news/yo-protocols-slippage-bomb"
              target="_blank"
              rel="noopener noreferrer"
              className="group block max-w-3xl mt-10 lg:mt-14 border border-gray-300 bg-white hover:border-gray-900 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono">{'// Case · YO Protocol · Jan 2026'}</span>
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-400 font-mono group-hover:text-gray-900 transition-colors">
                  rekt.news
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                </span>
              </div>
              <div className="px-6 py-6">
                <p className="text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900 leading-snug">
                  “The swap didn&apos;t fail. It succeeded spectacularly, at doing exactly what the
                  broken parameters instructed.”
                </p>
                <p className="text-base text-gray-600 mt-5 leading-relaxed">
                  A $3.71M stkGHO→USDC rebalance returned{' '}
                  <span className="font-data font-semibold text-gray-900">112,036 USDC</span>. The
                  operator&apos;s own tooling supplied a broken quote, a slippage tolerance of
                  17,872,058 where a normal swap allows ~50, and disabled the check. A self-supplied
                  parameter can&apos;t catch itself; only an independent quote-vs-oracle check can.
                  The operator absorbed the loss and made depositors whole within hours.
                </p>
              </div>
            </a>
          </Reveal>

          <Reveal delay={0.15} className="max-w-3xl mt-10 lg:mt-14 mb-16 lg:mb-24">
            <div className="space-y-6 text-xl lg:text-2xl text-gray-600 leading-relaxed">
              <p>
                Controls that catch this (slippage bounds, size caps, drawdown halts) get rebuilt
                in-house, fund by fund, tangled into strategy code. They hold, until the strategy
                changes, the regime shifts, or the one path nobody re-tested fires at 3am. It&apos;s
                real engineering. It&apos;s just not your edge.
              </p>
              <p>
                So BlockHelix makes it infrastructure. Every trade gets an independent policy check
                before it executes: the quote against an oracle, not the operator&apos;s own number.
                The hard bounds are{' '}
                <span className="bg-gray-900 text-white px-3 py-1">re-verified by the vault itself on-chain</span>,
                and the audit trail is one your depositors can actually read. You keep the strategy;
                we keep the guardrails current.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            <Reveal>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">How a trade flows</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  <span className="text-gray-900 text-2xl font-bold font-mono">01</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Submit</p>
                    <p className="text-gray-500">Your agent or script posts the trade to the API, one call per action.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-gray-900 text-2xl font-bold font-mono">02</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Enforce</p>
                    <p className="text-gray-500">The policy checks venue, size, slippage against an oracle, leverage, and exposure. Anything outside the bounds is rejected.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-gray-900 text-2xl font-bold font-mono">03</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Verify &amp; settle</p>
                    <p className="text-gray-500">The vault contract re-checks the hard bounds on-chain and settles. <span className="bg-gray-900 text-white px-2 py-0.5">No pass, no trade</span>.</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">Two ways to plug in</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  <span className="text-gray-900 text-2xl font-bold">&rarr;</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Bring your own vault</p>
                    <p className="text-gray-500">Attach the policy to your existing Safe or smart account. Trades that breach it revert. No custody migration.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-gray-900 text-2xl font-bold">&rarr;</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Spin up a vault</p>
                    <p className="text-gray-500">Launch a non-custodial ERC-4626 vault with the policy set at creation. Capital stays in the contract, bounded by the policy.</p>
                  </div>
                </div>
              </div>

              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 mt-10 px-8 py-4 text-sm font-medium tracking-widest bg-gray-900 text-white hover:bg-black transition-all duration-300"
              >
                GET STARTED
                <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
