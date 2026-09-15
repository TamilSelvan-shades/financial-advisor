"""
Phase 3 Verification Script:
Tests Recurring Radar, Cashflow Runway Guardian, What-If Simulator, and Enriched Morning Pulse.
"""

import sys
import os
import uuid
import datetime

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from database import SessionLocal
import models
from recurring_radar import discover_recurring_bills, normalize_merchant_name
from simulation_engine import (
    simulate_discretionary_affordability,
    simulate_emi_purchase,
    simulate_loan_prepayment
)
from reminder_service import (
    compute_cashflow_runway,
    get_tenant_reminders_and_status,
    format_daily_status_telegram_message
)
from telegram_listener import handle_what_if_scenario, format_discovered_subscriptions_telegram

def test_phase3_features():
    db = SessionLocal()

    print("=" * 60)
    print("PHASE 3 VERIFICATION SUITE")
    print("=" * 60)

    # Create an isolated test user with proper UUID
    test_user_id = uuid.uuid4()
    test_user = models.User(
        id=test_user_id,
        email=f"phase3_{test_user_id.hex[:8]}@example.com",
        hashed_password="hashed_pass_placeholder",
        is_active=True
    )
    db.add(test_user)
    db.commit()

    tenant_id = str(test_user_id)
    print(f"Created dedicated test user tenant: {tenant_id}")

    try:
        # ----------------------------------------------------
        # 1. TEST RECURRING RADAR
        # ----------------------------------------------------
        print("\n--- 1. Testing AI Recurring Bill Radar ---")
        today = datetime.date.today()

        # Add 3 months of Netflix (not in bills)
        # and 3 months of Airtel (already in bills)
        for i in range(3):
            exp_date = today - datetime.timedelta(days=30 * (3 - i))
            # Netflix
            db.add(models.Expense(
                tenant_id=test_user_id,
                description="NETFLIX MUMBAI IN",
                amount=649.0,
                date=exp_date.isoformat(),
                category="Entertainment",
                account="Credit Card"
            ))
            # Airtel
            db.add(models.Expense(
                tenant_id=test_user_id,
                description="AIRTEL FIBER 999",
                amount=1178.0,
                date=exp_date.isoformat(),
                category="Utilities",
                account="ICICI Savings Account"
            ))
            # Random non-recurring coffee
            db.add(models.Expense(
                tenant_id=test_user_id,
                description="STARBUCKS CAFE",
                amount=350.0,
                date=(today - datetime.timedelta(days=i * 12)).isoformat(),
                category="Dining",
                account="UPI"
            ))

        # Add Airtel as existing bill
        db.add(models.Bill(
            tenant_id=test_user_id,
            name="Airtel Broadband",
            amount=1178.0,
            due_day=exp_date.day,
            status="Pending"
        ))
        db.commit()

        discovered = discover_recurring_bills(db, tenant_id=tenant_id)
        print(f"Discovered items count: {len(discovered)}")
        for d in discovered:
            print(f" -> Merchant: {d.get('name') or d.get('merchant')}, Amount: ₹{d['amount']}, Occurrences: {d['occurrence_count']}, Conf: {d['confidence']}, Due Day: ~{d['due_day']}")

        # Assertions for radar
        netflix_found = any("NETFLIX" in (d.get("name") or d.get("merchant") or "").upper() for d in discovered)
        airtel_found = any("AIRTEL" in (d.get("name") or d.get("merchant") or "").upper() for d in discovered)
        assert netflix_found, "Expected Netflix to be discovered by AI Recurring Radar"
        assert not airtel_found, "Expected Airtel to be excluded since it is already in active bills"
        print("✓ AI Recurring Radar passed! (Netflix discovered, Airtel suppressed as existing bill)")

        # Test Telegram radar message formatting
        radar_msg, radar_kb = format_discovered_subscriptions_telegram(discovered)
        assert "AI Subscription Auto-Discovery Radar" in radar_msg
        assert "NETFLIX" in radar_msg.upper()
        assert radar_kb is not None
        print("✓ Telegram /radar formatting and inline keyboard generation passed!")

        # ----------------------------------------------------
        # 2. TEST CASHFLOW RUNWAY & DEFICIT GUARDIAN
        # ----------------------------------------------------
        print("\n--- 2. Testing Safe-to-Pay Cashflow Runway Guardian ---")
        
        # Test Case A: Safe position (high liquid, low upcoming bills)
        runway_safe = compute_cashflow_runway(db, tenant_id=tenant_id, as_of_date=today, liquid_balance=60000.0)
        print("Safe Runway:", runway_safe)
        assert not runway_safe["has_deficit"], "Expected safe runway when balance is ₹60,000"
        assert not runway_safe["overdraft_risk"], "No overdraft expected"
        print("✓ Safe Runway passed!")

        # Test Case B: Buffer deficit / overdraft position
        # Add high upcoming bills in next 7 days
        target_day = (today + datetime.timedelta(days=3)).day
        db.add(models.Bill(
            tenant_id=test_user_id,
            name="Commercial Rent",
            amount=25000.0,
            due_day=target_day,
            status="Pending"
        ))
        db.commit()

        runway_tight = compute_cashflow_runway(db, tenant_id=tenant_id, as_of_date=today, liquid_balance=15000.0)
        print("Tight Runway:", runway_tight)
        assert runway_tight["has_deficit"], "Expected deficit when balance is ₹15,000 and 7d dues are ₹25,000+"
        assert runway_tight["overdraft_risk"], "Expected overdraft risk when projected balance is negative"
        assert runway_tight["transfer_suggestion"] is not None, "Expected automated transfer suggestion"
        print("✓ Cashflow Deficit Guardian passed with transfer suggestion:", runway_tight["transfer_suggestion"])

        # ----------------------------------------------------
        # 3. TEST CONVERSATIONAL WHAT-IF SIMULATOR
        # ----------------------------------------------------
        print("\n--- 3. Testing Conversational What-If Simulator ---")

        # Set up financial profile for simulation
        db.add(models.Income(
            tenant_id=test_user_id,
            description="Primary Tech Salary",
            amount=120000.0,
            date=today.isoformat(),
            category="Salary",
            account="ICICI Savings Account"
        ))
        db.add(models.Loan(
            tenant_id=test_user_id,
            name="HDFC Auto Loan",
            principal=600000.0,
            interest_rate=9.5,
            tenure_months=36,
            tenure_years=3.0,
            start_date=(today - datetime.timedelta(days=365)).isoformat()
        ))
        db.commit()

        # Test 3.1: Discretionary Affordability
        sim_afford = simulate_discretionary_affordability(
            current_liquid_balance=50000.0,
            current_uncommitted=35000.0,
            days_left_in_cycle=15,
            expense_amount=55000.0,
            expense_name="Apple iPad Air"
        )
        print("Affordability Sim:", sim_afford)
        assert "verdict" in sim_afford
        assert "feasibility_score" in sim_afford
        assert "new_safe_to_spend_daily" in sim_afford
        print(f"✓ Discretionary Affordability passed: {sim_afford['verdict']} (Score: {sim_afford['feasibility_score']})")

        # Test 3.2: EMI Purchase Simulation
        sim_emi = simulate_emi_purchase(
            current_liquid_balance=50000.0,
            current_monthly_income=120000.0,
            current_monthly_expense=50000.0,
            days_left_in_cycle=15,
            item_cost=120000.0,
            tenure_months=12,
            annual_interest_rate=14.0,
            item_name="Gaming Rig"
        )
        print("EMI Purchase Sim:", sim_emi)
        assert sim_emi["monthly_emi"] > 0
        assert sim_emi["total_interest"] > 0
        assert "feasibility_score" in sim_emi
        print(f"✓ EMI Purchase passed: EMI=₹{sim_emi['monthly_emi']}/mo, Interest=₹{sim_emi['total_interest']}, Score={sim_emi['feasibility_score']}")

        # Test 3.3: Loan Prepayment Simulation
        sim_prep = simulate_loan_prepayment(
            principal=600000.0,
            annual_interest_rate=9.5,
            tenure_months=36,
            prepayment_amount=100000.0,
            loan_name="HDFC Auto Loan"
        )
        print("Prepayment Sim:", sim_prep)
        assert sim_prep["interest_saved"] > 0
        assert sim_prep["months_saved"] > 0
        print(f"✓ Loan Prepayment passed: Saved ₹{sim_prep['interest_saved']}, Reduced {sim_prep['months_saved']} months!")

        # Test 3.4: Telegram Natural Language Handler for What-If
        tg_afford = handle_what_if_scenario(db, tenant_id, {
            "scenario_type": "affordability",
            "amount": 40000.0,
            "name": "Soundbar"
        })
        print("Telegram What-If Affordability Response:\n", tg_afford)
        assert "What-If Scenario: Affordability Check" in tg_afford
        assert "Soundbar" in tg_afford or "40,000" in tg_afford

        tg_emi = handle_what_if_scenario(db, tenant_id, {
            "scenario_type": "emi",
            "amount": 90000.0,
            "name": "MacBook",
            "tenure_months": 6,
            "annual_interest_rate": 14.0
        })
        print("Telegram What-If EMI Response:\n", tg_emi)
        assert "What-If Scenario: EMI Purchase Analysis" in tg_emi
        assert "Macbook" in tg_emi or "MacBook" in tg_emi

        tg_prep = handle_what_if_scenario(db, tenant_id, {
            "scenario_type": "prepayment",
            "amount": 80000.0,
            "name": "Auto Loan"
        })
        print("Telegram What-If Prepay Response:\n", tg_prep)
        assert "What-If Scenario: Loan Prepayment Simulator" in tg_prep
        assert "Interest Saved" in tg_prep
        print("✓ Telegram What-If Handler dispatching passed!")

        # ----------------------------------------------------
        # 4. TEST ENRICHED DAILY MORNING PULSE
        # ----------------------------------------------------
        print("\n--- 4. Testing Enriched Morning Financial Pulse ---")
        status_payload = get_tenant_reminders_and_status(db, tenant_id, as_of_date=today)
        print("Pulse KPI keys:", list(status_payload["kpis"].keys()))
        assert "adjusted_safe_to_spend_daily" in status_payload["kpis"]
        assert "is_weekend" in status_payload["kpis"]
        assert "yesterday_target" in status_payload["kpis"]
        assert "yesterday_spend_diff" in status_payload["kpis"]
        assert "cashflow_guardian" in status_payload

        # Test Daily Telegram Message Formatting
        pulse_telegram_msg = format_daily_status_telegram_message(status_payload)
        print("Enriched Telegram Pulse Output:\n", pulse_telegram_msg)
        assert "Safe-to-Spend" in pulse_telegram_msg
        assert "Cashflow Runway" in pulse_telegram_msg
        print("✓ Enriched Morning Pulse Telegram formatting passed!")

        print("\n" + "=" * 60)
        print("ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉")
        print("=" * 60)

    finally:
        # Clean up test user & cascading relationships
        db.delete(test_user)
        db.commit()
        db.close()
        print("Cleaned up test tenant data.")

if __name__ == "__main__":
    test_phase3_features()
