import os
import json
import datetime
import requests
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, BackgroundTasks, Request, Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from sqlalchemy import func
from google import genai
from google.genai import types
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler

import models
import schemas
from database import engine, get_db, SessionLocal

load_dotenv()

# --- Configuration & Credentials ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-api-key")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "default-telegram-secret")

ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# --- Security Dependencies ---
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

def verify_api_key(api_key: str = Security(api_key_header)):
    """Verifies that requests to dashboard/data endpoints supply a valid API key."""
    if api_key != API_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key"
        )
    return api_key

# --- Background Worker Functions ---

def send_telegram_alert(message_text: str):
    """Dispatches a Markdown message to Telegram asynchronously."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message_text, "parse_mode": "Markdown"}
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Failed to dispatch Telegram alert: {e}")

def scheduled_financial_health_check():
    """Automated job: scans PostgreSQL for upcoming bills and budget overspends."""
    db = SessionLocal()
    today = datetime.date.today()
    current_day = today.day

    # 1. Check Upcoming Bills
    all_bills = db.query(models.Bill).all()
    upcoming_bills = []
    for b in all_bills:
        days_away = b.due_day - current_day
        if 0 <= days_away <= 7 and b.status != "Paid":
            label = "TODAY" if days_away == 0 else f"in {days_away} days"
            upcoming_bills.append(f"• *{b.name}*: ${b.amount:,.2f} ({label})")

    # 2. Check Budget Thresholds
    budgets = db.query(models.Budget).all()
    budget_warnings = []
    for b in budgets:
        spent = db.query(func.sum(models.Expense.amount)).filter(models.Expense.category == b.category).scalar() or 0.0
        if spent > b.monthly_limit:
            budget_warnings.append(f"• ⚠️ *{b.category}*: ${spent:,.2f} spent of ${b.monthly_limit:,.2f} limit!")
        elif b.monthly_limit > 0 and (spent / b.monthly_limit) >= 0.80:
            budget_warnings.append(f"• 🟡 *{b.category}*: At {(spent / b.monthly_limit) * 100:.0f}% of budget")

    # 3. Overall Net Worth
    total_assets = db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    net_worth = total_assets - total_debt
    db.close()

    lines = [
        f"🔔 *Automated Daily Briefing* — {today.strftime('%b %d, %Y')}",
        "━━━━━━━━━━━━━━━━━━━",
        f"💰 *Net Worth:* ${net_worth:,.2f}\n",
        "📅 *Upcoming Bills (Next 7 Days):*"
    ]
    lines.extend(upcoming_bills if upcoming_bills else ["✅ No pending bills due soon."])
    lines.append("\n📊 *Budget Oversight:*")
    lines.extend(budget_warnings if budget_warnings else ["✅ All spending within defined budgets."])

    send_telegram_alert("\n".join(lines))

def async_process_telegram_message(user_text: str):
    """Processes incoming Telegram webhook payloads using Gemini and writes directly to PostgreSQL."""
    if not ai_client:
        return

    db = SessionLocal()
    today = datetime.date.today().strftime("%Y-%m-%d")
    total_assets = db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    context = f"Net Worth: ${total_assets - total_debt:,.2f} (Assets: ${total_assets:,.2f}, Debt: ${total_debt:,.2f})"

    prompt = f"""
    You are an AI financial advisor on Telegram. Today is {today}. Context: {context}
    User Message: "{user_text}"
    
    1. If logging an expense (e.g. "spent 30 on groceries"): Return pure JSON:
       {{"type": "log_expense", "amount": 30.0, "description": "groceries", "category": "Groceries"}}
    2. Otherwise return JSON:
       {{"type": "chat", "reply": "Your markdown answer."}}
    """
    try:
        response = ai_client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        cleaned = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)

        if data.get("type") == "log_expense":
            db.add(models.Expense(
                date=today,
                description=data["description"].capitalize(),
                amount=float(data["amount"]),
                category=data["category"]
            ))
            db.commit()
            reply = f"✅ *Logged Expense via Webhook:*\n• {data['description'].capitalize()}: ${float(data['amount']):,.2f} ({data['category']})"
        else:
            reply = data.get("reply", "Understood.")
    except Exception as e:
        reply = f"Agent Error: {str(e)}"
    finally:
        db.close()

    send_telegram_alert(reply)

# --- Scheduler Setup ---
scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(scheduled_financial_health_check, "cron", hour=9, minute=0, id="daily_health_check")
    scheduler.start()
    print("🚀 Background scheduler started: Daily alerts registered for 09:00 AM.")
    yield
    scheduler.shutdown()
    print("🛑 Background scheduler shut down.")

app = FastAPI(
    title="Enterprise Financial AI API",
    description="Decoupled backend with Asynchronous Pipelines, Native Tools, and Webhook Security.",
    version="2.1.0",
    lifespan=lifespan
)

# --- Secured Endpoints: Dashboard (GET) ---

@app.get("/api/v1/dashboard/", tags=["Dashboard"], dependencies=[Depends(verify_api_key)])
def get_dashboard_data(db: Session = Depends(get_db)):
    def serialize(query_result):
        return [row.__dict__ for row in query_result]

    return {
        "expenses": serialize(db.query(models.Expense).all()),
        "loans": serialize(db.query(models.Loan).all()),
        "investments": serialize(db.query(models.Investment).all()),
        "budgets": serialize(db.query(models.Budget).all()),
        "goals": serialize(db.query(models.Goal).all()),
        "bills": serialize(db.query(models.Bill).all()),
        "credit_scores": serialize(db.query(models.CreditScore).order_by(models.CreditScore.date).all()),
        "profile": serialize(db.query(models.Profile).all())
    }

# --- Secured Endpoints: Data Ingestion (POST) ---

@app.post("/api/v1/expenses/bulk", tags=["Expenses"], dependencies=[Depends(verify_api_key)])
def create_bulk_expenses(payload: schemas.BulkExpenseCreate, db: Session = Depends(get_db)):
    if payload.replace_all:
        db.query(models.Expense).delete()
    for exp in payload.expenses:
        db.add(models.Expense(**exp.model_dump()))
    db.commit()
    return {"message": f"Inserted {len(payload.expenses)} expenses successfully."}

@app.post("/api/v1/budgets/", tags=["Budgets"], dependencies=[Depends(verify_api_key)])
def update_budget(budget: schemas.BudgetCreate, db: Session = Depends(get_db)):
    db.merge(models.Budget(category=budget.category, monthly_limit=budget.monthly_limit))
    db.commit()
    return {"message": "Budget updated."}

@app.post("/api/v1/investments/", tags=["Investments"], dependencies=[Depends(verify_api_key)])
def create_investment(inv: schemas.InvestmentCreate, db: Session = Depends(get_db)):
    db.add(models.Investment(**inv.model_dump()))
    db.commit()
    return {"message": "Investment added."}

@app.post("/api/v1/goals/", tags=["Goals"], dependencies=[Depends(verify_api_key)])
def create_goal(goal: schemas.GoalCreate, db: Session = Depends(get_db)):
    db.add(models.Goal(**goal.model_dump()))
    db.commit()
    return {"message": "Goal added."}

@app.post("/api/v1/bills/", tags=["Bills"], dependencies=[Depends(verify_api_key)])
def create_bill(bill: schemas.BillCreate, db: Session = Depends(get_db)):
    db.add(models.Bill(**bill.model_dump()))
    db.commit()
    return {"message": "Bill added."}

@app.post("/api/v1/credit-scores/", tags=["Credit Score"], dependencies=[Depends(verify_api_key)])
def create_credit_score(score: schemas.CreditScoreCreate, db: Session = Depends(get_db)):
    db.add(models.CreditScore(**score.model_dump()))
    db.commit()
    return {"message": "Credit score logged."}

@app.post("/api/v1/profile/", tags=["Settings"], dependencies=[Depends(verify_api_key)])
def update_profile(profile: schemas.ProfileUpdate, db: Session = Depends(get_db)):
    db.merge(models.Profile(key=profile.key, value=profile.value))
    db.commit()
    return {"message": "Profile updated."}

# --- AI Agent Tools ---

def get_net_worth_tool() -> str:
    db = SessionLocal()
    total_assets = db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    db.close()
    return f"Assets: ${total_assets:,.2f}, Debt: ${total_debt:,.2f}, Net Worth: ${total_assets - total_debt:,.2f}"

def get_upcoming_bills_tool() -> str:
    db = SessionLocal()
    bills = db.query(models.Bill).all()
    db.close()
    if not bills: return "No bills found."
    return "\n".join([f"{b.name}: ${b.amount} due on day {b.due_day}" for b in bills])

@app.post("/api/v1/chat/", tags=["AI Agent"], dependencies=[Depends(verify_api_key)])
def chat_with_agent(req: schemas.ChatRequest):
    if not ai_client:
        return {"reply": "Error: Gemini API key not configured on backend."}

    try:
        chat = ai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction="You are an elite financial advisor. Use your tools to fetch data ONLY if needed. Be concise.",
                tools=[get_net_worth_tool, get_upcoming_bills_tool],
                temperature=0.2
            )
        )
        response = chat.send_message(req.message)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"AI Error: {str(e)}"}

@app.post("/api/v1/trigger-daily-alert", tags=["System"], dependencies=[Depends(verify_api_key)])
def trigger_alert_now(background_tasks: BackgroundTasks):
    """Allows authenticated manual triggers of the daily briefing in the background."""
    background_tasks.add_task(scheduled_financial_health_check)
    return {"message": "Health check scheduled in background."}

# --- Secured Telegram Webhook ---

@app.post("/api/v1/webhook/telegram", tags=["Telegram Webhook"])
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None)
):
    """Secured webhook receiver validating Telegram's native secret token header."""
    if x_telegram_bot_api_secret_token != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: invalid or missing webhook secret token."
        )

    try:
        payload = await request.json()
        message = payload.get("message", {})
        sender_id = str(message.get("from", {}).get("id", ""))
        text = message.get("text", "")

        # Only process messages from your specific chat ID
        if sender_id == str(TELEGRAM_CHAT_ID) and text:
            background_tasks.add_task(async_process_telegram_message, text)
    except Exception as e:
        print(f"Webhook processing error: {e}")

    return {"status": "received"}