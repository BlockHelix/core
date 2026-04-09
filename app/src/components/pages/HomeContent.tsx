'use client';

import HelixHero from '@/components/HelixHero';

export default function HomeContent() {

  return (
    <main className="min-h-screen">
      <HelixHero />

      {/* Deploy flow — 3 steps */}
      <section className="py-20 lg:py-48 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-black/40 mb-8">Three steps</p>
          <h2 className="text-4xl md:text-6xl lg:text-8xl font-bold tracking-tight text-black mb-8 lg:mb-12">
            Deploy. Fund.<br />Approve.
          </h2>
          <p className="text-xl lg:text-2xl text-black/60 leading-relaxed max-w-3xl mb-16 lg:mb-24">
            Your agent runs in an <span className="bg-black text-white px-3 py-1">isolated container</span>,
            with its own Solana wallet and a hard spending cap.
            It pays as it works. You stay in control.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-black mb-8">How it works</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">01</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Describe the task</p>
                    <p className="text-black/50">Write a prompt. Pick a budget in USDC. Set an approval threshold. Takes 30 seconds.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">02</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Fund the agent wallet</p>
                    <p className="text-black/50">Your agent spins up with its own Solana wallet. Send it USDC. That&apos;s the hard cap — it can&apos;t spend more than you fund.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">03</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Approve on Telegram</p>
                    <p className="text-black/50">Agent runs 24/7. Small spends settle automatically. Big spends ping you on Telegram — reply <span className="bg-black text-white px-2 py-0.5">YES 42</span> to approve.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-black mb-8">What it can do</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">&rarr;</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Run code &amp; shell commands</p>
                    <p className="text-black/50">Deploy repos, call APIs, process data, write scripts. OpenClaw runtime, persistent memory.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">&rarr;</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Pay for tools autonomously</p>
                    <p className="text-black/50">Web search, video generation, premium APIs. MPP + x402 payment rails. Every spend logged.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-black text-2xl font-bold">&rarr;</span>
                  <div>
                    <p className="text-lg font-semibold text-black">Report back via Telegram</p>
                    <p className="text-black/50">Chat with your agent, request approvals, pause or resume. No dashboard required.</p>
                  </div>
                </div>
              </div>

              <a
                href="/deploy"
                className="group inline-flex items-center gap-2 mt-10 px-8 py-4 text-sm font-medium tracking-widest bg-black text-white hover:bg-gray-900 transition-all duration-300"
              >
                DEPLOY AN AGENT
                <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* The insight */}
      <section className="py-20 lg:py-48 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-8">The insight</p>
          <h2 className="text-4xl md:text-6xl lg:text-8xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
            Agents need<br /><span className="text-cyan-600">wallets.</span>
          </h2>
          <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl mb-16 lg:mb-24">
            Every major payments company shipped an agent payment rail this year — Google, Visa, Stripe, Coinbase.
            Payments are solved. What&apos;s missing is the <span className="bg-gray-900 text-white px-3 py-1">custody layer</span>:
            a safe way for a human to hand an AI agent real money and a real job.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">Hard cap, not vibes</h3>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">
                Your agent&apos;s wallet IS the budget. It literally can&apos;t spend more
                than what you fund. Every tool, every API call, every transaction
                goes through preflight → approve → settle.
              </p>
              <div className="bg-gray-50 border border-gray-200 p-6 lg:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4">The safety stack</p>
                <ul className="space-y-3 text-sm text-gray-700 font-mono">
                  <li>1. Fund wallet with N USDC — hard cap.</li>
                  <li>2. Preflight every spend against BlockHelix.</li>
                  <li>3. Spends above threshold ping Telegram.</li>
                  <li>4. Operator replies YES/NO in chat.</li>
                  <li>5. Settle → logged, visible, auditable.</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">Without vs <span className="text-cyan-600">with</span> BlockHelix</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  <span className="text-red-400 text-2xl">✗</span>
                  <div>
                    <p className="text-lg text-gray-400 line-through">Share your API keys</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-cyan-600 text-2xl">✓</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Agent pays per call with its own wallet</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-red-400 text-2xl">✗</span>
                  <div>
                    <p className="text-lg text-gray-400 line-through">Hope the agent stays within limits</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-cyan-600 text-2xl">✓</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">On-chain wallet = <span className="bg-emerald-500 text-white px-2 py-0.5">hard cap</span></p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-red-400 text-2xl">✗</span>
                  <div>
                    <p className="text-lg text-gray-400 line-through">No idea what it spent money on</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <span className="text-cyan-600 text-2xl">✓</span>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Every spend logged + approvable</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment stack */}
      <section className="py-20 lg:py-48 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-8">Under the hood</p>
          <h2 className="text-4xl md:text-6xl lg:text-8xl font-bold tracking-tight text-white mb-6">
            Built on rails<br />agents already use.
          </h2>
          <p className="text-xl text-white/50 mb-16 lg:mb-24 max-w-2xl">
            Solana for settlement. MPP and x402 for machine-to-machine payments.
            No new standards to learn — if an API accepts a 402, your agent can pay for it.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">01</span>
                <div className="h-px flex-1 bg-white/10 group-hover:bg-emerald-400/50 transition-colors" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Wallet</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                KMS-backed Solana wallet per agent. You fund it with USDC.
                The wallet balance is the hard spending cap — no exceptions.
              </p>
            </div>

            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">02</span>
                <div className="h-px flex-1 bg-white/10 group-hover:bg-emerald-400/50 transition-colors" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Runtime</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                Isolated container on AWS Fargate with OpenClaw,
                web search, persistent memory, and direct shell access.
                Your agent runs 24/7.
              </p>
            </div>

            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">03</span>
                <div className="h-px flex-1 bg-white/10 group-hover:bg-emerald-400/50 transition-colors" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Payments</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                <span className="bg-white text-black px-2 py-0.5 font-mono font-medium">MPP</span> (Stripe) and{' '}
                <span className="bg-white text-black px-2 py-0.5 font-mono font-medium">x402</span> (Coinbase) supported.
                Both return <span className="text-emerald-400">402 Payment Required</span>, your agent handles the rest.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 lg:py-48 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-8">What people deploy</p>
          <h2 className="text-4xl md:text-6xl lg:text-8xl font-bold tracking-tight text-gray-900 mb-8 lg:mb-12">
            Real work.<br />Real budgets.
          </h2>
          <p className="text-xl lg:text-2xl text-gray-500 leading-relaxed max-w-3xl mb-16 lg:mb-24">
            Developer agents. Research agents. Trading agents. Data pipelines.
            Anything that runs 24/7, makes decisions, and pays for services.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="border border-gray-200 p-6 lg:p-8 bg-gray-50">
              <div className="text-[10px] uppercase tracking-widest text-cyan-600 font-mono font-bold mb-3">Dev</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Monitor my repo</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                &ldquo;Watch this GitHub repo, review PRs, run tests, comment with findings.&rdquo;
              </p>
              <div className="text-xs text-gray-400 font-mono">Budget: $20/mo · Tools: gh, npm, brave search</div>
            </div>

            <div className="border border-gray-200 p-6 lg:p-8 bg-gray-50">
              <div className="text-[10px] uppercase tracking-widest text-violet-600 font-mono font-bold mb-3">Research</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Competitive intel</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                &ldquo;Research the top 10 competitors to my startup and write a weekly report.&rdquo;
              </p>
              <div className="text-xs text-gray-400 font-mono">Budget: $10/wk · Tools: brave search, claude, s3</div>
            </div>

            <div className="border border-gray-200 p-6 lg:p-8 bg-gray-50">
              <div className="text-[10px] uppercase tracking-widest text-emerald-600 font-mono font-bold mb-3">DeFi</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Watch my position</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                &ldquo;Monitor my DeFi position, alert me if yield drops below 5%, propose exit.&rdquo;
              </p>
              <div className="text-xs text-gray-400 font-mono">Budget: $5/mo · Tools: rpc, telegram, jupiter</div>
            </div>

            <div className="border border-gray-200 p-6 lg:p-8 bg-gray-50">
              <div className="text-[10px] uppercase tracking-widest text-amber-600 font-mono font-bold mb-3">Content</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Twitter ghost</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                &ldquo;Read my drafts, post on schedule, reply to DMs, summarize engagement daily.&rdquo;
              </p>
              <div className="text-xs text-gray-400 font-mono">Budget: $15/mo · Tools: twitter api, claude, tg</div>
            </div>

            <div className="border border-gray-200 p-6 lg:p-8 bg-gray-50">
              <div className="text-[10px] uppercase tracking-widest text-red-600 font-mono font-bold mb-3">Data</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">ETL pipeline</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                &ldquo;Pull this API every hour, transform, push to my warehouse, alert on anomalies.&rdquo;
              </p>
              <div className="text-xs text-gray-400 font-mono">Budget: $30/mo · Tools: shell, curl, s3, telegram</div>
            </div>

            <div className="border border-gray-200 p-6 lg:p-8 bg-gray-50">
              <div className="text-[10px] uppercase tracking-widest text-cyan-600 font-mono font-bold mb-3">Build</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Your idea</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Give it shell access, a task, and a budget. It figures the rest out.
              </p>
              <div className="text-xs text-gray-400 font-mono">Budget: you decide · Tools: you decide</div>
            </div>
          </div>

          <div className="mt-16 lg:mt-24 flex items-center justify-between flex-wrap gap-6">
            <p className="text-lg text-gray-500 max-w-xl">
              3rd place ($15k) at the{' '}
              <span className="text-gray-900 font-semibold">Colosseum Solana Agent Hackathon</span>
              {' '}out of 454 projects.
            </p>
            <a
              href="/deploy"
              className="group inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-widest bg-gray-900 text-white hover:bg-black transition-all duration-300"
            >
              DEPLOY YOUR AGENT
              <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
