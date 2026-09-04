from contextlib import asynccontextmanager
import datetime
import json
import os
from typing import Any, Dict, List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    Security,
    status,
)
from fastapi.security import APIKeyHeader
from google import genai
from google.genai import types
import requests
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from database import SessionLocal, engine, get_db
import models
import schemas

# 1. Create all missing database tables
models.Base.metadata.create_all(bind=engine)

# 2. Universal schema migrations for both PostgreSQL (Render) and SQLite (Local)
try:
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    migrations = {
        "loans": [
            ("interest_rate", "FLOAT DEFAULT 8.5"),
            ("tenure_years", "FLOAT DEFAULT 20.0"),
            ("extra_prepayment", "FLOAT DEFAULT 0.0"),
        ],
        "expenses": [
            ("account", "VARCHAR(100) DEFAULT 'ICICI Savings Account'"),
            ("remarks", "TEXT"),
        ],
        "incomes": [
            ("account", "VARCHAR(100) DEFAULT 'ICICI Savings Account'"),
            ("description", "VARCHAR(255) DEFAULT ''"),
            ("remarks", "TEXT"),
        ],
        "bills": [
            ("status", "VARCHAR(50) DEFAULT 'Pending'"),
        ],
        "credit_scores": [
            ("rating", "VARCHAR(50) DEFAULT 'Excellent'"),
        ],
    }

    with engine.connect() as conn:
        for tbl, cols in migrations.items():
            if tbl in existing_tables:
                existing_cols = [c["name"] for c in inspector.get_columns(tbl)]
                for col_name, col_type in cols:
                    if col_name not in existing_cols:
                        conn.execute(
                            text(
                                f"ALTER TABLE {tbl} ADD COLUMN {col_name} {col_type};"
                            )
                        )
                        print(f"Auto-migration: Added {col_name} to {tbl}")
        conn.commit()
except Exception as e:
    print(f"Migration note: {e}")

load_dotenv()

# --- Configuration & Credentials ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-api-key")
TELEGRAM_WEBHOOK_SECRET = os.getenv(
    "TELEGRAM_WEBHOOK_SECRET", "default-telegram-secret"
)

ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# --- Security Dependencies ---
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)


def verify_api_key(api_key: str = Security(api_key_header)):
    """Verifies that incoming requests supply a valid secret API key."""
    if api_key != API_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
        )
    return api_key


# --- Background Worker Functions ---


def send_telegram_alert(message_text: str):
    """Dispatches a Markdown message to Telegram asynchronously."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message_text,
        "parse_mode": "Markdown",
    }
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Failed to dispatch Telegram alert: {e}")


def check_budget_threshold_alert(
    db: Session, category_name: str
) -> Optional[str]:
    """Checks if current month's spending for a category has reached 90% or more of its limit."""
    budget = (
        db.query(models.Budget)
        .filter(func.lower(models.Budget.category) == category_name.lower())
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
    """Automated job: scans database for upcoming bills and 90%+ budget overspends at 8:00 AM IST."""
    db = SessionLocal()
    today = datetime.date.today()
    current_day = today.day
    current_month_prefix = today.strftime("%Y-%m")

    # 1. Check Upcoming Bills
    all_bills = db.query(models.Bill).all()
    upcoming_bills = []
    for b in all_bills:
        days_away = b.due_day - current_day
        if 0 <= days_away <= 7 and b.status != "Paid":
            label = "TODAY" if days_away == 0 else f"in {days_away} days"
            upcoming_bills.append(f"• *{b.name}*: ₹{b.amount:,.2f} ({label})")

    # 2. Check Budget Thresholds (Current Month Only)
    budgets = db.query(models.Budget).all()
    budget_warnings = []
    for b in budgets:
        spent = (
            db.query(func.sum(models.Expense.amount))
            .filter(
                func.lower(models.Expense.category) == b.category.lower(),
                models.Expense.date.like(f"{current_month_prefix}%"),
            )
            .scalar()
            or 0.0
        )
        if b.monthly_limit and b.monthly_limit > 0:
            pct = (spent / b.monthly_limit) * 100
            if spent > b.monthly_limit:
                budget_warnings.append(
                    f"• 🚨 *{b.category}*: ₹{spent:,.2f} spent of ₹{b.monthly_limit:,.2f} limit! ({pct:.0f}%)"
                )
            elif pct >= 90.0:
                budget_warnings.append(
                    f"• ⚠️ *{b.category}*: At {pct:.1f}% of budget (₹{spent:,.2f} / ₹{b.monthly_limit:,.2f})"
                )

    # 3. Overall Net Worth
    total_assets = (
        db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    )
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    net_worth = total_assets - total_debt
    db.close()

    lines = [
        f"🔔 *Automated Daily Briefing* — {today.strftime('%b %d, %Y')}",
        "━━━━━━━━━━━━━━━━━━━",
        f"💰 *Net Worth:* ₹{net_worth:,.2f}\n",
        "📅 *Upcoming Bills (Next 7 Days):*",
    ]
    lines.extend(
        upcoming_bills if upcoming_bills else ["✅ No pending bills due soon."]
    )
    lines.append("\n📊 *Budget Oversight (90%+ Alerts):*")
    lines.extend(
        budget_warnings
        if budget_warnings
        else ["✅ All spending within defined budgets."]
    )

    send_telegram_alert("\n".join(lines))


def async_process_telegram_message(user_text: str):
    """Processes incoming Telegram messages via Gemini for both expenses and income."""
    if not ai_client:
        return

    db = SessionLocal()
    today = datetime.date.today().strftime("%Y-%m-%d")
    total_assets = (
        db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    )
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    context = f"Net Worth: ₹{total_assets - total_debt:,.2f} (Assets: ₹{total_assets:,.2f}, Debt: ₹{total_debt:,.2f})"

    prompt = f"""
    You are an AI financial advisor on Telegram. Today is {today}. Context: {context}
    User Message: "{user_text}"
    
    1. If logging an expense (e.g. "spent 30 on groceries", "paid 45 for gas"): Return pure JSON:
       {{"type": "log_expense", "amount": 30.0, "description": "groceries", "category": "Groceries", "account": "ICICI Savings Account"}}
    2. If logging an income (e.g. "received 120000 salary", "got 1500 refund"): Return pure JSON:
       {{"type": "log_income", "amount": 120000.0, "description": "salary", "category": "Salary", "account": "ICICI Savings Account"}}
    3. Otherwise return JSON:
       {{"type": "chat", "reply": "Your markdown answer."}}
    """
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

        if data.get("type") == "log_expense":
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
                )
            )

            # Auto-create budget if missing
            existing_budget = (
                db.query(models.Budget)
                .filter(
                    func.lower(models.Budget.category) == category_name.lower()
                )
                .first()
            )
            if not existing_budget:
                db.add(
                    models.Budget(category=category_name, monthly_limit=5000.00)
                )

            db.commit()

            reply = f"✅ *Logged Expense via Webhook:*\n• {desc}: ₹{amt:,.2f} ({category_name})\n• Account: {acc}"

            # Real-time 90% budget check
            warning = check_budget_threshold_alert(db, category_name)
            if warning:
                reply += f"\n\n{warning}"

        elif data.get("type") == "log_income":
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
                )
            )
            db.commit()
            reply = f"💰 *Logged Income via Webhook:*\n• {desc}: ₹{amt:,.2f} ({category_name})\n• Account: {acc}"

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
    # Scheduled daily alert for 8:00 AM IST
    scheduler.add_job(
        scheduled_financial_health_check,
        "cron",
        hour=8,
        minute=0,
        id="daily_health_check",
    )
    scheduler.start()
    print("🚀 Background scheduler started: Daily alerts registered for 08:00 AM.")
    yield
    scheduler.shutdown()
    print("🛑 Background scheduler shut down.")


app = FastAPI(
    title="Enterprise Financial AI API",
    description="Decoupled backend with Asynchronous Pipelines, Multi-Account Tracking, and Webhook Security.",
    version="2.3.0",
    lifespan=lifespan,
)

# --- Secured Endpoints: Dashboard (GET) ---


@app.get(
    "/api/v1/dashboard/", tags=["Dashboard"], dependencies=[Depends(verify_api_key)]
)
def get_dashboard_data(db: Session = Depends(get_db)):
    def serialize(query_result):
        results = []
        for row in query_result:
            row_dict = row.__dict__.copy()
            row_dict.pop("_sa_instance_state", None)
            results.append(row_dict)
        return results

    return {
        "expenses": serialize(db.query(models.Expense).all()),
        "incomes": serialize(db.query(models.Income).all()),
        "accounts": serialize(db.query(models.Account).all()),
        "balance_adjustments": serialize(
            db.query(models.BalanceAdjustment).all()
        ),
        "loans": serialize(db.query(models.Loan).all()),
        "investments": serialize(db.query(models.Investment).all()),
        "budgets": serialize(db.query(models.Budget).all()),
        "goals": serialize(db.query(models.Goal).all()),
        "bills": serialize(db.query(models.Bill).all()),
        "credit_scores": serialize(
            db.query(models.CreditScore).order_by(models.CreditScore.date).all()
        ),
        "profile": serialize(db.query(models.Profile).all()),
    }


# --- Secured Endpoints: Data Ingestion (POST) ---


@app.post(
    "/api/v1/expenses/bulk",
    tags=["Expenses"],
    dependencies=[Depends(verify_api_key)],
)
def create_bulk_expenses(
    payload: schemas.BulkExpenseCreate, db: Session = Depends(get_db)
):
    if payload.replace_all:
        db.query(models.Expense).delete()
    for exp in payload.expenses:
        db.add(models.Expense(**exp.model_dump()))
    db.commit()
    return {
        "message": f"Inserted {len(payload.expenses)} expenses successfully."
    }


@app.post(
    "/api/v1/expenses/", tags=["Expenses"], dependencies=[Depends(verify_api_key)]
)
def create_single_expense(
    exp: schemas.ExpenseCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    new_expense = models.Expense(**exp.model_dump())
    db.add(new_expense)

    existing_budget = (
        db.query(models.Budget)
        .filter(func.lower(models.Budget.category) == exp.category.lower())
        .first()
    )
    if not existing_budget:
        db.add(models.Budget(category=exp.category, monthly_limit=5000.00))

    db.commit()

    warning = check_budget_threshold_alert(db, exp.category)
    if warning:
        background_tasks.add_task(send_telegram_alert, warning)

    return {"message": "Expense created successfully."}


@app.post(
    "/api/v1/incomes/bulk", tags=["Income"], dependencies=[Depends(verify_api_key)]
)
def create_bulk_incomes(
    payload: schemas.BulkIncomeCreate, db: Session = Depends(get_db)
):
    if payload.replace_all:
        db.query(models.Income).delete()
    for inc in payload.incomes:
        db.add(models.Income(**inc.model_dump()))
    db.commit()
    return {"message": f"Inserted {len(payload.incomes)} incomes successfully."}


@app.post(
    "/api/v1/incomes/", tags=["Income"], dependencies=[Depends(verify_api_key)]
)
def create_single_income(
    inc: schemas.IncomeCreate, db: Session = Depends(get_db)
):
    new_income = models.Income(**inc.model_dump())
    db.add(new_income)
    db.commit()
    return {"message": "Income recorded successfully."}


@app.post(
    "/api/v1/accounts/",
    tags=["Accounts"],
    dependencies=[Depends(verify_api_key)],
)
def create_or_update_account(
    acc: schemas.AccountCreate, db: Session = Depends(get_db)
):
    existing = (
        db.query(models.Account)
        .filter(func.lower(models.Account.name) == acc.name.lower())
        .first()
    )
    if existing:
        existing.account_type = acc.account_type
        existing.initial_balance = acc.initial_balance
    else:
        db.add(models.Account(**acc.model_dump()))
    db.commit()
    return {"message": "Account saved successfully."}


@app.post(
    "/api/v1/balance-adjustments/",
    tags=["Balance"],
    dependencies=[Depends(verify_api_key)],
)
def create_balance_adjustment(
    adj: schemas.BalanceAdjustmentCreate, db: Session = Depends(get_db)
):
    db.add(models.BalanceAdjustment(**adj.model_dump()))
    db.commit()
    return {"message": "Balance adjustment logged."}


@app.post(
    "/api/v1/budgets/", tags=["Budgets"], dependencies=[Depends(verify_api_key)]
)
def update_budget(budget: schemas.BudgetCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.Budget)
        .filter(func.lower(models.Budget.category) == budget.category.lower())
        .first()
    )
    if existing:
        existing.monthly_limit = budget.monthly_limit
    else:
        db.add(
            models.Budget(
                category=budget.category, monthly_limit=budget.monthly_limit
            )
        )
    db.commit()
    return {"message": "Budget updated."}


@app.post(
    "/api/v1/investments/",
    tags=["Investments"],
    dependencies=[Depends(verify_api_key)],
)
def create_investment(
    inv: schemas.InvestmentCreate, db: Session = Depends(get_db)
):
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


@app.post(
    "/api/v1/credit-scores/",
    tags=["Credit Score"],
    dependencies=[Depends(verify_api_key)],
)
def create_credit_score(
    score: schemas.CreditScoreCreate, db: Session = Depends(get_db)
):
    db.add(models.CreditScore(**score.model_dump()))
    db.commit()
    return {"message": "Credit score logged."}


@app.post(
    "/api/v1/profile/", tags=["Settings"], dependencies=[Depends(verify_api_key)]
)
def update_profile(
    profile: schemas.ProfileUpdate, db: Session = Depends(get_db)
):
    existing = (
        db.query(models.Profile)
        .filter(func.lower(models.Profile.key) == profile.key.lower())
        .first()
    )
    if existing:
        existing.value = profile.value
    else:
        db.add(models.Profile(key=profile.key, value=profile.value))
    db.commit()
    return {"message": "Profile updated."}


# --- AI Agent Tools ---


def get_net_worth_tool() -> str:
    db = SessionLocal()
    total_assets = (
        db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    )
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    db.close()
    return f"Assets: ₹{total_assets:,.2f}, Debt: ₹{total_debt:,.2f}, Net Worth: ₹{total_assets - total_debt:,.2f}"


def get_upcoming_bills_tool() -> str:
    db = SessionLocal()
    bills = db.query(models.Bill).all()
    db.close()
    if not bills:
        return "No bills found."
    return "\n".join(
        [f"{b.name}: ₹{b.amount:,.2f} due on day {b.due_day}" for b in bills]
    )


@app.post(
    "/api/v1/chat/", tags=["AI Agent"], dependencies=[Depends(verify_api_key)]
)
def chat_with_agent(req: schemas.ChatRequest):
    if not ai_client:
        return {"reply": "Error: Gemini API key not configured on backend."}

    try:
        chat = ai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction="You are an elite financial advisor. Use your tools to fetch data ONLY if needed. Be concise.",
                tools=[get_net_worth_tool, get_upcoming_bills_tool],
                temperature=0.2,
            ),
        )
        response = chat.send_message(req.message)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"AI Error: {str(e)}"}


@app.post(
    "/api/v1/trigger-daily-alert",
    tags=["System"],
    dependencies=[Depends(verify_api_key)],
)
def trigger_alert_now(background_tasks: BackgroundTasks):
    """Allows authenticated manual triggers of the daily briefing in the background."""
    background_tasks.add_task(scheduled_financial_health_check)
    return {"message": "Health check scheduled in background."}


# --- Secured Telegram Webhook ---


@app.post("/api/v1/webhook/telegram", tags=["Telegram Webhook"])
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None),
):
    """Secured webhook receiver validating Telegram's native secret token header."""
    if x_telegram_bot_api_secret_token != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: invalid or missing webhook secret token.",
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