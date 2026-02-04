# Copy Review: Economic Accuracy Audit

## Methodology

Each document is reviewed for economic claims. For each claim, we assess:

- **Accuracy:** Is the claim factually correct?
- **Precision:** Is the claim stated with appropriate qualifiers?
- **Vulnerability:** Could a sophisticated judge or regulator attack this claim?
- **Confidence:** 1 (likely wrong) to 5 (provably correct)

---

## 1. pitch-narrative.md

### Claim: "BlockHelix lets you buy a share of an AI agent's future revenue -- a royalty on autonomous labor -- with a DeFi lending yield floor."

**Confidence: 3/5**

- "Buy a share of future revenue" is accurate but legally loaded. Revenue participation rights are likely securities (Howey analysis in staked-asset-economics.md). The word "buy" implies a purchase transaction; "deposit" is more precise and less legally charged.
- "A royalty on autonomous labor" is a metaphor, not a legal description. Royalties are contractual obligations with specific terms. Vault shares have no contract -- they are programmatic claims enforced by smart contract code.
- "With a DeFi lending yield floor" is architecturally accurate but not yet live. The Kamino integration is designed but not deployed. The yield floor is currently zero.

**Suggested correction:** "BlockHelix lets you deposit USDC into an AI agent's vault and receive a proportional share of its future x402 revenue. A planned DeFi lending integration provides a base yield on idle capital."

### Claim: "Revenue flows to a Solana vault. Depositors stake USDC into the vault, receive SPL share tokens, and earn returns from two sources: a 25% share of agent revenue, and DeFi lending yield on deployed idle capital (Kamino Finance)."

**Confidence: 3/5**

- Revenue share is live on-chain. Correct.
- Lending yield is not live. The claim presents it as a current feature ("earn returns from two sources"). A judge would flag this as misleading if the demo shows zero lending yield.

**Suggested correction:** "...and earn returns from agent revenue (25% share, live on-chain). A second yield source -- DeFi lending yield on idle capital -- is architecturally designed and planned for post-hackathon deployment."

### Claim: "Neither yield source depends on new deposits entering the system."

**Confidence: 5/5**

This is provably correct. Revenue comes from x402 clients. Lending yield comes from Kamino borrowers. NAV conservation on deposit/withdrawal is algebraically proven. This is the strongest claim in the document and should be emphasised.

### Claim: "The fee split is enforced in the receive_revenue instruction. It is not configurable post-deployment."

**Confidence: 4/5**

The fee split IS enforced on-chain. However, "not configurable post-deployment" is technically incorrect -- the `agent_fee_bps` and `protocol_fee_bps` are set at initialization and there is no `update_fees` instruction, so they cannot be changed without deploying a new vault. This is accurate by omission (no update mechanism exists), but a pedantic reviewer might note that the program could be upgraded to add one.

**Suggested correction:** "The fee split is enforced in the receive_revenue instruction. There is no instruction to change it after initialization."

### Claim: "The vault PDA controls all funds -- no single key can drain it."

**Confidence: 4/5**

Accurate in the current implementation. The vault PDA is the authority for the USDC token account and the share mint. No individual wallet can drain deposits. However:

- The agent operator can call `receive_revenue` with arbitrary amounts (revenue washing).
- The arbitrator can call `slash` to extract funds to the client/arbitrator/protocol accounts.
- `pause` and `unpause` are controlled by the agent wallet, which could be used to grief depositors (pausing deposits indefinitely).

None of these "drain" the vault in the traditional sense, but they are administrative powers that a judge might question. The claim should be narrower: "no single key can withdraw depositor funds directly."

### Claim: "Depositors earn lending yield on their capital" (multiple instances)

**Confidence: 2/5**

This claim appears throughout the document and is the most vulnerable. The lending integration is not deployed. The vault currently holds 100% idle USDC with zero yield on idle capital. Every mention of lending yield should be clearly labeled as "planned/architectural" unless it is live.

### Claim: "22.0% APY" (return projections section of tech spec)

**Confidence: 3/5**

The math is correct given the assumptions (100 jobs/month, $5 each, $10K TVL, 70% deployed at 10% Kamino yield). But:

1. The 10% Kamino yield is at the high end of the range (current base is 4-8%, with promotional rates up to 12-17%).
2. The lending yield component ($58/month) is not currently live.
3. Slashing losses are estimated at $0, which assumes a perfect agent.

A judge may view this as an unrealistic best-case projection. Should be presented alongside conservative and bear cases.

**Suggested correction:** Present three scenarios: conservative (30 jobs, no lending), base (60 jobs, 8% lending), bull (100 jobs, 10% lending). Lead with the conservative case.

---

## 2. franco-nevada-analogy.md

### Claim: "Franco-Nevada pays gold miners upfront and collects a percentage of future gold production. BlockHelix depositors fund agent vaults and collect 25% of future service revenue. The analogy is precise."

**Confidence: 3/5**

The analogy is directionally correct but "precise" is overstated. Key differences:

- Franco-Nevada pays $100M-$1B upfront per deal. BlockHelix depositors deposit $100-$10K.
- Franco-Nevada holds 434 diversified assets. A single vault holds 1 agent.
- Franco-Nevada has perpetual contractual claims backed by mineral rights. Vault shares have no contract and no minimum guarantee.
- Franco-Nevada has 40 years of operating history. BlockHelix has 5 days.

"Precise" invites challenge. "Structurally similar" or "directionally analogous" is more defensible.

**Suggested correction:** "The analogy is structurally sound: both involve passive claims on future revenue from productive assets, with no operational control."

### Claim: "This model has outperformed gold miners, gold ETFs, and the S&P 500 over two decades."

**Confidence: 5/5**

Factually correct. Franco-Nevada (TSX: FNV) has indeed outperformed GDX (gold miners ETF), GLD (gold ETF), and the S&P 500 on a total return basis since its 2007 IPO. This is well-documented in Franco-Nevada's investor presentations and multiple Seeking Alpha analyses.

### Claim: "Capital funds expansion" / "Capital funds the agent's working runway"

**Confidence: 2/5**

For Franco-Nevada: correct. Their upfront payments genuinely fund mine development.

For BlockHelix: problematic. The vault has no spend instruction. Depositor capital currently sits idle or goes to lending (future). It does not fund agent operations. The agent funds its own operations from the 70% fee. The tech spec v2 explicitly states: "Most AI agents have 90%+ gross margins. A code patch agent costs $0.49 per job and charges $5.00. These agents don't need your money to pay for API calls."

The claim that capital "funds the agent's working runway" contradicts the tech spec's own analysis. Capital funds the trust signal and collateral pool, not operations.

**Suggested correction:** "Capital provides a trust signal and collateral reserve for quality guarantees, not operational funding."

### Claim: "BlockHelix's advantage: every transaction is on-chain. Revenue, spend, NAV -- all verifiable in real time."

**Confidence: 4/5**

Revenue: on-chain via `receive_revenue` events. Correct.
NAV: computable from on-chain state (vault balance + share supply). Correct.
Spend: there is no spend instruction. There is nothing to verify. The claim implies spend transparency that does not exist because spend does not exist.

**Suggested correction:** "Revenue and NAV are verifiable on-chain in real time."

---

## 3. non-circularity-proof.md

### Claim: "No depositor's return is funded by another depositor's capital."

**Confidence: 5/5**

Algebraically proven and verified computationally. The NAV conservation proof is correct. This is the document's strongest claim and is essentially bulletproof given the ERC4626 math.

### Claim: "Revenue washing costs the attacker 30% loss on every wash trade."

**Confidence: 4/5**

Correct math: 25% to vault + 5% to protocol = 30% lost. However, the framing "costs the attacker 30%" slightly misleads. The 25% that goes to the vault benefits the attacker's own vault shares (if the attacker is also a depositor). The net cost depends on the attacker's share of the vault:

```
Net cost of $1 wash = $0.30 (fees) - $0.25 * (attacker_shares / total_shares)

If attacker holds 100% of shares: net cost = $0.30 - $0.25 = $0.05 (5%)
If attacker holds 50% of shares: net cost = $0.30 - $0.125 = $0.175 (17.5%)
If attacker holds 0% of shares: net cost = $0.30 (30%)
```

A sole depositor who also controls the agent can wash revenue at a cost of only 5% (the protocol fee). The 30% figure is the worst case for the attacker, not the typical case.

**Suggested correction:** "Revenue washing costs the attacker 5-30% per dollar washed, depending on their share of the vault. The protocol fee (5%) is the minimum unavoidable cost."

### Claim: "The system generates returns without new deposits."

**Confidence: 5/5**

Correct. Revenue from x402 and lending yield (future) are independent of deposit flows. This can be demonstrated by running the vault with zero new deposits and observing NAV appreciation from revenue alone.

### Claim: "If the agent earned revenue previously, that revenue is already in the vault (25% retention)."

**Confidence: 5/5**

Correct. Revenue is transferred to `vault_usdc_account` atomically in the `receive_revenue` instruction. It is immediately reflected in the vault's USDC balance and thus in NAV.

---

## 4. economic-invariants.md

### Claim: "Invariant 4: Operator Bond Absorbs First Loss... Slash authority is the arbitrator (set at vault initialization), not the agent operator."

**Confidence: 5/5**

Verified in the code. The `Slash` account struct (line 741-775) requires `authority.key() == vault_state.arbitrator`. The arbitrator is set during `initialize` (line 39: `vault.arbitrator = arbitrator`). This was fixed from the earlier version where the agent wallet was the slash authority. The current code is correct.

### Claim: "deposit requires vault.operator_bond >= MIN_OPERATOR_BOND (100 USDC). Deposits are blocked if the bond falls below minimum."

**Confidence: 5/5**

Verified at line 116: `require!(vault.operator_bond >= MIN_OPERATOR_BOND, VaultError::InsufficientBond)`.

### Claim: "These five invariants are not aspirational. They are mathematical properties of the on-chain program."

**Confidence: 4/5**

Invariants 1, 3, 4, and 5 are enforced on-chain and verifiable. Invariant 2 (yield is external) is architecturally true (no instruction mints yield internally) but the Kamino integration is not deployed. The invariant holds vacuously -- there is no yield at all, external or otherwise.

**Suggested correction:** "Invariants 1, 3, 4, and 5 are enforced and verifiable on-chain. Invariant 2 holds architecturally -- there is no mechanism to fabricate internal yield. The positive case (external lending yield) is designed but not yet deployed."

---

## 5. Hero Copy: "Atomic units of AI work. Composed into chains. Backed by human capital. Verified on-chain."

### "Atomic units of AI work"

**Confidence: 4/5**

Reasonably accurate. Each x402 endpoint is a discrete unit of work (analysis, patch, audit). "Atomic" implies indivisible and self-contained, which is true for individual API calls. The claim is slightly aspirational -- not all AI work is atomic; some tasks require multi-step workflows.

### "Composed into chains"

**Confidence: 3/5**

The vision is correct (agents hiring sub-agents via x402), but composability is not yet demonstrated in the current build. Agent-to-agent transactions are technically possible (any wallet can call x402 endpoints) but there is no on-chain proof of agent composition, no reduced B2B fees, and no demonstrated supply chain.

A judge might ask: "Show me two agents composing." If the answer is "they could, in theory," the claim is aspirational.

**Suggested correction for honesty:** "Composable into chains" (future-leaning) or demonstrate a live agent-to-agent call during the demo.

### "Backed by human capital"

**Confidence: 3/5**

This is ambiguous. "Human capital" in economics means the skills and knowledge embodied in a person (education, experience). The claim seems to mean "backed by human-deposited capital" -- financial capital contributed by humans.

If the intent is financial capital: correct, depositors provide USDC. But "backed" is imprecise. The capital does not back the agent's work quality (the agent produces work regardless of vault balance). The capital backs the quality guarantee (slashing compensation) and provides a trust signal.

If the intent is "human judgment": more interesting and more accurate. The human contribution is judgment -- deciding which agents to back. The capital is the medium through which judgment is expressed. This reading is more compelling but less obvious.

**Suggested alternatives:**
- "Underwritten by human judgment" (more precise about the human role)
- "Backed by staked capital" (more precise about the mechanism)
- "Funded by human depositors" (most literal)

### "Verified on-chain"

**Confidence: 3/5**

What is verified on-chain:
- Revenue amounts (via `receive_revenue` events)
- NAV (computable from vault state)
- Slashing events (via `Slashed` events)
- Job receipt existence (via receipt registry)

What is NOT verified on-chain:
- Work quality (this is subjective; the challenge mechanism provides dispute resolution, not verification)
- Whether the work was actually delivered to the client
- Whether the artifact hash corresponds to useful output
- Whether the client was satisfied

The receipt registry verifies that a receipt was recorded and that a payment occurred, not that the work was good. "Verified on-chain" could be interpreted as "the work quality is verified," which would be false.

**Suggested correction:** "Recorded and auditable on-chain" is more precise than "verified." Alternatively, "Revenue verified on-chain" specifically claims what is actually verifiable.

---

## 6. Summary of Highest-Risk Claims

| Claim | Document | Risk Level | Issue |
|:------|:---------|:-----------|:------|
| Lending yield as current feature | Multiple | HIGH | Not yet deployed; presented as live |
| "Capital funds operations/runway" | pitch-narrative, franco-analogy | HIGH | Contradicted by own analysis; no spend instruction |
| 22% APY projection | tech spec v2 | MEDIUM | Best-case scenario presented without adequate caveats |
| "The analogy is precise" | franco-analogy | MEDIUM | Overstated; significant differences exist |
| Revenue washing costs "30%" | non-circularity | MEDIUM | True only when attacker holds 0% of vault; 5% for sole depositor |
| "Verified on-chain" | hero copy | MEDIUM | Work quality is not verified; only revenue records are |
| "Composed into chains" | hero copy | MEDIUM | Not yet demonstrated |
| "Backed by human capital" | hero copy | LOW | Ambiguous but not wrong |
| "No depositor funds another" | non-circularity | NONE | Algebraically proven, bulletproof |
| "Revenue is external" | invariants | NONE | Structurally enforced, strongest claim |

---

## 7. Recommendations

### For Judges (Hackathon Presentation)

1. **Lead with the non-circularity proof.** It is your strongest, most defensible claim.
2. **Separate live features from planned features explicitly.** Say "on-chain today" vs "architected for v2" for every feature you mention.
3. **Drop the 22% APY headline.** Lead with the conservative case (10% with no lending yield, 60 jobs/month). Then show upside scenarios.
4. **Replace "verified on-chain" with "auditable on-chain" in the hero copy.**
5. **Replace "precise" with "structurally analogous" in the Franco-Nevada analogy.**
6. **Be honest about what capital does.** It provides a trust signal and quality guarantee collateral, not operational funding. This is actually a stronger story than "funding compute."

### For Production Documentation

1. Every mention of lending yield must include a status indicator (live / testnet / planned).
2. Return projections must include conservative, base, and aggressive scenarios.
3. The Franco-Nevada analogy should include a "where the analogy breaks" section every time it is used.
4. Revenue washing costs should be stated as a range (5-30%) depending on attacker's vault share.
5. The hero copy should be reviewed by legal counsel before production launch.
