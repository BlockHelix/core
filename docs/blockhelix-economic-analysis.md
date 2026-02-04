# Tokenised Autonomous Agents: Economic Analysis

## Abstract

This paper analyses the economic model of tokenised autonomous AI agents -- systems where an AI agent sells services via x402 micropayments, accumulates revenue in an on-chain Solana vault, accepts external capital from depositors, spends capital on operations, and distributes returns via SPL share tokens. We examine whether the ERC4626-style share math survives the introduction of agent-controlled outflows, formally prove the invariants required for system soundness, and model capital efficiency across realistic scenarios. Our central finding is that **deposited capital is only productive when the agent is compute-constrained** -- when additional capital directly enables additional revenue. When it does not, yield dilutes below the risk-free rate and capital serves no economic purpose. We propose a TVL cap formula, analyse fee cascades in multi-agent supply chains, compare governance frameworks, enumerate failure modes, and define the conditions under which this model constitutes a novel economic primitive rather than a worse version of existing structures. The analysis uses real API costs ($0.23/job for Claude-based code patches), real Solana transaction costs ($0.00025), and simulation results. We are direct about what works, what does not, and what remains unresolved.

---

## 1. Introduction

### 1.1 Problem Statement

BlockHelix is building infrastructure for tokenised autonomous agents on Solana. The core idea: an AI agent (say, a code analysis agent) exposes HTTP endpoints priced in USDC via the x402 protocol. Clients pay per call. Revenue splits between the agent operator, the protocol, and a vault. Anyone can deposit USDC into the vault and receive SPL share tokens representing a proportional claim on net assets.

The proposed extension adds a `spend` instruction: the agent can withdraw USDC from the vault to fund its operations -- compute (Claude API calls), sub-agent services, hosting. This transforms the vault from a passive revenue-accumulation vehicle into an active treasury that funds agent operations.

The economic question: **does this model produce sound returns for depositors, or is it a mechanism that looks like DeFi but behaves like burning money?**

### 1.2 System Description

The system has three flows:

**Revenue In.** A client pays $5 for a code patch via x402. The revenue splits: 70% to the agent operator (configurable via `agent_fee_bps`), 10% to the protocol (`protocol_fee_bps`), and 20% to the vault (the remainder). The vault's USDC balance increases. Since shares outstanding remain constant, NAV per share increases. All existing shareholders benefit proportionally.

**Capital In.** An investor deposits $1,000 USDC. They receive SPL shares proportional to the current NAV: `shares_minted = deposit_amount / NAV_per_share`. The vault balance increases by the deposit. Shares outstanding increase by the minted amount. By construction, NAV per share remains unchanged.

**Spend Out.** The agent spends $3 on a Claude API call and $1 on a sub-agent audit. The vault balance decreases by $4. Shares outstanding remain constant. NAV per share decreases. If the spend generates revenue exceeding the cost, the net effect on NAV is positive.

### 1.3 How This Differs from Standard DeFi Vaults

In an ERC4626 vault (Yearn, Aave, Compound), deposited capital IS the product. Capital gets lent out, deployed as LP, or staked. More capital means more yield, up to protocol capacity limits. The vault's `totalAssets()` reflects deployed capital plus accumulated yield.

In an agent vault, deposited capital is NOT directly productive. The agent's revenue is a function of its compute capacity, skill, and market demand -- not its balance sheet. A $10,000 deposit into an agent earning $100/month does not make the agent earn $200/month. It makes the $100/month spread across $10,000 more capital, producing 1%/month yield that annualises to 12.7% -- which sounds fine until you realise the agent's revenue did not change.

This distinction is the central challenge of the model.

### 1.4 Research Questions

1. Does ERC4626 share math work with agent-controlled outflows?
2. When does external capital help vs. hurt the agent?
3. How should spend be governed to protect depositors?
4. Do fee cascades make multi-agent workflows uneconomic?
5. What breaks, and under what conditions?
6. Is this a novel economic primitive or a worse version of something that already exists?

---

## 2. Economic Invariants

### 2.1 Formal Definitions

We define the vault state as:

```
B = vault USDC balance
S = total shares outstanding
NAV = B / S  (when S > 0)
```

**Invariant 1: NAV Conservation on Deposit.**

*Statement:* For any deposit of amount `d > 0` when `S > 0`:

```
NAV_after = NAV_before
```

*Proof:*

```
shares_minted = d / NAV_before = d * S / B

B' = B + d
S' = S + d * S / B = S * (B + d) / B

NAV_after = B' / S' = (B + d) / (S * (B + d) / B) = B / S = NAV_before  QED
```

*Edge case (S = 0):* The first deposit sets `shares_minted = d` and `NAV = 1.0`. This is the current implementation. It is correct but creates an inflation attack vector (see Section 6.1).

**Invariant 2: NAV Conservation on Withdrawal.**

*Statement:* For any withdrawal of `s` shares when `S > s > 0`:

```
NAV_after = NAV_before
```

*Proof:*

```
usdc_out = s * NAV = s * B / S

B' = B - s * B / S = B * (S - s) / S
S' = S - s

NAV_after = B' / S' = B * (S - s) / (S * (S - s)) = B / S = NAV_before  QED
```

*Edge case (s = S):* The last withdrawal drains the vault completely. `B' = 0`, `S' = 0`. NAV is undefined (0/0). The implementation must handle this by resetting to initial state. The current code handles this correctly since `total_shares` after full withdrawal equals zero, and the next deposit would use the `total_shares == 0` branch.

**Invariant 3: Revenue Monotonically Increases NAV.**

*Statement:* For any revenue event with amount `r > 0`:

```
NAV_after > NAV_before
```

*Proof:*

```
vault_cut = r * vault_fee_bps / 10000

B' = B + vault_cut
S' = S  (no shares minted on revenue)

NAV_after = (B + vault_cut) / S > B / S = NAV_before  QED
```

This holds because `vault_cut > 0` whenever `r > 0` and `vault_fee_bps > 0`.

**Invariant 4: Spend Monotonically Decreases NAV.**

*Statement:* For any spend of amount `x > 0`:

```
NAV_after < NAV_before
```

*Proof:*

```
B' = B - x
S' = S

NAV_after = (B - x) / S < B / S = NAV_before  QED
```

This is the critical new dynamic. Every spend event destroys shareholder value. Value is only recovered if the spend produces revenue exceeding the cost.

**Invariant 5: Profitable Operations Increase NAV (Net).**

*Statement:* Over any period where vault revenue retention exceeds spend:

```
If vault_income > vault_spend during [t0, t1]:
    NAV(t1) > NAV(t0)
```

This is the fundamental value proposition. It is NOT guaranteed -- it depends on the agent being profitable.

**Invariant 6: Solvency.**

*Statement:* At all times:

```
B >= 0
S >= 0
B >= S * NAV  (trivially true since NAV = B/S)
```

The vault cannot go negative because the spend instruction requires `amount <= vault_balance`. Every share is fully backed by USDC.

**Invariant 7: Budget Constraint.**

*Statement (proposed, not yet implemented):*

```
epoch_spend <= budget_per_epoch
```

This is not enforced in the current implementation. We recommend adding it (see Section 5).

### 2.2 Missing Invariants

The current implementation lacks several invariants that should hold:

**Invariant 8: Minimum NAV Floor.** There is no mechanism to pause operations if NAV drops below a threshold. An agent could theoretically spend the entire vault balance to zero (within the budget constraint if one existed).

**Invariant 9: Maximum Dilution Rate.** There is no limit on how quickly shares can be minted. A rapid series of deposits followed by agent spend could dilute existing shareholders if a revenue event occurs between.

**Invariant 10: Share Supply Non-Zero After Revenue.** If all shares are withdrawn but revenue continues to flow (the agent keeps serving clients), the vault accumulates USDC with no shareholders to benefit. This is "trapped value" -- the protocol fee still gets paid, but the vault retention has no beneficiary.

### 2.3 Transaction Ordering Concerns

On Solana, transactions within a block are ordered by the leader. Two attack vectors exist:

1. **Deposit before revenue:** An attacker who knows a revenue event is imminent can deposit just before it, capture a share of the revenue, and withdraw immediately after. Our simulation shows this extracts value: a $10,000 deposit before a $5,000 revenue event (vault gets $1,000) yields $500 profit for the attacker, reducing existing depositor gains from $1,000 to $500.

2. **Withdraw before spend:** A depositor who knows the agent is about to spend can withdraw before the NAV-decreasing event. This is rational individual behaviour but destabilises the system.

Mitigations: deposit lockup period (minimum 1 epoch before withdrawal), time-weighted average NAV for deposit pricing, or batch deposit/withdrawal processing at epoch boundaries.

---

## 3. Capital Efficiency

### 3.1 The Revenue Function R(k)

The key question: how does agent revenue depend on deployed capital?

For a traditional DeFi vault, `R(k) = r * k` -- revenue scales linearly with capital. For an agent vault, the relationship is more complex:

```
R(k) = min(D, floor(k / c)) * p
```

Where:
- `D` = demand (jobs per period)
- `k` = available capital
- `c` = cost per job (Claude API + sub-agents + hosting)
- `p` = price per job

This is a **piecewise linear function with a demand ceiling**:

```
R(k) = k * p / c    when k/c < D   (capital-constrained regime)
R(k) = D * p        when k/c >= D   (demand-constrained regime)
```

The marginal revenue of capital is:

```
dR/dk = p/c    when k < D*c   (positive, constant)
dR/dk = 0      when k >= D*c  (zero -- additional capital produces nothing)
```

This means capital has a hard capacity limit: `k_max = D * c`. Beyond this, every additional dollar is idle.

### 3.2 Unit Economics

Using real costs for a code patch agent:

| Component | Cost |
|-----------|------|
| Claude API (50K in, 5K out) | $0.225 |
| Audit sub-agent (10K in, 2K out) | $0.045 |
| Test sub-agent (5K in, 1K out) | $0.020 |
| Solana transactions (3x) | $0.001 |
| Hosting (amortised per job at 100 jobs/mo) | $0.200 |
| **Total cost per job** | **$0.491** |
| **Revenue per job** | **$5.00** |
| **Gross margin** | **90.2%** |

The agent has extremely high gross margins. This is characteristic of software services -- the marginal cost of serving an additional client is small. But it means:

1. The agent does not need much capital to fund operations. At $0.49/job and 100 jobs/month, the monthly burn is $49.10 (excluding hosting, which is fixed).

2. The capital requirement is small relative to revenue. Monthly revenue at 100 jobs is $500. Monthly capital requirement is $49.10. The agent needs ~$50/month in working capital.

3. At these cost levels, the agent could self-fund operations from its own fee cut (70% of $500 = $350/month) within the first month.

### 3.3 Scenario Analysis

We simulated four scenarios. The results are instructive and, in places, unflattering to the model.

**Scenario A: Pure Revenue Agent (No Capital Needs)**

The agent earns $500/month in gross revenue. The vault retains 20% = $100/month. If TVL is $10,000, monthly yield is 1.0%, annualising to 12.7%.

But the capital serves no purpose. It sits in the vault, earning revenue that the agent would generate regardless. This is equivalent to buying a revenue royalty -- the $10,000 gives the depositor a claim on 20% of future revenue, but the depositor's capital does not help produce that revenue.

At this yield, the depositor would earn more from USDC lending (~5% APY risk-free) if TVL exceeds ~$24,000. The capital is unproductive surplus.

**Scenario B: Compute-Constrained Agent**

The agent could serve 100 jobs/month but can only afford 20 without capital. With $1,000 in vault capital:

```
Monthly revenue: 100 * $5 = $500
Vault retention: $100
Monthly compute cost (from vault): $49.10
Net to vault: $50.90/month
Yield on $1,000: 5.09%/month = 81.6% APY
```

This is a genuine case where capital is productive. Each additional dollar of capital enables ~$10 of revenue (leverage ratio ~10x). But note: the capital need is only ~$50/month. A vault with $1,000 has a 20-month runway even if revenue drops to zero. TVL above $1,000 is idle.

**Scenario C: Parallel Scaling**

If the agent can parallelise jobs and capital enables parallelism (pre-paying for API calls, running concurrent sub-agents), capital scales throughput. At $5,000 TVL funding 50 parallel jobs:

```
Monthly revenue: 50 * $5 = $250
Vault retention: $50
Monthly spend: 50 * $0.49 = $24.50
Net: $25.50/month
Yield on $5,000: 0.51%/month = 6.3% APY
```

Barely competitive with USDC lending. The problem: $5,000 is far more capital than the agent needs. Optimal TVL would be ~$150 (3 months of compute at 50 jobs/month).

**Scenario D: Demand Ceiling**

Agent has capital for 100 parallel jobs but only gets 30 requests/month.

```
Monthly revenue: 30 * $5 = $150
Vault retention: $30
Monthly spend: 30 * $0.49 + $20 hosting = $34.70
Net: -$4.70/month (NEGATIVE)
```

The vault bleeds value. NAV declines every month. Depositors lose money. The fixed hosting cost creates a minimum revenue threshold: the agent must earn at least $34.70 * 10000/2000 = $173.50/month in gross revenue (about 35 jobs) just to break even on vault operations.

### 3.4 The Capital Efficiency Problem

The simulation reveals a structural problem: **for agents with realistic cost structures, the capital requirement is tiny relative to any meaningful investment amount.**

A code patch agent processing 100 jobs/month needs ~$50/month in working capital. A 6-month runway requires $300. A 12-month runway requires $600. No rational investor deploys $10,000 into a vault that only needs $600.

The fix requires one of:
1. Much higher per-job costs (GPU-intensive tasks, premium models)
2. Much higher throughput (thousands of jobs/month)
3. Capital used for something other than compute (collateral, staking, market-making)
4. Honest admission that most agents don't need external capital

### 3.5 Optimal TVL Formula

We derive the optimal TVL as the minimum of two constraints:

```
TVL* = min(TVL_operational, TVL_yield)

where:
  TVL_operational = monthly_burn_rate * runway_months
  TVL_yield = net_monthly_vault_income * 12 / target_yield
  target_yield = max(risk_free_rate, minimum_required_return)
```

The operational constraint ensures enough capital to fund operations. The yield constraint ensures depositors earn a competitive return.

For a 100-job/month agent with $0.49/job costs:

```
TVL_operational = $49.10 * 6 months = $294.60
TVL_yield = $50.90 * 12 / 0.05 = $12,216

TVL* = min($294.60, $12,216) = $294.60
```

The optimal vault holds ~$300. Anything beyond that dilutes yield without funding operations.

**Recommendation:** The TVL cap formula should be `max_tvl = burn_rate * runway_months` with `runway_months` set by governance (default: 6). This naturally limits capital to productive amounts. The burn_rate should be measured empirically from trailing epoch data, not set manually.

---

## 4. Agent-to-Agent Commerce

### 4.1 The Fee Cascade Problem

When agents hire other agents, fees stack at every layer. This is the economic equivalent of a cascade tax -- a well-studied problem that drove the adoption of VAT/GST systems in real-world economies.

**Three-agent example:**

Client pays Agent A $10 for a code patch.

```
Layer 1 (Agent A):
  Protocol fee: $10 * 10% = $1.00
  Vault retention: $10 * 20% = $2.00
  Agent A keeps: $10 * 70% = $7.00
  Agent A pays $2.80 to Agent B for audit (40% of agent cut)
  Agent A does $4.20 of work

Layer 2 (Agent B):
  Protocol fee: $2.80 * 10% = $0.28
  Vault retention: $2.80 * 20% = $0.56
  Agent B keeps: $2.80 * 70% = $1.96
  Agent B pays $0.78 to Agent C for testing (40% of agent cut)
  Agent B does $1.18 of work

Layer 3 (Agent C):
  Protocol fee: $0.78 * 10% = $0.08
  Vault retention: $0.78 * 20% = $0.16
  Agent C keeps: $0.78 * 70% = $0.55
  Agent C does $0.55 of work
```

**Totals from $10 client payment:**

| Category | Amount | Percentage |
|----------|--------|------------|
| Actual work done | $5.93 | 59.3% |
| Protocol fees | $1.36 | 13.6% |
| Vault accruals | $2.72 | 27.2% |
| **Overhead (non-work)** | **$4.07** | **40.7%** |

Compare to a single agent doing all work internally:

| Category | Amount | Percentage |
|----------|--------|------------|
| Work done by agent | $7.00 | 70% |
| Protocol fee | $1.00 | 10% |
| Vault accrual | $2.00 | 20% |
| **Overhead** | **$3.00** | **30%** |

The 3-agent supply chain loses 15.4% efficiency versus a single integrated agent. The deeper the chain, the worse it gets:

```
Chain depth 1: 70.0% efficient (30% overhead)
Chain depth 3: 59.3% efficient (40.7% overhead) at 40% spend ratio
Chain depth 5: 53.8% efficient (46.2% overhead) at 50% spend ratio
Chain depth 7: 40.9% efficient (59.1% overhead) at 70% spend ratio
```

### 4.2 The Analogy to VAT

This is precisely why real-world economies moved from cascade taxes to value-added taxes. In a VAT system, each layer only pays tax on the value it adds. The equivalent for agent-to-agent commerce would be:

**Option A: Input tax credits.** Agent A pays full fees on its $10 revenue, but claims a credit for the fees embedded in Agent B's $2.80 invoice. Net protocol fee for the transaction: only on the value added at each layer.

**Option B: Reduced inter-agent fees.** When the payer is a registered agent (not an end client), protocol_fee_bps and vault_fee_bps are reduced. For example, 5% protocol + 10% vault on agent-to-agent transactions instead of 10% + 20%.

**Option C: Wholesale pricing.** Agent-to-agent calls use a separate fee tier, analogous to wholesale vs. retail pricing in traditional markets.

**Recommendation for MVP:** Start with Option B -- reduced fees on agent-to-agent transactions. Verify the payer is a registered agent by checking if the paying wallet has an associated vault. Use 5% protocol + 10% vault for inter-agent transactions (15% total vs. 30% for client-to-agent).

### 4.3 Multiplier Effect

The economic multiplier measures total economic activity generated per dollar of external revenue entering the system.

For a $10 client payment with 40% spend ratio at each layer:

```
Total economic activity = $10 + $2.80 + $0.78 + $0.22 + ... = $10 / (1 - 0.7 * 0.4) = $13.89
Multiplier = 1.39x
```

With reduced inter-agent fees (15% instead of 30%):

```
Total activity = $10 + $2.80 + ... (same agent payments, less leakage to fees)
Multiplier = ~1.54x
```

The multiplier is modest because each layer retains most of its revenue as profit (high margins) rather than spending it downstream. This is not a bug -- it reflects that AI agents are high-margin service providers, not low-margin intermediaries.

### 4.4 Circular Dependencies

If Agent A pays Agent B, and Agent B pays Agent A, this creates a circular flow. Economically, this is not inherently problematic -- it is analogous to two companies that are each other's customers. But it does create a collusion risk: the same operator could run both agents and route payments between them to inflate revenue metrics. Mitigation: on-chain graph analysis, revenue that comes from the agent's own vault should be flagged (or excluded from revenue metrics).

---

## 5. Governance Frameworks

### 5.1 The Principal-Agent Problem

This model presents a literal principal-agent problem: depositors (principals) entrust capital to an AI agent. The agent decides how to spend it. Unlike corporate governance where the board can fire the CEO, depositors cannot fire the agent -- it runs autonomously. Their only recourse is withdrawal.

This is closer to an investment in a closed-end fund where the manager has full discretion, with one key difference: the "manager" is an algorithm with no fiduciary duty, no regulatory oversight, and no legal liability.

### 5.2 Three Governance Models

We simulated three models over 12 months with volatile revenue ($100-$900/month). The vault retention is 20% of revenue.

**Model A: Fixed Budget ($200/month)**

Result: -24.0% ROI over 12 months. The fixed budget exceeds vault income in most months, steadily depleting the vault. This model fails because it does not adapt to revenue volatility.

Failure condition: `budget > average_vault_income`. When the budget exceeds the vault's share of revenue, NAV declines monotonically. This is a death spiral -- the agent spends more than it earns for shareholders, and no mechanism corrects it.

**Model B: Revenue-Linked Budget (60% of trailing 3-month average revenue)**

Result: +10.0% ROI over 12 months. The budget automatically adjusts: when revenue drops, spending drops. When revenue rises, the agent can invest more. This is the only model that produced positive returns in our simulation.

The budget formula: `budget = trailing_3mo_avg_revenue * vault_retention_rate * 0.60`

This means the agent can spend 60% of what the vault earns, retaining 40% as net income for shareholders. The 60/40 split is a parameter -- higher spend ratios fund more aggressive growth, lower ratios protect shareholder returns.

Pro-cyclical risk: if revenue drops, the budget drops, the agent can afford less compute, and may serve fewer jobs, causing revenue to drop further. Mitigation: set a minimum budget floor funded by existing vault balance (e.g., minimum of $50/month or 1% of vault balance).

**Model C: Milestone-Based Budget**

Result: 0.0% ROI over 12 months. The conservative budget ($100/month unlocked by profit milestones) preserved capital but generated no returns. The agent was under-funded relative to its potential.

This model has the highest governance overhead and is most appropriate for large vaults (>$10,000 TVL) where depositor protection justifies the complexity.

### 5.3 Recommendation

For MVP: **Revenue-linked budget with a floor and ceiling.**

```
budget_per_epoch = max(
    min_budget,
    min(
        trailing_avg_revenue * vault_retention_rate * spend_ratio,
        max_budget
    )
)

Recommended parameters:
  spend_ratio = 0.60
  min_budget = 1% of vault balance (survival floor)
  max_budget = 5% of vault balance (anti-drain ceiling)
  epoch_length = 1 week (7 days)
  trailing_avg_window = 4 epochs
```

The 5% per-epoch ceiling means an agent cannot drain more than 5% of the vault per week, regardless of revenue. A complete drain would take 20+ weeks of zero revenue, giving depositors ample time to withdraw.

### 5.4 Emergency Mechanisms

**Pause trigger:** If NAV drops below 80% of the all-time high (a 20% drawdown), the agent's spend authority is automatically suspended. Only revenue can flow in. This is analogous to a circuit breaker in equity markets.

**Depositor exit:** Withdrawals must always be possible (no lockup on the withdrawal side). Deposit lockups (preventing immediate withdrawal after deposit) are acceptable and recommended to prevent MEV attacks, but existing depositors must be able to exit at any time.

---

## 6. Failure Modes

### 6.1 Economic Failures

**F1: Idle Capital Trap**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| HIGH | Major | TVL >> burn_rate * 12 |

This is the most likely failure mode. If the vault accepts unlimited deposits, TVL will grow beyond what the agent can productively deploy. Our simulation shows that at $500/month revenue (100 jobs), yield drops below the risk-free rate at TVL above ~$24,000. But the agent only needs ~$300 in working capital.

Mitigation: TVL cap at `burn_rate * runway_months`. On-chain, implementable as a check in the `deposit` instruction.

**F2: Negative Unit Economics**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Medium | Critical | NAV declining over 3+ epochs |

If the agent's cost per job exceeds revenue per job, every job destroys value. Our simulation shows NAV declining ~0.44% per month with negative unit economics. Over 6 months, depositors lose ~2.6%.

Mitigation: auto-pause if NAV declines for 3 consecutive epochs. Revenue-linked budget prevents overspending. On-chain, implementable by tracking NAV at epoch boundaries.

**F3: Demand Collapse**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Medium | Major | Revenue = 0 for 2+ epochs, vault still spending |

If the agent has capital but no clients, the vault bleeds. At $49/month burn rate with $300 TVL, the vault is empty in 6 months.

Mitigation: revenue-linked budget automatically reduces spend to the minimum floor. If revenue is zero, budget drops to `min_budget = 1% of vault balance = $3/month`, extending survival to years.

**F4: Fee Cascade Death**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Medium | Major | Agent-to-agent volume declining relative to client volume |

Our analysis shows a 3-layer supply chain is 15.4% less efficient than a single integrated agent. This creates a natural incentive for agents to verticalise (do everything internally) rather than specialise and trade. This would undermine the multi-agent economy thesis.

Mitigation: reduced fees on agent-to-agent transactions (see Section 4.2).

**F5: Capital Flight**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Low | Critical | Large withdrawal (>30% of TVL) followed by cascading withdrawals |

Our simulation shows that whale withdrawal does NOT affect NAV for remaining depositors (the math is symmetric). But it does reduce the operational runway. If a 60% depositor withdraws, the vault may not have enough capital to fund operations.

Mitigation: this is actually a feature, not a bug. If the vault cannot sustain operations, it should shrink. The TVL cap should adjust downward dynamically. No withdrawal restrictions -- these conflict with DeFi norms and would damage trust.

### 6.2 Adversarial Failures

**F6: First-Depositor Inflation Attack**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| HIGH | Critical | Must be mitigated before launch |

The current implementation uses `shares_minted = amount` for the first deposit, with no virtual offset. SPL tokens can be transferred directly to any token account, bypassing the `receive_revenue` instruction. An attacker can:

1. Deposit 1 micro-USDC (0.000001), receive 1 share
2. Transfer 10,000 USDC directly to the vault's token account
3. NAV inflates to $10,000.000001 per share
4. Next depositor's shares round to zero
5. Attacker withdraws and steals the deposit

This is the [well-documented ERC4626 inflation attack](https://blog.openzeppelin.com/a-novel-defense-against-erc4626-inflation-attacks), adapted to Solana. It is a critical vulnerability in the current code.

Mitigation (must implement before launch):
- Add virtual shares and virtual assets (`virtual_shares = 1_000_000`, `virtual_assets = 1_000_000`)
- Modified NAV calculation: `NAV = (B + virtual_assets) / (S + virtual_shares)`
- This makes the attack cost ~$1M to steal $1
- Alternatively: require minimum first deposit of $10 and mint dead shares

**F7: Revenue Washing**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Medium | Major | Agent paying itself from its own wallet |

The `receive_revenue` instruction requires `agent_wallet` to sign, but the agent wallet could receive USDC from external sources and call `receive_revenue` with fabricated revenue. This inflates `total_revenue` and `total_jobs` metrics, misleading depositors.

Mitigation: require receipts from the receipt registry for each revenue event. The receipt must include an artifact hash and be within the challenge window. Off-chain: verify payment came from an external source (not the agent's own vault or a related wallet).

**F8: MEV / Sandwich Attack on Deposits**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Medium | Major | Large deposit followed by immediate withdrawal after revenue event |

Our simulation quantifies this: a $10,000 deposit sandwiching a $5,000 revenue event extracts $500 from existing depositors. On Solana, where block times are 400ms, this is feasible for any participant with mempool visibility.

Mitigation: minimum deposit lockup of 1 epoch (recommended: 1 week). Deposits made within an epoch do not participate in revenue distribution until the next epoch. Implementable on-chain by recording `deposit_epoch` and requiring `current_epoch - deposit_epoch >= 1` for withdrawal.

**F9: Agent Draining Vault**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Low (with budget) | Critical (without budget) | vault_balance declining while agent_wallet balance increasing |

Without budget constraints, the agent wallet could call `spend` repeatedly and drain the vault. This is a rug-pull by the agent operator.

Mitigation: the `budget_per_epoch` constraint. Maximum spend per epoch. Enforced on-chain. The agent operator sets the budget at initialization; governance (shareholder vote) can adjust it.

**F10: Sybil Agents**

| Likelihood | Severity | Detection |
|-----------|----------|-----------|
| Low | Minor | Many agents with zero or near-zero revenue |

Creating fake agents is cheap (just Solana rent). An attacker could create many agents to exploit protocol incentives, game directory rankings, or dilute the protocol fee pool.

Mitigation: minimum revenue threshold for directory listing, reputation scoring based on job count and challenge rate, staking requirement for agent creation.

### 6.3 Risk Matrix Summary

| Failure | Likelihood | Severity | On-Chain Mitigation | Priority |
|---------|-----------|----------|-------------------|----------|
| F6: Inflation attack | HIGH | Critical | Virtual shares offset | P0 (before launch) |
| F1: Idle capital | HIGH | Major | TVL cap | P0 |
| F2: Negative economics | Medium | Critical | NAV drawdown pause | P1 |
| F8: MEV sandwich | Medium | Major | Deposit lockup | P1 |
| F9: Vault drain | Low | Critical | Budget per epoch | P0 |
| F3: Demand collapse | Medium | Major | Revenue-linked budget | P1 |
| F4: Fee cascade | Medium | Major | Reduced inter-agent fees | P2 |
| F7: Revenue washing | Medium | Major | Receipt verification | P2 |
| F5: Capital flight | Low | Critical | None needed (feature) | P3 |
| F10: Sybil agents | Low | Minor | Staking / reputation | P3 |

---

## 7. Comparative Analysis

### 7.1 Startup Equity

| Aspect | Startup | Agent Vault |
|--------|---------|-------------|
| Investment | Seed round | Vault deposit |
| Ownership token | Equity shares | SPL share tokens |
| Revenue | Top-line revenue | x402 payments |
| Operating costs | Burn rate | Agent spend |
| Valuation | Multiple of revenue/growth | NAV (book value only) |
| Exit | Acquisition/IPO | Withdrawal at NAV |
| Governance | Board of directors | Budget constraints |
| Dilution | New rounds | New deposits (NAV-neutral) |

**What transfers:** The capital-funds-growth model. Depositors provide capital so the agent can operate, hoping that revenue exceeds cost. The runway concept maps directly.

**What breaks:** Startups have equity upside -- if the company grows 100x, early investors get 100x returns. Agent vault shares only track NAV, which grows linearly with retained earnings. There is no "exit event" -- no acquisition, no IPO. The maximum return is bounded by cumulative profit, not a valuation multiple. This makes the agent vault strictly inferior to startup equity for high-growth scenarios.

Also: startup equity has liquidation preference, anti-dilution protection, board seats, information rights. Agent vault shares have none of these. They are fungible commodity tokens with no governance rights beyond budget votes.

### 7.2 Revenue-Based Financing

| Aspect | Rev-Based Financing | Agent Vault |
|--------|-------------------|-------------|
| Capital | Revenue advance | Vault deposit |
| Repayment | % of revenue until cap | Ongoing vault retention |
| Term | Until repayment cap reached | Indefinite |
| Risk | Capped downside | Full principal at risk |

**What transfers:** The revenue-share mechanism is almost identical. Depositors get a percentage of revenue (the vault retention rate), proportional to their ownership.

**What breaks:** Revenue-based financing has a repayment cap (typically 1.5-3x the advance). Once the cap is reached, the obligation ends. The agent vault has no cap -- shares represent perpetual claims. This is actually better for depositors in the high-revenue case (no cap on upside) but worse in the low-revenue case (no maturity date, no forced return of principal).

### 7.3 ERC4626 / Mutual Fund

| Aspect | Mutual Fund | Agent Vault |
|--------|------------|-------------|
| Subscription | Buy fund units | Deposit USDC |
| NAV calculation | Assets - liabilities / units | USDC balance / shares |
| Redemption | Sell at NAV | Withdraw at NAV |
| Strategy | Diversified portfolio | Single agent operations |

**What transfers:** The NAV accounting is identical. Deposit/withdraw mechanics are the same. The share price reflects the underlying asset value.

**What breaks:** A mutual fund invests in a diversified portfolio. An agent vault has concentration risk in a single AI agent. Fund managers cannot unilaterally spend fund assets on operations -- they invest them. Agent operators can spend vault assets on anything within the budget. This is a fundamentally different risk profile.

### 7.4 Worker Cooperative

| Aspect | Cooperative | Agent Vault |
|--------|------------|-------------|
| Worker | Human members | AI agent |
| Capital | Member contributions | Depositor capital |
| Returns | Profit sharing | NAV appreciation |
| Governance | Democratic (1 member, 1 vote) | Proportional (by shares) |

**What transfers:** The collective ownership and profit-sharing model. Surplus from operations is distributed to members/shareholders. The governance model (budget votes) is similar to cooperative decision-making.

**What breaks:** In a cooperative, the workers ARE the members. They control the entity. In an agent vault, the "worker" (the AI) is not a member and cannot be controlled. Depositors own shares but do not do the work. This inverts the cooperative model -- the capital providers are the members, and the worker is autonomous.

### 7.5 Is This a New Primitive?

Based on the comparative analysis, the agent vault model does not map cleanly to any single existing structure. It combines:

- **From mutual funds:** NAV accounting, share-based ownership, deposit/withdraw mechanics
- **From startups:** Capital funds operations, runway concept, growth potential
- **From cooperatives:** Collective ownership, profit sharing
- **From revenue-based financing:** Returns tied to revenue, not speculation

The key novel property: **the productive asset is an autonomous algorithm, not a portfolio, a company, or a human workforce.** The agent generates revenue independently of its capitalization (beyond a minimum threshold). Capital enables operations but does not scale revenue linearly.

We tentatively name this an **Autonomous Revenue Entity (ARE)** -- an on-chain economic unit that generates revenue by selling services autonomously, incurs costs by purchasing compute and sub-services, accepts external capital to fund operations, and issues fungible shares backed by net assets.

Whether this is a "defensible new primitive" or a "startup with extra steps" depends on scale. At the level of a single agent earning $500/month, it is over-engineered. At the level of an economy of 10,000 agents trading with each other, composing into supply chains, and collectively processing millions of jobs, it may become something genuinely new. The honest answer: we do not know yet.

---

## 8. Share Price Dynamics: A Complete Walkthrough

To directly answer the question about toxic dynamics, here is a complete simulation of share price over 7 events.

### 8.1 The Sequence

| Step | Event | NAV/Share | Vault Balance | Total Shares |
|------|-------|-----------|---------------|--------------|
| 1 | Alice deposits $10,000 | $1.0000 | $10,000 | 10,000 |
| 2 | Bob deposits $5,000 | $1.0000 | $15,000 | 15,000 |
| 3 | Agent spends $3,000 | $0.8000 | $12,000 | 15,000 |
| 4 | Revenue $8,000 (vault +$1,600) | $0.9067 | $13,600 | 15,000 |
| 5 | Charlie deposits $5,000 | $0.9067 | $18,600 | 20,515 |
| 6 | Agent spends $2,000 | $0.8092 | $16,600 | 20,515 |
| 7 | Revenue $12,000 (vault +$2,400) | $0.9262 | $19,000 | 20,515 |

### 8.2 Analysis

**Alice's journey:** Deposited $10,000 at NAV $1.00, received 10,000 shares. After all events, her shares are worth 10,000 * $0.9262 = $9,262. She lost $738, a -7.4% return. The agent spent more than the vault earned in the period she was invested.

**Bob's journey:** Same as Alice -- deposited at $1.00, shares worth $0.9262. Lost 7.4%.

**Charlie's journey:** Deposited $5,000 at NAV $0.9067 (after the first spend/revenue cycle). He received 5,515 shares. After events 6-7, his shares are worth 5,515 * $0.9262 = $5,108. He gained $108, a +2.2% return. He bought in at a lower price and benefited from the second revenue cycle.

### 8.3 Are There Toxic Dynamics?

**No, the math is sound.** The share price mechanism correctly handles all flows:

1. Deposits do not dilute existing shareholders (NAV is preserved).
2. Revenue benefits all shareholders proportionally.
3. Spend reduces all shareholders proportionally.
4. Late depositors pay the current NAV (no free lunch).

**But the dynamics reveal two important truths:**

First, **early depositors bear disproportionate risk.** They fund the initial spend before any revenue is proven. Their capital is at risk from day one. Late depositors can wait and see if the agent is profitable before investing.

Second, **the model only produces positive returns if vault revenue exceeds vault spend.** This seems obvious, but in our simulation with realistic numbers, the vault retention (20% of revenue) is small relative to operational costs. The agent's 70% cut is what funds most operations. The vault's 20% is a thin margin that must cover any capital deployed from the vault.

The free-rider problem is handled correctly by the share price mechanism: Bob, who deposits after Alice's capital has been spent, pays the (lower) post-spend NAV. He does not benefit from Alice's risk. However, if revenue subsequently flows in, Bob benefits equally per share. This is fair -- Alice's shares also benefit from the revenue. The risk-reward is symmetric once you're invested.

---

## 9. Recommendations for BlockHelix

### 9.1 Critical Fixes (Before Launch)

1. **Implement virtual shares/assets offset.** Add `virtual_shares = 1_000_000` and `virtual_assets = 1_000_000` to the NAV calculation to prevent inflation attacks. This is a P0 security issue.

2. **Add the `spend` instruction with budget constraints.** The current implementation has no outflow mechanism. Implement:
   - `spend(amount, destination)` callable only by `agent_wallet`
   - `budget_per_epoch` field in `VaultState`
   - `epoch_spend` tracking, reset at epoch boundaries
   - Require `epoch_spend + amount <= budget_per_epoch`

3. **Implement TVL cap.** Add `max_tvl` field to `VaultState`. Reject deposits when `vault_balance + amount > max_tvl`. Formula: `max_tvl = burn_rate * runway_months`.

### 9.2 Recommended Parameters

| Parameter | Recommended Value | Justification |
|-----------|------------------|---------------|
| `agent_fee_bps` | 7000 (70%) | Agent needs majority to self-fund |
| `protocol_fee_bps` | 500 (5%) | Lower than current 10%; reduces overhead |
| `vault_fee_bps` | 2500 (25%) | Remaining after agent + protocol |
| `budget_spend_ratio` | 0.60 | 60% of vault income funds operations |
| `min_budget_bps` | 100 (1% of vault) | Survival floor per epoch |
| `max_budget_bps` | 500 (5% of vault) | Anti-drain ceiling per epoch |
| `epoch_length` | 604,800 (1 week) | Balances responsiveness with stability |
| `runway_months` | 6 | Conservative default |
| `deposit_lockup_epochs` | 1 | Prevents MEV sandwich attacks |
| `nav_drawdown_pause_bps` | 2000 (20%) | Auto-pause at 20% drawdown |

**Fee structure justification:** Reducing protocol fee from 10% to 5% and increasing vault retention from 20% to 25% improves depositor returns by 25% at the cost of protocol revenue. Given that the competitive benchmark is 5% USDC lending, every basis point of vault retention matters. The protocol can recoup revenue through volume growth enabled by competitive yields.

### 9.3 Recommended Capital Structure for MVP

For MVP, use the simple single-tranche model:

```
Vault = {
  USDC balance (fungible pool),
  SPL shares (proportional claims),
  Budget constraint (spend limit per epoch),
  TVL cap (deposit limit),
}
```

Do not implement tranches, debt/equity splits, callable capital, or waterfall structures for MVP. These add complexity without solving the core problem. The core problem is ensuring capital is productive, which is solved by the TVL cap and budget constraints.

For V2, consider:
- **Preferred shares:** Early depositors get a higher vault retention percentage as compensation for bearing initial risk.
- **Lockup bonuses:** Depositors who lock for 3-6 months get a larger share allocation (time-weighted entry).
- **Performance fees:** If NAV exceeds a high-water mark, the agent operator takes a performance fee (analogous to hedge fund 2/20). This aligns incentives.

### 9.4 Inter-Agent Fee Recommendation

Implement a two-tier fee structure:

```
Client-to-Agent: protocol_fee = 5%, vault_retention = 25%
Agent-to-Agent:  protocol_fee = 2.5%, vault_retention = 12.5%
```

Verification: the paying wallet has an associated vault PDA. If it does, apply the reduced tier. This halves the fee cascade overhead and makes multi-agent supply chains economically viable down to 4-5 layers.

### 9.5 What to Build Now vs. Research Later

**Build now (hackathon scope):**
- Virtual shares offset (security fix)
- `spend` instruction with budget_per_epoch
- TVL cap on deposits
- Deposit lockup (1 epoch minimum)
- NAV tracking at epoch boundaries

**Build for V1 (post-hackathon):**
- Revenue-linked budget adjustment
- NAV drawdown pause trigger
- Inter-agent fee reduction
- Budget governance (shareholder voting)

**Research later (needs more data):**
- Optimal fee structure (requires real usage data)
- Multi-agent economy dynamics (requires agent ecosystem)
- Performance fee model (requires track record data)
- Composable vaults (vault holding shares in other vaults)
- Regulatory classification (requires legal analysis)

---

## 10. Open Questions

### 10.1 Unresolved Economic Questions

1. **Is the agent vault model viable at realistic scales?** Our analysis shows that a single agent earning $500/month only needs ~$300 in capital. This is not an investable amount. The model may only work for high-throughput agents processing thousands of jobs/month with significant compute costs, or for agents that need capital for purposes beyond compute (collateral, market-making, inventory).

2. **What is the right vault retention rate?** We recommended 25%, but this is a tension: higher retention means better depositor returns but less capital for the agent operator. The optimal rate depends on whether the agent can self-fund from its operator cut, which depends on its cost structure.

3. **Should agents accept capital at all?** The honest conclusion from our analysis is that many agents do not need external capital. Their costs are low, their margins are high, and they can self-fund from revenue within weeks. The capital model works best for agents with high compute costs (GPU inference, large context windows) or agents that need to pre-fund sub-agent services at scale.

4. **How do share prices interact with agent reputation?** If an agent's share price is its performance metric, agents are incentivised to minimise vault spending (which hurts NAV) even when spending would be profitable long-term. This creates a short-termism bias.

### 10.2 Areas Requiring Further Modelling

1. **Demand elasticity:** How does the agent's pricing affect demand? If the agent raises prices to improve unit economics, does demand drop? What is the optimal price point?

2. **Multi-agent Nash equilibrium:** When multiple agents compete for the same jobs, what is the equilibrium pricing? Do vaulted agents (with capital) have a competitive advantage over non-vaulted agents?

3. **Token velocity:** How frequently do shares change hands? High velocity means depositors are trading, not investing. Low velocity means the shares are illiquid.

4. **Correlation risk:** If all agents use Claude API and Anthropic raises prices, all agents' economics deteriorate simultaneously. Depositors diversified across multiple agent vaults would still face correlated risk.

### 10.3 Empirical Validation Needs

Before committing to this economic model, BlockHelix should empirically validate:

1. **Actual agent compute costs** across a range of job types (not just code patches).
2. **Demand curves** -- how many clients will pay $5 for an AI code patch? Is there a market at this price?
3. **Capital deployment speed** -- can the agent actually spend capital faster than it accumulates?
4. **Depositor behaviour** -- will depositors accept the risk profile? Or will they prefer the risk-free USDC lending rate?

---

## Appendix A: Simulation Code

The full simulation code is available at `/Users/will/dev/agent-hackathon/economic-model/simulate.py`. It includes:

- Core vault simulator with deposit, withdraw, receive_revenue, and spend operations
- Share price dynamics walkthrough
- Free-rider analysis
- Capital efficiency scenario modelling (Scenarios A-D)
- Fee cascade model for N-deep agent supply chains
- Governance model comparison (fixed, revenue-linked, milestone)
- Failure mode quantification (idle capital, negative economics, capital flight, MEV)
- Comparative ROI analysis vs. alternatives
- First-depositor inflation attack analysis
- Optimal TVL formula derivation

### Key Simulation Results

**Capital efficiency at realistic costs ($0.49/job, $5/job revenue):**

| Demand | Optimal TVL | Monthly Yield | APY |
|--------|-------------|---------------|-----|
| 50 jobs/mo | $234 | 4.68% | 73.1% |
| 100 jobs/mo | $348 | 12.03% | 290.9% |
| 200 jobs/mo | $577 | 18.00% | 628.9% |

These yields look attractive, but note the tiny TVL amounts. The agent only needs hundreds of dollars, not thousands.

**Fee cascade efficiency loss by supply chain depth (40% spend ratio):**

| Chain Depth | Efficiency | Overhead |
|-------------|------------|----------|
| 1 | 70.0% | 30.0% |
| 2 | 65.8% | 34.2% |
| 3 | 59.3% | 40.7% |
| 5 | 53.8% | 46.2% |

---

## Appendix B: References

1. OpenZeppelin. "A Novel Defense Against ERC4626 Inflation Attacks." [blog.openzeppelin.com](https://blog.openzeppelin.com/a-novel-defense-against-erc4626-inflation-attacks)

2. Ethereum Foundation. "ERC-4626: Tokenized Vault Standard." [ethereum.org/developers/docs/standards/tokens/erc-4626](https://ethereum.org/developers/docs/standards/tokens/erc-4626/)

3. OpenZeppelin. "ERC-4626 Documentation." [docs.openzeppelin.com/contracts/5.x/erc4626](https://docs.openzeppelin.com/contracts/5.x/erc4626)

4. Ethereum Magicians. "Address EIP-4626 inflation attacks with virtual shares and assets." [ethereum-magicians.org/t/address-eip-4626-inflation-attacks-with-virtual-shares-and-assets/12677](https://ethereum-magicians.org/t/address-eip-4626-inflation-attacks-with-virtual-shares-and-assets/12677)

5. Kim, T.W. "Deep learning and principal-agent problems of algorithmic governance." Technology in Society, 2020. [sciencedirect.com](https://www.sciencedirect.com/science/article/abs/pii/S0160791X19306906)

6. World Trade Organization. "Trade costs and the cascade effect in supply chains." ERSD-2017-02. [wto.org](https://www.wto.org/english/res_e/reser_e/ersd201702_e.pdf)

7. "Autonomous Agents on Blockchains." arXiv:2601.04583. [arxiv.org](https://www.arxiv.org/pdf/2601.04583)

8. "AI-Based Crypto Tokens: The Illusion of Decentralized AI?" arXiv:2505.07828. [arxiv.org](https://arxiv.org/pdf/2505.07828)

9. Kaal, W. "Blockchain Solutions for Agency Problems in Corporate Governance." [clsbluesky.law.columbia.edu](https://clsbluesky.law.columbia.edu/2019/05/23/blockchain-solutions-for-agency-problems-in-corporate-governance/)

10. MixBytes. "Overview of the Inflation Attack." [mixbytes.io/blog/overview-of-the-inflation-attack](https://mixbytes.io/blog/overview-of-the-inflation-attack)

---

*Analysis produced for the BlockHelix project, Colosseum Agent Hackathon, February 2026. All models use real API pricing as of January 2026. Simulation code is deterministic and reproducible.*
