"""
Bonding Curve + Revenue Floor Simulation

Models three approaches to combining bonding curves with revenue backing:
  Option A: Separate revenue pool (floor paid from segregated reserve)
  Option B: Revenue shifts the curve up (adds to virtual USDC reserve)
  Option C: Revenue buys and burns (existing spec, baseline comparison)

For each: tracks price, floor, reserve solvency, and buyer/seller outcomes.
"""

import math
from dataclasses import dataclass, field
from typing import List, Tuple


# ============================================================
# OPTION A: SEPARATE REVENUE POOL
# ============================================================

@dataclass
class BondingCurveFloorA:
    """
    Two pools:
      1. Curve reserve: backs the speculative component (constant product)
      2. Revenue pool: backs the floor (monotonically increasing per-share)

    effective_price = curve_price(supply) + revenue_floor_per_share

    On buy: buyer pays effective_price, curve reserve gets curve portion,
            revenue pool is unchanged
    On sell: seller gets curve_price(new_supply) + revenue_floor_per_share
             curve reserve pays curve portion, revenue pool pays floor portion
    On revenue: Y% goes to revenue pool, divided by outstanding shares
    """
    virtual_token_reserve: float = 1_073_000_000.0
    virtual_usdc_reserve: float = 30_000.0
    real_token_reserve: float = 800_000_000.0
    real_usdc_reserve: float = 0.0  # actual USDC in curve reserve

    revenue_pool: float = 0.0  # USDC backing the floor
    cumulative_revenue_per_share: float = 0.0  # the ratchet

    total_supply: float = 1_000_000_000.0
    tokens_sold: float = 0.0  # tokens currently in circulation (bought on curve)
    operator_tokens: float = 200_000_000.0  # vested to operator

    total_revenue: float = 0.0

    @property
    def k(self) -> float:
        return self.virtual_token_reserve * self.virtual_usdc_reserve

    @property
    def curve_price(self) -> float:
        return self.virtual_usdc_reserve / self.virtual_token_reserve

    @property
    def effective_price(self) -> float:
        return self.curve_price + self.cumulative_revenue_per_share

    @property
    def circulating_supply(self) -> float:
        return self.tokens_sold + self.operator_tokens

    def buy(self, usdc_amount: float) -> dict:
        # How many tokens does the curve give for this USDC?
        # First subtract the floor component we need to set aside
        # Actually: buyer pays effective_price which includes floor
        # But tokens come off the bonding curve at curve_price
        # The floor portion of the payment goes... nowhere? It's already backed.
        #
        # Wait -- this is the tricky part.
        # If effective_price = curve_price + floor, and buyer pays effective_price,
        # then the extra (floor portion) needs to go somewhere.
        #
        # Option: All USDC goes to curve reserve. The floor is backed by the
        # revenue pool which is separately funded by revenue events.
        # Buyer just pays curve_price (the floor is a guarantee, not a surcharge).
        #
        # Actually re-reading the spec: buyer pays on the bonding curve normally.
        # The floor is just a minimum sell price. It doesn't affect buy price.
        # Revenue builds up the floor. When you sell, you get max(curve_sell_price, floor).
        # Or: curve_sell_price + floor.
        #
        # Let's model: buy at curve price, sell at curve_price + floor.
        # Revenue pool must have enough to cover floor * circulating_supply.

        new_virtual_usdc = self.virtual_usdc_reserve + usdc_amount
        new_virtual_token = self.k / new_virtual_usdc
        tokens_out = self.virtual_token_reserve - new_virtual_token

        if tokens_out > self.real_token_reserve:
            tokens_out = self.real_token_reserve

        self.virtual_usdc_reserve = new_virtual_usdc
        self.virtual_token_reserve = new_virtual_token
        self.real_usdc_reserve += usdc_amount
        self.real_token_reserve -= tokens_out
        self.tokens_sold += tokens_out

        return {
            "tokens_out": tokens_out,
            "price_paid": usdc_amount / tokens_out if tokens_out > 0 else 0,
            "curve_price_after": self.curve_price,
            "effective_price_after": self.effective_price,
        }

    def sell(self, token_amount: float) -> dict:
        # Curve component
        new_virtual_token = self.virtual_token_reserve + token_amount
        new_virtual_usdc = self.k / new_virtual_token
        curve_usdc_out = self.virtual_usdc_reserve - new_virtual_usdc

        # Floor component
        floor_usdc_out = token_amount * self.cumulative_revenue_per_share

        total_usdc_out = curve_usdc_out + floor_usdc_out

        # Check solvency
        if curve_usdc_out > self.real_usdc_reserve:
            curve_usdc_out = self.real_usdc_reserve
            total_usdc_out = curve_usdc_out + floor_usdc_out
        if floor_usdc_out > self.revenue_pool:
            floor_usdc_out = self.revenue_pool
            total_usdc_out = curve_usdc_out + floor_usdc_out

        self.virtual_token_reserve = new_virtual_token
        self.virtual_usdc_reserve = new_virtual_usdc
        self.real_usdc_reserve -= curve_usdc_out
        self.revenue_pool -= floor_usdc_out
        self.real_token_reserve += token_amount
        self.tokens_sold -= token_amount

        return {
            "usdc_out": total_usdc_out,
            "curve_component": curve_usdc_out,
            "floor_component": floor_usdc_out,
            "price_received": total_usdc_out / token_amount if token_amount > 0 else 0,
            "curve_price_after": self.curve_price,
            "effective_price_after": self.effective_price,
        }

    def receive_revenue(self, amount: float, operator_bps: int = 6000,
                        floor_bps: int = 3000, protocol_bps: int = 1000) -> dict:
        operator_cut = amount * operator_bps / 10000
        floor_cut = amount * floor_bps / 10000
        protocol_cut = amount * protocol_bps / 10000

        self.total_revenue += amount
        self.revenue_pool += floor_cut

        # Update floor per share (ratchet -- only increases)
        if self.circulating_supply > 0:
            increment = floor_cut / self.circulating_supply
            self.cumulative_revenue_per_share += increment

        return {
            "operator": operator_cut,
            "floor": floor_cut,
            "protocol": protocol_cut,
            "new_floor_per_share": self.cumulative_revenue_per_share,
            "revenue_pool_balance": self.revenue_pool,
        }

    def check_solvency(self) -> dict:
        floor_liability = self.tokens_sold * self.cumulative_revenue_per_share
        floor_backed = self.revenue_pool >= floor_liability - 0.01  # rounding tolerance
        return {
            "floor_liability": floor_liability,
            "revenue_pool": self.revenue_pool,
            "floor_fully_backed": floor_backed,
            "curve_reserve": self.real_usdc_reserve,
        }


# ============================================================
# OPTION B: REVENUE SHIFTS THE CURVE
# ============================================================

@dataclass
class BondingCurveFloorB:
    """
    Revenue goes directly into the bonding curve's virtual USDC reserve.
    This shifts the entire curve upward. No separate floor.
    The "floor" is implicit: the curve price can never go below the
    amount that revenue has added.

    Problem: if someone sells, they pull USDC out of the curve,
    which DOES lower the price below the revenue-added amount.
    So this doesn't actually create a ratchet.

    Unless: we track a minimum_virtual_usdc that can never decrease.
    Revenue adds to it. Sells can only pull the curve down to that minimum.
    """
    virtual_token_reserve: float = 1_073_000_000.0
    virtual_usdc_reserve: float = 30_000.0
    real_token_reserve: float = 800_000_000.0
    real_usdc_reserve: float = 0.0

    revenue_added_to_reserve: float = 0.0  # tracks how much revenue has shifted curve

    total_supply: float = 1_000_000_000.0
    tokens_sold: float = 0.0
    operator_tokens: float = 200_000_000.0
    total_revenue: float = 0.0

    @property
    def k(self) -> float:
        return self.virtual_token_reserve * self.virtual_usdc_reserve

    @property
    def curve_price(self) -> float:
        return self.virtual_usdc_reserve / self.virtual_token_reserve

    def buy(self, usdc_amount: float) -> dict:
        new_virtual_usdc = self.virtual_usdc_reserve + usdc_amount
        new_virtual_token = self.k / new_virtual_usdc
        tokens_out = self.virtual_token_reserve - new_virtual_token

        if tokens_out > self.real_token_reserve:
            tokens_out = self.real_token_reserve

        self.virtual_usdc_reserve = new_virtual_usdc
        self.virtual_token_reserve = new_virtual_token
        self.real_usdc_reserve += usdc_amount
        self.real_token_reserve -= tokens_out
        self.tokens_sold += tokens_out

        # Recalculate k after state change (k changes because we add real USDC)
        # Actually in constant product, k stays constant during trades.
        # It only changes when revenue is added (liquidity injection).

        return {
            "tokens_out": tokens_out,
            "price_paid": usdc_amount / tokens_out if tokens_out > 0 else 0,
            "curve_price_after": self.curve_price,
        }

    def sell(self, token_amount: float) -> dict:
        new_virtual_token = self.virtual_token_reserve + token_amount
        new_virtual_usdc = self.k / new_virtual_token
        usdc_out = self.virtual_usdc_reserve - new_virtual_usdc

        if usdc_out > self.real_usdc_reserve:
            usdc_out = self.real_usdc_reserve

        self.virtual_token_reserve = new_virtual_token
        self.virtual_usdc_reserve = new_virtual_usdc
        self.real_usdc_reserve -= usdc_out
        self.real_token_reserve += token_amount
        self.tokens_sold -= token_amount

        return {
            "usdc_out": usdc_out,
            "price_received": usdc_out / token_amount if token_amount > 0 else 0,
            "curve_price_after": self.curve_price,
        }

    def receive_revenue(self, amount: float, operator_bps: int = 6000,
                        curve_bps: int = 3000, protocol_bps: int = 1000) -> dict:
        operator_cut = amount * operator_bps / 10000
        curve_cut = amount * curve_bps / 10000
        protocol_cut = amount * protocol_bps / 10000

        self.total_revenue += amount

        # Add revenue to BOTH sides of the curve to maintain price
        # but increase k (add liquidity)
        # Actually: adding just USDC shifts price up. That IS the mechanism.
        price_before = self.curve_price
        self.virtual_usdc_reserve += curve_cut
        self.real_usdc_reserve += curve_cut
        self.revenue_added_to_reserve += curve_cut
        # k changes: new_k = virtual_token * new_virtual_usdc
        # This means price goes up but the curve also gets deeper
        price_after = self.curve_price

        return {
            "operator": operator_cut,
            "to_curve": curve_cut,
            "protocol": protocol_cut,
            "price_before": price_before,
            "price_after": price_after,
            "price_increase_pct": (price_after - price_before) / price_before * 100,
        }


# ============================================================
# OPTION C: BUYBACK AND BURN (baseline from existing spec)
# ============================================================

@dataclass
class BondingCurveBuybackBurn:
    """
    Revenue buys tokens on the bonding curve and burns them.
    No floor, no separate pool. Pure supply reduction.
    """
    virtual_token_reserve: float = 1_073_000_000.0
    virtual_usdc_reserve: float = 30_000.0
    real_token_reserve: float = 800_000_000.0
    real_usdc_reserve: float = 0.0

    total_supply: float = 1_000_000_000.0
    tokens_sold: float = 0.0
    tokens_burned: float = 0.0
    operator_tokens: float = 200_000_000.0
    total_revenue: float = 0.0
    total_buyback_usdc: float = 0.0

    @property
    def k(self) -> float:
        return self.virtual_token_reserve * self.virtual_usdc_reserve

    @property
    def curve_price(self) -> float:
        return self.virtual_usdc_reserve / self.virtual_token_reserve

    @property
    def circulating_supply(self) -> float:
        return self.tokens_sold + self.operator_tokens - self.tokens_burned

    def buy(self, usdc_amount: float) -> dict:
        new_virtual_usdc = self.virtual_usdc_reserve + usdc_amount
        new_virtual_token = self.k / new_virtual_usdc
        tokens_out = self.virtual_token_reserve - new_virtual_token

        if tokens_out > self.real_token_reserve:
            tokens_out = self.real_token_reserve

        self.virtual_usdc_reserve = new_virtual_usdc
        self.virtual_token_reserve = new_virtual_token
        self.real_usdc_reserve += usdc_amount
        self.real_token_reserve -= tokens_out
        self.tokens_sold += tokens_out

        return {
            "tokens_out": tokens_out,
            "price_paid": usdc_amount / tokens_out if tokens_out > 0 else 0,
            "curve_price_after": self.curve_price,
        }

    def sell(self, token_amount: float) -> dict:
        new_virtual_token = self.virtual_token_reserve + token_amount
        new_virtual_usdc = self.k / new_virtual_token
        usdc_out = self.virtual_usdc_reserve - new_virtual_usdc

        if usdc_out > self.real_usdc_reserve:
            usdc_out = self.real_usdc_reserve

        self.virtual_token_reserve = new_virtual_token
        self.virtual_usdc_reserve = new_virtual_usdc
        self.real_usdc_reserve -= usdc_out
        self.real_token_reserve += token_amount
        self.tokens_sold -= token_amount

        return {
            "usdc_out": usdc_out,
            "price_received": usdc_out / token_amount if token_amount > 0 else 0,
            "curve_price_after": self.curve_price,
        }

    def execute_buyback(self, usdc_amount: float) -> dict:
        """Buy tokens on the curve and burn them."""
        price_before = self.curve_price

        new_virtual_usdc = self.virtual_usdc_reserve + usdc_amount
        new_virtual_token = self.k / new_virtual_usdc
        tokens_bought = self.virtual_token_reserve - new_virtual_token

        self.virtual_usdc_reserve = new_virtual_usdc
        self.virtual_token_reserve = new_virtual_token
        self.real_usdc_reserve += usdc_amount
        # Tokens are bought then burned -- they don't go to real_token_reserve
        # They come from the virtual reserve (buying pushes virtual_token down)
        # Then we burn them, which means they never re-enter circulation
        self.tokens_burned += tokens_bought
        self.total_buyback_usdc += usdc_amount

        return {
            "tokens_bought": tokens_bought,
            "tokens_burned_total": self.tokens_burned,
            "price_before": price_before,
            "price_after": self.curve_price,
            "circulating_supply": self.circulating_supply,
        }

    def receive_revenue(self, amount: float, operator_bps: int = 6000,
                        buyback_bps: int = 3000, protocol_bps: int = 1000) -> dict:
        operator_cut = amount * operator_bps / 10000
        buyback_cut = amount * buyback_bps / 10000
        protocol_cut = amount * protocol_bps / 10000

        self.total_revenue += amount

        # Execute buyback immediately
        bb_result = self.execute_buyback(buyback_cut)

        return {
            "operator": operator_cut,
            "buyback": buyback_cut,
            "protocol": protocol_cut,
            **bb_result,
        }


# ============================================================
# SIMULATIONS
# ============================================================

def format_price(p, width=12):
    if p < 0.001:
        return f"${p:.8f}".rjust(width)
    elif p < 1:
        return f"${p:.6f}".rjust(width)
    else:
        return f"${p:.4f}".rjust(width)

def sim_option_a():
    """6-month simulation: Option A (separate revenue pool)."""
    print("=" * 90)
    print("OPTION A: SEPARATE REVENUE POOL (bonding curve + revenue floor ratchet)")
    print("=" * 90)

    c = BondingCurveFloorA()

    # Month 0: Early buyers
    print("\n--- MONTH 0: Initial buyers ---")
    buys = [
        ("Alice", 500),
        ("Bob", 1000),
        ("Charlie", 2000),
    ]
    buyer_tokens = {}
    for name, amount in buys:
        r = c.buy(amount)
        buyer_tokens[name] = r["tokens_out"]
        print(f"  {name} buys ${amount}: gets {r['tokens_out']:,.0f} tokens @ {format_price(r['price_paid'])}")

    print(f"  Curve price: {format_price(c.curve_price)}")
    print(f"  Floor/share: {format_price(c.cumulative_revenue_per_share)}")
    print(f"  Effective:   {format_price(c.effective_price)}")
    print(f"  Circulating: {c.tokens_sold:,.0f} + {c.operator_tokens:,.0f} operator")

    # Months 1-6: Revenue events
    monthly_revenues = [500, 800, 1200, 1000, 600, 1500]
    monthly_data = []

    for month, rev in enumerate(monthly_revenues, 1):
        r = c.receive_revenue(rev)
        sol = c.check_solvency()

        monthly_data.append({
            "month": month,
            "revenue": rev,
            "curve_price": c.curve_price,
            "floor": c.cumulative_revenue_per_share,
            "effective": c.effective_price,
            "revenue_pool": c.revenue_pool,
            "floor_backed": sol["floor_fully_backed"],
        })

        print(f"\n--- MONTH {month}: Revenue ${rev} ---")
        print(f"  Floor cut to pool: ${r['floor']:.2f}")
        print(f"  Curve price: {format_price(c.curve_price)}")
        print(f"  Floor/share: {format_price(c.cumulative_revenue_per_share)}")
        print(f"  Effective:   {format_price(c.effective_price)}")
        print(f"  Revenue pool: ${c.revenue_pool:.2f}")
        print(f"  Floor backed: {sol['floor_fully_backed']}")

    # Now: what if 50% of holders sell?
    print(f"\n--- STRESS TEST: 50% of holders sell ---")
    sell_amount = c.tokens_sold * 0.5
    r = c.sell(sell_amount)
    sol = c.check_solvency()
    print(f"  Selling {sell_amount:,.0f} tokens")
    print(f"  USDC out: ${r['usdc_out']:.2f}")
    print(f"    Curve component: ${r['curve_component']:.2f}")
    print(f"    Floor component: ${r['floor_component']:.2f}")
    print(f"  Price received: {format_price(r['price_received'])}")
    print(f"  Curve price after: {format_price(c.curve_price)}")
    print(f"  Floor (unchanged): {format_price(c.cumulative_revenue_per_share)}")
    print(f"  Revenue pool after: ${c.revenue_pool:.2f}")
    print(f"  Floor backed: {sol['floor_fully_backed']}")
    print(f"  Floor liability: ${sol['floor_liability']:.2f}")

    # Key question: is the revenue pool still solvent?
    print(f"\n--- SOLVENCY CHECK ---")
    print(f"  Floor liability (remaining tokens * floor): ${sol['floor_liability']:.2f}")
    print(f"  Revenue pool balance: ${sol['revenue_pool']:.2f}")
    print(f"  Shortfall: ${max(0, sol['floor_liability'] - sol['revenue_pool']):.2f}")

    # Calculate buyer returns
    print(f"\n--- BUYER RETURNS ---")
    for name, tokens in buyer_tokens.items():
        # Simulate selling all tokens
        # Use current effective price as approximation (actual would move curve)
        value = tokens * c.effective_price
        cost = {"Alice": 500, "Bob": 1000, "Charlie": 2000}[name]
        roi = (value - cost) / cost * 100
        # Guaranteed minimum (floor only)
        floor_value = tokens * c.cumulative_revenue_per_share
        print(f"  {name}: paid ${cost}, holds {tokens:,.0f} tokens")
        print(f"    Market value: ~${value:.2f} (ROI: {roi:+.1f}%)")
        print(f"    Floor value:  ~${floor_value:.2f} (guaranteed minimum)")

    return monthly_data


def sim_option_b():
    """6-month simulation: Option B (revenue shifts curve)."""
    print("\n" + "=" * 90)
    print("OPTION B: REVENUE SHIFTS CURVE (revenue adds to virtual USDC reserve)")
    print("=" * 90)

    c = BondingCurveFloorB()

    print("\n--- MONTH 0: Initial buyers ---")
    buys = [("Alice", 500), ("Bob", 1000), ("Charlie", 2000)]
    buyer_tokens = {}
    for name, amount in buys:
        r = c.buy(amount)
        buyer_tokens[name] = r["tokens_out"]
        print(f"  {name} buys ${amount}: gets {r['tokens_out']:,.0f} tokens @ {format_price(r['price_paid'])}")

    print(f"  Curve price: {format_price(c.curve_price)}")

    monthly_revenues = [500, 800, 1200, 1000, 600, 1500]

    for month, rev in enumerate(monthly_revenues, 1):
        r = c.receive_revenue(rev)
        print(f"\n--- MONTH {month}: Revenue ${rev} ---")
        print(f"  To curve: ${r['to_curve']:.2f}")
        print(f"  Price: {format_price(r['price_before'])} -> {format_price(r['price_after'])} ({r['price_increase_pct']:+.3f}%)")

    # Sell stress test
    print(f"\n--- STRESS TEST: 50% sell ---")
    sell_amount = c.tokens_sold * 0.5
    r = c.sell(sell_amount)
    print(f"  Selling {sell_amount:,.0f} tokens -> ${r['usdc_out']:.2f}")
    print(f"  Price after: {format_price(r['curve_price_after'])}")
    print(f"  NOTE: Price dropped BELOW pre-revenue level. No floor protection!")

    # The problem: selling undoes the revenue effect
    print(f"\n--- PROBLEM: No ratchet. Sells erase revenue gains. ---")
    print(f"  Revenue added ${c.revenue_added_to_reserve:.2f} to curve")
    print(f"  But selling pulled USDC back out")
    print(f"  This is just a regular bonding curve with extra liquidity")


def sim_option_c():
    """6-month simulation: Option C (buyback and burn)."""
    print("\n" + "=" * 90)
    print("OPTION C: BUYBACK AND BURN (revenue buys tokens, burns them)")
    print("=" * 90)

    c = BondingCurveBuybackBurn()

    print("\n--- MONTH 0: Initial buyers ---")
    buys = [("Alice", 500), ("Bob", 1000), ("Charlie", 2000)]
    buyer_tokens = {}
    for name, amount in buys:
        r = c.buy(amount)
        buyer_tokens[name] = r["tokens_out"]
        print(f"  {name} buys ${amount}: gets {r['tokens_out']:,.0f} tokens @ {format_price(r['price_paid'])}")

    print(f"  Curve price: {format_price(c.curve_price)}")

    monthly_revenues = [500, 800, 1200, 1000, 600, 1500]

    for month, rev in enumerate(monthly_revenues, 1):
        r = c.receive_revenue(rev)
        print(f"\n--- MONTH {month}: Revenue ${rev} ---")
        print(f"  Buyback: ${r['buyback']:.2f} -> burned {r['tokens_bought']:,.0f} tokens")
        print(f"  Price: {format_price(r['price_before'])} -> {format_price(r['price_after'])}")
        print(f"  Total burned: {r['tokens_burned_total']:,.0f}")
        print(f"  Circulating: {r['circulating_supply']:,.0f}")

    # Sell stress test
    print(f"\n--- STRESS TEST: 50% sell ---")
    sell_amount = c.tokens_sold * 0.5
    r = c.sell(sell_amount)
    print(f"  Selling {sell_amount:,.0f} tokens -> ${r['usdc_out']:.2f}")
    print(f"  Price after: {format_price(r['curve_price_after'])}")
    print(f"  NOTE: Price drops on sells. No floor. But burned tokens are gone forever.")
    print(f"  The 'floor' effect is that supply is permanently reduced.")


def sim_floor_solvency_deep_dive():
    """
    Deep dive on Option A solvency: what happens when ALL holders sell?
    The revenue pool must cover floor * tokens_sold at all times.
    But when people sell, both tokens_sold AND revenue_pool decrease.
    Does it stay solvent?
    """
    print("\n" + "=" * 90)
    print("DEEP DIVE: OPTION A SOLVENCY UNDER MASS REDEMPTION")
    print("=" * 90)

    c = BondingCurveFloorA()

    # Build up position
    c.buy(5000)
    tokens_before_revenue = c.tokens_sold

    # Accumulate revenue
    for _ in range(6):
        c.receive_revenue(1000)

    floor = c.cumulative_revenue_per_share
    pool = c.revenue_pool
    tokens = c.tokens_sold

    print(f"\n  After 6 months of $1000/mo revenue:")
    print(f"  Tokens in circulation: {tokens:,.0f}")
    print(f"  Floor per share: {format_price(floor)}")
    print(f"  Revenue pool: ${pool:.2f}")
    print(f"  Floor liability: ${tokens * floor:.2f}")
    print(f"  Surplus/Deficit: ${pool - tokens * floor:.2f}")

    # Now sell in tranches
    print(f"\n  Selling in 10% tranches:")
    for i in range(10):
        sell_pct = 0.10
        sell_tokens = c.tokens_sold * sell_pct
        if sell_tokens < 1:
            break
        r = c.sell(sell_tokens)
        sol = c.check_solvency()
        print(f"  Tranche {i+1}: sell {sell_tokens:,.0f} tokens -> ${r['usdc_out']:.2f} "
              f"(curve: ${r['curve_component']:.2f}, floor: ${r['floor_component']:.2f}) | "
              f"Pool: ${sol['revenue_pool']:.2f}, Liability: ${sol['floor_liability']:.2f}, "
              f"Backed: {sol['floor_fully_backed']}")

    print(f"\n  KEY INSIGHT: Each sell reduces BOTH the pool and the liability.")
    print(f"  floor_payout = tokens_sold * floor_per_share")
    print(f"  Pool decreases by exactly that amount.")
    print(f"  Liability decreases because tokens_sold decreases.")
    print(f"  The system stays solvent IF the pool was initially funded correctly.")
    print(f"  Initial funding = sum(revenue_cut) which exactly equals sum(floor_increment * supply_at_time)")

    # Check: does the pool == liability identity hold?
    # When revenue comes in: pool += cut, floor += cut/supply
    # liability = supply * floor = supply * sum(cut_i / supply_i)
    # If supply is constant: liability = supply * sum(cut_i) / supply = sum(cut_i) = pool. Perfect!
    # If supply changes between revenue events: supply * sum(cut_i / supply_i) != sum(cut_i)
    # This is the problem!

    print(f"\n  WARNING: If supply changes between revenue events, the identity breaks!")
    print(f"  Example: revenue arrives when 100 tokens exist -> floor += $1/token, pool += $100")
    print(f"  Then someone buys 100 more tokens. Now 200 tokens exist.")
    print(f"  Floor is still $1/token. Liability = 200 * $1 = $200. Pool = $100. INSOLVENT!")
    print(f"  New buyers inherit the floor without paying for it!")


def sim_floor_with_buy_adjustment():
    """
    Fix for Option A: new buyers must deposit into the revenue pool
    to cover the existing floor for their newly minted tokens.

    effective_buy_price = curve_price + cumulative_revenue_per_share
    The floor portion goes to the revenue pool.
    """
    print("\n" + "=" * 90)
    print("OPTION A-FIX: BUYERS PAY INTO REVENUE POOL FOR FLOOR")
    print("=" * 90)

    class BondingCurveFloorAFixed:
        def __init__(self):
            self.virtual_token_reserve = 1_073_000_000.0
            self.virtual_usdc_reserve = 30_000.0
            self.real_token_reserve = 800_000_000.0
            self.real_usdc_reserve = 0.0
            self.revenue_pool = 0.0
            self.cumulative_revenue_per_share = 0.0
            self.tokens_sold = 0.0
            self.operator_tokens = 200_000_000.0
            self.total_revenue = 0.0

        @property
        def k(self):
            return self.virtual_token_reserve * self.virtual_usdc_reserve

        @property
        def curve_price(self):
            return self.virtual_usdc_reserve / self.virtual_token_reserve

        @property
        def effective_price(self):
            return self.curve_price + self.cumulative_revenue_per_share

        @property
        def circulating(self):
            return self.tokens_sold + self.operator_tokens

        def buy(self, usdc_amount):
            # First figure out how many tokens the curve would give
            # Then check if buyer can also cover the floor for those tokens
            # Iterative: tokens_out depends on curve_usdc, but floor_cost depends on tokens_out

            # Approximate: split usdc_amount into curve and floor portions
            # curve_portion buys tokens, floor_portion = tokens_out * floor
            # usdc_amount = curve_portion + tokens_out * floor
            # tokens_out = f(curve_portion) from constant product
            # This requires solving: usdc_amount = cp + (vtr - k/(vur+cp)) * floor
            # where vtr = virtual_token_reserve, vur = virtual_usdc_reserve

            # Binary search for simplicity
            floor = self.cumulative_revenue_per_share
            lo, hi = 0.0, usdc_amount

            for _ in range(50):
                mid = (lo + hi) / 2
                curve_usdc = mid
                new_vusdc = self.virtual_usdc_reserve + curve_usdc
                new_vtoken = self.k / new_vusdc
                tokens = self.virtual_token_reserve - new_vtoken
                total_cost = curve_usdc + tokens * floor
                if total_cost < usdc_amount:
                    lo = mid
                else:
                    hi = mid

            curve_usdc = (lo + hi) / 2
            floor_usdc = usdc_amount - curve_usdc

            new_vusdc = self.virtual_usdc_reserve + curve_usdc
            new_vtoken = self.k / new_vusdc
            tokens_out = self.virtual_token_reserve - new_vtoken

            self.virtual_usdc_reserve = new_vusdc
            self.virtual_token_reserve = new_vtoken
            self.real_usdc_reserve += curve_usdc
            self.revenue_pool += floor_usdc
            self.real_token_reserve -= tokens_out
            self.tokens_sold += tokens_out

            return {
                "tokens_out": tokens_out,
                "curve_usdc": curve_usdc,
                "floor_usdc": floor_usdc,
                "effective_price": usdc_amount / tokens_out if tokens_out > 0 else 0,
                "curve_price_after": self.curve_price,
            }

        def sell(self, token_amount):
            new_vtoken = self.virtual_token_reserve + token_amount
            new_vusdc = self.k / new_vtoken
            curve_out = self.virtual_usdc_reserve - new_vusdc
            floor_out = token_amount * self.cumulative_revenue_per_share

            if curve_out > self.real_usdc_reserve:
                curve_out = self.real_usdc_reserve
            if floor_out > self.revenue_pool:
                floor_out = self.revenue_pool

            self.virtual_token_reserve = new_vtoken
            self.virtual_usdc_reserve = new_vusdc
            self.real_usdc_reserve -= curve_out
            self.revenue_pool -= floor_out
            self.real_token_reserve += token_amount
            self.tokens_sold -= token_amount

            return {
                "usdc_out": curve_out + floor_out,
                "curve_component": curve_out,
                "floor_component": floor_out,
            }

        def receive_revenue(self, amount, operator_bps=6000, floor_bps=3000, protocol_bps=1000):
            floor_cut = amount * floor_bps / 10000
            self.total_revenue += amount
            self.revenue_pool += floor_cut
            if self.circulating > 0:
                self.cumulative_revenue_per_share += floor_cut / self.circulating
            return {"floor_cut": floor_cut}

        def solvency(self):
            liability = self.tokens_sold * self.cumulative_revenue_per_share
            return {
                "pool": self.revenue_pool,
                "liability": liability,
                "solvent": self.revenue_pool >= liability - 0.01,
            }

    c = BondingCurveFloorAFixed()

    # Phase 1: Initial buys (floor = 0, so no floor payment)
    print("\n--- Phase 1: Initial buys (floor = 0) ---")
    alice = c.buy(500)
    print(f"  Alice: ${500} -> {alice['tokens_out']:,.0f} tokens (floor cost: ${alice['floor_usdc']:.2f})")

    bob = c.buy(1000)
    print(f"  Bob: ${1000} -> {bob['tokens_out']:,.0f} tokens (floor cost: ${bob['floor_usdc']:.2f})")

    sol = c.solvency()
    print(f"  Solvency: pool=${sol['pool']:.2f}, liability=${sol['liability']:.2f}, ok={sol['solvent']}")

    # Phase 2: Revenue builds floor
    print(f"\n--- Phase 2: Revenue ---")
    for month in range(1, 4):
        c.receive_revenue(1000)
        sol = c.solvency()
        print(f"  Month {month}: floor={format_price(c.cumulative_revenue_per_share)}, "
              f"pool=${sol['pool']:.2f}, liability=${sol['liability']:.2f}, solvent={sol['solvent']}")

    # Phase 3: New buyer pays floor premium
    print(f"\n--- Phase 3: New buyer (pays floor premium) ---")
    dave = c.buy(1000)
    print(f"  Dave: ${1000} -> {dave['tokens_out']:,.0f} tokens")
    print(f"    Curve cost: ${dave['curve_usdc']:.2f}")
    print(f"    Floor cost: ${dave['floor_usdc']:.2f} (goes to revenue pool)")
    print(f"    Effective price: {format_price(dave['effective_price'])}")

    sol = c.solvency()
    print(f"  Solvency: pool=${sol['pool']:.2f}, liability=${sol['liability']:.2f}, solvent={sol['solvent']}")

    # Phase 4: Everyone sells
    print(f"\n--- Phase 4: Mass redemption ---")
    total_tokens = c.tokens_sold
    sell_result = c.sell(total_tokens)
    sol = c.solvency()
    print(f"  Sold all {total_tokens:,.0f} tokens -> ${sell_result['usdc_out']:.2f}")
    print(f"    Curve: ${sell_result['curve_component']:.2f}")
    print(f"    Floor: ${sell_result['floor_component']:.2f}")
    print(f"  Remaining pool: ${sol['pool']:.4f}")
    print(f"  Remaining liability: ${sol['liability']:.4f}")
    print(f"  Solvent: {sol['solvent']}")


def sim_comparison_6month():
    """Side-by-side comparison of all three options over 6 months."""
    print("\n" + "=" * 90)
    print("6-MONTH COMPARISON: All Three Options")
    print("=" * 90)

    # Same initial conditions
    initial_buys = [("Alice", 500), ("Bob", 1000), ("Charlie", 2000)]
    monthly_revs = [500, 800, 1200, 1000, 0, 0]  # revenue dies after month 4

    print(f"\nScenario: 3 buyers invest $3,500 total. Agent earns $3,500 over 4 months then dies.")
    print(f"Monthly revenues: {monthly_revs}")
    print(f"Question: what happens to buyers?")

    # Option A
    a = BondingCurveFloorA()
    a_tokens = {}
    for name, amt in initial_buys:
        r = a.buy(amt)
        a_tokens[name] = r["tokens_out"]
    for rev in monthly_revs:
        if rev > 0:
            a.receive_revenue(rev)

    # Option C (buyback-burn)
    c = BondingCurveBuybackBurn()
    c_tokens = {}
    for name, amt in initial_buys:
        r = c.buy(amt)
        c_tokens[name] = r["tokens_out"]
    for rev in monthly_revs:
        if rev > 0:
            c.receive_revenue(rev)

    print(f"\n{'':>10} {'Option A (Floor)':>35} {'Option C (Buyback-Burn)':>35}")
    print(f"{'':>10} {'Curve Price':>12} {'Floor':>12} {'Effective':>12} {'Curve Price':>12} {'Burned':>12} {'':>12}")
    print(f"{'After rev':>10} {format_price(a.curve_price)} {format_price(a.cumulative_revenue_per_share)} {format_price(a.effective_price)} {format_price(c.curve_price)} {c.tokens_burned:>12,.0f}")

    # Now simulate: all holders sell
    print(f"\n--- If all holders sell ---")

    for name in ["Alice", "Bob", "Charlie"]:
        # Option A
        a_temp = BondingCurveFloorA()
        a_temp.__dict__.update({k: v for k, v in a.__dict__.items()})
        r_a = a_temp.sell(a_tokens[name])

        # Option C
        c_temp = BondingCurveBuybackBurn()
        c_temp.__dict__.update({k: v for k, v in c.__dict__.items()})
        r_c = c_temp.sell(c_tokens[name])

        cost = {"Alice": 500, "Bob": 1000, "Charlie": 2000}[name]

        print(f"  {name} (paid ${cost}):")
        print(f"    Option A: ${r_a['usdc_out']:.2f} (curve: ${r_a['curve_component']:.2f} + floor: ${r_a['floor_component']:.2f}) | ROI: {(r_a['usdc_out']/cost - 1)*100:+.1f}%")
        print(f"    Option C: ${r_c['usdc_out']:.2f} | ROI: {(r_c['usdc_out']/cost - 1)*100:+.1f}%")

    # Revenue dies scenario (months 5-6 are $0)
    print(f"\n--- Revenue dies after month 4. What's the floor worth? ---")
    print(f"  Option A floor: {format_price(a.cumulative_revenue_per_share)} per token (PERMANENT)")
    print(f"  Option A revenue pool: ${a.revenue_pool:.2f} (backs the floor)")
    print(f"  Option C: price determined purely by curve. No floor guarantee.")
    print(f"  If all speculators flee, Option A holders get at least the floor.")
    print(f"  Option C holders could get near-zero if panic selling cascades.")


def sim_worst_case_buyer():
    """What's the absolute worst case for a buyer in each model?"""
    print("\n" + "=" * 90)
    print("WORST CASE ANALYSIS: What's the most you can lose?")
    print("=" * 90)

    # Worst case: buy at the top, revenue drops to zero, everyone sells before you
    print("\nScenario: Buy $1000 after hype. Agent earns a little. Then revenue = 0. Panic sell.")

    for label, Model in [("Option A (Floor)", BondingCurveFloorA),
                          ("Option C (Buyback)", BondingCurveBuybackBurn)]:
        m = Model()

        # Hype phase: lots of buying
        for _ in range(10):
            m.buy(500)

        # Some revenue
        if hasattr(m, 'cumulative_revenue_per_share'):
            m.receive_revenue(2000)
        else:
            m.receive_revenue(2000)

        # Our buyer enters
        if label.startswith("Option A"):
            r = m.buy(1000)
            my_tokens = r["tokens_out"]

            # Everyone else panic sells before us
            other_tokens = m.tokens_sold - my_tokens
            m.sell(other_tokens * 0.9)  # 90% of other holders sell

            # We sell last
            r = m.sell(my_tokens)
            print(f"\n  {label}:")
            print(f"    Bought: {my_tokens:,.0f} tokens for $1000")
            print(f"    After panic: sold for ${r['usdc_out']:.2f}")
            print(f"      Curve: ${r['curve_component']:.2f}, Floor: ${r['floor_component']:.2f}")
            print(f"    Loss: ${1000 - r['usdc_out']:.2f} ({(r['usdc_out']/1000 - 1)*100:+.1f}%)")
            print(f"    Floor guarantee protected: ${r['floor_component']:.2f}")
        else:
            r = m.buy(1000)
            my_tokens = r["tokens_out"]

            other_tokens = m.tokens_sold - my_tokens
            m.sell(other_tokens * 0.9)

            r = m.sell(my_tokens)
            print(f"\n  {label}:")
            print(f"    Bought: {my_tokens:,.0f} tokens for $1000")
            print(f"    After panic: sold for ${r['usdc_out']:.2f}")
            print(f"    Loss: ${1000 - r['usdc_out']:.2f} ({(r['usdc_out']/1000 - 1)*100:+.1f}%)")
            print(f"    No floor protection.")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    sim_option_a()
    sim_option_b()
    sim_option_c()
    sim_floor_solvency_deep_dive()
    sim_floor_with_buy_adjustment()
    sim_comparison_6month()
    sim_worst_case_buyer()
