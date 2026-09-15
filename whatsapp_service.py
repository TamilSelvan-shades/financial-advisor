"""
whatsapp_service.py - Production Multi-Provider WhatsApp Messaging Engine
Supports:
  1. Meta WhatsApp Cloud API (Graph API v21.0)
  2. Twilio WhatsApp API
  3. Graceful Mock / Dev fallback when credentials are unconfigured

Handles outbound message dispatch, quick reply options, and typography
formatting tailored for WhatsApp (*bold*, _italics_, emojis).
"""

import os
import sys
import re
import json
import logging
from typing import Any, Dict, List, Optional, Tuple
import requests
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

# Provider Configuration
WHATSAPP_PROVIDER = os.getenv("WHATSAPP_PROVIDER", "").lower()

# Meta WhatsApp Cloud API credentials
META_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
META_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
META_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v21.0")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "advisor_webhook_secret_2026")

# Twilio WhatsApp credentials
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "+14155238886")


def clean_phone_number(raw_phone: str) -> str:
    """Normalizes phone numbers to standard format with country code (e.g. 919876543210)."""
    if not raw_phone:
        return ""
    s = str(raw_phone).replace("whatsapp:", "").strip()
    s = re.sub(r"[^\d+]", "", s)
    if s.startswith("+"):
        s = s[1:]
    # Default to 91 (India) if 10-digit number provided
    if len(s) == 10 and not s.startswith("91"):
        s = "91" + s
    return s


def get_active_provider() -> str:
    """Detects active WhatsApp provider based on environment variables."""
    provider = os.getenv("WHATSAPP_PROVIDER", WHATSAPP_PROVIDER).lower()
    if provider in ["meta", "twilio", "mock"]:
        return provider
    if (os.getenv("WHATSAPP_ACCESS_TOKEN") or META_ACCESS_TOKEN) and (os.getenv("WHATSAPP_PHONE_NUMBER_ID") or META_PHONE_NUMBER_ID):
        return "meta"
    if (os.getenv("TWILIO_ACCOUNT_SID") or TWILIO_ACCOUNT_SID) and (os.getenv("TWILIO_AUTH_TOKEN") or TWILIO_AUTH_TOKEN):
        return "twilio"
    return "mock"


def send_whatsapp_message(
    to_phone: str,
    message: str,
    quick_replies: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Dispatches a text message (and optional quick reply buttons) to a recipient via
    Meta Cloud API or Twilio WhatsApp API.
    """
    norm_phone = clean_phone_number(to_phone)
    if not norm_phone:
        return {"status": "error", "message": "Invalid recipient phone number."}

    provider = get_active_provider()

    # ----------------------------------------------------
    # 1. META WHATSAPP CLOUD API
    # ----------------------------------------------------
    if provider == "meta":
        phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID") or META_PHONE_NUMBER_ID
        access_token = os.getenv("WHATSAPP_ACCESS_TOKEN") or META_ACCESS_TOKEN
        api_ver = os.getenv("WHATSAPP_API_VERSION") or META_API_VERSION
        url = f"https://graph.facebook.com/{api_ver}/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        # If quick reply buttons are provided (up to 3 supported by Meta)
        if quick_replies and len(quick_replies) <= 3:
            buttons = [
                {
                    "type": "reply",
                    "reply": {"id": f"btn_{i+1}", "title": str(btn)[:20]}
                }
                for i, btn in enumerate(quick_replies)
            ]
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": norm_phone,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": message},
                    "action": {"buttons": buttons}
                }
            }
        else:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": norm_phone,
                "type": "text",
                "text": {"preview_url": False, "body": message}
            }

        try:
            res = requests.post(url, json=payload, headers=headers, timeout=10)
            data = res.json()
            if res.status_code in [200, 201]:
                return {"status": "sent", "provider": "meta", "response": data}

            err_obj = data.get("error", {})
            err_code = err_obj.get("code")
            raw_msg = err_obj.get("message", "Unknown Meta API error")

            # If outside 24-hr customer care window, try fallback to pre-approved hello_world template
            if err_code == 131047:
                logger.info("24-hr window closed. Attempting fallback to pre-approved hello_world template...")
                tpl_payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": norm_phone,
                    "type": "template",
                    "template": {
                        "name": "hello_world",
                        "language": {"code": "en_US"}
                    }
                }
                tpl_res = requests.post(url, json=tpl_payload, headers=headers, timeout=10)
                if tpl_res.status_code in [200, 201]:
                    return {
                        "status": "sent",
                        "provider": "meta",
                        "response": tpl_res.json(),
                        "note": "Delivered via Meta hello_world template (24-hour window was closed). Please reply 'Hi' from your phone to receive custom alert pulses."
                    }

            if err_code == 190:
                friendly_err = "Meta Access Token is expired or invalid. Please click 'Generate token' on the Meta Developer Portal and update WHATSAPP_ACCESS_TOKEN in .env."
            elif err_code == 131030:
                friendly_err = f"Phone number +{norm_phone} is not verified in your Meta Sandbox allowlist. Go to Meta WhatsApp API Setup > Recipient > 'Manage phone number list' to add it."
            elif err_code == 131047:
                friendly_err = "WhatsApp 24-hr customer care window closed. Please send a message (e.g. 'Hi') from your phone to your Meta test number, or use an approved template."
            else:
                friendly_err = f"Meta WhatsApp API Error ({res.status_code}): {raw_msg}"

            logger.error(f"Meta WhatsApp API Error ({res.status_code}): {friendly_err}")
            return {
                "status": "error",
                "provider": "meta",
                "error": data,
                "error_message": friendly_err,
                "code": err_code,
            }
        except Exception as e:
            logger.error(f"Failed to call Meta WhatsApp API: {e}")
            return {"status": "error", "provider": "meta", "error": str(e), "error_message": str(e)}

    # ----------------------------------------------------
    # 2. TWILIO WHATSAPP API
    # ----------------------------------------------------
    elif provider == "twilio":
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
        from_number = clean_phone_number(TWILIO_WHATSAPP_NUMBER)
        data_payload = {
            "From": f"whatsapp:+{from_number}",
            "To": f"whatsapp:+{norm_phone}",
            "Body": message,
        }

        try:
            res = requests.post(
                url,
                data=data_payload,
                auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                timeout=10,
            )
            data = res.json()
            if res.status_code in [200, 201]:
                return {"status": "sent", "provider": "twilio", "response": data}
            else:
                logger.error(f"Twilio WhatsApp Error ({res.status_code}): {data}")
                return {"status": "error", "provider": "twilio", "error": data}
        except Exception as e:
            logger.error(f"Failed to call Twilio WhatsApp API: {e}")
            return {"status": "error", "provider": "twilio", "error": str(e)}

    # ----------------------------------------------------
    # 3. MOCK / DEVELOPMENT FALLBACK
    # ----------------------------------------------------
    else:
        sys_enc = getattr(sys.stdout, "encoding", "utf-8") or "utf-8"
        try:
            safe_msg = message.encode(sys_enc, errors="replace").decode(sys_enc)
        except Exception:
            safe_msg = str(message)

        try:
            print(f"\n[WHATSAPP MOCK DISPATCH -> +{norm_phone}]")
            print("-" * 50)
            print(safe_msg)
            if quick_replies:
                print("Quick Replies:", quick_replies)
            print("-" * 50 + "\n")
        except Exception as e:
            logger.info(f"[WHATSAPP MOCK DISPATCH -> +{norm_phone}]: {safe_msg[:80]}...")
        return {
            "status": "sent",
            "provider": "mock",
            "to": norm_phone,
            "simulated": True,
            "message": "Local development mock simulation successful.",
            "message_preview": safe_msg[:100]
        }


# ========================================================
# WHATSAPP TYPOGRAPHY FORMATTERS
# ========================================================

def format_daily_status_whatsapp_message(status_data: Dict[str, Any], user_name: str = "") -> Tuple[str, List[str]]:
    """
    Formats the 8:00 AM Daily Morning Pulse for WhatsApp typography (*bold*, _italics_).
    Includes safe-to-spend, weekend pacing, 7-day runway, and micro-coaching.
    Returns: (formatted_text, quick_replies_list)
    """
    kpis = status_data.get("kpis", {})
    bills_info = status_data.get("bills", {})
    date_str = status_data.get("formatted_date", "Today")
    guardian = status_data.get("cashflow_guardian", {})

    greeting = f"Hi {user_name}!" if user_name else "Good morning!"
    liquid = kpis.get("liquid_balance", 0.0)
    uncommitted = kpis.get("uncommitted_balance", 0.0)
    safe_daily = kpis.get("adjusted_safe_to_spend_daily", kpis.get("safe_to_spend_daily", 0.0))
    pacing_tag = f" ({kpis.get('weekend_pacing_label')})" if kpis.get("is_weekend") else ""

    yesterday_spend = kpis.get("yesterday_total_spend", 0.0)
    yesterday_recap = kpis.get("yesterday_recap_feedback", "")
    runway_7d = guardian.get("projected_7d_balance", kpis.get("projected_7d_balance", 0.0))

    lines = [
        f"🔔 *Daily Financial Briefing*",
        f"📅 _{date_str}_",
        f"━━━━━━━━━━━━━━━━━━━━━",
        f"{greeting} Here is your daily financial pulse:\n",
        f"💰 *Liquid Cash:* ₹{liquid:,.2f}",
        f"🛡️ *Uncommitted Cushion:* ₹{uncommitted:,.2f}",
        f"⚡ *Safe-to-Spend Today:* ₹{safe_daily:,.2f}{pacing_tag}",
        f"📊 *Yesterday's Spend:* ₹{yesterday_spend:,.2f} ({yesterday_recap})",
    ]

    # Cashflow Runway Indicator
    if guardian.get("has_deficit"):
        status_tag = "🚨 DEFICIT ALERT" if guardian.get("overdraft_risk") else "⚠️ BUFFER SHORTFALL"
        lines.append(f"🛫 *7-Day Cashflow Runway:* ₹{runway_7d:,.2f} [{status_tag}]")
        if guardian.get("transfer_suggestion"):
            lines.append(f"⚡ _{guardian.get('transfer_suggestion')}_")
    else:
        lines.append(f"🛫 *7-Day Cashflow Runway:* ₹{runway_7d:,.2f} [HEALTHY]")

    # Actionable Bills
    overdue_bills = bills_info.get("overdue_bills", [])
    due_today_bills = bills_info.get("due_today_bills", [])
    upcoming_7d = bills_info.get("upcoming_7d_bills", [])

    if overdue_bills:
        lines.append(f"\n🚨 *Action Required: {len(overdue_bills)} Overdue Bill(s):*")
        for i, b in enumerate(overdue_bills[:3], 1):
            lines.append(f"• *PAY {i}*: {b['name']} - ₹{b['amount']:,.2f} ({b['label']})")
    elif due_today_bills:
        lines.append(f"\n⚠️ *Due Today ({len(due_today_bills)}):*")
        for i, b in enumerate(due_today_bills[:3], 1):
            lines.append(f"• *PAY {i}*: {b['name']} - ₹{b['amount']:,.2f}")
    elif upcoming_7d:
        lines.append(f"\n🗓️ *Upcoming in Next 7 Days ({len(upcoming_7d)}):*")
        for b in upcoming_7d[:3]:
            lines.append(f"• {b['name']}: ₹{b['amount']:,.2f} ({b['label']})")
    else:
        lines.append("\n✅ *Bills:* No pending dues this week. You are all caught up!")

    # Micro-Coaching
    insight = status_data.get("ai_insight")
    if insight:
        lines.append(f"\n🤖 *Copilot Daily Coaching:*\n_{insight}_")

    lines.append("\n━━━━━━━━━━━━━━━━━━━━━")
    lines.append("💬 _Reply with: 'Paid gym 2500' | 'Can I afford 40000 laptop?' | 'Radar'_")

    quick_replies = ["Safe to Spend", "View Bills", "Radar"]
    return "\n".join(lines), quick_replies


def format_what_if_whatsapp_message(sim_result: Dict[str, Any]) -> str:
    """Formats What-If simulation results for WhatsApp."""
    scen = sim_result.get("scenario_type", "")

    if "afford" in scen:
        item = sim_result.get("expense_name", "Item")
        cost = sim_result.get("expense_amount", 0.0)
        verdict = sim_result.get("verdict", "")
        score = sim_result.get("feasibility_score", 0)
        risk = sim_result.get("risk_level", "")
        curr_daily = sim_result.get("current_safe_to_spend_daily", 0.0)
        new_daily = sim_result.get("new_safe_to_spend_daily", 0.0)
        post_cushion = sim_result.get("post_expense_uncommitted", 0.0)
        summary = sim_result.get("summary", "")

        icon = "🟢" if "afford" in verdict.lower() else ("🟡" if "caution" in verdict.lower() else "🔴")
        return (
            f"🔮 *What-If Scenario: Affordability Check*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯 *Item:* {item} (₹{cost:,.2f})\n"
            f"{icon} *Verdict:* *{verdict}* (Score: {score}/100, {risk} Risk)\n\n"
            f"📉 *Liquidity Impact:*\n"
            f"• Post-Purchase Cushion: *₹{post_cushion:,.2f}*\n"
            f"• Daily Safe-to-Spend: ₹{curr_daily:,.2f}/day ➔ *₹{new_daily:,.2f}/day*\n\n"
            f"💡 *Advisor Recommendation:*\n_{summary}_"
        )

    elif "emi" in scen:
        item = sim_result.get("item_name", "Item")
        cost = sim_result.get("item_cost", 0.0)
        emi = sim_result.get("monthly_emi", 0.0)
        months = sim_result.get("tenure_months", 6)
        interest = sim_result.get("total_interest", 0.0)
        surplus = sim_result.get("scenario_monthly_surplus", 0.0)
        daily_drain = sim_result.get("daily_safe_impact", 0.0)
        verdict = sim_result.get("verdict", "")
        score = sim_result.get("feasibility_score", 0)
        summary = sim_result.get("summary", "")

        return (
            f"🔮 *What-If Scenario: EMI Purchase Analysis*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"📦 *Item:* {item} (Principal: ₹{cost:,.2f})\n"
            f"⏱️ *Tenure:* {months} months\n"
            f"🟢 *Verdict:* *{verdict}* (Score: {score}/100)\n\n"
            f"💳 *Cashflow Impact:*\n"
            f"• Monthly EMI: *₹{emi:,.2f}/month*\n"
            f"• Total Interest: ₹{interest:,.2f}\n"
            f"• Surplus Remainder: ₹{surplus:,.2f}/month\n"
            f"• Discretionary Allowance Drain: -₹{daily_drain:,.2f}/day\n\n"
            f"💡 *Advisor Recommendation:*\n_{summary}_"
        )

    elif "prepay" in scen:
        loan_name = sim_result.get("loan_name", "Loan")
        prepay = sim_result.get("prepayment_amount", 0.0)
        saved = sim_result.get("interest_saved", 0.0)
        months_knocked = sim_result.get("months_saved", 0)
        rev_tenure = sim_result.get("revised_tenure_months", 0)
        summary = sim_result.get("summary", "")

        return (
            f"🔮 *What-If Scenario: Loan Prepayment Simulator*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏦 *Target Loan:* {loan_name}\n"
            f"💰 *Lump-Sum Prepayment:* ₹{prepay:,.2f}\n\n"
            f"🎉 *Impact & Savings:*\n"
            f"• Future Interest Saved: *₹{saved:,.2f}*\n"
            f"• Freedom Accelerated: *{months_knocked} months knocked off!*\n"
            f"• Revised Closure Horizon: {rev_tenure} months\n\n"
            f"💡 *Advisor Recommendation:*\n_{summary}_"
        )

    return "Unable to compute What-If scenario."


def format_discovered_radar_whatsapp_message(discovered: List[Dict[str, Any]]) -> str:
    """Formats discovered subscriptions radar for WhatsApp with text shortcut replies."""
    if not discovered:
        return (
            "🤖 *AI Subscription Auto-Discovery Radar*\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "✅ *Radar Clean!* No untracked recurring subscriptions detected in your recent transactions."
        )

    lines = [
        "🤖 *AI Subscription Auto-Discovery Radar*",
        "━━━━━━━━━━━━━━━━━━━━━",
        f"I analyzed your transaction history and detected *{len(discovered)} recurring subscription(s)* not yet tracked in your bills:\n",
    ]

    for idx, d in enumerate(discovered[:4], 1):
        name = d.get("name") or d.get("merchant", "Subscription")
        amt = d.get("amount") or d.get("average_amount", 0.0)
        due_day = d.get("detected_due_day") or d.get("due_day", 1)
        conf = d.get("confidence", 90)
        lines.append(
            f"*{idx}. {name}*\n"
            f"   • Amount: ₹{amt:,.2f}/month\n"
            f"   • Cadence: ~Day {due_day} of month ({conf}% Match)\n"
            f"   👉 _Reply *TRACK {idx}* to track this bill_"
        )

    lines.append("\n━━━━━━━━━━━━━━━━━━━━━")
    lines.append("Reply *TRACK 1* or *TRACK 2* to start tracking automatically!")
    return "\n".join(lines)


def format_overdue_warning_whatsapp_message(overdue_bills: List[Dict[str, Any]]) -> str:
    """Formats critical overdue bills alert for WhatsApp."""
    total_amt = sum(float(b.get("amount", 0.0)) for b in overdue_bills)
    lines = [
        "🚨 *Overdue Bills Alert - Action Required*",
        "━━━━━━━━━━━━━━━━━━━━━",
        f"You have *{len(overdue_bills)} overdue bill(s)* totaling *₹{total_amt:,.2f}*:",
    ]
    for idx, b in enumerate(overdue_bills, 1):
        lines.append(f"• *{idx}. {b['name']}*: ₹{float(b['amount']):,.2f} ({b.get('label', 'Past due')})")

    lines.append("\n💡 Reply with *PAID <bill_name>* or *PAY 1* once you have cleared the payment to record it to your ledger.")
    return "\n".join(lines)
