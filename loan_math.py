import pandas as pd

def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """Calculates standard monthly EMI."""
    if annual_rate == 0:
        return principal / tenure_months
    r = (annual_rate / 100) / 12
    emi = principal * r * ((1 + r) ** tenure_months) / (((1 + r) ** tenure_months) - 1)
    return emi

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