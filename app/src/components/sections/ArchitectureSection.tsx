import Reveal from '@/components/ui/Reveal';

export default function ArchitectureSection() {
  return (
    <>
      {/* Where enforcement lives: the one dark band */}
      <section className="py-20 lg:py-48 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.15em] font-mono text-gray-500 mb-8">{'// Architecture'}</p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
              The hard limits<br />are enforced on-chain.
            </h2>
            <p className="text-xl text-white/50 mb-6 max-w-2xl">
              The bounds that cap your risk are committed to the vault contract and re-verified
              on-chain at execution. Even if a key is compromised, a quote is bad, an agent breaks,
              or our own systems go down, funds cannot move outside them.
            </p>
            <p className="text-xl text-white/50 mb-16 lg:mb-24 max-w-2xl">
              That is the floor. The layer on top runs the checks a contract can&apos;t: price
              impact, exit liquidity, protocol risk, and volatility, scored on live data before an
              action is allowed through.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            <Reveal delay={0}>
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-[#adffd9] text-gray-900 font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">01</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Vault</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                Non-custodial ERC-4626 over USDC. Deposit, receive shares, redeem against
                idle liquidity or the async queue. Or attach the policy to a Safe you already run.
              </p>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-[#adffd9] text-gray-900 font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">02</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Policy</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                Size, slippage, venue, leverage, and drawdown bounds committed on-chain.
                Changes go through a <span className="text-[#adffd9]">24-hour timelock</span> depositors can see.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-[#adffd9] text-gray-900 font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">03</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">API</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                <span className="bg-white text-black px-2 py-0.5 font-mono font-medium">POST /trade/swap</span>,
                one call per action. MCP tools for agents. Wallet-signature auth.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
