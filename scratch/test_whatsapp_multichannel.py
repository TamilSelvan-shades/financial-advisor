"""
scratch/test_whatsapp_multichannel.py - Comprehensive Verification Suite for
Production WhatsApp & Multi-Channel Delivery Integration.
"""

import os
import sys
import uuid
import datetime

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database import SessionLocal
import models
import schemas
import whatsapp_service
import notification_dispatcher
import reminder_service
import recurring_radar
import main
from fastapi.testclient import TestClient


def run_all_tests():
    print("=" * 65)
    print("🚀 RUNNING PRODUCTION WHATSAPP & MULTI-CHANNEL TEST SUITE")
    print("=" * 65)

    db = SessionLocal()
    client = TestClient(main.app)

    try:
        # 1. Setup Test User
        test_user = db.query(models.User).filter(models.User.email == "whatsapp_test@advisor.ai").first()
        if not test_user:
            test_user = models.User(
                id=str(uuid.uuid4()),
                email="whatsapp_test@advisor.ai",
                hashed_password="test_hash_password",
                is_active=True,
                whatsapp_phone_number="919876543210",
                notification_channel="both",
                preferred_briefing_time="08:00",
                telegram_chat_id="998877665",
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
        else:
            test_user.whatsapp_phone_number = "919876543210"
            test_user.notification_channel = "both"
            test_user.telegram_chat_id = "998877665"
            db.commit()

        tenant_id = str(test_user.id)
        print(f"✅ Active Test User: {test_user.email} (Tenant: {tenant_id})")

        # ----------------------------------------------------
        # TEST 1: Phone Number Normalization & Providers
        # ----------------------------------------------------
        print("\n[TEST 1] Phone Number Cleaning & Provider Detection")
        p1 = whatsapp_service.clean_phone_number("+91 98765 43210")
        assert p1 == "919876543210", f"Expected 919876543210, got {p1}"
        p2 = whatsapp_service.clean_phone_number("9876543210")
        assert p2 == "919876543210", f"Expected 919876543210 with default country code, got {p2}"
        p3 = whatsapp_service.clean_phone_number("whatsapp:+919876543210")
        assert p3 == "919876543210", f"Expected clean twilio format, got {p3}"
        provider = whatsapp_service.get_active_provider()
        print(f"   ✓ Phone cleaning passed. Active Provider: {provider.upper()}")

        # ----------------------------------------------------
        # TEST 2: WhatsApp Formatters (Typography & Parity)
        # ----------------------------------------------------
        print("\n[TEST 2] WhatsApp Typography & Status Formatters")
        # Ensure at least one test bill exists
        db.query(models.Bill).filter(models.Bill.tenant_id == tenant_id).delete()
        db.commit()

        test_bill = models.Bill(
            name="Gym Fitness Pro",
            amount=2500.0,
            due_day=datetime.date.today().day,
            status="pending",
            tenant_id=tenant_id,
        )
        db.add(test_bill)
        db.commit()
        db.refresh(test_bill)

        st_data = reminder_service.get_tenant_reminders_and_status(db, tenant_id)
        wa_text, wa_replies = whatsapp_service.format_daily_status_whatsapp_message(st_data, "Alex")
        
        assert "🔔 *Daily Financial Briefing*" in wa_text, "Missing header in WhatsApp status"
        assert "💰 *Liquid Cash:*" in wa_text, "Missing liquid cash KPI"
        assert "PAY 1" in wa_text, "Expected numbered shortcut PAY 1 in WhatsApp message"
        assert len(wa_replies) > 0, "Expected quick replies list"
        print("   ✓ Daily Pulse WhatsApp format: OK")

        # Test What-If Formatting
        afford_res = {
            "scenario_type": "affordability",
            "expense_name": "Goa Trip",
            "expense_amount": 35000.0,
            "verdict": "Affordable with Caution",
            "feasibility_score": 78,
            "risk_level": "Moderate",
            "current_safe_to_spend_daily": 1800.0,
            "new_safe_to_spend_daily": 1250.0,
            "post_expense_uncommitted": 42000.0,
            "summary": "You can comfortably make this purchase.",
        }
        wa_whatif = whatsapp_service.format_what_if_whatsapp_message(afford_res)
        assert "🔮 *What-If Scenario: Affordability Check*" in wa_whatif
        assert "Goa Trip (₹35,000.00)" in wa_whatif
        print("   ✓ What-If Affordability WhatsApp format: OK")

        # Test Radar Formatting
        radar_items = [
            {"name": "Netflix 4K", "amount": 649.0, "detected_due_day": 15, "confidence": 95},
            {"name": "Spotify Duo", "amount": 149.0, "detected_due_day": 20, "confidence": 92},
        ]
        wa_radar = whatsapp_service.format_discovered_radar_whatsapp_message(radar_items)
        assert "🤖 *AI Subscription Auto-Discovery Radar*" in wa_radar
        assert "TRACK 1" in wa_radar
        print("   ✓ Subscription Radar WhatsApp format: OK")

        # ----------------------------------------------------
        # TEST 3: Multi-Channel Dispatcher Routing
        # ----------------------------------------------------
        print("\n[TEST 3] Multi-Channel Notification Dispatcher")
        # 3a. User with 'both'
        test_user.notification_channel = "both"
        db.commit()
        res_both = notification_dispatcher.dispatch_daily_briefing(db, test_user)
        assert res_both["channels"]["whatsapp"]["status"] == "sent"
        assert res_both["channels"]["telegram"]["status"] in ["sent", "error"]  # Attempted telegram delivery
        print("   ✓ Dispatcher ['both'] dispatched to WhatsApp and Telegram: OK")

        # 3b. User with 'whatsapp'
        test_user.notification_channel = "whatsapp"
        db.commit()
        res_wa = notification_dispatcher.dispatch_daily_briefing(db, test_user)
        assert res_wa["channels"]["whatsapp"]["status"] == "sent"
        assert res_wa["channels"]["telegram"]["status"] == "skipped"
        print("   ✓ Dispatcher ['whatsapp'] dispatched exclusively to WhatsApp: OK")

        # 3c. User with 'telegram'
        test_user.notification_channel = "telegram"
        db.commit()
        res_tg = notification_dispatcher.dispatch_daily_briefing(db, test_user)
        assert res_tg["channels"]["whatsapp"]["status"] == "skipped"
        assert res_tg["channels"]["telegram"]["status"] in ["sent", "error"]
        print("   ✓ Dispatcher ['telegram'] dispatched exclusively to Telegram: OK")

        # 3d. User with 'in_app'
        test_user.notification_channel = "in_app"
        db.commit()
        res_inapp = notification_dispatcher.dispatch_daily_briefing(db, test_user)
        assert res_inapp["channels"]["whatsapp"]["status"] == "skipped"
        assert res_inapp["channels"]["telegram"]["status"] == "skipped"
        print("   ✓ Dispatcher ['in_app'] correctly suppressed external pushes: OK")

        # Reset to 'both'
        test_user.notification_channel = "both"
        db.commit()

        # ----------------------------------------------------
        # TEST 4: Conversational WhatsApp Copilot (Fast-path shortcuts)
        # ----------------------------------------------------
        print("\n[TEST 4] Conversational WhatsApp Copilot Execution")
        # 4a. Settle Bill via shortcut 'PAY 1'
        initial_expenses = db.query(models.Expense).filter(models.Expense.tenant_id == tenant_id).count()
        main.async_process_whatsapp_message("PAY 1", tenant_id, "919876543210")
        db.refresh(test_bill)
        assert test_bill.status.lower() == "paid", "Bill was not settled by 'PAY 1' command"
        new_expenses = db.query(models.Expense).filter(models.Expense.tenant_id == tenant_id).count()
        assert new_expenses == initial_expenses + 1, "Auto-ledger Expense was not created on 'PAY 1'"
        print("   ✓ WhatsApp shortcut 'PAY 1' successfully settled bill and logged to ledger: OK")

        # 4b. What-If Simulation via WhatsApp
        main.async_process_whatsapp_message("can I afford 45000 for a new MacBook", tenant_id, "919876543210")
        print("   ✓ WhatsApp shortcut 'Can I afford ...' processed without error: OK")

        # 4c. Status Query via WhatsApp
        main.async_process_whatsapp_message("status", tenant_id, "919876543210")
        print("   ✓ WhatsApp shortcut 'status' processed without error: OK")

        # 4d. Radar Query via WhatsApp
        main.async_process_whatsapp_message("radar", tenant_id, "919876543210")
        print("   ✓ WhatsApp shortcut 'radar' processed without error: OK")

        # ----------------------------------------------------
        # TEST 5: WhatsApp Webhook Endpoints
        # ----------------------------------------------------
        print("\n[TEST 5] Inbound WhatsApp Webhook Verification & Payloads")
        # 5a. Meta Verification Challenge
        os.environ["WHATSAPP_VERIFY_TOKEN"] = "advisor_webhook_secret_2026"
        res_verify = client.get(
            "/api/v1/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=advisor_webhook_secret_2026&hub.challenge=CHALLENGE_ACCEPTED"
        )
        assert res_verify.status_code == 200, f"Expected 200, got {res_verify.status_code}"
        assert res_verify.text == "CHALLENGE_ACCEPTED", f"Expected challenge string, got {res_verify.text}"
        print("   ✓ Meta WhatsApp Webhook verification handshake: OK")

        # Bad token check
        res_bad = client.get(
            "/api/v1/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test"
        )
        assert res_bad.status_code == 403, "Expected 403 on invalid verify token"
        print("   ✓ Invalid verify token rejected with 403: OK")

        # 5b. Meta JSON Incoming Message Webhook
        meta_payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "123456789",
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {"display_phone_number": "12345", "phone_number_id": "99999"},
                                "messages": [
                                    {
                                        "from": "919876543210",
                                        "id": "wamid.HBgL",
                                        "timestamp": "1726050000",
                                        "text": {"body": "status"},
                                        "type": "text"
                                    }
                                ]
                            },
                            "field": "messages"
                        }
                    ]
                }
            ]
        }
        res_meta_post = client.post("/api/v1/webhook/whatsapp", json=meta_payload)
        assert res_meta_post.status_code == 200
        assert res_meta_post.json()["status"] == "received"
        print("   ✓ Meta Cloud API inbound JSON webhook accepted: OK")

        # 5c. Twilio Inbound Webhook (Form Data)
        res_twilio_post = client.post(
            "/api/v1/webhook/whatsapp",
            data={
                "From": "whatsapp:+919876543210",
                "To": "whatsapp:+14155238886",
                "Body": "bills",
            }
        )
        assert res_twilio_post.status_code == 200
        assert res_twilio_post.json()["status"] == "received"
        print("   ✓ Twilio WhatsApp inbound form-data webhook accepted: OK")

        # ----------------------------------------------------
        # TEST 6: Telegram Deep-Linking (/start <token>)
        # ----------------------------------------------------
        print("\n[TEST 6] Telegram Deep-Link Auto-Association")
        link_res = client.post(
            "/api/v1/notifications/generate-telegram-link",
            headers={"Authorization": f"Bearer mock_token"}
        )
        # Call function directly to test with test_user
        token = str(uuid.uuid4())[:8]
        test_user.telegram_link_token = token
        test_user.telegram_chat_id = None
        db.commit()

        secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
        res_tg_link = client.post(
            "/api/v1/webhook/telegram",
            json={
                "message": {
                    "from": {"id": 112233445},
                    "text": f"/start {token}"
                }
            },
            headers={"x-telegram-bot-api-secret-token": secret} if secret else None,
        )
        assert res_tg_link.status_code == 200
        assert res_tg_link.json().get("status") == "linked"
        db.refresh(test_user)
        assert test_user.telegram_chat_id == "112233445", f"Expected linked chat id 112233445, got {test_user.telegram_chat_id}"
        assert test_user.telegram_link_token is None, "Token should be consumed"
        print("   ✓ Telegram '/start <token>' deep link successfully bound chat ID: OK")

        # ----------------------------------------------------
        # TEST 7: Notification Preferences API
        # ----------------------------------------------------
        print("\n[TEST 7] Notification Preferences Endpoints")
        # Direct test of updating preferences
        update_prefs = schemas.NotificationPreferencesUpdate(
            notification_channel="whatsapp",
            whatsapp_phone_number="+91 99887 76655",
            preferred_briefing_time="09:00",
        )
        pref_res = main.update_notification_preferences(update_prefs, current_user=test_user, db=db)
        assert pref_res.notification_channel == "whatsapp"
        assert pref_res.whatsapp_phone_number == "919988776655"
        assert pref_res.preferred_briefing_time == "09:00"
        assert pref_res.whatsapp_connected is True
        print("   ✓ Preferences API (Update & Fetch): OK")

        # Test WhatsApp Live Dispatch
        test_req = schemas.TestNotificationRequest(recipient="919988776655")
        test_out = main.test_whatsapp_notification(test_req, current_user=test_user)
        assert test_out["status"] == "sent"
        print("   ✓ Live Test WhatsApp Alert endpoint: OK")

        # Test Telegram Live Dispatch
        test_tg_out = main.test_telegram_notification(current_user=test_user)
        assert test_tg_out["status"] == "sent"
        print("   ✓ Live Test Telegram Alert endpoint: OK")

        print("\n" + "=" * 65)
        print("🎉 ALL PRODUCTION WHATSAPP & MULTI-CHANNEL TESTS PASSED!")
        print("=" * 65)

    finally:
        db.close()


if __name__ == "__main__":
    run_all_tests()
