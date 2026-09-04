import os
import datetime
import requests
from dotenv import load_dotenv

# Enterprise Database Imports
from currency_utils import format_amount
from database import SessionLocal
import models
from sqlalchemy import func

load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send_telegram_message(message_text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram credentials missing in .env")
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message_text, "parse_mode": "Markdown"}
    try:
        response = requests.post(url, json=payload, timeout=10)
        return response.json().get("ok", False)
    except:
        return False

def generate_financial_alert():
    db = SessionLocal()
    today = datetime.date.today()
    current_day = today.day

    # 1. Check Upcoming Bills via ORM
    all_bills = db.query(models.Bill).all()
    upcoming_bills = []
    for b in all_bills:
        days_away = b.due_day - current_day
        if 0 <= days_away <= 7 and b.status != "Paid":
            due_label = "TODAY" if days_away == 0 else f"in {days_away} days"
            upcoming_bills.append(f"• *{b.name}*: {format_amount(b.amount)} ({due_label})")

    # 2. Check Over-Budget via ORM
    budgets = db.query(models.Budget).all()
    budget_warnings = []
    for b in budgets:
        spent = db.query(func.sum(models.Expense.amount)).filter(models.Expense.category == b.category).scalar() or 0.0
        if spent > b.monthly_limit:
            budget_warnings.append(f"• ⚠️ *{b.category}*: {format_amount(spent)} spent of {format_amount(b.monthly_limit)} budget!")
        elif b.monthly_limit > 0 and (spent / b.monthly_limit) >= 0.80:
            budget_warnings.append(f"• 🟡 *{b.category}*: At {(spent/b.monthly_limit)*100:.0f}% of budget")

    # 3. Overall Net Worth Snapshot
    total_assets = db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    net_worth = total_assets - total_debt
    db.close()

    lines = [
        f"🔔 *Financial Agent Alert* — {today.strftime('%b %d, %Y')}",
        "━━━━━━━━━━━━━━━━━━━",
        f"💰 *Net Worth:* {format_amount(net_worth)}\n"
    ]

    lines.append("📅 *Upcoming Bills:*")
    if upcoming_bills: lines.extend(upcoming_bills)
    else: lines.append("No bills due in the next 7 days.")
    lines.append("")

    lines.append("📊 *Budget Warnings:*")
    if budget_warnings: lines.extend(budget_warnings)
    else: lines.append("✅ All categories within limits.")
    
    return "\n".join(lines)

def run_alert_check():
    msg = generate_financial_alert()
    return send_telegram_message(msg)

if __name__ == "__main__":
    print("Checking PostgreSQL database and triggering alert...")
    run_alert_check()