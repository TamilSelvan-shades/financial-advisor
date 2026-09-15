"""
autonomous_agent.py - Autonomous Financial Agent ("The Ghost Accountant" & Budget Guardrails)
Provides:
  1. Auto-Sweep Simulator (surplus cash swept to goal buckets / high-yield investments)
  2. Dynamic Budget Guardrails (proactive 80% warning and 100% critical alerts with run-rate projections)
  3. Micro-Savings / Round-Up Simulator (spare-change rounding to ₹50/₹100 + 1-yr / 5-yr projections)
  4. Autonomous Rule Evaluator & Action Logger
"""

import calendar
import datetime
import json
import math
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

import models


DEFAULT_RULES = {
    "auto_sweep": {
        "is_enabled": True,
        "buffer_threshold": 50000.0,
        "target_destination": "Emergency Cushion Fund",
        "expected_yield_pct": 7.1,
    },
    "budget_guardrail": {
        "is_enabled": True,
        "warning_threshold_pct": 80.0,
        "critical_threshold_pct": 100.0,
    },
    "round_up": {
        "is_enabled": True,
        "round_up_step": 50.0,
        "target_goal": "Micro-Savings Jar",
    },
}


def get_or_create_rules(db: Session, tenant_id: str) -> Dict[str, Dict[str, Any]]:
    """
    Fetches user's configured autonomous rules, initializing defaults if absent.
    """
    rules = db.query(models.AutonomousRule).filter(models.AutonomousRule.tenant_id == tenant_id).all()
    existing_map = {r.rule_type: r for r in rules}

    result = {}
    for rule_type, default_cfg in DEFAULT_RULES.items():
        if rule_type in existing_map:
            db_rule = existing_map[rule_type]
            try:
                cfg = json.loads(db_rule.config_json)
            except Exception:
                cfg = {}
            merged = {**default_cfg, **cfg, "is_enabled": db_rule.is_enabled}
            result[rule_type] = merged
        else:
            # Create default record
            new_rule = models.AutonomousRule(
                tenant_id=tenant_id,
                rule_type=rule_type,
                is_enabled=default_cfg["is_enabled"],
                config_json=json.dumps(default_cfg),
            )
            db.add(new_rule)
            result[rule_type] = default_cfg

    try:
        db.commit()
    except Exception:
        db.rollback()

    return result


def update_rule_config(
    db: Session,
    tenant_id: str,
    rule_type: str,
    is_enabled: bool,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Saves or updates an autonomous rule configuration.
    """
    rule = (
        db.query(models.AutonomousRule)
        .filter(models.AutonomousRule.tenant_id == tenant_id, models.AutonomousRule.rule_type == rule_type)
        .first()
    )
    if rule:
        rule.is_enabled = is_enabled
        rule.config_json = json.dumps(config)
    else:
        rule = models.AutonomousRule(
            tenant_id=tenant_id,
            rule_type=rule_type,
            is_enabled=is_enabled,
            config_json=json.dumps(config),
        )
        db.add(rule)

    db.commit()
    db.refresh(rule)
    return {
        "rule_type": rule.rule_type,
        "is_enabled": rule.is_enabled,
        "config": config,
    }


def evaluate_auto_sweep(
    liquid_balance: float,
    rule_cfg: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Simulates auto-sweep of surplus liquid cash above the safety buffer.
    """
    buffer_threshold = float(rule_cfg.get("buffer_threshold", 50000.0))
    target_dest = str(rule_cfg.get("target_destination", "Emergency Cushion Fund"))
    yield_pct = float(rule_cfg.get("expected_yield_pct", 7.1))
    is_enabled = bool(rule_cfg.get("is_enabled", True))

    surplus = max(0.0, round(liquid_balance - buffer_threshold, 2))
    annual_yield_gain = round(surplus * (yield_pct / 100.0), 2)

    has_surplus = surplus > 1000.0  # Min threshold to trigger sweep
    if has_surplus and is_enabled:
        recommendation = (
            f"Surplus liquidity of ₹{surplus:,.0f} detected above your ₹{buffer_threshold:,.0f} safety cushion. "
            f"Autonomous sweep can transfer ₹{surplus:,.0f} into '{target_dest}' to generate ~₹{annual_yield_gain:,.0f}/yr in liquid yield."
        )
    else:
        recommendation = f"Checking balance is within safety buffer (Buffer: ₹{buffer_threshold:,.0f}). No sweep necessary."

    return {
        "rule_type": "auto_sweep",
        "is_enabled": is_enabled,
        "liquid_balance": liquid_balance,
        "buffer_threshold": buffer_threshold,
        "surplus_amount": surplus,
        "target_destination": target_dest,
        "expected_yield_pct": yield_pct,
        "annual_yield_gain": annual_yield_gain,
        "has_surplus": has_surplus,
        "recommendation": recommendation,
    }


def evaluate_budget_guardrails(
    db: Session,
    tenant_id: str,
    rule_cfg: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Evaluates monthly category spending velocity against budget limits.
    Triggers Yellow alerts (80%) and Red alerts (100% breach) with run-rate projections.
    """
    is_enabled = bool(rule_cfg.get("is_enabled", True))
    if not is_enabled:
        return []

    warning_threshold = float(rule_cfg.get("warning_threshold_pct", 80.0))
    critical_threshold = float(rule_cfg.get("critical_threshold_pct", 100.0))

    today = datetime.date.today()
    current_month_prefix = today.strftime("%Y-%m")
    _, days_in_month = calendar.monthrange(today.year, today.month)
    days_elapsed = max(1, today.day)
    days_remaining = max(0, days_in_month - today.day)

    budgets = db.query(models.Budget).filter(models.Budget.tenant_id == tenant_id).all()
    guardrails: List[Dict[str, Any]] = []

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
        spent_pct = round((spent / limit) * 100.0, 1)

        # Projected run-rate spend by end of month
        daily_rate = spent / days_elapsed
        projected_month_end_spend = round(daily_rate * days_in_month, 2)
        projected_overage = max(0.0, round(projected_month_end_spend - limit, 2))

        severity = None
        title = ""
        message = ""

        if spent >= limit:
            severity = "critical"
            overage = round(spent - limit, 2)
            title = f"Red Guardrail: Category '{b.category}' Exceeded"
            message = (
                f"🚨 Spent ₹{spent:,.0f} of ₹{limit:,.0f} limit ({spent_pct:.0f}%). "
                f"Breached by ₹{overage:,.0f}! At current run-rate, projected month total is ₹{projected_month_end_spend:,.0f}."
            )
        elif spent_pct >= warning_threshold:
            severity = "warning"
            title = f"Yellow Guardrail: Category '{b.category}' at {spent_pct:.0f}%"
            message = (
                f"⚠️ Spent ₹{spent:,.0f} of ₹{limit:,.0f} limit ({spent_pct:.0f}%) with {days_remaining} days remaining. "
                f"Projected month-end spend is ₹{projected_month_end_spend:,.0f} (potential ₹{projected_overage:,.0f} breach)."
            )

        if severity:
            guardrails.append({
                "category": b.category,
                "monthly_limit": limit,
                "spent_amount": spent,
                "spent_pct": spent_pct,
                "days_remaining": days_remaining,
                "projected_month_end_spend": projected_month_end_spend,
                "projected_overage": projected_overage,
                "severity": severity,
                "title": title,
                "message": message,
            })

    # Sort: critical first, then highest spent_pct
    guardrails.sort(key=lambda x: (x["severity"] == "critical", x["spent_pct"]), reverse=True)
    return guardrails


def evaluate_micro_savings_roundups(
    db: Session,
    tenant_id: str,
    rule_cfg: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Simulates spare-change round-ups (to nearest ₹50 or ₹100) on recent transactions.
    Computes accrued micro-savings and 1-yr / 5-yr growth projections.
    """
    is_enabled = bool(rule_cfg.get("is_enabled", True))
    step = float(rule_cfg.get("round_up_step", 50.0))
    target_goal = str(rule_cfg.get("target_goal", "Micro-Savings Jar"))

    today = datetime.date.today()
    thirty_days_ago = (today - datetime.timedelta(days=30)).strftime("%Y-%m-%d")

    expenses = (
        db.query(models.Expense)
        .filter(models.Expense.tenant_id == tenant_id, models.Expense.date >= thirty_days_ago)
        .all()
    )

    total_spare_change = 0.0
    qualifying_count = 0
    sampled_transactions: List[Dict[str, Any]] = []

    for e in expenses:
        amt = float(e.amount or 0.0)
        if amt <= 0.0:
            continue

        ceil_target = math.ceil(amt / step) * step
        spare = round(ceil_target - amt, 2)
        if spare > 0.0:
            total_spare_change += spare
            qualifying_count += 1
            if len(sampled_transactions) < 4:
                sampled_transactions.append({
                    "description": e.description or "Transaction",
                    "original_amount": amt,
                    "rounded_amount": ceil_target,
                    "spare_change": spare,
                    "date": e.date,
                })

    total_spare_change = round(total_spare_change, 2)
    avg_spare = round(total_spare_change / qualifying_count, 2) if qualifying_count > 0 else 0.0

    # 12-Month & 5-Year compound projection (assuming 10% CAGR in index/equity)
    monthly_accrual = total_spare_change if total_spare_change > 0 else 1250.0
    projected_12m = round(monthly_accrual * 12.0, 2)

    # Future value of monthly SIP: P * [((1+r)^n - 1) / r] * (1+r)
    monthly_r = 0.10 / 12.0
    months_5y = 60
    fv_5y = monthly_accrual * (((1.0 + monthly_r) ** months_5y - 1.0) / monthly_r) * (1.0 + monthly_r)
    projected_5y = round(fv_5y, 2)

    return {
        "rule_type": "round_up",
        "is_enabled": is_enabled,
        "round_up_step": step,
        "target_goal": target_goal,
        "monthly_accrued_savings": total_spare_change,
        "qualifying_transactions_count": qualifying_count,
        "average_spare_per_txn": avg_spare,
        "projected_12m_savings": projected_12m,
        "projected_5y_compound_savings": projected_5y,
        "sampled_transactions": sampled_transactions,
        "summary": (
            f"Accumulated ₹{total_spare_change:,.0f} in spare change across {qualifying_count} transactions (rounded to ₹{step:.0f}). "
            f"Projected to compound into ₹{projected_12m:,.0f} in 1 year and ₹{projected_5y:,.0f} in 5 years."
        ),
    }


def run_autonomous_agent_cycle(
    db: Session,
    tenant_id: str,
) -> Dict[str, Any]:
    """
    Executes a full cycle of the Autonomous Financial Agent:
      1. Loads & parses rules
      2. Computes liquid balance
      3. Evaluates Auto-Sweep
      4. Evaluates Budget Guardrails
      5. Evaluates Micro-Savings Round-Ups
      6. Emits non-duplicate action logs to database
    """
    rules = get_or_create_rules(db, tenant_id)

    # Current liquid balance calculation
    all_accounts = db.query(models.Account).filter(models.Account.tenant_id == tenant_id).all()
    all_adjustments = db.query(models.BalanceAdjustment).filter(models.BalanceAdjustment.tenant_id == tenant_id).all()
    all_incomes = db.query(models.Income).filter(models.Income.tenant_id == tenant_id).all()
    all_expenses = db.query(models.Expense).filter(models.Expense.tenant_id == tenant_id).all()

    tot_acc = sum(float(a.initial_balance or 0.0) for a in all_accounts)
    tot_adj = sum(float(ba.amount or 0.0) for ba in all_adjustments)
    tot_inc = sum(float(i.amount or 0.0) for i in all_incomes)
    tot_exp = sum(float(e.amount or 0.0) for e in all_expenses)
    liquid_balance = max(0.0, round(tot_acc + tot_inc - tot_exp + tot_adj, 2))

    # 1. Sweep Evaluation
    sweep_eval = evaluate_auto_sweep(liquid_balance, rules.get("auto_sweep", {}))

    # 2. Guardrails Evaluation
    guardrails_eval = evaluate_budget_guardrails(db, tenant_id, rules.get("budget_guardrail", {}))

    # 3. Round-Up Evaluation
    roundup_eval = evaluate_micro_savings_roundups(db, tenant_id, rules.get("round_up", {}))

    # Emit Action Logs to database (de-duplicated against existing active logs)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    active_logs = (
        db.query(models.AutonomousActionLog)
        .filter(models.AutonomousActionLog.tenant_id == tenant_id, models.AutonomousActionLog.status == "active")
        .all()
    )
    existing_titles = {log.title for log in active_logs}

    new_logs_created = 0

    # Auto-Sweep Action
    if sweep_eval["has_surplus"] and sweep_eval["is_enabled"]:
        title = f"Auto-Sweep Opportunity: ₹{sweep_eval['surplus_amount']:,.0f} Available"
        if title not in existing_titles:
            log = models.AutonomousActionLog(
                tenant_id=tenant_id,
                created_at=now_str,
                rule_type="auto_sweep",
                action_type="simulated_transfer",
                title=title,
                message=sweep_eval["recommendation"],
                amount=sweep_eval["surplus_amount"],
                status="active",
            )
            db.add(log)
            new_logs_created += 1

    # Guardrails Alerts
    for g in guardrails_eval:
        if g["title"] not in existing_titles:
            log = models.AutonomousActionLog(
                tenant_id=tenant_id,
                created_at=now_str,
                rule_type="budget_guardrail",
                action_type="alert",
                title=g["title"],
                message=g["message"],
                amount=g["spent_amount"],
                status="active",
            )
            db.add(log)
            new_logs_created += 1

    # Round-up accumulation notification
    if roundup_eval["is_enabled"] and roundup_eval["monthly_accrued_savings"] > 200.0:
        roundup_title = f"Micro-Savings Milestone: ₹{roundup_eval['monthly_accrued_savings']:,.0f} Accumulated"
        if roundup_title not in existing_titles:
            log = models.AutonomousActionLog(
                tenant_id=tenant_id,
                created_at=now_str,
                rule_type="round_up",
                action_type="recommendation",
                title=roundup_title,
                message=roundup_eval["summary"],
                amount=roundup_eval["monthly_accrued_savings"],
                status="active",
            )
            db.add(log)
            new_logs_created += 1

    if new_logs_created > 0:
        db.commit()

    # Fetch updated action logs (latest 15)
    action_logs = (
        db.query(models.AutonomousActionLog)
        .filter(models.AutonomousActionLog.tenant_id == tenant_id)
        .order_by(models.AutonomousActionLog.id.desc())
        .limit(15)
        .all()
    )

    return {
        "status": "success",
        "evaluated_at": now_str,
        "liquid_balance": liquid_balance,
        "rules": rules,
        "auto_sweep": sweep_eval,
        "budget_guardrails": {
            "active_breaches_count": len(guardrails_eval),
            "guardrails": guardrails_eval,
        },
        "micro_savings": roundup_eval,
        "new_actions_emitted": new_logs_created,
        "action_logs": [
            {
                "id": l.id,
                "created_at": l.created_at,
                "rule_type": l.rule_type,
                "action_type": l.action_type,
                "title": l.title,
                "message": l.message,
                "amount": l.amount,
                "status": l.status,
            }
            for l in action_logs
        ],
    }
