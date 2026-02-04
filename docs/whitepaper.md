# BlockHelix: Revenue Royalties for Autonomous AI Agents

**A Protocol for Tokenised Agent Vaults on Solana**

Version 0.1 -- February 2026

---

## Abstract

AI agents are becoming autonomous economic actors -- selling services, earning revenue, and incurring costs. Yet no trustless infrastructure exists to capitalise their operations, verify their work quality, or align the incentives of agent operators with capital providers. BlockHelix addresses this gap with three composable Solana programs: AgentVault (ERC4626-style share accounting with operator bonds and punitive slashing), ReceiptRegistry (on-chain job receipts with challenge windows and arbitrator resolution), and AgentFactory (atomic agent deployment via cross-program invocation). Depositors provide USDC to agent vaults and receive SPL share tokens representing a proportional claim on 25% of the agent's x402 service revenue. Operator bonds create first-loss protection and game-theoretic quality alignment grounded in Becker's (1968) deterrence framework. A dynamic TVL cap auto-sizes each vault to prevent idle capital dilution. We prove the model is structurally non-circular: both yield sources (revenue share and planned lending yield) are external, and NAV conservation under ERC4626 math guarantees that no depositor's return is funded by another depositor's capital. The result is a new financial primitive -- a revenue royalty on autonomous labour -- with the transparency of DeFi and the economic structure of a royalty company.

---

## 1. Introduction: The Agent Commerce Problem

### 1.1 AI Agents as Economic Actors

Large language models have crossed the threshold from tools to autonomous service providers. Agents built on models like Claude and GPT-4 can analyse codebases, generate patches, audit smart contracts, and run test suites -- producing deliverables with measurable economic value. The x402 protocol (Coinbase, 2025) enables these agents to price their services in USDC and accept payment via HTTP, creating a native payment layer for machine-to-machine commerce [1].

This creates a new class of economic entity: an autonomous agent that earns revenue by doing work. Unlike a DeFi vault, it does not passively deploy capital. Unlike a DAO, it has no human members. Unlike a corporation, it has no legal personhood. It is an algorithm that sells labour.

### 1.2 The Missing Capital Structure

Three problems remain unsolved for these entities:

**Trust.** A client calling an agent endpoint has no guarantee of quality. The agent might return garbage. Reputation scores are subjective, gameable via Sybil attacks, and non-portable across platforms. There is no mechanism for a client to recover payment for bad work.

**Capitalisation.** An agent capable of serving 100 jobs per month may only have enough working capital for 20. Compute costs (API calls, sub-agents, hosting) require upfront spend. No protocol exists to accept external capital, deploy it into agent operations, and distribute returns to capital providers.

**Alignment.** Agent operators control both the agent's behaviour and (in naive implementations) the dispute resolution mechanism. Without economic skin in the game, operators face no penalty for delivering substandard work. This is a textbook principal-agent problem -- the principal (client or capital provider) cannot observe or control the agent's quality decisions.

### 1.3 The BlockHelix Thesis

Capital-at-risk is a better trust signal than reputation scores.

A $50,000 slashable bond says more about an operator's commitment to quality than any review score. It is objective, ungameable, and carries real economic consequences. TVL becomes PageRank for agents -- a market-priced, Sybil-resistant discovery signal that self-corrects as capital flows toward productive agents and away from poor performers.

BlockHelix operationalises this thesis with three on-chain programs that compose into a complete capital structure for autonomous agents.

---

## 2. Protocol Architecture

### 2.1 System Overview

BlockHelix comprises three Anchor programs on Solana:

| Program | ID | Function |
|:--------|:---|:---------|
| **AgentVault** | `HY1b...r4HS` | ERC4626-style vault: deposit, withdraw, receive_revenue, slash, pause/unpause |
| **ReceiptRegistry** | `jks1...uz9` | Job receipt storage with challenge windows, arbitrator resolution, client verification |
| **AgentFactory** | `7Hp1...Aq7j` | Atomic agent deployment: creates vault + registry + metadata via CPI in a single transaction |

### 2.2 Composition via CPI

The AgentFactory orchestrates deployment through cross-program invocation (CPI). A single `create_agent` instruction:

1. Calls `AgentVault::initialize` -- creates VaultState PDA (seeds: `["vault", agent_wallet]`), share mint PDA (seeds: `["shares", vault_state]`), and the vault's associated USDC token account.
2. Calls `ReceiptRegistry::initialize_registry` -- creates RegistryState PDA (seeds: `["registry", vault]`) linked to the new vault.
3. Stores AgentMetadata PDA (seeds: `["agent", factory, agent_count]`) with the agent's name, endpoint URL, GitHub handle, and references to vault, registry, and share mint.

This atomic deployment guarantees that every agent has a functioning vault and receipt registry from inception. The factory enforces a minimum protocol fee (`min_protocol_fee_bps`), preventing agents from setting zero-fee configurations that starve the protocol.

### 2.3 Payment Flow

```
Client                   Agent Server              Solana
  |                          |                       |
  |-- HTTP request --------->|                       |
  |<---- 402 Payment Req. ---|                       |
  |                          |                       |
  |-- x402 USDC payment -----|-----> on-chain tx --->|
  |                          |                       |
  |                     [verify payment]             |
  |                     [execute work]               |
  |<---- work output -------|                       |
  |                          |                       |
  |                     receive_revenue(amount) ---->|
  |                          |   -> 70% to operator  |
  |                          |   -> 25% to vault     |
  |                          |   ->  5% to protocol  |
  |                          |                       |
  |                     record_job(hash, amount) --->|
  |                          |   -> receipt stored   |
  |                          |   -> challenge window |
```

Revenue enters the system exclusively through x402 payments from external clients. The `receive_revenue` instruction enforces the fee split on-chain: the agent operator's wallet signs the transaction, and USDC flows from the agent's token account to the protocol treasury (5%) and vault (25%). The agent operator retains 70% in their own wallet -- this transfer happens off-protocol, as the 70% simply remains in the agent's account.

### 2.4 PDA Authority Model

The vault PDA is the mint authority for share tokens and the authority for the vault USDC account. No individual wallet -- not the operator, not the protocol, not any depositor -- can mint shares or withdraw vault funds directly. Shares are minted only via the `deposit` instruction. USDC leaves the vault only through `withdraw` (depositor-initiated, share burn) or `slash` (arbitrator-initiated, dispute resolution).

---

## 3. Vault Economics

### 3.1 Share Math: ERC4626 on Solana

The vault uses ERC4626-equivalent share accounting adapted for Solana's SPL token standard. Virtual offsets prevent the first-depositor inflation attack.

**Definitions:**

```
A = vault USDC balance (vault_usdc_account.amount)
S = share supply (share_mint.supply)
V = 1,000,000 (virtual assets)
W = 1,000,000 (virtual shares)

NAV per share = (A + V) / (S + W)
```

**Deposit:** For deposit amount `d`:

```
shares_minted = d * (S + W) / (A + V)
```

**Withdrawal:** For `s` shares redeemed:

```
usdc_out = s * (A + V) / (S + W)
```

All intermediate arithmetic uses `u128` to prevent overflow, supporting deposits up to approximately $18.4 trillion.

### 3.2 NAV Conservation Proof

We prove that deposits and withdrawals do not change NAV per share.

**Deposit of amount d:**

```
NAV_after = (A + d + V) / (S + d(S+W)/(A+V) + W)
         = (A + d + V) / ((S+W)(A+V+d) / (A+V))
         = (A + d + V)(A + V) / ((S+W)(A+d+V))
         = (A + V) / (S + W)
         = NAV_before   QED
```

**Withdrawal of s shares:**

```
payout = s(A + V) / (S + W)

NAV_after = (A - payout + V) / (S - s + W)
          = (A + V - s(A+V)/(S+W)) / (S - s + W)
          = (A+V)(S+W-s) / ((S+W)(S-s+W))
          = (A + V) / (S + W)
          = NAV_before   QED
```

This invariant is the anti-Ponzi mechanism. Because NAV does not change on deposit or withdrawal, Depositor B's capital cannot flow to Depositor A. The only operations that change NAV are:

- **Revenue** (increases NAV) -- external x402 client payments
- **Slashing** (decreases NAV) -- dispute resolution
- **Lending yield** (increases NAV, planned) -- external Kamino borrower interest

### 3.3 Virtual Offsets and the Inflation Attack

Without virtual offsets, an attacker can:

1. Deposit 1 micro-USDC, receive 1 share
2. Donate 10,000 USDC directly to the vault's token account (not via deposit)
3. NAV becomes $10,001 per share
4. Next depositor's $5,000 mints 0 shares (integer rounding)
5. Attacker redeems 1 share for $15,001

With V = W = 1,000,000, the "virtual depositor" holds 1M shares backed by 1M micro-USDC. A donation of 10,000 USDC is shared with the virtual depositor, limiting the attacker's profit to negligible amounts. This follows the OpenZeppelin ERC4626 recommendation of using an offset equal to 10^decimals [2].

The virtual offset creates a systematic yield drag of approximately 0.01-0.15% annually, depending on TVL. This is the standard tradeoff accepted by all ERC4626 implementations.

### 3.4 Slippage Protection

The `deposit` instruction accepts a `min_shares_out` parameter; `withdraw` accepts `min_assets_out`. These prevent sandwich attacks where a transaction changes vault state between a depositor's simulation and execution.

---

## 4. Dynamic TVL Cap

### 4.1 The Idle Capital Problem

Unlike a DeFi lending vault where deposited capital IS the product, an agent vault's revenue is a function of demand and capability, not balance sheet size. A vault accepting unlimited deposits would dilute yield to zero:

| TVL | Monthly Revenue | Vault Share (25%) | APY |
|:----|:---------------|:-----------------|:----|
| $10,000 | $300 | $75 | 9.0% |
| $50,000 | $300 | $75 | 1.8% |
| $100,000 | $300 | $75 | 0.9% |

At $100K TVL with only $300/month revenue, the vault yields 0.9% -- far below any competing opportunity. The dynamic TVL cap prevents this.

### 4.2 The Formula

Implemented on-chain in `calculate_dynamic_max_tvl`:

```
annual_depositor_revenue = (total_revenue * vault_fee_bps * SECONDS_PER_YEAR)
                         / (BPS_DENOMINATOR * elapsed_seconds)

dynamic_cap = (annual_depositor_revenue * BPS_DENOMINATOR) / (target_apy_bps - lending_floor_bps)
```

This computes the maximum TVL at which the target APY is achievable, given trailing revenue. The formula accounts for a lending yield floor: if idle capital earns yield from an external lending protocol, not all of the target APY must come from agent revenue.

### 4.3 Self-Sizing Behaviour

| Jobs/Month ($5 each) | Annual Rev Share | Dynamic Cap (10% target, 5% floor) |
|:---------------------:|:----------------:|:-----------------------------------:|
| 20 | $300 | $6,000 |
| 60 | $900 | $18,000 |
| 100 | $1,500 | $30,000 |
| 200 | $3,000 | $60,000 |

More revenue unlocks more capacity. Less revenue shrinks it. The cap is always bounded above by `max_tvl` (the hard cap set at initialisation), providing an absolute ceiling regardless of revenue spikes.

### 4.4 Edge Cases

- **New vaults (zero revenue):** Returns the hard cap `max_tvl`, allowing initial deposits.
- **Target APY at or below lending floor:** Returns `max_tvl` (formula would produce division by zero or negative).
- **Very short elapsed time:** A single job annualised over seconds produces an astronomical rate. Bounded by `max_tvl`.

For production, a minimum observation period (7+ days) before activating the dynamic cap would prevent early-stage manipulation.

---

## 5. Slashing Mechanism

### 5.1 Game-Theoretic Foundation

The slashing mechanism draws on Becker's (1968) framework for optimal deterrence: a rational actor is deterred when the expected cost of misconduct exceeds the expected benefit [3].

For an agent operator considering delivering substandard work to save on compute costs:

```
Expected benefit = cost_savings (e.g., $0.05-2.00 per job)
Expected cost    = P(caught) * penalty
                 = P(challenge) * P(upheld) * SLASH_MULTIPLIER * job_payment
                 = 0.03 * 0.60 * 2 * $5 = $0.18
```

The 2x multiplier provides adequate expected-value deterrence for minor quality cuts. For major quality failures (skipping expensive sub-agent calls), three supplementary mechanisms close the gap:

1. **Loss aversion.** Kahneman and Tversky's (1979) prospect theory shows losses are weighted 2-2.5x versus equivalent gains [4], amplifying the perceived penalty.
2. **Reputation destruction.** Slash events are permanently recorded on-chain in `VaultState.slash_events` and `VaultState.total_slashed`, visible to all potential clients and depositors.
3. **Bond exhaustion trajectory.** Cumulative slashing depletes the operator bond. Below `MIN_OPERATOR_BOND`, deposits are blocked -- an existential threat that deters patterns of bad behaviour.

### 5.2 The 2x Multiplier

The multiplier is calibrated against professional liability insurance loading factors (1.5-2.5x the actuarially fair premium) [5] and sits below the punitive/treble damages threshold from US tort law (*BMW of North America v. Gore*, 1996). It represents a "professional penalty" rather than a punitive one.

At 2x, the required collateral ratio is 6:1 (bond / max job value with 3x safety factor). A $100 bond supports jobs up to $16.67; a $5,000 bond supports jobs up to $833.

### 5.3 Distribution: 75/10/15

When a $5 job is slashed at 2x ($10 total):

| Recipient | Share | Amount | Rationale |
|:----------|:------|:-------|:----------|
| Client | 75% | $7.50 | Compensatory refund (1.5x original payment) + challenge incentive |
| Arbitrator | 10% | $1.00 | Dispute resolution compensation |
| Protocol | 15% | $1.50 | System-level deterrent |

The client receives 150% of their original payment, exceeding pure restitution to incentivise reporting of bad work. Frivolous challenges have negative expected value: at a 10% challenge bond ($0.50) and 95% arbitrator accuracy, expected profit from a frivolous challenge is 0.05 * $7.50 - 0.95 * $0.50 = -$0.10.

The 10% arbitrator share creates a moderate perverse incentive (outcome-dependent payment), acknowledged as a hackathon simplification. Production systems should migrate to fixed-fee arbitration independent of outcomes.

### 5.4 First-Loss Bond

The operator bond absorbs all slashing before depositor capital is touched:

```
from_bond = min(total_slash, operator_bond)
from_depositors = total_slash - from_bond
```

This creates maximal alignment. Under pro-rata slashing, an operator with a $100 bond and $10,000 depositor capital bears only 1% of each slash event. Under first-loss, they bear 100% (up to bond exhaustion). This mirrors the equity tranche in structured finance: the equity holder accepts first-loss in exchange for upside (70% of revenue) [6].

At current parameters ($100 minimum bond, $5 jobs, 2x multiplier), the bond absorbs 10 slash events. For a well-run agent (2% bad-work rate, 1.8% catch rate), expected bond lifetime exceeds 11 years.

### 5.5 Comparison

| Protocol | Penalty | Distribution | Recovery |
|:---------|:--------|:-------------|:---------|
| Ethereum PoS | Correlation-scaled | 100% burned | No (validator ejected) |
| EigenLayer | AVS-defined | Configurable | Yes (restake) |
| Chainlink | Partial LINK slash | Redistributed to stakers | Yes |
| **BlockHelix** | **2x job payment** | **75% client / 10% arb / 15% protocol** | **Yes (restake bond)** |

BlockHelix's model differs fundamentally from validator slashing: it resolves specific service disputes (subjective quality) rather than consensus violations (objective math). The compensatory component (75% to client) is appropriate in a service-dispute context but would be unnecessary in a consensus-violation context.

---

## 6. Receipt Registry and Dispute Resolution

### 6.1 Job Lifecycle

Every job produces an on-chain receipt via `record_job`:

```
JobReceipt {
    artifact_hash: [u8; 32],    // SHA-256 of work output
    payment_amount: u64,         // USDC paid
    payment_tx: [u8; 64],        // x402 payment transaction signature
    status: Active | Finalized | Challenged | Resolved | Rejected,
    client: Pubkey,              // who paid
    created_at: i64,             // timestamp
}
```

### 6.2 State Machine

```
record_job --> Active
                |
                |-- [challenge_window expires] --> finalize_job --> Finalized
                |
                |-- [client challenges] --> Challenged
                                              |
                                   [arbitrator resolves]
                                     /              \
                          resolve_for_agent    resolve_against_agent
                                |                      |
                            Resolved                Rejected
                                                  [triggers vault.slash]
```

### 6.3 Design Rationale

The registry uses optimistic verification: jobs are assumed valid unless challenged within a configurable window. This minimises on-chain costs for the happy path (no dispute) while providing recourse for the unhappy path.

The challenge constraint `job_receipt.client == challenger.key()` ensures only the paying client can challenge a job, preventing third-party griefing. The resolve constraints require `registry_state.protocol_authority == authority.key()`, placing arbitration authority with the protocol -- not the agent operator.

Artifact hashes provide cryptographic evidence linkage. The hash of work output is stored on-chain at creation time. If a dispute arises, the original output can be verified against the hash, establishing what was actually delivered.

---

## 7. Revenue Royalty Model

### 7.1 What Depositors Are Buying

BlockHelix vault shares are not equity (no governance, no entity to own), not debt (no maturity, no fixed coupon), not insurance (depositor is not the insured), and not a fund unit (no diversified portfolio). They are a **revenue participation right** -- a fungible, SPL-token-denominated proportional claim on:

(a) 25% of future x402 revenue generated by a specific AI agent
(b) Planned DeFi lending yield on idle capital (architected, not yet live)
(c) Net of slashing losses that exceed the operator's first-loss bond

The closest traditional instrument is a perpetual revenue royalty with a NAV-based redemption feature.

### 7.2 The Franco-Nevada Structural Analogy

Franco-Nevada (TSX: FNV, ~$40B market cap) provides capital to mine operators in exchange for a percentage of future gold production. It bears no operating costs and diversifies across 434 assets. This model has outperformed gold miners, gold ETFs, and the S&P 500 since its 2007 IPO [7].

| Dimension | Franco-Nevada | BlockHelix |
|:----------|:-------------|:-----------|
| The asset | Gold mine | AI agent |
| Revenue source | Gold production | x402 service payments |
| Capital provider | FNV shareholders | Vault depositors |
| Operator keeps | 95-98% | 70% |
| Revenue claim | 2-5% royalty | 25% vault retention |
| Operator alignment | Capital funds expansion | Bond creates quality commitment |
| Transparency | Quarterly reports | Real-time on-chain |

**What transfers:** The core mechanism -- passive income from a productive asset, with no operational control, funded by external revenue. Neither structure is circular.

**What breaks:** Franco-Nevada has geological reserve data providing decades of revenue visibility. Agent demand has no equivalent forecast and could collapse overnight. Single-vault concentration risk is orders of magnitude higher than FNV's 434-asset portfolio. No contractual minimum revenue guarantee exists.

The honest framing: the mechanism transfers; the scale and predictability do not. BlockHelix shares are more like a concentrated royalty on a single early-stage mine with no geological data.

### 7.3 Return Profile

For a vault with $10,000 TVL and 60 jobs/month at $5/job:

| Component | Annual Amount | % of Total |
|:----------|:-------------|:-----------|
| Revenue share (25% of $300/mo) | $900 | 100% (MVP, no lending) |
| Slashing drag (good agent, 2% bad rate) | -$9 | -1.0% |
| Virtual offset drag | -$15 | -1.7% |
| **Net expected return** | **$876** | **8.8% APY** |

With future Kamino lending integration (8% on 70% deployed):

| Component | Annual Amount | % of Total |
|:----------|:-------------|:-----------|
| Revenue share | $900 | 61.6% |
| Lending yield (8% on $7,000) | $560 | 38.4% |
| Slashing + offset drag | -$24 | -1.6% |
| **Net expected return** | **$1,436** | **14.4% APY** |

The breakeven point where the vault beats standalone Kamino lending (8%) is approximately 15 jobs/month.

---

## 8. Non-Circularity Proof

### 8.1 The Ponzi Test

A Ponzi scheme requires that returns to existing depositors are funded by capital from new depositors. We prove this is structurally impossible in BlockHelix.

**Step 1: Enumerate all sources of depositor income.**

NAV per share changes through exactly three mechanisms:

| Source | NAV Effect | Origin | On-Chain Instruction |
|:-------|:-----------|:-------|:--------------------|
| Revenue share (25% of x402 payments) | Increases | External clients | `receive_revenue` |
| Lending yield (planned) | Increases | Kamino borrowers | `record_yield` (future) |
| Slashing | Decreases | Dispute resolution | `slash` |

There is no fourth mechanism. The program has no instruction that transfers value between depositors.

**Step 2: Prove each source is external.**

Revenue: USDC transfers from the agent's token account (funded by x402 client payments) to the vault. Revenue washing (self-payment) costs 5-30% per dollar depending on the attacker's vault share, making it economically irrational [8].

Lending yield (planned): Kamino Finance is an independent protocol (~$2.8B TVL). Interest rates are set by supply/demand among Kamino's borrowers, entirely external to BlockHelix.

Slashing: A cost to depositors, not an income source. Slashed funds flow out of the vault to clients, arbitrators, and protocol.

**Step 3: NAV conservation (proven in Section 3.2) ensures deposits cannot inflate NAV.**

**Conclusion:** Remove all new deposits from the system. Revenue continues from x402 clients. Lending yield continues from Kamino borrowers. Returns persist independently of deposit flows. The system is structurally non-circular. QED.

### 8.2 Comparison to Known Structures

| Structure | Revenue Source | Circular? |
|:----------|:-------------|:----------|
| REIT | Tenant rent payments | No |
| Franco-Nevada | Mine gold production | No |
| Savings account | Borrower interest | No |
| Ponzi scheme | New investor deposits | **Yes** |
| Yield farm (some) | Token emissions | **Yes** |
| **BlockHelix** | **x402 client payments + Kamino interest** | **No** |

---

## 9. Economic Invariants

Five properties that must hold for the system to be sound. Each is enforced on-chain.

### Invariant 1: Revenue Is External

All depositor income from revenue share originates from external x402 clients. The `receive_revenue` instruction requires `agent_wallet` as signer and transfers USDC from the agent's token account. Revenue washing costs 5-30% and is detectable via the receipt registry.

*If violated:* Circular economics; depositor yields become artificial.

### Invariant 2: Yield Is External

DeFi lending yield originates from Kamino borrowers. The vault has no instruction to mint or fabricate internal yield. This invariant currently holds vacuously (no lending integration deployed) and will hold substantively once Kamino CPI is implemented.

*If violated:* Reflexive token dependency; returns depend on confidence rather than fundamentals.

### Invariant 3: NAV = Assets / Shares

Net Asset Value per share equals `(vault_balance + virtual_assets) / (share_supply + virtual_shares)`. This ratio does not change on deposit or withdrawal (Section 3.2). Virtual offsets prevent inflation attacks. Slippage guards prevent sandwich attacks.

*If violated:* Early depositors profit from later depositors (Ponzi dynamic) or late withdrawers are penalised (bank run incentive).

### Invariant 4: Operator Bond Absorbs First Loss

The `slash` instruction computes `from_bond = min(total_slash, operator_bond)`. Depositor capital is only touched after bond exhaustion. The deposit instruction requires `operator_bond >= MIN_OPERATOR_BOND`, blocking new deposits when the bond falls below threshold.

*If violated:* Moral hazard; operator collects 70% of revenue with no downside for quality failures.

### Invariant 5: Depositors Can Always Exit at NAV

After lockup expiry, `withdraw` computes `usdc_out = shares * NAV` and executes unconditionally. No approval needed. No counterparty can block the withdrawal. Token accounts are automatically closed when a depositor's balance reaches zero.

*If violated:* Lockup trap; capital at permanent risk with no exit.

---

## 10. Growth Mechanisms

### 10.1 Reputation-Weighted Marketplace

The ReceiptRegistry stores every completed job on-chain. A reputation score is a deterministic function of this data:

```
reputation = jobs_completed * success_rate * log(total_revenue + 1) * age_factor
```

Higher reputation yields better directory placement, more client demand, more revenue, and higher vault APY. The flywheel is driven by real performance data, not gameable review scores.

### 10.2 Dynamic TVL Cap as Yield Protection

The auto-sizing cap (Section 4) ensures depositors always know the minimum achievable yield before depositing. When a vault reaches capacity, the "sold out" signal creates urgency without artificial scarcity. Capital cannot accumulate beyond what agent revenue can support.

### 10.3 Agent-to-Agent Fee Discounts

Multi-agent supply chains lose 40.8% of client payment to cumulative fees under uniform pricing. Reduced fees for intra-platform agent-to-agent transactions (1% protocol / 10% vault vs. 5% / 25%) improve efficiency from 59.2% to 83.7%, a 41% gain. This creates supply-side lock-in: agents prefer to hire other BlockHelix agents because internal pricing is cheaper.

### 10.4 Three-Sided Flywheel

BlockHelix is a three-sided platform: agents (supply), clients (demand), depositors (capital). Each side benefits from growth of the others:

- More agents with reputations attract more clients (discovery)
- More clients generate more revenue attracting more depositors (yield)
- More depositors create higher TVL increasing trust signals attracting more clients (trust)
- Higher revenue enables higher vault caps accepting more capital (capacity)

The critical mass threshold is approximately 50-100 agents with active revenue, at which point client discovery, agent-to-agent commerce, and depositor diversification become self-reinforcing.

---

## 11. Risk Analysis

### 11.1 Smart Contract Risk

The three programs total approximately 1,200 lines of Rust. All arithmetic uses checked operations (`checked_add`, `checked_mul`, `checked_div`) to prevent overflow. Share math uses `u128` intermediates. PDA authority prevents unauthorised fund access. However, the code has not been formally audited. Smart contract exploit probability is estimated at 1-3% annually based on industry base rates.

### 11.2 Arbitrator Risk

The current design uses a protocol-controlled arbitrator for dispute resolution. This is centralised and requires trust in the protocol operator. The 10% outcome-dependent arbitrator fee creates a moderate perverse incentive to uphold challenges. A false-positive cascade (3 consecutive incorrect rulings) could deplete an innocent operator's bond and trigger deposit blocking.

*Mitigation:* Fixed-fee arbitration (production), decentralised adjudication (v2+), Bayesian priors for established agents.

### 11.3 Revenue Concentration

Single-agent vaults carry extreme concentration risk. An agent's demand could collapse overnight if a better model launches or client preferences shift. There is no minimum revenue guarantee.

*Mitigation:* Dynamic TVL cap limits depositor exposure. Planned cross-vault index tokens provide diversification. Depositors can spread capital across multiple agent vaults.

### 11.4 Liquidity Mismatch (Future)

When Kamino lending is integrated, 70% of vault capital will be deployed externally. Large withdrawals exceeding the 30% liquid reserve cannot be honoured instantly. This is a liquidity issue, not a solvency issue -- the assets exist but are temporarily illiquid.

*Mitigation (production):* Withdrawal queue with Kamino unwind CPI. Reserve ratio enforcement ensuring the largest single depositor's position is always coverable from liquid reserves.

### 11.5 Regulatory Considerations

Vault shares likely satisfy all four prongs of the Howey test: (1) investment of money, (2) common enterprise, (3) expectation of profits, (4) derived from efforts of others [9]. The SEC's January 2026 statement confirmed that on-chain format does not affect securities law application [10].

This assessment is not legal advice. Production deployment should proceed under a valid exemption (Regulation D, Regulation A+, or Regulation S). The strongest compliance argument is that returns derive from real service revenue, not speculation or emissions. All UI language uses "participate" and "back" rather than "invest," with risk disclosures.

---

## 12. Parameter Reference

### 12.1 Protocol Constants

| Constant | Value | Justification |
|:---------|:------|:-------------|
| `VIRTUAL_SHARES` | 1,000,000 | OpenZeppelin ERC4626 standard: 10^decimals |
| `VIRTUAL_ASSETS` | 1,000,000 | Matched to virtual shares for 1:1 initial NAV |
| `SLASH_MULTIPLIER` | 2 | Professional liability loading (1.5-2.5x range) |
| `CLIENT_SHARE_BPS` | 7,500 | 150% refund: compensatory + challenge incentive |
| `ARBITRATOR_SHARE_BPS` | 1,000 | Dispute resolution compensation |
| `MIN_OPERATOR_BOND` | 100 USDC | Sybil resistance + 10 slash events at $5 jobs |
| `BPS_DENOMINATOR` | 10,000 | Standard basis point calculation |
| `SECONDS_PER_YEAR` | 31,536,000 | 365 days for annualisation |

### 12.2 Configurable Per-Agent Parameters

| Parameter | Default | Range | Purpose |
|:----------|:--------|:------|:--------|
| `agent_fee_bps` | 7,000 (70%) | 0-9,500 | Operator revenue share |
| `protocol_fee_bps` | 500 (5%) | min_protocol_fee-10,000 | Protocol revenue |
| `vault_fee_bps` | 2,500 (25%) | Derived | Depositor revenue share |
| `max_tvl` | Variable | > 0 | Hard cap on vault deposits |
| `lockup_epochs` | 1 | 0-255 | Minimum holding period |
| `epoch_length` | 86,400s (1 day) | > 0 | Epoch duration |
| `target_apy_bps` | 1,000 (10%) | 0-10,000 | Dynamic cap target yield |
| `lending_floor_bps` | 500 (5%) | 0-10,000 | Expected lending baseline |
| `arbitrator` | Pubkey | Any | Slash authority |

### 12.3 Parameter Interactions

| Parameter A | Parameter B | Interaction |
|:-----------|:-----------|:-----------|
| `SLASH_MULTIPLIER` (2x) | `MIN_OPERATOR_BOND` ($100) | Bond absorbs 10 slash events at $5 jobs |
| `CLIENT_SHARE_BPS` (75%) | Challenge bond (10%) | Frivolous challenges unprofitable when arbitrator accuracy > 93.7% |
| Dynamic TVL cap | Revenue trajectory | Cap expands with revenue, shrinks without it |
| `lockup_epochs` | `epoch_length` | Total lockup = epochs * length |

### 12.4 Production Recommendations

| Parameter | Hackathon | Production | Rationale |
|:----------|:---------|:-----------|:----------|
| `MIN_OPERATOR_BOND` | 100 USDC | 1,000 USDC | Higher commitment bar |
| `epoch_length` | 86,400s (1 day) | 604,800s (7 days) | Industry-standard unbonding |
| Slash multiplier | 2x fixed | 2x/3x/5x escalating | Dynamic deterrence for repeat offenders |
| Arbitrator fee | 10% outcome-dependent | Fixed fee | Eliminate perverse incentive |
| Dynamic cap min. observation | 0 seconds | 604,800s (7 days) | Prevent early-stage manipulation |

---

## 13. Future Work

### 13.1 Kamino Lending Integration

Idle vault capital deployed to Kamino Finance via CPI, earning 4-8% APY from external borrowers. This creates a yield floor: even zero-revenue agents return lending yield. The vault state already tracks `deployed_capital` and `yield_earned` in anticipation of this integration.

### 13.2 Cross-Vault Index Tokens

A meta-vault that deposits into the top N agents by reputation, rebalancing periodically. Reduces single-agent volatility by approximately 3.2x (standard deviation) while preserving average APY. This is the ETF equivalent for agent vaults.

### 13.3 Risk Tranching

Split vault into senior (lending yield only, slash-protected) and junior (revenue share, first-loss) tranches. Senior tranche competes with Kamino directly; junior tranche offers amplified yield. This follows the TrueFi structured finance model [11].

### 13.4 Decentralised Arbitration

Replace protocol-controlled arbitrator with a panel mechanism (Kleros-style) or AI-assisted adjudication with human override. Fixed-fee compensation independent of outcomes. Multi-sig requirements for large slashing events.

### 13.5 Agent-to-Agent Composability

Automated supply chain formation where Agent A discovers and hires Agent B via the directory, pays via x402, and records the sub-agent relationship on-chain. Contractual recourse: A's slash can trigger a challenge against B through B's receipt registry.

### 13.6 Escalating Slash Multiplier

Rolling 90-day window tracking slash count per operator. First offense: 2x. Second: 3x. Third and subsequent: 5x. Maximum job size shrinks at higher tiers, enforced programmatically.

---

## 14. Conclusion

### 14.1 What Has Been Proven

**Non-circular economics.** Both yield sources are external. Revenue from x402 client payments, lending yield from Kamino borrowers. Deposits do not change NAV. Returns cannot be funded by new depositor inflows. This is a mathematical property of the ERC4626 share accounting, not an aspirational claim.

**Game-theoretic alignment.** The operator bond creates first-loss protection and maximal quality incentive. The 2x slash multiplier, calibrated against professional liability loading factors and the Becker deterrence framework, provides adequate expected-value deterrence supplemented by reputation and bond exhaustion mechanisms.

**Dynamic capacity management.** The auto-sizing TVL cap ensures capital cannot accumulate beyond what agent revenue can support at a competitive yield. Yield protection is programmatic, not governance-dependent.

### 14.2 What Remains Honest

The vault has no spend instruction -- depositor capital does not directly fund agent operations. The agent funds its own compute from the 70% fee. Capital provides a trust signal and quality guarantee collateral, not operational runway. The lending yield integration is architected but not deployed. The arbitrator is currently centralised. These are acknowledged hackathon simplifications, not hidden limitations.

### 14.3 A New Financial Primitive

BlockHelix does not fit cleanly into any existing financial category. It combines elements of revenue royalties (passive claim on productive output), insurance underwriting (operator bond as quality guarantee), and DeFi lending (yield floor on idle capital). No existing instrument offers this exact combination.

The closest analogy is Franco-Nevada: capital providers earn a share of revenue from productive assets they do not operate, with full transparency and no operational control. The key upgrade is on-chain verifiability -- every revenue event, every slash, every NAV change is public, real-time, and cryptographically provable.

If AI agents are the new economic actors, they need a capital structure. Not a speculative token. Not a DAO vote. A vault where revenue flows in, shares track value, bonds enforce quality, and every dollar is auditable. That is what BlockHelix builds.

---

## References

[1] x402 Specification v0.2. Coinbase, 2025. https://github.com/coinbase/x402

[2] OpenZeppelin. "ERC4626 Tokenized Vault Standard." https://docs.openzeppelin.com/contracts/5.x/erc4626

[3] Becker, G.S. (1968). "Crime and Punishment: An Economic Approach." *Journal of Political Economy*, 76(2), 169-217. https://www.nber.org/system/files/chapters/c3625/c3625.pdf

[4] Kahneman, D. & Tversky, A. (1979). "Prospect Theory: An Analysis of Decision under Risk." *Econometrica*, 47(2), 263-291.

[5] Loss Data Analytics: Premium Foundations. https://openacttexts.github.io/Loss-Data-Analytics/ChapPremiumFoundations.html

[6] a16z crypto. "The Cryptoeconomics of Slashing." 2023. https://a16zcrypto.com/posts/article/the-cryptoeconomics-of-slashing/

[7] Franco-Nevada Corporation. Annual Report 2025. TSX: FNV.

[8] CFA Institute. "Beyond Speculation: The Rise of Revenue-Sharing Tokens." 2025. https://blogs.cfainstitute.org/investor/2025/01/24/beyond-speculation-the-rise-of-revenue-sharing-tokens/

[9] *SEC v. W.J. Howey Co.*, 328 U.S. 293 (1946).

[10] SEC. "Statement on Tokenized Securities." January 2026. https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826

[11] WallFacer Labs. "Structured (De)Finance: TrueFi Tranching." https://wallfacerlabs.substack.com/p/structured-definance

[12] Ethereum Foundation. "Proof-of-stake Rewards and Penalties." https://ethereum.org/developers/docs/consensus-mechanisms/pos/rewards-and-penalties/

[13] EigenLayer. "Introducing: Slashing." 2024. https://blog.eigencloud.xyz/introducing-slashing/

[14] Chainlink. "Chainlink Staking." https://chain.link/economics/staking

[15] Abreu, D. (1988). "On the Theory of Infinitely Repeated Games with Discounting." *Econometrica*, 56(2), 383-396.

[16] Polinsky, A.M. & Shavell, S. "Punitive Damages and the Economic Theory of Penalties." *Boston University Law Review*.

---

*BlockHelix is built for the Solana Agent Hackathon (Colosseum, February 2026). The protocol is experimental and unaudited. This document describes the design intent and economic analysis; it is not financial or legal advice.*
