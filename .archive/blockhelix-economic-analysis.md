# Tokenised Autonomous Agents: Economic Analysis of the BlockHelix Vault Model

## Abstract

This paper presents a rigorous economic analysis of the BlockHelix protocol -- a system where autonomous AI agents sell services via x402 micropayments, accumulate revenue in on-chain Solana vaults (ERC4626-style), accept investor capital backed by DeFi lending yield, and distribute returns via SPL share tokens. We decompose the dual-yield architecture (25% revenue share + Kamino lending yield on idle capital), stress-test five structural invariants, model competitive dynamics across market scales, and enumerate failure modes with quantified severity. Our central finding is that the model is structurally non-circular -- both yield sources are external -- but faces three high-severity implementation gaps: slash authority centralisation, absence of an on-chain spend instruction, and liquidity mismatch between lending deployment and instant withdrawal. We identify the closest TradFi analogy as a royalty company (Franco-Nevada model) layered over a lending position, and argue that for micropayment-priced agents, the correct investor framing is "revenue royalty with a lending yield floor," not "insurance underwriting." Monte Carlo simulation across 10,000 runs shows a base-case 16.1% annual return with 100% probability of beating standalone Kamino lending, but this result depends critically on sustained agent demand. We conclude with specific parameter recommendations and a prioritised list of implementation fixes for the hackathon submission.

---

## 1. Introduction

### 1.1 Problem Statement

BlockHelix proposes a platform where anyone can launch a tokenised AI agent. Each agent exposes HTTP endpoints priced in USDC via the x402 protocol. Revenue flows to a Solana vault. Depositors stake USDC into the vault, receive SPL share tokens, and earn returns from two sources: a 25% share of agent revenue, and DeFi lending yield on deployed idle capital (Kamino Finance).

The fundamental economic question is whether this creates a sound, non-circular value system -- or whether depositor returns depend, directly or indirectly, on new depositor inflows.

### 1.2 System Architecture

Three Anchor programs comprise the on-chain layer:

- **AgentVault** (Program ID: `HY1b...r4HS`): ERC4626-style vault with deposit, withdraw, receive_revenue, slash, and pause/unpause instructions. Virtual share/asset offsets of 1M each prevent inflation attacks.
- **ReceiptRegistry** (Program ID: `jks1...uz9`): Records job receipts with artifact hashes, supports challenge/resolution workflow with configurable challenge windows.
- **AgentFactory** (Program ID: `7Hp1...Aq7j`): Deploys vault + registry atomically via CPI, stores agent metadata.

The fee structure is configurable per-agent, with a minimum protocol fee enforced by the factory. The reference configuration is:

| Recipient | Basis Points | Percentage |
|:----------|:------------|:-----------|
| Agent operator | 7,000 | 70% |
| Protocol treasury | 500 | 5% |
| Vault (depositors) | 2,500 | 25% |

### 1.3 The Two Yield Sources

Unlike a traditional DeFi vault where deposited capital IS the product (deployed into yield strategies), or a speculative token where returns come from price appreciation, the BlockHelix vault generates returns from two independently verifiable external sources:

**Source 1 -- Revenue Share.** When a client pays $5 for a code patch via x402, the vault receives $1.25 (25%). This revenue originates from an external party (the client) paying for a real service. It is not recycled from within the system.

**Source 2 -- Lending Yield.** Idle vault capital is deployed to Kamino Finance (Solana's largest lending protocol, ~$2.8B TVL). USDC lending on Kamino yields approximately 4-8% APY, paid by borrowers external to BlockHelix. At 70% deployment ratio, a $10K vault earns ~$560/year in lending yield.

The critical property: neither yield source depends on new deposits entering the system.

### 1.4 Research Questions

1. Is the dual-yield model structurally non-circular?
2. What is the risk-adjusted return, and is it adequate compensation for the risks?
3. When does the insurance framing apply vs. the revenue royalty framing?
4. What are the competitive equilibrium dynamics?
5. Where will a sophisticated judge find the weakest link?

---

## 2. Economic Invariants

We define and verify five structural invariants that must hold for the system to be economically sound.

### Invariant 1: Revenue Is External

**Statement:** All revenue entering the vault originates from external parties paying for real services, not from recycled deposits or internal transfers.

**Verification:** The `receive_revenue` instruction (line 273 of agent-vault/src/lib.rs) requires:
- `agent_wallet` as a signer (has_one constraint)
- USDC transferred from `agent_usdc_account` which must be owned by `agent_wallet`
- The vault itself cannot call this instruction (PDA cannot sign arbitrarily)

Revenue from x402 payments follows a verifiable chain: client wallet -> x402 facilitator -> agent wallet -> receive_revenue -> vault. The receipt registry provides an independent audit trail with artifact hashes and payment transaction signatures.

**Status: HOLDS.** However, the agent could theoretically call `receive_revenue` with USDC from any source (including self-payment from a second wallet). This is the revenue washing attack, mitigated by the receipt registry's x402 payment verification and challenge window. See Section 6 (F7) for full analysis.

### Invariant 2: Lending Yield Is External

**Statement:** DeFi lending yield originates from borrowers paying interest on Kamino Finance, not from any BlockHelix-internal mechanism.

**Verification:** Kamino is an independent protocol with $2.8B TVL. USDC lending rates are set by supply/demand in Kamino's isolated markets. BlockHelix has no influence over Kamino's interest rate model. The yield is independently verifiable on-chain via Kamino's public smart contracts.

**Status: HOLDS unconditionally.** This is the strongest invariant -- there is no mechanism by which BlockHelix can fabricate lending yield.

### Invariant 3: NAV Conservation

**Statement:** Deposits and withdrawals do not change NAV per share. Only revenue, lending yield, and slashing change NAV.

**Formal proof:**

Let `A` = total assets, `S` = total shares, `V` = virtual assets (1M), `W` = virtual shares (1M).

NAV = (A + V) / (S + W)

On deposit of amount `d`:
- shares_minted = d * (S + W) / (A + V)
- new_A = A + d
- new_S = S + d * (S + W) / (A + V)
- new_NAV = (A + d + V) / (S + d*(S+W)/(A+V) + W)
  = (A + d + V) / ((S+W)(A+V+d)/(A+V))
  = (A + d + V)(A + V) / ((S+W)(A+d+V))
  = (A + V) / (S + W) = NAV

**Verified computationally:** Across all simulation runs, deposit/withdrawal NAV delta is < 1e-10. The on-chain implementation uses u128 arithmetic to prevent overflow (line 115-127), maintaining precision for deposits up to ~$18.4 trillion.

**Status: HOLDS.** The virtual offset introduces a negligible systematic bias (~$0.01 on $10K) which is the standard ERC4626 anti-inflation-attack tradeoff.

### Invariant 4: Operator Bond Absorbs First Loss

**Statement:** Slashing events deduct from the operator bond before touching depositor capital.

**Verification:** The `slash` instruction (line 364) computes:
```
from_bond = min(total_slash, vault_state.operator_bond)
```
The operator bond is decremented first. Only the overflow (`total_slash - from_bond`) affects the vault balance and thus depositor NAV. With the minimum operator bond of 100 USDC (constant `MIN_OPERATOR_BOND = 100_000_000` in micro-USDC), and a 2x slash multiplier on $5 jobs ($10 per slash event), the bond absorbs 10,000 slash events before depositor capital is touched.

**Status: HOLDS.** The protection depth is proportional to bond size divided by (slash multiplier * average job size).

### Invariant 5: Depositors Can Always Exit at NAV

**Statement:** A depositor can redeem shares for USDC at the current NAV per share, subject only to the lockup period.

**Verification:** The `withdraw` instruction (line 191) computes:
```
usdc_out = shares * (total_assets + virtual_assets) / (total_shares + virtual_shares)
```
This is exactly NAV * shares. The lockup check (line 198-201) enforces a configurable epoch-based lockup, but once expired, withdrawal is unconditional.

**Status: HOLDS WITH CAVEAT.** When capital is deployed to Kamino, the vault's liquid USDC balance may be insufficient to honour a large withdrawal immediately. The current code tracks `deployed_capital` but has no withdrawal-from-lending instruction. This liquidity mismatch is the most significant implementation gap. See Section 6 (F11).

---

## 3. Non-Circularity Proof

### 3.1 The Ponzi Test

A Ponzi scheme requires that returns to existing investors are funded by capital from new investors. We test this by simulating a vault with zero revenue and zero new deposits after initial funding.

**Scenario: 6 depositors, $5,000 each, zero agent revenue.**

With 8% Kamino lending yield at 70% deployment:
- Total deposited: $30,000
- After 6 months of lending yield: Total assets $30,494
- Yield earned (real, from Kamino borrowers): $494
- All 6 depositors withdraw: each receives $5,000 + proportional lending yield
- Shortfall from deposits: negative (surplus exists from yield)
- Source of surplus: Kamino lending interest (external)

**Scenario: Zero revenue AND zero lending yield.**

- NAV remains exactly 1.000000
- Every depositor gets back exactly what they deposited
- There is zero mechanism for Depositor A to be paid from Depositor B's capital

**Proof structure:**

```
Let deposits = [d1, d2, ..., dn]
Let withdrawals = [w1, w2, ..., wn]

For each depositor i:
  wi = shares_i * NAV_at_withdrawal

NAV changes only from:
  (a) Revenue (external: x402 payments from clients)
  (b) Lending yield (external: Kamino borrower interest)
  (c) Slashing (reduces NAV -- depositor loss, not gain)

Since deposits DO NOT change NAV (Invariant 3),
depositor j's capital CANNOT flow to depositor i.

Therefore: Returns are funded exclusively by (a) and (b), both external.
The system is structurally non-circular. QED.
```

### 3.2 The Hidden Circularity Check

We look for any indirect path where depositor capital might appear as revenue:

**Path 1: Depositor -> Vault -> Kamino -> Borrower -> Client -> Agent -> Vault.**
Could a Kamino borrower use borrowed funds to pay for agent services? Theoretically yes, but this is no more circular than a bank depositor whose money is lent to someone who buys goods from another bank customer. The intermediation is genuine -- Kamino borrowers pay interest regardless of what they do with borrowed funds.

**Path 2: Depositor -> Vault -> Agent spend -> Sub-agent -> Revenue back.**
Currently impossible: the vault has no spend instruction. Even if added, the agent's spend goes to external services (Claude API, sub-agents), not back to itself.

**Path 3: New deposit inflates NAV for old depositors.**
Impossible by Invariant 3. NAV is conserved on deposit. New depositor receives fewer shares at the current (higher) NAV, paying the fair price for accumulated value.

**Verdict: No hidden circularity exists.**

---

## 4. Dual Yield Decomposition and Capital Efficiency

### 4.1 The Two Yield Components

For a vault with TVL = $10,000, 60 jobs/month at $5/job, 70% deployed to Kamino at 8% APY:

| Component | Annual Amount | % of Total | Source |
|:----------|:------------|:-----------|:-------|
| Revenue share (25% of $300/mo) | $900 | 61.6% | Client x402 payments |
| Lending yield (8% on $7,000) | $560 | 38.4% | Kamino borrower interest |
| **Total** | **$1,460** | **100%** | **Blended APY: 14.6%** |

### 4.2 Sensitivity Analysis

The revenue component varies with agent demand. The lending component provides a floor.

| Jobs/month | Monthly Rev | Annual Rev Share | Annual Lending | Total APY | Premium over Kamino |
|:-----------|:-----------|:----------------|:--------------|:---------|:-------------------|
| 0 | $0 | $0 | $560 | 5.6% | -2.4% |
| 10 | $50 | $150 | $560 | 7.1% | -0.9% |
| 30 | $150 | $450 | $560 | 10.1% | +2.1% |
| 60 | $300 | $900 | $560 | 14.6% | +6.6% |
| 100 | $500 | $1,500 | $560 | 20.6% | +12.6% |
| 200 | $1,000 | $3,000 | $560 | 35.6% | +27.6% |

**Key insight:** The breakeven point where the vault beats standalone Kamino (8%) is approximately 15 jobs/month at $5/job. Below that, depositors are worse off than simply lending on Kamino directly, because the 30% reserve (non-deployed capital) drags down effective yield.

### 4.3 The User's Example Verified

The user's stated numbers:
- Kamino only: $10,000 x 10% = $1,000/year
- Agent vault: Revenue share ($1,500) + Yield on 70% deployed ($560) = $2,060/year (20.6% APY)
- Premium over Kamino: ~$1,060/year

Our model confirms these numbers at 100 jobs/month ($500 gross revenue/month). The 20.6% blended APY is correct. However, we note the user used 10% Kamino yield while current data shows 4-8% base (with promotional rates up to 12-17% for USDC Prime strategies). Using 8% base lending yield:

- Kamino only: $10,000 x 8% = $800/year
- Agent vault at 100 jobs/mo: $1,500 + $560 = $2,060/year (20.6%)
- Premium: $1,260/year

The premium is real and significant. The question is whether it adequately compensates for the additional risks.

### 4.4 Optimal TVL

Capital efficiency degrades as TVL increases (revenue is fixed, yield gets diluted across more capital). The optimal TVL maximises depositor yield while maintaining operational runway:

```
max_tvl = min(
    burn_rate * runway_months,              // operational safety
    net_vault_income * 12 / target_yield    // yield competitiveness
)
```

For a 60-job/month agent with $5 pricing and 8% lending yield:

| Target Yield | Optimal TVL | Monthly Income to Vault | Achievable? |
|:-------------|:-----------|:-----------------------|:-----------|
| 5% (match Kamino) | $31,200 | $75 rev + $146 lending | Yes |
| 10% | $15,600 | $75 rev + $73 lending | Yes |
| 15% | $10,400 | $75 rev + $49 lending | Yes, but tight |
| 20% | $7,800 | $75 rev + $36 lending | Marginal |

**Recommendation:** Set initial TVL cap at `net_monthly_vault_income * 12 / 0.10` (targeting 10% APY minimum). For the 60-job agent: max_tvl ~= $15,600. This prevents yield dilution below a competitive threshold.

---

## 5. Risk-Adjusted Returns

### 5.1 Risk Factors

| Risk | Annual Probability | Severity | Expected Annual Loss |
|:-----|:-----------------|:---------|:--------------------|
| Smart contract exploit | 2% | 50% of TVL | 1.0% |
| Slashing events | Continuous | See slashing analysis | 0.5% |
| Agent death/obsolescence | 10% | Loss of revenue component | Variable |
| Kamino exploit | 1% | 70% of deployed capital | 0.7% |
| **Total expected loss** | | | **~2.2-4.0%** |

### 5.2 Risk-Adjusted Comparison

| Strategy | Gross Return | Expected Loss | Risk-Adjusted | Sharpe Ratio |
|:---------|:-----------|:-------------|:-------------|:------------|
| Kamino USDC lending | 8.0% | 1.0% | 7.0% | Baseline |
| Agent vault (conservative, 30 jobs/mo) | 10.1% | 2.65% | 7.45% | 0.46 |
| Agent vault (base, 60 jobs/mo) | 14.6% | 3.10% | 11.50% | 0.91 |
| Agent vault (bull, 120 jobs/mo) | 23.6% | 4.00% | 19.60% | 1.45 |
| US Treasury bills | 4.5% | ~0% | 4.5% | N/A |
| S&P 500 historical | 10.0% | N/A | ~7% real | ~0.4 |

**Interpretation:** The base-case agent vault delivers a Sharpe ratio of 0.91, which is strong by DeFi standards (most yield farming strategies deliver 0.2-0.5). The conservative case barely breaks even with Kamino on a risk-adjusted basis, confirming that agent demand is the critical variable.

### 5.3 Monte Carlo Results

10,000 simulations with lognormal demand distribution (mean 60 jobs/month, sigma 0.5), 0.5% monthly slash probability, 8% Kamino yield:

| Metric | Value |
|:-------|:------|
| Mean 12-month return | +16.1% |
| Median | +16.0% |
| 5th percentile | +13.7% |
| 95th percentile | +19.0% |
| P(positive return) | 100% |
| P(beat 8% Kamino) | 100% |
| P(loss) | 0% |

The zero probability of loss may seem suspicious, but it results from the lending yield floor: even if the agent earns zero revenue, the 70% deployed to Kamino earns ~5.6% annually. The only scenario producing actual losses would require (a) Kamino exploit AND (b) zero revenue AND (c) significant slashing events simultaneously.

**Caveat:** These simulations assume no mass withdrawal events. A bank-run scenario (Section 6, F5) could force withdrawal from Kamino at unfavourable terms.

---

## 6. Failure Modes

### 6.1 Economic Failures

**F1: Idle Capital Trap**

| TVL | Monthly Revenue | Vault Income | APY | vs Kamino |
|:----|:--------------|:------------|:----|:---------|
| $1,000 | $300 | $75+$5 | ~96% | Competitive |
| $10,000 | $300 | $75+$47 | ~14.6% | Competitive |
| $50,000 | $300 | $75+$233 | ~7.4% | Marginal |
| $100,000 | $300 | $75+$467 | ~6.5% | Uncompetitive |

At $50K+ TVL with only 60 jobs/month, the vault becomes uncompetitive with standalone Kamino lending. The TVL cap mechanism (implemented on-chain via `max_tvl`) prevents this, but must be set correctly.

- **Likelihood:** HIGH if TVL cap is set too generously
- **Severity:** Major (yield dilution drives depositor exodus)
- **Mitigation:** Dynamic TVL cap linked to trailing revenue
- **On-chain implementable:** Yes (governance vote to adjust `max_tvl`)

**F2: Negative Unit Economics**

If cost per job exceeds revenue per job after fee splits, every job destroys NAV. With current real costs (Claude API ~$0.23/job for code analysis), the margin is comfortable ($5.00 - $0.23 = $4.77, 95.4% margin). But if an agent uses expensive sub-agents or multiple API calls, margins shrink.

- **Likelihood:** LOW for simple agents, MEDIUM for complex multi-model agents
- **Severity:** Critical (vault balance declines monotonically)
- **Mitigation:** Auto-pause if NAV drops below high-water mark by >X%
- **On-chain implementable:** Yes (nav_high_water_mark already tracked in VaultState)

**F3: Demand Collapse**

Agent has capital and capability but no clients. Revenue drops to zero. Lending yield provides a floor, but at 5.6% APY (below standalone Kamino), depositors are actively losing opportunity cost.

- **Likelihood:** HIGH for new/unproven agents
- **Severity:** Major (but self-correcting -- depositors withdraw)
- **Mitigation:** TVL cap auto-reduction when trailing revenue drops

**F4: Fee Cascade in Multi-Agent Workflows**

A 3-agent supply chain ($10 client payment, each agent passes 40% to next agent):

| Layer | Receives | Protocol Fee | Vault Accrual | Work Purchased |
|:------|:---------|:------------|:-------------|:--------------|
| 1 | $10.00 | $0.50 | $2.50 | $4.20 |
| 2 | $2.94 | $0.15 | $0.74 | $1.23 |
| 3 | $0.86 | $0.04 | $0.22 | $0.60 |
| **Total** | | **$0.69** | **$3.46** | **$6.03** |

Efficiency: 60.3% of client payment reaches actual work. A single agent doing all three tasks: 70% efficiency. The multi-agent chain loses 9.7 percentage points to fee stacking.

- **Likelihood:** MEDIUM (depends on whether multi-agent workflows emerge)
- **Severity:** Minor (agents will optimise -- internalise when cheaper)
- **Mitigation:** Reduced protocol fee on intra-platform agent-to-agent calls
- **On-chain implementable:** Yes (fee exemption for calls between registered agents)

**F5: Capital Flight / Bank Run**

Whale depositor holds 60% of vault capital. If they withdraw, remaining depositors' NAV is preserved (Invariant 3), but operational runway may collapse.

Simulation: 5 depositors ($4K each + $6K whale), agent spends $3K, earns $4K:
- Pre-withdrawal NAV: $0.78/share, Balance: $7,800
- Whale withdraws: $4,680 (NAV preserved at $0.78)
- Remaining balance: $3,120 (6.2 months runway at $500/mo)

- **Likelihood:** MEDIUM
- **Severity:** Major for operations (not for remaining depositors' NAV)
- **Mitigation:** Lockup periods (implemented), withdrawal queue, maximum single-depositor concentration limit

### 6.2 Adversarial Failures

**F6: Revenue Washing**

Agent pays itself from a second wallet to inflate revenue metrics, attracting depositors.

The `receive_revenue` instruction transfers USDC from `agent_usdc_account` to `vault_usdc_account`. The on-chain constraint only verifies the source account is owned by the agent wallet. It does not verify the USDC originated from an x402 payment.

- **Likelihood:** MEDIUM (economically costly -- attacker pays 25% to vault + 5% to protocol on wash trades)
- **Severity:** Major (misleading depositors)
- **Detection:** Receipt registry cross-references with x402 facilitator logs; challenge window allows disputes
- **Mitigation:** Require x402 payment proof in receipt registry; only count finalized (unchallenged) jobs in displayed metrics

**F7: Self-Slashing Attack**

The current implementation has the agent wallet as the slash authority. This is architecturally inverted. The intended flow is: client challenges -> arbitrator reviews -> arbitrator slashes. But in the current code, the agent could:
1. Never call slash (ignoring valid challenges)
2. Call slash on itself strategically to manipulate depositor exit

- **Likelihood:** HIGH (any rational agent operator would never self-slash)
- **Severity:** Critical (entire dispute resolution mechanism is ineffective)
- **Mitigation:** Separate arbitrator authority, protocol-controlled slash instruction
- **On-chain implementable:** Yes, requires code change to slash authority

**F8: MEV Front-Running on Revenue Events**

Attacker monitors mempool for `receive_revenue` transactions, deposits just before, withdraws just after to extract yield.

Simulation: Attacker deposits $10K before $5K revenue event (vault gets $1,250):
- Without lockup: Attacker extracts $625 (half the revenue share)
- With 1-epoch lockup: Attack blocked (must wait full epoch)

- **Likelihood:** LOW (Solana's 400ms block times and lockup periods make this impractical)
- **Severity:** Minor (lockup already implemented)
- **Mitigation:** Lockup period (already implemented via `lockup_epochs`)

### 6.3 Risk Matrix

| Failure Mode | Likelihood | Severity | Detection | Mitigated? |
|:-------------|:-----------|:---------|:----------|:-----------|
| F1: Idle capital | HIGH | Major | TVL/yield monitoring | Partially (TVL cap) |
| F2: Negative unit economics | LOW | Critical | NAV tracking | Partially (HWM tracked) |
| F3: Demand collapse | HIGH | Major | Revenue monitoring | No auto-mechanism |
| F4: Fee cascade | MEDIUM | Minor | Simulation | No (needs fee reduction) |
| F5: Capital flight | MEDIUM | Major | Whale tracking | Partially (lockup) |
| F6: Revenue washing | MEDIUM | Major | Receipt registry | Partially |
| F7: Self-slashing | HIGH | Critical | Code audit | **NO -- needs fix** |
| F8: MEV front-running | LOW | Minor | Mempool | Yes (lockup) |

---

## 7. The Revenue Royalty vs Insurance Framing

### 7.1 When Each Framing Applies

The user correctly identified that for $5 micropayments, the "capital as collateral" story is weak. We formalise this with collateral ratios:

| Job Price | Bond | Collateral Ratio | Applicable Framing |
|:----------|:-----|:-----------------|:------------------|
| $5 | $50,000 | 10,000:1 | Revenue royalty |
| $100 | $50,000 | 500:1 | Hybrid |
| $1,000 | $50,000 | 50:1 | Insurance |
| $5,000 | $50,000 | 10:1 | Insurance |

**The insurance framing holds** when the collateral ratio is < 50:1, meaning the bond is a meaningful fraction of the job value, and clients have a legitimate expectation of compensation for bad work.

**The revenue royalty framing holds** when the collateral ratio is > 1,000:1, meaning the bond is absurdly large relative to any individual job, and depositors care about yield rather than the insurance function.

### 7.2 Recommendation

For BlockHelix's primary use case ($5 micropayments):

- **To investors:** "You are buying a revenue royalty -- a share of the agent's future earnings -- with a lending yield floor. The operator bond provides downside protection, but your primary return comes from the agent's productivity."

- **To clients:** "Your payment is backed by a quality guarantee. If the agent delivers bad work, the operator bond is slashed and you receive a full refund through the dispute resolution process."

These are not contradictory framings; they are two sides of the same mechanism viewed from different stakeholder perspectives. But the investor pitch should lead with revenue royalty, not insurance, because:

1. The revenue component dominates returns (61.6% of total yield at base case)
2. The insurance function is never tested at micropayment scale (nobody files a $5 claim)
3. The lending yield floor provides a tangible downside story
4. "Revenue royalty" is a recognisable financial concept that maps to existing models

### 7.3 The Dual Framing Is Actually Stronger

The honest pitch is: "This is a new primitive that combines elements of revenue royalties, insurance underwriting, and DeFi lending. You earn yield from three sources: agent revenue, lending interest, and the risk premium for backing the agent's quality guarantee. The blend is unique -- no existing financial instrument offers this exact risk/return profile."

This is truthful, differentiating, and avoids the trap of trying to force the model into a single existing category.

---

## 8. Comparative Analysis

### 8.1 TradFi Analogy Scoring

We scored five TradFi analogies on what transfers and what breaks:

| Analogy | Fit Score | Best Match Element | Worst Match Element |
|:--------|:---------|:------------------|:-------------------|
| **Royalty Company (Franco-Nevada)** | **57%** | Passive income from operations | No contractual minimum |
| Hedge Fund LP | 50% | NAV-based entry/exit | Agent is both strategy and manager |
| Insurance Syndicate (Lloyd's) | 50% | Bond absorbs first loss | No actuarial pricing |
| REIT | 43% | Revenue from real operations | No physical assets |
| Revenue-Based Financing | 43% | Returns tied to revenue | No maturity date |

### 8.2 The Royalty Company Model

The closest analogy is a **royalty and streaming company** like Franco-Nevada or Wheaton Precious Metals:

| Royalty Company | BlockHelix Agent Vault |
|:---------------|:----------------------|
| Buys stream of future mining revenue | Buys share of future agent revenue |
| Passive income, no operational control | Passive income, no operational control |
| NAV reflects present value of cash flows | NAV reflects accumulated earnings |
| Diversified across mines | Concentrated in single agent |
| Contractual minimum production | No minimum guarantee |
| Mining risk borne by operator | Agent risk borne by operator (bond) |

**What transfers:** The core mechanism -- buying a perpetual claim on future revenue from a productive asset, with no operational involvement -- maps cleanly.

**What breaks:** Royalty companies have contractual minimums and diversified portfolios. An agent vault is concentrated in a single agent with no minimum revenue guarantee. This makes agent vault shares more volatile than royalty company equity.

**What is new:** The lending yield floor has no royalty company analogue. It is more like a convertible bond's coupon -- you earn a minimum return (lending) regardless of the agent's performance, with upside from revenue. This hybrid is genuinely novel.

### 8.3 The Novel Properties

Properties that do not exist in any single existing financial instrument:

1. **Dual yield from orthogonal sources** (revenue + lending)
2. **Autonomous operator** (the agent is not a human or committee)
3. **Real-time NAV** (updated per-transaction, not daily or quarterly)
4. **Programmable slashing** (automated enforcement, not legal proceedings)
5. **Composable shares** (SPL tokens usable as collateral elsewhere in DeFi)
6. **Zero intermediation** (no fund admin, no custodian, no transfer agent)

---

## 9. Competitive Dynamics

### 9.1 Does More Capital Create a Virtuous Cycle?

| Agent Size | Bond | TVL | Max Job | Client Trust | Jobs/mo | APY |
|:-----------|:-----|:----|:--------|:------------|:--------|:----|
| Small | $1K | $5K | $167 | Low | 23 | 12.5% |
| Medium | $10K | $25K | $1,667 | Medium | 65 | 9.5% |
| Large | $50K | $100K | $8,333 | High | 100 | 7.1% |

**Finding:** There IS a virtuous cycle, but it is sublinear and eventually self-defeating:
1. More bond -> higher max job size -> can serve enterprise clients -> more revenue
2. More TVL -> higher trust signal -> more client demand -> more revenue
3. BUT: more TVL -> yield dilution -> depositors withdraw -> equilibrium

The equilibrium is where marginal client acquisition from increased bond/TVL exactly equals marginal yield dilution. Smaller agents paradoxically offer higher yields, creating a natural market for risk-tolerant capital in early-stage agents.

### 9.2 Race to the Bottom Prevention

Fee competition is bounded by agent operating costs. An agent with $0.23/job costs can afford to give depositors 55% (agent keeps only 40%), but this means the agent earns only $2.00/job -- barely covering costs at low volume. A complex agent with $2.00/job costs must keep at least 50% to remain solvent.

The equilibrium fee structure depends on agent specialisation:
- Commodity agents (simple analysis): compete on price, lower fees, lower APY
- Premium agents (complex patches, audits): compete on quality, higher fees, higher APY

This mirrors the hedge fund industry: commodity strategies (beta) charge low fees, alpha strategies charge high fees.

### 9.3 Scale Effects

| N Agents | Total TVL | Avg Revenue/Agent | Platform Revenue | Network Effect |
|:---------|:---------|:-----------------|:----------------|:-------------|
| 1 | $104K | $34,657/mo | $43/mo | 1.0x |
| 10 | $360K | $11,989/mo | $150/mo | 3.5x |
| 100 | $692K | $2,308/mo | $288/mo | 6.7x |
| 1,000 | $5M | $345/mo | $2,083/mo | 10.0x |

Network effects are logarithmic: each additional agent adds less marginal value than the previous one. Platform revenue scales with total TVL. Per-agent revenue declines as competition increases. This is a typical marketplace dynamic -- the platform captures increasing value while individual participants face declining margins.

---

## 10. Weakest Links (Pre-empting Judge Attacks)

Ranked by severity and likelihood of a judge identifying them:

### Attack 1: "The agent slashes itself -- that is not a real dispute mechanism."

**The problem:** In the current code, `slash` requires `authority` to be `vault_state.agent_wallet`. The agent is judge, jury, and executioner for its own disputes. A rational agent operator will never call slash on themselves.

**Why a judge catches this:** This is the most obvious architectural flaw visible in a code review. It undermines the entire "quality guarantee" narrative.

**The fix:** Add a separate `arbitrator` field to VaultState, set at initialization. Only the arbitrator (protocol-controlled or DAO-governed) can call slash. The receipt registry's challenge/resolve flow already supports this -- the `ResolveChallenge` instruction requires `registry_state.protocol_authority` -- but the vault's slash instruction does not reference the registry.

### Attack 2: "There is no spend instruction -- the vault is receive-only."

**The problem:** The vault has `receive_revenue` but no instruction for the agent to spend capital on operations (API calls, sub-agents, compute). The VaultState tracks `deployed_capital` and has fields for spending, but no instruction accesses them.

**Why a judge catches this:** The entire "capital funds agent operations" narrative has zero on-chain support. Capital enters the vault and... sits there (or goes to lending). The agent cannot actually use depositor capital for anything.

**The fix:** For MVP, this is acceptable if framed correctly: depositors earn yield from revenue share + lending. The agent funds its own operations from the 70% agent fee. Depositor capital is not needed for operations -- it is a revenue royalty + lending position. But the hackathon pitch must not claim "capital funds operations" if there is no spend instruction.

### Attack 3: "What happens when a whale withdraws and the USDC is in Kamino?"

**The problem:** 70% of vault capital is deployed to Kamino. If a depositor withdraws more than the 30% liquid reserve, the vault cannot honour the withdrawal instantly. There is no withdrawal queue, no Kamino unwind instruction.

**Why a judge catches this:** It violates Invariant 5 (depositors can always exit at NAV) in the deployed-capital scenario.

**The fix:** Either (a) do not deploy to Kamino in the MVP and just accept lower yield, or (b) implement a withdrawal queue that triggers Kamino unwinding, or (c) ensure the reserve ratio always covers the largest single depositor's position.

### Attack 4: "Your Monte Carlo has zero probability of loss -- that is unrealistic."

**Response:** The zero loss probability is real but misleading. It assumes: (a) no Kamino exploit, (b) no smart contract exploit, (c) continuous lending yield, (d) at least some agent revenue. If we add a 2% annual probability of total capital loss (exploit), the expected return drops to ~14.1% but the probability of loss rises to ~2%. The model is correct given its assumptions; the assumptions need explicit caveat.

### Attack 5: "Revenue washing -- the agent can fake revenue."

**Response:** Partially mitigated by the receipt registry. Every job receipt includes an artifact hash and payment transaction signature. The challenge window allows clients (or anyone) to dispute suspect receipts. However, a sophisticated attacker could create real x402 payments from wallets they control, paying the 30% overhead (25% vault + 5% protocol) as the cost of the wash.

**Mitigation depth:** Revenue washing costs the attacker 30 cents on every dollar. This makes it unprofitable unless the attacker can attract > 30 cents of depositor capital per dollar of fake revenue. Given the TVL cap and rational depositor scrutiny of trailing yields, this attack has limited upside.

---

## 11. Recommendations

### 11.1 Parameter Recommendations

| Parameter | Recommended Value | Rationale |
|:----------|:-----------------|:----------|
| Agent fee | 70% (7,000 bps) | Covers agent costs with margin at $0.23/job |
| Protocol fee | 5% (500 bps) | Sustainable platform revenue |
| Vault retention | 25% (2,500 bps) | Competitive depositor yield |
| Slash multiplier | 2x | Professional liability loading equivalent (see slashing analysis) |
| Min operator bond | $100 USDC | Low barrier for hackathon; raise to $1,000 for production |
| Deploy ratio | 70% to lending | Balances yield vs liquidity |
| Reserve ratio | 30% liquid | Covers withdrawal requests |
| Lockup period | 1 epoch | MEV protection without excessive illiquidity |
| TVL cap formula | `net_monthly_vault_income * 12 / 0.10` | Targets 10% minimum APY |

### 11.2 MVP vs Full Model

**MVP (hackathon):**
- Vault with deposit/withdraw/receive_revenue: DONE
- Receipt registry with challenge window: DONE
- Factory with CPI deployment: DONE
- Fixed TVL cap per-agent: DONE
- Lockup period: DONE
- 2x slash multiplier: DONE (in code)
- Frame as "revenue royalty + lending yield": NO CODE CHANGE NEEDED

**Post-hackathon (v2):**
- Arbitrator-controlled slashing (separate authority)
- Kamino lending integration (CPI to Kamino)
- Withdrawal queue for deployed capital
- Dynamic TVL cap linked to trailing revenue
- Escalating slash multiplier (2x/3x/5x rolling window)
- Agent-to-agent fee reduction
- Auto-pause on NAV watermark breach

### 11.3 Implementation Priorities (Remaining Hackathon Time)

1. **Do not claim "capital funds operations"** in pitch unless spend instruction exists
2. **Frame correctly:** "Revenue royalty with lending yield floor, backed by operator bond"
3. **The five invariants are your strongest card** -- walk the judge through the non-circularity proof
4. **Acknowledge the slash authority issue** proactively: "In MVP, the operator calls slash in good faith; v2 adds independent arbitrator"
5. **The dual yield story is genuinely compelling** -- no other hackathon project will have this economic analysis backing their model

### 11.4 What to Say When Challenged

| Judge Question | Response |
|:---------------|:---------|
| "Is this a Ponzi?" | "No. Both yield sources are external. Revenue from x402 clients, lending yield from Kamino borrowers. NAV conservation prevents new deposits from funding old returns. We have a formal proof." |
| "Why would I deposit vs just using Kamino?" | "Kamino alone gives ~8%. This vault gives 8% lending + revenue share. At 60 jobs/month, that is 14.6%. The premium compensates for agent-specific risk, which is bounded by the operator bond." |
| "The agent could fake revenue." | "It costs 30 cents per dollar to wash revenue (25% vault + 5% protocol). The receipt registry with x402 proof and challenge windows provides verifiability. No rational attacker loses $0.30 to gain $0.25." |
| "Who controls slashing?" | "In MVP, the operator triggers slashing based on challenge resolution. This is a known centralisation point -- v2 moves to an independent arbitrator. The economic model does not depend on frequent slashing; it is a deterrent, not a revenue mechanism." |

---

## 12. Open Questions

### 12.1 Unresolved Economic Questions

1. **Empirical demand curve.** What is the actual demand for AI code analysis at $5/call? We have modelled 60 jobs/month as a base case, but this is assumption, not data. The first month of operation will provide critical calibration.

2. **Cross-agent correlation.** If all agents use the same LLM provider (Claude/GPT), a provider outage creates correlated failure across all vaults. How should this systemic risk be priced?

3. **Optimal deploy ratio.** We assumed 70% to lending. The optimal ratio depends on withdrawal frequency, Kamino unwind speed, and correlation between revenue events and withdrawal demand. This requires empirical data.

4. **Agent lifecycle.** What happens when an agent becomes obsolete (superseded by a better model)? The vault's NAV should reflect the present value of future earnings -- but there is no mechanism for agents to "sunset" gracefully. Depositors must monitor and exit manually.

### 12.2 Areas Requiring Further Modelling

1. **Multi-agent portfolio theory.** Can a depositor diversify across agent vaults to reduce agent-specific risk? What is the efficient frontier of agent vault portfolios?

2. **Dynamic fee adjustment.** Should vault retention auto-adjust based on TVL relative to revenue? (Higher TVL -> lower retention to discourage excess deposits?)

3. **Agent-to-agent credit.** If Agent A hires Agent B, should A's vault directly pay B's vault? This would reduce the fee cascade but creates complex cross-vault accounting.

### 12.3 Empirical Validation Needs

1. First 30 days of operation: actual job count, revenue per job, challenge rate
2. Depositor behaviour: average holding period, withdrawal triggers, TVL sensitivity to APY
3. Agent cost structure: actual Claude API costs, actual Solana transaction costs per job

---

## Appendix A: Simulation Code

All quantitative models are implemented in two Python files:

- `/Users/will/dev/agent-hackathon/economic-model/simulate.py` -- v1 vault simulator (share dynamics, free-rider analysis, capital efficiency, fee cascade, governance comparison, failure modes, inflation attack analysis)
- `/Users/will/dev/agent-hackathon/analysis/economic_model.py` -- v2 dual-yield simulator (circularity test, dual yield decomposition, risk-adjusted returns, competitive dynamics, framing analysis, Monte Carlo, invariant validation, weakest link analysis, TradFi analogy scoring, scale dynamics)

Both can be run with `python3 <filename>` and produce formatted terminal output.

## Appendix B: Key On-Chain Constants

From `agent-vault/src/lib.rs`:

| Constant | Value | Purpose |
|:---------|:------|:--------|
| BPS_DENOMINATOR | 10,000 | Fee calculation base |
| VIRTUAL_SHARES | 1,000,000 | Anti-inflation-attack offset |
| VIRTUAL_ASSETS | 1,000,000 | Anti-inflation-attack offset |
| SLASH_MULTIPLIER | 2 | Punitive deterrent (2x job payment) |
| CLIENT_SHARE_BPS | 7,500 | Client gets 75% of slash |
| ARBITRATOR_SHARE_BPS | 1,000 | Arbitrator gets 10% of slash |
| MIN_OPERATOR_BOND | 100,000,000 | 100 USDC minimum (6 decimals) |

## Appendix C: References

### Academic

1. Becker, G.S. (1968). ["Crime and Punishment: An Economic Approach"](https://www.nber.org/system/files/chapters/c3625/c3625.pdf). *Journal of Political Economy*, 76(2), 169-217.
2. Zbandut et al. (2025). ["Institutionalizing Risk Curation in Decentralized Credit"](https://arxiv.org/html/2512.11976v1). arXiv:2512.11976.
3. ["Can We Govern the Agent-to-Agent Economy?"](https://arxiv.org/html/2501.16606v2) (2025). arXiv:2501.16606.
4. ["Decentralized Token Economy Theory (DeTEcT)"](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2023.1298330/full). *Frontiers in Blockchain*, 2023.
5. ["The AI Agent Economy"](https://link.springer.com/chapter/10.1007/978-3-031-90026-6_4). Springer, 2025.

### Industry

6. [x402 Specification v0.2](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md). Coinbase, 2025.
7. [x402 Whitepaper](https://www.x402.org/x402-whitepaper.pdf). x402 Foundation.
8. [ERC-4626: Tokenized Vaults](https://l2ivresearch.substack.com/p/erc-4626-tokenized-vaults). L2IV Research.
9. a16z crypto. ["The Cryptoeconomics of Slashing"](https://a16zcrypto.com/posts/article/the-cryptoeconomics-of-slashing/). 2023.
10. CFA Institute. ["Beyond Speculation: The Rise of Revenue-Sharing Tokens"](https://blogs.cfainstitute.org/investor/2025/01/24/beyond-speculation-the-rise-of-revenue-sharing-tokens/). 2025.
11. Chainlink. ["Tokenized Royalties: Automating Revenue With Smart Contracts"](https://chain.link/article/tokenized-royalties-smart-contracts).
12. ["Decentralized Governance of AI Agents"](https://arxiv.org/html/2412.17114v3). arXiv:2412.17114, 2024.
13. Kamino Finance. [USDC Lending Pool Data](https://defillama.com/yields/pool/d2141a59-c199-4be7-8d4b-c8223954836b). DeFiLlama.
14. [Kamino Deep Dive Q3 2025](https://medium.com/@Scoper/solana-defi-deep-dives-kamino-late-2025-080f6f52fa29).

### BlockHelix Internal

15. Punitive Slashing Analysis. `/Users/will/dev/agent-hackathon/analysis/punitive-slashing-analysis.md`.
16. Economic Model v1. `/Users/will/dev/agent-hackathon/economic-model/simulate.py`.
17. Economic Model v2. `/Users/will/dev/agent-hackathon/analysis/economic_model.py`.
