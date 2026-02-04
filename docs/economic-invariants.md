# BlockHelix Economic Invariants

Five properties that must hold for the system to be sound. Each is enforced on-chain by the Anchor program.

---

## Invariant 1: Revenue Is External

**Statement:** All depositor income from revenue share originates from external clients paying for real services via x402. No internal mechanism mints, fabricates, or recycles revenue.

**On-chain enforcement:**
- `receive_revenue` requires `agent_wallet` as signer and transfers USDC from the agent's token account.
- The receipt registry records every job with an artifact hash, client pubkey, and payment transaction signature.
- Challenge window allows clients to dispute within a configurable period. Arbitrator resolves disputes independently.

**What breaks if violated:** If revenue could be fabricated internally, depositor yields would be artificial. The system would become circular -- revenue metrics would be meaningless, and depositor returns would ultimately depend on new deposits to sustain the illusion.

**Defense in depth:** Even without the receipt registry, revenue washing costs the attacker 30% per wash (25% to vault + 5% to protocol). An attacker spending $1,000 on fake revenue loses $300 immediately. The receipt registry adds cryptographic verification on top of this economic deterrent.

---

## Invariant 2: Yield Is External

**Statement:** DeFi lending yield originates from borrowers on an independent lending protocol (Kamino Finance), not from any BlockHelix-internal mechanism. BlockHelix has no ability to influence, fabricate, or inflate lending rates.

**On-chain enforcement (architected, deploying post-hackathon):**
- Vault tracks `deployed_capital` and `yield_earned` in `VaultState`.
- Dynamic TVL cap formula uses `lending_floor_bps` as a parameter.
- Kamino integration will use Kamino's public CPI interface, with yield verifiable by any on-chain observer.

**What breaks if violated:** If lending yield were internal (e.g., protocol printing tokens as "yield"), depositor returns would depend on token value, which depends on demand, which depends on depositor confidence -- a reflexive loop. By using an external lending protocol with $2.8B TVL and independently set interest rates, this reflexivity is eliminated.

**Current status:** The lending integration is not yet deployed. The vault currently holds idle USDC. This means the yield floor is 0% at MVP, not 4-8%. The invariant is architecturally enforced (the program has no instruction to mint yield internally), and the Kamino integration is the planned implementation of the positive case.

---

## Invariant 3: NAV = total_assets / total_shares

**Statement:** Net Asset Value per share is always exactly equal to (vault USDC balance + virtual assets) / (share supply + virtual shares). This ratio does not change on deposit or withdrawal. It changes only from revenue (up), lending yield (up), or slashing (down).

**On-chain enforcement:**
- Deposit (line 128-140): `shares_minted = deposit * (total_shares + virtual_shares) / (total_assets + virtual_assets)`. This is the ERC4626 formula. Algebraically, NAV before = NAV after.
- Withdraw (line 224-236): `usdc_out = shares * (total_assets + virtual_assets) / (total_shares + virtual_shares)`. Same formula, reversed. NAV is preserved.
- Virtual offsets (1,000,000 each): Prevent the first-depositor inflation attack where an attacker donates assets to an empty vault to manipulate the share price.
- Slippage protection: `min_shares_out` on deposit, `min_assets_out` on withdrawal prevent sandwich attacks.

**What breaks if violated:** If deposits could inflate NAV, early depositors would profit from later depositors -- the definition of a Ponzi. If withdrawals could deflate NAV, late withdrawers would be penalized -- a bank run incentive. NAV conservation eliminates both failure modes.

**Proof:**
```
NAV = (A + V) / (S + W)    where A=assets, S=shares, V=W=1,000,000

Deposit d:
  minted = d * (S+W) / (A+V)
  NAV_after = (A+d+V) / (S + d*(S+W)/(A+V) + W) = (A+V)/(S+W) = NAV_before

Withdrawal of s shares:
  payout = s * (A+V) / (S+W)
  NAV_after = (A - payout + V) / (S-s+W) = (A+V)/(S+W) = NAV_before
```

---

## Invariant 4: Operator Bond Absorbs First Loss

**Statement:** When a slash event occurs, the operator's bond is depleted before depositor capital is touched. The operator bears first-loss risk, aligning their incentives with service quality.

**On-chain enforcement:**
- `slash` instruction (line 397-489): `from_bond = min(total_slash, vault_state.operator_bond)`. The operator bond is decremented by `from_bond`. Only the overflow (`total_slash - from_bond`) reduces the vault balance (and thus depositor NAV).
- Slash multiplier: 2x. A $5 disputed job triggers a $10 slash. At minimum bond of 100 USDC, the operator can absorb 10 slash events on $5 jobs before depositor capital is touched.
- `deposit` requires `vault.operator_bond >= MIN_OPERATOR_BOND` (100 USDC). Deposits are blocked if the bond falls below minimum, preventing new depositors from entering an under-collateralized vault.
- Slash authority is the arbitrator (set at vault initialization), not the agent operator. The operator cannot self-slash or avoid slashing.

**What breaks if violated:** Without first-loss protection, depositors bear 100% of quality risk. The operator has no economic penalty for delivering bad work. This misalignment would make the vault a moral hazard -- the operator collects 70% of revenue with no downside.

**Slash distribution:** Client receives 75% of slashed amount. Arbitrator receives 10%. Protocol receives 15%. This incentivizes clients to report bad work and compensates the arbitrator for dispute resolution.

---

## Invariant 5: Depositors Can Always Exit at NAV

**Statement:** After the lockup period expires, a depositor can redeem any number of shares for USDC at the current NAV per share. No approval is needed. No counterparty can block the withdrawal.

**On-chain enforcement:**
- `withdraw` instruction (line 209-303): Computes `usdc_out = shares * (total_assets + virtual_assets) / (total_shares + virtual_shares)`, burns the shares, transfers the USDC. The only precondition is lockup expiry.
- Lockup check (line 216-219): `current_epoch >= last_deposit_epoch + lockup_epochs`. Once this condition is met, withdrawal is permissionless.
- No admin override: There is no instruction that allows the agent operator, protocol, or any other party to block a withdrawal after lockup. The vault PDA executes the transfer unconditionally.
- Share account cleanup: If a depositor's share balance reaches zero after withdrawal, the token account is automatically closed and rent returned.

**What breaks if violated:** If depositors cannot exit, the vault becomes a lockup trap. Capital would be permanently at risk, and the depositor's only recourse would be selling shares on a secondary market (potentially at a discount to NAV). Guaranteed NAV-based exit is what makes the vault a legitimate financial instrument rather than a speculative token.

**Caveat (honest):** When capital is deployed to Kamino (future), a large withdrawal might exceed the vault's liquid USDC balance. The assets exist in Kamino, but must be recalled. This creates a temporary liquidity mismatch -- not a solvency issue. The withdrawal queue design is a post-hackathon priority.

---

## Summary Table

| # | Invariant | Enforced How | What Breaks Without It |
|:--|:----------|:-------------|:----------------------|
| 1 | Revenue is external | x402 + receipt registry + 30% wash cost | Circular economics, fake yield |
| 2 | Yield is external | Kamino integration (independent protocol) | Reflexive token dependency |
| 3 | NAV = assets / shares | ERC4626 math + virtual offsets + slippage guards | Ponzi dynamics, bank run incentive |
| 4 | Operator bond first-loss | Slash instruction, min bond check on deposit | Moral hazard, misaligned incentives |
| 5 | Exit at NAV after lockup | Permissionless withdraw, no admin override | Lockup trap, capital at permanent risk |

These five invariants are not aspirational. They are mathematical properties of the on-chain program, verifiable by reading the Anchor source code. If any one of them fails, the system is broken. All five hold.
