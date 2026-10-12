"""
setup_telegram_webhook.py - Telegram Webhook and Alert Management Tool

Usage:
    python setup_telegram_webhook.py --status
    python setup_telegram_webhook.py --set
    python setup_telegram_webhook.py --delete
    python setup_telegram_webhook.py --trigger-alert
"""

import sys
import os
import argparse
import requests
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "my_secure_telegram_secret_456")
DEFAULT_WEBHOOK_URL = os.getenv(
    "TELEGRAM_WEBHOOK_URL",
    "https://financial-advisor-t2ch.onrender.com/api/v1/webhook/telegram"
)
API_BASE_URL = os.getenv(
    "BACKEND_API_URL",
    "https://financial-advisor-t2ch.onrender.com"
)
API_KEY = os.getenv("API_SECRET_KEY", "my_secure_dashboard_key_123")


def check_status():
    if not TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN is missing in .env")
        return
    url = f"https://api.telegram.org/bot{TOKEN}/getWebhookInfo"
    resp = requests.get(url, timeout=10).json()
    print("========================================")
    print("📡 Current Telegram Webhook Status")
    print("========================================")
    if resp.get("ok"):
        res = resp.get("result", {})
        active_url = res.get("url")
        if active_url:
            print(f"✅ Webhook is ACTIVE pointing to: {active_url}")
            print(f"• Pending updates count : {res.get('pending_update_count', 0)}")
            print(f"• Has custom cert       : {res.get('has_custom_certificate', False)}")
            if res.get("last_error_date"):
                print(f"⚠️ Last error message   : {res.get('last_error_message')}")
        else:
            print("ℹ️ Webhook is NOT set (Telegram is in long-polling mode).")
    else:
        print("❌ Failed to query Telegram:", resp)
    print("========================================\n")


def set_webhook(target_url: str = None):
    if not TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN is missing in .env")
        return
    hook_url = target_url or DEFAULT_WEBHOOK_URL
    print(f"🚀 Registering Telegram Webhook to: {hook_url} ...")
    payload = {
        "url": hook_url,
        "allowed_updates": ["message", "callback_query"],
    }
    if SECRET:
        payload["secret_token"] = SECRET

    url = f"https://api.telegram.org/bot{TOKEN}/setWebhook"
    resp = requests.post(url, json=payload, timeout=15).json()
    if resp.get("ok"):
        print("✅ Success! Telegram Webhook is now active.")
        print(f"• Inbound messages will wake up: {hook_url}")
        print("• Secret token authentication is enabled.")
    else:
        print("❌ Failed to set webhook:", resp)


def delete_webhook():
    if not TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN is missing in .env")
        return
    print("🗑️ Removing Telegram Webhook (switching back to local polling)...")
    url = f"https://api.telegram.org/bot{TOKEN}/deleteWebhook"
    resp = requests.post(url, timeout=10).json()
    if resp.get("ok"):
        print("✅ Webhook removed successfully. You can now use local long-polling.")
    else:
        print("❌ Failed to delete webhook:", resp)


def trigger_alert():
    print(f"🔔 Triggering Daily Morning Pulse via {API_BASE_URL} ...")
    endpoint = f"{API_BASE_URL.rstrip('/')}/api/v1/trigger-daily-alert"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(endpoint, headers=headers, timeout=20)
        print(f"Response status: {resp.status_code}")
        print("Response body  :", resp.text)
        if resp.status_code == 200:
            print("✅ Morning Pulse dispatched! Check your Telegram chat.")
    except Exception as e:
        print("❌ Error reaching server:", e)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manage Telegram Bot Webhook & Scheduled Alerts")
    parser.add_argument("--status", action="store_true", help="Inspect current webhook registration")
    parser.add_argument("--set", action="store_true", help="Register webhook to cloud backend")
    parser.add_argument("--delete", action="store_true", help="Delete webhook (enable local polling)")
    parser.add_argument("--url", type=str, help="Custom webhook URL override")
    parser.add_argument("--trigger-alert", action="store_true", help="Trigger 8:00 AM daily briefing pulse now")

    args = parser.parse_args()

    if args.set:
        set_webhook(args.url)
    elif args.delete:
        delete_webhook()
    elif args.trigger_alert:
        trigger_alert()
    else:
        check_status()
