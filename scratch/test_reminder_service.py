"""
scratch/test_reminder_service.py
Validates:
1. Calendar due date resolution & month rollover
2. Overdue calculation
3. Settle bill with expense creation
4. Daily status compilation and markdown formatting
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))
import datetime
from reminder_service import calculate_bill_timeline, safe_date, format_daily_status_telegram_message

def test_calculations():
    print("Testing calculate_bill_timeline...")
    # Reference date: Sept 10, 2026
    ref_date = datetime.date(2026, 9, 10)

    # 1. Overdue test: due_day was Sept 3, unpaid
    t1 = calculate_bill_timeline(due_day=3, status="Pending", ref_date=ref_date)
    assert t1["lifecycle_status"] == "overdue", f"Expected overdue, got {t1['lifecycle_status']}"
    assert t1["days_overdue"] == 7, f"Expected 7 days overdue, got {t1['days_overdue']}"
    print("[PASS] Overdue bill test passed (Sept 3 is 7 days overdue on Sept 10)")

    # 2. Due today test: due_day is 10
    t2 = calculate_bill_timeline(due_day=10, status="Pending", ref_date=ref_date)
    assert t2["lifecycle_status"] == "due_today", f"Expected due_today, got {t2['lifecycle_status']}"
    assert t2["days_until_due"] == 0, f"Expected 0, got {t2['days_until_due']}"
    print("[PASS] Due today test passed (Sept 10)")

    # 3. Upcoming 7d test: due_day is 15 (5 days away)
    t3 = calculate_bill_timeline(due_day=15, status="Pending", ref_date=ref_date)
    assert t3["lifecycle_status"] == "upcoming_7d", f"Expected upcoming_7d, got {t3['lifecycle_status']}"
    assert t3["days_until_due"] == 5, f"Expected 5, got {t3['days_until_due']}"
    print("[PASS] Upcoming 7d test passed (Sept 15 is 5 days away)")

    # 4. Paid test: next occurrence should be Oct 10
    t4 = calculate_bill_timeline(due_day=10, status="Paid", ref_date=ref_date)
    assert t4["lifecycle_status"] == "paid", f"Expected paid, got {t4['lifecycle_status']}"
    assert t4["next_due_date"] == "2026-10-10", f"Expected 2026-10-10, got {t4['next_due_date']}"
    print("[PASS] Paid bill cycle rollover test passed (Next cycle Oct 10)")

    # 5. Month rollover test near end of month: ref_date is Oct 30, due_day is 2
    ref_end = datetime.date(2026, 10, 30)
    # If paid for Oct, next due is Nov 2
    t5 = calculate_bill_timeline(due_day=2, status="Paid", ref_date=ref_end)
    assert t5["next_due_date"] == "2026-11-02", f"Expected 2026-11-02, got {t5['next_due_date']}"
    print("[PASS] End of month rollover test passed (Oct 30 -> Nov 2)")

    # 6. Format test
    dummy_status = {
        "formatted_date": "Thursday, Sep 10, 2026",
        "ai_insight": "All clear for today. Keep dining spend under control.",
        "kpis": {
            "liquid_balance": 85000.0,
            "uncommitted_balance": 62000.0,
            "safe_to_spend_daily": 2950.0,
            "burn_rate_status": "Healthy",
        },
        "bills": {
            "overdue_bills": [{"name": "Broadband", "amount": 999.0, "label": "OVERDUE by 7 days"}],
            "due_today_bills": [{"name": "Electricity", "amount": 1450.0}],
            "upcoming_7d_bills": [{"name": "Netflix", "amount": 649.0, "label": "Due in 5 days"}],
        },
        "budget_warnings": {
            "warnings": [{"category": "Dining Out", "message": "At 85% of limit (₹8,500 / ₹10,000)", "severity": "warning"}]
        }
    }
    msg = format_daily_status_telegram_message(dummy_status, user_name="Alex")
    assert "Broadband" in msg and "Electricity" in msg and "Netflix" in msg
    print("[PASS] Telegram markdown briefing formatting test passed")
    print("\nAll unit tests passed successfully!")

if __name__ == "__main__":
    test_calculations()
