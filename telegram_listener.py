import os
import time
import json
import datetime
import requests
from dotenv import load_dotenv
from google import genai

# Enterprise Database Imports
from currency_utils import format_amount
from database import SessionLocal
import models
from sqlalchemy import func

load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY")) if os.getenv("GEMINI_API_KEY") else None

def send_message(text: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "Markdown"})

def get_financial_context() -> str:
    db = SessionLocal()
    total_assets = db.query(func.sum(models.Investment.current_value)).scalar() or 0.0
    total_debt = db.query(func.sum(models.Loan.principal)).scalar() or 0.0
    db.close()
    return f"- Net Worth: {format_amount(total_assets - total_debt)} (Assets: {format_amount(total_assets)}, Debt: {format_amount(total_debt)})"

def process_with_gemini(user_text: str) -> str:
    today = datetime.date.today().strftime("%Y-%m-%d")
    context = get_financial_context()

    prompt = f"""
    You are an AI financial advisor on Telegram. Today is {today}. Context: {context}
    User Message: "{user_text}"
    
    1. If logging an expense (e.g., "spent 25 on coffee"): Return pure JSON: {{"type": "log_expense", "amount": 25.0, "description": "coffee", "category": "Dining"}}
    2. Otherwise return JSON: {{"type": "chat", "reply": "Your markdown answer."}}
    """
    try:
        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        data = json.loads(response.text.strip().replace("```json", "").replace("```", "").strip())

        if data.get("type") == "log_expense":
            # Save directly to PostgreSQL via ORM
            db = SessionLocal()
            db.add(models.Expense(date=today, description=data["description"].capitalize(), amount=float(data["amount"]), category=data["category"]))
            db.commit()
            db.close()
            return f"✅ *Logged Expense:*\n• {data['description'].capitalize()}: {format_amount(float(data['amount']))} ({data['category']})"
        else:
            return data.get("reply", "I couldn't process that request.")
    except Exception as e:
        return f"Error: {e}"

def listen_loop():
    print("🤖 Enterprise Telegram Listener started! Connected to PostgreSQL.")
    last_update_id = 0
    while True:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={last_update_id + 1}&timeout=30"
        try:
            res = requests.get(url, timeout=35).json()
            if res.get("ok"):
                for update in res.get("result", []):
                    last_update_id = update["update_id"]
                    msg = update.get("message", {})
                    if str(msg.get("from", {}).get("id", "")) == str(TELEGRAM_CHAT_ID) and msg.get("text"):
                        send_message(process_with_gemini(msg["text"]))
        except Exception:
            time.sleep(5)

if __name__ == "__main__":
    listen_loop()