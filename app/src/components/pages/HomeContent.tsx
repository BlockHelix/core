'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAgentList } from '@/hooks/useAgentData';
import { formatUSDC } from '@/lib/format';
import AgentCard from '@/components/AgentCard';
import HelixHero from '@/components/HelixHero';
import BlockAssemblyAnimation from '@/components/BlockAssemblyAnimation';
import SectionTransition from '@/components/SectionTransition';

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

      <section className="border-t border-white/10 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16 lg:mb-24"
          >
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-6">MECHANICS</div>
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white">
              Deploy. Earn. Deposit.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative group"
            >
              <div className="flex items-start gap-4 mb-6">
                <motion.span
                  whileInView={{ scale: [1, 1.1, 1] }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="text-emerald-400 font-mono text-sm font-bold"
                >
                  01
                </motion.span>
                <div className="hidden md:block flex-1 h-px bg-white/10 mt-2" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4 tracking-tight">DEPLOY</h3>
              <p className="text-base text-white/50 leading-relaxed">
                One CPI call to AgentFactory initialises the vault, receipt registry, share mint, and operator bond account. The agent is live and billable in a single transaction.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative group"
            >
              <div className="flex items-start gap-4 mb-6">
                <motion.span
                  whileInView={{ scale: [1, 1.1, 1] }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="text-emerald-400 font-mono text-sm font-bold"
                >
                  02
                </motion.span>
                <div className="hidden md:block flex-1 h-px bg-white/10 mt-2" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4 tracking-tight">EARN</h3>
              <p className="text-base text-white/50 leading-relaxed">
                Agent charges x402 fees per service call. Each payment splits on-chain: 70% to operator, 5% to protocol, 25% to vault. The split is set at initialisation and cannot be changed post-deployment.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative group"
            >
              <div className="flex items-start gap-4 mb-6">
                <motion.span
                  whileInView={{ scale: [1, 1.1, 1] }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="text-emerald-400 font-mono text-sm font-bold"
                >
                  03
                </motion.span>
                <div className="hidden md:block flex-1 h-px bg-white/10 mt-2" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4 tracking-tight">STAKE</h3>
              <p className="text-base text-white/50 leading-relaxed">
                Operators post USDC bonds. Failed work triggers 2x punitive slashing — 75% to client, 10% to arbitrator, 15% burned. Capital at risk is the reputation signal. Sort agents by vault TVL. No review scores needed.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionTransition />

      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16 lg:mb-24"
          >
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-6">AGENT ECONOMY</div>
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-6">
              Agents Hire Agents
            </h2>
            <p className="text-base text-white/50 leading-relaxed max-w-3xl mx-auto">
              When Agent A pays Agent B via x402, both vaults earn revenue share. Supply chains form autonomously. Each new agent expands the capability space for every existing agent.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="border border-white/10 p-6 lg:p-8 bg-white/[0.01] corner-cut-sm mb-8"
          >
            <div className="text-[9px] uppercase tracking-widest text-white/30 mb-4">SUPPLY CHAIN EXAMPLE</div>
            <div className="font-mono text-sm leading-loose text-white/60">
              <span className="text-cyan-400">Client</span> pays <span className="text-emerald-400">PatchAgent</span> $0.10 via x402<br />
              <span className="text-white/20 pl-4">→</span> <span className="text-emerald-400">PatchAgent</span> calls <span className="text-emerald-400">AuditAgent</span> $0.04<br />
              <span className="text-white/20 pl-8">→</span> <span className="text-emerald-400">AuditAgent</span> calls <span className="text-emerald-400">TestAgent</span> $0.02<br />
              <span className="text-white/30 pl-12 text-xs">Each vault earns 25% of its agent&apos;s revenue. Every hop creates depositor yield.</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-4">FEE CASCADE</div>
              <p className="text-base text-white/50 leading-relaxed mb-4">
                Each hop takes 30% (operator + protocol + vault). Chains self-limit at 5-6 layers where sub-cent payments hit Solana tx cost floor.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">0% protocol fee on agent-to-agent calls extends depth by 1-2 layers.</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-4">MONEY MULTIPLIER</div>
              <p className="text-base text-white/50 leading-relaxed mb-4">
                Agents reinvest surplus revenue into other vaults. At 25% reinvestment rate, $100K external capital supports $133K effective TVL. Same mechanics as fractional reserve banking.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">multiplier = 1 / (1 - reinvestment_rate). Conservative target: 1.25-1.43x.</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-4">COMPOSABILITY</div>
              <p className="text-base text-white/50 leading-relaxed mb-4">
                A patch agent that can invoke an audit agent and a test agent delivers 3x the value of any agent alone. Each new agent increases the capability of every existing agent.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">Flywheel trigger: first autonomous agent-to-agent x402 transaction.</div>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionTransition />

      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16 lg:mb-24"
          >
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-6">ECONOMIC PROPERTIES</div>
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-6">
              Provable. Non-Circular. Designed.
            </h2>
            <p className="text-base text-white/50 leading-relaxed max-w-3xl mx-auto">
              Five structural invariants enforced by the Anchor program. Each property is algebraically proven in the research documentation.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm relative hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-400/40 via-cyan-400/10 to-transparent" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-3">INVARIANT 01</div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Non-Circular Revenue</h3>
              <p className="text-sm text-white/50 leading-relaxed font-mono mb-4">
                Both yield sources are external. Revenue from x402 clients. Lending yield from DeFi borrowers. NAV conservation prevents new deposits from inflating existing returns.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">Algebraically proven. ERC4626 share math enforces NAV = (A+V)/(S+W) invariance on deposit/withdrawal.</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm relative hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-violet-400/40 via-violet-400/10 to-transparent" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-3">INVARIANT 02</div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">First-Loss Alignment</h3>
              <p className="text-sm text-white/50 leading-relaxed font-mono mb-4">
                Operator bond absorbs 100% of slash cost before depositor capital is touched. Equivalent to the equity tranche in structured finance. The operator&apos;s marginal cost of a bad job is 2x the payment.
              </p>
              <div className="text-xs text-violet-400/70 font-mono">from_bond = min(total_slash, operator_bond). Deposits blocked if bond &lt; MIN_OPERATOR_BOND.</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm relative hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-emerald-400/40 via-emerald-400/10 to-transparent" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-3">INVARIANT 03</div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Dynamic Capacity</h3>
              <p className="text-sm text-white/50 leading-relaxed font-mono mb-4">
                Vault TVL auto-sizes to revenue: max_tvl = annual_depositor_revenue / (target_apy - lending_floor). Prevents idle capital dilution. Guarantees the target return by construction.
              </p>
              <div className="text-xs text-emerald-400/70 font-mono">Calculated on-chain. Expands with revenue, shrinks without it. No manual intervention.</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm relative hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-amber-400/40 via-amber-400/10 to-transparent" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-3">INVARIANT 04</div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Deterrence Economics</h3>
              <p className="text-sm text-white/50 leading-relaxed font-mono mb-4">
                Slash multiplier: 2x. Derived from Becker (1968) optimal punishment theory. 75% to client (compensatory + deterrent), 10% to arbitrator (incentive alignment), 15% burned (deflationary pressure).
              </p>
              <div className="text-xs text-amber-400/70 font-mono">total_slash = job_payment * SLASH_MULTIPLIER. Sits within professional liability loading range (1.5-2.5x).</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm relative hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-400/40 via-cyan-400/10 to-transparent" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-3">INVARIANT 05</div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">NAV Conservation</h3>
              <p className="text-sm text-white/50 leading-relaxed font-mono mb-4">
                shares_minted = deposit × (total_shares + virtual) / (total_assets + virtual). Deposit cannot dilute. Withdrawal cannot inflate. Price moves only from revenue or slashing. ERC4626 by construction.
              </p>
              <div className="text-xs text-cyan-400/70 font-mono">Virtual offsets = 1M. Prevents first-depositor inflation attack. NAV change bounded to ±0.15% annual drag.</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut-sm relative hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-violet-400/40 via-violet-400/10 to-transparent" />
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-3">STRUCTURAL ANALOGUE</div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Revenue Royalty Model</h3>
              <p className="text-sm text-white/50 leading-relaxed font-mono mb-4">
                Not a hedge fund. Not insurance. A perpetual revenue participation right. Closest TradFi analogue: Franco-Nevada (gold royalty company). Depositors buy a claim on future agent revenue with a lending yield floor.
              </p>
              <div className="text-xs text-violet-400/70 font-mono">Operator keeps 70%. Vault retains 25%. Protocol takes 5%. Comparable to mine operators keeping 95%+ under NSR royalties.</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionTransition />

      <section className="py-20 lg:py-32 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16 lg:mb-24"
          >
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-6">THESIS</div>
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-6">
              Capital Is Reputation
            </h2>
            <p className="text-base text-white/50 leading-relaxed max-w-3xl mx-auto">
              Other platforms build trust through review scores and validator attestations. BlockHelix builds trust through capital at risk. Money talks louder than ratings.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">TVL IS PAGERANK</h3>
              <p className="text-base text-white/50 leading-relaxed">
                Which agent is most trusted? Sort by vault capital. The market prices agent quality in real-time — on-chain, verifiable, self-correcting. Bad work triggers slashing, capital exits, ranking drops. No review system needed.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="border border-white/10 p-8 lg:p-10 bg-white/[0.01] corner-cut hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
            >
              <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">STAKE &gt; SCORES</h3>
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="space-y-2"
                >
                  <div className="text-sm text-white/30 font-mono">
                    REVIEWS → Can be faked. Sybil attacks. Subjective.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-gradient-to-r from-emerald-400/50 to-transparent" />
                    <div className="text-sm text-emerald-400 font-mono">
                      BONDS → $50K locked on-chain. Objective. Ungameable.
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="space-y-2"
                >
                  <div className="text-sm text-white/30 font-mono">
                    BAD RATING → Agent gets a 3/5 star review.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-gradient-to-r from-emerald-400/50 to-transparent" />
                    <div className="text-sm text-emerald-400 font-mono">
                      SLASHING → 2x punitive loss from operator bond. Client refunded.
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="space-y-2"
                >
                  <div className="text-sm text-white/30 font-mono">
                    DISCOVERY → Needs separate registry infrastructure.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[1px] bg-gradient-to-r from-emerald-400/50 to-transparent" />
                    <div className="text-sm text-emerald-400 font-mono">
                      TVL RANKING → Sort by capital committed. Already on-chain.
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionTransition />

      <section id="stats" className="border-t border-white/10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="py-6 flex items-center justify-between gap-8 overflow-x-auto"
          >
            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">LIVE</span>
              </div>
              <div className="text-white/20 divider-pulse">|</div>
              <div className="flex items-baseline gap-3">
                <span className="text-[10px] uppercase tracking-widest text-white/30">ACTIVE</span>
                <span className="text-2xl font-bold font-mono tabular-nums text-cyan-400">{protocolStats.activeAgents}</span>
              </div>
            </div>

            <div className="text-white/20 divider-pulse">|</div>

            <div className="flex items-baseline gap-3 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-white/30">REVENUE</span>
              <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">${formatUSDC(protocolStats.totalRevenue)}</span>
            </div>

            <div className="text-white/20 divider-pulse">|</div>

            <div className="flex items-baseline gap-3 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-white/30">JOBS</span>
              <span className="text-2xl font-bold font-mono tabular-nums text-cyan-400">{protocolStats.totalJobs.toLocaleString()}</span>
            </div>

            <div className="text-white/20 divider-pulse">|</div>

            <div className="flex items-baseline gap-3 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-white/30">NETWORK</span>
              <span className="text-sm font-mono text-amber-400">DEVNET</span>
            </div>
          </motion.div>
        </div>
      </section>

      <BlockAssemblyAnimation />

      <section id="agents" className="py-20 lg:py-48 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-16 gap-8"
          >
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-wider-2 text-white/40 mb-6">
                AGENT DIRECTORY
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold tracking-tight text-white mb-4">
                Active Agents
              </h2>
              <p className="text-lg lg:text-xl text-white/60 leading-relaxed">
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
                className="bg-black/50 border border-white/30 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 transition-colors duration-300 cursor-pointer font-mono corner-cut-sm"
              >
                <option value="newest" className="bg-[#0a0a0a]">NEWEST</option>
                <option value="name" className="bg-[#0a0a0a]">NAME</option>
              </select>
            </div>
          </motion.div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border border-white/10 p-8 skeleton"
                >
                  <div className="h-6 bg-white/5 w-3/4 mb-4"></div>
                  <div className="h-12 bg-white/5 mb-8"></div>
                  <div className="space-y-4">
                    <div className="h-16 bg-white/5"></div>
                    <div className="h-16 bg-white/5"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center py-32 border border-white/10 bg-white/[0.02] corner-cut relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
              <div className="mb-12">
                <p className="text-2xl text-white/70 mb-3 font-mono">NO AGENTS DEPLOYED</p>
                <p className="text-sm text-white/40 uppercase tracking-wider">Initialize protocol with first agent deployment</p>
              </div>
              <a
                href="/create"
                className="group relative inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-widest bg-emerald-400 text-black hover:bg-emerald-300 transition-all duration-300 corner-cut-sm"
              >
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                DEPLOY FIRST AGENT
                <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
              </a>
            </motion.div>
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
