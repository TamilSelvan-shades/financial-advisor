"""
Autonomous Anomaly & Zombie Subscription Detector
Scans financial transactions and recurring commitments for:
- Accidental duplicate swipes / double transactions
- Subscription price creep (quiet price hikes)
- Zombie subscriptions (draining recurring charges)
- Unusual category spending outliers
"""

from typing import List, Dict, Any
from datetime import datetime
from collections import defaultdict
import math


def parse_date(date_str: str) -> datetime:
    """Safely parse various date string formats."""
    if not date_str:
        return datetime.min
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(date_str).strip()[:10], fmt)
        except Exception:
            continue
    try:
        return datetime.fromisoformat(str(date_str).strip()[:10])
    except Exception:
        return datetime.min


def normalize_text(text: str) -> str:
    """Normalizes merchant names for robust grouping."""
    if not text:
        return ""
    cleaned = "".join(c.lower() for c in str(text) if c.isalnum() or c.isspace())
    return " ".join(cleaned.split())


def detect_anomalies(
    expenses: List[Dict[str, Any]],
    bills: List[Dict[str, Any]] = None,
    dismissed_ids: List[str] = None,
) -> List[Dict[str, Any]]:
    """
    Main detection pipeline running across tenant expenses and bills.
    Returns sorted list of actionable anomalies.
    """
    if bills is None:
        bills = []
    if dismissed_ids is None:
        dismissed_ids = []

    dismissed_set = set(dismissed_ids)
    anomalies: List[Dict[str, Any]] = []

    # Filter valid expenses
    valid_expenses = []
    for exp in expenses:
        amt = float(exp.get("amount", 0.0) or 0.0)
        if amt > 0:
            valid_expenses.append({
                "id": exp.get("id"),
                "date": str(exp.get("date", "")),
                "date_obj": parse_date(exp.get("date", "")),
                "amount": amt,
                "description": str(exp.get("description") or exp.get("category") or "Expense").strip(),
                "category": str(exp.get("category") or "Miscellaneous").strip(),
                "account": str(exp.get("account") or "Account").strip(),
            })

    # Sort descending by date
    valid_expenses.sort(key=lambda x: x["date_obj"], reverse=True)

    # -------------------------------------------------------------
    # 1. DUPLICATE TRANSACTION DETECTOR
    # -------------------------------------------------------------
    # Look for identical or nearly identical amounts with matching description within 3 days
    seen_duplicate_pairs = set()
    for i in range(len(valid_expenses)):
        e1 = valid_expenses[i]
        for j in range(i + 1, min(i + 15, len(valid_expenses))):
            e2 = valid_expenses[j]
            # Must be different records
            if e1["id"] == e2["id"]:
                continue

            # Amount match (within 1 rupee or exact)
            if abs(e1["amount"] - e2["amount"]) < 1.0:
                day_diff = abs((e1["date_obj"] - e2["date_obj"]).days)
                norm1 = normalize_text(e1["description"])
                norm2 = normalize_text(e2["description"])
                
                # Close in date (0 to 3 days) and matching description/category
                if day_diff <= 3 and (norm1 == norm2 or (len(norm1) >= 4 and norm1 in norm2) or (len(norm2) >= 4 and norm2 in norm1)):
                    pair_key = tuple(sorted([str(e1["id"]), str(e2["id"])]))
                    if pair_key not in seen_duplicate_pairs:
                        seen_duplicate_pairs.add(pair_key)
                        alert_id = f"dup-{pair_key[0]}-{pair_key[1]}"
                        if alert_id not in dismissed_set:
                            anomalies.append({
                                "id": alert_id,
                                "type": "duplicate_charge",
                                "severity": "high",
                                "title": "Potential Duplicate Charge Detected",
                                "description": f"₹{e1['amount']:,.2f} charged twice at '{e1['description']}' within {day_diff} day(s) ({e2['date']} and {e1['date']}).",
                                "amount": e1["amount"],
                                "date": e1["date"],
                                "action_suggested": "Verify your bank statement to confirm if an accidental double-swipe occurred.",
                                "confidence": 0.95 if day_diff <= 1 else 0.85,
                            })

    # -------------------------------------------------------------
    # 2. SUBSCRIPTION PRICE CREEP DETECTOR
    # -------------------------------------------------------------
    # Group by merchant name and detect recurring price bumps
    merchant_groups = defaultdict(list)
    for exp in valid_expenses:
        norm = normalize_text(exp["description"])
        if len(norm) >= 3:
            merchant_groups[norm].append(exp)

    for norm_name, items in merchant_groups.items():
        if len(items) >= 2:
            # Sort chronologically: oldest to newest
            sorted_items = sorted(items, key=lambda x: x["date_obj"])
            prev = sorted_items[-2]
            curr = sorted_items[-1]
            
            # If price increased by more than 5% and at least ₹20
            if curr["amount"] > prev["amount"] * 1.05 and (curr["amount"] - prev["amount"]) >= 20.0:
                diff_pct = round(((curr["amount"] - prev["amount"]) / prev["amount"]) * 100, 1)
                alert_id = f"creep-{norm_name}-{curr['id']}"
                if alert_id not in dismissed_set:
                    anomalies.append({
                        "id": alert_id,
                        "type": "price_creep",
                        "severity": "medium",
                        "title": f"Subscription Price Creep (+{diff_pct}%)",
                        "description": f"'{curr['description']}' increased from ₹{prev['amount']:,.0f} to ₹{curr['amount']:,.0f} on {curr['date']}.",
                        "amount": curr["amount"] - prev["amount"],
                        "date": curr["date"],
                        "action_suggested": "Review if your plan upgraded or if a promotional rate expired.",
                        "confidence": 0.90,
                    })

    # Compare against configured Bills table
    for bill in bills:
        b_name = normalize_text(bill.get("name", ""))
        b_amt = float(bill.get("amount", 0.0) or 0.0)
        if b_amt > 0 and len(b_name) >= 3:
            matching_exps = [e for e in valid_expenses if b_name in normalize_text(e["description"])]
            if matching_exps:
                latest_exp = matching_exps[0]
                if latest_exp["amount"] > b_amt * 1.08:
                    diff_pct = round(((latest_exp["amount"] - b_amt) / b_amt) * 100, 1)
                    alert_id = f"bill-creep-{bill.get('id')}-{latest_exp['id']}"
                    if alert_id not in dismissed_set and not any(a["id"] == alert_id for a in anomalies):
                        anomalies.append({
                            "id": alert_id,
                            "type": "price_creep",
                            "severity": "medium",
                            "title": f"Bill Overcharge Alert (+{diff_pct}%)",
                            "description": f"'{latest_exp['description']}' cost ₹{latest_exp['amount']:,.0f}, exceeding registered bill target of ₹{b_amt:,.0f}.",
                            "amount": latest_exp["amount"] - b_amt,
                            "date": latest_exp["date"],
                            "action_suggested": "Check for surprise surcharges, late fees, or tariff revisions.",
                            "confidence": 0.88,
                        })

    # -------------------------------------------------------------
    # 3. ZOMBIE SUBSCRIPTION DETECTOR
    # -------------------------------------------------------------
    # Flag recurring subscriptions/utilities that continue month-over-month
    subscription_keywords = ["netflix", "spotify", "prime", "hotstar", "gym", "apple", "cloud", "saas", "membership", "youtube", "patreon", "sub"]
    for norm_name, items in merchant_groups.items():
        is_sub_category = any(i["category"].lower() in ["subscriptions", "utilities", "entertainment"] for i in items)
        has_sub_keyword = any(kw in norm_name for kw in subscription_keywords)
        
        if (is_sub_category or has_sub_keyword) and len(items) >= 2:
            latest = items[0]
            annual_drain = latest["amount"] * 12.0
            alert_id = f"zombie-{norm_name}"
            if alert_id not in dismissed_set and not any(a["type"] == "zombie_subscription" and norm_name in a["id"] for a in anomalies):
                anomalies.append({
                    "id": alert_id,
                    "type": "zombie_subscription",
                    "severity": "medium",
                    "title": "Recurring Subscription Monitor",
                    "description": f"'{latest['description']}' recurring at ₹{latest['amount']:,.0f}/month (₹{annual_drain:,.0f}/year).",
                    "amount": latest["amount"],
                    "date": latest["date"],
                    "action_suggested": "Audit whether you still actively use this service; cancel if redundant to save capital.",
                    "confidence": 0.80,
                })

    # -------------------------------------------------------------
    # 4. UNUSUAL CATEGORY SPENDING OUTLIER
    # -------------------------------------------------------------
    # Check if a recent transaction exceeds 2.5x standard deviations
    cat_expenses = defaultdict(list)
    for exp in valid_expenses:
        cat_expenses[exp["category"]].append(exp)

    for cat, items in cat_expenses.items():
        if len(items) >= 4:
            amounts = [it["amount"] for it in items]
            mean = sum(amounts) / len(amounts)
            variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
            std_dev = math.sqrt(variance)
            threshold = mean + (2.5 * std_dev)

            # Check recent transactions in this category (top 3)
            for recent in items[:3]:
                if recent["amount"] > threshold and recent["amount"] >= 2000.0:
                    alert_id = f"outlier-{recent['id']}"
                    if alert_id not in dismissed_set:
                        ratio = round(recent["amount"] / max(mean, 1.0), 1)
                        anomalies.append({
                            "id": alert_id,
                            "type": "outlier_expense",
                            "severity": "low",
                            "title": f"Unusual {cat} Outlier ({ratio}x Average)",
                            "description": f"₹{recent['amount']:,.0f} on '{recent['description']}' is significantly higher than your typical {cat} average of ₹{mean:,.0f}.",
                            "amount": recent["amount"],
                            "date": recent["date"],
                            "action_suggested": "Ensure this was a planned major expense and adjust category budget if needed.",
                            "confidence": 0.85,
                        })

    # Sort anomalies: High severity first, then by date/amount
    severity_order = {"high": 0, "medium": 1, "low": 2}
    anomalies.sort(key=lambda x: (severity_order.get(x["severity"], 3), -x.get("amount", 0.0)))

    return anomalies
