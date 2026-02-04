# Real-World Capital Structures for Autonomous AI Agents

## From First Principles: Which Investment Models Actually Work and Why

---

## Abstract

This analysis examines nine real-world capital structures -- SAFEs, revenue-based financing, rolling funds, profit-sharing agreements, franchise models, hedge fund structures, income share agreements, cooperatives, and real estate syndications -- and evaluates each for applicability to tokenized autonomous AI agents selling services via x402 on Solana. The central finding is that agent vaults are best understood as a hybrid of **revenue-based financing** (the payback mechanic), **real estate syndication** (the GP/LP waterfall), and **cooperative patronage dividends** (the alignment model). The analysis produces a concrete hybrid design with specific parameters, addresses the capital efficiency problem (agents need ~$300 in runway, not $10,000), and identifies which mechanisms can be implemented on-chain today versus which require further research.

---

## 1. The Question We Are Actually Asking

Before examining capital structures, we need to be precise about what an agent vault is doing. The current implementation (programs/agent-vault/src/lib.rs) has three money flows:

1. **Revenue in**: Client pays for a service via x402. Fee split: `agent_fee_bps` to agent, `protocol_fee_bps` to protocol, remainder to vault. NAV per share increases.
2. **Capital in**: Depositor sends USDC, receives SPL shares proportional to NAV. NAV per share unchanged.
3. **Capital out**: Depositor burns shares, receives USDC proportional to NAV. NAV per share unchanged.

What is missing from the current implementation: **spend**. The agent has no on-chain mechanism to draw from the vault to fund operations. Revenue flows in, but the agent cannot deploy capital. This is not a minor omission -- it is the difference between "passive yield instrument" and "actively managed economic entity."

The question: when we add spend, what is the right economic model? Every model below is evaluated against a specific scenario:

```
Agent: Code patch agent
Revenue: $5 per patch via x402
Cost: ~$0.25 per patch (Claude API: ~50K input tokens, ~5K output)
Margin: ~95%
Monthly volume: 200 patches = $1,000 revenue
Monthly cost: $50 compute + $20 hosting = $70
Monthly profit: $930
Vault share (25% of revenue): $250/month accrues to depositors
Agent share (70%): $700/month to agent operator
Protocol share (5%): $50/month to BlockHelix
```

With these economics, the agent needs about **$70/month in operating capital** -- approximately $210 for a 3-month runway. An investor depositing $10,000 into this vault would earn $250/month on $10,000 = 2.5% monthly = 30% annualized. The capital is almost entirely idle. This is the core tension.

---

## 2. Model-by-Model Analysis

### 2.1 Y Combinator SAFEs

**How it actually works.** A SAFE (Simple Agreement for Future Equity) is a contract where an investor gives a startup cash now in exchange for equity later, at a discount or capped valuation. The investor does not receive shares immediately. Conversion is triggered by a future priced round, acquisition, or IPO.

Key mechanics:
- **Valuation cap**: Ceiling on the conversion price. If the cap is $10M and the startup raises Series A at $50M, the SAFE investor converts at the $10M price -- getting 5x more shares than the Series A investors per dollar.
- **Discount rate**: Typically 20%. SAFE investor pays 80% of the Series A price per share.
- **Post-money SAFEs (2018 update)**: Fixed the dilution ambiguity. A $500K investment at a $10M post-money cap gives exactly 5%, regardless of how many other SAFEs are raised.
- **No maturity, no interest**: Unlike convertible notes, SAFEs are not debt. They never "come due."

2024 market data from Carta: 61% of SAFEs use only a valuation cap, 30% use cap + discount, typical median cap is ~$10M for ~$1M raised.

YC's own standard deal: $500K total -- $125K converts at a fixed 7%, the other $375K goes on an uncapped MFN SAFE.

**Why SAFEs work for startups.** SAFEs solved a real problem: early-stage companies need money before they have enough data for a priced round. The conversion mechanic defers the hard valuation question. The lack of maturity dates eliminates "bridge loan panic." The simplicity (4 pages vs 40 for a convertible note) reduces legal costs.

**Why SAFEs do NOT work for agent vaults.**

The fundamental mismatch: SAFEs assume a future liquidity event (priced round, IPO, acquisition) that converts the instrument into equity. An autonomous agent has no such event on the horizon. There is no "Series A" for a code patch bot.

Specific problems:
1. **No conversion trigger.** An agent generates revenue indefinitely. There is no natural "priced round." What would conversion mean -- the agent becomes a different legal entity?
2. **The optionality problem.** SAFEs give investors optionality -- they participate in upside if the company becomes valuable, and lose only their investment if it doesn't. Agent vaults have bounded upside (revenue is predictable, not exponential) and bounded downside (backed by USDC). This is a debt-like return profile, not an equity-like one.
3. **No control rights.** SAFE holders have no board seats, no voting rights. This is fine for startups (the founder runs the company) but for agent vaults, depositors need some governance over spend -- the "CEO" is an algorithm.
4. **Dilution dynamics.** Each new SAFE dilutes existing SAFE holders. In agent vaults, NAV-based share math means new deposits don't dilute -- they are precisely neutral. This is a fundamentally different economic property.

**What we should take from SAFEs:** The simplicity. SAFEs replaced 40-page convertible notes with 4-page agreements. Agent vault shares should be equally simple: deposit USDC, receive shares proportional to NAV, burn shares to redeem at NAV. No complex conversion mechanics.

**Verdict: Poor fit.** SAFEs are optimized for high-variance, equity-upside scenarios. Agent vaults are low-variance, yield-generating instruments.

---

### 2.2 Revenue-Based Financing (Clearco, Pipe, Capchase)

**How it actually works.** An RBF provider advances capital to a business. The business repays a fixed percentage of monthly revenue until a predetermined multiple of the advance is repaid. Key terms:

- **Advance amount**: Typically 3-12x monthly recurring revenue (MRR). A SaaS company with $100K MRR might get $300K-$1.2M.
- **Revenue share %**: 5-15% of monthly gross revenue goes to repayment.
- **Payback cap/multiple**: Total repayment is capped at 1.3x-2.5x the advance. A $100K advance with a 1.5x cap means $150K total repayment.
- **No equity dilution**: The provider gets no shares, no board seats, no governance rights.
- **Variable duration**: If revenue grows, repayment is faster (and the provider's IRR is higher). If revenue shrinks, repayment slows (lower IRR, but the business survives).

Typical deal structure from real term sheets:
```
Advance:                  $500,000
Revenue share rate:       8% of monthly gross revenue
Payment cap:              $750,000 (1.5x multiple)
Minimum revenue threshold: $100,000/month
Term:                     5 years or until cap is reached
```

Platform comparison (real pricing):
- Clearco: 6-19% flat fee, 4-6 month terms, requires $100K+/month revenue
- Pipe: Marketplace model, institutional investors bid on revenue streams at discount
- Capchase: 4-12% fee, has pivoted to BNPL (Capchase Pay)

**Risk assessment -- what RBF investors actually look at:**
- MRR/ARR stability and growth rate
- Gross margins (must be high enough to absorb the revenue share)
- Net revenue retention (>100% means existing customers expand)
- Churn rate (<5% monthly is good)
- Customer concentration (no single customer >20% of revenue)
- Burn multiple (net burn / net new ARR)
- Cash runway

**Why RBF works.** The incentive alignment is elegant: the provider's return is directly linked to the business's revenue performance. If the business does well, the provider gets repaid faster (higher IRR). If the business struggles, payments shrink automatically -- no default risk from fixed payments. The business retains full ownership and control.

The RBF market is growing explosively: $5.77B in 2024, projected to reach $67.7B by 2029 (62.3% CAGR), reflecting genuine demand for non-dilutive capital.

**How this maps to agent vaults.**

This is the closest existing model. Consider the mapping:

```
RBF Provider              --> Vault Depositor
Business                  --> Autonomous Agent
Revenue share %           --> Vault retention rate (25%)
Advance amount            --> USDC deposit
Payback cap               --> ??? (currently undefined)
Revenue                   --> Agent revenue via x402
```

The match is strong but not perfect:

| RBF Property | Agent Vault | Match? |
|---|---|---|
| Advance repaid from revenue | Depositor yield from vault retention | Yes |
| Fixed payback cap (1.5x) | No cap -- shares appreciate indefinitely | No |
| Single lender relationship | Fungible, pooled shares | No |
| Revenue share is % of top-line | Vault retention is % of gross revenue | Yes |
| No equity, no governance | Shares represent NAV claim + potential governance | Partial |
| Term limit (5 years) | Perpetual | No |

**Critical insight: the missing payback cap.** In RBF, the investor's return is bounded. A 1.5x cap on a $100K advance means the investor gets $150K maximum. After that, the revenue share stops. The business keeps 100% of its revenue going forward.

Agent vaults have no such cap. Depositors hold shares indefinitely and earn a proportional share of all future vault retention. This is more like **equity** than RBF. But unlike equity, there is no upside from enterprise value growth -- only from revenue yield. The depositor gets equity-like perpetuity with debt-like returns. This is an awkward middle ground.

**What we should take from RBF:**
1. **The payback multiple concept.** Consider a mechanism where depositors can "cash out" at a predefined multiple (say 1.5x-2x), after which their shares convert to a reduced residual claim. This gives depositors a clear return target and the agent a path to "paying off" its investors.
2. **Revenue-linked variable payments.** The vault retention rate already does this -- when the agent earns more, more flows to the vault. This is the core mechanic of RBF and it works.
3. **Risk assessment metrics.** RBF providers evaluate MRR stability, churn, margins. Agent vaults should expose similar metrics on-chain: jobs/month, revenue/month, cost/job, revenue trend.

**Verdict: Strong fit (best single model).** The fundamental mechanic -- advance capital, repay from revenue share -- is almost exactly what the agent vault does. The gap is the missing payback cap and the perpetual share structure.

---

### 2.3 AngelList Rolling Funds

**How it actually works.** A rolling fund is a series of quarterly sub-funds. LPs subscribe to commit a fixed amount per quarter (say $25K). The fund manager deploys capital into deals each quarter. Key mechanics:

- **Quarterly subscription**: LPs commit per quarter, auto-renewing unless cancelled
- **Minimum commitment**: Some funds require 4+ quarters minimum
- **Capital rollover**: Undeployed capital rolls to the next quarter (no additional fees on rolled capital)
- **Carry calculation**: Calculated across the entire subscription period, not per quarter
- **Public fundraising**: 506(c) allows public solicitation, but only accredited investors
- **LP limit**: 97 accredited investors per rolling 4-quarter period, expandable with parallel fund structure
- **Management fee**: ~2% of called capital annually
- **Carry**: Typically 20%, with high-water mark

**Why rolling funds work.** They solved the "cold start" problem for emerging fund managers. Traditional VC funds require raising $5-50M upfront before deploying any capital. Rolling funds let managers start deploying immediately with smaller quarterly commitments. LPs get more flexibility -- they can increase, decrease, or cancel commitments quarterly.

**How this maps to agent vaults.**

The rolling fund model has interesting parallels:

```
Rolling Fund LP           --> Vault Depositor
Fund Manager (GP)         --> Agent Operator
Quarterly commitment      --> Ongoing deposit (but not time-locked)
Carry (20%)               --> Agent fee (70%)
Management fee (2%)       --> Protocol fee (5%)
Portfolio companies       --> Agent's revenue-generating capability
NAV                       --> Vault NAV per share
```

Key differences:
- Rolling funds invest in external companies (portfolio). Agent vaults invest in the agent itself.
- Rolling fund returns come from portfolio company exits. Agent vault returns come from ongoing revenue.
- Rolling fund NAV is mark-to-market (subjective). Agent vault NAV is USDC-denominated (objective).
- LPs in rolling funds commit to minimum quarters. Vault depositors can withdraw anytime.

**What we should take from rolling funds:**
1. **The subscription concept for recurring deployment.** Instead of one-time large deposits, consider a mechanism where depositors can set up recurring quarterly deposits. This matches the agent's ongoing capital needs better than lump sums.
2. **Capital rollover logic.** If the agent doesn't deploy all available capital in a period, it should roll forward without charging additional fees. The current vault design already does this implicitly (unspent USDC remains in the vault, accruing no fee drag).
3. **The 97-LP limit as a feature.** Rolling funds cap investors to maintain quality. Agent vaults might benefit from a depositor cap -- not for regulatory reasons, but to prevent whale concentration.

**Verdict: Moderate fit.** The subscription mechanics are interesting, but rolling funds solve a different problem (VC fund formation) from what agent vaults need (operational capital efficiency).

---

### 2.4 Profit-Sharing / Shared Earnings (Calm Company Fund, Indie.vc)

**How it actually works: Calm Company Fund's SEAL.**

The Shared Earnings Agreement (SEAL) is the most relevant model here. Actual terms:

- **Investment**: $75K-$250K, with ability to lead rounds up to $1M
- **Shared Earnings percentage**: A fixed % of "Founder Earnings" (Net Income + Founder Compensation), calculated quarterly
- **Founder Earnings Threshold**: Shared earnings payments only begin once founders pay themselves at least $X/year. Below that threshold, zero goes to investors.
- **Return cap**: Typically 3x the investment. Once the investor receives 3x back in shared earnings, ongoing cash payments stop.
- **Residual equity**: After the cap is reached, the investor retains a reduced equity stake (typically 2-3%, reduced from the initial ~6-7.5%).
- **Conversion option**: If the company raises a priced round, the SEAL converts to equity like a SAFE. The equity basis is the greater of unpaid return cap or original investment.
- **No control**: No board seat, no voting rights, no salary cap on founders.

Typical numbers: $150K investment, 10% shared earnings, $450K return cap (3x), 7% initial equity basis reducible to 2% after return cap is met.

**What happened to Indie.vc and why.** Indie.vc raised three funds investing through profit-sharing structures. It shut down in 2021. Root causes:

1. **LP misalignment.** Indie.vc's LPs were traditional VC fund-of-funds expecting VC-style returns (10x+). Profit-sharing generates 2-3x returns over 5-7 years -- good absolute returns but terrible for VC fund metrics (TVPI, DPI, IRR). When OATV tried to raise Fund IV focused on the Indie model, 80% of LPs walked.
2. **No mark-ups for fund metrics.** VC funds show paper returns through follow-on rounds at higher valuations. Indie portfolio companies, by design, often didn't raise follow-on rounds. No mark-ups = fund looks like it's underperforming to LPs.
3. **Blurred asset class.** LPs told Bryce Roberts: "We don't know where to bucket this." Not debt, not equity, not venture. LPs want clean categories for portfolio allocation.

Calm Company Fund learned from this. They restructured as a rolling subscription fund with individual LPs (entrepreneurs, not institutional fund-of-funds). They simplified the SEAL to "Shared Earnings + SAFE side letter." They target $75K-$250K checks, not $500K+.

**How this maps to agent vaults.**

The SEAL is remarkably close to what an agent vault should be:

```
SEAL Investor             --> Vault Depositor
Founder                   --> Agent Operator
Shared Earnings %         --> Vault retention rate
Founder Earnings Threshold --> Agent operating cost threshold
Return Cap (3x)           --> Payback cap on depositor returns
Residual equity           --> Reduced share claim post-cap
Conversion option         --> ??? (no equivalent)
```

The mapping is strong. The Founder Earnings Threshold is particularly elegant for agents: shared earnings should only accrue to depositors after the agent covers its operating costs. This prevents the pathological case where an agent earning $100/month but spending $90/month on compute sends $25 to depositors while running a $15 deficit.

**What we should take from the SEAL:**
1. **The Founder Earnings Threshold.** In agent terms: vault retention should only apply to net profit, not gross revenue. Or at minimum, there should be a cost floor below which revenue is not shared.
2. **The return cap (3x).** Depositors receive shared earnings until they have received 3x their deposit, then their claim reduces to a residual percentage. This solves the "perpetual equity vs bounded debt" problem identified in the RBF analysis.
3. **The no-control principle.** The SEAL explicitly gives investors no control over the business. For agent vaults, this means governance should be limited to parameter adjustment (fee rates, spend limits), not operational decisions.
4. **The quarterly calculation.** Shared earnings are calculated quarterly, not per-transaction. This smooths volatility and reduces gas costs for on-chain implementation.

**Verdict: Very strong fit.** The SEAL is the closest existing instrument to what an agent vault should be. The threshold, cap, and residual mechanics directly address the capital efficiency problem.

---

### 2.5 Franchise Model

**How it actually works.** A franchise is a licensed business system. The franchisor (e.g., McDonald's) develops the operating system, brand, and supply chain. The franchisee invests capital to operate a unit following the franchisor's system.

Economic structure:
- **Initial franchise fee**: $20K-$50K (one-time, for the right to use the system)
- **Ongoing royalty**: 4-12% of gross revenue (average 6.7%)
- **Marketing/ad fund**: 1-5% of gross revenue
- **Total investment**: $100K-$500K+ for most concepts (real estate, build-out, equipment, inventory)
- **Franchisor's role**: Provides brand, training, systems, supply chain, marketing
- **Franchisee's role**: Provides capital, local management, daily operations

Real returns:
- Typical annual ROI: 15-20% after year 2 (passive) to 30-50% (owner-operated)
- Payback period: 2-5 years depending on concept and investment level
- Break-even: 1-6 months for services, up to 12 months for restaurants

**Why franchises work.** The franchisor creates a repeatable system; the franchisee brings local capital and execution. The royalty aligns incentives -- the franchisor earns more when franchisees earn more. The system produces predictable, moderate returns with lower risk than starting from scratch.

**How this maps to agent vaults.**

```
Franchisor               --> Agent Creator / BlockHelix Protocol
Franchisee               --> Depositor
Franchise fee            --> ??? (currently no equivalent)
Royalty on revenue       --> Protocol fee (5%)
Brand/system             --> Agent code, training, x402 infrastructure
Local capital            --> USDC deposit
Daily operations         --> Autonomous agent execution
```

This mapping has a deep insight: **the agent creator is the franchisor**. They build the agent's capabilities (the "system"), and depositors provide capital to fund operations (like a franchisee funds a local unit). The protocol fee is the royalty -- BlockHelix earns a percentage of every transaction for providing the infrastructure.

But the analogy breaks in important ways:
1. **Franchisees do work.** They manage employees, serve customers, maintain the unit. Depositors in agent vaults do nothing after depositing. The agent operates autonomously.
2. **Franchise returns come from the franchisee's labor, not just capital.** A 30-50% ROI is justified because the franchisee is working 60+ hours/week. Agent vault depositors are providing purely passive capital.
3. **Franchisees have territorial exclusivity.** There's only one McDonald's per neighborhood. Agent vaults have no such exclusivity -- anyone can deploy the same agent code.

**What we should take from the franchise model:**
1. **The royalty as alignment mechanism.** The 5% protocol fee functions like a franchise royalty. It should be justified the same way: BlockHelix provides the infrastructure, marketplace, and trust layer. If the protocol isn't providing ongoing value, the royalty isn't justified.
2. **The distinction between system provider and capital provider.** The agent creator (system) and depositors (capital) are different roles with different claims. The current vault treats all value flows as a single split. A more nuanced model might give the agent creator a separate claim (like a franchise fee) for building the agent.
3. **Predictability metrics.** Franchise disclosure documents (FDDs) require detailed financial performance representations. Agent vaults should provide equivalent transparency: historical revenue, job volume, cost per job, uptime.

**Verdict: Moderate fit.** The franchisor/franchisee separation of roles is insightful, but the passive nature of vault depositors (vs active franchisees) limits the analogy.

---

### 2.6 Hedge Fund / Private Equity Structures

**How it actually works.** The "2 and 20" model:

- **Management fee (the "2")**: 2% of AUM annually, paid regardless of performance. Covers salaries, research, operations. Charged monthly (2%/12 per month).
- **Performance fee (the "20")**: 20% of profits above a hurdle rate. Only charged when the fund makes money.
- **Hurdle rate**: Typically 8%. The manager only earns performance fees on returns above 8%. On a 15% return year, the 20% performance fee applies to the 7% above the hurdle, not the full 15%.
- **High-water mark**: The fund must exceed its previous peak NAV before charging performance fees. If the fund drops 20% then rises 15%, no performance fee -- the fund hasn't recovered past losses yet.
- **GP contribution**: The GP typically invests 1-5% of fund capital (skin in the game).
- **Clawback**: If early profitable investments are followed by losses, the GP returns excess performance fees to LPs. Often escrowed until fund liquidation.
- **Lockup period**: LPs typically locked for 1-3 years. Withdrawals quarterly with 45-90 day notice.

Industry trends (2024-2025): Average fees have compressed to 1.5/15 for new launches. Institutional LPs increasingly demand hurdle rates, high-water marks, and clawback provisions.

**Why this works.** The performance fee aligns the manager's compensation with LP returns. The hurdle rate ensures the manager only profits from alpha (returns above what an index fund would deliver). The high-water mark prevents the manager from earning fees twice on the same dollar of return. The clawback ensures fairness across the fund's life.

**How this maps to agent vaults.**

```
GP (Fund Manager)        --> Agent Operator
LPs (Investors)          --> Vault Depositors
Management fee (2%)      --> Protocol fee (5%)
Performance fee (20%)    --> Agent fee (70%) -- but note this is MUCH higher
Hurdle rate (8%)         --> ??? (no equivalent currently)
High-water mark          --> ??? (no equivalent currently)
GP co-invest (1-5%)     --> ??? (agent creator has no capital at stake)
Clawback                 --> ??? (no equivalent currently)
```

**The 70% agent fee is extreme by hedge fund standards.** In a hedge fund, the GP takes 20% of profits. In the agent vault, the agent takes 70% of gross revenue. These are not directly comparable (agent fees cover compute costs), but the optics are stark. The depositor's claim on revenue is 25% (vault retention) vs 80% in a hedge fund (after 20% carry). This only works if agent vault yields dramatically exceed what depositors could earn elsewhere.

**What we should take from hedge fund structures:**
1. **The hurdle rate.** Vault depositors should earn a minimum return before the agent operator benefits. If USDC lending yields 5% on Aave, the hurdle should be at least 5%. Below that, why would depositors choose an agent vault over Aave?
2. **The high-water mark.** If the agent has a bad month and NAV declines, the agent should not earn fees on the "recovery" back to previous NAV. This prevents the agent from profiting from its own poor performance. Implementation: track peak NAV per share, only apply agent fee on revenue that creates new highs.
3. **GP co-investment.** The agent creator should have skin in the game -- deposit their own capital into the vault. This signals confidence and aligns incentives. On-chain, this could be tracked as a minimum creator deposit requirement.
4. **Clawback concept.** If the agent overspends in one epoch and destroys NAV, future revenue should first restore NAV before the agent takes its cut. This is a form of high-water mark applied to spend.

**Verdict: Strong fit for governance mechanisms.** The 2/20 structure itself doesn't map well (the fee ratios are wrong), but the protective mechanisms -- hurdle rate, high-water mark, co-investment, clawback -- are directly applicable and currently missing from the vault design.

---

### 2.7 ISAs (Income Share Agreements) / Lambda School

**How it actually works.** An ISA is a contract where a funder pays for someone's education/training in exchange for a percentage of their future income above a threshold.

Lambda School's terms:
- **Upfront cost**: $0 (ISA covers tuition)
- **Income threshold**: $50,000/year
- **Payment rate**: 17% of salary
- **Duration**: 24 months of qualifying payments
- **Cap**: $30,000 maximum total payment
- **Expiration**: ISA expires after 5 years if income never reaches threshold

**Why Lambda School failed (comprehensively):**

1. **The product didn't work.** Advertised 74-90% job placement rates; actual rates were 27-50%. If the thing you're funding doesn't produce income, an income-share agreement collects nothing.
2. **Adverse selection.** Students who would succeed regardless chose Lambda because it was "free." Students who needed the most help were least likely to repay. The ISA model attracts the wrong risk profile.
3. **Moral hazard.** Once students realized their ISA payments were 17% of income for 2 years regardless of what job they got, the incentive to get a high-paying tech job specifically (vs any job) diminished.
4. **It was actually debt.** The CFPB ruled in April 2024 that ISAs are loans, not innovative financing. Lambda/BloomTech was banned from student lending and fined.
5. **Misaligned incentives at the company level.** Lambda sold ISA receivables to hedge funds for upfront cash, disconnecting the school's revenue from student outcomes. The school was incentivized to enroll more students (more ISAs to sell), not to produce better outcomes.
6. **Every prior experiment failed.** Milton Friedman proposed ISAs in 1955. Yale tried them in the 1970s. Purdue in 2016. All abandoned them. The structural problems are inherent to the instrument, not the implementation.

**How this maps to agent vaults.**

```
ISA Funder               --> Vault Depositor (funds the agent's "training/deployment")
Student                  --> Agent
Income threshold         --> Minimum revenue threshold before sharing
Payment rate (17%)       --> Vault retention rate (25%)
Payment cap ($30K)       --> Return cap on deposits
Expiration (5 years)     --> ??? (no equivalent)
```

The mapping has a superficial appeal: depositors "fund the agent's deployment" in exchange for a share of future revenue. But Lambda School's failure modes are instructive:

**Failure modes that transfer to agent vaults:**
1. **If the agent doesn't produce revenue, depositors get nothing.** Unlike debt, there's no recourse. This is acceptable if deposits are small and risks are transparent.
2. **Adverse selection is less of a problem.** Agents don't choose to be funded -- depositors choose which agents to fund. The information asymmetry runs the other direction.
3. **Moral hazard is real.** An agent (or its operator) could route revenue through alternative channels to avoid vault retention. Mitigation: receipts tied to on-chain x402 payments.
4. **The "sell the receivable" temptation.** If agent vault shares become tradeable on secondary markets, the original depositor's outcome disconnects from agent performance. This is fine for liquid markets but creates information asymmetry.

**What we should take from ISAs (mostly what NOT to do):**
1. **Income threshold is good.** The agent should cover its operating costs before sharing revenue with depositors. This is the same insight from the SEAL analysis.
2. **Payment cap is good.** Bounded return expectations set appropriate investor expectations.
3. **Do NOT disconnect the funding from the outcome.** Lambda sold ISA receivables for immediate cash. Agent vault shares should represent a direct, ongoing claim on vault assets -- not a derivative that can be securitized away.
4. **Transparency is non-negotiable.** Lambda's fake job placement numbers directly caused its failure. Agent vaults must have verifiable, on-chain revenue and cost data.

**Verdict: Poor fit as a model, excellent as a cautionary tale.** The ISA mechanics are too similar to debt-with-equity-risk to be useful. But the failure modes map cleanly to agent vault risks.

---

### 2.8 Cooperative / DAO Models

**Traditional cooperatives that work:**

**REI** (consumer cooperative):
- 24 million members. $3.85B revenue (2023). Members pay a one-time $30 fee for lifetime membership.
- Patronage dividend: ~10% of qualifying purchases returned as store credit annually. Based on how much you spend (patronage), not how many shares you own.
- Governance: One member, one vote. Board elected by members.
- Why it works: Members shop at REI because they like the products. The patronage dividend is a bonus, not the primary value proposition. The cooperative structure drives customer loyalty.

**Mondragon Corporation** (worker cooperative):
- 80,000+ worker-owners. ~$12B revenue. Seventh-largest company in Spain.
- Structure: Workers are owners. Profits distributed as salary supplements proportional to each member's contribution (hours worked).
- Reserves: Mandatory allocation to reserves (non-distributable) for resilience.
- Pay ratio: Maximum pay ratio of 6:1 between highest and lowest paid worker (vs 300:1 at S&P 500 companies).
- Why it works: Workers have direct ownership stake, driving productivity and retention. The reserve requirement ensures long-term stability.

**Credit unions:**
- Member-owned financial cooperatives. Profits returned as better interest rates, lower fees, or patronage dividends.
- Why they work: Non-profit structure means surplus goes to members, not external shareholders. This creates genuinely better rates and builds loyalty.

**Crypto DAOs that work (and don't):**

**MakerDAO** (works):
- Dual token: MKR (governance) + DAI (stablecoin). MKR holders govern risk parameters.
- Revenue: Stability fees (interest on DAI loans). Revenue used to buy back and burn MKR.
- Why it works: MKR holders bear downside risk (MKR is minted and sold to cover bad debt), so they are incentivized to govern well. Revenue directly reduces MKR supply, increasing value.

**Lido DAO** (partially works):
- LDO token governs the liquid staking protocol. 10% fee on staking rewards split between node operators and treasury.
- Challenge: Voter participation declined from 88M LDO in Q4 2023 to 63M in Q4 2024. Governance is increasingly concentrated.
- Innovation: Dual governance module (June 2025) allows stETH holders to veto proposals via dynamic timelocks, giving users (not just token holders) a voice.

**Common DAO failure modes:**
- 72.5% of protocol-DAO treasuries are in native governance tokens (not stablecoins), creating circular value dependency
- Average voter participation: 17% of token holders. For major votes, leading DAOs get ~28%.
- Concentration: Top 5 DAOs hold 62.3% of all DAO treasury assets.

**How this maps to agent vaults:**

```
Cooperative Member       --> Vault Depositor + Agent User (ideally the same person)
Patronage dividend       --> Vault retention distributed to share holders
One member, one vote     --> Governance weighted by share ownership
Reserve fund             --> Minimum vault balance (not withdrawable)
```

**The key cooperative insight: patronage, not investment.** In a cooperative, returns are proportional to *use*, not *capital*. A REI member who spends $5,000 gets a larger dividend than one who spends $500, regardless of how many membership shares they own. This is fundamentally different from an investment model where returns are proportional to capital deployed.

For agent vaults, this raises a question: should depositors who also *use* the agent (send it jobs) receive preferential returns? This would align the cooperative principle of patronage with the vault's economics.

**What we should take from cooperatives/DAOs:**
1. **Reserve requirement.** A percentage of vault earnings should be locked as a reserve that cannot be withdrawn. Mondragon requires mandatory reserves. This prevents the death spiral of total withdrawal during downturns.
2. **Patronage-weighted returns.** Consider boosting returns for depositors who also generate revenue for the agent (i.e., they pay for the agent's services). This creates a flywheel: use the agent, earn more from the vault, use the agent more.
3. **One share, one vote governance.** For parameter changes (fee rates, spend limits, TVL caps), share-weighted voting is the natural governance mechanism. MakerDAO proves this works on-chain.
4. **The Lido dual governance model.** Give both depositors (capital providers) and users (revenue generators) governance voice. Depositors vote on economic parameters; users can veto changes that harm service quality.

**Verdict: Strong fit for governance and alignment.** The patronage dividend concept and reserve requirements are directly applicable. The governance models from MakerDAO and Lido provide tested on-chain implementations.

---

### 2.9 Real Estate Syndication / REIT

**How it actually works.** A GP (sponsor/operator) identifies a property, structures a deal, and raises capital from LPs. The GP contributes 5-10% of total equity; LPs contribute 90-95%.

The waterfall structure (most common):

```
Tier 1 -- Return of Capital:
  All cash flow first returns LP capital contributions.

Tier 2 -- Preferred Return (8%):
  LPs receive 8% annual return on their invested capital before the GP
  earns any promote. If the deal doesn't generate 8%, the GP gets nothing
  beyond the management fee.

Tier 3 -- GP Catch-Up:
  Once LPs have received their preferred return, the GP receives 100%
  of distributions until the GP has "caught up" to their share of total
  profits (typically 20%).

Tier 4 -- Profit Split (80/20):
  Remaining profits split 80% LP / 20% GP.

For high-performing deals (IRR tiers):
  - Below 8% IRR: 100% to LPs (after return of capital)
  - 8-12% IRR: 80/20 split (LP/GP)
  - 12-18% IRR: 70/30 split
  - Above 18% IRR: 60/40 split (GP gets more for exceptional performance)
```

Management and acquisition fees:
- Acquisition fee: 1-2% of purchase price
- Asset management fee: 1-2% of equity or gross revenue annually
- Property management fee: 4-8% of gross rental income
- Disposition fee: 1% of sale price

**Why syndications work.** The preferred return protects LPs from downside -- they get paid first. The waterfall aligns incentives -- the GP earns more only when LPs earn more. The GP co-investment ensures skin in the game. The catch-up provision motivates the GP to exceed the hurdle because they get a concentrated reward once they do.

**How this maps to agent vaults.**

```
GP (Sponsor)             --> Agent Creator/Operator
LPs (Investors)          --> Vault Depositors
Property                 --> Agent's revenue-generating capability
Rental income            --> Agent revenue via x402
Preferred return (8%)    --> Minimum depositor yield before agent fee applies
GP catch-up              --> Agent operator catches up after depositors are made whole
80/20 profit split       --> 25/70 split (vault/agent) -- but inverted
GP co-invest (5-10%)     --> Agent creator deposits into own vault
Acquisition fee          --> Agent deployment cost (paid by creator)
Property management fee  --> Protocol fee (5%)
```

**The waterfall is the most applicable mechanism.** Currently, the agent vault splits revenue simultaneously: 70% agent, 5% protocol, 25% vault. In a waterfall model, the split would be sequential:

```
Proposed Agent Vault Waterfall:

Step 1: Cover operating costs
  Revenue first covers agent's compute/hosting costs.
  (Like a property covering its mortgage and maintenance first.)

Step 2: Preferred return to depositors (8% annualized)
  After costs, revenue flows to depositors until they've earned
  their 8% annualized preferred return on deposited capital.

Step 3: Agent operator catch-up
  Once depositors have their preferred return, the agent operator
  receives distributions until their share equals their agreed %.

Step 4: Profit split
  Remaining revenue split according to the agreed ratio.
```

This waterfall structure solves the "why would I deposit when Aave pays 5%?" problem. If the preferred return is 8%, depositors know they get paid before the agent operator. The agent operator is incentivized to generate enough revenue to clear the hurdle and start earning their catch-up.

**What we should take from syndication:**
1. **The preferred return.** 8% annualized is the industry standard in RE syndication. Agent vaults should offer a preferred return that exceeds risk-free USDC lending rates (currently ~5% on Aave). An 8-10% preferred return is competitive.
2. **The waterfall structure.** Sequential distribution (depositors first, operator second) is a cleaner alignment model than simultaneous splits.
3. **GP co-investment.** The agent creator should deposit 5-10% of target TVL into their own vault. This is verifiable on-chain.
4. **IRR-tiered splits.** For high-performing agents, the operator earns a larger share. This incentivizes the operator to maximize performance, not just meet minimums.
5. **The promote as an incentive.** The GP's "promote" (carried interest above the preferred return) is powerful motivation. For agent operators, this could mean: if the vault generates >15% annualized return for depositors, the operator's share increases from 30% to 40% of excess profits.

**Verdict: Very strong fit.** The waterfall structure, preferred return, and GP co-investment are the most directly applicable mechanisms for agent vault design. This is the second-best model after RBF.

---

## 3. Synthesis: The Three Best-Fit Models

After analyzing all nine models, three stand out:

| Rank | Model | Why |
|---|---|---|
| 1 | **Revenue-Based Financing** | Core mechanic (advance capital, repay from revenue share) is almost identical to agent vault |
| 2 | **Real Estate Syndication** | Waterfall structure, preferred return, and GP co-investment solve the incentive alignment problem |
| 3 | **Calm Company Fund SEAL** | Threshold, return cap, and residual claim address capital efficiency directly |

Secondary contributions from:
- **Hedge funds**: Hurdle rate, high-water mark, clawback
- **Cooperatives**: Reserve requirements, patronage dividends, governance
- **Franchises**: System provider vs capital provider distinction, transparency requirements

---

## 4. The Hybrid Design: Agent Revenue Share Vault (ARSV)

Combining the best mechanisms from each model, here is a concrete design for the agent vault:

### 4.1 Core Structure

```
The Agent Revenue Share Vault (ARSV) is a pooled investment vehicle
where depositors provide USDC capital to an autonomous AI agent.
The agent uses capital to fund operations (compute, sub-agents).
Revenue from x402 service fees flows back through a waterfall
structure that prioritizes depositor returns.
```

### 4.2 The Waterfall (from RE Syndication)

Revenue flows through four sequential tiers:

```
TIER 0 -- Operating Reserve (from Cooperatives)
  5% of gross revenue is locked in a non-withdrawable reserve until
  reserve = 3 months of average operating costs.
  Purpose: Prevents death spiral during revenue downturns.
  On-chain: separate reserve token account, withdrawal blocked by program logic.

TIER 1 -- Operating Costs
  Agent draws from vault to cover compute, sub-agent fees, hosting.
  Subject to epoch budget constraint (from current design).
  Revenue remaining after costs = Net Operating Income (NOI).

TIER 2 -- Preferred Return to Depositors (from RE Syndication)
  NOI flows to depositors until they have earned an annualized
  preferred return of 8% on their deposited capital.
  Calculated daily, accrued and distributed per epoch (weekly).
  If NOI < preferred return, deficit accrues and must be made up
  in future epochs before agent operator earns anything.

TIER 3 -- Agent Operator Share
  After preferred return is met, remaining NOI splits:
  70% to agent operator
  25% to vault (additional yield for depositors above preferred return)
  5% to protocol (BlockHelix)

TIER 4 -- Performance Promote (from Hedge Funds)
  If annualized depositor return exceeds 15%, the split shifts:
  75% to agent operator (reward for exceptional performance)
  20% to vault
  5% to protocol
```

### 4.3 The Return Cap (from SEAL / RBF)

```
Each depositor has a return cap of 2x their deposit.

Example: Depositor puts in $1,000.
  After receiving $2,000 total (including original deposit), their
  share claim reduces to 25% of original. They keep 25% of their
  shares; the rest are burned.

This prevents:
  - Perpetual dilution of new depositors by early depositors
  - Idle capital accumulation past productive capacity
  - The "equity vs debt" ambiguity

After cap is hit:
  Depositor retains 25% of shares as a residual claim (from SEAL).
  They still earn proportional returns but at a reduced scale.
  They can withdraw at any time at NAV.
```

### 4.4 The Operating Threshold (from SEAL)

```
Vault retention (depositor yield) only activates after the agent's
monthly revenue exceeds its operating cost threshold.

Threshold = trailing 3-month average of (compute costs + hosting + sub-agent fees) * 1.2

The 1.2x multiplier ensures the agent maintains a margin buffer.

Below threshold: 100% of revenue goes to agent operations. Zero to vault.
Above threshold: waterfall applies to revenue above threshold.

This prevents:
  - Depositors earning yield while the agent is cash-flow negative
  - The agent being forced to share revenue it needs to survive
  - The death spiral where yield obligations bankrupt the agent
```

### 4.5 The High-Water Mark (from Hedge Funds)

```
Track peak NAV per share (NAV_hwm).

Agent operator's Tier 3 share only applies to revenue that creates
NEW NAV above NAV_hwm.

If NAV drops (due to agent spend exceeding revenue):
  Next revenue must first restore NAV to NAV_hwm.
  During recovery, all NOI goes to Tier 2 (depositor preferred return).
  Agent operator earns nothing until NAV_hwm is restored.

This prevents:
  - Agent operator profiting from self-inflicted NAV destruction
  - Depositors paying for the same return twice
  - Misaligned incentives around aggressive spending
```

### 4.6 Creator Co-Investment (from RE Syndication)

```
Agent creator must deposit >= 5% of target TVL into their own vault.

Example: Target TVL = $5,000. Creator deposits $250.
  Creator shares are locked for 6 months minimum.
  Creator earns the same returns as other depositors.
  Creator co-investment is displayed publicly on the vault dashboard.

This:
  - Signals confidence in the agent's economics
  - Gives the creator skin in the game
  - Is verifiable on-chain (specific share account linked to creator wallet)
```

### 4.7 TVL Cap (from DeFi Vault Capacity)

```
TVL cap = max(
  operating_costs_monthly * 6,      -- 6 months runway
  active_demand * cost_per_job * 2   -- 2x current demand capacity
)

For our reference agent:
  Operating costs: $70/month
  TVL cap = max($420, $200 * $0.25 * 2) = max($420, $100) = $420

Once TVL reaches the cap, no new deposits are accepted.
Existing depositors can withdraw and re-deposit (but only if TVL < cap).

If demand grows, TVL cap auto-adjusts upward.
If demand shrinks, TVL cap shrinks (but existing deposits are not forced out).
```

This addresses the core capital efficiency problem. An agent that needs $70/month in operating capital should not accept $10,000 in deposits. The TVL cap of ~$420 means depositors' capital is mostly productive, not idle.

### 4.8 Depositor Yield Model

Let's compute expected yields under this structure for our reference agent:

```
Agent: Code patch bot
Revenue: $1,000/month (200 patches at $5)
Operating costs: $70/month
TVL cap: $420 (6 months runway)
NOI: $1,000 - $70 = $930/month

Waterfall application:
  Tier 0 (Reserve 5%): $50/month until reserve = $210 (3 months costs)
    Reserve fills in ~4 months, then Tier 0 drops to zero.

  Tier 1 (Costs): $70/month

  Tier 2 (Preferred return 8% on $420):
    8% annually = 0.67%/month = $2.81/month
    Easily covered by NOI.

  Tier 3 (after preferred return met):
    Remaining NOI = $930 - $2.81 = $927.19/month
    25% to vault = $231.80/month
    70% to agent operator = $649.03/month
    5% to protocol = $46.36/month

  Total depositor return: $2.81 + $231.80 = $234.61/month on $420
  Annualized return: $234.61 * 12 / $420 = 670% APR

  Return cap hit: $420 * 2 = $840 total return
  Time to hit cap: $840 / $234.61 = 3.6 months
```

This reveals a critical insight: **with a tight TVL cap, depositor returns are extremely high but short-lived.** A depositor putting $420 into this vault would earn their 2x return cap in under 4 months. After that, their claim reduces to 25% of shares.

This might be the right answer. It means:
1. Capital flows in, earns a high return quickly, and largely flows out.
2. New depositors can enter as old ones hit their caps.
3. The agent is never burdened with large amounts of idle capital.
4. The effective "term" of a deposit is 3-6 months, similar to RBF timelines.

### 4.9 What If the Agent Needs More Capital?

The analysis above assumes a high-margin, low-cost agent. What about compute-intensive agents?

```
Agent: Research report agent (heavy Claude usage)
Revenue: $50 per report via x402
Operating costs: $20 per report (Claude API: ~500K input tokens, ~50K output)
Monthly volume: 50 reports = $2,500 revenue
Monthly costs: $1,000 compute + $50 hosting = $1,050
Monthly NOI: $1,450
Margin: 58%

TVL cap = max($1,050 * 6, $50 * $20 * 2) = max($6,300, $2,000) = $6,300

Waterfall:
  Tier 0 (Reserve): $125/month until reserve = $3,150
  Tier 2 (Preferred 8% on $6,300): $42/month
  Tier 3 remaining: $1,450 - $42 = $1,408
    25% to vault = $352/month
    Total depositor return: $42 + $352 = $394/month
    Annualized: $394 * 12 / $6,300 = 75% APR

  Return cap hit: $6,300 * 2 = $12,600
  Time to hit cap: $12,600 / $394 = 32 months (~2.7 years)
```

For a compute-heavy agent, the capital is more productive (higher TVL needed, longer time to cap), and the return is lower but still competitive. 75% APR is competitive with the best DeFi yield strategies (which typically offer 5-20% on stablecoins).

### 4.10 Agent-to-Agent Fee Handling

The fee cascade problem from multi-agent supply chains needs a specific solution:

```
Current problem:
  Client pays Agent A $10.
  Agent A pays Agent B $3 for sub-service.
  Agent B pays Agent C $1 for sub-sub-service.

  At each layer, the vault retention (25%) and protocol fee (5%) apply.
  Total fees extracted from the original $10:
    Layer 1: $10 * 30% = $3.00 in fees
    Layer 2: $3 * 30% = $0.90 in fees
    Layer 3: $1 * 30% = $0.30 in fees
    Total: $4.20 in fees on $10 of external revenue = 42% effective tax rate

Solution: Reduced fees on agent-to-agent transactions.

Proposed inter-agent fee schedule:
  External revenue (client -> agent): Standard split (70/5/25)
  Internal revenue (agent -> agent): Reduced split (85/5/10)
    Agent keeps 85% (needs it for operations)
    Protocol still gets 5% (infrastructure cost is the same)
    Vault gets 10% (reduced, since this is intermediate revenue)

Revised cascade:
  Layer 1: $10 * 30% = $3.00 in fees
  Layer 2: $3 * 15% = $0.45 in fees
  Layer 3: $1 * 15% = $0.15 in fees
  Total: $3.60 in fees = 36% effective tax rate

  Improvement: 6% reduction in effective tax rate.
  At deeper supply chains (5+ layers), the difference is larger.
```

Implementation: x402 receipts include a flag indicating whether the payer is another registered agent. The vault program checks the payer's identity against the agent registry to determine which fee schedule applies.

---

## 5. Parameter Recommendations

### 5.1 Fee Structure

| Parameter | Recommended Value | Justification |
|---|---|---|
| Agent operator share | 70% of gross revenue | Covers compute costs + operator margin. Competitive with 80% industry standard for service providers. |
| Protocol fee | 5% of gross revenue | Covers BlockHelix infrastructure. In line with franchise royalty (4-8%) and marketplace takes (5-15%). |
| Vault retention | 25% of gross revenue (external) / 10% (inter-agent) | Primary depositor yield source. 25% is aggressive but justified by small TVL cap. |
| Preferred return | 8% annualized | Industry standard from RE syndication. Exceeds Aave USDC lending rate (~5%). |
| Performance threshold | 15% annualized | Above this, operator gets a larger share. Rewards exceptional agents. |
| Return cap | 2x deposit | Depositor receives max 2x their capital. Balances bounded return with reasonable yield. Comparable to RBF multiples (1.3-2.5x). |
| Residual share | 25% of original shares post-cap | After 2x cap is hit, depositor retains 25% of shares. From SEAL model. |
| Operating reserve | 5% of revenue until 3 months of costs | From cooperative reserve requirements. Prevents death spiral. |

### 5.2 Governance Parameters

| Parameter | Recommended Value | Justification |
|---|---|---|
| Creator co-invest | >= 5% of TVL cap | From RE syndication GP co-invest. Skin in the game. |
| Creator lockup | 6 months | Prevents creator from depositing and immediately withdrawing. |
| Epoch length | 1 week (168 hours) | Balance between gas costs and responsiveness. Revenue and spend settle weekly. |
| Budget limit | Trailing 4-week average revenue * 0.6 | Revenue-linked model from governance analysis. Agent can spend 60% of recent revenue. |
| TVL cap | max(6 months costs, 2x demand capacity) | From capital efficiency analysis. Prevents idle capital accumulation. |
| Depositor cap | 50 depositors per vault | From rolling fund concept. Prevents whale concentration. |
| Withdrawal cooldown | 24 hours | Minimal friction, prevents sandwich attacks on revenue events. |

### 5.3 High-Water Mark Implementation

```
State variable: nav_high_water_mark (u64, 6 decimals)

On each revenue event:
  new_nav = vault_balance / total_shares
  if new_nav > nav_high_water_mark:
    nav_high_water_mark = new_nav
    // Agent operator earns Tier 3 share on (new_nav - old_hwm) * total_shares
  else:
    // Agent operator earns nothing from Tier 3
    // All NOI goes to Tier 2 (depositor preferred return)
    // Deficit accrues until NAV exceeds HWM
```

---

## 6. Comparison to Baseline Alternatives

Any depositor choosing the agent vault must believe it outperforms alternatives. Here are the honest comparisons:

### 6.1 USDC Lending (Aave/Compound)

```
Aave USDC supply rate (Jan 2026): ~5% APR
Risk: Smart contract risk, protocol risk
Effort: Zero (deposit and forget)
Liquidity: Instant withdrawal

Agent vault (reference agent):
  Projected: 75-670% APR (varies by agent)
  Risk: Agent performance risk, smart contract risk, operator risk
  Effort: Due diligence on agent quality
  Liquidity: 24-hour cooldown

Verdict: Agent vaults offer dramatically higher yields but with significantly
higher risk. This is appropriate for risk-tolerant capital, not savings.
```

### 6.2 Agent Without Vault (Self-Funded)

```
Agent operator funds their own $70/month costs.
Keeps 100% of net revenue: $930/month
Annual return on $840 self-funded capital: 1328% (!)

With vault (TVL cap $420, operator co-invests 5% = $21):
Operator's share: $649/month from Tier 3 + yield on $21 deposit
Annual return on $21: astronomical

Trade-off: Vault depositors provide runway insurance. The agent never runs
out of money even if revenue drops to zero for 6 months. The operator
gives up ~30% of revenue for this insurance.
```

### 6.3 Traditional VC (SAFE at $10M Cap)

```
Agent creator raises $500K SAFE at $10M cap.
Creator retains 95% ownership.
Investor gets 5% of future equity value.

Problem: What equity value? The agent has no exit path. There is no Series A,
no IPO, no acquisition target. The SAFE never converts. The investor's
$500K sits as a perpetual non-converting instrument.

Unless: The vault itself becomes the "company" that can be sold. But selling
an autonomous agent means transferring the agent_wallet keypair -- which
is a security nightmare.

Verdict: SAFEs are wrong for agents. Period.
```

### 6.4 Revenue-Based Financing (1.5x, 8% Share)

```
RBF provider advances $5,000 to agent operator.
Operator repays 8% of monthly revenue until 1.5x ($7,500) is repaid.
Monthly payment: $1,000 * 8% = $80
Time to repay: $7,500 / $80 = 94 months (7.8 years!)

This is terrible economics. The agent's revenue is too small for
traditional RBF terms. RBF providers require $100K+/month revenue.

The agent vault model (with TVL cap) is actually MORE efficient than
RBF for small-scale agents because the TVL cap keeps deposits
proportional to the agent's actual capital needs.
```

---

## 7. What's Actually New Here

After examining all nine models, the honest answer to "is this a new primitive?" is: **partially**.

**What is NOT new:**
- NAV-based share math (from ERC-4626 / mutual funds)
- Revenue sharing (from RBF / cooperatives)
- Waterfall distributions (from RE syndication)
- Return caps (from SEAL / RBF)
- High-water marks (from hedge funds)
- On-chain governance (from DAOs)

**What IS new:**
1. **The operator is an algorithm, not a human.** Every other model assumes human decision-making. An agent's spend decisions are programmatic, which enables much tighter, more frequent governance (per-epoch budget constraints vs quarterly board meetings).
2. **Revenue is granular and verifiable.** x402 receipts provide per-transaction revenue data on-chain. No other investment model has this level of transparency. This eliminates the information asymmetry that plagues every model above.
3. **Capital needs are tiny and precise.** Most agents need $100-$6,000, not millions. This changes the depositor profile from institutional investors to individuals.
4. **Composability.** Agent vault shares are SPL tokens. They can be used as collateral, traded on DEXes, or held by other agent vaults. An agent vault holding shares in its sub-agent's vault creates a supply chain of aligned incentives -- something no traditional model supports.
5. **TVL cap as a feature.** In every traditional model, more capital is better (or neutral). In agent vaults, excess capital is actively harmful (dilutes yield). The TVL cap inverts the standard logic.

The combination of these properties -- algorithmic operator, verifiable per-transaction revenue, tiny capital needs, composable shares, and inverse capital efficiency -- does constitute something new. Whether it needs a new name ("Autonomous Revenue Entity") or is better described as "revenue-sharing vault with waterfall" is a branding question, not an economic one.

---

## 8. Implementation Priority

### MVP (Ship Now)

1. **Add spend instruction to vault program.** The agent needs to draw USDC from the vault to pay for compute. This is the critical missing piece. Budget constraint: `epoch_spend <= budget_per_epoch`. Set `budget_per_epoch` at initialization.

2. **TVL cap.** Add `max_tvl` field to VaultState. Reject deposits when `vault_usdc_account.amount >= max_tvl`. Simple, high-impact.

3. **Operating reserve.** Add `reserve_account` separate from `vault_usdc_account`. 5% of revenue flows to reserve until `reserve_balance >= operating_costs * 3`. Reserve is not withdrawable by depositors.

4. **Creator co-investment.** Track creator's deposit in VaultState. Display on dashboard. No lockup enforcement in MVP (trust-based).

### V2 (Next Phase)

5. **Waterfall distribution.** Replace simultaneous fee split with sequential waterfall. Requires tracking accrued preferred return per depositor (more complex state management).

6. **High-water mark.** Add `nav_high_water_mark` to VaultState. Modify `receive_revenue` to check NAV against HWM before applying agent operator share.

7. **Return cap.** Track total returns per depositor. When returns exceed 2x deposit, burn 75% of their shares. Requires per-depositor state (significant complexity increase).

8. **Inter-agent fee schedule.** Differentiate fee split based on payer identity. Requires integration with agent registry.

### V3 (Research Required)

9. **Revenue-linked budget adjustment.** Automatic budget increases/decreases based on trailing revenue. Requires careful mechanism design to avoid pro-cyclical death spirals.

10. **Depositor governance.** Share-weighted voting on parameter changes. Requires governance module (Snapshot-like off-chain voting with on-chain execution, or full on-chain governance).

11. **Cross-vault composability.** Agent A's vault holds shares in Agent B's vault. Revenue attribution through the supply chain. Requires graph-based accounting.

---

## 9. Open Questions

1. **Is the 25% vault retention rate optimal?** At small TVL caps, it produces very high yields (670% APR). At larger caps, it produces moderate yields (75% APR). Should it be variable based on TVL?

2. **What's the right return cap multiple?** 2x is moderate (RBF ranges from 1.3x to 2.5x). For higher-risk agents, should it be 3x? For proven agents, 1.5x?

3. **How does the waterfall interact with deposit timing?** If Alice deposits at NAV = $1.00 and Bob deposits at NAV = $1.50, Alice has earned 50% return already. Does the preferred return calculation use deposit price or current NAV? (Answer: it should use deposit price, but this requires per-depositor state.)

4. **Can the operating threshold be gamed?** An agent operator could inflate costs (pay themselves for fake compute) to keep revenue below threshold and avoid sharing with depositors. Mitigation: costs must be verified x402 payments to registered services.

5. **What happens when all depositors hit their return caps simultaneously?** If the vault has no depositors (all capped out), revenue stops flowing to the vault entirely. New depositors need to enter, but there's no incentive if the agent is already "funded." Solution: reduce fees but don't eliminate -- 5% vault retention even after all caps are hit, to attract new depositors.

6. **Should agents be able to issue bonds instead of shares?** A fixed-term, fixed-rate bond (e.g., deposit $1,000, receive $1,150 in 6 months) might be simpler and more familiar to depositors than NAV-based shares.

7. **Regulatory classification.** Is a vault share a security? The Howey test asks: (1) investment of money, (2) in a common enterprise, (3) with expectation of profits, (4) derived from efforts of others. Agent vault shares likely satisfy all four prongs. This needs legal analysis, not economic analysis.

---

## 10. References

### SAFEs
- [YC SAFE Financing Documents](https://www.ycombinator.com/documents)
- [Post-Money SAFE Guide](https://promise.legal/startup-legal-guide/funding/post-money-safe)
- [SAFE Note Definition & Calculation](https://www.wallstreetprep.com/knowledge/safe-note/)
- [SAFE Caps and Discounts](https://www.equidam.com/safe-caps-and-discounts-setting-the-right-terms-for-your-round/)
- [SAFE Numerical Examples (FundersClub)](https://fundersclub.com/learn/safe-primer/safe-numerical-examples/safe-cap-and-discount/)

### Revenue-Based Financing
- [RBF Term Sheet Guide (Onramp Funds)](https://www.onrampfunds.com/resources/revenue-based-financing-term-sheet-guide)
- [Founder's Guide to RBF (Capchase)](https://www.capchase.com/blog/revenue-based-financing)
- [RBF Overview (Corporate Finance Institute)](https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/revenue-based-financing/)
- [Clearco Revenue-Based Financing](https://www.clear.co/blog/revenue-based-financing)
- [RBF Market Report 2025 (Research and Markets)](https://www.researchandmarkets.com/reports/5896195/revenue-based-financing-market-report)
- [RBF in 2025 (Arc)](https://www.joinarc.com/guides/revenue-based-financing)

### Rolling Funds
- [What Are Rolling Funds (AngelList)](https://help.angellist.com/hc/en-us/articles/35656966936589-What-are-Rolling-Funds)
- [LP Subscriptions (AngelList)](https://help.angellist.com/hc/en-us/articles/360048254832-How-do-LP-subscriptions-work)
- [Rolling Fund Budget Guide (AngelList)](https://www.angellist.com/blog/rolling-fund-budget)
- [AngelList Pioneers Rolling VC Funds (TechCrunch)](https://techcrunch.com/2020/09/08/angellist-pioneers-rolling-vc-funds-in-pivot-to-saas/)

### Profit-Sharing / SEAL
- [Shared Earnings Agreement (Calm Company Fund)](https://calmfund.com/shared-earnings-agreement)
- [SEAL for Investors Comparison (Calm Company Fund)](https://calmfund.com/writing/for-investors-what-is-a-shared-earnings-agreement-and-how-does-it-compare-to-a-safe)
- [Calm Company Fund Term Sheet](https://calmfund.com/term-sheet)
- [Shared Earnings + SAFE (Calm Company Fund)](https://calmfund.com/writing/shared-earnings-safe)
- [Indie.vc Shut Down (Axios)](https://www.axios.com/2021/03/03/indievc-venture-capital-investment-shut-down)
- [Indie.vc Vision Lives On (The Hustle)](https://thehustle.co/03082021-indie-vc)
- [Biggest Misunderstanding About Indie.vc (Bryce Roberts / Medium)](https://medium.com/strong-words/the-biggest-misunderstanding-about-indie-vc-6de1f8232f27)

### Franchise Economics
- [Understanding Franchisee ROI (Franchise Beacon)](https://www.franchisebeacon.com/understanding-franchisee-return-on-investment/)
- [Franchise ROI: Aim for 30-50% Per Year](https://learn2franchise.com/franchise-roi-annual-rate-of-return/)
- [What Are Franchise Royalty Fees (IFPG)](https://www.ifpg.org/buying-a-franchise/what-are-franchise-royalty-fees)
- [Franchise Fees by Industry 2025 (Franchise Ki)](https://franchiseki.com/blogs/franchise-fees-by-industry-2025-comparison)
- [Franchise Fees Explained (SBA)](https://www.sba.gov/blog/franchise-fees-why-do-you-pay-them-how-much-are-they)

### Hedge Fund Structures
- [2 and 20 Fee Structure (Corporate Finance Institute)](https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/2-and-20-hedge-fund-fees/)
- [High-Water Mark (Corporate Finance Institute)](https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/high-water-mark/)
- [Hedge Fund Fee Structure Explained (Finance Train)](https://financetrain.com/hedge-fund-fee-structure-high-water-mark-and-hurdle-rate)
- [GP Clawback Provisions (Reinhart Law)](https://www.reinhartlaw.com/news-insights/general-partner-clawback-provisions-private-equity-agreements)
- [PE Waterfalls, Clawbacks, Catch-Ups Explained (FNRP)](https://fnrpusa.com/blog/waterfalls-clawbacks-catch-up-clauses-three-private-equity-terms-explained/)

### ISAs / Lambda School
- [Fast Crimes at Lambda School](https://www.sandofsky.com/lambda-school/)
- [Lambda School Woes (Class Central)](https://www.classcentral.com/report/lambda-school-woes/)
- [CFPB Settlement (The Verge)](https://wallscorp.us/content/2024/04/18/lambda-school/)
- [ISAs and Predatory Lending (Protect Borrowers)](https://protectborrowers.org/what-we-do/predatory-lending-private-credit/private-student-lending/income-share-agreements/)

### Cooperatives / DAOs
- [Cooperative Economics (Wikipedia)](https://en.wikipedia.org/wiki/Co-operative_economics)
- [Cooperative Equity, Income, and Patronage](https://jrwiener.com/cooperative-equity-capital-income-and-patronage-how-they-work-together/)
- [How Worker Co-ops Share Profits (CDI)](https://cdi.coop/profit-sharing-in-worker-coops/)
- [Mondragon Cooperative (Participedia)](https://participedia.net/case/82)
- [Lido DAO Treasury Management Proposal](https://research.lido.fi/t/proposal-to-approve-lido-dao-treasury-management-principles-and-authorize-the-formation-of-a-treasury-management-committee/4279)
- [DAO Tokenomics Guide (Rapid Innovation)](https://www.rapidinnovation.io/post/comprehensive-guide-dao-tokenomics-key-strategies-best-practices-effective-incentive-structures)
- [DAO Treasury Statistics 2025 (CoinLaw)](https://coinlaw.io/dao-treasury-holdings-statistics/)

### Real Estate Syndication
- [RE Syndication Structure Explained (Willowdale Equity)](https://willowdaleequity.com/blog/real-estate-syndication-structure/)
- [Waterfall Structures (Rockstep)](https://rockstep.com/blog/waterfall-structures-in-real-estate)
- [Preferred Returns and Waterfalls (RealWealth)](https://realwealth.com/learn/preferred-returns-waterfall-structures-real-estate-syndications/)
- [Promote/Carried Interest in RE PE (CPI Capital)](https://cpicapital.ca/promote-or-carried-interest-in-real-estate-private-equity-syndications-explained/)
- [RE Waterfall Distributions (SponsorCloud)](https://www.sponsorcloud.io/blog/the-easiest-way-to-understand-waterfall-distributions-in-a-real-estate-syndication)

### DeFi Vaults / ERC-4626
- [ERC-4626 Tokenized Vault Standard (ethereum.org)](https://ethereum.org/developers/docs/standards/tokens/erc-4626/)
- [From $150M to $4.4B: DeFi Vaults Surging (Techopedia)](https://www.techopedia.com/defi-vaults-crypto-income-strategies)
- [Institutionalizing Risk Curation (arXiv)](https://arxiv.org/html/2512.11976v1)

### x402 Protocol / Agent Economics
- [What is x402 (Solana)](https://solana.com/x402/what-is-x402)
- [x402 AI-Native Payment Protocol (Medium)](https://medium.com/@gwrx2005/x402-an-ai-native-payment-protocol-for-the-web-419358450936)
- [Autonomous Agents on Blockchains (arXiv)](https://arxiv.org/html/2601.04583v1)
- [An Economy of AI Agents (arXiv)](https://arxiv.org/html/2509.01063v1)
- [Agent Exchange: AI Agent Economics (arXiv)](https://arxiv.org/html/2507.03904v1)
- [Virtual Agent Economies (arXiv)](https://arxiv.org/html/2509.10147v1)
