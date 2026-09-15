import os
import sys
import time
import json
import re
import datetime

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from typing import Dict, Any, List, Optional, Tuple
import requests
from dotenv import load_dotenv
from google import genai

# Enterprise Database Imports
from currency_utils import format_amount
from database import SessionLocal
import models
from sqlalchemy import func
import voice_ledger
import receipt_scanner
import executive_digest
import tax_engine
import reminder_service
import simulation_engine
import loan_math
import recurring_radar

load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def send_message(text: str, chat_id: str = None, reply_markup: dict = None):
    target_chat = chat_id or TELEGRAM_CHAT_ID
    if not TELEGRAM_BOT_TOKEN or not target_chat:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": target_chat,
        "text": text,
        "parse_mode": "Markdown",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Failed to send Telegram message: {e}")


def answer_callback_query(callback_query_id: str, text: str = "Processing..."):
    if not TELEGRAM_BOT_TOKEN or not callback_query_id:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery"
    try:
        requests.post(url, json={"callback_query_id": callback_query_id, "text": text}, timeout=5)
    except Exception as e:
        print(f"Failed to answer callback query: {e}")


def get_user_for_chat(db, chat_id: str):
    user = db.query(models.User).filter(models.User.telegram_chat_id == str(chat_id)).first()
    if not user:
        user = db.query(models.User).filter(models.User.is_active == True).first()
    return user


def check_budget_threshold_alert(db, category_name: str, tenant_id: str):
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
    elif pct >= 80.0:
        return (
            f"⚠️ *Budget Warning (80%+ Reached)!*\n"
            f"• Category: *{budget.category}*\n"
            f"• Spent: ₹{spent:,.2f} of ₹{budget.monthly_limit:,.2f} ({pct:.1f}%)"
        )
    return None


def get_financial_context(tenant_id: str) -> str:
    db = SessionLocal()
    total_assets = (
        db.query(func.sum(models.Investment.current_value))
        .filter(models.Investment.tenant_id == tenant_id)
        .scalar()
        or 0.0
    )
    total_debt = (
        db.query(func.sum(models.Loan.principal))
        .filter(models.Loan.tenant_id == tenant_id)
        .scalar()
        or 0.0
    )
    db.close()
    return f"- Net Worth: ₹{total_assets - total_debt:,.2f} (Assets: ₹{total_assets:,.2f}, Debt: ₹{total_debt:,.2f})"


def handle_what_if_scenario(db, tenant_id: str, data: Dict[str, Any]) -> str:
    """
    Executes deterministic mathematical simulations for What-If scenario queries.
    Supports:
      - Affordability (vacation, one-time luxury, discretionary spending)
      - EMI Purchases (laptop, gadgets, appliances)
      - Loan Prepayment (car loan, home loan, debt reduction)
    """
    st = str(data.get("scenario_type", "affordability")).lower()
    amt = float(data.get("amount", 0.0) or 0.0)
    name = str(data.get("name", "")).strip().title() or "Expense"
    tenure = int(data.get("tenure_months", 6) or 6)
    rate = float(data.get("annual_interest_rate", 0.0) or 0.0)

    status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
    kpis = status_data.get("kpis", {})

    if any(k in st for k in ["afford", "vacation", "discretionary", "trip", "purchase"]):
        res = simulation_engine.simulate_discretionary_affordability(
            current_liquid_balance=float(kpis.get("liquid_balance", 0.0)),
            current_uncommitted=float(kpis.get("uncommitted_balance", 0.0)),
            days_left_in_cycle=int(status_data.get("days_left_in_cycle", 15)),
            expense_amount=amt,
            expense_name=name or "Vacation",
        )
        badge = "🟢" if res["risk_level"] == "Low" else ("🟡" if res["risk_level"] == "Moderate" else "🔴")
        return (
            f"🔮 *What-If Scenario: Affordability Check*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯 *Item / Trip:* {res['expense_name']} (₹{res['expense_amount']:,.2f})\n"
            f"{badge} *Verdict:* *{res['verdict']}* (Feasibility: {res['feasibility_score']}/100, {res['risk_level']} Risk)\n\n"
            f"📉 *Liquidity Impact:*\n"
            f"• Current Cushion: ₹{res['current_uncommitted']:,.2f}\n"
            f"• Post-Purchase Cushion: ₹{res['post_expense_uncommitted']:,.2f}\n"
            f"• Daily Safe-to-Spend: ₹{res['current_safe_to_spend_daily']:,.2f}/day ➔ *₹{res['new_safe_to_spend_daily']:,.2f}/day* (-{res['burn_reduction_pct']}%)\n\n"
            f"💡 *Advisor Recommendation:*\n"
            f"_{res['summary']}_"
        )

    elif any(k in st for k in ["emi", "laptop", "financing", "monthly"]):
        total_income = (
            db.query(func.sum(models.Income.amount)).filter(models.Income.tenant_id == tenant_id).scalar() or 120000.0
        )
        total_expense = (
            db.query(func.sum(models.Expense.amount)).filter(models.Expense.tenant_id == tenant_id).scalar() or 50000.0
        )
        res = simulation_engine.simulate_emi_purchase(
            current_liquid_balance=float(kpis.get("liquid_balance", 0.0)),
            current_monthly_income=float(total_income),
            current_monthly_expense=float(total_expense),
            days_left_in_cycle=int(status_data.get("days_left_in_cycle", 15)),
            item_cost=amt,
            tenure_months=tenure,
            annual_interest_rate=rate,
            item_name=name or "Item",
        )
        badge = "🟢" if res["risk_level"] == "Low" else ("🟡" if res["risk_level"] == "Moderate" else "🔴")
        return (
            f"🔮 *What-If Scenario: EMI Purchase Analysis*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"📦 *Item:* {res['item_name']} (Total Cost: ₹{res['total_cost']:,.2f})\n"
            f"⏱️ *Financing:* {res['tenure_months']} months @ {res['annual_interest_rate']}% APR\n"
            f"{badge} *Verdict:* *{res['verdict']}* (Feasibility Score: {res['feasibility_score']}/100)\n\n"
            f"💳 *Cashflow Impact:*\n"
            f"• Monthly EMI: *₹{res['monthly_emi']:,.2f}*\n"
            f"• Total Interest: ₹{res['total_interest']:,.2f}\n"
            f"• Surplus Remainder: ₹{res['scenario_monthly_surplus']:,.2f}/month\n"
            f"• Discretionary Allowance Drain: -₹{res['daily_safe_impact']:,.2f}/day\n\n"
            f"💡 *Advisor Recommendation:*\n"
            f"_{res['summary']}_"
        )

    elif any(k in st for k in ["prepay", "loan", "debt"]):
        loan = db.query(models.Loan).filter(models.Loan.tenant_id == tenant_id).first()
        p = float(loan.principal) if loan and loan.principal else 500000.0
        r = float(loan.interest_rate) if loan and loan.interest_rate else 9.5
        n = int(loan.tenure_months or ((loan.tenure_years or 5) * 12)) if loan else 48
        loan_title = loan.name if loan and loan.name else name or "Car Loan"

        res = simulation_engine.simulate_loan_prepayment(
            principal=p,
            annual_interest_rate=r,
            tenure_months=n,
            prepayment_amount=amt,
            loan_name=loan_title,
            current_liquid_balance=float(kpis.get("liquid_balance", 0.0)),
        )
        return (
            f"🔮 *What-If Scenario: Loan Prepayment Simulator*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏦 *Target Loan:* {res['loan_name']} (Principal: ₹{res['original_principal']:,.2f})\n"
            f"💰 *Lump-Sum Prepayment:* ₹{res['prepayment_amount']:,.2f}\n\n"
            f"🎉 *Impact & Savings:*\n"
            f"• Future Interest Saved: *₹{res['interest_saved']:,.2f}*\n"
            f"• Freedom Accelerated: *{res['months_saved']} months knocked off!*\n"
            f"• New Closure Horizon: {res['revised_tenure_months']} months (was {res['original_tenure_months']} mos)\n\n"
            f"💡 *Advisor Recommendation:*\n"
            f"_{res['summary']}_"
        )

    return "Unable to compute scenario."


def format_discovered_subscriptions_telegram(discovered: List[Dict[str, Any]]) -> tuple[str, Optional[dict]]:
    """
    Formats discovered subscriptions into Telegram Markdown with 1-click tracking inline buttons.
    """
    if not discovered:
        return (
            "🤖 *AI Subscription Auto-Discovery Radar*\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "✅ *Radar Clean!* No untracked recurring subscriptions detected in your recent transactions.\n"
            "All monthly bills appear to be actively tracked.",
            None
        )

    lines = [
        "🤖 *AI Subscription Auto-Discovery Radar*",
        "━━━━━━━━━━━━━━━━━━━━━",
        f"I analyzed your transaction history and detected *{len(discovered)} recurring subscription(s)* not yet tracked:\n",
    ]
    keyboard = []
    for d in discovered[:4]:
        lines.append(
            f"• 🔍 *{d['name']}*: ₹{d['amount']:,.2f}/mo (Due Day {d['detected_due_day']}, *{d['confidence_label']}* confidence)"
        )
        keyboard.append([
            {
                "text": f"✅ Track: {d['name']} (₹{d['amount']:,.0f})",
                "callback_data": f"track_disc:{d['name'][:18]}:{d['amount']}:{d['detected_due_day']}",
            }
        ])

    lines.append("\n💡 _Tap a button below to track the bill with 1 click for calendar reminders & auto-ledger settlement._")
    keyboard.append([{"text": "📅 View Existing Bills", "callback_data": "pending_bills"}])
    return "\n".join(lines), {"inline_keyboard": keyboard}


def process_with_gemini(user_text: str, chat_id: str):
    """
    Processes incoming text using Gemini 2.5 Flash, routing to:
      1. settle_bill: marks bill as paid AND auto-records expense to ledger
      2. add_bill: creates recurring bill reminder
      3. daily_status: returns real-time cash, safe-to-spend, and reminders
      4. list_bills: returns pending and overdue bills
      5. log_expense: logs general expense
      6. log_income: logs income
      7. chat: general financial advisory
    Returns a tuple of (reply_text, optional_reply_markup).
    """
    if not client:
        return "Gemini API key is not configured.", None

    db = SessionLocal()

    # Check for /start deep linking token
    if user_text.strip().startswith("/start"):
        parts = user_text.strip().split()
        if len(parts) > 1:
            token = parts[1].strip()
            target_user = db.query(models.User).filter(models.User.telegram_link_token == token).first()
            if target_user:
                target_user.telegram_chat_id = str(chat_id)
                target_user.telegram_link_token = None
                db.commit()
                db.close()
                welcome_msg = (
                    f"🎉 *Telegram Account Successfully Linked!*\n"
                    f"━━━━━━━━━━━━━━━━━━━━━\n"
                    f"Welcome, *{target_user.email}*! Your Telegram is now connected to your Personal AI Financial Advisor.\n\n"
                    f"You will receive your 8:00 AM Morning Pulse, Overdue Bill alerts, and Cashflow Runway warnings here.\n\n"
                    f"💬 *Try tapping a button below to get started:*"
                )
                return welcome_msg, {
                    "inline_keyboard": [
                        [{"text": "📊 View Daily Status", "callback_data": "daily_status"}],
                        [{"text": "📅 View Pending Bills", "callback_data": "pending_bills"}],
                    ]
                }

    user = get_user_for_chat(db, chat_id)
    if not user:
        db.close()
        return "No active user account found in database. Please register first.", None

    tenant_id = user.id
    today = datetime.date.today().strftime("%Y-%m-%d")
    user_clean = user_text.strip().lower()

    # Fast-path command handlers
    if user_clean in ["/digest", "digest", "/briefing", "briefing"]:
        try:
            briefing = executive_digest.generate_weekly_executive_briefing(db, str(tenant_id), client)
            cv = briefing["cash_velocity"]
            uh = briefing["upcoming_horizon"]
            leaks = briefing["category_leaks"]["leaks"]
            pro_tip = briefing["ai_pro_tip"]

            lines = [
                "⚡ *Executive Financial Briefing*",
                f"📅 _{briefing['date_range']}_\n",
                "💰 *Weekly Cash Velocity:*",
                f"• Inflow: ₹{cv['weekly_inflow']:,.2f}",
                f"• Outflow: ₹{cv['weekly_outflow']:,.2f} ({cv['wow_expense_change_pct']:+.1f}% vs prior week)",
                f"• Net Velocity: ₹{cv['net_weekly_cashflow']:,.2f} ({cv['status']})\n",
                "🔍 *Category Leak Radar:*",
            ]
            if leaks:
                for l in leaks[:3]:
                    lines.append(f"• 🚨 *{l['category']}*: ₹{l['current_7d_spend']:,.0f} (+{l['surge_pct']:.0f}% over baseline)")
            else:
                lines.append("• ✅ No category spending surges detected.")

            lines.append(f"\n📅 *Upcoming 7-Day Horizon:*")
            lines.append(f"• Committed Bills: ₹{uh['total_bills_due']:,.2f}")
            lines.append(f"• Projected 7D Liquidity: ₹{uh['projected_7d_liquidity']:,.2f} ({uh['liquidity_status']})\n")
            lines.append("🤖 *AI Pro-Tip:*")
            lines.append(f"_{pro_tip}_")

            db.close()
            return "\n".join(lines), None
        except Exception as d_err:
            db.close()
            return f"Error generating executive briefing: {d_err}", None

    if user_clean in ["/status", "status", "daily status", "today status", "my status"]:
        status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
        user_name = user.email.split("@")[0].capitalize() if user.email else ""
        msg = reminder_service.format_daily_status_telegram_message(status_data, user_name)
        actionable_bills = status_data["bills"].get("overdue_bills", []) + status_data["bills"].get("due_today_bills", [])
        markup = reminder_service.build_bills_inline_keyboard(actionable_bills)
        db.close()
        return msg, markup

    if user_clean in ["/bills", "bills", "pending bills", "due bills", "what bills are due"]:
        status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
        msg, markup = reminder_service.format_pending_bills_telegram_message(status_data)
        db.close()
        return msg, markup

    # Fast-path: AI Recurring Radar
    if user_clean in ["/radar", "radar", "discover subscriptions", "untracked bills", "detected bills", "find bills", "show subscriptions"]:
        disc = recurring_radar.discover_recurring_charges(db, str(tenant_id))
        msg, markup = format_discovered_subscriptions_telegram(disc)
        db.close()
        return msg, markup

    # Fast-path: What-If Affordability Check
    afford_match = re.search(r"(?:can\s+(?:i|we)\s+afford|afford)\s+(?:a\s+|an\s+)?(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:for\s+a\s+|for\s+|on\s+a\s+|on\s+)?([a-zA-Z\s]+)?", user_clean)
    if afford_match:
        raw_amt = afford_match.group(1).replace(",", "")
        raw_name = (afford_match.group(2) or "Purchase").strip().title()
        try:
            amt = float(raw_amt)
            reply = handle_what_if_scenario(db, str(tenant_id), {
                "scenario_type": "affordability",
                "amount": amt,
                "name": raw_name,
            })
            db.close()
            return reply, None
        except Exception:
            pass

    # Fast-path: What-If EMI purchase
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
        reply = handle_what_if_scenario(db, str(tenant_id), {
            "scenario_type": "emi",
            "amount": amt,
            "tenure_months": tenure,
            "annual_interest_rate": 0.0 if "no cost" in user_clean else 12.0,
            "name": name,
        })
        db.close()
        return reply, None

    # Fast-path: What-If Loan Prepayment
    prepay_match = re.search(r"prepay\s+(?:₹|rs\.?|inr)?\s*([\d,]+)", user_clean)
    if prepay_match:
        amt = float(prepay_match.group(1).replace(",", ""))
        loan_name = "Car Loan" if "car" in user_clean else ("Home Loan" if "home" in user_clean else "Loan")
        reply = handle_what_if_scenario(db, str(tenant_id), {
            "scenario_type": "prepayment",
            "amount": amt,
            "name": loan_name,
        })
        db.close()
        return reply, None

    # Contextual Gemini Intent Routing
    context = get_financial_context(tenant_id)

    prompt = f"""
    You are an intelligent AI financial assistant on Telegram. Today is {today}. Context: {context}
    User Message: "{user_text}"

    Classify the user message into ONE of the following JSON schemas (return pure JSON with no backticks):

    1. Settle a recurring bill (e.g. "paid electricity bill 1450", "mark netflix as paid", "cleared broadband 999", "settled gym 2500", "paid my bill"):
       {{"type": "settle_bill", "bill_name": "electricity", "amount": 1450.0, "account": "ICICI Savings Account"}}

    2. Add/track a recurring bill or reminder (e.g. "remind me to pay gym 2500 on the 10th", "add bill wifi 999 due on 15th", "new bill rent 25000 due day 5"):
       {{"type": "add_bill", "name": "Gym Membership", "amount": 2500.0, "due_day": 10, "category": "Fitness"}}

    3. Daily status, safe-to-spend, or financial health query (e.g. "what can I spend today?", "how is my budget?", "daily status", "safe to spend allowance"):
       {{"type": "daily_status"}}

    4. Inquire about pending dues or upcoming bills (e.g. "what bills do I have?", "any upcoming dues?", "show pending bills"):
       {{"type": "list_bills"}}

    5. Logging a general expense (e.g. "spent 250 on coffee", "paid 1500 for groceries", "bought shoes for 3500"):
       {{"type": "log_expense", "amount": 250.0, "description": "coffee", "category": "Food & Dining", "account": "ICICI Savings Account"}}

    6. Logging an income (e.g. "got 50000 salary", "received 2000 dividend", "freelance income 15000"):
       {{"type": "log_income", "amount": 50000.0, "description": "salary", "category": "Salary", "account": "ICICI Savings Account"}}

    7. What-If Scenario simulation (e.g. "Can I afford a ₹25,000 vacation this weekend?", "What happens if I buy a laptop for ₹80,000 on a 6-month EMI?", "What if I prepay ₹50,000 on my car loan?"):
       {{"type": "what_if_scenario", "scenario_type": "affordability" | "emi" | "prepayment", "amount": 25000.0, "tenure_months": 6, "annual_interest_rate": 0.0, "name": "vacation / laptop / car loan"}}

    8. Discovered recurring bills or subscriptions query (e.g. "discover subscriptions", "untracked bills", "scan recurring bills"):
       {{"type": "discover_bills"}}

    9. General financial advice or conversational query:
       {{"type": "chat", "reply": "Your markdown answer."}}
    """

    try:
        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        cleaned = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        intent = data.get("type")

        # 1. SETTLE BILL
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
                db.close()

                exp_amt = res["created_expense"]["amount"] if res.get("created_expense") else matched_bill.amount
                reply = (
                    f"✅ *Bill Settled & Recorded in Ledger!*\n"
                    f"• Bill: *{matched_bill.name}*\n"
                    f"• Amount: ₹{exp_amt:,.2f}\n"
                    f"• Account: {acc}\n"
                    f"• Status: Paid\n"
                    f"• Ledger: Expense added to Utilities & Bills\n\n"
                    f"💡 _Your uncommitted balance has been updated._"
                )
                markup = {
                    "inline_keyboard": [
                        [{"text": "📊 View Updated Status", "callback_data": "daily_status"}],
                        [{"text": "📅 View Remaining Bills", "callback_data": "pending_bills"}],
                    ]
                }
                return reply, markup
            else:
                # No matching bill found in registered bills
                if amt > 0:
                    # Fallback: record as expense anyway so user transaction is not lost
                    desc = f"Payment: {bill_name.capitalize() if bill_name else 'Bill'}"
                    db.add(models.Expense(
                        date=today,
                        description=desc,
                        amount=amt,
                        category="Utilities",
                        account=acc,
                        tenant_id=tenant_id,
                        remarks="Logged via Telegram (no matching recurring bill record)",
                    ))
                    db.commit()
                    db.close()
                    reply = (
                        f"✅ *Expense Logged (No Registered Bill Found):*\n"
                        f"• {desc}: ₹{amt:,.2f} (Utilities)\n"
                        f"• Account: {acc}\n\n"
                        f"ℹ️ _Tip: To register this as a recurring monthly bill, say:_ \n"
                        f"_\"Add bill {bill_name or 'Broadband'} {amt:.0f} on 10th\"_"
                    )
                    return reply, None
                else:
                    db.close()
                    return f"I couldn't find an unpaid bill matching *'{bill_name}'*. Say *'What bills are due?'* to view your pending dues.", None

        # 2. ADD RECURRING BILL
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
            db.close()

            b_info = res["bill"]
            reply = (
                f"📅 *New Recurring Bill Tracked!*\n"
                f"• Bill: *{b_info['name']}*\n"
                f"• Amount: ₹{b_info['amount']:,.2f}\n"
                f"• Due Day: Day {b_info['due_day']} of every month\n"
                f"• Schedule: {b_info['label']} ({b_info['next_due_date']})\n"
                f"• Reminders: You will receive morning alerts when this bill is due."
            )
            markup = {
                "inline_keyboard": [
                    [{"text": "📅 View All Bills", "callback_data": "pending_bills"}],
                    [{"text": "📊 View Daily Status", "callback_data": "daily_status"}],
                ]
            }
            return reply, markup

        # 3. DAILY STATUS
        elif intent == "daily_status":
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            user_name = user.email.split("@")[0].capitalize() if user.email else ""
            msg = reminder_service.format_daily_status_telegram_message(status_data, user_name)
            actionable_bills = status_data["bills"].get("overdue_bills", []) + status_data["bills"].get("due_today_bills", [])
            markup = reminder_service.build_bills_inline_keyboard(actionable_bills)
            db.close()
            return msg, markup

        # 4. LIST BILLS
        elif intent == "list_bills":
            status_data = reminder_service.get_tenant_reminders_and_status(db, str(tenant_id))
            msg, markup = reminder_service.format_pending_bills_telegram_message(status_data)
            db.close()
            return msg, markup

        # 5. LOG EXPENSE
        elif intent == "log_expense":
            amt = float(data.get("amount", 0.0))
            desc = data.get("description", "Expense").capitalize()
            cat = data.get("category", "General").capitalize()
            acc = data.get("account", "ICICI Savings Account")

            db.add(
                models.Expense(
                    date=today,
                    description=desc,
                    amount=amt,
                    category=cat,
                    account=acc,
                    tenant_id=tenant_id,
                )
            )
            db.commit()

            reply = f"✅ *Logged Expense:*\n• {desc}: ₹{amt:,.2f} ({cat})\n• Account: {acc}"
            warning = check_budget_threshold_alert(db, cat, tenant_id)
            if warning:
                reply += f"\n\n{warning}"
            db.close()
            return reply, None

        # 6. LOG INCOME
        elif intent == "log_income":
            amt = float(data.get("amount", 0.0))
            desc = data.get("description", "Income").capitalize()
            cat = data.get("category", "Salary").capitalize()
            acc = data.get("account", "ICICI Savings Account")

            db.add(
                models.Income(
                    date=today,
                    description=desc,
                    amount=amt,
                    category=cat,
                    account=acc,
                    tenant_id=tenant_id,
                )
            )
            db.commit()
            db.close()
            return f"💰 *Logged Income:*\n• {desc}: ₹{amt:,.2f} ({cat})\n• Account: {acc}", None

        # 7. WHAT-IF SCENARIOS
        elif intent == "what_if_scenario":
            reply = handle_what_if_scenario(db, str(tenant_id), data)
            db.close()
            return reply, None

        # 8. DISCOVER BILLS
        elif intent == "discover_bills":
            disc = recurring_radar.discover_recurring_charges(db, str(tenant_id))
            reply, markup = format_discovered_subscriptions_telegram(disc)
            db.close()
            return reply, markup

        # 9. GENERAL CHAT
        else:
            db.close()
            return data.get("reply", "I couldn't process that request."), None

    except Exception as e:
        db.close()
        return f"Error: {e}", None


def listen_loop():
    if not TELEGRAM_BOT_TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN missing in .env")
        return

    print(f"🤖 Enterprise Telegram Listener starting (Phase 2 Copilot Active)...")

    # Check if a webhook is currently active
    check_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo"
    try:
        wh_info = requests.get(check_url, timeout=10).json()
        if wh_info.get("result", {}).get("url"):
            active_url = wh_info["result"]["url"]
            print(f"ℹ️ Telegram currently has a webhook registered to: {active_url}")
            print(f"Switching to local polling mode (deleting webhook temporarily)...")
            requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook", timeout=10)
            print(f"✅ Webhook removed. Local polling is now active!")
    except Exception as e:
        print(f"Webhook check warning: {e}")

    print("Listening for messages & inline button taps... Press Ctrl+C to stop.")
    last_update_id = 0
    while True:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={last_update_id + 1}&timeout=30"
        try:
            res = requests.get(url, timeout=35).json()
            if res.get("ok"):
                for update in res.get("result", []):
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
                        print(f"🔘 Received button tap from {cb_chat_id}: {cb_data}")

                        answer_callback_query(cb_id, "Processing your request...")

                        db = SessionLocal()
                        user = get_user_for_chat(db, cb_chat_id)
                        if user:
                            tenant_id = str(user.id)
                            if cb_data.startswith("settle_bill:"):
                                try:
                                    b_id = int(cb_data.split(":")[1])
                                    settle_res = reminder_service.settle_bill_with_expense(
                                        db=db,
                                        tenant_id=tenant_id,
                                        bill_id=b_id,
                                        auto_log_expense=True,
                                    )
                                    if settle_res.get("success"):
                                        b_obj = settle_res["bill"]
                                        send_message(
                                            f"✅ *Settled & Logged:* '{b_obj['name']}' (₹{b_obj['amount']:,.2f}) marked as Paid!\n"
                                            f"• Expense recorded in ledger.\n"
                                            f"• Tap below to review your updated status.",
                                            cb_chat_id,
                                            reply_markup={
                                                "inline_keyboard": [
                                                    [{"text": "📊 View Updated Status", "callback_data": "daily_status"}],
                                                    [{"text": "📅 View Remaining Bills", "callback_data": "pending_bills"}],
                                                ]
                                            }
                                        )
                                    else:
                                        send_message(f"⚠️ {settle_res.get('message', 'Failed to settle bill.')}", cb_chat_id)
                                except Exception as s_err:
                                    send_message(f"Error settling bill: {s_err}", cb_chat_id)

                            elif cb_data == "daily_status":
                                st_data = reminder_service.get_tenant_reminders_and_status(db, tenant_id)
                                user_name = user.email.split("@")[0].capitalize() if user.email else ""
                                msg = reminder_service.format_daily_status_telegram_message(st_data, user_name)
                                actionable_bills = st_data["bills"].get("overdue_bills", []) + st_data["bills"].get("due_today_bills", [])
                                markup = reminder_service.build_bills_inline_keyboard(actionable_bills)
                                send_message(msg, cb_chat_id, reply_markup=markup)

                            elif cb_data == "pending_bills":
                                st_data = reminder_service.get_tenant_reminders_and_status(db, tenant_id)
                                msg, markup = reminder_service.format_pending_bills_telegram_message(st_data)
                                send_message(msg, cb_chat_id, reply_markup=markup)

                            elif cb_data.startswith("track_disc:"):
                                try:
                                    parts = cb_data.split(":")
                                    disc_name = str(parts[1]).strip()
                                    disc_amt = float(parts[2])
                                    disc_day = int(parts[3])
                                    res = reminder_service.add_recurring_bill(
                                        db=db,
                                        tenant_id=tenant_id,
                                        name=disc_name,
                                        amount=disc_amt,
                                        due_day=disc_day,
                                    )
                                    b_obj = res["bill"]
                                    send_message(
                                        f"✅ *AI Discovered Bill Tracked!*\n"
                                        f"• Bill: *{b_obj['name']}*\n"
                                        f"• Amount: ₹{b_obj['amount']:,.2f}/month\n"
                                        f"• Due Day: Day {b_obj['due_day']} of every month\n"
                                        f"• Status: Pending (Reminders active in morning pulse)\n\n"
                                        f"💡 _You will now receive automated due alerts and 1-tap settlement buttons._",
                                        cb_chat_id,
                                        reply_markup={
                                            "inline_keyboard": [
                                                [{"text": "📅 View All Bills", "callback_data": "pending_bills"}],
                                                [{"text": "📊 View Updated Status", "callback_data": "daily_status"}],
                                            ]
                                        }
                                    )
                                except Exception as disc_err:
                                    send_message(f"Error tracking discovered bill: {disc_err}", cb_chat_id)
                        db.close()
                        continue

                    # 2. Handle Text, Voice & Photo Messages
                    msg = update.get("message", {})
                    chat_id = str(msg.get("chat", {}).get("id", "") or msg.get("from", {}).get("id", ""))
                    text = msg.get("text")
                    voice = msg.get("voice")
                    photo = msg.get("photo")

                    # TEXT MESSAGE
                    if chat_id and text:
                        print(f"📩 Received from {chat_id}: {text}")
                        reply, markup = process_with_gemini(text, chat_id)
                        send_message(reply, chat_id, reply_markup=markup)
                        print(f"📤 Sent reply to {chat_id}")

                    # VOICE NOTE
                    elif chat_id and voice:
                        print(f"🎙️ Received voice note from {chat_id}")
                        try:
                            file_id = voice.get("file_id")
                            f_info = requests.get(
                                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}",
                                timeout=10
                            ).json()
                            if f_info.get("ok"):
                                f_path = f_info["result"]["file_path"]
                                audio_bytes = requests.get(
                                    f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{f_path}",
                                    timeout=15
                                ).content
                                res = voice_ledger.process_audio_voice_to_ledger(audio_bytes, mime_type="audio/ogg")
                                if res.get("success"):
                                    transcript = res.get("transcript", "").strip()
                                    print(f"🎙️ Voice transcript: \"{transcript}\"")

                                    # Check if the voice note is an action (e.g. "paid bill", "status", "remind me")
                                    action_keywords = ["bill", "status", "remind", "paid", "due", "spend"]
                                    if any(kw in transcript.lower() for kw in action_keywords):
                                        # Route directly through conversational agent
                                        reply, markup = process_with_gemini(transcript, chat_id)
                                        send_message(f"🎙️ *Voice Note Heard:* \"{transcript}\"\n\n{reply}", chat_id, reply_markup=markup)
                                    else:
                                        # Standard ledger entry
                                        db = SessionLocal()
                                        u = get_user_for_chat(db, chat_id)
                                        if u:
                                            t_data = res["data"]
                                            dt = t_data.get("date", datetime.date.today().strftime("%Y-%m-%d"))
                                            if res.get("action") == "log_income":
                                                db.add(models.Income(
                                                    date=dt,
                                                    category=t_data.get("category", "Salary"),
                                                    amount=float(t_data.get("amount", 0.0)),
                                                    account=t_data.get("account", "Savings Account"),
                                                    description=t_data.get("description", "Voice Income"),
                                                    remarks=f"Telegram Voice | Spoken: \"{transcript}\"",
                                                    tenant_id=u.id
                                                ))
                                            else:
                                                db.add(models.Expense(
                                                    date=dt,
                                                    category=t_data.get("category", "Miscellaneous"),
                                                    amount=float(t_data.get("amount", 0.0)),
                                                    account=t_data.get("account", "Savings Account"),
                                                    description=t_data.get("description", "Voice Expense"),
                                                    remarks=f"Telegram Voice | Spoken: \"{transcript}\"",
                                                    tenant_id=u.id
                                                ))
                                            db.commit()
                                            db.close()
                                            send_message(f"🎙️ *Voice Note Logged:*\n• Spoken: \"{transcript}\"\n• {res.get('spoken_response')}", chat_id)
                                        else:
                                            db.close()
                                            send_message("No active user account found.", chat_id)
                                else:
                                    send_message(f"⚠️ Could not parse voice note: {res.get('error')}", chat_id)
                        except Exception as v_err:
                            send_message(f"Error processing voice note: {v_err}", chat_id)

                    # RECEIPT PHOTO
                    elif chat_id and photo:
                        print(f"📸 Received receipt photo from {chat_id}")
                        try:
                            file_id = photo[-1]["file_id"]
                            f_info = requests.get(
                                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}",
                                timeout=10
                            ).json()
                            if f_info.get("ok"):
                                f_path = f_info["result"]["file_path"]
                                img_bytes = requests.get(
                                    f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{f_path}",
                                    timeout=15
                                ).content
                                res = receipt_scanner.scan_receipt_image(img_bytes, mime_type="image/jpeg")
                                if res.get("success"):
                                    data = res["data"]
                                    db = SessionLocal()
                                    u = get_user_for_chat(db, chat_id)
                                    if u:
                                        amt = float(data.get("total_amount", 0.0))
                                        cat = data.get("category", "Miscellaneous")
                                        exp = models.Expense(
                                            date=data.get("date", datetime.date.today().strftime("%Y-%m-%d")),
                                            description=data.get("merchant", "Receipt Expense"),
                                            amount=amt,
                                            category=cat,
                                            account="Cash",
                                            remarks=f"Telegram Receipt OCR: {data.get('merchant')}",
                                            tenant_id=u.id
                                        )
                                        db.add(exp)
                                        db.commit()
                                        db.close()
                                        items_preview = ", ".join([it.get("name", "") for it in data.get("line_items", [])[:3] if it.get("name")])
                                        send_message(
                                            f"📸 *Receipt Parsed & Logged:*\n"
                                            f"• Merchant: {data.get('merchant')}\n"
                                            f"• Total: ₹{amt:,.2f} ({cat})\n"
                                            f"• Tax/GST: ₹{data.get('tax_amount', 0):,.2f}\n"
                                            f"• Items: {items_preview or 'N/A'}",
                                            chat_id
                                        )
                                    else:
                                        db.close()
                                        send_message("No active user account found.", chat_id)
                                else:
                                    send_message(f"⚠️ Could not parse receipt: {res.get('error')}", chat_id)
                        except Exception as p_err:
                            send_message(f"Error processing receipt photo: {p_err}", chat_id)

            elif res.get("error_code") == 409:
                print("Webhook conflict detected. Clearing webhook...")
                requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook", timeout=10)
                time.sleep(2)
        except KeyboardInterrupt:
            print("\nStopped Telegram Listener.")
            break
        except Exception as e:
            time.sleep(5)


if __name__ == "__main__":
    if TELEGRAM_BOT_TOKEN:
        print("Clearing any existing webhook to enable long-polling...")
        try:
            requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook", timeout=10)
        except Exception as e:
            print(f"Failed to clear webhook: {e}")
    listen_loop()