"""
Decision Intelligence Simulation Engine
Deterministic multi-year projection engine for financial What-If scenarios:
- Financed Asset / Car Loan
- Career Sabbatical & Income Pause
- SIP Compounding & Wealth Accelerator
"""

from typing import Dict, Any, List
import math


def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """Calculates monthly EMI using standard amortization formula."""
    if principal <= 0 or tenure_months <= 0:
        return 0.0
    if annual_rate <= 0:
        return principal / tenure_months
    r = (annual_rate / 100.0) / 12.0
    emi = principal * r * ((1.0 + r) ** tenure_months) / (((1.0 + r) ** tenure_months) - 1.0)
    return round(emi, 2)


def simulate_car_loan(
    current_liquid_balance: float,
    current_monthly_income: float,
    current_monthly_expense: float,
    days_left_in_cycle: int,
    loan_amount: float,
    down_payment: float,
    annual_interest_rate: float,
    tenure_months: int,
    projection_months: int = 60,
) -> Dict[str, Any]:
    """
    Simulates buying a vehicle or major asset with down payment + loan.
    Projects impact on cash reserves, monthly surplus, daily safe-to-spend, and 5-year balance.
    """
    loan_principal = max(0.0, loan_amount - down_payment)
    monthly_emi = calculate_emi(loan_principal, annual_interest_rate, tenure_months)
    
    # Safe-to-spend impact
    cycle_days = max(1, days_left_in_cycle)
    new_uncommitted = max(0.0, current_liquid_balance - down_payment - monthly_emi)
    new_safe_to_spend_daily = round(new_uncommitted / cycle_days, 2)
    
    # Monthly cash surplus
    baseline_surplus = round(current_monthly_income - current_monthly_expense, 2)
    scenario_surplus = round(baseline_surplus - monthly_emi, 2)
    
    # Feasibility Score (0 to 100)
    # Penalize if down payment exhausts > 50% liquid balance or EMI > 30% monthly income
    post_dp_balance = max(0.0, current_liquid_balance - down_payment)
    months_cushion = post_dp_balance / max(current_monthly_expense, 1000.0)
    dti_ratio = (monthly_emi / max(current_monthly_income, 1.0)) * 100.0

    score = 100
    if months_cushion < 3.0:
        score -= int((3.0 - months_cushion) * 20)
    if dti_ratio > 25.0:
        score -= int((dti_ratio - 25.0) * 1.5)
    if scenario_surplus < 0:
        score -= 30
    feasibility_score = max(5, min(100, score))

    if feasibility_score >= 75:
        risk_level = "Low"
    elif feasibility_score >= 50:
        risk_level = "Moderate"
    else:
        risk_level = "High"

    # Timeline projection
    timeline: List[Dict[str, Any]] = []
    base_bal = current_liquid_balance
    scen_bal = max(0.0, current_liquid_balance - down_payment)
    active_loan_balance = loan_principal
    r_monthly = (annual_interest_rate / 100.0) / 12.0

    for m in range(1, projection_months + 1):
        base_bal = max(0.0, base_bal + baseline_surplus)
        
        # Loan amortization step
        if active_loan_balance > 0:
            interest_charge = active_loan_balance * r_monthly
            principal_paid = min(active_loan_balance, monthly_emi - interest_charge)
            active_loan_balance = max(0.0, active_loan_balance - principal_paid)
            scen_bal = max(0.0, scen_bal + scenario_surplus)
        else:
            # Loan paid off! Surplus rebounds to baseline
            scen_bal = max(0.0, scen_bal + baseline_surplus)

        # Record every 2 months or key milestones to keep payload lean
        if m == 1 or m % 3 == 0 or m == tenure_months or m == projection_months:
            timeline.append({
                "month": m,
                "label": f"M{m}",
                "baseline_balance": round(base_bal, 2),
                "scenario_balance": round(scen_bal, 2),
                "remaining_loan": round(active_loan_balance, 2),
            })

    total_interest_paid = round((monthly_emi * tenure_months) - loan_principal, 2)
    total_cost = round(down_payment + (monthly_emi * tenure_months), 2)

    return {
        "scenario_type": "car_loan",
        "loan_principal": loan_principal,
        "down_payment": down_payment,
        "monthly_emi": monthly_emi,
        "total_interest": max(0.0, total_interest_paid),
        "total_cost": total_cost,
        "new_safe_to_spend_daily": new_safe_to_spend_daily,
        "baseline_monthly_surplus": baseline_surplus,
        "scenario_monthly_surplus": scenario_surplus,
        "feasibility_score": feasibility_score,
        "risk_level": risk_level,
        "timeline": timeline,
        "summary": (
            f"Financing ₹{loan_principal:,.0f} over {tenure_months} months at {annual_interest_rate}% requires a monthly EMI of ₹{monthly_emi:,.0f}. "
            f"Total interest payable is ₹{total_interest_paid:,.0f}. Your post-purchase emergency cushion remains at {months_cushion:.1f} months of expenses."
        ),
    }


def simulate_sabbatical(
    current_liquid_balance: float,
    current_monthly_income: float,
    current_monthly_expense: float,
    current_fixed_bills: float,
    current_emis: float,
    sabbatical_months: int,
    income_replacement_pct: float = 0.0,
    discretionary_cut_pct: float = 0.20,
    projection_months: int = 24,
    current_investments: float = 0.0,
) -> Dict[str, Any]:
    """
    Simulates a career break / sabbatical.
    Models temporary income loss, elective spending cuts, and runway depletion.
    """
    discretionary_expense = max(0.0, current_monthly_expense - current_fixed_bills - current_emis)
    reduced_discretionary = discretionary_expense * (1.0 - max(0.0, min(0.8, discretionary_cut_pct)))
    
    # Monthly expense during sabbatical
    sabbatical_monthly_expense = current_fixed_bills + current_emis + reduced_discretionary
    sabbatical_monthly_income = current_monthly_income * (income_replacement_pct / 100.0)
    monthly_burn = max(0.0, sabbatical_monthly_expense - sabbatical_monthly_income)

    # Runway calculation
    runway_months = (current_liquid_balance / monthly_burn) if monthly_burn > 0 else 999.0
    
    timeline: List[Dict[str, Any]] = []
    base_bal = current_liquid_balance
    scen_bal = current_liquid_balance
    baseline_surplus = current_monthly_income - current_monthly_expense
    
    depletion_month = None
    min_cushion = current_liquid_balance

    for m in range(1, projection_months + 1):
        base_bal = max(0.0, base_bal + baseline_surplus)

        if m <= sabbatical_months:
            scen_bal -= monthly_burn
            if scen_bal < 0 and depletion_month is None:
                depletion_month = m
            min_cushion = min(min_cushion, scen_bal)
        else:
            # Post sabbatical recovery
            scen_bal += baseline_surplus

        if m == 1 or m % 2 == 0 or m == sabbatical_months or m == projection_months:
            timeline.append({
                "month": m,
                "label": f"M{m}",
                "baseline_balance": round(max(0.0, base_bal), 2),
                "scenario_balance": round(scen_bal, 2),
                "is_sabbatical": (m <= sabbatical_months),
            })

    # Feasibility Score
    if depletion_month is not None:
        feasibility_score = max(10, int((runway_months / sabbatical_months) * 50))
        risk_level = "High"
    elif min_cushion < (current_monthly_expense * 2):
        feasibility_score = 65
        risk_level = "Moderate"
    else:
        feasibility_score = 90
        risk_level = "Low"

    return {
        "scenario_type": "sabbatical",
        "sabbatical_months": sabbatical_months,
        "monthly_burn": round(monthly_burn, 2),
        "runway_months": round(runway_months, 1),
        "depletion_month": depletion_month,
        "minimum_liquid_cushion": round(min_cushion, 2),
        "feasibility_score": feasibility_score,
        "risk_level": risk_level,
        "timeline": timeline,
        "summary": (
            f"A {sabbatical_months}-month sabbatical burns ₹{monthly_burn:,.0f}/month with a {discretionary_cut_pct*100:.0f}% discretionary cut. "
            f"Your liquid balance {'lasts ' + str(round(runway_months, 1)) + ' months' if runway_months < 99 else 'easily supports this duration'}. "
            f"{'⚠️ Funds deplete in month ' + str(depletion_month) if depletion_month else '✓ Minimum reserve reached is ₹' + f'{min_cushion:,.0f}'}."
        ),
    }


def simulate_sip_boost(
    current_investments: float,
    current_monthly_income: float,
    current_monthly_expense: float,
    additional_sip: float,
    expected_cagr_pct: float = 12.0,
    discretionary_cut: float = 0.0,
    horizon_years: int = 10,
) -> Dict[str, Any]:
    """
    Simulates boosting mutual fund / equity SIP contributions with discretionary expense cuts.
    Projects future wealth compounding curve and milestone accelerations.
    """
    total_new_monthly_investment = additional_sip + discretionary_cut
    r_monthly = (expected_cagr_pct / 100.0) / 12.0
    total_months = horizon_years * 12

    base_inv = current_investments
    scen_inv = current_investments

    timeline: List[Dict[str, Any]] = []

    milestone_targets = [2500000.0, 5000000.0, 10000000.0]  # 25L, 50L, 1Cr
    milestones: Dict[str, Dict[str, Any]] = {}

    for target in milestone_targets:
        key = f"₹{int(target/100000)}L" if target < 10000000 else "₹1Cr"
        milestones[key] = {"target": target, "baseline_month": None, "scenario_month": None}

    for m in range(1, total_months + 1):
        # Baseline growth (investments grow at CAGR without new booster)
        base_inv = (base_inv * (1.0 + r_monthly))
        # Scenario growth (investments grow at CAGR + new booster added monthly)
        scen_inv = (scen_inv * (1.0 + r_monthly)) + total_new_monthly_investment

        # Check milestones
        for key, m_data in milestones.items():
            if m_data["baseline_month"] is None and base_inv >= m_data["target"]:
                m_data["baseline_month"] = m
            if m_data["scenario_month"] is None and scen_inv >= m_data["target"]:
                m_data["scenario_month"] = m

        # Yearly record
        if m % 12 == 0:
            yr = m // 12
            timeline.append({
                "year": yr,
                "label": f"Yr {yr}",
                "baseline_wealth": round(base_inv, 2),
                "scenario_wealth": round(scen_inv, 2),
                "extra_wealth": round(scen_inv - base_inv, 2),
            })

    total_invested_extra = total_new_monthly_investment * total_months
    final_extra_wealth = round(scen_inv - base_inv, 2)

    return {
        "scenario_type": "sip_boost",
        "additional_sip_monthly": additional_sip,
        "discretionary_cut_monthly": discretionary_cut,
        "total_new_monthly_investment": total_new_monthly_investment,
        "horizon_years": horizon_years,
        "expected_cagr_pct": expected_cagr_pct,
        "total_invested_extra": round(total_invested_extra, 2),
        "final_baseline_wealth": round(base_inv, 2),
        "final_scenario_wealth": round(scen_inv, 2),
        "extra_wealth_created": final_extra_wealth,
        "timeline": timeline,
        "milestones": milestones,
        "summary": (
            f"Investing an extra ₹{total_new_monthly_investment:,.0f}/month at {expected_cagr_pct}% CAGR yields "
            f"₹{scen_inv:,.0f} in {horizon_years} years (+₹{final_extra_wealth:,.0f} over baseline). "
            f"Total out-of-pocket added is ₹{total_invested_extra:,.0f}."
        ),
    }


def simulate_discretionary_affordability(
    current_liquid_balance: float,
    current_uncommitted: float,
    days_left_in_cycle: int,
    expense_amount: float,
    expense_name: str = "Discretionary Expense",
    safety_buffer: float = 25000.0,
) -> Dict[str, Any]:
    """
    Simulates affordability of a one-time cash expense (e.g. ₹25,000 vacation).
    Projects impact on safe-to-spend allowance, emergency cushion, and liquidity buffer.
    """
    clean_amt = max(0.0, float(expense_amount or 0.0))
    cycle_days = max(1, int(days_left_in_cycle or 1))
    
    current_safe_to_spend = round(max(0.0, current_uncommitted) / cycle_days, 2)
    post_uncommitted = round(current_uncommitted - clean_amt, 2)
    post_liquid = round(current_liquid_balance - clean_amt, 2)
    new_safe_to_spend = round(max(0.0, post_uncommitted) / cycle_days, 2)
    burn_reduction_pct = round(((current_safe_to_spend - new_safe_to_spend) / max(1.0, current_safe_to_spend)) * 100, 1)

    # Feasibility Score (0 to 100)
    # Check if user stays above safety buffer
    if post_uncommitted >= safety_buffer:
        score = min(100, int(85 + min(15, (post_uncommitted - safety_buffer) / 5000)))
        risk_level = "Low"
        verdict = "Affordable"
        actionable_advice = f"You can comfortably afford this {expense_name}. Your uncommitted cushion remains healthy at ₹{post_uncommitted:,.0f}, and your daily allowance only adjusts to ₹{new_safe_to_spend:,.0f}/day."
    elif post_uncommitted >= 0:
        buffer_deficit = safety_buffer - post_uncommitted
        score = max(45, min(80, int(75 - (buffer_deficit / safety_buffer) * 30)))
        risk_level = "Moderate"
        verdict = "Proceed with Caution"
        actionable_advice = f"Affordable, but it will dip into your ₹{safety_buffer:,.0f} safety buffer by ₹{buffer_deficit:,.0f}. Your safe-to-spend drops from ₹{current_safe_to_spend:,.0f}/day to ₹{new_safe_to_spend:,.0f}/day for the remaining {cycle_days} days."
    else:
        unpaid_risk = abs(post_uncommitted)
        score = max(10, min(40, int(35 - (unpaid_risk / max(1.0, clean_amt)) * 25)))
        risk_level = "High"
        verdict = "Not Recommended"
        actionable_advice = f"This purchase will cause a cashflow deficit of ₹{unpaid_risk:,.0f}, risking your ability to cover committed bills or loan EMIs this cycle. Consider deferring until next month or saving up in installments."

    return {
        "scenario_type": "discretionary_affordability",
        "expense_name": expense_name,
        "expense_amount": clean_amt,
        "current_liquid_balance": current_liquid_balance,
        "post_expense_liquid": post_liquid,
        "current_uncommitted": current_uncommitted,
        "post_expense_uncommitted": post_uncommitted,
        "days_left_in_cycle": cycle_days,
        "current_safe_to_spend_daily": current_safe_to_spend,
        "new_safe_to_spend_daily": new_safe_to_spend,
        "burn_reduction_pct": burn_reduction_pct,
        "safety_buffer": safety_buffer,
        "feasibility_score": score,
        "risk_level": risk_level,
        "verdict": verdict,
        "summary": actionable_advice,
    }


def simulate_emi_purchase(
    current_liquid_balance: float,
    current_monthly_income: float,
    current_monthly_expense: float,
    days_left_in_cycle: int,
    item_cost: float,
    tenure_months: int = 6,
    annual_interest_rate: float = 0.0,
    down_payment: float = 0.0,
    item_name: str = "Item",
    safety_buffer: float = 25000.0,
) -> Dict[str, Any]:
    """
    Simulates purchasing a consumer product (e.g. ₹80,000 laptop) on EMI.
    Supports no-cost EMI (0%) and interest-bearing consumer financing.
    """
    cost = max(0.0, float(item_cost or 0.0))
    dp = max(0.0, min(cost, float(down_payment or 0.0)))
    financed_principal = cost - dp
    tenure = max(1, int(tenure_months or 6))
    rate = max(0.0, float(annual_interest_rate or 0.0))

    monthly_emi = calculate_emi(financed_principal, rate, tenure)
    total_interest = round(max(0.0, (monthly_emi * tenure) - financed_principal), 2)
    total_cost = round(dp + (monthly_emi * tenure), 2)

    cycle_days = max(1, int(days_left_in_cycle or 1))
    new_liquid_immediate = max(0.0, current_liquid_balance - dp)
    
    baseline_surplus = round(current_monthly_income - current_monthly_expense, 2)
    scenario_surplus = round(baseline_surplus - monthly_emi, 2)
    
    # Impact on daily safe to spend
    daily_safe_impact = round(monthly_emi / 30.0, 2)
    
    # Feasibility Score
    dti_addition = (monthly_emi / max(1.0, current_monthly_income)) * 100.0
    score = 90
    if scenario_surplus < 0:
        score -= 40
    elif scenario_surplus < 10000:
        score -= 20
    
    if dti_addition > 20.0:
        score -= 20
    elif dti_addition > 10.0:
        score -= 10

    if new_liquid_immediate < safety_buffer:
        score -= 15

    feasibility_score = max(15, min(100, score))
    if feasibility_score >= 75:
        risk_level = "Low"
        verdict = "Comfortably Feasible"
    elif feasibility_score >= 50:
        risk_level = "Moderate"
        verdict = "Feasible with Budget Adjustments"
    else:
        risk_level = "High"
        verdict = "High Risk of Strain"

    is_no_cost = rate == 0.0
    rate_desc = "No-Cost EMI (0% interest)" if is_no_cost else f"{rate:.1f}% APR financing"

    summary = (
        f"Buying {item_name} for ₹{cost:,.0f} over {tenure} months via {rate_desc} requires a monthly EMI of ₹{monthly_emi:,.0f}. "
        f"{'Total interest payable is ₹' + f'{total_interest:,.0f}.' if not is_no_cost else 'Zero interest charged.'} "
        f"This consumes ₹{daily_safe_impact:,.0f}/day of your discretionary capacity, leaving a monthly surplus of ₹{scenario_surplus:,.0f}."
    )

    return {
        "scenario_type": "emi_purchase",
        "item_name": item_name,
        "item_cost": cost,
        "down_payment": dp,
        "financed_principal": financed_principal,
        "tenure_months": tenure,
        "annual_interest_rate": rate,
        "monthly_emi": monthly_emi,
        "total_interest": total_interest,
        "total_cost": total_cost,
        "daily_safe_impact": daily_safe_impact,
        "baseline_monthly_surplus": baseline_surplus,
        "scenario_monthly_surplus": scenario_surplus,
        "feasibility_score": feasibility_score,
        "risk_level": risk_level,
        "verdict": verdict,
        "summary": summary,
    }


def simulate_loan_prepayment(
    principal: float,
    annual_interest_rate: float,
    tenure_months: int,
    prepayment_amount: float,
    loan_name: str = "Loan",
    current_liquid_balance: float = 0.0,
    safety_buffer: float = 25000.0,
) -> Dict[str, Any]:
    """
    Simulates making a lump-sum prepayment on an existing loan.
    Calculates exact interest saved and tenure reduction (months knocked off).
    """
    p = max(0.0, float(principal or 0.0))
    r_annual = max(0.0, float(annual_interest_rate or 0.0))
    n = max(1, int(tenure_months or 12))
    extra = max(0.0, min(p, float(prepayment_amount or 0.0)))

    r_monthly = (r_annual / 100.0) / 12.0
    base_emi = calculate_emi(p, r_annual, n)
    baseline_total_interest = round(max(0.0, (base_emi * n) - p), 2)

    new_principal = max(0.0, p - extra)
    
    if new_principal <= 0:
        revised_tenure = 0
        revised_total_interest = 0.0
        interest_saved = baseline_total_interest
        months_saved = n
    elif r_monthly == 0:
        revised_tenure = math.ceil(new_principal / base_emi)
        revised_total_interest = 0.0
        interest_saved = 0.0
        months_saved = max(0, n - revised_tenure)
    else:
        # Solve for revised tenure with same EMI:
        # n_rev = -ln(1 - (P' * r) / EMI) / ln(1 + r)
        try:
            val = 1.0 - (new_principal * r_monthly / base_emi)
            if val > 0:
                n_rev = -math.log(val) / math.log(1.0 + r_monthly)
                revised_tenure = max(1, math.ceil(n_rev))
                revised_total_interest = round(max(0.0, (base_emi * revised_tenure) - new_principal), 2)
                interest_saved = round(max(0.0, baseline_total_interest - revised_total_interest), 2)
                months_saved = max(0, n - revised_tenure)
            else:
                revised_tenure = 1
                revised_total_interest = round(new_principal * r_monthly, 2)
                interest_saved = round(max(0.0, baseline_total_interest - revised_total_interest), 2)
                months_saved = n - 1
        except Exception:
            revised_tenure = n
            revised_total_interest = baseline_total_interest
            interest_saved = 0.0
            months_saved = 0

    post_prepay_liquid = max(0.0, current_liquid_balance - extra) if current_liquid_balance > 0 else 0.0
    liquid_safe = (post_prepay_liquid >= safety_buffer) if current_liquid_balance > 0 else True

    score = 90
    if not liquid_safe:
        score -= 25
    if months_saved >= 6:
        score += 10
    feasibility_score = max(20, min(100, score))

    summary = (
        f"Prepaying ₹{extra:,.0f} on {loan_name} slashes ₹{interest_saved:,.0f} in future interest charges and "
        f"knocks {months_saved} months off your repayment timeline (closing in {revised_tenure} months instead of {n}). "
        f"{'✓ Your remaining cash buffer of ₹' + f'{post_prepay_liquid:,.0f}' + ' remains secure.' if current_liquid_balance > 0 and liquid_safe else ''}"
    )

    return {
        "scenario_type": "loan_prepayment",
        "loan_name": loan_name,
        "original_principal": p,
        "prepayment_amount": extra,
        "remaining_principal": new_principal,
        "annual_interest_rate": r_annual,
        "monthly_emi": base_emi,
        "original_tenure_months": n,
        "revised_tenure_months": revised_tenure,
        "months_saved": months_saved,
        "baseline_interest": baseline_total_interest,
        "revised_interest": revised_total_interest,
        "interest_saved": interest_saved,
        "feasibility_score": feasibility_score,
        "liquid_buffer_preserved": liquid_safe,
        "summary": summary,
    }
