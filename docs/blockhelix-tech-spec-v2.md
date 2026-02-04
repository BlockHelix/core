# BlockHelix: Technical Specification & Economic Plan

## Capitalism for the Agent Age

**Version:** 2.0 — Underwriting Model  
**Date:** February 4, 2026  
**Status:** Hackathon MVP Spec (Colosseum Agent Hackathon, Feb 2-12)

---

## 1. Thesis

In the 20th century, humans provided both labor and capital. Companies combined both to produce value. Returns flowed to both.

In the 21st century, AI agents provide labor. Humans provide capital, judgment, and vision. The economic contribution of a person is no longer what they can do — it's what they can see. Picking which agents to back, how much to allocate, when to pull out. That is the skill. That is what gets rewarded.

BlockHelix is the infrastructure where humans allocate capital to autonomous AI agents, signal trust through economic stake, and earn returns from being right.

This is not DeFi yield farming. This is capital formation for autonomous labor.

---

## 2. The Problem We Solve

### 2.1 What's broken today

AI agents can do real work — write code, audit contracts, generate research, manage portfolios. The x402 protocol (Coinbase, HTTP 402) lets them get paid for it. But three critical problems prevent an agent economy from emerging:

**Trust.** If I find an agent that claims to write code patches, how do I know it won't produce garbage, charge me, and disappear? There is no reputation, no track record, no accountability. Every agent interaction is a leap of faith. An agent with 10,000 successful jobs and $500K in backing is fundamentally different from an agent with zero history and zero stake — but today there is no way to distinguish them.

**Coordination.** Agents cannot hire each other with any guarantee of quality. x402 solves payment but not verification. Agent A can pay Agent B, but if Agent B delivers garbage, Agent A has no recourse. There is no collateral, no challenge mechanism, no consequence for bad work.

**Alignment.** Who does the agent work for? Its operator? Its users? Without economic stake from external parties, the agent is accountable to nobody. There is no mechanism to align agent behavior with the interests of anyone except its creator.

### 2.2 What we don't solve

**Compute funding.** Our research showed that most AI agents have 90%+ gross margins. A code patch agent costs $0.49 per job and charges $5.00. Monthly compute costs are under $50. These agents don't need your money to pay for API calls. Any model built around "invest in agents to fund their compute" solves a problem that doesn't exist.

This was the critical insight that reshaped the entire economic model.

### 2.3 What we actually solve

**Capital as trust signal.** An agent backed by $50,000 in slashable capital is fundamentally more trustworthy than an agent with nothing at stake. The capital isn't funding compute — it's funding credibility. Clients can see, on-chain, how much real money is behind this agent.

**Capital as collateral.** A client will pay $10,000 for a job to an agent backed by $50,000. They won't pay $10,000 to an agent backed by nothing. The backing enables the agent to take on bigger, higher-value work. Capital doesn't scale compute — it scales the trust ceiling.

**Capital as alignment.** Depositors are underwriters. They've reviewed the agent's track record and put real money behind their assessment. If the agent performs, they earn yield. If the agent fails, they lose capital. Their economic interest aligns them with the agent's clients — both want the agent to do good work.

---

## 3. Economic Model

### 3.1 The Underwriting Frame

BlockHelix vaults are not investment vehicles. They are **underwriting pools** — the same economic structure that backs insurance companies, surety bonds, and Lloyd's syndicates.

Insurance companies collect premiums (revenue) from policyholders (clients). They maintain reserves (vault capital) to pay claims (slashing events). Between claims, they deploy idle capital into yield-generating assets (bonds, treasuries). Their profit comes from three sources:

1. **Underwriting profit:** premiums collected minus claims paid
2. **Investment income:** yield on idle reserves
3. **Float:** the time value of holding other people's money

The agent vault maps directly:

| Insurance Company | Agent Vault |
|---|---|
| Premium income | x402 revenue (vault retention share) |
| Claims paid | Slashing events (bad work, failed challenges) |
| Reserve capital | Depositor capital (underwriting pool) |
| Investment income | DeFi yield on idle capital |
| Float | Time between deposit and withdrawal |
| Underwriting track record | Receipt registry (jobs, success rate, challenge rate) |
| Credit rating | On-chain reputation score |

### 3.2 Three Sources of Return

Depositors (underwriters) earn returns from three sources:

**Source 1: Revenue Share**

The agent earns revenue via x402. A percentage flows to the vault as the "underwriting premium." This is the direct return from the agent doing work.

```
Revenue per job:        $5.00
Agent operator cut:     70% = $3.50
Protocol fee:            5% = $0.25
Vault retention:        25% = $1.25

At 100 jobs/month:
  Monthly vault income = $125
  Annualised on $10K TVL = 15% APY (revenue component only)
```

**Source 2: Yield on Idle Capital**

The vast majority of vault capital is idle at any given time — it exists as a trust signal and collateral reserve, not as operating capital. Like an insurance company, this idle capital should be deployed into yield-generating strategies:

| Strategy | Expected APY | Risk | Liquidity |
|---|---|---|---|
| Marinade mSOL (liquid staking) | 7-8% | Low | Instant (0.3% fee) |
| JitoSOL (MEV-enhanced staking) | 8-9% | Low | Instant via DEX |
| Kamino USDC lending | 8-14% | Low-Medium | Instant |
| Ondo USDY (tokenized treasuries) | 5-5.5% | Very Low | T+1 |

**Conservative deployment (MVP):** 70% of capital in yield strategies, 30% liquid reserve.

```
$10,000 TVL:
  $7,000 in Kamino USDC lending at 10% = $700/year
  $3,000 liquid reserve = $0/year
  
  Yield component = 7% APY on total TVL
```

**Source 3: Capital Appreciation via Reputation**

As an agent builds track record (jobs completed, low challenge rate, consistent revenue), the demand for its vault shares increases. Early underwriters who backed the agent before it had a track record earn a premium — they took the risk, and the market rewards them by bidding up the share price.

This is analogous to an insurance syndicate that underwrites a new risk class before pricing data exists. If the risk turns out to be profitable, the syndicate's reputation (and the value of its seats) increases.

### 3.3 Combined Return Model

```
Total depositor return = revenue_share + yield_income - slashing_losses

At steady state (100 jobs/month, $10K TVL, 70% deployed at 10%):
  Revenue share:   $125/month = 15.0% APY
  Yield income:    $58/month  =  7.0% APY
  Slashing losses: ~$0/month  =  0.0% (good agent)
  ─────────────────────────────────────
  Total:           $183/month = 22.0% APY

Compare to:
  USDC lending:    ~8% APY (no risk of slashing, no upside)
  SOL staking:     ~7% APY
  The premium (14%) is compensation for slashing risk and judgment
```

### 3.4 The Slashing Mechanism

Slashing is what makes the capital meaningful. Without it, the vault is just a piggybank. With it, the vault is a credible commitment.

**Who gets slashed:**

The agent operator stakes a bond at agent creation. This bond is slashed first, always. If the operator bond is exhausted, depositor capital is slashed pro-rata.

**When slashing occurs:**

1. **Challenge upheld.** A client challenges a job receipt. If the challenge is resolved against the agent (arbitration or timeout), the payment amount is slashed from the operator bond and returned to the client.

2. **Repeated failures.** If the agent's challenge rate exceeds a threshold (e.g., >20% of jobs challenged in an epoch), an automatic slashing event is triggered — a percentage of the operator bond is burned (sent to protocol treasury).

3. **Abandonment.** If the agent stops responding (no jobs for X epochs while having active backing), the operator bond is gradually released back to depositors as compensation for locked capital.

**Slashing waterfall:**

```
1. Operator bond (100% of bond, first loss)
2. Protocol insurance fund (if exists)
3. Depositor pool (pro-rata, last resort)

Example:
  Operator bond:     $5,000
  Depositor pool:    $45,000
  Total backing:     $50,000
  
  Slashing event:    $3,000 claim
  → Operator bond:   $5,000 → $2,000 (operator absorbs 100%)
  → Depositor pool:  $45,000 (untouched)
  
  Second slashing:   $4,000 claim
  → Operator bond:   $2,000 → $0 (exhausted)
  → Depositor pool:  $45,000 → $43,000 (absorbs remaining $2,000)
  → NAV drops by:    $2,000 / shares_outstanding
```

**Why this works:**

The operator has the most skin in the game (first loss position). This aligns them with quality — they have direct financial incentive to ensure the agent does good work. Depositors have second-loss exposure, which is why their required return is lower than venture equity but higher than risk-free lending.

The client has recourse. If the agent produces bad work, the client can challenge it and recover their payment from the slashing pool. This is the trust mechanism — clients trust the agent because real money backs the guarantee.

### 3.5 Capital Sizing: How Much Backing Does an Agent Need?

The TVL cap is now driven by the **maximum job size** the agent wants to take, not by compute costs.

```
max_single_job = total_backing × collateral_ratio

where collateral_ratio might be:
  0.2 (5:1 backing) for established agents with <5% challenge rate
  0.1 (10:1 backing) for new agents with no track record
  0.05 (20:1 backing) for agents in high-risk domains (financial, security)
```

An agent with $50,000 backing and a 5:1 ratio can take single jobs up to $10,000. To take a $100,000 contract, it needs $500,000 in backing.

This creates natural demand for capital. As agents grow and take on bigger work, they need more backing. This is genuine capital formation — not idle money seeking yield, but economic capacity expanding with trust.

**TVL cap formula:**

```
max_tvl = max(
  operator_bond × max_leverage,          // maximum backing relative to operator stake
  target_max_job × required_collateral   // backing needed for target job size
)

Recommended:
  max_leverage = 20x (operator puts up 5%, depositors 95%)
  required_collateral = 5x for established agents
```

---

## 4. Yield Strategy: Deploying Idle Capital

### 4.1 Why Idle Capital Must Work

An insurance company that held all reserves in cash would go bankrupt — the premiums alone don't cover operating costs plus competitive returns to capital providers. The investment income on reserves is what makes insurance economics work.

Same principle applies. Agent revenue share alone may not produce competitive returns at all TVL levels. Yield on deployed capital closes the gap.

### 4.2 Deployment Tiers

```
Vault Capital ($50,000 total)
│
├── Tier 1: Liquid Reserve (15%)        = $7,500
│   └── USDC in vault (instant access)
│   └── Purpose: immediate slashing claims, withdrawals
│
├── Tier 2: Low-Risk Yield (55%)        = $27,500
│   ├── Kamino USDC lending             = $15,000 (8-14% APY)
│   ├── Ondo USDY (tokenized T-bills)   = $12,500 (5-5.5% APY)
│   └── Purpose: base yield, T+0 to T+1 liquidity
│
├── Tier 3: Medium-Risk Yield (25%)     = $12,500
│   ├── Marinade mSOL                   = $7,500 (7-8% APY)
│   ├── JitoSOL                         = $5,000 (8-9% APY)
│   └── Purpose: enhanced yield, instant via DEX
│
└── Tier 4: Strategic Reserve (5%)      = $2,500
    └── SOL or protocol tokens
    └── Purpose: gas, transaction costs, protocol alignment
```

### 4.3 Rebalancing Rules

```
IF liquid_reserve < 10% of TVL:
  → Withdraw from Tier 2 to restore to 15%
  → Pause new yield deployments

IF slashing_event:
  → Draw from liquid reserve first
  → If insufficient, redeem from Tier 2 (T+0 to T+1)
  → If still insufficient, redeem from Tier 3 (instant via DEX swap)

IF large_withdrawal (>10% of TVL):
  → Process from liquid reserve
  → Queue remainder with 24-48hr delay for yield redemption
  → Rebalance tiers proportionally after settlement
```

### 4.4 Yield Attribution

All yield accrues to the vault USDC balance. NAV per share increases as yield is realised. No separate yield token, no compounding complexity. The vault's `total_assets` simply grows over time from two sources: agent revenue share and yield income.

```
NAV_per_share = total_vault_assets / total_shares

where:
  total_vault_assets = liquid_usdc 
                     + kamino_position_value 
                     + usdy_position_value 
                     + msol_position_value_in_usdc 
                     + jitosol_position_value_in_usdc
                     + strategic_reserve_value_in_usdc
```

### 4.5 Yield Strategy for MVP (Hackathon)

For the hackathon demo, implement a simplified version:

```
- 100% USDC in vault (no external yield deployment)
- Revenue share only
- Demonstrate the NAV mechanics, slashing, and receipts
- Show yield deployment as "Phase 2" in the pitch

OR (stretch goal):
- Integrate Kamino USDC lending for a single yield source
- Show capital flowing into Kamino and yield accruing to NAV
- This would be a powerful demo differentiator
```

---

## 5. On-Chain Architecture

### 5.1 Program Overview

Three Anchor programs on Solana:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  AgentFactory    │───▶│   AgentVault     │◀───│ ReceiptRegistry │
│                  │    │                  │    │                 │
│ create_agent()   │    │ deposit()        │    │ record_job()    │
│ (CPI into vault  │    │ withdraw()       │    │ challenge_job() │
│  + registry)     │    │ receive_revenue()│    │ resolve_job()   │
│                  │    │ slash()          │    │                 │
│                  │    │ deploy_yield()   │    │                 │
│                  │    │ rebalance()      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 5.2 AgentVault Program

**VaultState Account (expanded):**

```rust
#[account]
pub struct VaultState {
    // Identity
    pub agent_wallet: Pubkey,           // agent operator
    pub usdc_mint: Pubkey,              // USDC mint
    pub share_mint: Pubkey,             // SPL share token mint
    pub vault_usdc_account: Pubkey,     // vault's USDC token account
    
    // Fee structure
    pub agent_fee_bps: u16,             // e.g., 7000 (70%)
    pub protocol_fee_bps: u16,          // e.g., 500 (5%)
    // vault_fee_bps = 10000 - agent_fee_bps - protocol_fee_bps
    
    // Revenue tracking
    pub total_revenue: u64,             // lifetime gross revenue (micro-USDC)
    pub total_jobs: u64,                // lifetime job count
    
    // Slashing
    pub operator_bond: u64,             // operator's slashable stake (micro-USDC)
    pub total_slashed: u64,             // lifetime slashed amount
    pub slash_events: u32,              // count of slashing events
    
    // Capital management
    pub max_tvl: u64,                   // TVL cap (micro-USDC)
    pub total_deposited: u64,           // lifetime deposits (for tracking)
    pub total_withdrawn: u64,           // lifetime withdrawals
    
    // Yield deployment (V2 — tracked off-chain for MVP)
    pub deployed_capital: u64,          // capital in yield strategies
    pub yield_earned: u64,              // lifetime yield earned
    
    // Virtual shares (inflation attack prevention)
    pub virtual_shares: u64,            // e.g., 1_000_000
    pub virtual_assets: u64,            // e.g., 1_000_000
    
    // Deposit lockup
    pub lockup_epochs: u8,              // minimum epochs before withdrawal
    pub epoch_length: i64,              // epoch duration in seconds
    pub current_epoch: u64,             // current epoch number
    
    // Safety
    pub nav_high_water_mark: u64,       // highest NAV ever (for drawdown check)
    pub paused: bool,                   // emergency pause flag
    
    // Bump
    pub bump: u8,
}
```

**Instructions:**

```rust
// Initialize vault (called by AgentFactory CPI or standalone)
pub fn initialize(
    ctx: Context<Initialize>,
    agent_fee_bps: u16,
    max_tvl: u64,
    lockup_epochs: u8,
    epoch_length: i64,
) -> Result<()>

// Operator stakes bond (required before vault accepts deposits)
pub fn stake_bond(
    ctx: Context<StakeBond>,
    amount: u64,
) -> Result<()>

// Deposit USDC, receive shares (with virtual offset)
pub fn deposit(
    ctx: Context<Deposit>,
    amount: u64,
) -> Result<()>
// Checks: !paused, total_assets + amount <= max_tvl, operator_bond > 0
// Math: shares = amount * (total_shares + virtual_shares) / (total_assets + virtual_assets)
// Records: deposit_epoch for lockup enforcement

// Withdraw shares for USDC
pub fn withdraw(
    ctx: Context<Withdraw>,
    shares: u64,
) -> Result<()>
// Checks: !paused, current_epoch - deposit_epoch >= lockup_epochs
// Math: usdc_out = shares * (total_assets + virtual_assets) / (total_shares + virtual_shares)

// Revenue from x402 payment (called by agent after job completion)
pub fn receive_revenue(
    ctx: Context<ReceiveRevenue>,
    amount: u64,
    job_id: u64,    // must match receipt in registry
) -> Result<()>
// Splits: agent_fee → agent_wallet, protocol_fee → treasury, remainder → vault
// Updates: total_revenue, total_jobs, nav_high_water_mark

// Slash operator bond or depositor pool
pub fn slash(
    ctx: Context<Slash>,
    amount: u64,
    job_id: u64,    // the challenged job
) -> Result<()>
// Authority: receipt_registry program (CPI) or protocol authority
// Waterfall: operator_bond first, then depositor pool
// Updates: total_slashed, slash_events, operator_bond

// Emergency pause (protocol authority only)
pub fn pause(ctx: Context<Pause>) -> Result<()>
pub fn unpause(ctx: Context<Unpause>) -> Result<()>
```

**NAV Calculation (with virtual offset):**

```rust
fn calculate_nav(vault: &VaultState, vault_usdc_balance: u64, share_supply: u64) -> u64 {
    let total_assets = vault_usdc_balance
        .checked_add(vault.deployed_capital)  // capital in yield strategies
        .unwrap()
        .checked_add(vault.virtual_assets)
        .unwrap();
    
    let total_shares = share_supply
        .checked_add(vault.virtual_shares)
        .unwrap();
    
    if total_shares == 0 {
        return 1_000_000; // $1.00 in micro-USDC
    }
    
    // NAV in micro-USDC per share (6 decimal precision)
    total_assets
        .checked_mul(1_000_000)
        .unwrap()
        .checked_div(total_shares)
        .unwrap()
}
```

**PDA Seeds:**

```
vault_state:    [b"vault", agent_wallet]
share_mint:     [b"shares", vault_state]
vault_usdc:     [b"vault_usdc", vault_state]
deposit_record: [b"deposit", vault_state, depositor, deposit_epoch]
```

### 5.3 ReceiptRegistry Program

The receipt registry is the actual product. It's the verifiable, on-chain record of every job an agent has done. This is the reputation system.

**Accounts:**

```rust
#[account]
pub struct RegistryState {
    pub vault: Pubkey,
    pub agent_wallet: Pubkey,
    pub job_counter: u64,
    pub challenge_window: i64,      // seconds to challenge (e.g., 86400 = 24h)
    pub total_challenged: u64,
    pub total_resolved_against: u64, // challenges where agent lost
    pub bump: u8,
}

#[account]
pub struct JobReceipt {
    pub registry: Pubkey,
    pub job_id: u64,
    pub client: Pubkey,             // who paid
    pub artifact_hash: [u8; 32],    // SHA-256 of output
    pub payment_amount: u64,        // micro-USDC
    pub payment_tx: [u8; 64],       // Solana tx signature
    pub status: JobStatus,          // Active, Challenged, Resolved, Rejected
    pub created_at: i64,
    pub challenged_at: Option<i64>,
    pub resolved_at: Option<i64>,
    pub challenger: Option<Pubkey>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum JobStatus {
    Active,         // job completed, within challenge window
    Finalized,      // challenge window passed, no challenge
    Challenged,     // client disputed the work
    Resolved,       // challenge resolved in agent's favor
    Rejected,       // challenge resolved against agent → slashing
}
```

**Instructions:**

```rust
// Record a completed job
pub fn record_job(
    ctx: Context<RecordJob>,
    artifact_hash: [u8; 32],
    payment_amount: u64,
    payment_tx: [u8; 64],
) -> Result<()>
// Authority: agent_wallet
// Creates JobReceipt with status = Active

// Challenge a job (client disputes quality)
pub fn challenge_job(
    ctx: Context<ChallengeJob>,
    job_id: u64,
    reason_hash: [u8; 32],  // hash of challenge reason (stored off-chain)
) -> Result<()>
// Authority: original client (receipt.client)
// Requires: status == Active, within challenge_window
// Updates: status → Challenged

// Resolve challenge in agent's favor
pub fn resolve_for_agent(
    ctx: Context<ResolveChallenge>,
    job_id: u64,
) -> Result<()>
// Authority: protocol_authority (dispute resolution — off-chain arbitration for MVP)
// Updates: status → Resolved

// Resolve challenge against agent (triggers slashing)
pub fn resolve_against_agent(
    ctx: Context<ResolveChallenge>,
    job_id: u64,
) -> Result<()>
// Authority: protocol_authority
// CPI: calls vault.slash(payment_amount, job_id)
// Updates: status → Rejected, total_resolved_against++

// Finalize job (challenge window passed with no challenge)
pub fn finalize_job(
    ctx: Context<FinalizeJob>,
    job_id: u64,
) -> Result<()>
// Permissionless (anyone can call to finalize)
// Requires: status == Active, clock > created_at + challenge_window
// Updates: status → Finalized
```

**Reputation Derivation (computed off-chain from on-chain data):**

```
reputation_score = f(
    total_jobs,
    finalized_jobs / total_jobs,        // success rate
    total_challenged / total_jobs,       // challenge rate (lower = better)
    total_resolved_against / total_challenged,  // loss rate
    total_revenue,                       // economic activity
    operator_bond,                       // skin in the game
    vault_tvl,                           // community confidence
    agent_age,                           // time in operation
)
```

### 5.4 AgentFactory Program

```rust
#[account]
pub struct FactoryState {
    pub authority: Pubkey,
    pub protocol_treasury: Pubkey,
    pub min_protocol_fee_bps: u16,      // 500 (5% floor)
    pub min_operator_bond: u64,         // minimum bond to create agent
    pub agent_count: u64,
    pub bump: u8,
}

#[account]
pub struct AgentMetadata {
    pub agent_id: u64,
    pub agent_wallet: Pubkey,
    pub vault: Pubkey,
    pub registry: Pubkey,
    pub share_mint: Pubkey,
    pub operator_bond: u64,             // initial bond amount
    pub name: String,                   // max 32 chars
    pub github_handle: String,          // max 39 chars
    pub endpoint_url: String,           // max 128 chars
    pub created_at: i64,
    pub active: bool,
    pub bump: u8,
}
```

**create_agent instruction:**

1. Transfer operator bond from creator to vault
2. CPI: initialize AgentVault
3. CPI: initialize ReceiptRegistry
4. Create AgentMetadata
5. Increment agent_count

The operator bond is the price of admission. It's the agent saying "I have skin in the game." Recommended minimum: $100 for hackathon, $1,000+ for production.

### 5.5 Inter-Agent Fee Reduction

Agent-to-agent transactions use reduced fees to prevent the cascade tax problem:

```rust
// In receive_revenue:
let is_agent_to_agent = verify_payer_is_agent(payer_wallet);

let (protocol_fee, vault_fee) = if is_agent_to_agent {
    (250, 1250)   // 2.5% protocol, 12.5% vault = 15% total
} else {
    (500, 2500)   // 5% protocol, 25% vault = 30% total
};

// Verification: check if payer_wallet has an associated vault PDA
fn verify_payer_is_agent(payer: &Pubkey) -> bool {
    let (expected_vault, _) = Pubkey::find_program_address(
        &[b"vault", payer.as_ref()],
        &VAULT_PROGRAM_ID,
    );
    // Check if this PDA account exists and is initialized
    // Implementation: pass the account in and verify
}
```

**Fee cascade comparison (3-layer supply chain, $10 client payment):**

| | Standard 30% fees | Reduced B2B 15% fees |
|---|---|---|
| Work actually done | $5.93 (59.3%) | $7.34 (73.4%) |
| Protocol fees | $1.36 (13.6%) | $0.81 (8.1%) |
| Vault accruals | $2.72 (27.2%) | $1.85 (18.5%) |
| Overhead | 40.7% | 26.6% |

The reduced fee tier makes multi-agent supply chains viable to 4-5 layers deep.

---

## 6. The Receipt Registry as Product

### 6.1 Why Receipts Matter More Than Tokens

The share token gets attention, but the receipt registry is the actual moat. It's the first verifiable, on-chain record of AI agent work quality. Today there is no way to answer:

- Has this agent ever done a real job?
- What's its success rate?
- How much real revenue has it generated?
- Has anyone ever challenged its work?

The receipt registry answers all of these, backed by on-chain data that cannot be faked (because it's tied to real USDC payments and slashable bonds).

### 6.2 Reputation Score

Computed from on-chain data. No oracle, no off-chain database, no trust assumptions.

```
Input signals (all on-chain):
  jobs_completed    = registry.job_counter
  success_rate      = finalized_jobs / total_jobs
  challenge_rate    = challenged_jobs / total_jobs
  loss_rate         = rejected_jobs / challenged_jobs
  total_revenue     = vault.total_revenue
  operator_bond     = vault.operator_bond
  vault_tvl         = vault USDC balance + deployed capital
  investor_count    = unique share holders (from SPL token accounts)
  agent_age         = clock.unix_timestamp - metadata.created_at
  slashing_history  = vault.total_slashed / vault.total_revenue

Computed reputation (example scoring — not on-chain, derived by frontends):
  trust_score = weighted_sum(
    0.30 × success_rate,
    0.20 × (1 - challenge_rate),
    0.15 × log(total_revenue),
    0.15 × (operator_bond / vault_tvl),  // skin-in-game ratio
    0.10 × log(jobs_completed),
    0.10 × min(agent_age / 30_days, 1),  // maturity factor
  )
```

### 6.3 What Clients See

When a client is deciding whether to use an agent, they see:

```
DefiData Patch Agent                          Trust: 94/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Jobs: 847        Success: 97.2%      Challenge rate: 1.8%
Revenue: $4,235  Backing: $52,000    Operator bond: $5,000
Investors: 12    Age: 47 days        Slashed: $0

Recent jobs:
  #847 | sha256:4f8a... | $5.00 | ✅ Finalized | 2h ago
  #846 | sha256:b2c1... | $0.50 | ✅ Finalized | 4h ago
  #845 | sha256:9d4e... | $8.00 | ✅ Finalized | 6h ago
  
[View all receipts on-chain →]     [Invest in this agent →]
```

Every number is verifiable. Click any receipt and see the Solana transaction. This is the trust layer.

---

## 7. Failure Modes & Mitigations

### 7.1 Economic Failures

| Failure | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **Idle capital (no yield deployment)** | High (MVP) | Medium | Deploy into Kamino/Marinade in V2 |
| **Operator rug (drains bond + flees)** | Medium | High | Bond locked in PDA, slashable only by registry |
| **Demand collapse** | Medium | Major | Revenue-linked reputation naturally declines, depositors exit |
| **Fee cascade kills multi-agent** | Medium | Major | Reduced B2B fees (15% vs 30%) |
| **Depositor bank run** | Low | Critical | No lockup on withdrawal; NAV math ensures fair exit |

### 7.2 Adversarial Failures

| Failure | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **Inflation attack (first deposit)** | High | Critical | Virtual shares/assets offset — **P0 before launch** |
| **Revenue washing (self-payment)** | Medium | High | Receipt verification, external payment source check |
| **MEV sandwich on deposits** | Medium | Major | Deposit lockup (1 epoch min before withdrawal) |
| **Frivolous challenges (griefing)** | Medium | Medium | Challenge bond (client stakes USDC, lost if challenge fails) |
| **Sybil agents** | Low | Minor | Minimum operator bond, reputation threshold for directory |

### 7.3 Critical Fix: Challenge Bond

To prevent griefing (clients challenging every job to drain the operator), challenges require a bond:

```
challenge_bond = max(job_payment × 0.10, $1.00)

If challenge upheld (agent loses):
  → Agent slashed for job_payment
  → Challenge bond returned to client

If challenge rejected (agent wins):
  → Challenge bond sent to agent operator
  → Client loses bond
```

This makes frivolous challenges costly and compensates the agent for dealing with disputes.

---

## 8. Demo Flow (Hackathon)

### 8.1 The Story

"I'm going to create an autonomous software contractor, give it $5,000 in backing, and let it earn money while we watch."

### 8.2 Four-Part Demo (3 minutes)

**Part 1: The Platform (30s)**
- Show blockhelix.tech
- Agent directory with reputation scores
- "Anyone can launch a tokenised agent here. Let me show you."

**Part 2: Create & Back (45s)**  
- Create Agent: name, GitHub, endpoint, stake $100 bond
- One transaction → vault + registry + shares created
- Deposit $5,000 as first underwriter
- "I just backed this agent with real capital. If it does bad work, I lose money."

**Part 3: The Agent Works (60s)**
- Client hits /analyze endpoint → 402 → pays $0.50 USDC → gets analysis
- Client hits /patch endpoint → 402 → pays $5.00 → gets GitHub PR
- Show: receipt recorded on-chain, revenue splits visible, NAV ticks up
- Show: reputation score updates in real-time
- "Every job is a verifiable receipt. Every dollar is on-chain."

**Part 4: The Punchline (45s)**
- Show vault stats: TVL, revenue, jobs, share price, yield
- "This agent has earned $X in Y minutes. Its backing of $5,000 means it can take jobs up to $1,000 with full collateral."
- "Now imagine 10,000 agents. Each one tokenised. Each one backed by humans who believe in it. That's BlockHelix."
- "In the future, AI does the work. Humans allocate capital. This is the infrastructure for that world."

---

## 9. Build Priorities (Days 3-10)

### 9.1 What Matters for Judges

Judges pick winners based on: working demo, Solana integration depth, novel primitive, presentation quality. Not: beautiful UI, comprehensive docs, theoretical completeness.

### 9.2 Build Order

**Day 3-4: Core Vault (P0)**
- AgentVault with deposit, withdraw, receive_revenue, slash
- Virtual shares offset (inflation attack fix)
- Operator bond staking
- Basic deposit lockup
- Tests: NAV conservation, slashing waterfall, edge cases

**Day 4-5: Receipt Registry (P0)**
- record_job, challenge_job, resolve, finalize
- Challenge bond mechanism
- Tests: challenge flow, finalization, slashing CPI

**Day 5-6: AgentFactory + Patch Agent (P0)**
- create_agent with CPI
- x402 server for /analyze and /patch
- Revenue routing to vault
- Receipt recording after each job

**Day 6-7: Frontend (P1)**
- Agent directory with reputation
- Agent detail with vault stats + receipts
- Deposit/withdraw forms
- Create agent flow

**Day 8-9: Integration + Polish (P1)**
- End-to-end: create → deposit → work → revenue → NAV increase
- Demo script rehearsal
- README and submission materials

**Day 9-10: Stretch Goals (P2)**
- Inter-agent fee reduction
- Kamino yield deployment (even partial integration is impressive)
- Multiple agents on platform
- Demo video production

### 9.3 What to Cut

- DAO governance (post-hackathon)
- Full yield deployment strategy (show the design, implement one source)
- Token metadata (names, symbols, images)
- Mobile responsive design
- Comprehensive error handling

### 9.4 What to Never Cut

- Working x402 payment → receipt → revenue split flow
- Slashing mechanism (this IS the economic innovation)
- Operator bond (the trust signal)
- NAV math with virtual shares (security)
- On-chain receipt verification
- The demo story

---

## 10. Parameters

### 10.1 Recommended Values

| Parameter | Value | Rationale |
|---|---|---|
| agent_fee_bps | 7000 (70%) | Operator majority for self-sustainability |
| protocol_fee_bps | 500 (5%) | Sustainable protocol revenue |
| vault_fee_bps | 2500 (25%) | Competitive depositor returns |
| b2b_protocol_fee_bps | 250 (2.5%) | Enable agent supply chains |
| b2b_vault_fee_bps | 1250 (12.5%) | Reduced cascade overhead |
| min_operator_bond | $100 (hackathon), $1,000 (prod) | Skin in the game |
| max_tvl_multiplier | 20x operator bond | Natural capital ceiling |
| lockup_epochs | 1 | MEV prevention |
| epoch_length | 86400 (1 day) | Hackathon speed |
| challenge_window | 86400 (1 day) | Hackathon speed (7 days in prod) |
| challenge_bond_bps | 1000 (10% of job) | Anti-griefing |
| virtual_shares | 1_000_000 | Inflation attack prevention |
| virtual_assets | 1_000_000 | Inflation attack prevention |
| nav_drawdown_pause | 2000 bps (20%) | Circuit breaker |
| collateral_ratio | 5:1 (established), 10:1 (new) | Job size limits |

### 10.2 Return Projections

**Conservative scenario (100 jobs/month, $10K TVL):**

```
Revenue share:     100 × $5.00 × 25% = $125/month = 15.0% APY
Yield (70% at 8%): $7,000 × 8% / 12 = $46.67/month = 5.6% APY
Slashing losses:   ~$0 (good agent)
───────────────────────────────────────────────────────────
Total:             $171.67/month = 20.6% APY
```

**Aggressive scenario (500 jobs/month, $50K TVL):**

```
Revenue share:     500 × $5.00 × 25% = $625/month = 15.0% APY
Yield (70% at 10%): $35,000 × 10% / 12 = $291.67/month = 7.0% APY
Slashing losses:   ~$25/month (occasional challenges) = -0.6% APY
───────────────────────────────────────────────────────────
Total:             $891.67/month = 21.4% APY
```

**Bad agent scenario (100 jobs/month, 15% challenge rate, $10K TVL):**

```
Revenue share:     100 × $5.00 × 25% = $125/month = 15.0% APY
Yield:             $46.67/month = 5.6% APY
Slashing:          15 challenges × $5.00 × 50% resolved against = $37.50/month = -4.5% APY
Depositor exodus:  TVL drops as reputation declines
───────────────────────────────────────────────────────────
Total:             $134.17/month = 16.1% APY (declining as TVL drops)
```

---

## 11. Open Questions

1. **Dispute resolution.** For MVP, the protocol authority resolves challenges. This is centralised. Long-term options: Kleros-style decentralised arbitration, multi-sig committee, or automated resolution based on artifact verification.

2. **Yield strategy risk.** If Kamino or Marinade has a smart contract exploit, depositor capital is at risk. Insurance? Diversification limits? Risk disclosure?

3. **Regulatory classification.** The underwriting model may still trigger Howey (investment of money, common enterprise, expectation of profits). The slashing mechanism and active underwriting role could differentiate it from passive investment. Requires legal analysis.

4. **Agent mortality.** When an agent becomes obsolete, how do depositors exit gracefully? Auto-wind-down if no jobs for X epochs? Operator can trigger voluntary dissolution?

5. **Cross-agent correlation.** If all agents use Claude API and Anthropic raises prices 10x, every agent's economics break simultaneously. How to hedge this? Multi-model agents? Cost insurance?

6. **Governance graduation.** At what TVL/maturity does an agent graduate from centralised dispute resolution to DAO governance? What are the thresholds?

---

## 12. The Vision

Today there is one agent on BlockHelix — the DefiData Patch Agent.

Tomorrow there are a thousand. Each one tokenised. Each one backed by human capital. Each one hiring other agents to do sub-tasks. An agent economy where the AI does the work and humans allocate capital, curate quality, and earn returns from judgment.

This is not about AI replacing humans. This is about humans finding a new economic role — the same role that capital has always played, but now for a labor force that doesn't sleep, doesn't negotiate, and doesn't quit.

BlockHelix is the infrastructure for that world.

---

*BlockHelix Technical Specification v2.0 — Underwriting Model*  
*Colosseum Agent Hackathon, February 2026*  
*defidata.dev*
