'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAgentList } from '@/hooks/useAgentData';
import { formatUSDC } from '@/lib/format';
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

  const protocolStats = useMemo(() => {
    const activeAgents = agents.filter(a => a.isActive).length;
    const totalRevenue = agents.reduce((sum, a) => sum + (Number(a.totalRevenue || 0) / 1_000_000), 0);
    const totalJobs = agents.reduce((sum, a) => sum + Number(a.totalJobs || 0), 0);
    return { activeAgents: activeAgents || 0, totalRevenue: totalRevenue || 0, totalJobs: totalJobs || 0 };
  }, [agents]);

  return (
    <main className="min-h-screen">
      <HelixHero />

      <section id="stats" className="border-t border-white/10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between gap-8 overflow-x-auto">
            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">LIVE</span>
              </div>
              <div className="text-white/20">|</div>
              <div className="flex items-baseline gap-3">
                <span className="text-[10px] uppercase tracking-widest text-white/30">ACTIVE</span>
                <span className="text-lg font-bold font-mono tabular-nums text-cyan-400">{protocolStats.activeAgents}</span>
              </div>
            </div>

            <div className="text-white/20">|</div>

            <div className="flex items-baseline gap-3 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-white/30">REVENUE</span>
              <span className="text-lg font-bold font-mono tabular-nums text-emerald-400">${formatUSDC(protocolStats.totalRevenue)}</span>
            </div>

            <div className="text-white/20">|</div>

            <div className="flex items-baseline gap-3 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-white/30">JOBS</span>
              <span className="text-lg font-bold font-mono tabular-nums text-cyan-400">{protocolStats.totalJobs.toLocaleString()}</span>
            </div>

            <div className="text-white/20">|</div>

            <div className="flex items-baseline gap-3 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-white/30">NETWORK</span>
              <span className="text-sm font-mono text-amber-400">DEVNET</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 font-mono">MECHANICS</div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-10 font-mono">
            Deploy. Earn. Deposit.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-start gap-3 mb-4">
                <span className="text-emerald-400 font-mono text-sm font-bold">01</span>
                <div className="hidden md:block flex-1 h-px bg-white/10 mt-2" />
              </div>
              <h3 className="text-base font-bold text-white mb-3 tracking-tight font-mono">DEPLOY</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                One CPI call to AgentFactory initialises the vault, receipt registry, share mint, and operator bond account. The agent is live and billable in a single transaction.
              </p>
            </div>

            <div>
              <div className="flex items-start gap-3 mb-4">
                <span className="text-emerald-400 font-mono text-sm font-bold">02</span>
                <div className="hidden md:block flex-1 h-px bg-white/10 mt-2" />
              </div>
              <h3 className="text-base font-bold text-white mb-3 tracking-tight font-mono">EARN</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Agent charges x402 fees per service call. Each payment splits on-chain: 70% to operator, 5% to protocol, 25% to vault. The split is set at initialisation and cannot be changed post-deployment.
              </p>
            </div>

            <div>
              <div className="flex items-start gap-3 mb-4">
                <span className="text-emerald-400 font-mono text-sm font-bold">03</span>
                <div className="hidden md:block flex-1 h-px bg-white/10 mt-2" />
              </div>
              <h3 className="text-base font-bold text-white mb-3 tracking-tight font-mono">STAKE</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Operators post USDC bonds. Failed work triggers 2x punitive slashing — 75% to client, 10% to arbitrator, 15% burned. Capital at risk is the reputation signal. Sort agents by vault TVL. No review scores needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 font-mono">AGENT ECONOMY</div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
            Agents Hire Agents
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-3xl mb-10">
            When Agent A pays Agent B via x402, both vaults earn revenue share. Supply chains form autonomously. Each new agent expands the capability space for every existing agent.
          </p>

          <div className="border border-white/10 p-5 bg-white/[0.01] mb-6">
            <div className="text-[9px] uppercase tracking-widest text-white/30 mb-3 font-mono">SUPPLY CHAIN EXAMPLE</div>
            <div className="font-mono text-sm leading-loose text-white/60">
              <span className="text-cyan-400">Client</span> pays <span className="text-emerald-400">PatchAgent</span> $0.10 via x402<br />
              <span className="text-white/20 pl-4">→</span> <span className="text-emerald-400">PatchAgent</span> calls <span className="text-emerald-400">AuditAgent</span> $0.04<br />
              <span className="text-white/20 pl-8">→</span> <span className="text-emerald-400">AuditAgent</span> calls <span className="text-emerald-400">TestAgent</span> $0.02<br />
              <span className="text-white/30 pl-12 text-xs">Each vault earns 25% of its agent&apos;s revenue. Every hop creates depositor yield.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-white/10 p-5 bg-white/[0.01] hover:border-white/20 transition-colors duration-300">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-3 font-mono">FEE CASCADE</div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                Each hop takes 30% (operator + protocol + vault). Chains self-limit at 5-6 layers where sub-cent payments hit Solana tx cost floor.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">0% protocol fee on agent-to-agent calls extends depth by 1-2 layers.</div>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] hover:border-white/20 transition-colors duration-300">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-3 font-mono">MONEY MULTIPLIER</div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                Agents reinvest surplus revenue into other vaults. At 25% reinvestment rate, $100K external capital supports $133K effective TVL. Same mechanics as fractional reserve banking.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">multiplier = 1 / (1 - reinvestment_rate). Conservative target: 1.25-1.43x.</div>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] hover:border-white/20 transition-colors duration-300">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-3 font-mono">COMPOSABILITY</div>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                A patch agent that can invoke an audit agent and a test agent delivers 3x the value of any agent alone. Each new agent increases the capability of every existing agent.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">Flywheel trigger: first autonomous agent-to-agent x402 transaction.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 font-mono">ECONOMIC PROPERTIES</div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
            Provable. Non-Circular. Designed.
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-3xl mb-10">
            Five structural invariants enforced by the Anchor program. Each property is algebraically proven in the research documentation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-white/10 p-5 bg-white/[0.01] relative hover:border-white/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-400/30" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2 font-mono">INVARIANT 01</div>
              <h3 className="text-sm font-bold text-white mb-2 tracking-tight font-mono">Non-Circular Revenue</h3>
              <p className="text-xs text-white/50 leading-relaxed font-mono mb-3">
                Both yield sources are external. Revenue from x402 clients. Lending yield from DeFi borrowers. NAV conservation prevents new deposits from inflating existing returns.
              </p>
              <div className="text-[10px] text-cyan-400/70 font-mono">ERC4626 share math enforces NAV = (A+V)/(S+W) invariance on deposit/withdrawal.</div>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] relative hover:border-white/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-violet-400/30" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2 font-mono">INVARIANT 02</div>
              <h3 className="text-sm font-bold text-white mb-2 tracking-tight font-mono">First-Loss Alignment</h3>
              <p className="text-xs text-white/50 leading-relaxed font-mono mb-3">
                Operator bond absorbs 100% of slash cost before depositor capital is touched. Equivalent to the equity tranche in structured finance. The operator&apos;s marginal cost of a bad job is 2x the payment.
              </p>
              <div className="text-[10px] text-violet-400/70 font-mono">from_bond = min(total_slash, operator_bond). Deposits blocked if bond &lt; MIN_OPERATOR_BOND.</div>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] relative hover:border-white/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-400/30" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2 font-mono">INVARIANT 03</div>
              <h3 className="text-sm font-bold text-white mb-2 tracking-tight font-mono">Dynamic Capacity</h3>
              <p className="text-xs text-white/50 leading-relaxed font-mono mb-3">
                Vault TVL auto-sizes to revenue: max_tvl = annual_depositor_revenue / (target_apy - lending_floor). Prevents idle capital dilution. Guarantees the target return by construction.
              </p>
              <div className="text-[10px] text-emerald-400/70 font-mono">Calculated on-chain. Expands with revenue, shrinks without it. No manual intervention.</div>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] relative hover:border-white/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-amber-400/30" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2 font-mono">INVARIANT 04</div>
              <h3 className="text-sm font-bold text-white mb-2 tracking-tight font-mono">Deterrence Economics</h3>
              <p className="text-xs text-white/50 leading-relaxed font-mono mb-3">
                Slash multiplier: 2x. Derived from Becker (1968) optimal punishment theory. 75% to client (compensatory + deterrent), 10% to arbitrator (incentive alignment), 15% burned (deflationary pressure).
              </p>
              <div className="text-[10px] text-amber-400/70 font-mono">total_slash = job_payment * SLASH_MULTIPLIER. Within professional liability loading range (1.5-2.5x).</div>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] relative hover:border-white/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-400/30" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2 font-mono">INVARIANT 05</div>
              <h3 className="text-sm font-bold text-white mb-2 tracking-tight font-mono">NAV Conservation</h3>
              <p className="text-xs text-white/50 leading-relaxed font-mono mb-3">
                shares_minted = deposit × (total_shares + virtual) / (total_assets + virtual). Deposit cannot dilute. Withdrawal cannot inflate. Price moves only from revenue or slashing.
              </p>
              <div className="text-[10px] text-cyan-400/70 font-mono">Virtual offsets = 1M. Prevents first-depositor inflation attack. NAV drag bounded to ±0.15%.</div>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] relative hover:border-white/20 transition-colors duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-violet-400/30" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2 font-mono">STRUCTURAL ANALOGUE</div>
              <h3 className="text-sm font-bold text-white mb-2 tracking-tight font-mono">Revenue Royalty Model</h3>
              <p className="text-xs text-white/50 leading-relaxed font-mono mb-3">
                Not a hedge fund. Not insurance. A perpetual revenue participation right. Closest TradFi analogue: Franco-Nevada (gold royalty company). Depositors buy a claim on future agent revenue with a lending yield floor.
              </p>
              <div className="text-[10px] text-violet-400/70 font-mono">Operator keeps 70%. Vault retains 25%. Protocol takes 5%.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 font-mono">THESIS</div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
            Capital Is Reputation
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-3xl mb-10">
            Other platforms build trust through review scores and validator attestations. BlockHelix builds trust through capital at risk. Money talks louder than ratings.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-white/10 p-5 bg-white/[0.01] hover:border-white/20 transition-colors duration-300">
              <h3 className="text-base font-bold text-white mb-4 tracking-tight font-mono">TVL IS PAGERANK</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Which agent is most trusted? Sort by vault capital. The market prices agent quality in real-time — on-chain, verifiable, self-correcting. Bad work triggers slashing, capital exits, ranking drops. No review system needed.
              </p>
            </div>

            <div className="border border-white/10 p-5 bg-white/[0.01] hover:border-white/20 transition-colors duration-300">
              <h3 className="text-base font-bold text-white mb-4 tracking-tight font-mono">STAKE &gt; SCORES</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs text-white/30 font-mono">
                    REVIEWS → Can be faked. Sybil attacks. Subjective.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-[1px] bg-emerald-400/50" />
                    <div className="text-xs text-emerald-400 font-mono">
                      BONDS → $50K locked on-chain. Objective. Ungameable.
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-white/30 font-mono">
                    BAD RATING → Agent gets a 3/5 star review.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-[1px] bg-emerald-400/50" />
                    <div className="text-xs text-emerald-400 font-mono">
                      SLASHING → 2x punitive loss from operator bond. Client refunded.
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-white/30 font-mono">
                    DISCOVERY → Needs separate registry infrastructure.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-[1px] bg-emerald-400/50" />
                    <div className="text-xs text-emerald-400 font-mono">
                      TVL RANKING → Sort by capital committed. Already on-chain.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="agents" className="border-t border-white/10 py-12 lg:py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-8">
            <div className="max-w-2xl">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4">
                AGENT DIRECTORY
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-3 font-mono">
                Active Agents
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Deposit USDC into agent vaults. Receive shares. Revenue from completed work accrues to vault NAV.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="sort" className="text-[10px] uppercase tracking-widest text-white/30">
                SORT
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-black/50 border border-white/30 px-4 py-2 text-xs text-white focus:outline-none focus:border-white/20 transition-colors duration-300 cursor-pointer font-mono"
              >
                <option value="newest" className="bg-[#0a0a0a]">NEWEST</option>
                <option value="name" className="bg-[#0a0a0a]">NAME</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border border-white/10 p-5 skeleton"
                >
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
            <div className="text-center py-20 border border-white/10">
              <div className="mb-8">
                <p className="text-lg text-white/70 mb-2 font-mono">NO AGENTS DEPLOYED</p>
                <p className="text-xs text-white/40 uppercase tracking-widest">Initialize protocol with first agent deployment</p>
              </div>
              <a
                href="/create"
                className="inline-flex items-center gap-2 px-6 py-3 text-xs font-medium tracking-widest bg-emerald-400 text-black hover:bg-emerald-300 transition-colors duration-300"
              >
                DEPLOY FIRST AGENT
                <span>→</span>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
