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
              Enforcement is on-chain,<br />not in our servers.
            </h2>
            <p className="text-xl text-white/50 mb-16 lg:mb-24 max-w-2xl">
              The policy is committed to the vault contract. Bounds are re-verified on Base at
              execution, so a compromised key, a bad quote, or a broken agent still cannot move
              funds outside them.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            <Reveal delay={0}>
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">01</span>
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
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">02</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Policy</h3>
              <p className="text-lg text-white/60 leading-relaxed">
                Size, slippage, venue, leverage, and drawdown bounds committed on-chain.
                Changes go through a <span className="text-emerald-400">24-hour timelock</span> depositors can see.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-emerald-400 text-black font-mono text-lg font-bold w-12 h-12 flex items-center justify-center">03</span>
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
