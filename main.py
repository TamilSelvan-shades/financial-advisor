import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from contextlib import asynccontextmanager
import datetime
import hashlib
import hmac
import json
import os
import threading
import time
from typing import Any, Dict, List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
load_dotenv()

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse, Response
from google import genai
from google.genai import types
import requests
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from database import SessionLocal, engine, get_db
import models
import schemas
import auth
import billing
import dependencies
import loan_math
import simulation_engine
import anomaly_detector
import universal_statement_parser
import receipt_scanner
import voice_ledger
import forex_service
import tax_engine
import executive_digest
import autonomous_agent
import reminder_service
import recurring_radar
import telegram_listener
import whatsapp_service
import notification_dispatcher
import re
import uuid
from fastapi.security import OAuth2PasswordRequestForm

# --- Step 1: Detect & Drop any obsolete prototype tables lacking 'id' ---
try:
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    tables_requiring_id = [
        "budgets",
        "loans",
        "investments",
        "goals",
        "bills",
        "credit_scores",
        "expenses",
        "incomes",
        "accounts",
        "balance_adjustments",
        "profile",
    ]

    with engine.connect() as conn:
        for tbl in tables_requiring_id:
            if tbl in existing_tables:
                cols = {c["name"] for c in inspector.get_columns(tbl)}
                if "id" not in cols:
                    print(
                        f"Table '{tbl}' lacks required primary key 'id'. Dropping obsolete table..."
                    )
                    conn.execute(text(f'DROP TABLE IF EXISTS "{tbl}" CASCADE;'))
        conn.commit()
except Exception as e:
    print(f"Pre-migration warning: {e}")

# --- Step 2: Create all tables (creates missing & newly dropped tables cleanly) ---
models.Base.metadata.create_all(bind=engine)

# --- Step 3: Auto-patch any missing columns on existing tables ---
MIGRATION_COLUMNS = {
    "expenses": [
        ("date", "VARCHAR(50)"),
        ("category", "VARCHAR(100)"),
        ("amount", "FLOAT DEFAULT 0.0"),
        ("description", "VARCHAR(255) DEFAULT ''"),
        ("account", "VARCHAR(100) DEFAULT 'ICICI Savings Account'"),
        ("remarks", "TEXT DEFAULT ''"),
        ("tenant_id", "UUID"),
    ],
    "incomes": [
        ("date", "VARCHAR(50)"),
        ("category", "VARCHAR(100)"),
        ("amount", "FLOAT DEFAULT 0.0"),
        ("account", "VARCHAR(100) DEFAULT 'ICICI Savings Account'"),
        ("description", "VARCHAR(255) DEFAULT ''"),
        ("remarks", "TEXT DEFAULT ''"),
        ("tenant_id", "UUID"),
    ],
    "accounts": [
        ("name", "VARCHAR(100)"),
        ("account_type", "VARCHAR(50) DEFAULT 'Bank Account'"),
        ("initial_balance", "FLOAT DEFAULT 0.0"),
        ("tenant_id", "UUID"),
    ],
    "balance_adjustments": [
        ("date", "VARCHAR(50)"),
        ("account", "VARCHAR(100)"),
        ("amount", "FLOAT DEFAULT 0.0"),
        ("reason", "VARCHAR(255) DEFAULT ''"),
        ("tenant_id", "UUID"),
    ],
    "loans": [
        ("name", "VARCHAR(100)"),
        ("principal", "FLOAT DEFAULT 0.0"),
        ("interest_rate", "FLOAT DEFAULT 8.5"),
        ("tenure_years", "FLOAT DEFAULT 20.0"),
        ("extra_prepayment", "FLOAT DEFAULT 0.0"),
        ("sanctioned_amount", "FLOAT DEFAULT NULL"),
        ("emi", "FLOAT DEFAULT NULL"),
        ("tenant_id", "UUID"),
    ],
    "investments": [
        ("name", "VARCHAR(100)"),
        ("category", "VARCHAR(100) DEFAULT 'Mutual Funds'"),
        ("current_value", "FLOAT DEFAULT 0.0"),
        ("tenant_id", "UUID"),
    ],
    "budgets": [
        ("category", "VARCHAR(100)"),
        ("monthly_limit", "FLOAT DEFAULT 5000.0"),
        ("tenant_id", "UUID"),
    ],
    "goals": [
        ("name", "VARCHAR(100)"),
        ("target_amount", "FLOAT DEFAULT 0.0"),
        ("current_amount", "FLOAT DEFAULT 0.0"),
        ("target_date", "VARCHAR(50) DEFAULT ''"),
        ("tenant_id", "UUID"),
    ],
    "bills": [
        ("name", "VARCHAR(100)"),
        ("amount", "FLOAT DEFAULT 0.0"),
        ("due_day", "INTEGER DEFAULT 1"),
        ("status", "VARCHAR(50) DEFAULT 'Pending'"),
        ("tenant_id", "UUID"),
    ],
    "credit_scores": [
        ("score", "INTEGER DEFAULT 750"),
        ("date", "VARCHAR(50) DEFAULT ''"),
        ("rating", "VARCHAR(50) DEFAULT 'Excellent'"),
        ("tenant_id", "UUID"),
    ],
    "profile": [
        ("key", "VARCHAR(100)"),
        ("value", "TEXT DEFAULT ''"),
        ("tenant_id", "UUID"),
    ],
    "users": [
        ("telegram_chat_id", "VARCHAR(100)"),
        ("whatsapp_phone_number", "VARCHAR(100)"),
        ("notification_channel", "VARCHAR(50) DEFAULT 'both'"),
        ("preferred_briefing_time", "VARCHAR(20) DEFAULT '08:00'"),
        ("telegram_link_token", "VARCHAR(100)"),
    ],
}

try:
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    for tbl, cols in MIGRATION_COLUMNS.items():
        if tbl in existing_tables:
            existing_cols = {c["name"] for c in inspector.get_columns(tbl)}
            for col_name, col_type in cols:
                if col_name not in existing_cols:
                    try:
                        with engine.connect() as conn:
                            conn.execute(
                                text(
                                    f'ALTER TABLE "{tbl}" ADD COLUMN "{col_name}" {col_type};'
                                )
                            )
                            conn.commit()
                            print(f"Auto-migrated: Added {col_name} to {tbl}")
                    except Exception as col_err:
                        print(f"Migration note ({tbl}.{col_name}): {col_err}")
except Exception as e:
    print(f"Post-migration warning: {e}")

load_dotenv()

# --- Configuration & Credentials ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_WEBHOOK_SECRET = os.getenv(
    "TELEGRAM_WEBHOOK_SECRET", "default-telegram-secret"
)

ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# --- Background Worker Functions ---

def send_telegram_alert(message_text: str, chat_id: str, reply_markup: dict = None):
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message_text,
        "parse_mode": "Markdown",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Failed to dispatch Telegram alert: {e}")

def check_budget_threshold_alert(
    db: Session, category_name: str, tenant_id: str
) -> Optional[str]:
    budget = (
        db.query(models.Budget)
        .filter(func.lower(models.Budget.category) == category_name.lower(), models.Budget.tenant_id == tenant_id)
        .first()
    )
    if not budget or not budget.monthly_limit or budget.monthly_limit <= 0:
        return None

    current_month_prefix = datetime.date.today().strftime("%Y-%m")
    spent = (
        db.query(func.sum(models.Expense.amount))
        .filter(
            func.lower(models.Expense.category) == budget.category.lower(),
            models.Expense.date.like(f"{current_month_prefix}%"),
            models.Expense.tenant_id == tenant_id
        )
        .scalar()
        or 0.0
    )

    pct = (spent / budget.monthly_limit) * 100
    if spent > budget.monthly_limit:
        return (
            f"🚨 *Budget Exceeded!*\n"
            f"You have exceeded your monthly limit for *{budget.category}*!\n"
            f"• Spent: ₹{spent:,.2f}\n"
            f"• Limit: ₹{budget.monthly_limit:,.2f} ({pct:.0f}%)"
        )
    elif pct >= 90.0:
        return (
            f"⚠️ *Budget Warning (90% Reached)!*\n"
            f"• Category: *{budget.category}*\n"
            f"• Spent: ₹{spent:,.2f} of ₹{budget.monthly_limit:,.2f} ({pct:.1f}%)"
        )
    return None

def scheduled_financial_health_check():
    import notification_dispatcher
    db = SessionLocal()
    try:
        users = (
            db.query(models.User)
            .filter(models.User.is_active == True)
            .all()
        )
        for user in users:
            try:
                notification_dispatcher.dispatch_daily_briefing(db, user)
            except Exception as u_err:
                print(f"Error generating daily briefing for tenant {user.id}: {u_err}")
    finally:
        db.close()


def async_process_telegram_message(user_text: str, tenant_id: str, chat_id: str):
    if not ai_client:
        return

    db = SessionLocal()
    today = datetime.date.today().strftime("%Y-%m-%d")
    user_clean = user_text.strip().lower()

    # Fast-path command handlers
    if user_clean in ["/status", "status", "daily status", "today status"]:
        status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
        msg = reminder_service.format_daily_status_telegram_message(status_data)
        actionable_bills = status_data["bills"].get("overdue_bills", []) + status_data["bills"].get("due_today_bills", [])
        markup = reminder_service.build_bills_inline_keyboard(actionable_bills)
        db.close()
        send_telegram_alert(msg, chat_id, reply_markup=markup)
        return

    if user_clean in ["/bills", "bills", "pending bills", "due bills"]:
        status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
        msg, markup = reminder_service.format_pending_bills_telegram_message(status_data)
        db.close()
        send_telegram_alert(msg, chat_id, reply_markup=markup)
        return

    # Fast-path: Radar
    if user_clean in ["/radar", "radar", "discover subscriptions", "untracked bills", "detected bills", "find bills"]:
        disc = recurring_radar.discover_recurring_charges(db, str(tenant_id))
        msg, markup = telegram_listener.format_discovered_subscriptions_telegram(disc)
        db.close()
        send_telegram_alert(msg, chat_id, reply_markup=markup)
        return

    # Fast-path: What-If Affordability
    afford_match = re.search(r"(?:can\s+(?:i|we)\s+afford|afford)\s+(?:a\s+|an\s+)?(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:for\s+a\s+|for\s+|on\s+a\s+|on\s+)?([a-zA-Z\s]+)?", user_clean)
    if afford_match:
        raw_amt = afford_match.group(1).replace(",", "")
        raw_name = (afford_match.group(2) or "Purchase").strip().title()
        try:
            amt = float(raw_amt)
            msg = telegram_listener.handle_what_if_scenario(db, str(tenant_id), {
                "scenario_type": "affordability",
                "amount": amt,
                "name": raw_name,
            })
            db.close()
            send_telegram_alert(msg, chat_id)
            return
        except Exception:
            pass

    # Fast-path: What-If EMI
    if "emi" in user_clean and any(kw in user_clean for kw in ["buy", "laptop", "car", "phone", "tv", "purchase", "what if", "get"]):
        amt_match = re.search(r"(?:₹|rs\.?|inr)?\s*([\d,]+)", user_clean)
        mo_match = re.search(r"(\d+)\s*(?:month|mo)", user_clean)
        amt = float(amt_match.group(1).replace(",", "")) if amt_match else 50000.0
        tenure = int(mo_match.group(1)) if mo_match else 6
        name = "Purchased Item"
        for candidate in ["laptop", "phone", "tv", "car", "bike", "refrigerator", "iphone", "macbook"]:
            if candidate in user_clean:
                name = candidate.capitalize()
                break
        msg = telegram_listener.handle_what_if_scenario(db, str(tenant_id), {
            "scenario_type": "emi",
            "amount": amt,
            "tenure_months": tenure,
            "annual_interest_rate": 0.0 if "no cost" in user_clean else 12.0,
            "name": name,
        })
        db.close()
        send_telegram_alert(msg, chat_id)
        return

    # Fast-path: What-If Prepayment
    prepay_match = re.search(r"prepay\s+(?:₹|rs\.?|inr)?\s*([\d,]+)", user_clean)
    if prepay_match:
        amt = float(prepay_match.group(1).replace(",", ""))
        loan_name = "Car Loan" if "car" in user_clean else ("Home Loan" if "home" in user_clean else "Loan")
        msg = telegram_listener.handle_what_if_scenario(db, str(tenant_id), {
            "scenario_type": "prepayment",
            "amount": amt,
            "name": loan_name,
        })
        db.close()
        send_telegram_alert(msg, chat_id)
        return

    total_assets = (
        db.query(func.sum(models.Investment.current_value)).filter(models.Investment.tenant_id == tenant_id).scalar() or 0.0
    )
    total_debt = db.query(func.sum(models.Loan.principal)).filter(models.Loan.tenant_id == tenant_id).scalar() or 0.0
    context = f"Net Worth: ₹{total_assets - total_debt:,.2f} (Assets: ₹{total_assets:,.2f}, Debt: ₹{total_debt:,.2f})"

    prompt = f"""
    You are an AI financial advisor on Telegram. Today is {today}. Context: {context}
    User Message: "{user_text}"
    
    Classify intent into pure JSON:
    1. Settle bill (e.g. "paid electricity bill 1450", "mark netflix paid", "cleared wifi 999"):
       {{"type": "settle_bill", "bill_name": "electricity", "amount": 1450.0, "account": "ICICI Savings Account"}}
    2. Add recurring bill (e.g. "remind me to pay gym 2500 on 10th", "add bill wifi 999 on 15"):
       {{"type": "add_bill", "name": "Gym Membership", "amount": 2500.0, "due_day": 10, "category": "Fitness"}}
    3. Daily status query (e.g. "what's my status today?", "how much can I spend today?", "daily status"):
       {{"type": "daily_status"}}
    4. Pending bills query (e.g. "what bills are due?", "show pending bills"):
       {{"type": "list_bills"}}
    5. Log expense:
       {{"type": "log_expense", "amount": 30.0, "description": "groceries", "category": "Groceries", "account": "ICICI Savings Account"}}
    6. Log income:
       {{"type": "log_income", "amount": 120000.0, "description": "salary", "category": "Salary", "account": "ICICI Savings Account"}}
    7. What-If Scenario simulation:
       {{"type": "what_if_scenario", "scenario_type": "affordability" | "emi" | "prepayment", "amount": 25000.0, "tenure_months": 6, "annual_interest_rate": 0.0, "name": "Vacation / Laptop"}}
    8. Discover subscriptions:
       {{"type": "discover_bills"}}
    9. Otherwise:
       {{"type": "chat", "reply": "Your markdown answer."}}
    """
    reply_markup = None
    try:
        response = ai_client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )
        cleaned = (
            response.text.strip()
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )
        data = json.loads(cleaned)
        intent = data.get("type")

        if intent == "settle_bill":
            bill_name = str(data.get("bill_name", "")).strip()
            amt = float(data.get("amount", 0.0) or 0.0)
            acc = data.get("account", "ICICI Savings Account")

            matched_bill = reminder_service.find_matching_bill(db, str(tenant_id), bill_name, amt)
            if matched_bill:
                res = reminder_service.settle_bill_with_expense(
                    db=db,
                    tenant_id=str(tenant_id),
                    bill_id=matched_bill.id,
                    auto_log_expense=True,
                    account=acc,
                )
                exp_amt = res["created_expense"]["amount"] if res.get("created_expense") else matched_bill.amount
                reply = (
                    f"✅ *Bill Settled & Recorded in Ledger!*\n"
                    f"• Bill: *{matched_bill.name}*\n"
                    f"• Amount: ₹{exp_amt:,.2f}\n"
                    f"• Account: {acc}\n"
                    f"• Status: Paid\n"
                    f"• Ledger: Expense added to Utilities & Bills"
                )
                reply_markup = {
                    "inline_keyboard": [
                        [{"text": "📊 View Updated Status", "callback_data": "daily_status"}],
                        [{"text": "📅 View Remaining Bills", "callback_data": "pending_bills"}],
                    ]
                }
            else:
                if amt > 0:
                    desc = f"Payment: {bill_name.capitalize() if bill_name else 'Bill'}"
                    db.add(models.Expense(
                        date=today,
                        description=desc,
                        amount=amt,
                        category="Utilities",
                        account=acc,
                        tenant_id=tenant_id,
                        remarks="Logged via Telegram Webhook",
                    ))
                    db.commit()
                    reply = (
                        f"✅ *Expense Logged (No Registered Bill Found):*\n"
                        f"• {desc}: ₹{amt:,.2f} (Utilities)\n"
                        f"• Account: {acc}"
                    )
                else:
                    reply = f"I couldn't find an unpaid bill matching *'{bill_name}'*."

        elif intent == "add_bill":
            name = str(data.get("name", "Recurring Bill")).strip().title()
            amt = float(data.get("amount", 0.0) or 0.0)
            due_day = int(data.get("due_day", 1) or 1)
            cat = str(data.get("category", "Utilities")).strip().title()

            res = reminder_service.add_recurring_bill(
                db=db,
                tenant_id=str(tenant_id),
                name=name,
                amount=amt,
                due_day=due_day,
                category=cat,
            )
            b_info = res["bill"]
            reply = (
                f"📅 *New Recurring Bill Tracked!*\n"
                f"• Bill: *{b_info['name']}*\n"
                f"• Amount: ₹{b_info['amount']:,.2f}\n"
                f"• Due Day: Day {b_info['due_day']} of every month\n"
                f"• Schedule: {b_info['label']} ({b_info['next_due_date']})"
            )
            reply_markup = {
                "inline_keyboard": [
                    [{"text": "📅 View All Bills", "callback_data": "pending_bills"}],
                    [{"text": "📊 View Daily Status", "callback_data": "daily_status"}],
                ]
            }

        elif intent == "daily_status":
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            reply = reminder_service.format_daily_status_telegram_message(status_data)
            actionable_bills = status_data["bills"].get("overdue_bills", []) + status_data["bills"].get("due_today_bills", [])
            reply_markup = reminder_service.build_bills_inline_keyboard(actionable_bills)

        elif intent == "list_bills":
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            reply, reply_markup = reminder_service.format_pending_bills_telegram_message(status_data)

        elif intent == "log_expense":
            category_name = data.get("category", "General").strip()
            desc = data.get("description", "Expense").capitalize()
            amt = float(data.get("amount", 0.0))
            acc = data.get("account", "ICICI Savings Account")

            db.add(
                models.Expense(
                    date=today,
                    description=desc,
                    amount=amt,
                    category=category_name,
                    account=acc,
                    tenant_id=tenant_id
                )
            )
            db.commit()
            reply = f"✅ *Logged Expense via Webhook:*\n• {desc}: ₹{amt:,.2f} ({category_name})\n• Account: {acc}"
            warning = check_budget_threshold_alert(db, category_name, tenant_id)
            if warning:
                reply += f"\n\n{warning}"

        elif intent == "log_income":
            category_name = data.get("category", "Salary").strip()
            desc = data.get("description", "Income").capitalize()
            amt = float(data.get("amount", 0.0))
            acc = data.get("account", "ICICI Savings Account")

            db.add(
                models.Income(
                    date=today,
                    description=desc,
                    amount=amt,
                    category=category_name,
                    account=acc,
                    tenant_id=tenant_id
                )
            )
            db.commit()
            reply = f"💰 *Logged Income via Webhook:*\n• {desc}: ₹{amt:,.2f} ({category_name})\n• Account: {acc}"

        elif intent == "what_if_scenario":
            reply = telegram_listener.handle_what_if_scenario(db, str(tenant_id), data)

        elif intent == "discover_bills":
            disc = recurring_radar.discover_recurring_charges(db, str(tenant_id))
            reply, reply_markup = telegram_listener.format_discovered_subscriptions_telegram(disc)

        else:
            reply = data.get("reply", "Understood.")
    except Exception as e:
        reply = f"Agent Error: {str(e)}"
    finally:
        db.close()

    send_telegram_alert(reply, chat_id, reply_markup=reply_markup)


def async_process_whatsapp_message(user_text: str, tenant_id: str, to_phone: str):
    """
    Production Conversational Copilot for WhatsApp.
    Supports:
      1. Settle bills by index ('PAY 1') or natural language ('Paid gym 2500')
      2. AI Subscription Radar 1-reply tracking ('TRACK 1' or 'TRACK ALL')
      3. Real-time Status / Pulse ('status', 'pulse', 'safe to spend')
      4. Pending Bills inquiry ('bills')
      5. What-If Scenarios (Affordability, EMI, Prepayment)
      6. Natural conversation & ledger logging powered by Gemini 2.5 Flash
    """
    if not user_text:
        return

    db = SessionLocal()
    today = datetime.date.today().strftime("%Y-%m-%d")
    user_clean = user_text.strip().lower()

    try:
        user = db.query(models.User).filter(models.User.id == tenant_id).first()
        user_name = user.email.split("@")[0].capitalize() if user and user.email else ""

        # 1. Shortcut: Settle bill by index ('PAY 1', 'pay 2', 'PAY_1')
        pay_num_match = re.match(r"^pay[_\s]+(\d+)$", user_clean)
        if pay_num_match:
            bill_idx = int(pay_num_match.group(1)) - 1
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            actionable_bills = (
                status_data["bills"].get("overdue_bills", [])
                + status_data["bills"].get("due_today_bills", [])
                + status_data["bills"].get("upcoming_7d_bills", [])
            )
            if 0 <= bill_idx < len(actionable_bills):
                target_bill = actionable_bills[bill_idx]
                res = reminder_service.settle_bill_with_expense(
                    db=db,
                    tenant_id=str(tenant_id),
                    bill_id=target_bill["id"],
                    auto_log_expense=True,
                    account="ICICI Savings Account",
                )
                exp_amt = res["created_expense"]["amount"] if res.get("created_expense") else target_bill["amount"]
                reply = (
                    f"✅ *Bill Settled & Recorded in Ledger!*\n"
                    f"━━━━━━━━━━━━━━━━━━━━━\n"
                    f"• Bill: *{target_bill['name']}*\n"
                    f"• Amount: ₹{exp_amt:,.2f}\n"
                    f"• Account: ICICI Savings Account\n"
                    f"• Status: Paid\n"
                    f"• Auto-Ledger: Logged to Utilities & Bills\n\n"
                    f"💡 _Your uncommitted cushion has been updated._"
                )
                whatsapp_service.send_whatsapp_message(to_phone, reply, quick_replies=["Status", "Bills", "Radar"])
                return
            else:
                whatsapp_service.send_whatsapp_message(
                    to_phone,
                    f"⚠️ Bill #{pay_num_match.group(1)} not found in pending dues. Reply *BILLS* to view your current list.",
                )
                return

        # 2. Shortcut: Settle bill by name ('paid gym 2500', 'settle wifi 999')
        paid_match = re.search(r"(?:paid|settle|cleared|mark)\s+([a-zA-Z\s]+?)(?:\s+(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?))?$", user_clean)
        if paid_match:
            bill_name = paid_match.group(1).replace("bill", "").replace("paid", "").strip()
            amt_str = paid_match.group(2)
            amt = float(amt_str.replace(",", "")) if amt_str else 0.0
            matched_bill = reminder_service.find_matching_bill(db, str(tenant_id), bill_name, amt)
            if matched_bill:
                res = reminder_service.settle_bill_with_expense(
                    db=db,
                    tenant_id=str(tenant_id),
                    bill_id=matched_bill.id,
                    auto_log_expense=True,
                    account="ICICI Savings Account",
                )
                exp_amt = res["created_expense"]["amount"] if res.get("created_expense") else matched_bill.amount
                reply = (
                    f"✅ *Bill Settled & Recorded in Ledger!*\n"
                    f"━━━━━━━━━━━━━━━━━━━━━\n"
                    f"• Bill: *{matched_bill.name}*\n"
                    f"• Amount: ₹{exp_amt:,.2f}\n"
                    f"• Account: ICICI Savings Account\n"
                    f"• Status: Paid\n"
                    f"• Ledger: Expense added to Utilities & Bills"
                )
                whatsapp_service.send_whatsapp_message(to_phone, reply, quick_replies=["Status", "Bills"])
                return

        # 3. Shortcut: Track discovered subscription ('TRACK 1', 'track 2', 'TRACK ALL')
        track_match = re.match(r"^track[_\s]+(\d+|all)$", user_clean)
        if track_match:
            choice = track_match.group(1)
            disc = recurring_radar.discover_recurring_charges(db, str(tenant_id))
            if choice == "all":
                tracked_count = 0
                for item in disc:
                    reminder_service.add_recurring_bill(
                        db=db,
                        tenant_id=str(tenant_id),
                        name=item.get("name") or item.get("merchant", "Subscription"),
                        amount=float(item.get("amount") or item.get("average_amount", 0.0)),
                        due_day=int(item.get("detected_due_day") or item.get("due_day", 1)),
                    )
                    tracked_count += 1
                reply = (
                    f"✅ *All Discovered Subscriptions Tracked!*\n\n"
                    f"Successfully added {tracked_count} subscription(s) to your calendar reminders. "
                    f"You will now receive automated morning alerts and 1-tap WhatsApp settlement shortcuts."
                )
                whatsapp_service.send_whatsapp_message(to_phone, reply, quick_replies=["Bills", "Status"])
                return
            else:
                idx = int(choice) - 1
                if 0 <= idx < len(disc):
                    item = disc[idx]
                    res = reminder_service.add_recurring_bill(
                        db=db,
                        tenant_id=str(tenant_id),
                        name=item.get("name") or item.get("merchant", "Subscription"),
                        amount=float(item.get("amount") or item.get("average_amount", 0.0)),
                        due_day=int(item.get("detected_due_day") or item.get("due_day", 1)),
                    )
                    b = res["bill"]
                    reply = (
                        f"✅ *Discovered Subscription Now Tracked!*\n"
                        f"━━━━━━━━━━━━━━━━━━━━━\n"
                        f"• Bill: *{b['name']}*\n"
                        f"• Amount: ₹{b['amount']:,.2f}/month\n"
                        f"• Cadence: Due Day {b['due_day']} of every month\n"
                        f"• Status: Active\n\n"
                        f"💡 Reminders will now be included in your WhatsApp morning briefings."
                    )
                    whatsapp_service.send_whatsapp_message(to_phone, reply, quick_replies=["Status", "Bills"])
                    return
                else:
                    whatsapp_service.send_whatsapp_message(
                        to_phone,
                        f"⚠️ Subscription #{choice} not found on Radar. Reply *RADAR* to refresh."
                    )
                    return

        # 4. Shortcut: Daily Status / Pulse
        if user_clean in ["status", "/status", "pulse", "briefing", "daily status", "safe to spend", "today"]:
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            reply, quick_replies = whatsapp_service.format_daily_status_whatsapp_message(status_data, user_name)
            whatsapp_service.send_whatsapp_message(to_phone, reply, quick_replies=quick_replies)
            return

        # 5. Shortcut: Bills List
        if user_clean in ["bills", "/bills", "pending bills", "due bills", "what bills are due", "view bills"]:
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            bills_info = status_data.get("bills", {})
            overdue = bills_info.get("overdue_bills", [])
            due_today = bills_info.get("due_today_bills", [])
            upcoming_7d = bills_info.get("upcoming_7d_bills", [])

            lines = [
                "📅 *Pending & Upcoming Bills*",
                "━━━━━━━━━━━━━━━━━━━━━",
            ]
            actionable = overdue + due_today
            if actionable:
                lines.append(f"🚨 *Immediate Action Required ({len(actionable)}):*")
                for i, b in enumerate(actionable, 1):
                    lines.append(f"• *PAY {i}*: {b['name']} - ₹{b['amount']:,.2f} ({b.get('label', 'Due')})")
            if upcoming_7d:
                lines.append(f"\n🗓️ *Upcoming in Next 7 Days ({len(upcoming_7d)}):*")
                for b in upcoming_7d:
                    lines.append(f"• {b['name']}: ₹{b['amount']:,.2f} ({b.get('label', 'Upcoming')})")
            if not actionable and not upcoming_7d:
                lines.append("✅ All bills are paid and up to date!")
            lines.append("\n💡 Reply *PAY 1* to settle an immediate bill.")
            whatsapp_service.send_whatsapp_message(to_phone, "\n".join(lines), quick_replies=["Status", "Radar"])
            return

        # 6. Shortcut: AI Radar
        if user_clean in ["radar", "/radar", "discover", "subscriptions", "find bills", "untracked bills"]:
            disc = recurring_radar.discover_recurring_charges(db, str(tenant_id))
            reply = whatsapp_service.format_discovered_radar_whatsapp_message(disc)
            whatsapp_service.send_whatsapp_message(to_phone, reply, quick_replies=["Status", "Bills"])
            return

        # 7. Fast-path: What-If Affordability
        afford_match = re.search(r"(?:can\s+(?:i|we)\s+afford|afford)\s+(?:a\s+|an\s+)?(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:for\s+a\s+|for\s+|on\s+a\s+|on\s+)?([a-zA-Z\s]+)?", user_clean)
        if afford_match:
            raw_amt = afford_match.group(1).replace(",", "")
            raw_name = (afford_match.group(2) or "Purchase").strip().title()
            try:
                amt = float(raw_amt)
                status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
                kpis = status_data.get("kpis", {})
                res = simulation_engine.simulate_discretionary_purchase(
                    current_liquid_balance=float(kpis.get("liquid_balance", 0.0)),
                    committed_bills_unpaid=float(kpis.get("committed_bills_unpaid", 0.0)),
                    days_left_in_cycle=int(status_data.get("days_left_in_cycle", 15)),
                    expense_amount=amt,
                    expense_name=raw_name,
                )
                msg = whatsapp_service.format_what_if_whatsapp_message(res)
                whatsapp_service.send_whatsapp_message(to_phone, msg, quick_replies=["Status", "Bills"])
                return
            except Exception:
                pass

        # 8. Fast-path: What-If EMI
        if "emi" in user_clean and any(kw in user_clean for kw in ["buy", "laptop", "car", "phone", "tv", "purchase", "what if", "get"]):
            amt_match = re.search(r"(?:₹|rs\.?|inr)?\s*([\d,]+)", user_clean)
            mo_match = re.search(r"(\d+)\s*(?:month|mo)", user_clean)
            amt = float(amt_match.group(1).replace(",", "")) if amt_match else 50000.0
            tenure = int(mo_match.group(1)) if mo_match else 6
            name = "Purchased Item"
            for candidate in ["laptop", "phone", "tv", "car", "bike", "refrigerator", "iphone", "macbook"]:
                if candidate in user_clean:
                    name = candidate.capitalize()
                    break
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            kpis = status_data.get("kpis", {})
            total_income = db.query(func.sum(models.Income.amount)).filter(models.Income.tenant_id == tenant_id).scalar() or 120000.0
            total_expense = db.query(func.sum(models.Expense.amount)).filter(models.Expense.tenant_id == tenant_id).scalar() or 50000.0
            res = simulation_engine.simulate_emi_purchase(
                current_liquid_balance=float(kpis.get("liquid_balance", 0.0)),
                current_monthly_income=float(total_income),
                current_monthly_expense=float(total_expense),
                days_left_in_cycle=int(status_data.get("days_left_in_cycle", 15)),
                item_cost=amt,
                tenure_months=tenure,
                annual_interest_rate=0.0 if "no cost" in user_clean else 12.0,
                item_name=name,
            )
            msg = whatsapp_service.format_what_if_whatsapp_message(res)
            whatsapp_service.send_whatsapp_message(to_phone, msg, quick_replies=["Status", "Bills"])
            return

        # 9. Fast-path: What-If Prepayment
        prepay_match = re.search(r"prepay\s+(?:₹|rs\.?|inr)?\s*([\d,]+)", user_clean)
        if prepay_match:
            amt = float(prepay_match.group(1).replace(",", ""))
            loan = db.query(models.Loan).filter(models.Loan.tenant_id == tenant_id).first()
            p = float(loan.principal) if loan and loan.principal else 500000.0
            r = float(loan.interest_rate) if loan and loan.interest_rate else 9.5
            n = int(loan.tenure_months or ((loan.tenure_years or 5) * 12)) if loan else 48
            loan_title = loan.name if loan and loan.name else ("Car Loan" if "car" in user_clean else "Loan")
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            kpis = status_data.get("kpis", {})
            res = simulation_engine.simulate_loan_prepayment(
                principal=p,
                annual_interest_rate=r,
                tenure_months=n,
                prepayment_amount=amt,
                loan_name=loan_title,
                current_liquid_balance=float(kpis.get("liquid_balance", 0.0)),
            )
            msg = whatsapp_service.format_what_if_whatsapp_message(res)
            whatsapp_service.send_whatsapp_message(to_phone, msg, quick_replies=["Status", "Bills"])
            return

        # 10. Natural Language with Gemini 2.5 Flash
        if ai_client:
            total_assets = db.query(func.sum(models.Investment.current_value)).filter(models.Investment.tenant_id == tenant_id).scalar() or 0.0
            total_debt = db.query(func.sum(models.Loan.principal)).filter(models.Loan.tenant_id == tenant_id).scalar() or 0.0
            context = f"Net Worth: ₹{total_assets - total_debt:,.2f} (Assets: ₹{total_assets:,.2f}, Debt: ₹{total_debt:,.2f})"

            prompt = f"""
            You are an AI financial advisor communicating on WhatsApp. Today is {today}. Context: {context}
            User Message: "{user_text}"

            Classify intent into pure JSON:
            1. Settle bill:
               {{"type": "settle_bill", "bill_name": "electricity", "amount": 1450.0, "account": "ICICI Savings Account"}}
            2. Add recurring bill:
               {{"type": "add_bill", "name": "Gym", "amount": 2500.0, "due_day": 10, "category": "Fitness"}}
            3. Log expense:
               {{"type": "log_expense", "amount": 350.0, "description": "lunch", "category": "Dining", "account": "ICICI Savings Account"}}
            4. Log income:
               {{"type": "log_income", "amount": 120000.0, "description": "salary", "category": "Salary", "account": "ICICI Savings Account"}}
            5. Otherwise:
               {{"type": "chat", "reply": "Your clear, concise answer formatted for WhatsApp using *bold* and _italics_."}}
            """
            response = ai_client.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
            cleaned = (
                response.text.strip()
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )
            data = json.loads(cleaned)
            intent = data.get("type")

            if intent == "log_expense":
                desc = data.get("description", "Expense").capitalize()
                amt = float(data.get("amount", 0.0))
                cat = data.get("category", "General").strip()
                acc = data.get("account", "ICICI Savings Account")
                db.add(models.Expense(
                    date=today,
                    description=desc,
                    amount=amt,
                    category=cat,
                    account=acc,
                    tenant_id=tenant_id,
                    remarks="Logged via WhatsApp Webhook",
                ))
                db.commit()
                reply = f"✅ *Logged Expense via WhatsApp:*\n• {desc}: ₹{amt:,.2f} ({cat})\n• Account: {acc}"
                whatsapp_service.send_whatsapp_message(to_phone, reply)
                return

            elif intent == "log_income":
                desc = data.get("description", "Income").capitalize()
                amt = float(data.get("amount", 0.0))
                cat = data.get("category", "Salary").strip()
                acc = data.get("account", "ICICI Savings Account")
                db.add(models.Income(
                    date=today,
                    description=desc,
                    amount=amt,
                    category=cat,
                    account=acc,
                    tenant_id=tenant_id,
                ))
                db.commit()
                reply = f"💰 *Logged Income via WhatsApp:*\n• {desc}: ₹{amt:,.2f} ({cat})\n• Account: {acc}"
                whatsapp_service.send_whatsapp_message(to_phone, reply)
                return

            elif intent == "add_bill":
                name = str(data.get("name", "Recurring Bill")).strip().title()
                amt = float(data.get("amount", 0.0) or 0.0)
                due_day = int(data.get("due_day", 1) or 1)
                cat = str(data.get("category", "Utilities")).strip().title()
                res = reminder_service.add_recurring_bill(
                    db=db,
                    tenant_id=str(tenant_id),
                    name=name,
                    amount=amt,
                    due_day=due_day,
                    category=cat,
                )
                b = res["bill"]
                reply = (
                    f"📅 *New Recurring Bill Tracked!*\n"
                    f"━━━━━━━━━━━━━━━━━━━━━\n"
                    f"• Bill: *{b['name']}*\n"
                    f"• Amount: ₹{b['amount']:,.2f}\n"
                    f"• Due Day: Day {b['due_day']} of every month\n"
                    f"• Reminders: Active on WhatsApp"
                )
                whatsapp_service.send_whatsapp_message(to_phone, reply, quick_replies=["Bills", "Status"])
                return

            else:
                reply = data.get("reply", "I received your message. Send *status*, *bills*, or *radar* for financial actions.")
                whatsapp_service.send_whatsapp_message(to_phone, reply)
                return

        # Default fallback if no AI client
        whatsapp_service.send_whatsapp_message(
            to_phone,
            "👋 Hello! Send *STATUS* for your daily pulse, *BILLS* to see pending dues, or *RADAR* for discovered subscriptions.",
            quick_replies=["Status", "Bills", "Radar"]
        )
    except Exception as e:
        print(f"WhatsApp processing error: {e}")
        whatsapp_service.send_whatsapp_message(to_phone, f"⚠️ Unable to process message: {str(e)[:100]}")
    finally:
        db.close()


# --- Scheduler Setup ---
scheduler = BackgroundScheduler()

telegram_stop_event = threading.Event()

def run_telegram_polling():
    """
    Local development Telegram poller using getUpdates.
    Automatically clears stale webhooks and processes /start tokens, text messages, and button taps.
    """
    if not TELEGRAM_BOT_TOKEN:
        print("[Telegram Poller] TELEGRAM_BOT_TOKEN not configured. Skipping polling.")
        return

    # If explicit public webhook URL is configured (e.g. Render/production), do not poll
    webhook_url = os.getenv("TELEGRAM_WEBHOOK_URL")
    if webhook_url:
        print(f"[Telegram] Public webhook URL set to {webhook_url}. Skipping local polling.")
        return

    print("[Telegram Poller] Starting local development polling worker...")
    try:
        wh_check = requests.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo", timeout=10).json()
        if wh_check.get("ok") and wh_check.get("result", {}).get("url"):
            old_url = wh_check["result"]["url"]
            print(f"[Telegram Poller] Clearing stale webhook ({old_url}) to enable local polling...")
            requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook", timeout=10)
            print("[Telegram Poller] Stale webhook cleared successfully. Polling active.")
    except Exception as e:
        print(f"[Telegram Poller] Webhook check warning: {e}")

    last_update_id = 0
    while not telegram_stop_event.is_set():
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={last_update_id + 1}&timeout=10"
            resp = requests.get(url, timeout=15).json()
            if not resp.get("ok"):
                if resp.get("error_code") == 409:
                    requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook", timeout=10)
                time.sleep(2)
                continue

            for update in resp.get("result", []):
                last_update_id = update["update_id"]

                # 1. Handle Inline Keyboard Callback Queries (Button Taps)
                cb = update.get("callback_query")
                if cb:
                    cb_id = cb.get("id")
                    cb_chat_id = str(
                        cb.get("message", {}).get("chat", {}).get("id", "")
                        or cb.get("from", {}).get("id", "")
                    )
                    cb_data = str(cb.get("data", ""))
                    telegram_listener.answer_callback_query(cb_id, "Processing...")
                    db = SessionLocal()
                    try:
                        u = telegram_listener.get_user_for_chat(db, cb_chat_id)
                        if u:
                            tenant_id = str(u.id)
                            if cb_data.startswith("settle_bill:"):
                                b_id = int(cb_data.split(":")[1])
                                res = reminder_service.settle_bill_with_expense(
                                    db, tenant_id, b_id, auto_log_expense=True
                                )
                                if res.get("success"):
                                    b_obj = res["bill"]
                                    send_telegram_alert(
                                        f"✅ *Settled & Logged:* '{b_obj['name']}' (₹{b_obj['amount']:,.2f}) marked as Paid!\n• Expense recorded in ledger.",
                                        cb_chat_id,
                                    )
                            elif cb_data == "daily_status":
                                st_data = reminder_service.get_tenant_reminders_and_status(db, tenant_id)
                                u_name = u.email.split("@")[0].capitalize() if u.email else ""
                                msg = reminder_service.format_daily_status_telegram_message(st_data, u_name)
                                actionable_bills = st_data["bills"].get("overdue_bills", []) + st_data["bills"].get("due_today_bills", [])
                                markup = reminder_service.build_bills_inline_keyboard(actionable_bills)
                                send_telegram_alert(msg, cb_chat_id, reply_markup=markup)
                            elif cb_data == "pending_bills":
                                st_data = reminder_service.get_tenant_reminders_and_status(db, tenant_id)
                                msg, markup = reminder_service.format_pending_bills_telegram_message(st_data)
                                send_telegram_alert(msg, cb_chat_id, reply_markup=markup)
                    except Exception as err:
                        print(f"[Telegram Poller] Callback error: {err}")
                    finally:
                        db.close()
                    continue

                # 2. Handle Messages
                msg = update.get("message", {})
                sender_id = str(msg.get("chat", {}).get("id", "") or msg.get("from", {}).get("id", ""))
                text = msg.get("text", "")

                if sender_id and text:
                    db = SessionLocal()
                    try:
                        user = db.query(models.User).filter(models.User.telegram_chat_id == sender_id).first()

                        # Check /start <token> linking
                        if text.strip().startswith("/start"):
                            parts = text.strip().split()
                            target_user = None
                            if len(parts) > 1:
                                token = parts[1].strip()
                                target_user = db.query(models.User).filter(models.User.telegram_link_token == token).first()

                            # If no token in command, or token expired, link user who recently initiated Telegram connect
                            if not target_user and not user:
                                target_user = (
                                    db.query(models.User)
                                    .filter(models.User.telegram_link_token.isnot(None))
                                    .order_by(models.User.id.desc())
                                    .first()
                                )

                            if target_user:
                                target_user.telegram_chat_id = sender_id
                                target_user.telegram_link_token = None
                                db.commit()
                                send_telegram_alert(
                                    "🎉 *Telegram Connected Successfully!*\n\n"
                                    "Your Telegram account is now linked to your Personal AI Financial Advisor.\n\n"
                                    "You will receive your 8:00 AM Morning Pulse, overdue bill alerts, and safe-to-spend runways right here.\n\n"
                                    "💬 *Try replying:* *STATUS*, *BILLS*, or *RADAR* to explore.",
                                    sender_id,
                                )
                                print(f"[Telegram Poller] Successfully linked Telegram chat {sender_id} to user {target_user.email}")
                                continue
                            elif not user:
                                send_telegram_alert(
                                    f"👋 Hello! Your Telegram Chat ID is: `{sender_id}`\n\n"
                                    "To link your account, either:\n"
                                    "1. Click 'Connect Telegram' from your Financial Dashboard, or\n"
                                    f"2. Enter Chat ID `{sender_id}` in your Dashboard Notification Settings under 'Advanced: Enter Telegram Chat ID'.",
                                    sender_id,
                                )
                                continue

                        if user:
                            # Process message asynchronously in background thread
                            threading.Thread(
                                target=async_process_telegram_message,
                                args=(text, str(user.id), sender_id),
                                daemon=True,
                            ).start()
                        else:
                            print(f"[Telegram Poller] Unlinked message from {sender_id}: {text}")
                    except Exception as m_err:
                        print(f"[Telegram Poller] Message processing error: {m_err}")
                    finally:
                        db.close()

        except Exception as poll_err:
            if not telegram_stop_event.is_set():
                time.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        scheduled_financial_health_check,
        "cron",
        hour=8,
        minute=0,
        id="daily_health_check",
    )
    scheduler.start()

    # Start Telegram background polling worker for local development if webhook is not configured
    telegram_stop_event.clear()
    if not os.getenv("TELEGRAM_WEBHOOK_URL"):
        poller_thread = threading.Thread(target=run_telegram_polling, daemon=True)
        poller_thread.start()
    else:
        print("[Lifespan] TELEGRAM_WEBHOOK_URL found. Skipping local poller.")

    # Auto-link local dev Telegram Chat ID if configured in .env
    env_chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if env_chat_id:
        db_boot = SessionLocal()
        try:
            existing = db_boot.query(models.User).filter(models.User.telegram_chat_id == env_chat_id).first()
            if not existing:
                u = db_boot.query(models.User).filter(models.User.telegram_chat_id.is_(None)).order_by(models.User.id.asc()).first()
                if u:
                    u.telegram_chat_id = env_chat_id
                    print(f"[Lifespan] Auto-linked user {u.email} to TELEGRAM_CHAT_ID {env_chat_id}")
                    db_boot.commit()
        except Exception as e:
            print(f"[Lifespan] Auto-link warning: {e}")
        finally:
            db_boot.close()

    yield

    telegram_stop_event.set()
    scheduler.shutdown()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Enterprise Financial AI API",
    description="Decoupled backend with Asynchronous Pipelines, Multi-Account Tracking, and Webhook Security.",
    version="2.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(billing.router, prefix="/api/v1", tags=["Billing"])

# --- Secured Endpoints: Dashboard (GET) ---

@app.get("/api/v1/dashboard", tags=["Dashboard"])
@app.get("/api/v1/dashboard/", tags=["Dashboard"])
def get_dashboard_data(db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    from datetime import datetime
    from collections import defaultdict

    def serialize(query_result):
        results = []
        for row in query_result:
            row_dict = row.__dict__.copy()
            row_dict.pop("_sa_instance_state", None)
            
            # Loan compatibility aliases
            if hasattr(row, 'name') and 'bank_name' not in row_dict:
                row_dict['bank_name'] = row.name
            if hasattr(row, 'tenure_years') and ('tenure_months' not in row_dict or not row_dict['tenure_months']):
                row_dict['tenure_months'] = int((row.tenure_years or 0) * 12)
            if hasattr(row, 'tenure_months') and ('tenure_years' not in row_dict or not row_dict['tenure_years']):
                row_dict['tenure_years'] = round((row.tenure_months or 0) / 12, 2)
            
            # Credit Score aliases
            if hasattr(row, 'agency') and 'bureau' not in row_dict:
                row_dict['bureau'] = row.agency or 'CIBIL'

            # Investment aliases
            if hasattr(row, 'category') and 'type' not in row_dict:
                row_dict['type'] = row.category
            if hasattr(row, 'invested_amount') and ('invested_amount' not in row_dict or not row_dict['invested_amount']):
                row_dict['invested_amount'] = row_dict.get('current_value', 0.0)

            # Bill aliases
            if hasattr(row, 'due_day') and 'due_date' not in row_dict:
                now_dt = datetime.now()
                day = min(max(row.due_day or 1, 1), 28)
                row_dict['due_date'] = f"{now_dt.year}-{now_dt.month:02d}-{day:02d}"
                row_dict['is_paid'] = (getattr(row, 'status', 'Pending') == "Paid")
                row_dict['frequency'] = "Monthly"

            results.append(row_dict)
        return results

    expenses = serialize(db.query(models.Expense).filter(models.Expense.tenant_id == current_user.id).all())
    incomes = serialize(db.query(models.Income).filter(models.Income.tenant_id == current_user.id).all())
    accounts = serialize(db.query(models.Account).filter(models.Account.tenant_id == current_user.id).all())
    balance_adjustments = serialize(
        db.query(models.BalanceAdjustment).filter(models.BalanceAdjustment.tenant_id == current_user.id).all()
    )
    loans = serialize(db.query(models.Loan).filter(models.Loan.tenant_id == current_user.id).all())
    investments = serialize(db.query(models.Investment).filter(models.Investment.tenant_id == current_user.id).all())
    budgets = serialize(db.query(models.Budget).filter(models.Budget.tenant_id == current_user.id).all())
    goals = serialize(db.query(models.Goal).filter(models.Goal.tenant_id == current_user.id).all())
    bills = serialize(db.query(models.Bill).filter(models.Bill.tenant_id == current_user.id).all())
    credit_scores = serialize(
        db.query(models.CreditScore).filter(models.CreditScore.tenant_id == current_user.id).order_by(models.CreditScore.date).all()
    )
    profile = serialize(db.query(models.Profile).filter(models.Profile.tenant_id == current_user.id).all())

    # Precalculated Summary KPIs
    now = datetime.now()
    current_month_prefix = now.strftime("%Y-%m")

    # Current month vs all-time metrics
    current_month_expenses = sum(
        float(e.get("amount", 0.0) or 0.0) for e in expenses
        if str(e.get("date", "")).startswith(current_month_prefix)
    )
    current_month_income = sum(
        float(i.get("amount", 0.0) or 0.0) for i in incomes
        if str(i.get("date", "")).startswith(current_month_prefix)
    )
    all_time_expenses = sum(float(e.get("amount", 0.0) or 0.0) for e in expenses)
    all_time_income = sum(float(i.get("amount", 0.0) or 0.0) for i in incomes)

    # Dynamic fallback to latest active month if current month is empty
    display_monthly_expense = current_month_expenses
    display_monthly_income = current_month_income
    if display_monthly_expense == 0.0 and expenses:
        latest_date = max((str(e.get("date", "")) for e in expenses if e.get("date")), default="")
        if latest_date:
            display_monthly_expense = sum(
                float(e.get("amount", 0.0) or 0.0) for e in expenses
                if str(e.get("date", "")).startswith(latest_date[:7])
            )
    if display_monthly_income == 0.0 and incomes:
        latest_date = max((str(i.get("date", "")) for i in incomes if i.get("date")), default="")
        if latest_date:
            display_monthly_income = sum(
                float(i.get("amount", 0.0) or 0.0) for i in incomes
                if str(i.get("date", "")).startswith(latest_date[:7])
            )

    total_acc_balance = sum(float(a.get("initial_balance", 0.0) or 0.0) for a in accounts)
    total_adj = sum(float(ba.get("amount", 0.0) or 0.0) for ba in balance_adjustments)
    total_balance = max(0.0, total_acc_balance + all_time_income - all_time_expenses + total_adj)

    active_loans_count = len(loans)
    total_debt = sum(float(l.get("principal", 0.0) or 0.0) for l in loans)
    total_investments = sum(float(inv.get("current_value", 0.0) or 0.0) for inv in investments)
    net_worth = (total_balance + total_investments) - total_debt

    # Credit Score (Numeric or None)
    valid_scores = [cs for cs in credit_scores if isinstance(cs.get("score"), (int, float))]
    latest_cs = int(valid_scores[-1]["score"]) if valid_scores else None
    latest_rating = valid_scores[-1].get("rating", "Good") if valid_scores else "N/A"
    latest_bureau = valid_scores[-1].get("bureau") or valid_scores[-1].get("agency", "CIBIL") if valid_scores else "CIBIL"

    # Monthly Trend (Past 6 Months Cash Flow)
    monthly_map = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for inc in incomes:
        d = str(inc.get("date", ""))[:7]
        if d and len(d) == 7:
            monthly_map[d]["income"] += float(inc.get("amount", 0.0) or 0.0)
    for exp in expenses:
        d = str(exp.get("date", ""))[:7]
        if d and len(d) == 7:
            monthly_map[d]["expense"] += float(exp.get("amount", 0.0) or 0.0)

    # Ensure last 6 calendar months are represented
    for offset in range(5, -1, -1):
        m_year = now.year if (now.month - offset) > 0 else now.year - 1
        m_month = (now.month - offset) if (now.month - offset) > 0 else (now.month - offset + 12)
        m_key = f"{m_year:04d}-{m_month:02d}"
        if m_key not in monthly_map:
            monthly_map[m_key] = {"income": 0.0, "expense": 0.0}

    sorted_months = sorted(monthly_map.keys())[-6:]
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_trend = []
    for m in sorted_months:
        try:
            m_idx = int(m.split("-")[1]) - 1
            label = month_names[m_idx]
        except Exception:
            label = m
        inc_val = round(monthly_map[m]["income"], 2)
        exp_val = round(monthly_map[m]["expense"], 2)
        monthly_trend.append({
            "key": m,
            "month": label,
            "income": inc_val,
            "expense": exp_val,
            "savings": round(inc_val - exp_val, 2)
        })

    # Expense by category
    cat_map = defaultdict(float)
    for exp in expenses:
        cat = exp.get("category") or "Miscellaneous"
        cat_map[cat] += float(exp.get("amount", 0.0) or 0.0)
    expense_by_category = [
        {"name": cat, "value": round(val, 2)}
        for cat, val in sorted(cat_map.items(), key=lambda x: x[1], reverse=True)
    ]

    # Recent activity items
    recent_transactions = []
    for exp in sorted(expenses, key=lambda x: x.get("date", ""), reverse=True)[:10]:
        recent_transactions.append({
            "id": f"exp-{exp.get('id')}",
            "description": exp.get("description") or exp.get("category", "Expense"),
            "category": exp.get("category", "Expense"),
            "amount": -abs(float(exp.get("amount", 0.0) or 0.0)),
            "date": exp.get("date", ""),
            "account": exp.get("account", "Account"),
            "type": "expense"
        })
    for inc in sorted(incomes, key=lambda x: x.get("date", ""), reverse=True)[:10]:
        recent_transactions.append({
            "id": f"inc-{inc.get('id')}",
            "description": inc.get("description") or inc.get("category", "Income"),
            "category": inc.get("category", "Income"),
            "amount": abs(float(inc.get("amount", 0.0) or 0.0)),
            "date": inc.get("date", ""),
            "account": inc.get("account", "Account"),
            "type": "income"
        })
    recent_transactions.sort(key=lambda x: x.get("date", ""), reverse=True)

    # Dynamic Safe-to-Spend & Cash Flow Commitments
    import calendar
    from loan_math import calculate_emi

    committed_bills_amount = sum(
        float(b.get("amount", 0.0) or 0.0) for b in bills
        if not b.get("is_paid", False)
    )

    scheduled_emis_amount = 0.0
    for l in loans:
        p = float(l.get("principal", 0.0) or 0.0)
        r = float(l.get("interest_rate", 0.0) or 0.0)
        n = int(l.get("tenure_months") or (float(l.get("tenure_years", 1.0) or 1.0) * 12))
        if p > 0 and n > 0:
            try:
                scheduled_emis_amount += calculate_emi(p, r, n)
            except Exception:
                pass

    _, last_day = calendar.monthrange(now.year, now.month)
    days_left_in_cycle = max(1, last_day - now.day + 1)

    uncommitted_balance = max(0.0, total_balance - committed_bills_amount - scheduled_emis_amount)
    safe_to_spend_daily = round(uncommitted_balance / days_left_in_cycle, 2)

    if safe_to_spend_daily >= 1500:
        burn_rate_status = "Healthy"
    elif safe_to_spend_daily >= 500:
        burn_rate_status = "Moderate"
    else:
        burn_rate_status = "Tight"

    # Phase 2: Autonomous Anomaly & Zombie Subscription Guardian
    dismissed_entry = db.query(models.Profile).filter(
        models.Profile.tenant_id == current_user.id,
        models.Profile.key == "dismissed_anomalies"
    ).first()
    dismissed_ids = []
    if dismissed_entry and dismissed_entry.value:
        try:
            dismissed_ids = json.loads(dismissed_entry.value)
        except Exception:
            pass
    active_anomalies = anomaly_detector.detect_anomalies(expenses, bills, dismissed_ids)

    return {
        "expenses": expenses,
        "incomes": incomes,
        "accounts": accounts,
        "balance_adjustments": balance_adjustments,
        "loans": loans,
        "investments": investments,
        "budgets": budgets,
        "goals": goals,
        "bills": bills,
        "credit_scores": credit_scores,
        "profile": profile,
        # Summary & aggregates
        "total_balance": round(total_balance, 2),
        "monthly_expenses": round(display_monthly_expense, 2),
        "monthly_income": round(display_monthly_income, 2),
        "all_time_expenses": round(all_time_expenses, 2),
        "all_time_income": round(all_time_income, 2),
        "active_loans_count": active_loans_count,
        "credit_score": latest_cs,
        "credit_rating": latest_rating,
        "credit_bureau": latest_bureau,
        "total_debt": round(total_debt, 2),
        "total_investments": round(total_investments, 2),
        "net_worth": round(net_worth, 2),
        "monthly_trend": monthly_trend,
        "expense_by_category": expense_by_category,
        "recent_transactions": recent_transactions[:10],
        # Phase 1: Safe-to-Spend & Commitment metrics
        "safe_to_spend_daily": safe_to_spend_daily,
        "days_left_in_cycle": days_left_in_cycle,
        "committed_bills_amount": round(committed_bills_amount, 2),
        "scheduled_emis_amount": round(scheduled_emis_amount, 2),
        "uncommitted_balance": round(uncommitted_balance, 2),
        "burn_rate_status": burn_rate_status,
        # Phase 2: Anomaly Guardian metrics
        "anomalies": active_anomalies,
        "anomaly_count": len(active_anomalies),
    }

# --- Secured Endpoints: Data Deletion (DELETE) ---

@app.delete("/api/v1/expenses/{expense_id}", tags=["Expenses"])
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    exp = db.query(models.Expense).filter(models.Expense.id == expense_id, models.Expense.tenant_id == current_user.id).first()
    if exp:
        db.delete(exp)
        db.commit()
        return {"message": "Expense deleted successfully."}
    raise HTTPException(status_code=404, detail="Expense not found.")

@app.delete("/api/v1/incomes/{income_id}", tags=["Income"])
def delete_income(income_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    inc = db.query(models.Income).filter(models.Income.id == income_id, models.Income.tenant_id == current_user.id).first()
    if inc:
        db.delete(inc)
        db.commit()
        return {"message": "Income deleted successfully."}
    raise HTTPException(status_code=404, detail="Income not found.")

@app.delete("/api/v1/loans/{loan_id}", tags=["Loans"])
def delete_loan(loan_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id, models.Loan.tenant_id == current_user.id).first()
    if loan:
        db.delete(loan)
        db.commit()
        return {"message": "Loan deleted successfully."}
    raise HTTPException(status_code=404, detail="Loan not found.")

@app.delete("/api/v1/investments/{investment_id}", tags=["Investments"])
def delete_investment(investment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    inv = db.query(models.Investment).filter(models.Investment.id == investment_id, models.Investment.tenant_id == current_user.id).first()
    if inv:
        db.delete(inv)
        db.commit()
        return {"message": "Investment deleted successfully."}
    raise HTTPException(status_code=404, detail="Investment not found.")

@app.delete("/api/v1/goals/{goal_id}", tags=["Goals"])
def delete_goal(goal_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    g = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.tenant_id == current_user.id).first()
    if g:
        db.delete(g)
        db.commit()
        return {"message": "Goal deleted successfully."}
    raise HTTPException(status_code=404, detail="Goal not found.")

@app.delete("/api/v1/bills/{bill_id}", tags=["Bills"])
def delete_bill(bill_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    b = db.query(models.Bill).filter(models.Bill.id == bill_id, models.Bill.tenant_id == current_user.id).first()
    if b:
        db.delete(b)
        db.commit()
        return {"message": "Bill deleted successfully."}
    raise HTTPException(status_code=404, detail="Bill not found.")

@app.put("/api/v1/bills/{bill_id}/toggle-status", tags=["Bills"])
def toggle_bill_status(bill_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    b = db.query(models.Bill).filter(models.Bill.id == bill_id, models.Bill.tenant_id == current_user.id).first()
    if b:
        b.status = "Paid" if b.status != "Paid" else "Pending"
        db.commit()
        return {"message": f"Bill status updated to {b.status}.", "status": b.status}
    raise HTTPException(status_code=404, detail="Bill not found.")

@app.post("/api/v1/bills/{bill_id}/settle", tags=["Bills"])
def settle_bill(
    bill_id: int,
    payload: Optional[schemas.BillSettleRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription),
):
    """
    Settles a recurring bill, marks it as Paid, and automatically creates an Expense record.
    """
    auto_log = payload.auto_log_expense if payload else True
    acc = payload.account if payload and payload.account else "ICICI Savings Account"
    cat = payload.category if payload and payload.category else "Utilities"
    p_date = payload.payment_date if payload else None

    res = reminder_service.settle_bill_with_expense(
        db=db,
        tenant_id=str(current_user.id),
        bill_id=bill_id,
        auto_log_expense=auto_log,
        account=acc,
        category=cat,
        payment_date=p_date,
    )
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message", "Bill not found."))
    return res

@app.get("/api/v1/bills/discovered-recurring", tags=["Bills"])
def get_discovered_recurring_bills(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Auto-discovers repeating subscription / utility charges from historical expenses
    and cross-references them against already tracked bills.
    """
    discovered = recurring_radar.discover_recurring_charges(db, str(current_user.id))
    return {"discovered": discovered, "count": len(discovered)}

@app.post("/api/v1/bills/accept-discovered", tags=["Bills"])
def accept_discovered_bill(
    payload: schemas.DiscoveredBillAcceptRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Accepts an AI-discovered recurring bill and registers it in models.Bill with 1 click.
    """
    res = reminder_service.add_recurring_bill(
        db=db,
        tenant_id=str(current_user.id),
        name=payload.name,
        amount=payload.amount,
        due_day=payload.due_day or 1,
        category=payload.category or "Utilities",
    )
    return {
        "success": True,
        "message": f"Successfully tracked '{payload.name}' as a recurring bill!",
        "bill": res["bill"]
    }

@app.delete("/api/v1/credit-scores/{score_id}", tags=["Credit Score"])
def delete_credit_score(score_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    cs = db.query(models.CreditScore).filter(models.CreditScore.id == score_id, models.CreditScore.tenant_id == current_user.id).first()
    if cs:
        db.delete(cs)
        db.commit()
        return {"message": "Credit score record deleted."}
    raise HTTPException(status_code=404, detail="Credit score record not found.")

@app.delete("/api/v1/budgets/{budget_id}", tags=["Budgets"])
def delete_budget(budget_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    b = db.query(models.Budget).filter(models.Budget.id == budget_id, models.Budget.tenant_id == current_user.id).first()
    if b:
        db.delete(b)
        db.commit()
        return {"message": "Budget deleted successfully."}
    raise HTTPException(status_code=404, detail="Budget not found.")

@app.delete("/api/v1/accounts/{account_id}", tags=["Accounts"])
def delete_account(account_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    acc = db.query(models.Account).filter(models.Account.id == account_id, models.Account.tenant_id == current_user.id).first()
    if acc:
        db.delete(acc)
        db.commit()
        return {"message": "Account deleted successfully."}
    raise HTTPException(status_code=404, detail="Account not found.")

# --- Secured Endpoints: Data Ingestion & Updates (POST / PUT) ---

@app.put("/api/v1/loans/{loan_id}", tags=["Loans"])
def update_loan(loan_id: int, payload: schemas.LoanCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id, models.Loan.tenant_id == current_user.id).first()
    if loan:
        loan.name = payload.name or payload.bank_name or loan.name
        loan.principal = float(payload.principal or 0.0)
        loan.sanctioned_amount = payload.sanctioned_amount if payload.sanctioned_amount is not None else loan.sanctioned_amount
        loan.interest_rate = float(payload.interest_rate or 0.0)
        tenure_y = payload.tenure_years or 0.0
        tenure_m = payload.tenure_months
        if tenure_m is None and tenure_y > 0:
            tenure_m = int(round(tenure_y * 12))
        elif tenure_y == 0.0 and tenure_m:
            tenure_y = round(tenure_m / 12, 2)
        loan.tenure_years = float(tenure_y or 0.0)
        loan.tenure_months = int(tenure_m) if tenure_m is not None else None
        loan.extra_prepayment = float(payload.extra_prepayment or 0.0)
        db.commit()
        return {"message": "Loan updated successfully."}
    raise HTTPException(status_code=404, detail="Loan not found.")

@app.post("/api/v1/loans", tags=["Loans"])
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    name = loan.name or loan.bank_name or "Personal Loan"
    tenure_y = loan.tenure_years or 0.0
    tenure_m = loan.tenure_months
    if tenure_m is None and tenure_y > 0:
        tenure_m = int(round(tenure_y * 12))
    elif tenure_y == 0.0 and tenure_m:
        tenure_y = round(tenure_m / 12, 2)

    new_loan = models.Loan(
        name=name,
        principal=float(loan.principal or 0.0),
        sanctioned_amount=loan.sanctioned_amount,
        interest_rate=float(loan.interest_rate or 0.0),
        tenure_years=float(tenure_y or 0.0),
        tenure_months=int(tenure_m) if tenure_m is not None else None,
        start_date=loan.start_date,
        extra_prepayment=float(loan.extra_prepayment or 0.0),
        tenant_id=current_user.id
    )
    db.add(new_loan)
    db.commit()
    return {"message": "Loan added successfully."}

@app.get("/api/v1/loans/payoff-matrix", tags=["Loans"])
@app.post("/api/v1/loans/payoff-matrix", tags=["Loans"])
def get_debt_payoff_matrix(
    extra_monthly: float = 0.0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    loans = db.query(models.Loan).filter(models.Loan.tenant_id == current_user.id).all()
    loans_dict = [
        {
            "id": l.id,
            "name": l.name,
            "principal": l.principal,
            "interest_rate": l.interest_rate,
            "tenure_months": l.tenure_months or int((l.tenure_years or 1.0) * 12),
        }
        for l in loans
    ]
    return loan_math.simulate_debt_payoff_matrix(loans_dict, extra_monthly=extra_monthly)

@app.post("/api/v1/expenses/bulk", tags=["Expenses"])
def create_bulk_expenses(payload: schemas.BulkExpenseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    if payload.replace_all:
        db.query(models.Expense).filter(models.Expense.tenant_id == current_user.id).delete()
    for exp in payload.expenses:
        db.add(models.Expense(**exp.model_dump(), tenant_id=current_user.id))
    db.commit()
    return {"message": f"Inserted {len(payload.expenses)} expenses successfully."}

@app.post("/api/v1/expenses", tags=["Expenses"])
def create_single_expense(exp: schemas.ExpenseCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    new_expense = models.Expense(**exp.model_dump(), tenant_id=current_user.id)
    db.add(new_expense)

    existing_budget = (
        db.query(models.Budget)
        .filter(func.lower(models.Budget.category) == exp.category.lower(), models.Budget.tenant_id == current_user.id)
        .first()
    )
    if not existing_budget:
        db.add(models.Budget(category=exp.category, monthly_limit=5000.00, tenant_id=current_user.id))

    db.commit()

    warning = check_budget_threshold_alert(db, exp.category, current_user.id)
    if warning and current_user.telegram_chat_id:
        background_tasks.add_task(send_telegram_alert, warning, current_user.telegram_chat_id)

    return {"message": "Expense created successfully."}

@app.post("/api/v1/incomes/bulk", tags=["Income"])
def create_bulk_incomes(payload: schemas.BulkIncomeCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    if payload.replace_all:
        db.query(models.Income).filter(models.Income.tenant_id == current_user.id).delete()
    for inc in payload.incomes:
        db.add(models.Income(**inc.model_dump(), tenant_id=current_user.id))
    db.commit()
    return {"message": f"Inserted {len(payload.incomes)} incomes successfully."}

@app.post("/api/v1/incomes", tags=["Income"])
def create_single_income(inc: schemas.IncomeCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    new_income = models.Income(**inc.model_dump(), tenant_id=current_user.id)
    db.add(new_income)
    db.commit()
    return {"message": "Income recorded successfully."}

# --- Universal Statement Ingestion (Multi-Bank & Encrypted PDF) ---

@app.post("/api/v1/statements/parse", tags=["Statements"])
async def parse_statement_preview(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Parses a bank statement (PDF, Excel, CSV) and returns preview transactions with detected bank
    and account matching without writing to the database.
    """
    content = await file.read()
    try:
        result = universal_statement_parser.parse_universal_statement(
            file_bytes=content,
            filename=file.filename or "statement.pdf",
            password=password
        )
        return {"success": True, "data": result}
    except universal_statement_parser.PasswordRequiredError as pw_err:
        return JSONResponse(
            status_code=422,
            content={
                "error": "PASSWORD_REQUIRED",
                "bank": pw_err.bank_name,
                "hint": pw_err.password_hint,
                "detail": str(pw_err)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/statements/upload", tags=["Statements"])
async def upload_statement(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    replace_all: bool = Form(False),
    auto_create_account: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Universal bank statement ingestion supporting HDFC, SBI, Axis, Kotak, ICICI, Amex, and generic PDFs/spreadsheets.
    Handles encrypted PDFs, auto-categorization, and account auto-creation.
    """
    content = await file.read()
    try:
        parsed = universal_statement_parser.parse_universal_statement(
            file_bytes=content,
            filename=file.filename or "statement.pdf",
            password=password
        )
    except universal_statement_parser.PasswordRequiredError as pw_err:
        return JSONResponse(
            status_code=422,
            content={
                "error": "PASSWORD_REQUIRED",
                "bank": pw_err.bank_name,
                "hint": pw_err.password_hint,
                "detail": str(pw_err)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Statement parsing failed: {str(e)}")

    account_name = parsed.get("account_name") or "Bank Account"
    if auto_create_account and account_name:
        existing_acc = db.query(models.Account).filter(
            func.lower(models.Account.name) == account_name.lower(),
            models.Account.tenant_id == current_user.id
        ).first()
        if not existing_acc:
            db.add(models.Account(
                name=account_name,
                account_type="Bank Account",
                initial_balance=0.0,
                tenant_id=current_user.id
            ))
            db.flush()

    if replace_all:
        db.query(models.Expense).filter(models.Expense.tenant_id == current_user.id).delete()
        db.query(models.Income).filter(models.Income.tenant_id == current_user.id).delete()

    bulk_inc = []
    bulk_exp = []

    for txn in parsed.get("transactions", []):
        t_type = txn.get("type", "expense")
        amt = float(txn.get("amount", 0.0))
        if amt <= 0:
            continue
        dt = txn.get("date") or datetime.date.today().strftime("%Y-%m-%d")
        desc = txn.get("description", "Imported Transaction")
        cat = txn.get("category", "Others")
        acc = txn.get("account") or account_name
        rem = txn.get("remarks") or f"Auto-imported from {parsed.get('bank_name', 'Bank')} statement"

        if t_type == "income":
            bulk_inc.append(models.Income(
                date=dt,
                category=cat,
                amount=amt,
                account=acc,
                description=desc,
                remarks=rem,
                tenant_id=current_user.id
            ))
        else:
            bulk_exp.append(models.Expense(
                date=dt,
                category=cat,
                amount=amt,
                account=acc,
                description=desc,
                remarks=rem,
                tenant_id=current_user.id
            ))

    for inc in bulk_inc:
        db.add(inc)
    for exp in bulk_exp:
        db.add(exp)

    db.commit()

    # AI Recurring Subscription Auto-Discovery Radar
    discovered_recurring = []
    try:
        discovered_recurring = recurring_radar.discover_recurring_charges(db, str(current_user.id))
    except Exception as d_err:
        print(f"Warning: recurring discovery failed on statement upload: {d_err}")

    # Proactive Telegram prompt if untracked recurring bills were detected
    if discovered_recurring and current_user.telegram_chat_id:
        try:
            top_candidate = discovered_recurring[0]
            tg_msg = (
                f"🤖 *AI Subscription Auto-Discovery Radar*\n"
                f"I detected a recurring charge for *{top_candidate['name']}* "
                f"(₹{top_candidate['amount']:,.2f} around day {top_candidate['detected_due_day']} of each month) "
                f"from your uploaded statement.\n\n"
                f"Would you like me to track this bill for automated reminders & settlement?"
            )
            tg_markup = {
                "inline_keyboard": [
                    [
                        {
                            "text": f"✅ Track: {top_candidate['name']} (₹{top_candidate['amount']:,.0f})",
                            "callback_data": f"track_disc:{top_candidate['name'][:20]}:{top_candidate['amount']}:{top_candidate['detected_due_day']}",
                        }
                    ],
                    [{"text": "📅 View All Bills", "callback_data": "pending_bills"}],
                ]
            }
            send_telegram_alert(tg_msg, current_user.telegram_chat_id, reply_markup=tg_markup)
        except Exception as tg_err:
            print(f"Failed to send proactive discovery telegram: {tg_err}")

    return {
        "message": f"Successfully ingested {len(bulk_inc)} incomes and {len(bulk_exp)} expenses from {parsed.get('bank_name', 'Bank')}!",
        "incomes_count": len(bulk_inc),
        "expenses_count": len(bulk_exp),
        "bank_name": parsed.get("bank_name"),
        "account_name": account_name,
        "total_debits": parsed.get("total_debits", 0.0),
        "total_credits": parsed.get("total_credits", 0.0),
        "discovered_recurring_count": len(discovered_recurring),
        "discovered_recurring_bills": discovered_recurring[:5],
    }


# --- Multimodal Ingestion (Camera Receipt OCR & Voice-to-Ledger) ---

@app.post("/api/v1/multimodal/scan-receipt", tags=["Multimodal Ingestion"])
async def scan_receipt(
    file: UploadFile = File(...),
    auto_commit: bool = Form(False),
    account: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Multimodal Camera Receipt & Invoice OCR Scanner using Gemini 2.5 Flash Vision.
    Extracts merchant, line items, taxes, payment method, and optionally logs directly to expenses.
    """
    content = await file.read()
    mime = file.content_type or "image/jpeg"
    res = receipt_scanner.scan_receipt_image(content, mime_type=mime)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to analyze receipt."))

    data = res["data"]
    total_amt = float(data.get("total_amount", 0.0))
    currency = data.get("currency", "INR").upper()
    amt_in_inr = total_amt
    if currency != "INR":
        conv = forex_service.convert_currency(total_amt, currency, "INR")
        amt_in_inr = conv.get("converted_amount", total_amt)

    expense_id = None
    if auto_commit and amt_in_inr > 0:
        acc_name = account or "Cash"
        cat = data.get("category", "Miscellaneous")
        existing_budget = db.query(models.Budget).filter(
            func.lower(models.Budget.category) == cat.lower(),
            models.Budget.tenant_id == current_user.id
        ).first()
        if not existing_budget:
            db.add(models.Budget(category=cat, monthly_limit=5000.00, tenant_id=current_user.id))

        remarks_text = f"Receipt OCR: {data.get('merchant')}"
        if data.get("line_items"):
            item_names = [item.get("name", "") for item in data.get("line_items", []) if item.get("name")]
            if item_names:
                remarks_text += f" | Items: {', '.join(item_names[:4])}"
        if currency != "INR":
            remarks_text += f" | Original: {currency} {total_amt:.2f}"

        exp = models.Expense(
            date=data.get("date", datetime.date.today().strftime("%Y-%m-%d")),
            description=data.get("merchant", "Receipt Expense"),
            amount=round(amt_in_inr, 2),
            category=cat,
            account=acc_name,
            remarks=remarks_text,
            tenant_id=current_user.id
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        expense_id = exp.id

    return {
        "success": True,
        "receipt": data,
        "amount_in_inr": round(amt_in_inr, 2),
        "expense_id": expense_id,
        "message": f"Successfully parsed receipt from {data.get('merchant')}!"
    }


@app.post("/api/v1/multimodal/voice-to-ledger", tags=["Multimodal Ingestion"])
async def voice_to_ledger(
    file: UploadFile = File(...),
    auto_commit: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Multimodal Voice-to-Ledger Audio Ingestion using Gemini 2.5 Flash Audio.
    Transcribes spoken voice recording, detects financial intent, and records transaction to ledger.
    """
    content = await file.read()
    mime = file.content_type or "audio/webm"
    res = voice_ledger.process_audio_voice_to_ledger(content, mime_type=mime)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to process audio recording."))

    data = res["data"]
    action = res.get("action", "log_expense")
    raw_amt = float(data.get("amount", 0.0))
    curr = data.get("currency", "INR").upper()
    amt_in_inr = raw_amt
    if curr != "INR":
        conv = forex_service.convert_currency(raw_amt, curr, "INR")
        amt_in_inr = conv.get("converted_amount", raw_amt)

    record_id = None
    if auto_commit and amt_in_inr > 0:
        desc = data.get("description", "Voice Transaction")
        cat = data.get("category", "Miscellaneous")
        acc = data.get("account", "Savings Account")
        dt = data.get("date", datetime.date.today().strftime("%Y-%m-%d"))
        rem = f"Voice Ingest | Spoken: \"{res.get('transcript', '')}\""
        if curr != "INR":
            rem += f" | Original: {curr} {raw_amt:.2f}"

        if action == "log_income":
            inc = models.Income(
                date=dt,
                category=cat,
                amount=round(amt_in_inr, 2),
                account=acc,
                description=desc,
                remarks=rem,
                tenant_id=current_user.id
            )
            db.add(inc)
            db.commit()
            db.refresh(inc)
            record_id = inc.id
        else:
            exp = models.Expense(
                date=dt,
                category=cat,
                amount=round(amt_in_inr, 2),
                account=acc,
                description=desc,
                remarks=rem,
                tenant_id=current_user.id
            )
            db.add(exp)
            db.commit()
            db.refresh(exp)
            record_id = exp.id

    return {
        "success": True,
        "action": action,
        "transcript": res.get("transcript"),
        "transaction": data,
        "amount_in_inr": round(amt_in_inr, 2),
        "record_id": record_id,
        "spoken_response": res.get("spoken_response"),
    }


# --- Multi-Currency & Real-Time Forex Support ---

@app.get("/api/v1/forex/rates", tags=["Forex & Currency"])
def get_forex_rates():
    """
    Returns live and cached forex exchange rates across USD, EUR, GBP, AED, SGD, and INR.
    """
    return forex_service.get_forex_overview()


@app.post("/api/v1/forex/convert", tags=["Forex & Currency"])
def convert_forex_amount(payload: dict):
    """
    Converts any amount between any supported currency pair.
    """
    amount = float(payload.get("amount", 0.0))
    from_curr = str(payload.get("from_currency", "INR")).upper()
    to_curr = str(payload.get("to_currency", "USD")).upper()
    return forex_service.convert_currency(amount, from_curr, to_curr)


@app.get("/api/v1/profile/currency", tags=["Forex & Currency"])
def get_user_currency(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Retrieves user's preferred display currency.
    """
    entry = db.query(models.Profile).filter(
        models.Profile.tenant_id == current_user.id,
        models.Profile.key == "preferred_currency"
    ).first()
    currency = entry.value if entry and entry.value else "INR"
    return {"currency": currency}


@app.post("/api/v1/profile/currency", tags=["Forex & Currency"])
@app.put("/api/v1/profile/currency", tags=["Forex & Currency"])
def set_user_currency(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Updates user's preferred display currency in Profile.
    """
    curr = str(payload.get("currency", "INR")).upper().strip()
    if curr not in forex_service.SUPPORTED_CURRENCIES:
        curr = "INR"
    entry = db.query(models.Profile).filter(
        models.Profile.tenant_id == current_user.id,
        models.Profile.key == "preferred_currency"
    ).first()
    if entry:
        entry.value = curr
    else:
        db.add(models.Profile(tenant_id=current_user.id, key="preferred_currency", value=curr))
    db.commit()
    return {"message": f"Preferred currency updated to {curr}", "currency": curr}

@app.get("/api/v1/accounts", tags=["Accounts"])
@app.get("/api/v1/accounts/", tags=["Accounts"])
def get_accounts(db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    return db.query(models.Account).filter(models.Account.tenant_id == current_user.id).all()

@app.post("/api/v1/accounts", tags=["Accounts"])
@app.post("/api/v1/accounts", tags=["Accounts"])
def create_or_update_account(acc: schemas.AccountCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    existing = (
        db.query(models.Account)
        .filter(func.lower(models.Account.name) == acc.name.lower(), models.Account.tenant_id == current_user.id)
        .first()
    )
    if existing:
        existing.account_type = acc.account_type
        existing.initial_balance = acc.initial_balance
    else:
        db.add(models.Account(**acc.model_dump(), tenant_id=current_user.id))
    db.commit()
    return {"message": "Account saved successfully."}

@app.post("/api/v1/balance-adjustments", tags=["Balance"])
def create_balance_adjustment(adj: schemas.BalanceAdjustmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    db.add(models.BalanceAdjustment(**adj.model_dump(), tenant_id=current_user.id))
    db.commit()
    return {"message": "Balance adjustment logged."}

@app.post("/api/v1/budgets", tags=["Budgets"])
def update_budget(budget: schemas.BudgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    existing = (
        db.query(models.Budget)
        .filter(func.lower(models.Budget.category) == budget.category.lower(), models.Budget.tenant_id == current_user.id)
        .first()
    )
    if existing:
        existing.monthly_limit = budget.monthly_limit
    else:
        db.add(models.Budget(category=budget.category, monthly_limit=budget.monthly_limit, tenant_id=current_user.id))
    db.commit()
    return {"message": "Budget updated."}

@app.post("/api/v1/investments", tags=["Investments"])
def create_investment(inv: schemas.InvestmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    cat = inv.category or inv.type or inv.asset_type or "Equity"
    inv_amt = float(inv.invested_amount or inv.current_value or 0.0)
    curr_val = float(inv.current_value or inv_amt or 0.0)
    new_inv = models.Investment(
        name=inv.name,
        category=cat,
        invested_amount=inv_amt,
        current_value=curr_val,
        tenant_id=current_user.id
    )
    db.add(new_inv)
    db.commit()
    return {"message": "Investment added."}

@app.post("/api/v1/goals", tags=["Goals"])
def create_goal(goal: schemas.GoalCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    new_goal = models.Goal(
        name=goal.name,
        target_amount=float(goal.target_amount or 0.0),
        current_amount=float(goal.current_amount or 0.0),
        target_date=goal.target_date,
        tenant_id=current_user.id
    )
    db.add(new_goal)
    db.commit()
    return {"message": "Goal added."}

@app.post("/api/v1/bills", tags=["Bills"])
def create_bill(bill: schemas.BillCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    due_day = bill.due_day
    if (due_day is None or due_day == 1) and bill.due_date:
        try:
            due_day = int(bill.due_date.split("-")[-1])
        except Exception:
            due_day = 1
    new_bill = models.Bill(
        name=bill.name,
        amount=float(bill.amount or 0.0),
        due_day=int(due_day or 1),
        status=bill.status or "Pending",
        tenant_id=current_user.id
    )
    db.add(new_bill)
    db.commit()
    return {"message": "Bill added."}

@app.post("/api/v1/credit-scores", tags=["Credit Score"])
def create_credit_score(score: schemas.CreditScoreCreate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    agency_name = score.agency or score.bureau or "CIBIL"
    new_score = models.CreditScore(
        score=int(score.score),
        date=str(score.date),
        rating=score.rating or "Good",
        agency=agency_name,
        tenant_id=current_user.id
    )
    db.add(new_score)
    db.commit()
    return {"message": "Credit score logged."}

@app.post("/api/v1/profile", tags=["Settings"])
def update_profile(profile: schemas.ProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    existing = (
        db.query(models.Profile)
        .filter(func.lower(models.Profile.key) == profile.key.lower(), models.Profile.tenant_id == current_user.id)
        .first()
    )
    if existing:
        existing.value = profile.value
    else:
        db.add(models.Profile(key=profile.key, value=profile.value, tenant_id=current_user.id))
    db.commit()
    return {"message": "Profile updated."}

# --- System Reset Tool ---

@app.post("/api/v1/system/reset-db", tags=["System"])
def reset_database(current_user: models.User = Depends(dependencies.verify_active_subscription)):
    """Drops all tables and re-creates them cleanly according to models.py."""
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return {"message": "All database tables dropped and cleanly re-created from models.py."}

# --- Phase 2: Decision Intelligence & Scenario Simulation ---

@app.post("/api/v1/intelligence/simulate", tags=["Intelligence"])
def simulate_financial_scenario(
    req: schemas.ScenarioSimulationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    import calendar
    now = datetime.datetime.now()
    current_month_prefix = now.strftime("%Y-%m")

    # Fetch tenant's actual numbers
    accounts = db.query(models.Account).filter(models.Account.tenant_id == current_user.id).all()
    incomes = db.query(models.Income).filter(models.Income.tenant_id == current_user.id).all()
    expenses = db.query(models.Expense).filter(models.Expense.tenant_id == current_user.id).all()
    adjustments = db.query(models.BalanceAdjustment).filter(models.BalanceAdjustment.tenant_id == current_user.id).all()
    bills = db.query(models.Bill).filter(models.Bill.tenant_id == current_user.id).all()
    loans = db.query(models.Loan).filter(models.Loan.tenant_id == current_user.id).all()
    investments = db.query(models.Investment).filter(models.Investment.tenant_id == current_user.id).all()

    total_acc_balance = sum(float(a.initial_balance or 0.0) for a in accounts)
    total_adj = sum(float(ba.amount or 0.0) for ba in adjustments)
    all_time_income = sum(float(i.amount or 0.0) for i in incomes)
    all_time_expenses = sum(float(e.amount or 0.0) for e in expenses)
    liquid_balance = max(0.0, total_acc_balance + all_time_income - all_time_expenses + total_adj)

    # Monthly rates
    curr_expenses = sum(float(e.amount or 0.0) for e in expenses if str(e.date or "").startswith(current_month_prefix))
    curr_income = sum(float(i.amount or 0.0) for i in incomes if str(i.date or "").startswith(current_month_prefix))
    if curr_expenses == 0.0 and expenses:
        latest_date = max((str(e.date or "") for e in expenses if e.date), default="")
        if latest_date:
            curr_expenses = sum(float(e.amount or 0.0) for e in expenses if str(e.date or "").startswith(latest_date[:7]))
    if curr_income == 0.0 and incomes:
        latest_date = max((str(i.date or "") for i in incomes if i.date), default="")
        if latest_date:
            curr_income = sum(float(i.amount or 0.0) for i in incomes if str(i.date or "").startswith(latest_date[:7]))

    fixed_bills = sum(float(b.amount or 0.0) for b in bills if b.status != "Paid")
    scheduled_emis = 0.0
    for l in loans:
        p = float(l.principal or 0.0)
        r = float(l.interest_rate or 0.0)
        n = int(l.tenure_months or ((l.tenure_years or 1.0) * 12))
        if p > 0 and n > 0:
            scheduled_emis += loan_math.calculate_emi(p, r, n)

    total_investments = sum(float(inv.current_value or 0.0) for inv in investments)

    _, last_day = calendar.monthrange(now.year, now.month)
    days_left = max(1, last_day - now.day + 1)

    if req.scenario_type == "car_loan":
        result = simulation_engine.simulate_car_loan(
            current_liquid_balance=liquid_balance,
            current_monthly_income=curr_income,
            current_monthly_expense=curr_expenses,
            days_left_in_cycle=days_left,
            loan_amount=req.loan_amount or 1200000.0,
            down_payment=req.down_payment or 200000.0,
            annual_interest_rate=req.annual_interest_rate or 8.5,
            tenure_months=req.tenure_months or 60,
        )
    elif req.scenario_type == "sabbatical":
        result = simulation_engine.simulate_sabbatical(
            current_liquid_balance=liquid_balance,
            current_monthly_income=curr_income,
            current_monthly_expense=curr_expenses,
            current_fixed_bills=fixed_bills,
            current_emis=scheduled_emis,
            sabbatical_months=req.sabbatical_months or 6,
            income_replacement_pct=req.income_replacement_pct or 0.0,
            discretionary_cut_pct=req.discretionary_cut_pct or 0.20,
            current_investments=total_investments,
        )
    elif req.scenario_type == "sip_boost":
        result = simulation_engine.simulate_sip_boost(
            current_investments=total_investments,
            current_monthly_income=curr_income,
            current_monthly_expense=curr_expenses,
            additional_sip=req.additional_sip or 5000.0,
            expected_cagr_pct=req.expected_cagr_pct or 12.0,
            discretionary_cut=req.expense_cut or 0.0,
            horizon_years=req.horizon_years or 10,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown scenario_type '{req.scenario_type}'. Valid types: 'car_loan', 'sabbatical', 'sip_boost'.")

    return result


@app.get("/api/v1/intelligence/anomalies", tags=["Intelligence"])
def get_anomalies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    expenses = [
        {"id": e.id, "date": e.date, "amount": e.amount, "description": e.description, "category": e.category, "account": e.account}
        for e in db.query(models.Expense).filter(models.Expense.tenant_id == current_user.id).all()
    ]
    bills = [
        {"id": b.id, "name": b.name, "amount": b.amount, "due_day": b.due_day, "status": b.status}
        for b in db.query(models.Bill).filter(models.Bill.tenant_id == current_user.id).all()
    ]

    dismissed_entry = db.query(models.Profile).filter(
        models.Profile.tenant_id == current_user.id,
        models.Profile.key == "dismissed_anomalies"
    ).first()
    dismissed_ids = []
    if dismissed_entry and dismissed_entry.value:
        try:
            dismissed_ids = json.loads(dismissed_entry.value)
        except Exception:
            pass

    detected = anomaly_detector.detect_anomalies(expenses, bills, dismissed_ids)
    return {"anomalies": detected, "count": len(detected)}


@app.post("/api/v1/intelligence/anomalies/dismiss", tags=["Intelligence"])
def dismiss_anomaly(
    req: schemas.AnomalyDismissRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    entry = db.query(models.Profile).filter(
        models.Profile.tenant_id == current_user.id,
        models.Profile.key == "dismissed_anomalies"
    ).first()

    current_list = []
    if entry and entry.value:
        try:
            current_list = json.loads(entry.value)
        except Exception:
            current_list = []

    if req.anomaly_id not in current_list:
        current_list.append(req.anomaly_id)

    if entry:
        entry.value = json.dumps(current_list)
    else:
        new_entry = models.Profile(
            tenant_id=current_user.id,
            key="dismissed_anomalies",
            value=json.dumps(current_list)
        )
        db.add(new_entry)

    db.commit()
    return {"message": "Anomaly dismissed successfully.", "dismissed_id": req.anomaly_id}


@app.post("/api/v1/intelligence/anomalies/seed-test-data", tags=["Intelligence"])
def seed_test_anomalies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    import datetime
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    last_month = today - datetime.timedelta(days=32)
    two_months_ago = today - datetime.timedelta(days=62)

    # Clean existing test entries first
    db.query(models.Expense).filter(
        models.Expense.tenant_id == current_user.id,
        models.Expense.remarks == "TEST_ANOMALY_RECORD"
    ).delete()

    # Reset any dismissed alerts for test
    dismissed_entry = db.query(models.Profile).filter(
        models.Profile.tenant_id == current_user.id,
        models.Profile.key == "dismissed_anomalies"
    ).first()
    if dismissed_entry:
        dismissed_entry.value = "[]"

    test_items = [
        # 1. Duplicate Charge
        models.Expense(
            date=yesterday.strftime("%Y-%m-%d"),
            description="Amazon Prime India",
            amount=1499.0,
            category="Subscriptions",
            account="HDFC Bank",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=current_user.id
        ),
        models.Expense(
            date=today.strftime("%Y-%m-%d"),
            description="Amazon Prime India",
            amount=1499.0,
            category="Subscriptions",
            account="HDFC Bank",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=current_user.id
        ),
        # 2. Subscription Price Creep
        models.Expense(
            date=last_month.strftime("%Y-%m-%d"),
            description="Netflix Premium 4K",
            amount=649.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=current_user.id
        ),
        models.Expense(
            date=today.strftime("%Y-%m-%d"),
            description="Netflix Premium 4K",
            amount=799.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=current_user.id
        ),
        # 3. Zombie Subscription
        models.Expense(
            date=two_months_ago.strftime("%Y-%m-%d"),
            description="Cult.fit Gym & Fitness",
            amount=1499.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=current_user.id
        ),
        models.Expense(
            date=last_month.strftime("%Y-%m-%d"),
            description="Cult.fit Gym & Fitness",
            amount=1499.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=current_user.id
        ),
        models.Expense(
            date=today.strftime("%Y-%m-%d"),
            description="Cult.fit Gym & Fitness",
            amount=1499.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=current_user.id
        ),
    ]

    for item in test_items:
        db.add(item)
    db.commit()

    return {"message": "Test anomalies injected successfully.", "count": len(test_items)}


@app.post("/api/v1/intelligence/anomalies/clear-test-data", tags=["Intelligence"])
def clear_test_anomalies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    deleted = db.query(models.Expense).filter(
        models.Expense.tenant_id == current_user.id,
        models.Expense.remarks == "TEST_ANOMALY_RECORD"
    ).delete()
    db.commit()
    return {"message": "Test anomalies cleared successfully.", "deleted_count": deleted}


# --- Phase 4: Indian Income Tax Regime Optimization Endpoints ---

@app.post("/api/v1/tax/calculate", tags=["Tax Optimization"])
def calculate_tax(
    req: schemas.TaxCalculationRequest,
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Calculates Old vs. New Tax Regime comparison with side-by-side matrices,
    effective rates, savings, and break-even deduction gap.
    """
    return tax_engine.calculate_tax_comparison(
        gross_salary=req.gross_salary,
        basic_salary=req.basic_salary,
        hra_received=req.hra_received or 0.0,
        rent_paid=req.rent_paid or 0.0,
        is_metro=req.is_metro if req.is_metro is not None else True,
        section_80c=req.section_80c or 0.0,
        section_80d_self=req.section_80d_self or 0.0,
        section_80d_parents=req.section_80d_parents or 0.0,
        parents_senior_citizen=bool(req.parents_senior_citizen),
        section_80ccd_1b=req.section_80ccd_1b or 0.0,
        section_24b=req.section_24b or 0.0,
        other_deductions=req.other_deductions or 0.0,
        financial_year=req.financial_year or "2024-2025",
    )


@app.get("/api/v1/tax/profile", response_model=schemas.TaxProfileResponse, tags=["Tax Optimization"])
def get_tax_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Retrieves user's saved tax profile deductions.
    """
    profile = db.query(models.TaxProfile).filter(models.TaxProfile.tenant_id == current_user.id).first()
    if not profile:
        profile = models.TaxProfile(
            tenant_id=current_user.id,
            financial_year="2024-2025",
            gross_salary=1200000.0,
            basic_salary=600000.0,
            hra_received=240000.0,
            rent_paid=240000.0,
            is_metro=True,
            section_80c=150000.0,
            section_80d_self=25000.0,
            section_80d_parents=25000.0,
            parents_senior_citizen=False,
            section_80ccd_1b=50000.0,
            section_24b=0.0,
            other_deductions=0.0,
            preferred_regime="auto",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@app.put("/api/v1/tax/profile", response_model=schemas.TaxProfileResponse, tags=["Tax Optimization"])
@app.post("/api/v1/tax/profile", response_model=schemas.TaxProfileResponse, tags=["Tax Optimization"])
def update_tax_profile(
    payload: schemas.TaxProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Saves or updates user's tax profile deductions.
    """
    profile = db.query(models.TaxProfile).filter(models.TaxProfile.tenant_id == current_user.id).first()
    if not profile:
        profile = models.TaxProfile(tenant_id=current_user.id)
        db.add(profile)

    for field, val in payload.model_dump(exclude_unset=True).items():
        if hasattr(profile, field) and val is not None:
            setattr(profile, field, val)

    db.commit()
    db.refresh(profile)
    return profile


# --- Phase 4: Weekly Executive Financial Briefing Endpoints ---

@app.get("/api/v1/reports/executive-briefing", tags=["Executive Reports"])
def get_executive_briefing(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Computes weekly executive briefing JSON: cash velocity, category leak analyzer,
    7-day upcoming horizon, and Gemini 2.5 Flash AI Pro-Tip.
    """
    return executive_digest.generate_weekly_executive_briefing(
        db=db,
        tenant_id=str(current_user.id),
        ai_client=ai_client,
    )


@app.get("/api/v1/reports/executive-briefing/download", tags=["Executive Reports"])
def download_executive_briefing(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Renders and downloads an executive, print-ready 1-page HTML report.
    """
    briefing = executive_digest.generate_weekly_executive_briefing(
        db=db,
        tenant_id=str(current_user.id),
        ai_client=ai_client,
    )
    html_content = executive_digest.generate_executive_report_html(briefing)
    date_str = datetime.date.today().strftime("%Y%m%d")
    return Response(
        content=html_content,
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="Executive_Briefing_{date_str}.html"',
        },
    )


# --- Phase 4: Autonomous Financial Agent Endpoints ---

@app.get("/api/v1/autonomous/rules", tags=["Autonomous Agent"])
def get_autonomous_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Retrieves user's autonomous agent rules configuration.
    """
    return autonomous_agent.get_or_create_rules(db, str(current_user.id))


@app.post("/api/v1/autonomous/rules", tags=["Autonomous Agent"])
def update_autonomous_rule(
    payload: schemas.AutonomousRuleConfig,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Updates autonomous agent rule parameters.
    """
    return autonomous_agent.update_rule_config(
        db=db,
        tenant_id=str(current_user.id),
        rule_type=payload.rule_type,
        is_enabled=payload.is_enabled,
        config=payload.config,
    )


@app.post("/api/v1/autonomous/evaluate", tags=["Autonomous Agent"])
def evaluate_autonomous_agent(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Executes real-time autonomous evaluation across accounts, budgets, and transactions,
    logging proactive actions and returning complete telemetry.
    """
    return autonomous_agent.run_autonomous_agent_cycle(db, str(current_user.id))


@app.get("/api/v1/autonomous/actions-log", tags=["Autonomous Agent"])
def get_autonomous_actions_log(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Fetches the audit trail of autonomous actions and guardrail alerts.
    """
    logs = (
        db.query(models.AutonomousActionLog)
        .filter(models.AutonomousActionLog.tenant_id == current_user.id)
        .order_by(models.AutonomousActionLog.id.desc())
        .limit(30)
        .all()
    )
    return [
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
        for l in logs
    ]


@app.post("/api/v1/autonomous/actions-log/{action_id}/dismiss", tags=["Autonomous Agent"])
def dismiss_autonomous_action(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription)
):
    """
    Dismisses an autonomous action log.
    """
    log = (
        db.query(models.AutonomousActionLog)
        .filter(models.AutonomousActionLog.id == action_id, models.AutonomousActionLog.tenant_id == current_user.id)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Action log not found.")
    log.status = "dismissed"
    db.commit()
    return {"message": "Action dismissed.", "id": action_id}



# --- Unified Reminder & Daily Status Endpoints ---

@app.get("/api/v1/reminders/status", tags=["Reminders"])
def get_reminders_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription),
):
    """
    Returns unified reminders, overdue bills, bills due today/soon,
    budget warnings, and daily status KPIs for the in-app notification center.
    """
    return reminder_service.get_tenant_reminders_and_status(db, str(current_user.id))


@app.post("/api/v1/reminders/trigger-briefing", tags=["Reminders"])
def trigger_daily_briefing(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.verify_active_subscription),
):
    """
    Triggers an immediate daily briefing push notification to the user's Telegram chat.
    """
    res = reminder_service.send_tenant_daily_briefing(db, str(current_user.id))
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message", "Failed to send briefing."))
    return res


# --- AI Agent Tools ---

@app.post("/api/v1/chat", tags=["AI Agent"])
def chat_with_agent(req: schemas.ChatRequest, db: Session = Depends(get_db), current_user: models.User = Depends(dependencies.verify_active_subscription)):
    if not ai_client:
        return {"reply": "Error: Gemini API key not configured on backend."}

    def get_net_worth_tool() -> str:
        db_session = SessionLocal()
        total_assets = (
            db_session.query(func.sum(models.Investment.current_value)).filter(models.Investment.tenant_id == current_user.id).scalar() or 0.0
        )
        total_debt = db_session.query(func.sum(models.Loan.principal)).filter(models.Loan.tenant_id == current_user.id).scalar() or 0.0
        db_session.close()
        return f"Assets: ₹{total_assets:,.2f}, Debt: ₹{total_debt:,.2f}, Net Worth: ₹{total_assets - total_debt:,.2f}"

    def get_upcoming_bills_tool() -> str:
        db_session = SessionLocal()
        bills = db_session.query(models.Bill).filter(models.Bill.tenant_id == current_user.id).all()
        db_session.close()
        if not bills:
            return "No bills found."
        return "\n".join(
            [f"{b.name}: ₹{b.amount:,.2f} due on day {b.due_day}" for b in bills]
        )

    def simulate_loan_scenario_tool(loan_amount: float = 1200000.0, tenure_months: int = 60, interest_rate: float = 8.5) -> str:
        res = simulation_engine.simulate_car_loan(
            current_liquid_balance=500000.0,
            current_monthly_income=120000.0,
            current_monthly_expense=50000.0,
            days_left_in_cycle=15,
            loan_amount=loan_amount,
            down_payment=loan_amount * 0.15,
            annual_interest_rate=interest_rate,
            tenure_months=tenure_months,
        )
        return f"Monthly EMI: ₹{res['monthly_emi']:,.0f}. Total Interest: ₹{res['total_interest']:,.0f}. Feasibility Score: {res['feasibility_score']}/100 ({res['risk_level']} Risk). Summary: {res['summary']}"

    def compare_debt_payoff_tool(extra_monthly: float = 5000.0) -> str:
        db_session = SessionLocal()
        loans = db_session.query(models.Loan).filter(models.Loan.tenant_id == current_user.id).all()
        db_session.close()
        loans_dict = [
            {"id": l.id, "name": l.name, "principal": l.principal, "interest_rate": l.interest_rate, "tenure_months": l.tenure_months or 60}
            for l in loans
        ]
        res = loan_math.simulate_debt_payoff_matrix(loans_dict, extra_monthly=extra_monthly)
        return f"Total Debt: ₹{res['total_debt']:,.2f}. Snowball: {res['snowball']['total_months']} mos (saves ₹{res['snowball']['total_saved']:,.0f}). Avalanche: {res['avalanche']['total_months']} mos (saves ₹{res['avalanche']['total_saved']:,.0f}). Recommendation: {res['recommendation']}"

    def check_anomalies_tool() -> str:
        db_session = SessionLocal()
        expenses = [
            {"id": e.id, "date": e.date, "amount": e.amount, "description": e.description, "category": e.category}
            for e in db_session.query(models.Expense).filter(models.Expense.tenant_id == current_user.id).all()
        ]
        bills = [
            {"id": b.id, "name": b.name, "amount": b.amount}
            for b in db_session.query(models.Bill).filter(models.Bill.tenant_id == current_user.id).all()
        ]
        db_session.close()
        anoms = anomaly_detector.detect_anomalies(expenses, bills)
        if not anoms:
            return "No suspicious anomalies, price creep, or zombie subscriptions detected."
        return "\n".join([f"[{a['severity'].upper()}] {a['title']}: {a['description']}" for a in anoms[:4]])

    def convert_currency_tool(amount: float = 100.0, from_currency: str = "USD", to_currency: str = "INR") -> str:
        res = forex_service.convert_currency(amount, from_currency, to_currency)
        return f"{amount:,.2f} {res['from_currency']} = {res['formatted']} {res['to_currency']} (Exchange Rate: 1 {res['from_currency']} = {res['exchange_rate']:.4f} {res['to_currency']})"

    def get_forex_rates_tool() -> str:
        overview = forex_service.get_forex_overview()
        rates_str = ", ".join([f"1 {c} = ₹{rate}" for c, rate in overview["rates_in_inr"].items() if c != "INR"])
        return f"Live Forex Exchange Rates (Base: INR): {rates_str}"

    def calculate_tax_comparison_tool(
        gross_salary: float = 1200000.0,
        total_80c: float = 150000.0,
        total_80d: float = 25000.0,
        nps: float = 50000.0,
        home_loan_interest: float = 0.0
    ) -> str:
        res = tax_engine.calculate_tax_comparison(
            gross_salary=gross_salary,
            section_80c=total_80c,
            section_80d_self=total_80d,
            section_80ccd_1b=nps,
            section_24b=home_loan_interest,
        )
        rec = res["recommended_regime"].upper()
        sav = res["savings_amount"]
        old_tax = res["old_regime"]["net_tax_payable"]
        new_tax = res["new_regime"]["net_tax_payable"]
        return (
            f"Tax Comparison (Gross ₹{gross_salary:,.0f}): "
            f"Old Regime Tax: ₹{old_tax:,.0f}, New Regime Tax: ₹{new_tax:,.0f}. "
            f"Recommended: {rec} Tax Regime (saves ₹{sav:,.0f}/yr). "
            f"Break-even deduction gap: ₹{res['break_even']['deduction_gap']:,.0f}."
        )

    def simulate_affordability_tool(expense_amount: float = 25000.0, expense_name: str = "Vacation") -> str:
        db_session = SessionLocal()
        status_data = reminder_service.get_tenant_reminders_and_status(db_session, str(current_user.id))
        db_session.close()
        kpis = status_data.get("kpis", {})
        res = simulation_engine.simulate_discretionary_affordability(
            current_liquid_balance=float(kpis.get("liquid_balance", 50000.0)),
            current_uncommitted=float(kpis.get("uncommitted_balance", 35000.0)),
            days_left_in_cycle=int(status_data.get("days_left_in_cycle", 15)),
            expense_amount=expense_amount,
            expense_name=expense_name,
        )
        return (
            f"Affordability Simulation for {expense_name} (₹{expense_amount:,.0f}): "
            f"Verdict: {res['verdict']} (Score: {res['feasibility_score']}/100, Risk: {res['risk_level']}). "
            f"Daily safe-to-spend shifts from ₹{res['current_safe_to_spend_daily']:,.0f}/day to ₹{res['new_safe_to_spend_daily']:,.0f}/day. "
            f"Remaining cushion: ₹{res['post_expense_uncommitted']:,.0f}. {res['summary']}"
        )

    def simulate_emi_purchase_tool(
        item_cost: float = 80000.0,
        tenure_months: int = 6,
        annual_interest_rate: float = 0.0,
        item_name: str = "Laptop"
    ) -> str:
        db_session = SessionLocal()
        status_data = reminder_service.get_tenant_reminders_and_status(db_session, str(current_user.id))
        total_income = db_session.query(func.sum(models.Income.amount)).filter(models.Income.tenant_id == current_user.id).scalar() or 120000.0
        total_expense = db_session.query(func.sum(models.Expense.amount)).filter(models.Expense.tenant_id == current_user.id).scalar() or 50000.0
        db_session.close()
        kpis = status_data.get("kpis", {})
        res = simulation_engine.simulate_emi_purchase(
            current_liquid_balance=float(kpis.get("liquid_balance", 50000.0)),
            current_monthly_income=float(total_income or 120000.0),
            current_monthly_expense=float(total_expense or 50000.0),
            days_left_in_cycle=int(status_data.get("days_left_in_cycle", 15)),
            item_cost=item_cost,
            tenure_months=tenure_months,
            annual_interest_rate=annual_interest_rate,
            item_name=item_name,
        )
        return (
            f"EMI Purchase Simulation for {item_name} (₹{item_cost:,.0f} over {tenure_months} mos): "
            f"Monthly EMI: ₹{res['monthly_emi']:,.0f}. Total Cost: ₹{res['total_cost']:,.0f} (Interest: ₹{res['total_interest']:,.0f}). "
            f"Feasibility: {res['verdict']} ({res['feasibility_score']}/100, {res['risk_level']} Risk). "
            f"Safe-to-spend impact: -₹{res['daily_safe_impact']:,.0f}/day. Summary: {res['summary']}"
        )

    def simulate_loan_prepayment_tool(
        prepayment_amount: float = 50000.0,
        loan_name: str = "Loan"
    ) -> str:
        db_session = SessionLocal()
        status_data = reminder_service.get_tenant_reminders_and_status(db_session, str(current_user.id))
        loan = (
            db_session.query(models.Loan)
            .filter(models.Loan.tenant_id == current_user.id)
            .first()
        )
        db_session.close()
        p = float(loan.principal) if loan and loan.principal else 500000.0
        r = float(loan.interest_rate) if loan and loan.interest_rate else 9.5
        n = int(loan.tenure_months or ((loan.tenure_years or 5) * 12)) if loan else 48
        name = loan.name if loan and loan.name else loan_name

        kpis = status_data.get("kpis", {})
        res = simulation_engine.simulate_loan_prepayment(
            principal=p,
            annual_interest_rate=r,
            tenure_months=n,
            prepayment_amount=prepayment_amount,
            loan_name=name,
            current_liquid_balance=float(kpis.get("liquid_balance", 0.0)),
        )
        return (
            f"Loan Prepayment Simulation on {name} (Prepay ₹{prepayment_amount:,.0f} against ₹{p:,.0f} principal): "
            f"Interest Saved: ₹{res['interest_saved']:,.0f}. Timeline Knocked Off: {res['months_saved']} months earlier "
            f"(closes in {res['revised_tenure_months']} mos instead of {n}). Feasibility: {res['feasibility_score']}/100. Summary: {res['summary']}"
        )

    try:
        chat = ai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction="You are an elite financial advisor. Use your tools to fetch data, simulate What-If scenarios (affordability, EMI purchase, loan prepayment), check debt strategies, convert currencies, calculate income tax, or detect anomalies ONLY if needed. Be concise and authoritative.",
                tools=[
                    get_net_worth_tool,
                    get_upcoming_bills_tool,
                    simulate_affordability_tool,
                    simulate_emi_purchase_tool,
                    simulate_loan_prepayment_tool,
                    simulate_loan_scenario_tool,
                    compare_debt_payoff_tool,
                    check_anomalies_tool,
                    convert_currency_tool,
                    get_forex_rates_tool,
                    calculate_tax_comparison_tool,
                ],
                temperature=0.2,
            ),
        )
        response = chat.send_message(req.message)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"AI Error: {str(e)}"}

@app.get("/healthz", tags=["System"])
def healthz(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database connection failed")

@app.post("/api/v1/trigger-daily-alert", tags=["System"])
def trigger_alert_now(background_tasks: BackgroundTasks, current_user: models.User = Depends(dependencies.verify_active_subscription)):
    background_tasks.add_task(scheduled_financial_health_check)
    return {"message": "Health check scheduled in background."}

# --- Secured Telegram Webhook ---

@app.post("/api/v1/webhook/telegram", tags=["Telegram Webhook"])
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: Optional[str] = Header(None),
):
    if TELEGRAM_WEBHOOK_SECRET and x_telegram_bot_api_secret_token != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: invalid or missing webhook secret token.",
        )

    try:
        payload = await request.json()
        message = payload.get("message", {})
        sender_id = str(message.get("from", {}).get("id", ""))
        text = message.get("text", "")

        if sender_id and text:
            user = db.query(models.User).filter(models.User.telegram_chat_id == sender_id).first()

            # Auto-link if /start provided
            if text.strip().startswith("/start"):
                parts = text.strip().split()
                target_user = None
                if len(parts) > 1:
                    token = parts[1].strip()
                    target_user = db.query(models.User).filter(models.User.telegram_link_token == token).first()

                if not target_user:
                    target_user = (
                        db.query(models.User)
                        .filter(models.User.telegram_link_token.isnot(None))
                        .order_by(models.User.id.desc())
                        .first()
                    )

                if target_user:
                    # Clear it from any existing user to prevent UniqueViolation when swapping accounts
                    existing_user = db.query(models.User).filter(models.User.telegram_chat_id == sender_id).first()
                    if existing_user and existing_user.id != target_user.id:
                        existing_user.telegram_chat_id = None
                        
                    target_user.telegram_chat_id = sender_id
                    target_user.telegram_link_token = None
                    db.commit()
                    notification_dispatcher.send_telegram_alert_direct(
                        chat_id=sender_id,
                        text="🎉 *Telegram Connected Successfully!*\n\nYour account is now linked to your Personal AI Financial Advisor. You'll receive your 8:00 AM Morning Pulse and due reminders right here.",
                    )
                    return {"status": "linked"}
                elif not user:
                    send_telegram_alert(
                        f"👋 Hello! Your Telegram Chat ID is: `{sender_id}`\n\n"
                        "To link your account, either:\n"
                        "1. Click 'Connect Telegram' from your Financial Dashboard, or\n"
                        f"2. Enter Chat ID `{sender_id}` in your Dashboard Notification Settings under 'Advanced: Enter Telegram Chat ID'.",
                        sender_id,
                    )
                    return {"status": "unlinked_notified"}

            if user:
                background_tasks.add_task(async_process_telegram_message, text, str(user.id), sender_id)
            else:
                print(f"Unauthorized Telegram webhook from {sender_id}")
    except Exception as e:
        print(f"Webhook processing error: {e}")

    return {"status": "received"}


# --- Production WhatsApp Webhooks (Meta Cloud API & Twilio) ---

@app.get("/api/v1/webhook/whatsapp", tags=["WhatsApp Webhook"])
def verify_whatsapp_webhook(request: Request):
    """
    Meta WhatsApp Cloud API Webhook Verification Endpoint.
    Meta sends hub.mode, hub.verify_token, and hub.challenge during webhook registration.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    configured_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "advisor_webhook_secret_2026")
    if mode == "subscribe" and token == configured_token:
        return Response(content=challenge or "", media_type="text/plain")
    raise HTTPException(status_code=403, detail="WhatsApp webhook verification token mismatch")


@app.post("/api/v1/webhook/whatsapp", tags=["WhatsApp Webhook"])
async def receive_whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Unified Inbound Webhook for WhatsApp.
    Supports both Meta WhatsApp Cloud API (JSON) and Twilio WhatsApp Webhooks (Form Data).
    """
    from_phone = ""
    user_text = ""

    content_type = request.headers.get("content-type", "")

    # 1. Twilio Form Data / x-www-form-urlencoded
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form_data = await request.form()
        raw_from = str(form_data.get("From", ""))
        from_phone = whatsapp_service.clean_phone_number(raw_from)
        user_text = str(form_data.get("Body", "")).strip()

    # 2. Meta WhatsApp Cloud API (JSON)
    else:
        try:
            payload = await request.json()
            entry = payload.get("entry", [])
            if entry:
                changes = entry[0].get("changes", [])
                if changes:
                    value = changes[0].get("value", {})
                    messages = value.get("messages", [])
                    if messages:
                        msg_obj = messages[0]
                        from_phone = whatsapp_service.clean_phone_number(msg_obj.get("from", ""))
                        m_type = msg_obj.get("type", "text")
                        if m_type == "text":
                            user_text = msg_obj.get("text", {}).get("body", "").strip()
                        elif m_type == "interactive":
                            interactive = msg_obj.get("interactive", {})
                            b_reply = interactive.get("button_reply", {})
                            user_text = b_reply.get("id", "") or b_reply.get("title", "")
                        elif m_type == "button":
                            user_text = msg_obj.get("button", {}).get("text", "")
        except Exception as e:
            print(f"Error parsing Meta WhatsApp JSON payload: {e}")

    if not from_phone or not user_text:
        return {"status": "ignored", "reason": "no valid sender or message body"}

    # Match user by phone number
    user = db.query(models.User).filter(models.User.whatsapp_phone_number == from_phone).first()
    if not user and len(from_phone) >= 10:
        last10 = from_phone[-10:]
        user = db.query(models.User).filter(models.User.whatsapp_phone_number.like(f"%{last10}%")).first()

    # Development / Single active user fallback
    if not user:
        user = db.query(models.User).filter(models.User.is_active == True).first()

    if not user:
        print(f"WhatsApp message from unregistered number: {from_phone}")
        return {"status": "unregistered_sender"}

    background_tasks.add_task(
        async_process_whatsapp_message,
        user_text,
        str(user.id),
        from_phone,
    )
    return {"status": "received", "from": from_phone}


# --- Notification Channel Preferences Endpoints ---

@app.get("/api/v1/notifications/preferences", response_model=schemas.NotificationPreferencesResponse, tags=["Notifications"])
def get_notification_preferences(
    current_user: models.User = Depends(dependencies.get_current_user),
):
    """Fetches user notification preferences including WhatsApp and Telegram linkage."""
    return schemas.NotificationPreferencesResponse(
        whatsapp_phone_number=current_user.whatsapp_phone_number,
        notification_channel=current_user.notification_channel or "both",
        preferred_briefing_time=current_user.preferred_briefing_time or "08:00",
        telegram_connected=bool(current_user.telegram_chat_id),
        telegram_chat_id=current_user.telegram_chat_id,
        whatsapp_connected=bool(current_user.whatsapp_phone_number and len(current_user.whatsapp_phone_number) >= 8),
    )


@app.put("/api/v1/notifications/preferences", response_model=schemas.NotificationPreferencesResponse, tags=["Notifications"])
def update_notification_preferences(
    prefs: schemas.NotificationPreferencesUpdate,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: Session = Depends(get_db),
):
    """Updates user notification preferences (channel choice, WhatsApp phone, briefing time)."""
    if prefs.notification_channel is not None:
        ch = prefs.notification_channel.lower().strip()
        if ch not in ["whatsapp", "telegram", "both", "in_app"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid channel. Must be one of: 'whatsapp', 'telegram', 'both', 'in_app'"
            )
        current_user.notification_channel = ch

    if prefs.whatsapp_phone_number is not None:
        cleaned = whatsapp_service.clean_phone_number(prefs.whatsapp_phone_number)
        current_user.whatsapp_phone_number = cleaned

    if prefs.preferred_briefing_time is not None:
        current_user.preferred_briefing_time = prefs.preferred_briefing_time.strip()

    if prefs.telegram_chat_id is not None:
        t_id = prefs.telegram_chat_id.strip()
        current_user.telegram_chat_id = t_id if t_id else None

    db.commit()
    db.refresh(current_user)

    return schemas.NotificationPreferencesResponse(
        whatsapp_phone_number=current_user.whatsapp_phone_number,
        notification_channel=current_user.notification_channel or "both",
        preferred_briefing_time=current_user.preferred_briefing_time or "08:00",
        telegram_connected=bool(current_user.telegram_chat_id),
        telegram_chat_id=current_user.telegram_chat_id,
        whatsapp_connected=bool(current_user.whatsapp_phone_number and len(current_user.whatsapp_phone_number) >= 8),
    )


@app.post("/api/v1/notifications/telegram-auth", tags=["Notifications"])
def verify_telegram_auth(
    payload: schemas.TelegramAuthPayload,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: Session = Depends(get_db),
):
    """Verifies Telegram Login Widget payload and links the account."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        raise HTTPException(status_code=500, detail="Bot token not configured")

    # 1. Verify Hash
    data = payload.dict(exclude={"hash"}, exclude_none=True)
    data_check_string = '\n'.join([f"{k}={v}" for k, v in sorted(data.items())])
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if expected_hash != payload.hash:
        raise HTTPException(status_code=401, detail="Invalid Telegram authentication hash")

    # 2. Check for expiration (optional, e.g., 24 hours)
    import time
    if time.time() - payload.auth_date > 86400:
        raise HTTPException(status_code=401, detail="Authentication data expired")

    # 3. Link account
    sender_id = str(payload.id)
    
    # Clear from any existing user to prevent UniqueViolation
    existing_user = db.query(models.User).filter(models.User.telegram_chat_id == sender_id).first()
    if existing_user and existing_user.id != current_user.id:
        existing_user.telegram_chat_id = None
        
    current_user.telegram_chat_id = sender_id
    db.commit()

    # 4. Dispatch Welcome Message (Allowed because widget requests write access)
    notification_dispatcher.send_telegram_alert_direct(
        chat_id=sender_id,
        text="🎉 *Telegram Connected Successfully!*\n\nYour account is now securely linked via Telegram Login. You'll receive your Morning Pulse and alerts right here.",
    )

    return {"status": "linked"}


@app.post("/api/v1/notifications/test-whatsapp", tags=["Notifications"])
def test_whatsapp_notification(
    req: schemas.TestNotificationRequest,
    current_user: models.User = Depends(dependencies.get_current_user),
):
    """Dispatches an immediate live test alert to verify WhatsApp integration."""
    target_phone = req.recipient or current_user.whatsapp_phone_number
    if not target_phone:
        raise HTTPException(
            status_code=400,
            detail="No WhatsApp phone number provided or linked to account."
        )

    test_msg = (
        "🔔 *Personal AI Advisor: Live WhatsApp Test Alert*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "✅ *Integration Verified!* Your WhatsApp number is actively connected to your Financial Advisor.\n\n"
        "You will receive your 8:00 AM Morning Pulse, Overdue Bill alerts, and Cashflow Runways right here.\n\n"
        "💬 *Quick reply test:* Try replying *STATUS*, *BILLS*, or *RADAR*."
    )
    res = whatsapp_service.send_whatsapp_message(
        target_phone, test_msg, quick_replies=["Status", "Bills", "Radar"]
    )
    if res.get("status") == "error":
        err_msg = res.get("error_message") or res.get("error")
        if isinstance(err_msg, dict):
            err_msg = err_msg.get("error", {}).get("message") or str(err_msg)
        raise HTTPException(
            status_code=502,
            detail=f"WhatsApp delivery failed: {err_msg}"
        )
    return {"status": "sent", "provider": res.get("provider"), "details": res}


@app.post("/api/v1/notifications/test-telegram", tags=["Notifications"])
def test_telegram_notification(
    current_user: models.User = Depends(dependencies.get_current_user),
):
    """Dispatches an immediate live test alert to verify Telegram integration."""
    chat_id = current_user.telegram_chat_id
    if not chat_id:
        raise HTTPException(
            status_code=400,
            detail="No Telegram account connected. Click 'Connect Telegram' first."
        )

    test_msg = (
        "🔔 *Personal AI Advisor: Live Telegram Test Alert*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "✅ *Integration Verified!* Your Telegram is connected.\n\n"
        "You will receive your Morning Pulse and 1-tap bill settlement buttons here."
    )
    res = notification_dispatcher.send_telegram_alert_direct(chat_id=chat_id, text=test_msg)
    if res.get("status") == "error":
        raise HTTPException(
            status_code=502,
            detail=f"Telegram delivery failed: {res.get('error')}"
        )
    return {"status": "sent", "chat_id": chat_id}

# --- Authentication Endpoints ---

@app.post("/api/v1/auth/register", response_model=schemas.UserResponse, tags=["Authentication"])
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_pwd = auth.get_password_hash(user_in.password)
    
    new_user = models.User(
        email=user_in.email,
        hashed_password=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/v1/auth/login", response_model=schemas.Token, tags=["Authentication"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
        
    access_token = auth.create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/v1/auth/me", tags=["Authentication"])
def get_current_user_info(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    subscription = db.query(models.Subscription).filter(models.Subscription.tenant_id == current_user.id).first()
    
    if subscription and subscription.razorpay_subscription_id and subscription.status != "active":
        rzp_client = billing.get_rzp_client()
        if rzp_client:
            try:
                rzp_sub = rzp_client.subscription.fetch(subscription.razorpay_subscription_id)
                if subscription.status != rzp_sub["status"]:
                    subscription.status = rzp_sub["status"]
                    db.commit()
                    db.refresh(subscription)
            except Exception:
                pass

    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "subscription_status": subscription.status if subscription else "inactive"
    }