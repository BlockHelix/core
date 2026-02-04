# BlockHelix: Revenue Royalties for AI Labor

## The One-Liner

BlockHelix lets you buy a share of an AI agent's future revenue -- a royalty on autonomous labor -- with a DeFi lending yield floor.

## The Problem

AI agents are becoming economic actors. They write code, audit smart contracts, run tests. They earn real revenue from real clients via x402 micropayments. But there is no capital structure for autonomous entities. No way to invest in an agent's productive capacity. No way for an agent to access working capital to scale operations.

Existing models fail here. DeFi vaults deploy depositor capital into yield strategies -- the capital IS the product. Speculative tokens price future value with no cash flow backing. Neither fits an entity that earns revenue by doing work.

## What BlockHelix Actually Is

A royalty company for AI labor.

Franco-Nevada pays gold miners upfront and collects a percentage of future gold production. BlockHelix depositors fund agent vaults and collect 25% of future service revenue. The analogy is precise:

- **Franco-Nevada:** Deposits capital with a mine. Gets 2-5% of gold production. Mine operator keeps the rest. Capital funds expansion.
- **BlockHelix:** Deposits USDC in a vault. Gets 25% of x402 revenue. Agent operator keeps 70%. Protocol takes 5%. Capital funds the agent's working runway.

The critical difference from speculative tokens: every dollar of depositor return traces to an external payment from a real client paying for a real service. Revenue is earned, not minted.

## The Revenue Split (On-Chain, Enforced by Anchor Program)

```
Client pays $5.00 for a code patch via x402
  -> $3.50 (70%) to agent operator
  -> $1.25 (25%) to vault (depositors)
  -> $0.25 (5%)  to protocol treasury
```

This split is enforced in the `receive_revenue` instruction. It is not configurable post-deployment. The vault PDA controls all funds -- no single key can drain it.

## The Yield Floor (Architected, Not Yet Deployed)

Idle vault capital will be deployed to Kamino Finance (Solana lending, ~$2.8B TVL) earning 4-8% APY from external borrowers. This creates a yield floor: even if the agent earns zero revenue, depositors earn lending yield on their capital.

For MVP, the floor is architectural -- the vault tracks `deployed_capital` and `yield_earned`, and the dynamic TVL cap formula accounts for `lending_floor_bps`. The Kamino integration ships post-hackathon.

## What Depositors Are Actually Buying

Not insurance. Not equity. Not a hedge fund allocation.

**A revenue royalty with downside protection.**

| Component | Source | Status |
|:----------|:-------|:-------|
| 25% revenue share | x402 client payments | Live on-chain |
| Lending yield floor | Kamino borrower interest | Architected |
| Operator bond (first-loss) | Agent operator's stake | Live on-chain |
| Slippage protection | min_shares_out / min_assets_out | Live on-chain |
| Lockup-epoch exit | Time-weighted share accounting | Live on-chain |

**The honest story for $5 micropayments:** You are betting on a productive agent. If the agent does good work and attracts clients, you earn a share of its revenue. The operator bond means the agent operator has skin in the game (minimum 100 USDC bond, slashable at 2x). The lending yield floor (future) ensures your capital earns something even during dry spells.

**The honest story for enterprise contracts:** At higher price points ($1K+ jobs), the vault functions as genuine collateral. The operator bond and depositor capital back a quality guarantee. Clients get refunds from slashing if work is rejected through the arbitrator dispute process.

## Why Not Just Lend on Kamino?

Because the revenue component dominates. At 60 jobs/month ($5 each):

| Strategy | Annual Return | Source |
|:---------|:-------------|:-------|
| Kamino USDC lending | ~8% | Borrower interest |
| BlockHelix vault (60 jobs/mo) | ~14.6% | 25% rev share + lending floor |
| BlockHelix vault (100 jobs/mo) | ~20.6% | Same structure, higher demand |

The premium over pure lending is 6-12 percentage points. That premium compensates for agent-specific risk: demand volatility, potential slashing, smart contract risk.

## Why This Is Not Circular

Three-sentence proof:

1. NAV per share does not change on deposit or withdrawal (ERC4626 math, proven on-chain with virtual offsets).
2. NAV only increases from revenue (external x402 payments) or lending yield (external Kamino borrowers).
3. Therefore, Depositor A's return is never funded by Depositor B's capital.

This is the same structure as a REIT (rental income from external tenants) or a royalty company (production payments from external mines). It is not the structure of a Ponzi scheme (returns from new deposits).

## The Dynamic TVL Cap

The vault auto-sizes to prevent yield dilution. The on-chain `calculate_dynamic_max_tvl` function caps deposits based on trailing revenue:

```
dynamic_cap = (annualized_depositor_revenue * 10000) / (target_apy - lending_floor)
```

If an agent earns $300/month and the target is 10% APY above the lending floor, the cap self-adjusts to ~$15,600. More revenue unlocks more capacity. Less revenue shrinks it. Capital cannot accumulate beyond what the agent can make productive.

## What We Built (On-Chain, Tested, Deployed)

| Component | Status |
|:----------|:-------|
| AgentVault (Anchor) | Deployed. deposit, withdraw, receive_revenue, slash, pause. ERC4626 share math with virtual offsets. |
| ReceiptRegistry (Anchor) | Deployed. Job receipts with artifact hashes, challenge windows, arbitrator resolution. |
| AgentFactory (Anchor) | Deployed. Atomic agent creation via CPI (vault + registry in one tx). |
| Dynamic TVL cap | On-chain. Revenue-linked, auto-adjusting. |
| Operator bond + slashing | On-chain. 2x multiplier, first-loss for operator, arbitrator-controlled. |
| Lockup epochs | On-chain. Configurable per-vault, prevents MEV front-running. |

## For Judges: The Three Questions

**Is the yield real?** Yes. 25% of x402 payments from external clients. Verifiable on-chain via receipt registry.

**Is it circular?** No. Deposits do not change NAV. Returns come from revenue and lending yield, both external. Formal proof in non-circularity document.

**What is new here?** The capital structure for autonomous economic entities. Not a DAO (no human members). Not a corporation (no legal entity). Not a DeFi vault (capital does not generate yield directly). An on-chain royalty company where the mine is an AI agent and the gold is service revenue.
