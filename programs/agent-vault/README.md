# AgentVault

ERC4626-style vault for tokenized AI agent investment. Operators and depositors hold the same share token, aligning incentives.

## How It Works

```
Operator deposits USDC → gets shares (must hold MIN_OPERATOR_SHARES)
Depositors deposit USDC → get shares
Agent earns revenue → USDC flows to vault → NAV increases
All shareholders benefit proportionally
```

## Instructions

| Instruction | Who | Description |
|------------|-----|-------------|
| `initialize` | Operator | Create vault with fee config and arbitrator |
| `deposit` | Anyone* | Deposit USDC, receive shares |
| `withdraw` | Anyone | Burn shares, receive USDC |
| `receive_revenue` | Anyone | Route job revenue to vault (after fees) |
| `slash` | **Arbitrator only** | Burn shares + transfer USDC to claimant |
| `pause` | Operator | Stop new deposits |
| `unpause` | Operator | Resume deposits (requires MIN shares) |

*Depositors can only deposit when operator holds ≥ MIN_OPERATOR_SHARES

## Access Control

- **Operator**: The agent wallet. Can pause/unpause, must maintain minimum shares.
- **Arbitrator**: Trusted third party for dispute resolution. Only account that can slash.
- **Depositors**: Anyone can deposit/withdraw (subject to lockup).

## Slashing (Private)

Only the arbitrator can call `slash`. This is intentional:

1. Client files dispute with arbitrator
2. Arbitrator reviews evidence
3. If valid, arbitrator calls `slash(usdc_amount, job_id)`
4. Operator shares burned first (up to their balance)
5. If operator shares insufficient, remaining burns from all shares proportionally
6. USDC transferred to claimant

```rust
// Only arbitrator can slash
#[account(constraint = authority.key() == vault_state.arbitrator)]
pub authority: Signer<'info>,
```

## Share Math

Shares use virtual shares/assets to prevent inflation attacks:

```
shares_out = deposit_amount * (total_shares + VIRTUAL_SHARES) / (total_assets + VIRTUAL_ASSETS)
usdc_out = burn_shares * (total_assets + VIRTUAL_ASSETS) / (total_shares + VIRTUAL_SHARES)
```

## Operator Lifecycle

```
1. initialize() - Create vault
2. deposit() - Operator deposits MIN_OPERATOR_SHARES worth
3. [Depositors can now deposit]
4. [Agent runs, earns revenue]
5. pause() - Stop new deposits
6. [Depositors withdraw]
7. withdraw() - Operator withdraws (can go to 0 when paused)
8. Done - vault empty, agent retired
```

## Fee Split

Revenue is split on `receive_revenue`:
- `agent_fee_bps` → stays with caller (operator keeps)
- `protocol_fee_bps` → protocol treasury
- remainder → vault (increases NAV for all shareholders)

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| MIN_OPERATOR_SHARES | 100,000,000 | ~100 shares at 6 decimals |
| VIRTUAL_SHARES | 1,000,000 | Anti-inflation protection |
| VIRTUAL_ASSETS | 1,000,000 | Anti-inflation protection |
| BPS_DENOMINATOR | 10,000 | 100% in basis points |
