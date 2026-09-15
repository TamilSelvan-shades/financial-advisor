"""
Helper utility to inject or clear realistic test anomalies:
- Duplicate charge detection (accidental double swipe within 24 hours)
- Subscription price creep (+23% on Netflix)
- Zombie subscription (Cult.fit gym membership recurring for 3 months)

Usage:
  python seed_anomalies.py --action seed
  python seed_anomalies.py --action clear
"""

import argparse
import datetime
from database import SessionLocal
import models


def main():
    parser = argparse.ArgumentParser(description="Seed or clear test financial anomalies.")
    parser.add_argument("--action", choices=["seed", "clear"], default="seed", help="Action to perform")
    parser.add_argument("--email", default="tamildestructor@gmail.com", help="Target user email")
    args = parser.parse_args()

    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == args.email).first()
    if not user:
        # Fallback to first active user
        user = db.query(models.User).first()
    if not user:
        print("[ERROR] No user found in database.")
        db.close()
        return

    print(f"[INFO] Target user: {user.email} (ID: {user.id})")

    # Clear existing test anomalies
    deleted = db.query(models.Expense).filter(
        models.Expense.tenant_id == user.id,
        models.Expense.remarks == "TEST_ANOMALY_RECORD"
    ).delete()
    print(f"[INFO] Cleared {deleted} previous test anomaly expense records.")

    # Reset dismissed anomalies profile
    dismissed = db.query(models.Profile).filter(
        models.Profile.tenant_id == user.id,
        models.Profile.key == "dismissed_anomalies"
    ).first()
    if dismissed:
        dismissed.value = "[]"
        print("[INFO] Reset dismissed anomalies history.")

    if args.action == "clear":
        db.commit()
        db.close()
        print("[SUCCESS] Test anomalies cleared. Account restored to clean standing.")
        return

    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    last_month = today - datetime.timedelta(days=32)
    two_months_ago = today - datetime.timedelta(days=62)

    test_items = [
        # 1. Duplicate Charge Alert
        models.Expense(
            date=yesterday.strftime("%Y-%m-%d"),
            description="Amazon Prime India",
            amount=1499.0,
            category="Subscriptions",
            account="HDFC Bank",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=user.id
        ),
        models.Expense(
            date=today.strftime("%Y-%m-%d"),
            description="Amazon Prime India",
            amount=1499.0,
            category="Subscriptions",
            account="HDFC Bank",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=user.id
        ),
        # 2. Subscription Price Creep Alert
        models.Expense(
            date=last_month.strftime("%Y-%m-%d"),
            description="Netflix Premium 4K",
            amount=649.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=user.id
        ),
        models.Expense(
            date=today.strftime("%Y-%m-%d"),
            description="Netflix Premium 4K",
            amount=799.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=user.id
        ),
        # 3. Zombie Recurring Subscription Alert
        models.Expense(
            date=two_months_ago.strftime("%Y-%m-%d"),
            description="Cult.fit Gym & Fitness",
            amount=1499.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=user.id
        ),
        models.Expense(
            date=last_month.strftime("%Y-%m-%d"),
            description="Cult.fit Gym & Fitness",
            amount=1499.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=user.id
        ),
        models.Expense(
            date=today.strftime("%Y-%m-%d"),
            description="Cult.fit Gym & Fitness",
            amount=1499.0,
            category="Subscriptions",
            account="ICICI Savings Account",
            remarks="TEST_ANOMALY_RECORD",
            tenant_id=user.id
        ),
    ]

    for item in test_items:
        db.add(item)
    db.commit()
    db.close()

    print(f"[SUCCESS] Injected {len(test_items)} test anomaly records!")
    print("Now refresh your Dashboard or Expenses page to see the detector in action.")


if __name__ == "__main__":
    main()
