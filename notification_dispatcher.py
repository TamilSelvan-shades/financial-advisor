"""
notification_dispatcher.py - Unified Multi-Channel Notification Dispatcher
Coordinates delivery of daily financial briefings, overdue bill alerts,
cashflow runway deficit warnings, and budget thresholds across user-selected channels:
  - WhatsApp (via whatsapp_service)
  - Telegram (via send_telegram_alert)
  - Both
  - In-App Only
"""

import os
import datetime
import logging
from typing import Any, Dict, List, Optional
import requests
from sqlalchemy.orm import Session

import models
import reminder_service
import whatsapp_service

logger = logging.getLogger(__name__)


def send_telegram_alert_direct(
    chat_id: str,
    text: str,
    reply_markup: Optional[dict] = None,
) -> Dict[str, Any]:
    """Helper to dispatch a Telegram alert message directly."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")

    # Auto-detect if parameters were passed in reverse order (e.g. text, chat_id)
    s1, s2 = str(chat_id or "").strip(), str(text or "").strip()
    is_s1_chat = s1.isdigit() or (s1.startswith("-") and s1[1:].isdigit())
    is_s2_chat = s2.isdigit() or (s2.startswith("-") and s2[1:].isdigit())
    if not is_s1_chat and is_s2_chat:
        actual_chat_id = s2
        actual_text = s1
    elif is_s1_chat and not is_s2_chat:
        actual_chat_id = s1
        actual_text = s2
    else:
        if len(s1) < len(s2):
            actual_chat_id = s1
            actual_text = s2
        else:
            actual_chat_id = s2
            actual_text = s1

    if not token or not actual_chat_id:
        return {"status": "skipped", "reason": "Missing TELEGRAM_BOT_TOKEN or chat_id"}

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": str(actual_chat_id),
        "text": actual_text,
        "parse_mode": "Markdown",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        resp = requests.post(url, json=payload, timeout=10)
        res_json = resp.json()
        if res_json.get("ok"):
            logger.info(f"Telegram alert sent to chat {actual_chat_id}")
            return {"status": "sent", "chat_id": actual_chat_id}
        err_msg = res_json.get("description", "Unknown error")
        logger.error(f"Telegram API delivery error: {err_msg}")
        return {"status": "error", "error": err_msg}
    except Exception as e:
        logger.error(f"Telegram network error: {e}")
        return {"status": "error", "error": str(e)}


def should_send_to_channel(user: models.User, channel: str) -> bool:
    """Evaluates whether the user has opted in to the specified channel."""
    pref = (user.notification_channel or "both").lower()
    if pref == "none" or pref == "in_app":
        return False
    if pref == "both":
        return True
    return pref == channel.lower()


def dispatch_daily_briefing(
    db: Session,
    user: models.User,
    ref_date: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """
    Computes tenant's financial status and dispatches localized Morning Pulse
    to their preferred notification channels (WhatsApp, Telegram, or Both).
    """
    today = ref_date or datetime.date.today()
    status_data = reminder_service.get_tenant_reminders_and_status(db, str(user.id), ref_date=today)
    user_name = user.email.split("@")[0].capitalize() if user.email else ""

    results = {"user_id": str(user.id), "date": today.isoformat(), "channels": {}}

    # 1. WhatsApp Delivery
    if should_send_to_channel(user, "whatsapp") and user.whatsapp_phone_number:
        wa_text, quick_replies = whatsapp_service.format_daily_status_whatsapp_message(status_data, user_name)
        wa_res = whatsapp_service.send_whatsapp_message(
            to_phone=user.whatsapp_phone_number,
            message=wa_text,
            quick_replies=quick_replies,
        )
        results["channels"]["whatsapp"] = wa_res
    else:
        results["channels"]["whatsapp"] = {"status": "skipped", "reason": "Channel disabled or phone not linked"}

    # 2. Telegram Delivery
    if should_send_to_channel(user, "telegram") and user.telegram_chat_id:
        tg_text = reminder_service.format_daily_status_telegram_message(status_data, user_name)
        actionable_bills = (
            status_data["bills"].get("overdue_bills", []) +
            status_data["bills"].get("due_today_bills", [])
        )
        tg_markup = reminder_service.build_bills_inline_keyboard(actionable_bills)
        
        # Dispatch via direct telegram function

        tg_res = send_telegram_alert_direct(
            chat_id=user.telegram_chat_id,
            text=tg_text,
            reply_markup=tg_markup,
        )
        results["channels"]["telegram"] = tg_res
    else:
        results["channels"]["telegram"] = {"status": "skipped", "reason": "Channel disabled or chat_id not linked"}

    return results


def dispatch_bill_overdue_alert(
    db: Session,
    user: models.User,
    overdue_bills: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Dispatches high-priority overdue bill alerts to active channels."""
    if not overdue_bills:
        return {"status": "skipped", "reason": "No overdue bills"}

    results = {"user_id": str(user.id), "channels": {}}

    # WhatsApp
    if should_send_to_channel(user, "whatsapp") and user.whatsapp_phone_number:
        wa_text = whatsapp_service.format_overdue_warning_whatsapp_message(overdue_bills)
        wa_res = whatsapp_service.send_whatsapp_message(user.whatsapp_phone_number, wa_text)
        results["channels"]["whatsapp"] = wa_res

    # Telegram
    if should_send_to_channel(user, "telegram") and user.telegram_chat_id:
        total_due = sum(float(b.get("amount", 0.0)) for b in overdue_bills)
        tg_lines = [
            f"🚨 *Critical Alert: {len(overdue_bills)} Overdue Bill(s)!*",
            f"Total Overdue: *₹{total_due:,.2f}*",
            "Please clear these payments to avoid late charges or service disruption:\n"
        ]
        for b in overdue_bills:
            tg_lines.append(f"• *{b['name']}*: ₹{float(b['amount']):,.2f} ({b.get('label', 'Overdue')})")
        
        tg_markup = reminder_service.build_bills_inline_keyboard(overdue_bills)

        tg_res = send_telegram_alert_direct(user.telegram_chat_id, "\n".join(tg_lines), tg_markup)
        results["channels"]["telegram"] = tg_res

    return results


def dispatch_cashflow_runway_alert(
    db: Session,
    user: models.User,
    runway_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Dispatches proactive cashflow deficit or overdraft warning alerts."""
    if not runway_data.get("has_deficit"):
        return {"status": "skipped", "reason": "Runway is healthy"}

    results = {"user_id": str(user.id), "channels": {}}
    title = runway_data.get("warning_title", "Cashflow Deficit Alert")
    msg = runway_data.get("warning_message", "")
    sugg = runway_data.get("transfer_suggestion") or runway_data.get("suggested_action", "")

    full_text = f"*{title}*\n━━━━━━━━━━━━━━━━━━━━━\n{msg}\n\n💡 *Action Required:*\n_{sugg}_"

    # WhatsApp
    if should_send_to_channel(user, "whatsapp") and user.whatsapp_phone_number:
        results["channels"]["whatsapp"] = whatsapp_service.send_whatsapp_message(
            user.whatsapp_phone_number, full_text
        )

    # Telegram
    if should_send_to_channel(user, "telegram") and user.telegram_chat_id:

        results["channels"]["telegram"] = send_telegram_alert_direct(
            user.telegram_chat_id, full_text
        )

    return results


def dispatch_discovered_radar_alert(
    db: Session,
    user: models.User,
    discovered: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Dispatches newly discovered recurring subscription candidates."""
    if not discovered:
        return {"status": "skipped", "reason": "No discovered subscriptions"}

    results = {"user_id": str(user.id), "channels": {}}

    # WhatsApp
    if should_send_to_channel(user, "whatsapp") and user.whatsapp_phone_number:
        wa_text = whatsapp_service.format_discovered_radar_whatsapp_message(discovered)
        results["channels"]["whatsapp"] = whatsapp_service.send_whatsapp_message(
            user.whatsapp_phone_number, wa_text
        )

    # Telegram
    if should_send_to_channel(user, "telegram") and user.telegram_chat_id:
        from telegram_listener import format_discovered_subscriptions_telegram
        tg_text, tg_markup = format_discovered_subscriptions_telegram(discovered)

        results["channels"]["telegram"] = send_telegram_alert_direct(
            user.telegram_chat_id, tg_text, tg_markup
        )

    return results
