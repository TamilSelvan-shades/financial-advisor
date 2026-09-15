import pandas as pd
from typing import List, Dict, Any, Tuple


def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """Calculates standard monthly EMI."""
    if principal <= 0 or tenure_months <= 0:
        return 0.0
    if annual_rate == 0:
        return principal / tenure_months
    r = (annual_rate / 100) / 12
    emi = principal * r * ((1 + r) ** tenure_months) / (((1 + r) ** tenure_months) - 1)
    return round(emi, 2)


def generate_amortization_schedule(
    principal: float, annual_rate: float, tenure_months: int, extra_monthly: float = 0.0
):
    """
    Generates month-by-month loan schedule comparing standard vs prepayment scenarios.
    Returns a DataFrame and a summary dictionary.
    """
    r = (annual_rate / 100) / 12
    base_emi = calculate_emi(principal, annual_rate, tenure_months)
    
    balance = principal
    schedule = []
    month = 0
    total_interest = 0.0

    while balance > 0 and month < tenure_months * 2:
        month += 1
        interest_payment = balance * r
        # Total payment toward principal + interest
        regular_principal = min(base_emi - interest_payment, balance)
        
        # Apply extra principal prepayment
        actual_extra = min(extra_monthly, balance - regular_principal)
        total_principal_paid = regular_principal + actual_extra
        
        total_interest += interest_payment
        balance = max(0.0, balance - total_principal_paid)
        
        schedule.append({
            "Month": month,
            "Interest Paid": round(interest_payment, 2),
            "Principal Paid": round(total_principal_paid, 2),
            "Remaining Balance": round(balance, 2)
        })

    df_schedule = pd.DataFrame(schedule)
    
    summary = {
        "monthly_emi": base_emi,
        "total_months": month,
        "total_interest": total_interest,
        "total_paid": principal + total_interest
    }
    return df_schedule, summary


def _simulate_strategy(
    loans: List[Dict[str, Any]],
    extra_monthly: float,
    strategy: str = "avalanche",
    max_months: int = 480,
) -> Dict[str, Any]:
    """
    Simulates multi-loan payoff under a given strategy:
    - 'baseline': Minimum EMI on all loans, no extra prepayment.
    - 'snowball': Pay minimum on all; apply extra + rolled-over EMIs to smallest balance loan.
    - 'avalanche': Pay minimum on all; apply extra + rolled-over EMIs to highest interest loan.
    """
    # Initialize loan states
    active_loans = []
    for l in loans:
        p = float(l.get("principal", 0.0) or 0.0)
        r = float(l.get("interest_rate", 0.0) or 0.0)
        n = int(l.get("tenure_months") or (float(l.get("tenure_years", 1.0) or 1.0) * 12))
        name = str(l.get("name") or l.get("bank_name") or "Loan Account")
        if p > 0 and n > 0:
            emi = calculate_emi(p, r, n)
            active_loans.append({
                "id": l.get("id"),
                "name": name,
                "balance": p,
                "rate": r,
                "r_monthly": (r / 100.0) / 12.0,
                "emi": emi,
                "initial_principal": p,
                "cleared_month": None,
            })

    month = 0
    total_interest = 0.0
    payoff_order = []
    monthly_balances = [sum(al["balance"] for al in active_loans)]

    while any(al["balance"] > 0 for al in active_loans) and month < max_months:
        month += 1
        
        # Step 1: Accrue interest and pay regular minimums
        freed_up_emis = 0.0
        for al in active_loans:
            if al["balance"] > 0:
                interest = al["balance"] * al["r_monthly"]
                total_interest += interest
                min_principal = min(al["balance"], max(0.0, al["emi"] - interest))
                al["balance"] -= min_principal
                if al["balance"] <= 0.01:
                    al["balance"] = 0.0
                    if al["cleared_month"] is None:
                        al["cleared_month"] = month
                        payoff_order.append({"name": al["name"], "month": month, "principal": al["initial_principal"]})
            else:
                # This loan was previously paid off; its base EMI is freed to accelerate other loans
                if strategy != "baseline":
                    freed_up_emis += al["emi"]

        # Step 2: Apply extra prepayment + rolled-over EMIs
        if strategy != "baseline":
            extra_available = extra_monthly + freed_up_emis
            
            while extra_available > 0.01:
                # Filter remaining active loans
                remaining = [al for al in active_loans if al["balance"] > 0]
                if not remaining:
                    break

                if strategy == "snowball":
                    # Lowest remaining balance first
                    target = min(remaining, key=lambda x: x["balance"])
                else:  # avalanche
                    # Highest interest rate first (tiebreak by lower balance)
                    target = max(remaining, key=lambda x: (x["rate"], -x["balance"]))

                payment = min(extra_available, target["balance"])
                target["balance"] -= payment
                extra_available -= payment

                if target["balance"] <= 0.01:
                    target["balance"] = 0.0
                    if target["cleared_month"] is None:
                        target["cleared_month"] = month
                        payoff_order.append({"name": target["name"], "month": month, "principal": target["initial_principal"]})

        monthly_balances.append(round(sum(al["balance"] for al in active_loans), 2))

    total_principal = sum(l["initial_principal"] for l in active_loans)
    return {
        "strategy": strategy,
        "total_months": month,
        "total_interest": round(total_interest, 2),
        "total_paid": round(total_principal + total_interest, 2),
        "payoff_order": payoff_order,
        "monthly_balances": monthly_balances,
    }


def simulate_debt_payoff_matrix(
    loans: List[Dict[str, Any]],
    extra_monthly: float = 0.0,
) -> Dict[str, Any]:
    """
    Runs multi-loan optimization comparing:
    1. Baseline (Standard Minimum EMI only)
    2. Debt Snowball (Smallest Balance First)
    3. Debt Avalanche (Highest Interest Rate First)
    Returns comparison metrics, payoff timelines, and strategic recommendations.
    """
    if not loans:
        return {
            "total_debt": 0.0,
            "loan_count": 0,
            "baseline": {"total_months": 0, "total_interest": 0.0, "total_paid": 0.0, "payoff_order": []},
            "snowball": {"total_months": 0, "total_interest": 0.0, "total_paid": 0.0, "total_saved": 0.0, "months_saved": 0, "payoff_order": []},
            "avalanche": {"total_months": 0, "total_interest": 0.0, "total_paid": 0.0, "total_saved": 0.0, "months_saved": 0, "payoff_order": []},
            "timeline": [],
            "recommendation": "No active loans found to simulate.",
        }

    total_debt = sum(float(l.get("principal", 0.0) or 0.0) for l in loans)

    baseline_res = _simulate_strategy(loans, extra_monthly=0.0, strategy="baseline")
    snowball_res = _simulate_strategy(loans, extra_monthly=extra_monthly, strategy="snowball")
    avalanche_res = _simulate_strategy(loans, extra_monthly=extra_monthly, strategy="avalanche")

    # Savings calculations
    base_interest = baseline_res["total_interest"]
    base_months = baseline_res["total_months"]

    snowball_saved = max(0.0, round(base_interest - snowball_res["total_interest"], 2))
    snowball_months_saved = max(0, base_months - snowball_res["total_months"])

    avalanche_saved = max(0.0, round(base_interest - avalanche_res["total_interest"], 2))
    avalanche_months_saved = max(0, base_months - avalanche_res["total_months"])

    # Build timeline for visualization
    max_len = max(
        len(baseline_res["monthly_balances"]),
        len(snowball_res["monthly_balances"]),
        len(avalanche_res["monthly_balances"])
    )
    
    # Sub-sample timeline points to keep chart lightweight
    step = 1 if max_len <= 36 else (2 if max_len <= 72 else 3)
    timeline = []
    for m in range(0, max_len, step):
        b_bal = baseline_res["monthly_balances"][m] if m < len(baseline_res["monthly_balances"]) else 0.0
        s_bal = snowball_res["monthly_balances"][m] if m < len(snowball_res["monthly_balances"]) else 0.0
        a_bal = avalanche_res["monthly_balances"][m] if m < len(avalanche_res["monthly_balances"]) else 0.0
        timeline.append({
            "month": m,
            "label": f"M{m}",
            "baseline_balance": b_bal,
            "snowball_balance": s_bal,
            "avalanche_balance": a_bal,
        })

    # Strategy comparison recommendation
    diff_savings = round(avalanche_saved - snowball_saved, 2)
    diff_months = snowball_res["total_months"] - avalanche_res["total_months"]

    if diff_savings > 1000:
        recommendation = (
            f"The Debt Avalanche strategy mathematically saves ₹{diff_savings:,.0f} more in interest than Snowball "
            f"and makes you debt-free {avalanche_months_saved} months earlier than baseline. "
            f"If you prefer fast psychological wins, Snowball clears your first loan ({snowball_res['payoff_order'][0]['name'] if snowball_res['payoff_order'] else 'first loan'}) in month {snowball_res['payoff_order'][0]['month'] if snowball_res['payoff_order'] else 1}."
        )
    else:
        recommendation = (
            f"Both strategies perform similarly, saving approximately ₹{avalanche_saved:,.0f} in interest. "
            f"Debt Snowball is recommended here for psychological momentum, knocking out smaller balances rapidly."
        )

    return {
        "total_debt": round(total_debt, 2),
        "loan_count": len(loans),
        "extra_monthly": extra_monthly,
        "baseline": {
            "total_months": baseline_res["total_months"],
            "total_interest": baseline_res["total_interest"],
            "total_paid": baseline_res["total_paid"],
            "payoff_order": baseline_res["payoff_order"],
        },
        "snowball": {
            "total_months": snowball_res["total_months"],
            "total_interest": snowball_res["total_interest"],
            "total_paid": snowball_res["total_paid"],
            "total_saved": snowball_saved,
            "months_saved": snowball_months_saved,
            "payoff_order": snowball_res["payoff_order"],
        },
        "avalanche": {
            "total_months": avalanche_res["total_months"],
            "total_interest": avalanche_res["total_interest"],
            "total_paid": avalanche_res["total_paid"],
            "total_saved": avalanche_saved,
            "months_saved": avalanche_months_saved,
            "payoff_order": avalanche_res["payoff_order"],
        },
        "timeline": timeline,
        "recommendation": recommendation,
    }