"""
reminder_service.py - Unified Reminder, Overdue Lifecycle & Daily Financial Status Service
Provides:
  1. Calendar-aware due-date resolution with month-rollover support
  2. Overdue, Due Today, and 7-Day Horizon classification
  3. Auto-Ledger Bill Settlement (marks bill paid and generates ledger Expense entry)
  4. Daily Financial Status & Safe-to-Spend metrics aggregation
  5. Multi-channel Telegram & In-App briefing formatting
"""

import calendar
import datetime
import json
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
import requests
import os

import models
import loan_math


def safe_date(year: int, month: int, day: int) -> datetime.date:
    """Safely constructs a datetime.date object clamped to the valid days of the given month."""
    _, max_days = calendar.monthrange(year, month)
    valid_day = min(max(1, int(day)), max_days)
    return datetime.date(year, month, valid_day)


def get_next_month(year: int, month: int) -> tuple[int, int]:
    """Returns (next_year, next_month) tuple."""
    if month == 12:
        return year + 1, 1
    return year, month + 1


def calculate_bill_timeline(
    due_day: int,
    status: str,
    ref_date: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """
    Computes precise calendar due dates, overdue status, and days until due.
    Correctly handles:
      - Overdue bills when due_day has elapsed in the current month without payment
      - Bills due today (due_day == current_day)
      - Upcoming bills due in current month (due_day > current_day)
      - Upcoming bills due in next month across month boundary (e.g. ref_date is 29th, due_day is 3rd)
      - Already paid bills (next billing cycle projected to next month)
    """
    today = ref_date or datetime.date.today()
    current_day = today.day
    is_paid = (status or "").strip().lower() == "paid"
    due_day_clean = min(max(int(due_day or 1), 1), 31)

    if is_paid:
        # Bill is settled for current cycle. Next occurrence is next month.
        ny, nm = get_next_month(today.year, today.month)
        next_due = safe_date(ny, nm, due_day_clean)
        days_until_due = (next_due - today).days
        return {
            "due_day": due_day_clean,
            "lifecycle_status": "paid",
            "next_due_date": next_due.strftime("%Y-%m-%d"),
            "days_until_due": days_until_due,
            "days_overdue": 0,
            "urgency": "none",
            "label": "Settled for this cycle",
        }

    # Not paid: examine current month vs due_day
    if due_day_clean < current_day:
        # Due day has elapsed in the current month and is unpaid => OVERDUE
        due_date = safe_date(today.year, today.month, due_day_clean)
        days_overdue = current_day - due_day_clean
        days_until_due = -days_overdue
        return {
            "due_day": due_day_clean,
            "lifecycle_status": "overdue",
            "next_due_date": due_date.strftime("%Y-%m-%d"),
            "days_until_due": days_until_due,
            "days_overdue": days_overdue,
            "urgency": "critical",
            "label": f"OVERDUE by {days_overdue} day{'s' if days_overdue > 1 else ''}",
        }
    elif due_day_clean == current_day:
        # Due TODAY
        due_date = today
        return {
            "due_day": due_day_clean,
            "lifecycle_status": "due_today",
            "next_due_date": due_date.strftime("%Y-%m-%d"),
            "days_until_due": 0,
            "days_overdue": 0,
            "urgency": "high",
            "label": "DUE TODAY",
        }
    else:
        # Due later in current month
        due_date = safe_date(today.year, today.month, due_day_clean)
        days_until_due = (due_date - today).days
        if days_until_due <= 7:
            lifecycle = "upcoming_7d"
            urgency = "high" if days_until_due <= 2 else "medium"
            label = f"Due in {days_until_due} days"
        else:
            lifecycle = "future"
            urgency = "low"
            label = f"Due on {due_date.strftime('%b %d')}"

        return {
            "due_day": due_day_clean,
            "lifecycle_status": lifecycle,
            "next_due_date": due_date.strftime("%Y-%m-%d"),
            "days_until_due": days_until_due,
            "days_overdue": 0,
            "urgency": urgency,
            "label": label,
        }


def compute_cashflow_runway(
    db: Session,
    tenant_id: str,
    liquid_balance: float = 0.0,
    all_bills: Optional[List[models.Bill]] = None,
    scheduled_emis_amount: float = 0.0,
    ref_date: Optional[datetime.date] = None,
    as_of_date: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """
    Computes a forward-looking 7-day and 14-day cashflow liquidity runway.
    Checks projected balances against the tenant's safety buffer threshold
    (from models.AutonomousRule or default ₹25,000) and triggers Deficit Guardian alerts.
    """
    today = as_of_date or ref_date or datetime.date.today()
    today_str = today.strftime("%Y-%m-%d")

    if all_bills is None:
        all_bills = (
            db.query(models.Bill)
            .filter(models.Bill.tenant_id == tenant_id)
            .all()
        )

    # 1. Fetch safety buffer from autonomous rules or default to 25,000.0
    rule = (
        db.query(models.AutonomousRule)
        .filter(models.AutonomousRule.tenant_id == tenant_id, models.AutonomousRule.rule_type == "auto_sweep")
        .first()
    )
    safety_buffer = 25000.0
    if rule and rule.config_json:
        try:
            cfg = json.loads(rule.config_json)
            safety_buffer = float(cfg.get("buffer_threshold", 25000.0))
        except Exception:
            safety_buffer = 25000.0

    # 2. Upcoming bills in 7d and 14d horizons
    upcoming_bills_7d_total = 0.0
    upcoming_bills_14d_total = 0.0
    bills_due_in_14d = []

    for b in all_bills:
        timeline = calculate_bill_timeline(b.due_day or 1, b.status or "Pending", today)
        is_unpaid = (b.status or "").lower() != "paid"
        amt = float(b.amount or 0.0)

        if is_unpaid:
            days_due = timeline["days_until_due"]
            # Overdue (days_due < 0) or due today (days_due == 0) or due within 7/14 days
            if days_due <= 7:
                upcoming_bills_7d_total += amt
            if days_due <= 14:
                upcoming_bills_14d_total += amt
                bills_due_in_14d.append({
                    "name": b.name,
                    "amount": amt,
                    "days_until_due": days_due,
                    "label": timeline["label"],
                })

    upcoming_bills_7d_total = round(upcoming_bills_7d_total, 2)
    upcoming_bills_14d_total = round(upcoming_bills_14d_total, 2)

    # 3. Scheduled EMIs share (7d and 14d prorated commitments)
    scheduled_emis_7d = round(scheduled_emis_amount * (7.0 / 30.0), 2)
    scheduled_emis_14d = round(scheduled_emis_amount * (14.0 / 30.0), 2)

    # 4. Forward liquidity projections
    projected_7d = round(liquid_balance - upcoming_bills_7d_total - scheduled_emis_7d, 2)
    projected_14d = round(liquid_balance - upcoming_bills_14d_total - scheduled_emis_14d, 2)
    min_projected = min(projected_7d, projected_14d)

    # 5. Deficit Guardian classification & transfer suggestions
    target_transfer_date = (today + datetime.timedelta(days=7)).strftime("%b %d")
    if min_projected < 0:
        has_deficit = True
        deficit_severity = "critical"
        deficit_amount = round(abs(min_projected) + safety_buffer, 2)
        warning_title = "🚨 Critical Overdraft Alert"
        warning_message = (
            f"Committed dues of ₹{upcoming_bills_14d_total + scheduled_emis_14d:,.0f} over the next 14 days "
            f"will deplete your liquid cash, pushing projected balance into overdraft (-₹{abs(min_projected):,.0f})."
        )
        suggested_transfer = max(5000.0, round(deficit_amount + 2000, -2))
        suggested_action = (
            f"Urgent: Transfer ₹{suggested_transfer:,.0f} from High-Yield Savings / Secondary Account "
            f"to primary checking account before {target_transfer_date} to prevent overdraft & dishonor charges."
        )
    elif min_projected < safety_buffer:
        has_deficit = True
        deficit_severity = "warning"
        deficit_amount = round(safety_buffer - min_projected, 2)
        warning_title = "⚠️ Cashflow Buffer Deficit Warning"
        warning_message = (
            f"Upcoming obligations of ₹{upcoming_bills_14d_total + scheduled_emis_14d:,.0f} will cause your "
            f"cushion to dip to ₹{min_projected:,.0f}, breaching your ₹{safety_buffer:,.0f} safety threshold by ₹{deficit_amount:,.0f}."
        )
        suggested_transfer = max(3000.0, round(deficit_amount + 1000, -2))
        suggested_action = (
            f"Transfer ₹{suggested_transfer:,.0f} from High-Yield Savings / Secondary Account "
            f"to primary checking account before {target_transfer_date} to preserve your ₹{safety_buffer:,.0f} safety buffer."
        )
    else:
        has_deficit = False
        deficit_severity = "healthy"
        deficit_amount = 0.0
        warning_title = "✓ Cashflow Runway Healthy"
        warning_message = (
            f"Safe-to-pay runway is green. Projected 7D cushion is ₹{projected_7d:,.0f} "
            f"and 14D cushion is ₹{projected_14d:,.0f} after ring-fencing upcoming dues."
        )
        suggested_action = "No transfer required. Your cash reserves comfortably cover obligations."

    # 6. Autonomous Action Logging (if deficit active)
    if has_deficit:
        try:
            existing_log = (
                db.query(models.AutonomousActionLog)
                .filter(
                    models.AutonomousActionLog.tenant_id == tenant_id,
                    models.AutonomousActionLog.rule_type == "cashflow_guardian",
                    models.AutonomousActionLog.created_at == today_str,
                    models.AutonomousActionLog.status == "active",
                )
                .first()
            )
            if not existing_log:
                new_action = models.AutonomousActionLog(
                    tenant_id=tenant_id,
                    created_at=today_str,
                    rule_type="cashflow_guardian",
                    action_type="alert",
                    title=warning_title,
                    message=warning_message,
                    amount=deficit_amount,
                    status="active",
                )
                db.add(new_action)
                db.commit()
        except Exception:
            db.rollback()

    return {
        "status": deficit_severity,
        "has_deficit": has_deficit,
        "overdraft_risk": deficit_severity == "critical",
        "buffer_breach_risk": deficit_severity == "warning",
        "deficit_severity": deficit_severity,
        "safety_buffer_threshold": safety_buffer,
        "current_liquid_cash": liquid_balance,
        "liquid_balance": liquid_balance,
        "upcoming_bills_7d": upcoming_bills_7d_total,
        "upcoming_bills_14d": upcoming_bills_14d_total,
        "d7_outflows": upcoming_bills_7d_total + scheduled_emis_7d,
        "d14_outflows": upcoming_bills_14d_total + scheduled_emis_14d,
        "scheduled_emis_7d": scheduled_emis_7d,
        "scheduled_emis_14d": scheduled_emis_14d,
        "projected_7d_balance": projected_7d,
        "projected_14d_balance": projected_14d,
        "min_projected_balance": min_projected,
        "deficit_amount": deficit_amount,
        "warning_title": warning_title,
        "warning_message": warning_message,
        "alert_message": warning_message,
        "suggested_action": suggested_action,
        "transfer_suggestion": suggested_action,
        "bills_due_in_14d": bills_due_in_14d,
    }


def get_tenant_reminders_and_status(
    db: Session,
    tenant_id: str,
    ref_date: Optional[datetime.date] = None,
    as_of_date: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """
    Gathers comprehensive reminders, bill classifications, liquid balances,
    safe-to-spend allowance (with weekend pacing), cashflow runway deficit guardian,
    yesterday spend recap vs target, and budget guardrails for a given tenant.
    """
    today = as_of_date or ref_date or datetime.date.today()
    current_month_prefix = today.strftime("%Y-%m")
    _, days_in_month = calendar.monthrange(today.year, today.month)
    days_left_in_cycle = max(1, days_in_month - today.day + 1)

    # 1. Bills Classification
    bills = db.query(models.Bill).filter(models.Bill.tenant_id == tenant_id).all()
    overdue_bills: List[Dict[str, Any]] = []
    due_today_bills: List[Dict[str, Any]] = []
    upcoming_7d_bills: List[Dict[str, Any]] = []
    paid_bills: List[Dict[str, Any]] = []

    for b in bills:
        timeline = calculate_bill_timeline(b.due_day or 1, b.status or "Pending", today)
        bill_data = {
            "id": b.id,
            "name": b.name,
            "amount": float(b.amount or 0.0),
            "due_day": timeline["due_day"],
            "status": b.status or "Pending",
            "lifecycle_status": timeline["lifecycle_status"],
            "next_due_date": timeline["next_due_date"],
            "days_until_due": timeline["days_until_due"],
            "days_overdue": timeline["days_overdue"],
            "urgency": timeline["urgency"],
            "label": timeline["label"],
        }

        if timeline["lifecycle_status"] == "overdue":
            overdue_bills.append(bill_data)
        elif timeline["lifecycle_status"] == "due_today":
            due_today_bills.append(bill_data)
        elif timeline["lifecycle_status"] == "upcoming_7d":
            upcoming_7d_bills.append(bill_data)
        elif timeline["lifecycle_status"] == "paid":
            paid_bills.append(bill_data)

    # Sort: highest urgency & nearest due date
    overdue_bills.sort(key=lambda x: x["days_overdue"], reverse=True)
    due_today_bills.sort(key=lambda x: x["amount"], reverse=True)
    upcoming_7d_bills.sort(key=lambda x: x["days_until_due"])
    paid_bills.sort(key=lambda x: x["name"])

    total_overdue_amount = round(sum(b["amount"] for b in overdue_bills), 2)
    total_due_today_amount = round(sum(b["amount"] for b in due_today_bills), 2)
    total_upcoming_7d_amount = round(sum(b["amount"] for b in upcoming_7d_bills), 2)
    total_pending_all_bills = round(
        sum(float(b.amount or 0.0) for b in bills if (b.status or "").lower() != "paid"), 2
    )

    # 2. Liquid Balance & Safe-to-Spend Computation
    all_accounts = db.query(models.Account).filter(models.Account.tenant_id == tenant_id).all()
    all_adjustments = db.query(models.BalanceAdjustment).filter(models.BalanceAdjustment.tenant_id == tenant_id).all()
    all_incomes = db.query(models.Income).filter(models.Income.tenant_id == tenant_id).all()
    all_expenses = db.query(models.Expense).filter(models.Expense.tenant_id == tenant_id).all()
    all_loans = db.query(models.Loan).filter(models.Loan.tenant_id == tenant_id).all()
    all_investments = db.query(models.Investment).filter(models.Investment.tenant_id == tenant_id).all()

    tot_acc = sum(float(a.initial_balance or 0.0) for a in all_accounts)
    tot_adj = sum(float(ba.amount or 0.0) for ba in all_adjustments)
    tot_inc = sum(float(i.amount or 0.0) for i in all_incomes)
    tot_exp = sum(float(e.amount or 0.0) for e in all_expenses)
    liquid_balance = max(0.0, round(tot_acc + tot_inc - tot_exp + tot_adj, 2))

    total_assets = sum(float(inv.current_value or 0.0) for inv in all_investments) + liquid_balance
    total_debt = sum(float(l.principal or 0.0) for l in all_loans)
    net_worth = round(total_assets - total_debt, 2)

    # Scheduled monthly loan EMIs
    scheduled_emis_amount = 0.0
    for l in all_loans:
        p = float(l.principal or 0.0)
        r = float(l.interest_rate or 0.0)
        n = int(l.tenure_months or ((l.tenure_years or 1.0) * 12))
        if p > 0 and n > 0:
            try:
                scheduled_emis_amount += loan_math.calculate_emi(p, r, n)
            except Exception:
                pass
    scheduled_emis_amount = round(scheduled_emis_amount, 2)

    # Ring-fence committed bills (all unpaid bills for this month) + EMIs
    uncommitted_balance = max(0.0, round(liquid_balance - total_pending_all_bills - scheduled_emis_amount, 2))
    safe_to_spend_daily = round(uncommitted_balance / days_left_in_cycle, 2)

    # Weekend Pacing computation (Friday, Saturday, Sunday get 1.6x weighting)
    weighted_days = 0.0
    for d in range(today.day, days_in_month + 1):
        day_date = datetime.date(today.year, today.month, d)
        weighted_days += 1.6 if day_date.weekday() in [4, 5, 6] else 1.0

    is_weekend = today.weekday() in [4, 5, 6]
    today_weight = 1.6 if is_weekend else 1.0
    adjusted_safe_to_spend_daily = round((uncommitted_balance / max(1.0, weighted_days)) * today_weight, 2)
    pacing_label = "Weekend-Paced (1.6x allowance)" if is_weekend else "Weekday-Paced (1.0x allowance)"

    if adjusted_safe_to_spend_daily >= 1500:
        burn_rate_status = "Healthy"
    elif adjusted_safe_to_spend_daily >= 500:
        burn_rate_status = "Moderate"
    else:
        burn_rate_status = "Tight"

    # 3. Cashflow Runway & Deficit Guardian
    cashflow_guardian = compute_cashflow_runway(
        db=db,
        tenant_id=tenant_id,
        liquid_balance=liquid_balance,
        all_bills=bills,
        scheduled_emis_amount=scheduled_emis_amount,
        ref_date=today,
    )

    # 4. Budget Warnings (80% yellow, 100% red breach)
    budgets = db.query(models.Budget).filter(models.Budget.tenant_id == tenant_id).all()
    budget_warnings: List[Dict[str, Any]] = []

    for b in budgets:
        limit = float(b.monthly_limit or 0.0)
        if limit <= 0.0:
            continue

        spent = (
            db.query(func.sum(models.Expense.amount))
            .filter(
                func.lower(models.Expense.category) == b.category.lower(),
                models.Expense.date.like(f"{current_month_prefix}%"),
                models.Expense.tenant_id == tenant_id,
            )
            .scalar()
            or 0.0
        )
        spent = round(float(spent), 2)
        pct = round((spent / limit) * 100.0, 1)

        if spent > limit:
            budget_warnings.append({
                "category": b.category,
                "monthly_limit": limit,
                "spent_amount": spent,
                "percentage": pct,
                "severity": "critical",
                "message": f"Exceeded by ₹{spent - limit:,.2f} ({pct:.0f}% of ₹{limit:,.0f})",
            })
        elif pct >= 80.0:
            budget_warnings.append({
                "category": b.category,
                "monthly_limit": limit,
                "spent_amount": spent,
                "percentage": pct,
                "severity": "warning",
                "message": f"At {pct:.0f}% of limit (₹{spent:,.0f} / ₹{limit:,.0f})",
            })

    budget_warnings.sort(key=lambda x: (x["severity"] == "critical", x["percentage"]), reverse=True)

    # 5. Yesterday's spend recap vs daily target
    yesterday = today - datetime.timedelta(days=1)
    yesterday_str = yesterday.strftime("%Y-%m-%d")
    yesterday_expenses = [e for e in all_expenses if str(e.date or "")[:10] == yesterday_str]
    yesterday_total_spend = round(sum(float(e.amount or 0.0) for e in yesterday_expenses), 2)

    yesterday_target = safe_to_spend_daily
    yesterday_spend_diff = round(yesterday_target - yesterday_total_spend, 2)
    if yesterday_spend_diff >= 0:
        yesterday_recap_feedback = f"🎉 Underspent by ₹{yesterday_spend_diff:,.0f}! You banked surplus cash."
    else:
        yesterday_recap_feedback = f"⚠️ Overspent by ₹{abs(yesterday_spend_diff):,.0f} vs daily target."

    # 6. Proactive AI micro-insight
    if cashflow_guardian.get("has_deficit"):
        ai_insight = f"Cashflow Guardian Alert: {cashflow_guardian['warning_message']} {cashflow_guardian['suggested_action']}"
    elif overdue_bills:
        ai_insight = f"Action Required: You have {len(overdue_bills)} overdue bill(s) totaling ₹{total_overdue_amount:,.0f}. Settle these first to prevent late charges or credit score dips."
    elif due_today_bills:
        ai_insight = f"Today's Priority: {len(due_today_bills)} bill(s) due today (₹{total_due_today_amount:,.0f}). Adjusted safe-to-spend allowance is ₹{adjusted_safe_to_spend_daily:,.0f}/day ({pacing_label})."
    elif budget_warnings and budget_warnings[0]["severity"] == "critical":
        ai_insight = f"Budget Alert: '{budget_warnings[0]['category']}' has exceeded its monthly cap. Tap into your discretionary buffer."
    else:
        ai_insight = f"Financial Health Green: Uncommitted cash ₹{uncommitted_balance:,.0f}. Safe-to-spend allowance is ₹{adjusted_safe_to_spend_daily:,.0f}/day ({pacing_label}) with {days_left_in_cycle} days left in cycle."

    total_actionable_reminders = (
        len(overdue_bills)
        + len(due_today_bills)
        + len(budget_warnings)
        + (1 if cashflow_guardian.get("has_deficit") else 0)
    )

    return {
        "status": "success",
        "as_of_date": today.strftime("%Y-%m-%d"),
        "formatted_date": today.strftime("%A, %B %d, %Y"),
        "days_left_in_cycle": days_left_in_cycle,
        "total_actionable_reminders": total_actionable_reminders,
        "ai_insight": ai_insight,
        "kpis": {
            "net_worth": net_worth,
            "liquid_balance": liquid_balance,
            "uncommitted_balance": uncommitted_balance,
            "safe_to_spend_daily": safe_to_spend_daily,
            "adjusted_safe_to_spend_daily": adjusted_safe_to_spend_daily,
            "is_weekend": is_weekend,
            "weekend_pacing_label": pacing_label,
            "burn_rate_status": burn_rate_status,
            "yesterday_total_spend": yesterday_total_spend,
            "yesterday_target": yesterday_target,
            "yesterday_spend_diff": yesterday_spend_diff,
            "yesterday_recap_feedback": yesterday_recap_feedback,
            "total_pending_all_bills": total_pending_all_bills,
            "scheduled_emis_amount": scheduled_emis_amount,
            "projected_7d_balance": cashflow_guardian.get("projected_7d_balance", 0.0),
            "projected_14d_balance": cashflow_guardian.get("projected_14d_balance", 0.0),
        },
        "cashflow_guardian": cashflow_guardian,
        "bills": {
            "overdue_count": len(overdue_bills),
            "overdue_amount": total_overdue_amount,
            "overdue_bills": overdue_bills,
            "due_today_count": len(due_today_bills),
            "due_today_amount": total_due_today_amount,
            "due_today_bills": due_today_bills,
            "upcoming_7d_count": len(upcoming_7d_bills),
            "upcoming_7d_amount": total_upcoming_7d_amount,
            "upcoming_7d_bills": upcoming_7d_bills,
            "settled_count": len(paid_bills),
            "settled_bills": paid_bills,
        },
        "budget_warnings": {
            "count": len(budget_warnings),
            "has_critical": any(b["severity"] == "critical" for b in budget_warnings),
            "warnings": budget_warnings,
        },
    }


def settle_bill_with_expense(
    db: Session,
    tenant_id: str,
    bill_id: int,
    auto_log_expense: bool = True,
    account: str = "ICICI Savings Account",
    category: str = "Utilities",
    payment_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Atomically updates a bill's status to 'Paid' and optionally generates
    an Expense record in the financial ledger to avoid double entry.
    """
    bill = (
        db.query(models.Bill)
        .filter(models.Bill.id == bill_id, models.Bill.tenant_id == tenant_id)
        .first()
    )
    if not bill:
        return {"success": False, "message": "Bill not found."}

    bill.status = "Paid"
    today_str = payment_date or datetime.date.today().strftime("%Y-%m-%d")
    created_expense = None

    if auto_log_expense:
        # Determine category intelligently
        assigned_cat = category or "Utilities"
        desc = f"Bill: {bill.name}"

        new_expense = models.Expense(
            date=today_str,
            description=desc,
            amount=float(bill.amount or 0.0),
            category=assigned_cat,
            account=account or "ICICI Savings Account",
            remarks=f"Auto-settled from Recurring Bills (Bill #{bill.id})",
            tenant_id=tenant_id,
        )
        db.add(new_expense)
        created_expense = {
            "description": desc,
            "amount": float(bill.amount or 0.0),
            "category": assigned_cat,
            "account": account or "ICICI Savings Account",
            "date": today_str,
        }

    db.commit()
    db.refresh(bill)

    return {
        "success": True,
        "message": f"Bill '{bill.name}' marked as Paid" + (" and logged to ledger." if auto_log_expense else "."),
        "bill": {
            "id": bill.id,
            "name": bill.name,
            "amount": float(bill.amount or 0.0),
            "status": bill.status,
            "due_day": bill.due_day,
        },
        "created_expense": created_expense,
    }


def format_daily_status_telegram_message(
    status_data: Dict[str, Any],
    user_name: str = "",
) -> str:
    """
    Formats the complete daily status payload into an executive-grade Telegram Markdown alert.
    """
    dt_str = status_data.get("formatted_date", datetime.date.today().strftime("%b %d, %Y"))
    kpis = status_data.get("kpis", {})
    bills = status_data.get("bills", {})
    bw = status_data.get("budget_warnings", {})
    ai_insight = status_data.get("ai_insight", "")

    salutation = f"Good morning, {user_name}!" if user_name else "Daily Financial Briefing"
    cg = status_data.get("cashflow_guardian", {})

    safe_spend_amt = kpis.get("adjusted_safe_to_spend_daily") or kpis.get("safe_to_spend_daily", 0.0)
    pacing_tag = kpis.get("weekend_pacing_label", "Standard")
    yesterday_spend = kpis.get("yesterday_total_spend", 0.0)
    yesterday_feedback = kpis.get("yesterday_recap_feedback", "On track")
    proj_7d = cg.get("projected_7d_balance", kpis.get("projected_7d_balance", 0.0))
    runway_status = str(cg.get("deficit_severity", "healthy")).upper()

    lines = [
        f"🔔 *{salutation}*",
        f"📅 _{dt_str}_",
        "━━━━━━━━━━━━━━━━━━━━━",
        f"💰 *Liquid Cash:* ₹{kpis.get('liquid_balance', 0.0):,.2f}",
        f"🛡️ *Uncommitted Cushion:* ₹{kpis.get('uncommitted_balance', 0.0):,.2f}",
        f"⚡ *Safe-to-Spend Today:* ₹{safe_spend_amt:,.2f} ({pacing_tag})",
        f"📊 *Yesterday's Spend:* ₹{yesterday_spend:,.2f} ({yesterday_feedback})",
        f"🛫 *7-Day Cashflow Runway:* ₹{proj_7d:,.2f} [{runway_status}]",
        "",
    ]

    # Cashflow Deficit Alert section
    if cg.get("has_deficit"):
        icon = "🚨" if cg.get("deficit_severity") == "critical" else "⚠️"
        lines.append(f"{icon} *CASHFLOW DEFICIT GUARDIAN:*")
        lines.append(f"• {cg.get('warning_message')}")
        lines.append(f"• 💡 *Action:* {cg.get('suggested_action')}\n")

    # Overdue section
    overdue_list = bills.get("overdue_bills", [])
    if overdue_list:
        lines.append(f"🚨 *OVERDUE BILLS ({len(overdue_list)}):*")
        for b in overdue_list:
            lines.append(f"• 🔴 *{b['name']}*: ₹{b['amount']:,.2f} ({b['label']})")
        lines.append("")

    # Due Today section
    due_today_list = bills.get("due_today_bills", [])
    if due_today_list:
        lines.append(f"📅 *DUE TODAY ({len(due_today_list)}):*")
        for b in due_today_list:
            lines.append(f"• ⚠️ *{b['name']}*: ₹{b['amount']:,.2f} (DUE TODAY)")
        lines.append("")

    # Upcoming 7 days section
    upcoming_list = bills.get("upcoming_7d_bills", [])
    if upcoming_list:
        lines.append(f"🗓️ *Upcoming in Next 7 Days ({len(upcoming_list)}):*")
        for b in upcoming_list:
            lines.append(f"• 🟡 *{b['name']}*: ₹{b['amount']:,.2f} ({b['label']})")
        lines.append("")
    elif not overdue_list and not due_today_list:
        lines.append("✅ *Bills Status:* All clear! No pending bills due in the next 7 days.\n")

    # Budget warnings
    warnings_list = bw.get("warnings", [])
    if warnings_list:
        lines.append(f"📊 *Budget Oversight Alerts ({len(warnings_list)}):*")
        for w in warnings_list[:4]:
            icon = "🚨" if w["severity"] == "critical" else "⚠️"
            lines.append(f"• {icon} *{w['category']}*: {w['message']}")
        lines.append("")
    else:
        lines.append("✅ *Budgets:* All categories spending within monthly targets.\n")

    # AI coaching insight
    if ai_insight:
        lines.append("🤖 *Copilot Daily Micro-Coaching:*")
        lines.append(f"_{ai_insight}_")

    return "\n".join(lines)


def build_bills_inline_keyboard(bills_list: List[Dict[str, Any]]) -> Optional[dict]:
    """
    Builds a Telegram InlineKeyboardMarkup containing 1-tap settlement buttons.
    """
    keyboard = []
    # Add 1-tap Pay & Log buttons for up to 3 bills
    for b in bills_list[:3]:
        keyboard.append([
            {
                "text": f"✅ Pay & Log: {b['name']} (₹{b['amount']:,.0f})",
                "callback_data": f"settle_bill:{b['id']}",
            }
        ])

    keyboard.append([
        {"text": "📊 Today's Status", "callback_data": "daily_status"},
        {"text": "📅 View Pending Dues", "callback_data": "pending_bills"},
    ])
    return {"inline_keyboard": keyboard}


def format_pending_bills_telegram_message(status_data: Dict[str, Any]) -> tuple[str, Optional[dict]]:
    """
    Formats a dedicated pending & overdue bills list with inline settlement buttons.
    """
    bills = status_data.get("bills", {})
    overdue_list = bills.get("overdue_bills", [])
    due_today_list = bills.get("due_today_bills", [])
    upcoming_list = bills.get("upcoming_7d_bills", [])

    lines = [
        "📅 *Pending Bills & Reminders*",
        "━━━━━━━━━━━━━━━━━━━━━",
    ]

    actionable_bills = []

    if overdue_list:
        lines.append(f"🚨 *OVERDUE INVOICES ({len(overdue_list)}):*")
        for b in overdue_list:
            lines.append(f"• 🔴 *{b['name']}*: ₹{b['amount']:,.2f} ({b['label']}) [ID: {b['id']}]")
            actionable_bills.append(b)
        lines.append("")

    if due_today_list:
        lines.append(f"📅 *DUE TODAY ({len(due_today_list)}):*")
        for b in due_today_list:
            lines.append(f"• ⚠️ *{b['name']}*: ₹{b['amount']:,.2f} (DUE TODAY) [ID: {b['id']}]")
            actionable_bills.append(b)
        lines.append("")

    if upcoming_list:
        lines.append(f"🗓️ *Upcoming in Next 7 Days ({len(upcoming_list)}):*")
        for b in upcoming_list:
            lines.append(f"• 🟡 *{b['name']}*: ₹{b['amount']:,.2f} ({b['label']}) [ID: {b['id']}]")
            actionable_bills.append(b)
        lines.append("")

    if not overdue_list and not due_today_list and not upcoming_list:
        lines.append("✅ *All caught up!* No bills due in the next 7 days.")
        lines.append(f"• Total settled bills this month: {bills.get('settled_count', 0)}")
        return "\n".join(lines), None

    lines.append("💡 _Tap a button below to settle the bill and auto-record it to your expenses ledger!_")
    reply_markup = build_bills_inline_keyboard(actionable_bills)
    return "\n".join(lines), reply_markup


def find_matching_bill(
    db: Session,
    tenant_id: str,
    search_term: str = "",
    amount: Optional[float] = None,
) -> Optional[models.Bill]:
    """
    Intelligently finds a matching pending/overdue bill for a tenant.
    Supports semantic aliases (e.g. wifi -> broadband, eb -> electricity)
    and fallback to amount matching.
    """
    bills = (
        db.query(models.Bill)
        .filter(models.Bill.tenant_id == tenant_id, models.Bill.status != "Paid")
        .all()
    )
    if not bills:
        return None

    term = (search_term or "").strip().lower()

    # Expand aliases
    aliases = {
        "wifi": ["broadband", "internet", "fiber", "act", "airtel", "hathway", "jio"],
        "broadband": ["wifi", "internet", "fiber"],
        "internet": ["wifi", "broadband", "fiber"],
        "electricity": ["power", "eb", "tneb", "bescom", "current", "electric"],
        "power": ["electricity", "eb", "current"],
        "current": ["electricity", "power", "eb"],
        "gym": ["fitness", "cult", "membership", "workout"],
        "rent": ["house rent", "flat rent", "pg rent"],
        "recharge": ["mobile", "phone", "airtel", "jio", "vi"],
        "mobile": ["recharge", "phone", "cell"],
        "phone": ["mobile", "recharge"],
    }

    search_keys = [term]
    if term in aliases:
        search_keys.extend(aliases[term])

    # 1. Direct name match or alias match
    for b in bills:
        b_name = (b.name or "").lower()
        for k in search_keys:
            if len(k) >= 3 and (k in b_name or b_name in k):
                return b

    # 2. Amount match (exact or within ₹5)
    if amount and amount > 0:
        for b in bills:
            if abs(float(b.amount or 0.0) - amount) < 5.0:
                return b

    # 3. If user only has 1 pending bill and said "paid my bill"
    if len(bills) == 1 and not term:
        return bills[0]

    return None


def add_recurring_bill(
    db: Session,
    tenant_id: str,
    name: str,
    amount: float,
    due_day: int = 1,
    category: str = "Utilities",
) -> Dict[str, Any]:
    """
    Adds a new recurring bill and returns its calculated timeline.
    """
    clean_day = min(max(int(due_day or 1), 1), 28)
    clean_amt = max(1.0, float(amount or 0.0))
    clean_name = str(name or "Recurring Bill").strip().title()

    new_bill = models.Bill(
        name=clean_name,
        amount=clean_amt,
        due_day=clean_day,
        status="Pending",
        tenant_id=tenant_id,
    )
    db.add(new_bill)
    db.commit()
    db.refresh(new_bill)

    timeline = calculate_bill_timeline(new_bill.due_day, new_bill.status)

    return {
        "success": True,
        "bill": {
            "id": new_bill.id,
            "name": new_bill.name,
            "amount": float(new_bill.amount),
            "due_day": new_bill.due_day,
            "status": new_bill.status,
            "next_due_date": timeline["next_due_date"],
            "label": timeline["label"],
        },
    }


def send_tenant_daily_briefing(db: Session, tenant_id: str) -> Dict[str, Any]:
    """
    Gathers daily status and dispatches Telegram notification with inline action buttons
    to the tenant's linked chat_id.
    """
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    user = db.query(models.User).filter(models.User.id == tenant_id).first()
    if not user or not user.telegram_chat_id:
        return {"success": False, "message": "No linked Telegram Chat ID found for this account."}

    if not token:
        return {"success": False, "message": "TELEGRAM_BOT_TOKEN not configured in environment."}

    status_data = get_tenant_reminders_and_status(db, str(tenant_id))
    user_name = user.email.split("@")[0].capitalize() if user.email else ""
    message_text = format_daily_status_telegram_message(status_data, user_name)

    # Attach interactive inline buttons for top actionable dues
    actionable_bills = status_data["bills"].get("overdue_bills", []) + status_data["bills"].get("due_today_bills", [])
    reply_markup = build_bills_inline_keyboard(actionable_bills) if actionable_bills else {
        "inline_keyboard": [
            [{"text": "📊 Today's Status", "callback_data": "daily_status"}],
            [{"text": "📅 View Pending Dues", "callback_data": "pending_bills"}],
        ]
    }

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": user.telegram_chat_id,
        "text": message_text,
        "parse_mode": "Markdown",
        "reply_markup": reply_markup,
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        res_json = resp.json()
        if res_json.get("ok"):
            return {
                "success": True,
                "message": "Daily briefing dispatched successfully to Telegram with interactive action buttons.",
                "chat_id": user.telegram_chat_id,
            }
        else:
            return {
                "success": False,
                "message": f"Telegram API error: {res_json.get('description')}",
            }
    except Exception as e:
        return {"success": False, "message": f"Failed to deliver message: {str(e)}"}
