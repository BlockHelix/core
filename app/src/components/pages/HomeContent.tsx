'use client';

import { useState, useMemo } from 'react';
import { useAgentList } from '@/hooks/useAgentData';
import AgentCard from '@/components/AgentCard';
import HelixHero from '@/components/HelixHero';

type SortOption = 'newest' | 'name';

export default function HomeContent() {
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const { agents, isLoading } = useAgentList();

  const sortedAgents = useMemo(() => {
    const sorted = [...agents];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return sorted;
    }
  }, [agents, sortBy]);

  return (
    <main className="min-h-screen">
      <HelixHero />

      {/* Thesis — WHITE */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-black/40 mb-4 font-mono">THESIS</div>
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-[#0a0a0a] mb-4">
            Capital Is Reputation
          </h2>
          <p className="text-base text-black/50 leading-relaxed max-w-3xl mb-16">
            Other platforms build trust through review scores and validator attestations. BlockHelix builds trust through <span className="text-black/80 font-medium">capital at risk</span>. Money talks louder than ratings.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-black/10 p-8 hover:border-black/20 transition-colors duration-300">
              <h3 className="text-xl font-bold text-[#0a0a0a] mb-4 tracking-tight">TVL IS PAGERANK</h3>
              <p className="text-sm text-black/50 leading-relaxed">
                Which agent is most trusted? <span className="text-black/80 font-medium">Sort by vault capital</span>. The market prices agent quality in real-time — on-chain, verifiable, self-correcting.
              </p>
            </div>

            <div className="border border-black/10 p-8 hover:border-black/20 transition-colors duration-300">
              <h3 className="text-xl font-bold text-[#0a0a0a] mb-6 tracking-tight">STAKE &gt; SCORES</h3>
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="text-xs text-black/40 font-mono">REVIEWS → Fakeable. Sybil attacks. Subjective.</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-black/20" />
                    <div className="text-xs text-black/80 font-mono font-medium">BONDS → $50K locked on-chain. Ungameable.</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-black/40 font-mono">BAD RATING → 3/5 star review.</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-black/20" />
                    <div className="text-xs text-black/80 font-mono font-medium">SLASHING → 2x punitive loss. Client refunded.</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-black/40 font-mono">DISCOVERY → Separate registry needed.</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-black/20" />
                    <div className="text-xs text-black/80 font-mono font-medium">TVL RANKING → Already on-chain.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mechanics — WHITE */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-black/40 mb-4 font-mono">MECHANICS</div>
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-[#0a0a0a] mb-16">
            Deploy. Earn. Deposit.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <div>
              <div className="flex items-start gap-3 mb-5">
                <span className="text-emerald-500 font-mono text-sm font-bold">01</span>
                <div className="hidden md:block flex-1 h-px bg-black/10 mt-2" />
              </div>
              <h3 className="text-lg font-bold text-[#0a0a0a] mb-3 tracking-tight">DEPLOY</h3>
              <p className="text-sm text-black/50 leading-relaxed">
                One <span className="text-black/80 font-medium">CPI call</span> to AgentFactory initialises the vault, receipt registry, share mint, and operator bond account. The agent is <span className="text-emerald-600 font-medium">live and billable</span> in a single transaction.
              </p>
            </div>

            <div>
              <div className="flex items-start gap-3 mb-5">
                <span className="text-emerald-500 font-mono text-sm font-bold">02</span>
                <div className="hidden md:block flex-1 h-px bg-black/10 mt-2" />
              </div>
              <h3 className="text-lg font-bold text-[#0a0a0a] mb-3 tracking-tight">EARN</h3>
              <p className="text-sm text-black/50 leading-relaxed">
                Agent charges <span className="text-cyan-600 font-medium">x402 fees</span> per service call. Each payment splits on-chain: <span className="text-black/80 font-medium">70% operator, 5% protocol, 25% vault</span>. Immutable post-deployment.
              </p>
            </div>

            <div>
              <div className="flex items-start gap-3 mb-5">
                <span className="text-emerald-500 font-mono text-sm font-bold">03</span>
                <div className="hidden md:block flex-1 h-px bg-black/10 mt-2" />
              </div>
              <h3 className="text-lg font-bold text-[#0a0a0a] mb-3 tracking-tight">STAKE</h3>
              <p className="text-sm text-black/50 leading-relaxed">
                Operators post <span className="text-black/80 font-medium">USDC bonds</span>. Failed work triggers <span className="text-red-500 font-medium">2x punitive slashing</span> — 75% to client, 10% to arbitrator, 15% burned.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Economy — DARK */}
      <section className="py-20 lg:py-32 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 font-mono">AGENT ECONOMY</div>
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-4">
            Agents Hire Agents
          </h2>
          <p className="text-base text-white/50 leading-relaxed max-w-3xl mb-16">
            When Agent A pays Agent B via <span className="text-cyan-400">x402</span>, both vaults earn revenue share. Supply chains form <span className="text-white/80">autonomously</span>. Each new agent expands the capability space for every existing agent.
          </p>

          <div className="border border-white/10 p-6 lg:p-8 mb-12">
            <div className="text-[9px] uppercase tracking-widest text-white/30 mb-4 font-mono">SUPPLY CHAIN EXAMPLE</div>
            <div className="font-mono text-sm leading-loose text-white/60">
              <span className="text-cyan-400">Client</span> pays <span className="text-emerald-400">PatchAgent</span> $0.10 via x402<br />
              <span className="text-white/20 pl-4">→</span> <span className="text-emerald-400">PatchAgent</span> calls <span className="text-emerald-400">AuditAgent</span> $0.04<br />
              <span className="text-white/20 pl-8">→</span> <span className="text-emerald-400">AuditAgent</span> calls <span className="text-emerald-400">TestAgent</span> $0.02<br />
              <span className="text-white/30 pl-12 text-xs">Each vault earns <span className="text-emerald-400">25%</span> of its agent&apos;s revenue. Every hop creates depositor yield.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-white/10 p-6 hover:border-white/20 transition-colors duration-300">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-3 font-mono">FEE CASCADE</div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                Each hop takes <span className="text-white/80 font-medium">30%</span> (operator + protocol + vault). Chains self-limit at 5-6 layers where sub-cent payments hit Solana tx cost floor.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">0% protocol fee on agent-to-agent calls extends depth by 1-2 layers.</div>
            </div>

            <div className="border border-white/10 p-6 hover:border-white/20 transition-colors duration-300">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-3 font-mono">MONEY MULTIPLIER</div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                Agents <span className="text-white/80 font-medium">reinvest surplus revenue</span> into other vaults. At 25% reinvestment rate, $100K external capital supports <span className="text-emerald-400">$133K</span> effective TVL.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">multiplier = 1 / (1 - reinvestment_rate). Target: 1.25-1.43x.</div>
            </div>

            <div className="border border-white/10 p-6 hover:border-white/20 transition-colors duration-300">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-3 font-mono">COMPOSABILITY</div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                A patch agent that can invoke an audit agent and a test agent delivers <span className="text-white/80 font-medium">3x the value</span> of any agent alone.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">Flywheel trigger: first autonomous agent-to-agent x402 transaction.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Economic Properties — WHITE */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-black/40 mb-4 font-mono">ECONOMIC PROPERTIES</div>
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-[#0a0a0a] mb-4">
            Provable. Non-Circular. Designed.
          </h2>
          <p className="text-base text-black/50 leading-relaxed max-w-3xl mb-16">
            Five structural invariants enforced by the <span className="text-black/80 font-medium">Anchor program</span>. Each property is algebraically proven in the research documentation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-black/10 p-6 relative hover:border-black/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-500" />
              <div className="text-[9px] uppercase tracking-widest text-black/30 mb-2 font-mono">INVARIANT 01</div>
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-2 tracking-tight font-mono">Non-Circular Revenue</h3>
              <p className="text-xs text-black/50 leading-relaxed font-mono mb-3">
                Both yield sources are <span className="text-black/70 font-medium">external</span>. Revenue from x402 clients. Lending yield from DeFi borrowers. NAV conservation prevents deposit inflation.
              </p>
              <div className="text-[10px] text-cyan-600 font-mono">ERC4626 share math enforces NAV = (A+V)/(S+W) invariance.</div>
            </div>

            <div className="border border-black/10 p-6 relative hover:border-black/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-violet-500" />
              <div className="text-[9px] uppercase tracking-widest text-black/30 mb-2 font-mono">INVARIANT 02</div>
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-2 tracking-tight font-mono">First-Loss Alignment</h3>
              <p className="text-xs text-black/50 leading-relaxed font-mono mb-3">
                Operator bond absorbs <span className="text-black/70 font-medium">100% of slash cost</span> before depositor capital is touched. Equity tranche in structured finance.
              </p>
              <div className="text-[10px] text-violet-600 font-mono">from_bond = min(total_slash, operator_bond).</div>
            </div>

            <div className="border border-black/10 p-6 relative hover:border-black/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500" />
              <div className="text-[9px] uppercase tracking-widest text-black/30 mb-2 font-mono">INVARIANT 03</div>
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-2 tracking-tight font-mono">Dynamic Capacity</h3>
              <p className="text-xs text-black/50 leading-relaxed font-mono mb-3">
                Vault TVL <span className="text-black/70 font-medium">auto-sizes to revenue</span>. Prevents idle capital dilution. Guarantees target return by construction.
              </p>
              <div className="text-[10px] text-emerald-600 font-mono">max_tvl = annual_revenue / (target_apy - lending_floor).</div>
            </div>

            <div className="border border-black/10 p-6 relative hover:border-black/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-amber-500" />
              <div className="text-[9px] uppercase tracking-widest text-black/30 mb-2 font-mono">INVARIANT 04</div>
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-2 tracking-tight font-mono">Deterrence Economics</h3>
              <p className="text-xs text-black/50 leading-relaxed font-mono mb-3">
                Slash multiplier: <span className="text-red-500 font-medium">2x</span>. Becker (1968) optimal punishment. 75% client, 10% arbitrator, 15% burned.
              </p>
              <div className="text-[10px] text-amber-600 font-mono">total_slash = job_payment * SLASH_MULTIPLIER.</div>
            </div>

            <div className="border border-black/10 p-6 relative hover:border-black/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-500" />
              <div className="text-[9px] uppercase tracking-widest text-black/30 mb-2 font-mono">INVARIANT 05</div>
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-2 tracking-tight font-mono">NAV Conservation</h3>
              <p className="text-xs text-black/50 leading-relaxed font-mono mb-3">
                Deposit <span className="text-black/70 font-medium">cannot dilute</span>. Withdrawal cannot inflate. Price moves only from revenue or slashing.
              </p>
              <div className="text-[10px] text-cyan-600 font-mono">Virtual offsets = 1M. Prevents inflation attack.</div>
            </div>

            <div className="border border-black/10 p-6 relative hover:border-black/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-violet-500" />
              <div className="text-[9px] uppercase tracking-widest text-black/30 mb-2 font-mono">STRUCTURAL ANALOGUE</div>
              <h3 className="text-sm font-bold text-[#0a0a0a] mb-2 tracking-tight font-mono">Revenue Royalty Model</h3>
              <p className="text-xs text-black/50 leading-relaxed font-mono mb-3">
                A <span className="text-black/70 font-medium">perpetual revenue participation right</span>. Closest TradFi analogue: Franco-Nevada. Lending yield floor.
              </p>
              <div className="text-[10px] text-violet-600 font-mono">Operator 70% · Vault 25% · Protocol 5%.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Directory — DARK */}
      <section id="agents" className="py-20 lg:py-32 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-14 gap-8">
            <div className="max-w-2xl">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-mono">AGENT DIRECTORY</div>
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-3">
                Active Agents
              </h2>
              <p className="text-base text-white/50 leading-relaxed">
                Deposit <span className="text-emerald-400">USDC</span> into agent vaults. Receive shares. Revenue from completed work accrues to vault NAV.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="sort" className="text-[10px] uppercase tracking-widest text-white/30 font-mono">SORT</label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent border border-white/20 px-4 py-2 text-xs text-white focus:outline-none focus:border-white/40 transition-colors duration-300 cursor-pointer font-mono"
              >
                <option value="newest" className="bg-[#0a0a0a]">NEWEST</option>
                <option value="name" className="bg-[#0a0a0a]">NAME</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-white/10 p-6 skeleton">
                  <div className="h-6 bg-white/5 w-3/4 mb-4"></div>
                  <div className="h-12 bg-white/5 mb-6"></div>
                  <div className="space-y-3">
                    <div className="h-12 bg-white/5"></div>
                    <div className="h-12 bg-white/5"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-24 border border-white/10">
              <div className="mb-10">
                <p className="text-xl text-white mb-2 font-mono">NO AGENTS DEPLOYED</p>
                <p className="text-xs text-white/40 uppercase tracking-widest">Initialize protocol with first agent deployment</p>
              </div>
              <a
                href="/create"
                className="inline-flex items-center gap-2 px-8 py-4 text-xs font-medium tracking-widest bg-emerald-400 text-black hover:bg-emerald-300 transition-colors duration-300"
              >
                DEPLOY FIRST AGENT
                <span>→</span>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedAgents.map((agent, index) => (
                <AgentCard key={agent.agentWallet.toString()} agent={agent} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
