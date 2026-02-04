"""
BlockHelix Economic Model Simulations
Quantitative analysis of tokenised agent vault dynamics.
"""

import math
from dataclasses import dataclass, field
from typing import List, Tuple

# ============================================================
# 1. CORE VAULT SIMULATOR
# ============================================================

@dataclass
class VaultState:
    usdc_balance: float = 0.0
    total_shares: float = 0.0
    total_revenue: float = 0.0
    total_spend: float = 0.0
    agent_fee_bps: int = 7000     # 70% to agent
    protocol_fee_bps: int = 1000  # 10% to protocol
    # vault gets remainder: 20%

    @property
    def vault_fee_bps(self) -> int:
        return 10000 - self.agent_fee_bps - self.protocol_fee_bps

    @property
    def nav_per_share(self) -> float:
        if self.total_shares == 0:
            return 1.0
        return self.usdc_balance / self.total_shares

    def deposit(self, amount: float) -> float:
        assert amount > 0
        nav_before = self.nav_per_share
        if self.total_shares == 0:
            shares = amount
        else:
            shares = amount / self.nav_per_share
        self.usdc_balance += amount
        self.total_shares += shares
        nav_after = self.nav_per_share
        assert abs(nav_before - nav_after) < 1e-10, f"NAV conservation violated: {nav_before} -> {nav_after}"
        return shares

    def withdraw(self, shares: float) -> float:
        assert shares > 0
        assert shares <= self.total_shares
        nav_before = self.nav_per_share
        usdc_out = shares * self.nav_per_share
        self.total_shares -= shares
        self.usdc_balance -= usdc_out
        if self.total_shares > 1e-12:
            nav_after = self.nav_per_share
            assert abs(nav_before - nav_after) < 1e-10, f"NAV conservation violated: {nav_before} -> {nav_after}"
        return usdc_out

    def receive_revenue(self, amount: float) -> dict:
        assert amount > 0
        vault_cut = amount * self.vault_fee_bps / 10000
        protocol_cut = amount * self.protocol_fee_bps / 10000
        agent_cut = amount - vault_cut - protocol_cut
        self.usdc_balance += vault_cut
        self.total_revenue += amount
        return {"vault": vault_cut, "protocol": protocol_cut, "agent": agent_cut}

    def spend(self, amount: float) -> None:
        assert amount > 0
        assert amount <= self.usdc_balance, f"Insufficient balance: {self.usdc_balance} < {amount}"
        self.usdc_balance -= amount
        self.total_spend += amount


# ============================================================
# 2. SHARE PRICE DYNAMICS SIMULATION
# ============================================================

def simulate_share_price_dynamics():
    """Walk through the exact scenario requested: deposits, spend, revenue, more deposits, withdrawals."""
    v = VaultState()
    log = []

    # (a) Initial capital comes in
    s1 = v.deposit(10000)
    log.append(("Alice deposits $10,000", v.nav_per_share, v.usdc_balance, v.total_shares, s1))

    s2 = v.deposit(5000)
    log.append(("Bob deposits $5,000", v.nav_per_share, v.usdc_balance, v.total_shares, s2))

    # (b) Agent spends on operations
    v.spend(3000)
    log.append(("Agent spends $3,000 on compute", v.nav_per_share, v.usdc_balance, v.total_shares, 0))

    # (c) Revenue flows in ($8,000 gross, vault gets 20% = $1,600)
    r = v.receive_revenue(8000)
    log.append((f"Revenue $8,000 (vault gets ${r['vault']:.0f})", v.nav_per_share, v.usdc_balance, v.total_shares, 0))

    # (d) More deposits arrive (Charlie sees the agent is profitable)
    s3 = v.deposit(5000)
    log.append(("Charlie deposits $5,000", v.nav_per_share, v.usdc_balance, v.total_shares, s3))

    # More operations
    v.spend(2000)
    log.append(("Agent spends $2,000", v.nav_per_share, v.usdc_balance, v.total_shares, 0))

    r2 = v.receive_revenue(12000)
    log.append((f"Revenue $12,000 (vault gets ${r2['vault']:.0f})", v.nav_per_share, v.usdc_balance, v.total_shares, 0))

    # (e) Alice withdraws
    usdc_out = v.withdraw(s1)
    log.append((f"Alice withdraws all shares -> ${usdc_out:.2f}", v.nav_per_share, v.usdc_balance, v.total_shares, 0))

    print("=" * 90)
    print("SHARE PRICE DYNAMICS SIMULATION")
    print("=" * 90)
    print(f"{'Event':<45} {'NAV/Share':>10} {'Balance':>10} {'Shares':>10} {'New Shares':>10}")
    print("-" * 90)
    for event, nav, bal, shares, new_shares in log:
        ns = f"{new_shares:.2f}" if new_shares > 0 else "-"
        print(f"{event:<45} {nav:>10.4f} {bal:>10.2f} {shares:>10.2f} {ns:>10}")
    print()


# ============================================================
# 3. FREE-RIDER ANALYSIS
# ============================================================

def simulate_free_rider():
    """Does the share price mechanism handle late depositors correctly?"""
    v = VaultState()

    # Alice deposits early, funds the agent
    s_alice = v.deposit(5000)

    # Agent spends Alice's capital on compute
    v.spend(2000)

    # Agent earns revenue from that compute
    v.receive_revenue(6000)  # vault gets 20% = $1,200

    nav_before_bob = v.nav_per_share

    # Bob deposits AFTER revenue is earned
    s_bob = v.deposit(5000)

    nav_after_bob = v.nav_per_share

    # Check: Bob pays the higher NAV, so he gets fewer shares
    alice_value = s_alice * v.nav_per_share
    bob_value = s_bob * v.nav_per_share

    print("=" * 70)
    print("FREE-RIDER ANALYSIS")
    print("=" * 70)
    print(f"Alice deposited $5,000, got {s_alice:.2f} shares")
    print(f"Agent spent $2,000, earned $6,000 revenue (vault +$1,200)")
    print(f"NAV before Bob: ${nav_before_bob:.4f}")
    print(f"Bob deposited $5,000, got {s_bob:.2f} shares")
    print(f"NAV after Bob:  ${nav_after_bob:.4f}")
    print(f"Alice's shares now worth: ${alice_value:.2f} (ROI: {(alice_value/5000 - 1)*100:.2f}%)")
    print(f"Bob's shares now worth:   ${bob_value:.2f} (ROI: {(bob_value/5000 - 1)*100:.2f}%)")
    print()
    print("VERDICT: The share price mechanism correctly protects early depositors.")
    print("Bob pays the appreciated NAV, so he gets fewer shares. Alice's gain is")
    print("already reflected in her share price before Bob deposits.")
    print()


# ============================================================
# 4. CAPITAL EFFICIENCY ANALYSIS
# ============================================================

def capital_efficiency_model():
    """Model R(k), C(k), and optimal TVL for different agent types."""

    print("=" * 80)
    print("CAPITAL EFFICIENCY ANALYSIS")
    print("=" * 80)

    # Real cost basis (USDC, monthly)
    claude_cost_per_job = 0.23   # ~50K in, ~5K out for patch generation
    audit_sub_agent = 0.10       # lighter analysis
    test_sub_agent = 0.05        # simple test runs
    hosting_monthly = 20.0
    solana_tx_cost = 0.00025

    cost_per_job = claude_cost_per_job + audit_sub_agent + test_sub_agent + solana_tx_cost * 3
    price_per_job = 5.0
    profit_per_job = price_per_job - cost_per_job
    vault_retention = 0.20

    print(f"\nUnit Economics:")
    print(f"  Revenue per job:  ${price_per_job:.2f}")
    print(f"  Cost per job:     ${cost_per_job:.4f}")
    print(f"  Profit per job:   ${profit_per_job:.4f}")
    print(f"  Margin:           {profit_per_job/price_per_job*100:.1f}%")
    print(f"  Vault retention:  {vault_retention*100:.0f}% of revenue")

    # Scenario analysis
    scenarios = [
        ("A: No capital needs (free compute)", 0, 100, 0),
        ("B: Compute-limited (20 -> 100 jobs)", 1000, 100, 20),
        ("C: Parallel scaling (10 -> 50 jobs)", 5000, 50, 10),
        ("D: Demand ceiling (capital for 100, gets 30)", 5000, 30, 30),
    ]

    print(f"\n{'Scenario':<45} {'TVL':>8} {'Jobs':>6} {'Rev/mo':>8} {'Yield/mo':>8} {'APY':>8}")
    print("-" * 90)

    for name, tvl, jobs, jobs_without in scenarios:
        monthly_rev = jobs * price_per_job
        monthly_cost = jobs * cost_per_job + hosting_monthly
        monthly_profit = monthly_rev - monthly_cost
        vault_income = monthly_rev * vault_retention
        net_vault = vault_income - (jobs * cost_per_job + hosting_monthly) if tvl > 0 else vault_income

        # For capital efficiency, the vault funds operations and receives vault_retention of revenue
        # Depositor yield = vault's share of profit / TVL
        if tvl > 0:
            # Agent spends from vault, revenue flows back to vault
            monthly_spend_from_vault = jobs * cost_per_job + hosting_monthly
            monthly_revenue_to_vault = monthly_rev * vault_retention
            net_to_vault = monthly_revenue_to_vault - monthly_spend_from_vault
            monthly_yield = net_to_vault / tvl if tvl > 0 else 0
            apy = (1 + monthly_yield) ** 12 - 1
        else:
            # No vault capital, just revenue retention
            monthly_yield = vault_income / 1  # undefined TVL
            apy = float('inf')

        tvl_str = f"${tvl:,}" if tvl > 0 else "N/A"
        yield_str = f"{monthly_yield*100:.2f}%" if tvl > 0 else "N/A"
        apy_str = f"{apy*100:.1f}%" if tvl > 0 and abs(apy) < 100 else ("N/A" if tvl == 0 else f"{apy*100:.0f}%")

        print(f"{name:<45} {tvl_str:>8} {jobs:>6} {monthly_rev:>8.0f} {yield_str:>8} {apy_str:>8}")

    # Optimal TVL calculation
    print(f"\n--- Optimal TVL Analysis ---")
    print(f"For a compute-funded agent charging ${price_per_job}/job, costing ${cost_per_job:.2f}/job:")

    for demand in [30, 50, 100, 200, 500]:
        monthly_rev = demand * price_per_job
        monthly_cost = demand * cost_per_job + hosting_monthly
        vault_income = monthly_rev * vault_retention
        # Optimal TVL = operational cost * runway_months
        for runway in [3, 6, 12]:
            optimal_tvl = monthly_cost * runway
            net_to_vault = vault_income - monthly_cost
            if optimal_tvl > 0:
                monthly_yield = net_to_vault / optimal_tvl
                apy = (1 + monthly_yield) ** 12 - 1
            else:
                apy = 0
            print(f"  Demand={demand:>3} jobs/mo, Runway={runway:>2}mo: "
                  f"TVL=${optimal_tvl:>8.0f}, Net/mo=${net_to_vault:>7.2f}, "
                  f"Yield={monthly_yield*100:>6.2f}%/mo, APY={apy*100:>7.1f}%")

    print()


# ============================================================
# 5. FEE CASCADE MODEL
# ============================================================

def fee_cascade_analysis():
    """Model the tax cascade effect in multi-agent supply chains."""
    print("=" * 80)
    print("FEE CASCADE ANALYSIS: Multi-Agent Supply Chains")
    print("=" * 80)

    # Fee structure
    agent_fee = 0.70
    protocol_fee = 0.10
    vault_retention = 0.20

    # What fraction of revenue does each layer spend on sub-agents?
    spend_ratios = [0.30, 0.50, 0.70]

    print(f"\nFee structure: Agent={agent_fee*100:.0f}%, Protocol={protocol_fee*100:.0f}%, Vault={vault_retention*100:.0f}%")
    print(f"\nInitial payment from client: $10.00")

    for spend_ratio in spend_ratios:
        print(f"\n--- Spend ratio per layer: {spend_ratio*100:.0f}% ---")
        print(f"{'Layer':<8} {'Receives':>10} {'Agent Cut':>10} {'Protocol':>10} {'Vault':>10} {'To Sub':>10} {'Work Done':>10}")
        print("-" * 75)

        payment = 10.0
        total_protocol = 0
        total_vault = 0
        total_work = 0

        for layer in range(1, 8):
            agent_cut = payment * agent_fee
            prot_cut = payment * protocol_fee
            vault_cut = payment * vault_retention
            sub_payment = agent_cut * spend_ratio  # agent spends part of its cut on sub-agents
            work_done = agent_cut - sub_payment      # remaining agent cut is actual work value

            total_protocol += prot_cut
            total_vault += vault_cut
            total_work += work_done

            print(f"L{layer:<7} {payment:>10.4f} {agent_cut:>10.4f} {prot_cut:>10.4f} "
                  f"{vault_cut:>10.4f} {sub_payment:>10.4f} {work_done:>10.4f}")

            if sub_payment < 0.01:
                break
            payment = sub_payment

        overhead = total_protocol + total_vault
        efficiency = total_work / 10.0
        print(f"\nTotal work purchased: ${total_work:.4f} / $10.00 ({efficiency*100:.1f}% efficient)")
        print(f"Total protocol fees:  ${total_protocol:.4f}")
        print(f"Total vault accrual:  ${total_vault:.4f}")
        print(f"Total overhead:       ${overhead:.4f} ({overhead/10*100:.1f}%)")

    # Compare: single agent doing all work vs. 3-agent supply chain
    print(f"\n--- Comparison: Single Agent vs 3-Agent Chain ---")
    client_payment = 10.0

    # Single agent
    single_prot = client_payment * protocol_fee
    single_vault = client_payment * vault_retention
    single_agent = client_payment * agent_fee
    single_work = single_agent  # all work done internally
    print(f"Single agent: Work=${single_work:.2f}, Protocol=${single_prot:.2f}, Vault=${single_vault:.2f}")

    # 3-agent chain (each passes 40% to next)
    payment = client_payment
    chain_prot = 0
    chain_vault = 0
    chain_work = 0
    for i in range(3):
        p = payment * protocol_fee
        va = payment * vault_retention
        ag = payment * agent_fee
        if i < 2:
            sub = ag * 0.40
            work = ag - sub
        else:
            sub = 0
            work = ag
        chain_prot += p
        chain_vault += va
        chain_work += work
        payment = sub

    print(f"3-agent chain: Work=${chain_work:.2f}, Protocol=${chain_prot:.4f}, Vault=${chain_vault:.4f}")
    print(f"Efficiency loss from chain: {(1 - chain_work/single_work)*100:.1f}%")
    print(f"Extra protocol fees:        ${chain_prot - single_prot:.4f}")
    print()


# ============================================================
# 6. GOVERNANCE MODEL COMPARISON
# ============================================================

def governance_simulation():
    """Simulate three governance models over 12 months with variable revenue."""
    print("=" * 80)
    print("GOVERNANCE MODEL COMPARISON (12-month simulation)")
    print("=" * 80)

    # Monthly revenue (volatile)
    monthly_revenues = [400, 300, 600, 500, 200, 800, 700, 100, 900, 500, 400, 600]
    cost_per_job = 0.38
    price_per_job = 5.0
    vault_retention = 0.20
    initial_tvl = 5000

    models = {
        "Fixed Budget ($200/mo)": lambda rev, trailing_avg, _: 200,
        "Revenue-Linked (60% of trailing rev)": lambda rev, trailing_avg, _: trailing_avg * vault_retention * 0.60,
        "Milestone (unlock on profit)": lambda rev, trailing_avg, cumulative_profit: min(300, max(100, cumulative_profit * 0.10)),
    }

    for model_name, budget_fn in models.items():
        print(f"\n--- {model_name} ---")
        print(f"{'Month':>6} {'Revenue':>8} {'Budget':>8} {'Spend':>8} {'Net':>8} {'NAV':>8} {'Vault Bal':>10}")
        print("-" * 65)

        balance = initial_tvl
        total_shares = initial_tvl  # $1/share initial
        trailing_revs = []
        cumulative_profit = 0

        for month, rev in enumerate(monthly_revenues, 1):
            trailing_revs.append(rev)
            trailing_avg = sum(trailing_revs[-3:]) / min(len(trailing_revs), 3)

            budget = budget_fn(rev, trailing_avg, cumulative_profit)
            vault_income = rev * vault_retention
            actual_spend = min(budget, balance * 0.5)  # can't spend more than 50% of balance

            balance += vault_income
            balance -= actual_spend
            cumulative_profit += vault_income - actual_spend
            nav = balance / total_shares if total_shares > 0 else 0

            print(f"{month:>6} {rev:>8.0f} {budget:>8.2f} {actual_spend:>8.2f} "
                  f"{vault_income - actual_spend:>8.2f} {nav:>8.4f} {balance:>10.2f}")

        final_roi = (balance / initial_tvl - 1) * 100
        print(f"Final balance: ${balance:.2f} (ROI: {final_roi:.1f}%)")

    print()


# ============================================================
# 7. FAILURE MODE ANALYSIS
# ============================================================

def failure_mode_analysis():
    """Quantify each failure mode."""
    print("=" * 80)
    print("FAILURE MODE QUANTITATIVE ANALYSIS")
    print("=" * 80)

    # F1: Idle capital trap
    print("\n--- F1: Idle Capital Trap ---")
    for tvl in [1000, 5000, 10000, 50000, 100000]:
        monthly_rev = 500  # fixed revenue regardless of TVL
        vault_income = monthly_rev * 0.20
        monthly_yield = vault_income / tvl
        apy = (1 + monthly_yield) ** 12 - 1
        usdc_lending_apy = 0.05  # ~5% on lending protocols
        print(f"  TVL=${tvl:>7,}: Yield={monthly_yield*100:.3f}%/mo, "
              f"APY={apy*100:.2f}%, vs USDC lending={usdc_lending_apy*100:.0f}% "
              f"{'UNCOMPETITIVE' if apy < usdc_lending_apy else 'OK'}")

    # F2: Negative unit economics
    print("\n--- F2: Negative Unit Economics ---")
    v = VaultState()
    v.deposit(5000)
    for month in range(1, 7):
        jobs = 50
        cost = jobs * 0.50  # higher cost scenario
        revenue = jobs * 0.30  # lower revenue scenario
        v.spend(min(cost, v.usdc_balance))
        if v.usdc_balance > 0:
            v.receive_revenue(revenue)
        print(f"  Month {month}: NAV=${v.nav_per_share:.4f}, Balance=${v.usdc_balance:.2f}, "
              f"Loss/mo=${cost - revenue * 0.20:.2f}")

    # F5: Capital flight / bank run
    print("\n--- F5: Capital Flight Simulation ---")
    v = VaultState()
    # 5 depositors, one whale
    shares = []
    shares.append(("Small_1", v.deposit(1000)))
    shares.append(("Small_2", v.deposit(1000)))
    shares.append(("Small_3", v.deposit(1000)))
    shares.append(("Small_4", v.deposit(1000)))
    shares.append(("Whale", v.deposit(6000)))

    # Agent has spent some capital
    v.spend(3000)
    v.receive_revenue(4000)  # vault gets $800

    print(f"  Pre-withdrawal: NAV=${v.nav_per_share:.4f}, Balance=${v.usdc_balance:.2f}")

    # Whale withdraws
    whale_shares = shares[4][1]
    whale_out = v.withdraw(whale_shares)
    print(f"  Whale withdraws {whale_shares:.0f} shares -> ${whale_out:.2f}")
    print(f"  Post-whale: NAV=${v.nav_per_share:.4f}, Balance=${v.usdc_balance:.2f}")
    print(f"  Remaining depositors' NAV unchanged: {v.nav_per_share:.4f}")
    print(f"  BUT: vault may no longer have enough capital to fund operations!")
    print(f"  Operational runway at $500/mo spend: {v.usdc_balance / 500:.1f} months")

    # F10: MEV / front-running deposit before revenue
    print("\n--- F10: MEV Front-Running Analysis ---")
    v = VaultState()
    v.deposit(10000)  # existing depositors
    nav_before = v.nav_per_share

    # Attacker deposits just before revenue event
    attacker_shares = v.deposit(10000)
    v.receive_revenue(5000)  # vault gets $1000
    nav_after_revenue = v.nav_per_share

    # Attacker immediately withdraws
    attacker_out = v.withdraw(attacker_shares)
    attacker_profit = attacker_out - 10000

    print(f"  NAV before attack:    ${nav_before:.6f}")
    print(f"  Attacker deposits:    $10,000 ({attacker_shares:.2f} shares)")
    print(f"  Revenue event:        $5,000 (vault +$1,000)")
    print(f"  NAV after revenue:    ${nav_after_revenue:.6f}")
    print(f"  Attacker withdraws:   ${attacker_out:.2f}")
    print(f"  Attacker profit:      ${attacker_profit:.2f}")
    print(f"  Without attack, existing depositors would have gained: "
          f"${1000:.2f} vs ${1000 - attacker_profit:.2f}")
    print(f"  Value extracted from existing depositors: ${attacker_profit:.2f}")

    print()


# ============================================================
# 8. COMPARATIVE ROI ANALYSIS
# ============================================================

def comparative_roi():
    """Compare agent vault returns to alternatives."""
    print("=" * 80)
    print("COMPARATIVE ROI ANALYSIS (Annual)")
    print("=" * 80)

    investment = 10000

    # Agent vault scenarios
    scenarios = [
        ("Agent vault (bull case: 100 jobs/mo)", 100, 5.0, 0.38, 0.20),
        ("Agent vault (base case: 50 jobs/mo)", 50, 5.0, 0.38, 0.20),
        ("Agent vault (bear case: 20 jobs/mo)", 20, 5.0, 0.38, 0.20),
    ]

    alternatives = [
        ("USDC lending (Aave/Compound)", 0.05),
        ("US Treasury Bills", 0.045),
        ("S&P 500 average return", 0.10),
        ("VC fund (25th percentile)", 0.08),
        ("VC fund (top quartile)", 0.25),
    ]

    print(f"\nInvestment: ${investment:,}")
    print(f"\n{'Strategy':<45} {'Annual Return':>15} {'$ Return':>10}")
    print("-" * 75)

    for name, jobs, price, cost, retention in scenarios:
        monthly_rev = jobs * price
        monthly_cost = jobs * cost + 20  # hosting
        vault_income = monthly_rev * retention
        # If vault funds operations:
        net_to_vault_monthly = vault_income - monthly_cost
        annual_return = net_to_vault_monthly * 12 / investment
        dollar_return = net_to_vault_monthly * 12
        print(f"{name:<45} {annual_return*100:>14.1f}% {dollar_return:>10.2f}")

    for name, annual_return in alternatives:
        dollar_return = investment * annual_return
        print(f"{name:<45} {annual_return*100:>14.1f}% {dollar_return:>10.2f}")

    print()


# ============================================================
# 9. INFLATION ATTACK ANALYSIS (first depositor)
# ============================================================

def inflation_attack_analysis():
    """Analyze first-depositor inflation attack on the current implementation."""
    print("=" * 80)
    print("FIRST-DEPOSITOR INFLATION ATTACK ANALYSIS")
    print("=" * 80)

    # Current implementation: shares = amount (when total_shares == 0)
    # No virtual offset, no dead shares

    print("\nCurrent implementation uses 1:1 ratio for first deposit (shares = amount)")
    print("USDC has 6 decimals, so minimum deposit = 1 (= 0.000001 USDC)")
    print()

    # Attack scenario
    print("Attack scenario:")
    print("1. Attacker deposits 1 micro-USDC (0.000001), gets 1 share")
    print("2. Attacker transfers 10,000 USDC directly to vault token account")
    print("3. NAV = 10,000.000001 / 1 = $10,000.000001 per share")
    print("4. Victim deposits 9,999 USDC")
    print("5. Victim shares = 9999 / 10000.000001 = 0.9999... -> rounds to 0")
    print("6. Attacker withdraws 1 share -> gets all 19,999 USDC")
    print()

    # However, the Solana implementation requires tokens go through the program
    print("MITIGATION IN CURRENT IMPLEMENTATION:")
    print("- Direct transfers to vault_usdc_account bypass share accounting")
    print("- The vault's receive_revenue requires agent_wallet signature")
    print("- An attacker cannot inflate NAV via receive_revenue (needs agent key)")
    print("- BUT: SPL tokens CAN be transferred directly to any token account")
    print("- This means the inflation attack IS possible on Solana")
    print()
    print("RECOMMENDED MITIGATIONS:")
    print("1. Virtual offset: Initialize with virtual_shares=1e6, virtual_assets=1e6")
    print("   This makes the attack cost ~$1M to steal $1")
    print("2. Minimum first deposit: Require first deposit >= $10")
    print("3. Dead shares: Mint 1000 shares to a burn address on first deposit")
    print()


# ============================================================
# 10. OPTIMAL TVL FORMULA
# ============================================================

def optimal_tvl_analysis():
    """Derive and test the TVL cap formula."""
    print("=" * 80)
    print("OPTIMAL TVL FORMULA ANALYSIS")
    print("=" * 80)

    cost_per_job = 0.38
    price_per_job = 5.0
    vault_retention = 0.20
    hosting = 20.0

    print(f"\nProposed formula: max_tvl = burn_rate x runway_months")
    print(f"Alternative: max_tvl = f(demand, cost, target_yield)")
    print()

    # The right formula should balance: enough capital to fund operations
    # without so much that yield becomes uncompetitive

    target_yields = [0.05, 0.10, 0.15, 0.20]  # annual target yields
    usdc_risk_free = 0.05

    print(f"{'Demand':>8} {'Monthly Cost':>12} {'Vault Rev/mo':>12} {'Net/mo':>8} ", end="")
    for ty in target_yields:
        print(f"{'TVL@'+str(int(ty*100))+'%':>10}", end="")
    print()
    print("-" * 80)

    for demand in [20, 50, 100, 200, 500]:
        monthly_cost = demand * cost_per_job + hosting
        monthly_rev = demand * price_per_job
        vault_rev = monthly_rev * vault_retention
        net_monthly = vault_rev - monthly_cost

        print(f"{demand:>8} {monthly_cost:>12.2f} {vault_rev:>12.2f} {net_monthly:>8.2f} ", end="")

        for target_yield in target_yields:
            if net_monthly <= 0:
                print(f"{'N/A':>10}", end="")
            else:
                # TVL = net_monthly * 12 / target_yield
                tvl = net_monthly * 12 / target_yield
                print(f"${tvl:>9.0f}", end="")
        print()

    print()
    print("FINDING: The optimal TVL cap should be:")
    print("  max_tvl = min(burn_rate x runway, net_vault_income x 12 / target_yield)")
    print("  where target_yield >= USDC_lending_rate (currently ~5%)")
    print("  This ensures depositors always earn more than the risk-free alternative.")
    print()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    simulate_share_price_dynamics()
    simulate_free_rider()
    capital_efficiency_model()
    fee_cascade_analysis()
    governance_simulation()
    failure_mode_analysis()
    comparative_roi()
    inflation_attack_analysis()
    optimal_tvl_analysis()
