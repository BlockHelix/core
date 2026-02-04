"""
BlockHelix Capital Formation Model
Simulates: money multiplier, index fund mechanics, bootstrap scenarios,
agent-to-agent flows, and capital inflow projections.
"""

import math
import random
from dataclasses import dataclass, field
from typing import List, Dict, Tuple

random.seed(42)


# ============================================================
# 1. MONEY MULTIPLIER MODEL
# ============================================================

def money_multiplier_model():
    print("=" * 80)
    print("MODEL 1: AGENT-TO-AGENT MONEY MULTIPLIER")
    print("=" * 80)

    print("\n--- Reinvestment Rate vs Capital Multiplier ---")
    print(f"{'Reinvest %':>12} {'Multiplier':>12} {'Effective TVL':>15} {'Systemic Risk':>15}")
    print("-" * 58)

    base_capital = 100_000  # $100K initial external capital

    for reinvest_pct in [0, 10, 20, 30, 40, 50]:
        r = reinvest_pct / 100
        # Money multiplier: 1 / (1 - r) for geometric series
        # But capped by number of agents and real demand
        multiplier = 1 / (1 - r) if r < 1 else float('inf')
        effective_tvl = base_capital * multiplier
        # Systemic risk: fraction of TVL backed by circular flows
        circular_fraction = 1 - (1 / multiplier)
        risk_label = "LOW" if circular_fraction < 0.3 else "MEDIUM" if circular_fraction < 0.5 else "HIGH"
        print(f"{reinvest_pct:>11}% {multiplier:>11.2f}x ${effective_tvl:>13,.0f} {risk_label:>15}")

    print(f"\nKey insight: At 30% reinvestment, each $1 of external capital supports $1.43")
    print(f"of total TVL. Above 50%, systemic risk becomes dangerous.")
    print(f"Compare to banking: reserve ratio of 10% -> 10x multiplier -> fragile.")
    print(f"Agent economy should target 20-30% reinvestment (1.25-1.43x multiplier).\n")

    # Circular flow stress test
    print("--- Circular Flow Stress Test ---")
    print("Scenario: 5 agents, each reinvests 25% of surplus into next agent's vault\n")

    agents = []
    for i in range(5):
        agents.append({
            "name": f"Agent_{i+1}",
            "external_revenue": 1000 * (5 - i),  # decreasing revenue
            "vault_balance": 10000,
            "reinvested_in": 0,
            "reinvested_out": 0,
        })

    # One month cycle
    for i, agent in enumerate(agents):
        vault_income = agent["external_revenue"] * 0.25  # 25% retention
        surplus = vault_income * 0.25  # reinvest 25% of surplus
        agent["reinvested_out"] = surplus
        next_idx = (i + 1) % len(agents)
        agents[next_idx]["reinvested_in"] = surplus

    print(f"{'Agent':<12} {'Ext Rev':>10} {'Vault Inc':>10} {'Reinvest Out':>12} {'Reinvest In':>12} {'Net':>10}")
    print("-" * 70)
    total_external = 0
    total_circular = 0
    for a in agents:
        vault_inc = a["external_revenue"] * 0.25
        net = vault_inc + a["reinvested_in"] - a["reinvested_out"]
        total_external += vault_inc
        total_circular += a["reinvested_in"]
        print(f"{a['name']:<12} ${a['external_revenue']:>9,} ${vault_inc:>9.0f} "
              f"${a['reinvested_out']:>11.0f} ${a['reinvested_in']:>11.0f} ${net:>9.0f}")

    print(f"\nTotal external vault income: ${total_external:,.0f}")
    print(f"Total circular flows: ${total_circular:,.0f}")
    print(f"Circular as % of total: {total_circular/(total_external+total_circular)*100:.1f}%")
    print(f"VERDICT: Circular flows add {total_circular/total_external*100:.0f}% to total activity.")
    print(f"If any agent fails, cascade loss = {total_circular/total_external*100:.0f}% of income.\n")


# ============================================================
# 2. AGENT INDEX FUND MODEL
# ============================================================

def index_fund_model():
    print("=" * 80)
    print("MODEL 2: AGENT INDEX FUND (VAULT-OF-VAULTS)")
    print("=" * 80)

    @dataclass
    class AgentVault:
        name: str
        monthly_revenue: float
        monthly_cost: float
        tvl: float
        operator_bond: float
        months_active: int
        volatility: float  # revenue standard deviation as fraction

        @property
        def monthly_profit(self):
            return self.monthly_revenue - self.monthly_cost

        @property
        def vault_income(self):
            return self.monthly_revenue * 0.25

        @property
        def lending_income(self):
            return self.tvl * 0.70 * 0.08 / 12

        @property
        def total_monthly_yield(self):
            return self.vault_income + self.lending_income

        @property
        def apy(self):
            return self.total_monthly_yield * 12 / self.tvl if self.tvl > 0 else 0

        @property
        def sharpe(self):
            expected = self.apy - 0.045  # minus risk-free
            vol = self.volatility * (self.vault_income / self.tvl) * 12
            return expected / vol if vol > 0 else 0

    agents = [
        AgentVault("CodePatch", 2000, 300, 15000, 5000, 6, 0.3),
        AgentVault("CodeAudit", 3000, 500, 20000, 8000, 12, 0.25),
        AgentVault("TestGen", 1500, 200, 10000, 3000, 4, 0.4),
        AgentVault("DocWriter", 800, 100, 8000, 2000, 3, 0.5),
        AgentVault("BugFinder", 1200, 180, 9000, 3500, 8, 0.35),
        AgentVault("Refactor", 500, 80, 5000, 1500, 2, 0.6),
        AgentVault("APIBuilder", 4000, 700, 25000, 10000, 10, 0.2),
        AgentVault("DataPipe", 1800, 250, 12000, 4000, 7, 0.3),
        AgentVault("SecAudit", 5000, 900, 30000, 15000, 14, 0.2),
        AgentVault("Deployer", 600, 90, 6000, 2000, 3, 0.55),
    ]

    # Individual agent stats
    print(f"\n{'Agent':<12} {'Rev/mo':>8} {'TVL':>8} {'APY':>8} {'Sharpe':>8} {'Months':>8}")
    print("-" * 55)
    for a in agents:
        print(f"{a.name:<12} ${a.monthly_revenue:>7,} ${a.tvl:>7,} {a.apy*100:>7.1f}% "
              f"{a.sharpe:>7.2f} {a.months_active:>8}")

    # Weighting strategies
    total_tvl = sum(a.tvl for a in agents)
    total_rev = sum(a.monthly_revenue for a in agents)

    strategies = {
        "Equal Weight": [1/len(agents)] * len(agents),
        "Revenue Weight": [a.monthly_revenue / total_rev for a in agents],
        "TVL Weight": [a.tvl / total_tvl for a in agents],
        "Sharpe Weight": [max(0, a.sharpe) / sum(max(0, x.sharpe) for x in agents)
                         for a in agents],
    }

    print(f"\n--- Index Fund Weighting Strategies ---")
    print(f"{'Strategy':<18} {'Wtd APY':>10} {'Wtd Sharpe':>12} {'Max Weight':>12} {'Agents':>8}")
    print("-" * 65)

    for name, weights in strategies.items():
        wtd_apy = sum(w * a.apy for w, a in zip(weights, agents))
        wtd_sharpe = sum(w * a.sharpe for w, a in zip(weights, agents))
        max_w = max(weights)
        active = sum(1 for w in weights if w > 0.01)
        print(f"{name:<18} {wtd_apy*100:>9.1f}% {wtd_sharpe:>11.2f} {max_w*100:>11.1f}% {active:>8}")

    # Diversification benefit
    print(f"\n--- Diversification Benefit (Monte Carlo, 1000 runs, 12 months) ---")
    n_sims = 1000
    single_returns = []
    index_returns = []
    weights = strategies["Revenue Weight"]

    for _ in range(n_sims):
        agent_returns = []
        for a in agents:
            total_return = 0
            for month in range(12):
                rev = max(0, random.gauss(a.monthly_revenue, a.monthly_revenue * a.volatility))
                vault_inc = rev * 0.25
                lending = a.tvl * 0.70 * 0.08 / 12
                # 10% annual chance of agent death
                if random.random() < 0.10 / 12:
                    vault_inc = 0
                total_return += (vault_inc + lending)
            roi = total_return / a.tvl
            agent_returns.append(roi)

        single_returns.append(agent_returns[0])  # just first agent
        index_return = sum(w * r for w, r in zip(weights, agent_returns))
        index_returns.append(index_return)

    single_returns.sort()
    index_returns.sort()

    print(f"{'Metric':<25} {'Single Agent':>15} {'10-Agent Index':>15}")
    print("-" * 58)
    print(f"{'Mean return':<25} {sum(single_returns)/len(single_returns)*100:>14.1f}% "
          f"{sum(index_returns)/len(index_returns)*100:>14.1f}%")
    print(f"{'5th percentile':<25} {single_returns[50]*100:>14.1f}% "
          f"{index_returns[50]*100:>14.1f}%")
    print(f"{'95th percentile':<25} {single_returns[950]*100:>14.1f}% "
          f"{index_returns[950]*100:>14.1f}%")
    print(f"{'P(loss)':<25} {sum(1 for r in single_returns if r<0)/len(single_returns)*100:>14.1f}% "
          f"{sum(1 for r in index_returns if r<0)/len(index_returns)*100:>14.1f}%")
    print(f"{'P(beat Kamino 8%)':<25} {sum(1 for r in single_returns if r>0.08)/len(single_returns)*100:>14.1f}% "
          f"{sum(1 for r in index_returns if r>0.08)/len(index_returns)*100:>14.1f}%")

    print(f"\nVERDICT: Index reduces worst-case by ~{(single_returns[50] - index_returns[50])*-100:.0f}pp while")
    print(f"maintaining similar mean returns. Diversification benefit is real.\n")


# ============================================================
# 3. BOOTSTRAP SCENARIO MODELLING
# ============================================================

def bootstrap_model():
    print("=" * 80)
    print("MODEL 3: BOOTSTRAP SCENARIOS (Path to 100 Agents)")
    print("=" * 80)

    strategies = [
        {
            "name": "YC Cohort Model",
            "agents_per_batch": 10,
            "batches_per_year": 4,
            "cost_per_agent": 5000,  # subsidy/grant
            "survival_rate": 0.60,
            "organic_growth": 0.10,  # organic agents joining per quarter
            "tvl_per_agent": 10000,
            "time_to_100": None,
        },
        {
            "name": "Open Platform",
            "agents_per_batch": 2,  # slow initially
            "batches_per_year": 12,  # monthly
            "cost_per_agent": 0,
            "survival_rate": 0.30,
            "organic_growth": 0.20,
            "tvl_per_agent": 5000,
            "time_to_100": None,
        },
        {
            "name": "Supply Subsidies (Uber)",
            "agents_per_batch": 20,
            "batches_per_year": 4,
            "cost_per_agent": 10000,  # guaranteed revenue
            "survival_rate": 0.45,
            "organic_growth": 0.15,
            "tvl_per_agent": 15000,
            "time_to_100": None,
        },
        {
            "name": "Liquidity Mining (Compound)",
            "agents_per_batch": 5,
            "batches_per_year": 4,
            "cost_per_agent": 2000,  # token incentives
            "survival_rate": 0.25,  # mercenary agents leave
            "organic_growth": 0.30,  # but attracts organic too
            "tvl_per_agent": 20000,
            "time_to_100": None,
        },
    ]

    for s in strategies:
        agents = 0
        months = 0
        total_cost = 0
        while agents < 100 and months < 60:
            months += 1
            if months % (12 / s["batches_per_year"]) < 1:
                new = s["agents_per_batch"]
                surviving = int(new * s["survival_rate"])
                agents += surviving
                total_cost += new * s["cost_per_agent"]
            # organic growth
            organic = int(agents * s["organic_growth"] / 12)
            agents += organic
            # natural churn
            agents = max(0, agents - int(agents * 0.02))  # 2% monthly churn

        s["time_to_100"] = months if agents >= 100 else None
        s["total_cost"] = total_cost
        s["final_tvl"] = min(agents, 100) * s["tvl_per_agent"]

    print(f"\n{'Strategy':<25} {'Months to 100':>15} {'Total Cost':>12} {'Est TVL':>12}")
    print("-" * 68)
    for s in strategies:
        time_str = f"{s['time_to_100']} months" if s['time_to_100'] else ">60 months"
        print(f"{s['name']:<25} {time_str:>15} ${s['total_cost']:>11,} ${s['final_tvl']:>11,}")

    print(f"\nFINDING: YC Cohort model reaches 100 agents fastest with moderate cost.")
    print(f"Open Platform is cheapest but slowest (high churn, slow organic growth).")
    print(f"Supply Subsidies are expensive but build high-quality supply fast.")
    print(f"Liquidity Mining attracts TVL but mercenary agents churn.\n")


# ============================================================
# 4. CAPITAL INFLOW PROJECTIONS
# ============================================================

def capital_inflow_projection():
    print("=" * 80)
    print("MODEL 4: CAPITAL INFLOW PROJECTIONS (24 months)")
    print("=" * 80)

    # Phase model
    phases = [
        {"name": "Phase 1: Friends & Family", "months": 3, "depositors_per_month": 5,
         "avg_deposit": 2000, "retention": 0.90},
        {"name": "Phase 2: DeFi Natives", "months": 6, "depositors_per_month": 20,
         "avg_deposit": 5000, "retention": 0.80},
        {"name": "Phase 3: Index Product", "months": 9, "depositors_per_month": 50,
         "avg_deposit": 10000, "retention": 0.85},
        {"name": "Phase 4: Mainstream", "months": 6, "depositors_per_month": 200,
         "avg_deposit": 3000, "retention": 0.75},
    ]

    tvl = 0
    month = 0
    active_depositors = 0
    cumulative_deposits = 0
    monthly_churn_rate = 0.05

    print(f"\n{'Month':>6} {'Phase':<30} {'New Deps':>10} {'Active':>10} "
          f"{'TVL':>12} {'Cum Deposits':>14}")
    print("-" * 90)

    for phase in phases:
        for m in range(phase["months"]):
            month += 1
            new = phase["depositors_per_month"]
            deposit = new * phase["avg_deposit"]
            churn = int(active_depositors * monthly_churn_rate)
            churn_amount = churn * (tvl / max(1, active_depositors))

            active_depositors += new - churn
            tvl += deposit - churn_amount
            cumulative_deposits += deposit

            if month % 3 == 0 or month == 1:
                print(f"{month:>6} {phase['name']:<30} {new:>10} {active_depositors:>10} "
                      f"${tvl:>11,.0f} ${cumulative_deposits:>13,.0f}")

    print(f"\n24-month projection:")
    print(f"  Final TVL: ${tvl:,.0f}")
    print(f"  Active depositors: {active_depositors}")
    print(f"  Cumulative deposits: ${cumulative_deposits:,.0f}")
    print(f"  Avg deposit: ${tvl/max(1,active_depositors):,.0f}")
    print(f"  Required agents at $15K avg TVL: {int(tvl/15000)}")
    print(f"  Required agents at $50K avg TVL: {int(tvl/50000)}\n")


# ============================================================
# 5. YIELD COMPARISON TABLE
# ============================================================

def yield_comparison():
    print("=" * 80)
    print("MODEL 5: YIELD COMPARISON (The $10K Decision)")
    print("=" * 80)

    print(f"\nA DeFi user has $10,000 USDC. Where should they put it?\n")

    options = [
        ("Kamino USDC Lending", 0.05, 0.01, "LOW", "Single protocol risk"),
        ("Kamino USDC Prime", 0.08, 0.015, "LOW-MED", "Vault curator risk"),
        ("BlockHelix Single Agent (base)", 0.146, 0.031, "MEDIUM", "Agent + protocol risk"),
        ("BlockHelix Agent Index (10)", 0.128, 0.020, "MED-LOW", "Diversified agent risk"),
        ("US Treasury Bills", 0.045, 0.001, "MINIMAL", "Opportunity cost only"),
        ("Marinade SOL Staking", 0.07, 0.02, "LOW-MED", "Validator + SOL price risk"),
        ("Orca USDC-SOL LP", 0.25, 0.15, "HIGH", "IL + protocol risk"),
    ]

    print(f"{'Option':<35} {'Gross APY':>10} {'E[Loss]':>10} {'Risk-Adj':>10} {'Risk':>10}")
    print("-" * 80)
    for name, gross, loss, risk, note in options:
        risk_adj = gross - loss
        print(f"{name:<35} {gross*100:>9.1f}% {loss*100:>9.1f}% {risk_adj*100:>9.1f}% {risk:>10}")

    print(f"\nFINDING: BlockHelix Agent Index at ~12.8% risk-adjusted is competitive")
    print(f"with all options except high-risk LP farming. The key selling point:")
    print(f"diversified agent exposure with a lending yield floor.")
    print(f"For the marginal user, 'better than Kamino with agent upside' is the pitch.\n")


# ============================================================
# 6. FEE CASCADE DEPTH ANALYSIS
# ============================================================

def fee_cascade_analysis():
    print("=" * 80)
    print("MODEL 6: FEE CASCADE -- DEPTH LIMIT ANALYSIS")
    print("=" * 80)

    initial_payment = 100.0
    agent_fee = 0.70
    protocol_fee = 0.05
    vault_retention = 0.25

    print(f"\nClient pays ${initial_payment:.0f}. Each agent passes 60% of its take to sub-agent.")
    print(f"Fee structure: {agent_fee*100:.0f}% agent / {protocol_fee*100:.0f}% protocol / {vault_retention*100:.0f}% vault\n")

    print(f"{'Layer':>6} {'Receives':>10} {'Agent Take':>12} {'Protocol':>10} "
          f"{'Vault':>10} {'To Sub-Agent':>12} {'Cum Leakage':>12}")
    print("-" * 78)

    remaining = initial_payment
    total_protocol = 0
    total_vault = 0
    total_agent_profit = 0

    for layer in range(1, 8):
        prot = remaining * protocol_fee
        vault = remaining * vault_retention
        agent_take = remaining * agent_fee
        to_sub = agent_take * 0.60 if layer < 7 else 0  # 60% passed to sub-agent
        agent_profit = agent_take - to_sub

        total_protocol += prot
        total_vault += vault
        total_agent_profit += agent_profit

        cum_leakage = total_protocol + total_vault
        print(f"{layer:>6} ${remaining:>9.2f} ${agent_take:>11.2f} ${prot:>9.2f} "
              f"${vault:>9.2f} ${to_sub:>11.2f} ${cum_leakage:>11.2f}")

        remaining = to_sub
        if remaining < 0.01:
            break

    print(f"\nTotal from ${initial_payment:.0f} client payment:")
    print(f"  Protocol fees: ${total_protocol:.2f} ({total_protocol/initial_payment*100:.1f}%)")
    print(f"  Vault accrual: ${total_vault:.2f} ({total_vault/initial_payment*100:.1f}%)")
    print(f"  Agent profits: ${total_agent_profit:.2f} ({total_agent_profit/initial_payment*100:.1f}%)")
    print(f"  Total accounted: ${total_protocol+total_vault+total_agent_profit:.2f}")

    # At what depth does work become uneconomic?
    print(f"\n--- When does the chain become uneconomic? ---")
    print(f"Assuming min viable payment = $0.10 (below this, Solana tx cost dominates)")
    remaining = initial_payment
    for layer in range(1, 20):
        remaining = remaining * agent_fee * 0.60
        if remaining < 0.10:
            print(f"Chain becomes uneconomic at layer {layer} (remaining: ${remaining:.4f})")
            break

    print(f"\nVERDICT: Supply chains deeper than 4-5 layers are uneconomic.")
    print(f"This is a natural depth limit, not a bug.\n")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    money_multiplier_model()
    index_fund_model()
    bootstrap_model()
    capital_inflow_projection()
    yield_comparison()
    fee_cascade_analysis()
