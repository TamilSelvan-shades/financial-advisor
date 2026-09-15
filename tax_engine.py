"""
tax_engine.py - Indian Income Tax Regime Optimization Engine
Supports FY 2024-25 & FY 2025-26 under both Old and New Tax Regimes.
Incorporates Union Budget 2024 revisions:
  - New Regime Standard Deduction: ₹75,000
  - Revised New Regime Slabs (0-3L, 3-7L, 7-10L, 10-12L, 12-15L, >15L)
  - Section 87A Rebate (up to ₹7L in New Regime, up to ₹5L in Old Regime) + Marginal Relief
  - Chapter VI-A Deductions (80C, 80D, 80CCD(1B), 24b, HRA Exemption Sec 10(13A))
  - Surcharge & 4% Health and Education Cess
  - Break-Even Deduction Analyzer & Actionable AI Recommendations
"""

from typing import Any, Dict, List, Optional, Tuple


def calculate_hra_exemption(
    basic_salary: float,
    hra_received: float,
    rent_paid: float,
    is_metro: bool = True,
) -> Dict[str, Any]:
    """
    Computes HRA Exemption under Section 10(13A) of Indian Income Tax Act.
    Exemption is the minimum of:
      1. Actual HRA received
      2. Rent paid minus 10% of Basic salary
      3. 50% of Basic (Metro) or 40% of Basic (Non-Metro)
    """
    if basic_salary <= 0 or hra_received <= 0 or rent_paid <= 0:
        return {
            "exemption": 0.0,
            "actual_hra": round(hra_received, 2),
            "rent_minus_10pct": 0.0,
            "salary_pct_limit": 0.0,
            "taxable_hra": round(hra_received, 2),
        }

    salary_pct = 0.50 if is_metro else 0.40
    salary_pct_limit = round(salary_pct * basic_salary, 2)
    rent_minus_10pct = max(0.0, round(rent_paid - (0.10 * basic_salary), 2))
    
    exemption = min(hra_received, rent_minus_10pct, salary_pct_limit)
    taxable_hra = max(0.0, round(hra_received - exemption, 2))

    return {
        "exemption": round(exemption, 2),
        "actual_hra": round(hra_received, 2),
        "rent_minus_10pct": rent_minus_10pct,
        "salary_pct_limit": salary_pct_limit,
        "taxable_hra": taxable_hra,
    }


def compute_tax_slabs_old(taxable_income: float) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Calculates tax under Old Tax Regime for Individual < 60 yrs.
    Slabs:
      0 - 2,50,000: Nil (0%)
      2,50,001 - 5,00,000: 5%
      5,00,001 - 10,00,000: 20%
      > 10,00,000: 30%
    """
    slabs_breakdown = []
    tax = 0.0

    # Slab 1: Up to 2.5L
    slab1_amount = min(taxable_income, 250000.0)
    slabs_breakdown.append({
        "bracket": "Up to ₹2,50,000",
        "rate": "0%",
        "taxable_in_bracket": round(max(0.0, slab1_amount), 2),
        "tax": 0.0,
    })

    # Slab 2: 2.5L to 5L (5%)
    if taxable_income > 250000.0:
        slab2_taxable = min(taxable_income - 250000.0, 250000.0)
        slab2_tax = slab2_taxable * 0.05
        tax += slab2_tax
        slabs_breakdown.append({
            "bracket": "₹2,50,001 to ₹5,00,000",
            "rate": "5%",
            "taxable_in_bracket": round(slab2_taxable, 2),
            "tax": round(slab2_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "₹2,50,001 to ₹5,00,000",
            "rate": "5%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    # Slab 3: 5L to 10L (20%)
    if taxable_income > 500000.0:
        slab3_taxable = min(taxable_income - 500000.0, 500000.0)
        slab3_tax = slab3_taxable * 0.20
        tax += slab3_tax
        slabs_breakdown.append({
            "bracket": "₹5,00,001 to ₹10,00,000",
            "rate": "20%",
            "taxable_in_bracket": round(slab3_taxable, 2),
            "tax": round(slab3_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "₹5,00,001 to ₹10,00,000",
            "rate": "20%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    # Slab 4: Above 10L (30%)
    if taxable_income > 1000000.0:
        slab4_taxable = taxable_income - 1000000.0
        slab4_tax = slab4_taxable * 0.30
        tax += slab4_tax
        slabs_breakdown.append({
            "bracket": "Above ₹10,00,000",
            "rate": "30%",
            "taxable_in_bracket": round(slab4_taxable, 2),
            "tax": round(slab4_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "Above ₹10,00,000",
            "rate": "30%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    return round(tax, 2), slabs_breakdown


def compute_tax_slabs_new(taxable_income: float) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Calculates tax under New Tax Regime (Union Budget 2024 revised for FY 2024-25 / FY 2025-26).
    Slabs:
      0 - 3,00,000: Nil (0%)
      3,00,001 - 7,00,000: 5%
      7,00,001 - 10,00,000: 10%
      10,00,001 - 12,00,000: 15%
      12,00,001 - 15,00,000: 20%
      > 15,00,000: 30%
    """
    slabs_breakdown = []
    tax = 0.0

    # 1. Up to 3L
    slab1_amount = min(taxable_income, 300000.0)
    slabs_breakdown.append({
        "bracket": "Up to ₹3,00,000",
        "rate": "0%",
        "taxable_in_bracket": round(max(0.0, slab1_amount), 2),
        "tax": 0.0,
    })

    # 2. 3L to 7L (5%)
    if taxable_income > 300000.0:
        slab2_taxable = min(taxable_income - 300000.0, 400000.0)
        slab2_tax = slab2_taxable * 0.05
        tax += slab2_tax
        slabs_breakdown.append({
            "bracket": "₹3,00,001 to ₹7,00,000",
            "rate": "5%",
            "taxable_in_bracket": round(slab2_taxable, 2),
            "tax": round(slab2_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "₹3,00,001 to ₹7,00,000",
            "rate": "5%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    # 3. 7L to 10L (10%)
    if taxable_income > 700000.0:
        slab3_taxable = min(taxable_income - 700000.0, 300000.0)
        slab3_tax = slab3_taxable * 0.10
        tax += slab3_tax
        slabs_breakdown.append({
            "bracket": "₹7,00,001 to ₹10,00,000",
            "rate": "10%",
            "taxable_in_bracket": round(slab3_taxable, 2),
            "tax": round(slab3_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "₹7,00,001 to ₹10,00,000",
            "rate": "10%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    # 4. 10L to 12L (15%)
    if taxable_income > 1000000.0:
        slab4_taxable = min(taxable_income - 1000000.0, 200000.0)
        slab4_tax = slab4_taxable * 0.15
        tax += slab4_tax
        slabs_breakdown.append({
            "bracket": "₹10,00,001 to ₹12,00,000",
            "rate": "15%",
            "taxable_in_bracket": round(slab4_taxable, 2),
            "tax": round(slab4_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "₹10,00,001 to ₹12,00,000",
            "rate": "15%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    # 5. 12L to 15L (20%)
    if taxable_income > 1200000.0:
        slab5_taxable = min(taxable_income - 1200000.0, 300000.0)
        slab5_tax = slab5_taxable * 0.20
        tax += slab5_tax
        slabs_breakdown.append({
            "bracket": "₹12,00,001 to ₹15,00,000",
            "rate": "20%",
            "taxable_in_bracket": round(slab5_taxable, 2),
            "tax": round(slab5_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "₹12,00,001 to ₹15,00,000",
            "rate": "20%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    # 6. Above 15L (30%)
    if taxable_income > 1500000.0:
        slab6_taxable = taxable_income - 1500000.0
        slab6_tax = slab6_taxable * 0.30
        tax += slab6_tax
        slabs_breakdown.append({
            "bracket": "Above ₹15,00,000",
            "rate": "30%",
            "taxable_in_bracket": round(slab6_taxable, 2),
            "tax": round(slab6_tax, 2),
        })
    else:
        slabs_breakdown.append({
            "bracket": "Above ₹15,00,000",
            "rate": "30%",
            "taxable_in_bracket": 0.0,
            "tax": 0.0,
        })

    return round(tax, 2), slabs_breakdown


def calculate_surcharge(taxable_income: float, base_tax: float, is_new_regime: bool = False) -> float:
    """
    Computes Surcharge based on taxable income tiers.
    """
    if taxable_income <= 5000000.0 or base_tax <= 0:
        return 0.0

    if taxable_income <= 10000000.0:
        rate = 0.10
    elif taxable_income <= 20000000.0:
        rate = 0.15
    elif taxable_income <= 50000000.0:
        rate = 0.25
    else:
        # In New Regime, surcharge is capped at 25%. In Old Regime, was 37%
        rate = 0.25 if is_new_regime else 0.37

    return round(base_tax * rate, 2)


def calculate_tax_comparison(
    gross_salary: float,
    basic_salary: Optional[float] = None,
    hra_received: float = 0.0,
    rent_paid: float = 0.0,
    is_metro: bool = True,
    section_80c: float = 0.0,
    section_80d_self: float = 0.0,
    section_80d_parents: float = 0.0,
    parents_senior_citizen: bool = False,
    section_80ccd_1b: float = 0.0,
    section_24b: float = 0.0,
    other_deductions: float = 0.0,
    financial_year: str = "2024-2025",
) -> Dict[str, Any]:
    """
    Primary tax optimization engine comparing Old vs New Tax Regime side-by-side.
    Returns complete breakdown, effective tax rates, AI recommendations, and break-even deductions.
    """
    gross = max(0.0, float(gross_salary))
    basic = float(basic_salary) if basic_salary is not None else round(gross * 0.50, 2)

    # --- 1. Deductions under Old Tax Regime ---
    std_deduction_old = 50000.0 if gross >= 50000.0 else gross
    ded_80c = min(max(0.0, float(section_80c)), 150000.0)

    # 80D: Self up to 25k; Parents up to 25k (or 50k if senior citizen)
    limit_parents = 50000.0 if parents_senior_citizen else 25000.0
    ded_80d_self = min(max(0.0, float(section_80d_self)), 25000.0)
    ded_80d_parents = min(max(0.0, float(section_80d_parents)), limit_parents)
    total_80d = ded_80d_self + ded_80d_parents

    # 80CCD(1B): NPS up to 50k
    ded_nps = min(max(0.0, float(section_80ccd_1b)), 50000.0)

    # Section 24b: Home loan interest up to 2L for self-occupied
    ded_24b = min(max(0.0, float(section_24b)), 200000.0)

    # HRA Exemption
    hra_res = calculate_hra_exemption(basic, hra_received, rent_paid, is_metro)
    ded_hra = hra_res["exemption"]

    ded_other = max(0.0, float(other_deductions))

    total_deductions_old = round(
        std_deduction_old + ded_80c + total_80d + ded_nps + ded_24b + ded_hra + ded_other, 2
    )
    taxable_income_old = max(0.0, round(gross - total_deductions_old, 2))

    # Old Regime Tax Math
    base_tax_old, slabs_old = compute_tax_slabs_old(taxable_income_old)

    # Section 87A Rebate (Old): If taxable income <= 5L, rebate up to 12,500
    rebate_87a_old = 0.0
    if taxable_income_old <= 500000.0:
        rebate_87a_old = min(base_tax_old, 12500.0)

    tax_after_rebate_old = max(0.0, base_tax_old - rebate_87a_old)
    surcharge_old = calculate_surcharge(taxable_income_old, tax_after_rebate_old, is_new_regime=False)
    cess_old = round((tax_after_rebate_old + surcharge_old) * 0.04, 2)
    net_tax_old = round(tax_after_rebate_old + surcharge_old + cess_old)

    # --- 2. Deductions under New Tax Regime (Budget 2024) ---
    std_deduction_new = 75000.0 if gross >= 75000.0 else gross
    total_deductions_new = std_deduction_new
    taxable_income_new = max(0.0, round(gross - total_deductions_new, 2))

    # New Regime Tax Math
    base_tax_new, slabs_new = compute_tax_slabs_new(taxable_income_new)

    # Section 87A Rebate & Marginal Relief (New):
    rebate_87a_new = 0.0
    marginal_relief_new = 0.0

    if taxable_income_new <= 700000.0:
        # Full rebate under 87A (tax on 7L is 25,000)
        rebate_87a_new = min(base_tax_new, 25000.0)
    elif taxable_income_new > 700000.0 and taxable_income_new <= 727777.0:
        # Marginal relief: Tax payable cannot exceed (Taxable Income - 7,00,000)
        excess_income = taxable_income_new - 700000.0
        if base_tax_new > excess_income:
            marginal_relief_new = round(base_tax_new - excess_income, 2)

    tax_after_relief_new = max(0.0, base_tax_new - rebate_87a_new - marginal_relief_new)
    surcharge_new = calculate_surcharge(taxable_income_new, tax_after_relief_new, is_new_regime=True)
    cess_new = round((tax_after_relief_new + surcharge_new) * 0.04, 2)
    net_tax_new = round(tax_after_relief_new + surcharge_new + cess_new)

    # --- 3. Comparison & Strategic Insights ---
    tax_diff = round(abs(net_tax_old - net_tax_new), 2)
    if net_tax_new < net_tax_old:
        recommended_regime = "new"
        recommendation_title = f"New Tax Regime saves you ₹{tax_diff:,.0f} per year!"
    elif net_tax_old < net_tax_new:
        recommended_regime = "old"
        recommendation_title = f"Old Tax Regime saves you ₹{tax_diff:,.0f} per year!"
    else:
        recommended_regime = "equal"
        recommendation_title = "Both Tax Regimes yield the exact same tax liability."

    eff_rate_old = round((net_tax_old / gross) * 100, 2) if gross > 0 else 0.0
    eff_rate_new = round((net_tax_new / gross) * 100, 2) if gross > 0 else 0.0

    # --- 4. Break-Even Deduction Analysis ---
    # Find total deductions under Old Regime needed to achieve net_tax_new
    break_even_deductions, deduction_gap, break_even_notes = calculate_break_even(
        gross=gross,
        target_net_tax=net_tax_new,
        current_deductions=total_deductions_old,
    )

    return {
        "financial_year": financial_year,
        "gross_salary": round(gross, 2),
        "basic_salary": round(basic, 2),
        "recommended_regime": recommended_regime,
        "savings_amount": tax_diff,
        "recommendation_title": recommendation_title,
        "break_even": {
            "break_even_deductions": break_even_deductions,
            "current_deductions": total_deductions_old,
            "deduction_gap": deduction_gap,
            "notes": break_even_notes,
        },
        "old_regime": {
            "gross_income": round(gross, 2),
            "total_deductions": total_deductions_old,
            "deductions_breakdown": {
                "standard_deduction": std_deduction_old,
                "section_80c": ded_80c,
                "section_80d_self": ded_80d_self,
                "section_80d_parents": ded_80d_parents,
                "total_80d": total_80d,
                "section_80ccd_1b": ded_nps,
                "section_24b": ded_24b,
                "hra_exemption": ded_hra,
                "other_deductions": ded_other,
            },
            "taxable_income": taxable_income_old,
            "base_tax": base_tax_old,
            "slabs_breakdown": slabs_old,
            "section_87a_rebate": rebate_87a_old,
            "surcharge": surcharge_old,
            "cess_4pct": cess_old,
            "net_tax_payable": net_tax_old,
            "effective_tax_rate": eff_rate_old,
        },
        "new_regime": {
            "gross_income": round(gross, 2),
            "total_deductions": total_deductions_new,
            "deductions_breakdown": {
                "standard_deduction": std_deduction_new,
            },
            "taxable_income": taxable_income_new,
            "base_tax": base_tax_new,
            "slabs_breakdown": slabs_new,
            "section_87a_rebate": rebate_87a_new,
            "marginal_relief": marginal_relief_new,
            "surcharge": surcharge_new,
            "cess_4pct": cess_new,
            "net_tax_payable": net_tax_new,
            "effective_tax_rate": eff_rate_new,
        },
        "hra_calculation": hra_res,
    }


def calculate_break_even(
    gross: float,
    target_net_tax: float,
    current_deductions: float,
) -> Tuple[float, float, str]:
    """
    Computes the total deductions required under the Old Tax Regime to equal target_net_tax (New Regime).
    Performs binary search over deduction space [0, gross].
    """
    if gross <= 0 or target_net_tax <= 0:
        return 0.0, 0.0, "Income is already tax-free under New Regime."

    low = 0.0
    high = gross
    best_deductions = gross

    # 25 iterations of binary search is accurate to within a few rupees
    for _ in range(25):
        mid = (low + high) / 2.0
        taxable = max(0.0, gross - mid)
        tax, _ = compute_tax_slabs_old(taxable)
        if taxable <= 500000.0:
            rebate = min(tax, 12500.0)
            tax = max(0.0, tax - rebate)
        surcharge = calculate_surcharge(taxable, tax, is_new_regime=False)
        total_tax = round((tax + surcharge) * 1.04)

        if total_tax <= target_net_tax:
            best_deductions = mid
            high = mid  # Try finding a smaller deduction that also satisfies
        else:
            low = mid

    needed = round(best_deductions, 2)
    gap = max(0.0, round(needed - current_deductions, 2))

    if gap == 0.0:
        notes = "Your current deductions are already sufficient for Old Regime to save equal or more tax."
    else:
        notes = f"You need ₹{gap:,.0f} more in eligible deductions (e.g., NPS 80CCD, Health Insurance 80D, or Home Loan) for Old Regime to beat New Regime."

    return needed, gap, notes
