# Non-Circularity Proof: BlockHelix Vault Economics

This document proves that BlockHelix depositor returns are funded entirely by external sources. No depositor's return is funded by another depositor's capital.

---

## Step 1: Enumerate Every Source of Depositor Income

A depositor's return is the change in NAV per share between deposit and withdrawal. NAV per share changes only through three mechanisms, each traceable in the on-chain program:

| Source | Direction | Origin | On-Chain Instruction |
|:-------|:----------|:-------|:--------------------|
| Revenue share (25% of x402 payments) | NAV increases | External clients paying for agent work | `receive_revenue` |
| Lending yield (future: Kamino deployment) | NAV increases | External Kamino borrowers paying interest | `record_yield` (planned) |
| Slashing (dispute resolution) | NAV decreases | Operator bond absorbed first, then depositor NAV | `slash` |

There is no fourth source. The program has no instruction that transfers value between depositors.

## Step 2: Prove Each Source Is External

### Source 1: Revenue Share

The `receive_revenue` instruction (agent-vault/src/lib.rs) transfers USDC from `agent_usdc_account` to `vault_usdc_account`. The USDC in the agent's account arrives via x402 payments from clients external to the vault system.

**Could revenue be faked?** An agent operator could call `receive_revenue` with USDC from their own wallet (revenue washing). This costs the attacker 25% to the vault + 5% to protocol = 30% loss on every wash trade. The receipt registry provides a second verification layer: every job has an artifact hash, a client pubkey, and a challenge window. Revenue washing is economically irrational (attacker pays 30% to inflate a metric) and detectable (receipts without matching x402 facilitator logs).

**Verdict: External.** Revenue originates from clients paying for services. Washing is costly, detectable, and does not transfer value from depositors.

### Source 2: Lending Yield

Kamino Finance is an independent lending protocol on Solana (~$2.8B TVL). USDC lending yield is paid by borrowers on Kamino, who are completely external to BlockHelix. BlockHelix has no influence over Kamino's interest rate model.

**Could lending yield be circular?** Only if a Kamino borrower used borrowed funds to pay for agent services, creating a loop. But this is standard financial intermediation -- identical to a bank depositor whose money is lent to someone who buys goods from another bank customer. The intermediation is genuine and the interest is real.

**Verdict: External.** Lending yield is paid by Kamino borrowers, not by BlockHelix participants.

### Source 3: Slashing

Slashing reduces NAV. It is a loss to depositors (after the operator bond is exhausted), not an income source. The slashed funds go to the aggrieved client (75%), arbitrator (10%), and protocol (15%). No depositor receives slashed funds as income.

**Verdict: External outflow.** Slashing is a cost, not a revenue source. It transfers value out of the vault, never between depositors.

## Step 3: Prove NAV Conservation on Deposit/Withdrawal

This is the critical invariant. If new deposits could inflate existing depositors' NAV, the system would be circular.

### The Math

Let A = vault USDC balance, S = share supply, V = virtual assets (1,000,000), W = virtual shares (1,000,000).

```
NAV = (A + V) / (S + W)
```

On deposit of amount d:

```
shares_minted = d * (S + W) / (A + V)

NAV_after = (A + d + V) / (S + shares_minted + W)
          = (A + d + V) / (S + d*(S+W)/(A+V) + W)
          = (A + d + V) / ((S+W)*(A+V) + d*(S+W)) / (A+V))
          = (A + d + V) / ((S+W)*(A+V+d) / (A+V))
          = (A + d + V) * (A + V) / ((S+W) * (A+V+d))
          = (A + V) / (S + W)
          = NAV_before
```

On withdrawal of s shares:

```
usdc_out = s * (A + V) / (S + W)

NAV_after = (A - usdc_out + V) / (S - s + W)
          = (A - s*(A+V)/(S+W) + V) / (S - s + W)
          = ((A+V)*(S+W) - s*(A+V)) / ((S+W) * (S-s+W))
          = (A+V)*(S+W-s) / ((S+W)*(S-s+W))
          = (A + V) / (S + W)
          = NAV_before
```

**NAV is invariant under deposits and withdrawals.** This is enforced by the ERC4626 share math in the on-chain program (lines 128-140 for deposit, lines 224-236 for withdrawal). The virtual offsets (V=W=1,000,000) prevent the inflation attack where the first depositor donates assets to manipulate NAV.

### What This Means

- Depositor B's $10,000 deposit does not increase Depositor A's NAV by a single micro-cent.
- Depositor A's withdrawal does not decrease Depositor B's NAV by a single micro-cent.
- The only things that change NAV are revenue (up), lending yield (up), and slashing (down) -- all external.

## Step 4: The Complete Depositor Return Formula

```
depositor_return = (NAV_at_withdrawal - NAV_at_deposit) * shares_held

Where NAV changes only from:
  + revenue_share    (25% of x402 payments, external)
  + lending_yield    (Kamino borrower interest, external)
  - slashing_losses  (dispute resolution, external outflow)

depositor_return = revenue_share + lending_yield - slashing_losses
```

Every term in this equation traces to an external party. There is no term that references another depositor's capital.

## Step 5: Comparison to Known Non-Circular Structures

| Structure | Revenue Source | Circular? | BlockHelix Equivalent |
|:----------|:-------------|:----------|:---------------------|
| REIT | Tenant rent payments | No | Agent x402 revenue |
| Franco-Nevada (royalty co.) | Mine gold production | No | Agent service revenue |
| Savings account | Borrower interest payments | No | Kamino lending yield |
| Insurance float | Policyholder premiums + investment returns | No | Revenue share + lending yield |
| Ponzi scheme | New investor deposits | **Yes** | **Not present** |
| Yield farm (some) | Token emissions to self | **Yes** | **Not present** |

BlockHelix's structure is isomorphic to a REIT or royalty company: external parties generate the revenue, depositors hold shares that entitle them to a proportional cut, NAV reflects actual assets, and entry/exit does not affect other holders.

## Step 6: Addressing the Obvious Attacks

### "What if agent revenue drops to zero?"

Depositors withdraw at NAV, which reflects actual USDC in the vault. If the agent earned revenue previously, that revenue is already in the vault (25% retention). If it earned nothing, NAV equals the deposited capital minus any slashing losses. Depositors lose the revenue they stop earning, not their principal (unless slashing has eroded it).

With the lending yield floor (future), depositors earn Kamino yield even during zero-revenue periods. Without it (current MVP), NAV stays flat at zero revenue because there are no outflows -- the vault has no spend instruction.

### "What if everyone withdraws at once?"

NAV is preserved for every withdrawer (proven above). The last depositor out receives exactly their proportional share of remaining assets. There is no scenario where early withdrawers extract value from late withdrawers, because NAV does not change on withdrawal.

The only risk is liquidity: if capital is deployed to Kamino and cannot be recalled instantly, large withdrawals may need to queue. This is a UX issue, not a solvency issue -- the assets exist, they are just temporarily illiquid.

### "What if the agent operator rugs?"

The operator's wallet is `agent_wallet`, which is the signer for `receive_revenue`. The operator cannot withdraw from the vault -- only depositors can withdraw by burning shares. The operator cannot mint shares -- only the vault PDA can mint, and only in response to deposits. The operator can pause the vault (preventing new deposits), but cannot extract depositor funds.

The operator's only attack vector is to stop routing revenue. This reduces depositor yield to the lending floor (future) or zero (current). This is not theft -- it is the agent going out of business. Depositors withdraw at NAV, which reflects actual vault assets.

### "Isn't this just like [insert Ponzi DeFi project]?"

The defining test: remove all new deposits. Does the system still generate returns?

- **Ponzi:** No. Returns stop immediately because they were funded by new deposits.
- **BlockHelix:** Yes. Revenue continues from x402 clients. Lending yield continues from Kamino borrowers. Both are independent of deposit flows.

---

## Summary

| Claim | Status | Evidence |
|:------|:-------|:--------|
| Revenue is external | Proven | x402 payments from clients, verified by receipt registry |
| Lending yield is external | Proven | Kamino borrower interest, independent protocol |
| NAV is conserved on deposit/withdrawal | Proven | ERC4626 math, algebraic proof, on-chain enforcement |
| No depositor funds another depositor's return | Proven | NAV conservation + external-only income sources |
| System generates returns without new deposits | Proven | Revenue + lending yield continue independently |

The BlockHelix vault is structurally non-circular. This is not a claim -- it is a mathematical property of the ERC4626 share accounting combined with exclusively external income sources.
