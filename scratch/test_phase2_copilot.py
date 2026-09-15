"""
scratch/test_phase2_copilot.py
Validates Phase 2 Conversational Copilot:
1. find_matching_bill logic (names, aliases, amounts)
2. add_recurring_bill logic
3. settle_bill_with_expense with ledger verification
4. format_pending_bills_telegram_message and inline keyboard payload
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

from database import SessionLocal
import models
import reminder_service

def test_phase2():
    print("Testing Phase 2 Conversational Copilot Services...")
    db = SessionLocal()

    # Find a test or active user
    user = db.query(models.User).filter(models.User.is_active == True).first()
    if not user:
        print("[SKIP] No active user found in database. Skipping DB operations.")
        db.close()
        return

    tenant_id = str(user.id)
    print(f"Using test tenant: {tenant_id} ({user.email})")

    # Clean up any leftover from previous run
    old_test = db.query(models.Bill).filter(models.Bill.name.like("%Unique Netflix 4K%")).all()
    for ob in old_test:
        db.delete(ob)
    db.commit()

    # 1. Test adding a test recurring bill
    test_bill_name = "Unique Netflix 4K Family"
    test_amount = 799.0
    res = reminder_service.add_recurring_bill(
        db=db,
        tenant_id=tenant_id,
        name=test_bill_name,
        amount=test_amount,
        due_day=18,
        category="Subscriptions",
    )
    assert res["success"] == True
    new_bill = res["bill"]
    print(f"[PASS] add_recurring_bill created bill ID {new_bill['id']}: {new_bill['name']}")

    # 2. Test find_matching_bill with specific term 'netflix'
    matched = reminder_service.find_matching_bill(db, tenant_id, search_term="netflix")
    assert matched is not None, "Failed to match 'netflix' to 'Unique Netflix 4K Family'"
    assert matched.id == new_bill["id"], f"Expected bill {new_bill['id']}, got {matched.id}"
    print(f"[PASS] find_matching_bill matched search 'netflix' -> '{matched.name}'")

    # 3. Test find_matching_bill with amount match
    matched_by_amt = reminder_service.find_matching_bill(db, tenant_id, search_term="", amount=799.0)
    assert matched_by_amt is not None, "Failed to match by exact amount"
    assert matched_by_amt.id == new_bill["id"]
    print(f"[PASS] find_matching_bill matched amount Rs. 799 -> '{matched_by_amt.name}'")

    # 4. Test settle_bill_with_expense
    pre_expense_count = db.query(models.Expense).filter(models.Expense.tenant_id == tenant_id).count()
    settle_res = reminder_service.settle_bill_with_expense(
        db=db,
        tenant_id=tenant_id,
        bill_id=new_bill["id"],
        auto_log_expense=True,
        account="ICICI Savings Account",
    )
    assert settle_res["success"] == True
    post_expense_count = db.query(models.Expense).filter(models.Expense.tenant_id == tenant_id).count()
    assert post_expense_count == pre_expense_count + 1, "Expense was not created in ledger"
    print(f"[PASS] settle_bill_with_expense settled bill and created Expense in ledger! New count: {post_expense_count}")

    # Verify bill status updated
    reloaded_bill = db.query(models.Bill).filter(models.Bill.id == new_bill["id"]).first()
    assert reloaded_bill.status == "Paid", f"Expected Paid, got {reloaded_bill.status}"
    print("[PASS] Bill status successfully updated to 'Paid'")

    # 5. Test format_pending_bills_telegram_message & inline markup
    status_data = reminder_service.get_tenant_reminders_and_status(db, tenant_id)
    msg, markup = reminder_service.format_pending_bills_telegram_message(status_data)
    assert "Pending Bills" in msg or "All caught up" in msg
    print("[PASS] Pending bills message and inline keyboard formatting validated")
    if markup:
        assert "inline_keyboard" in markup
        print(f"[PASS] Inline keyboard contains {len(markup['inline_keyboard'])} button rows")

    # Clean up test bill & created expense
    db.delete(reloaded_bill)
    for exp in db.query(models.Expense).filter(models.Expense.tenant_id == tenant_id).all():
        if "Unique Netflix" in (exp.description or "") or "Act Fibernet" in (exp.description or ""):
            db.delete(exp)
    for b in db.query(models.Bill).filter(models.Bill.tenant_id == tenant_id).all():
        if "Act Fibernet" in (b.name or ""):
            db.delete(b)
    db.commit()
    db.close()
    print("[PASS] Test cleanup completed successfully.")
    print("\nAll Phase 2 tests passed!")

if __name__ == "__main__":
    test_phase2()
