# Economic Model Parameters: Reference & Justification

## Overview

This document lists every economic parameter used in the BlockHelix protocol, its current value, the game-theoretic or empirical justification for that value, what a sophisticated judge would ask about it, and the best defense.

---

## 1. SLASH_MULTIPLIER = 2

**Value:** `const SLASH_MULTIPLIER: u64 = 2;` (lib.rs line 10)

**What it does:** When a slash event occurs, the total amount deducted is `job_payment * 2`. For a $5 job, the total slash is $10.

**Justification:**

| Framework | Recommendation | Source |
|:----------|:--------------|:-------|
| Becker optimal fine | $278 (at 1.8% catch rate) -- impractical | Becker (1968) |
| Insurance loading (professional liability) | 1.5-2.5x | Actuarial literature |
| US punitive damages (single-digit ratio rule) | 2-9x maximum | *BMW v. Gore* (1996) |
| Ethereum correlation penalty | 3x (correlated) | eth2book.info |
| Industry practice (a16z framework) | "Sufficient to make CoC > PfC" | a16z crypto (2023) |

The 2x multiplier sits at the bottom of the professional liability loading range and well below the punitive damages ceiling. It is defensible as a "professional penalty" -- more than restitution, less than punishment for willful fraud.

**At 2x, the expected cost per bad job is $0.18** (given 1.8% catch rate on $5 jobs). This deters minor quality cuts ($0.03-0.20 savings) but not major ones ($1-2 savings). Supplementary mechanisms (reputation, bond exhaustion, escalation) close the gap for major quality failures.

**What a judge would ask:** "Why 2x and not 3x? The agent could save $2 by skipping an audit step and the expected penalty is only 18 cents."

**Best defense:** "The 2x financial penalty is one of three deterrence layers. The second is reputation: every slash event is permanently recorded on-chain and visible to all future clients and depositors. The third is bond exhaustion: repeated slashing depletes the operator's bond, eventually blocking the agent from accepting work. These three layers together provide robust deterrence across the full range of quality failures. The 2x multiplier specifically calibrates to the professional liability insurance standard (1.5-2.5x loading), which is the closest TradFi analogue for quality guarantees on professional services."

---

## 2. CLIENT_SHARE_BPS = 7,500 (75% to Client)

**Value:** `const CLIENT_SHARE_BPS: u64 = 7_500;` (lib.rs line 11)

**What it does:** Of the total slash amount, 75% goes to the aggrieved client. On a $10 slash (2x on $5 job), the client receives $7.50.

**Justification:**

The client receives 1.5x their original payment. This exceeds pure restitution (1x = $5) by $2.50, which compensates for:

1. **Time and effort cost of filing a challenge.** The client must prepare a challenge, wait for resolution, and manage the process. The $2.50 surplus is compensation for this friction.

2. **Deterrence of non-reporting.** If the client only received 1x (break-even), many clients would not bother challenging marginal-quality work. The surplus creates a positive incentive to report.

3. **Risk premium on challenge bond.** The client posts a 10% challenge bond ($0.50 on a $5 job). Even at 95% arbitrator accuracy, there is a 5% chance the client loses the bond on a valid challenge. The $2.50 surplus compensates for this risk.

**What a judge would ask:** "Doesn't giving the client more than their money back incentivise frivolous challenges?"

**Best defense:** "At 75% of a 2x slash, frivolous challenge EV is negative: 0.05 * $7.50 - 0.95 * $0.50 = -$0.10. The challenge bond makes frivolous challenges unprofitable as long as arbitrator accuracy exceeds 93.7%. We disclose this threshold and design the arbitration process to meet it."

**Comparison:**

| Protocol | Client Compensation on Slash |
|:---------|:----------------------------|
| BlockHelix | 150% of job payment (75% of 2x) |
| Ethereum | 0% (slashed ETH is burned, not compensated to any party) |
| EigenLayer | Configurable per AVS (redistribution feature) |
| US Small Claims Court | 100% + court costs (restitution model) |
| US Consumer Protection (FTC) | 100-300% (treble damages for willful violations) |

BlockHelix's 150% is between court restitution (100%) and FTC treble damages (300%). This is the range for "compensatory + moderate deterrent," appropriate for a professional service dispute.

---

## 3. ARBITRATOR_SHARE_BPS = 1,000 (10% to Arbitrator)

**Value:** `const ARBITRATOR_SHARE_BPS: u64 = 1_000;` (lib.rs line 12)

**What it does:** Of the total slash, 10% goes to the arbitrator. On a $10 slash, the arbitrator receives $1.00.

**Justification:**

The arbitrator performs work (reviewing the challenge, examining evidence, making a ruling). This work has a cost. The 10% share compensates the arbitrator for this labour.

**The perverse incentive concern:** An outcome-dependent payment creates a financial incentive to uphold challenges (arbitrator earns $1.00 per upheld challenge, $0 per rejected challenge). This is a structural conflict of interest.

**Quantifying the concern:**

At 200 jobs/month with 3% challenge rate: 6 challenges/month. If the arbitrator upholds 60%: 3.6 upheld challenges * $1.00 = $3.60/month in arbitrator income. This is negligible revenue and unlikely to distort behaviour for any professional arbitrator.

However, at scale (1000 jobs/month, higher job values), the incentive grows:

| Scale | Monthly Challenges | Arbitrator Income | Perverse Incentive Risk |
|:------|:------------------|:-----------------|:-----------------------|
| 200 jobs/mo, $5 | 6 | $3.60 | Negligible |
| 500 jobs/mo, $10 | 15 | $18.00 | Low |
| 1000 jobs/mo, $50 | 30 | $300.00 | Moderate |
| 5000 jobs/mo, $100 | 150 | $15,000 | Significant |

**What a judge would ask:** "The entity that decides whether to slash also gets paid when they slash. Isn't that a conflict of interest?"

**Best defense:** "Yes, and we acknowledge this. For the hackathon MVP, the arbitrator is a protocol-controlled authority operating under a duty of neutrality. The 10% compensates dispute resolution costs. For production, we plan to migrate to either fixed-fee arbitration (payment independent of outcome) or decentralised adjudication (Kleros-style, where multiple independent jurors decide). The current design is an honest hackathon simplification."

**Recommendation for production:** Replace outcome-dependent compensation with a fixed arbitration fee funded from the challenge bond or protocol treasury.

---

## 4. Protocol Share = 15% (Remainder)

**Value:** Computed as `total_slash - client_amount - arbitrator_amount` (lib.rs lines 408-409)

**What it does:** The protocol treasury receives the remainder of the slash (15% at current parameters). On a $10 slash, the protocol receives $1.50.

**Justification:**

The 15% serves as:

1. **Protocol sustainability revenue.** Dispute infrastructure (UI, APIs, monitoring) has operational costs.
2. **Deflationary pressure.** If burned rather than retained, it permanently removes USDC from circulation, creating a pure deterrent with no beneficiary.
3. **Safety margin.** If the 75/10 split undercompensates the client or arbitrator due to rounding, the protocol share absorbs the residual.

**What a judge would ask:** "Is this burned or does the protocol keep it?"

**Best defense:** The current code sends it to `protocol_usdc_account`, which is the same account that receives the 5% protocol fee from revenue. In practice, this is treasury retention, not burn. For cleaner incentives, the protocol share from slashing should go to a separate burn address (irrecoverable PDA) rather than the operating treasury. This eliminates any protocol incentive to encourage slashing.

---

## 5. MIN_OPERATOR_BOND = 100,000,000 (100 USDC)

**Value:** `const MIN_OPERATOR_BOND: u64 = 100_000_000;` (lib.rs line 13)

**What it does:** Deposits are blocked unless the operator has staked at least 100 USDC as bond. This is checked in the `deposit` instruction at line 116.

**Justification:**

| Consideration | Analysis |
|:-------------|:---------|
| Sybil resistance | 100 USDC is a non-trivial cost for creating fake agents at scale. 100 sybil agents = $10,000. |
| Slash absorption | At 2x on $5 jobs, absorbs 10 slash events before depositor capital is touched. |
| Operator commitment signal | $100 is meaningful enough to deter casual/unserious operators while being accessible to individual developers. |
| Job size constraint | At 6:1 collateral ratio, supports jobs up to $16.67. Appropriate for $5 micropayments. |

**Comparison:**

| Protocol | Minimum Stake to Participate |
|:---------|:----------------------------|
| Ethereum validator | 32 ETH (~$76,800 at Feb 2026 prices) |
| Chainlink node operator | ~50,000 LINK (~$750,000+) |
| EigenLayer operator | Variable per AVS, typically significant |
| BlockHelix operator | 100 USDC |

BlockHelix's minimum is orders of magnitude lower. This is intentional -- the protocol targets individual developers and small teams, not institutional operators. The low minimum is a feature (accessibility) not a bug (insufficient deterrence), because the slashing mechanism provides deterrence independent of bond size.

**What a judge would ask:** "$100 is trivial. How is that a meaningful commitment?"

**Best defense:** "The $100 bond is the minimum to gate entry. Operators are expected to stake more to (a) expand their max job size and (b) signal credibility to depositors. The marketplace sorts this naturally: agents with $100 bonds attract small depositors making small deposits; agents with $5,000+ bonds attract institutional capital. The minimum is low to promote permissionless innovation, not to suggest $100 is adequate for enterprise use."

**Recommendation for production:** Raise to $1,000 minimum. Publish recommended bond sizes per agent tier: $1K (micro), $5K (small), $25K (medium), $50K+ (enterprise).

---

## 6. Default Fee Split: 70/25/5

**Value:** Set per-agent at initialization via `agent_fee_bps` and `protocol_fee_bps`. Default: 7000/500, with `vault_fee_bps = 10000 - 7000 - 500 = 2500`.

**What it does:** Every x402 payment is split: 70% to agent operator, 25% to vault (depositors), 5% to protocol treasury.

**Justification:**

**70% to operator.** The operator built, deployed, and maintains the agent. They bear operational costs (API fees, hosting, development time). At $5/job with $0.23-0.49 in API costs, the operator earns $3.27-3.50 net per job. This provides a healthy margin that incentivises quality and continued operation.

Compare to other marketplace splits:

| Marketplace | Creator/Operator Share | Platform Share |
|:-----------|:----------------------|:-------------|
| Apple App Store | 70% (85% for small devs) | 30% (15%) |
| YouTube | 55% | 45% |
| Spotify (artists) | ~30% | ~70% |
| Uber (drivers) | 75-80% | 20-25% |
| Franco-Nevada (mine operators) | 95-99% | 1-5% |
| BlockHelix (agents) | 70% | 30% (25% vault + 5% protocol) |

BlockHelix's 70% operator share is in the range of digital marketplace standards. It is less generous than Franco-Nevada (where operators keep 95%+) because the "platform" (protocol + depositors) provides active value (trust signal, collateral, quality guarantee) rather than just passive capital.

**25% to vault.** This is the depositor's yield source. At 60 jobs/month at $5: $75/month to the vault, or 9% annual yield on $10K TVL (revenue component only). The 25% was calibrated to produce competitive yields at realistic job volumes:

| Jobs/Month | Revenue ($5/job) | Vault Income (25%) | APY on $10K TVL |
|:-----------|:----------------|:------------------|:---------------|
| 30 | $150 | $37.50 | 4.5% |
| 60 | $300 | $75.00 | 9.0% |
| 100 | $500 | $125.00 | 15.0% |
| 200 | $1,000 | $250.00 | 30.0% |

At 60 jobs/month, the 25% retention produces a revenue yield comparable to high-yield bonds. Below 30 jobs/month, the yield becomes uncompetitive with Kamino (5-8%). The 25% is calibrated for the 60-100 jobs/month range.

**5% to protocol.** Funds protocol development, dispute infrastructure, and platform operations. Compare to other protocol fees:

| Protocol | Fee Take Rate |
|:---------|:-------------|
| Uniswap (v3) | 0% (may activate 10-25% of LP fees) |
| Aave | Variable (5-20% of interest spread) |
| MakerDAO | Variable (stability fees) |
| BlockHelix | 5% of gross revenue |

5% is moderate by DeFi standards and provides meaningful protocol revenue at scale ($50K monthly platform revenue generates $2,500 protocol income).

**What a judge would ask:** "Why should depositors get only 25%? They're providing the capital."

**Best defense:** "Depositors provide capital, but the agent does the work. In a Franco-Nevada royalty, the mine operator keeps 95-98% because they bear all operational risk. Our 70/25/5 split is actually more generous to capital providers than the royalty industry standard, reflecting that agent operations are less capital-intensive than mining."

---

## 7. Dynamic TVL Cap Formula

**Value:** Implemented in `calculate_dynamic_max_tvl` (lib.rs lines 513-546)

**Formula:**

```
annual_depositor_revenue = (total_revenue * vault_fee_bps * SECONDS_PER_YEAR)
                         / (BPS_DENOMINATOR * elapsed_seconds)

dynamic_cap = (annual_depositor_revenue * BPS_DENOMINATOR) / (target_apy_bps - lending_floor_bps)
```

**Parameters:**
- `target_apy_bps`: Target annual return for depositors (e.g., 1000 = 10%)
- `lending_floor_bps`: Expected DeFi lending yield floor (e.g., 500 = 5%)
- `total_revenue`: Lifetime gross revenue
- `elapsed`: Time since vault creation

**What it does:** Caps deposits based on trailing revenue to prevent yield dilution. If the agent earns enough revenue to support 10% APY on $15,000 of capital, the cap is $15,000. If revenue increases, the cap expands. If revenue decreases, the cap shrinks (preventing new deposits, not forcing withdrawals).

**Justification:**

The dynamic cap solves the idle capital problem. Without a cap, depositors could pile $100K into a vault earning $75/month in revenue, diluting the yield to 0.9% -- well below Kamino's 5-8%. The cap ensures the vault only accepts as much capital as the agent's revenue can support at a competitive yield.

The formula is derived from:

```
target_apy = (annual_depositor_revenue + lending_yield) / TVL

Solving for TVL:
TVL = annual_depositor_revenue / (target_apy - lending_yield)
```

This is the maximum TVL at which the target APY is achievable. The `lending_floor_bps` parameter accounts for the fact that idle capital also earns lending yield, so not all of the target APY must come from agent revenue.

**What a judge would ask:** "Can the cap be manipulated? Could an agent inflate revenue temporarily to raise the cap, attract deposits, then let revenue fall?"

**Best defense:** "The formula uses lifetime revenue annualised over elapsed time, not trailing 30-day revenue. An operator who inflates revenue in month 1 would need to sustain it indefinitely to maintain the cap. Revenue washing (self-payment) costs 5-30% per dollar and does not produce sustainable cap increases because the annualisation smooths short-term spikes. However, this is a valid concern for early-stage vaults where a short burst of revenue produces a high annualised figure. The cap is also bounded by `max_tvl` (the hard cap set at initialization), providing an absolute ceiling."

**Known issue:** In the first few seconds of a vault's life, a single job ($5) annualised over seconds produces an astronomical annualised rate. The code handles this by returning `max_tvl` when `total_revenue == 0` or `elapsed <= 0`. But for very small elapsed values with non-zero revenue, the dynamic cap can be extremely high. This is mitigated by the hard cap but should be addressed with a minimum observation period (e.g., dynamic cap only activates after 7 days).

---

## 8. Lockup Epochs

**Value:** Configurable per vault at initialization. `lockup_epochs: u8` with `epoch_length: i64` (seconds).

**Default:** 1 epoch, 86400 seconds (1 day) for hackathon.

**What it does:** Depositors cannot withdraw until `lockup_epochs` epochs have passed since their last deposit.

**Justification:**

| Purpose | Mechanism | Required Duration |
|:--------|:---------|:-----------------|
| MEV front-running prevention | Force attacker to hold through multiple revenue events | 1 epoch (1 day at 86400s) |
| Bank-run prevention | Cooling period on impulse withdrawals | 3-7 epochs |
| Capital commitment signal | Filter mercenary capital | 7+ epochs |

The 1-epoch lockup at 1-day length is the minimum viable lockup -- sufficient for MEV protection but insufficient for bank-run prevention.

**Comparison:**

| Protocol | Unbonding Period |
|:---------|:----------------|
| Ethereum validator | ~36 days (post-exit) |
| EigenLayer | 14 days |
| Chainlink | 28 days + 7-day window |
| Cosmos | 21 days |
| BlockHelix (hackathon) | 1 day |
| BlockHelix (recommended prod) | 7 days |

**What a judge would ask:** "One day seems very short. Doesn't this enable hit-and-run depositing?"

**Best defense:** "The 1-day lockup is a hackathon configuration that prioritises demonstrability. For production, we recommend 7-day epochs, which aligns with DeFi industry standards for staking lockups and provides meaningful bank-run protection while remaining liquid enough for retail depositors."

---

## 9. Virtual Shares / Virtual Assets = 1,000,000 Each

**Value:** `const VIRTUAL_SHARES: u64 = 1_000_000;` and `const VIRTUAL_ASSETS: u64 = 1_000_000;` (lib.rs lines 8-9)

**What it does:** Adds virtual offsets to the NAV calculation to prevent the "inflation attack" (also called the "donation attack" or "vault share inflation attack").

**The attack without virtual offsets:**

```
1. Attacker deposits 1 wei, receives 1 share (vault is empty)
2. Attacker donates (not deposits) $10,000 to the vault's USDC account
3. NAV per share = $10,001 / 1 share = $10,001
4. Next depositor deposits $5,000, receives 0 shares (rounding: 5000/10001 < 1)
5. Attacker redeems 1 share for $15,001 (original $10,001 + stolen $5,000)
```

**With virtual offsets:**

```
NAV = (A + 1,000,000) / (S + 1,000,000)

After attacker deposits 1 and donates 10,000,000,000 (10K USDC in micro):
  NAV = (10,000,000,001 + 1,000,000) / (1 + 1,000,000) = ~10,001.00

Next depositor deposits 5,000,000,000 (5K USDC):
  shares = 5,000,000,000 * 1,000,001 / 10,001,000,001 = ~499,950 shares

These 499,950 shares have value: 499,950 * NAV = ~$4,999.50
Attacker profit: $0.50 (negligible, from rounding)
```

The virtual offset ensures the attacker's donation is shared with the "virtual depositor" (the 1M virtual shares), limiting the attack profit to a negligible amount.

**Why 1,000,000?**

The value is a balance between:
- **Higher offset = more attack protection** but more yield drag (virtual depositor captures more revenue)
- **Lower offset = less protection** but less yield drag

At 1M virtual shares/assets on a $10K vault: the virtual depositor captures ~0.01% of revenue = $0.015/month. This is negligible.

At 1M offset, the attacker's profit from the inflation attack is capped at approximately `deposit_amount / (1,000,000)` = $0.01 on a $10K deposit. The attack is uneconomic.

**Comparison:** OpenZeppelin's ERC4626 implementation recommends an offset of 10^(decimals) where decimals is the share token's decimal places. With 6-decimal USDC, the recommendation is 10^6 = 1,000,000. BlockHelix follows this standard.

**What a judge would ask:** "Does the virtual offset affect depositor returns?"

**Best defense:** "The virtual offset creates a negligible yield drag of approximately 0.01% annually on a $10K vault. This is the standard tradeoff accepted by all ERC4626 implementations -- it is the price of preventing the inflation attack, which could otherwise steal 100% of a depositor's capital."

---

## 10. Parameter Interaction Matrix

How parameters interact with each other:

| Parameter A | Parameter B | Interaction |
|:-----------|:-----------|:-----------|
| SLASH_MULTIPLIER (2x) | MIN_OPERATOR_BOND ($100) | Bond absorbs `bond / (mult * avg_job)` = 10 slash events at $5 jobs |
| SLASH_MULTIPLIER (2x) | CLIENT_SHARE_BPS (75%) | Client receives mult * job * 75% = 1.5x job payment |
| CLIENT_SHARE_BPS (75%) | Challenge bond (10%) | Frivolous challenge unprofitable when FP_rate < 6.3% |
| ARBITRATOR_SHARE_BPS (10%) | Scale of operations | Perverse incentive grows linearly with job volume and price |
| Dynamic TVL cap | Revenue trajectory | Cap expands with revenue, shrinks without it |
| Dynamic TVL cap | target_apy_bps | Higher target = smaller cap (more selective) |
| Lockup epochs | Epoch length | Total lockup = epochs * length. 1 epoch * 86400s = 1 day |
| MIN_OPERATOR_BOND | SLASH_MULTIPLIER | Max job size = bond / (mult * 3) = $16.67 at current values |
| Virtual offsets | TVL | Yield drag = offsets / (TVL + offsets), negligible above $1K TVL |

---

## 11. Recommended Parameter Changes for Production

| Parameter | Hackathon Value | Recommended Production Value | Rationale |
|:----------|:---------------|:----------------------------|:----------|
| MIN_OPERATOR_BOND | 100 USDC | 1,000 USDC | Higher commitment bar for production agents |
| Lockup epoch length | 86,400s (1 day) | 604,800s (7 days) | Industry-standard unbonding period |
| Lockup epochs | 1 | 1 (at 7-day length) | 7-day total lockup |
| SLASH_MULTIPLIER | 2 | 2 (with escalation to 3/5) | Add dynamic escalation for repeat offenders |
| ARBITRATOR_SHARE_BPS | 1,000 (10%) | 0 (fixed-fee arbitration) | Eliminate perverse incentive |
| Protocol slash share | 15% (treasury) | 25% (burn address) | Redirect arbitrator share to burn; increase protocol burn |
| Challenge window | 86,400s (1 day) | 604,800s (7 days) | More time for clients to evaluate and challenge |
| Dynamic cap minimum observation | 0 seconds | 604,800s (7 days) | Prevent cap manipulation from very short revenue windows |

---

## References

1. Becker, G.S. (1968). ["Crime and Punishment: An Economic Approach"](https://www.nber.org/system/files/chapters/c3625/c3625.pdf). *Journal of Political Economy*.
2. *BMW of North America v. Gore*, 517 U.S. 559 (1996).
3. OpenZeppelin. [ERC4626 Virtual Shares Offset](https://docs.openzeppelin.com/contracts/5.x/erc4626).
4. a16z crypto. ["The Cryptoeconomics of Slashing"](https://a16zcrypto.com/posts/article/the-cryptoeconomics-of-slashing/). 2023.
5. [Loss Data Analytics: Premium Foundations](https://openacttexts.github.io/Loss-Data-Analytics/ChapPremiumFoundations.html).
6. Ethereum Foundation. ["Proof-of-stake Rewards and Penalties"](https://ethereum.org/developers/docs/consensus-mechanisms/pos/rewards-and-penalties/).
7. EigenLayer. ["Introducing: Slashing"](https://blog.eigencloud.xyz/introducing-slashing/). 2024.
8. Chainlink. ["Chainlink Staking"](https://chain.link/economics/staking).
