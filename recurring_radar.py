"""
recurring_radar.py - AI Recurring Bill & Subscription Auto-Discovery Radar
Provides:
  1. Expense pattern recognition (merchant normalization, cadence analysis, variance tolerance)
  2. Cross-referencing against existing tracked bills in models.Bill
  3. Confidence scoring and detected due day estimation
  4. Statement-level transaction recurring pattern detection
  5. 1-click acceptance integration
"""

import re
import datetime
import calendar
from collections import defaultdict
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

import models


KNOWN_SUBSCRIPTION_KEYWORDS = {
    "netflix": ("Netflix Subscription", "Entertainment", 5),
    "spotify": ("Spotify Music", "Entertainment", 10),
    "prime": ("Amazon Prime", "Entertainment", 15),
    "hotstar": ("Disney+ Hotstar", "Entertainment", 12),
    "youtube": ("YouTube Premium", "Entertainment", 20),
    "airtel": ("Airtel Broadband / Mobile", "Utilities", 10),
    "jio": ("Jio Fiber / Mobile", "Utilities", 8),
    "hathway": ("Hathway Broadband", "Utilities", 15),
    "act fibernet": ("ACT Fibernet Broadband", "Utilities", 12),
    "bescom": ("BESCOM Electricity", "Utilities", 5),
    "tneb": ("TNEB Electricity", "Utilities", 10),
    "cult": ("Cult.fit Gym & Fitness", "Health & Fitness", 1),
    "rent": ("House Rent", "Housing", 1),
    "google storage": ("Google One Storage", "Cloud Services", 15),
    "icloud": ("Apple iCloud Storage", "Cloud Services", 20),
    "swiggy one": ("Swiggy One Membership", "Food & Dining", 15),
    "zomato gold": ("Zomato Gold Membership", "Food & Dining", 10),
    "gym": ("Gym Membership", "Health & Fitness", 1),
    "broadband": ("Broadband Internet", "Utilities", 10),
    "wifi": ("Wi-Fi Internet", "Utilities", 10),
    "electricity": ("Electricity Bill", "Utilities", 7),
    "water": ("Water Supply Bill", "Utilities", 10),
    "gas": ("Piped Natural Gas", "Utilities", 15),
    "newspaper": ("Newspaper Subscription", "Subscriptions", 1),
    "milk": ("Daily Milk Supply", "Groceries", 1),
}


def normalize_merchant(raw_text: str) -> str:
    """
    Normalizes a transaction description by stripping UPI prefixes,
    transaction IDs, payment gateways, and dates.
    """
    if not raw_text:
        return "Unknown Merchant"

    text = str(raw_text).strip()

    # Strip UPI tags like "UPI-", "UPI/123456/...", "POS ", "NEFT ", "ACH "
    text = re.sub(r"^(UPI|POS|NEFT|IMPS|ACH|RTGS|E-MANDATE|BILLDESK|RAZORPAY)[\s\-\/:]+", "", text, flags=re.IGNORECASE)
    # Strip long numeric or alphanumeric transaction references (e.g. /123456789/ or ref #1234)
    text = re.sub(r"[\/\-]\s*[A-Z0-9]{8,}\b", "", text)
    text = re.sub(r"\b(REF|TXN|UTR|ID|NO)[\s\.:#]*[A-Z0-9]+", "", text, flags=re.IGNORECASE)
    # Strip dates like 12/04 or 2024-05-10
    text = re.sub(r"\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b", "", text)

    text = text.strip(" -_/:|.,#")

    # Match against known keywords
    lower = text.lower()
    for kw, (clean_name, _, _) in KNOWN_SUBSCRIPTION_KEYWORDS.items():
        if kw in lower:
            return clean_name

    # Capitalize cleaned string if meaningful
    words = [w.capitalize() for w in text.split() if len(w) > 1 and not w.isdigit()]
    if words:
        return " ".join(words[:4])
    return text.capitalize() if text else "Recurring Payment"


def guess_category(merchant_name: str, fallback: str = "Utilities") -> str:
    lower = merchant_name.lower()
    for kw, (_, cat, _) in KNOWN_SUBSCRIPTION_KEYWORDS.items():
        if kw in lower:
            return cat
    if any(k in lower for k in ["gym", "fitness", "workout", "cult"]):
        return "Health & Fitness"
    if any(k in lower for k in ["broadband", "wifi", "internet", "fiber", "telecom", "electric", "power", "water", "gas"]):
        return "Utilities"
    if any(k in lower for k in ["netflix", "prime", "hotstar", "spotify", "music", "stream"]):
        return "Entertainment"
    if any(k in lower for k in ["rent", "maintenance", "society"]):
        return "Housing"
    return fallback or "Utilities"


def parse_txn_date(dt_str: str) -> Optional[datetime.date]:
    if not dt_str:
        return None
    s = str(dt_str).strip()[:10]
    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"]:
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except Exception:
            continue
    return None


def is_already_tracked(candidate_name: str, candidate_amount: float, existing_bills: List[models.Bill]) -> bool:
    """
    Checks whether a candidate recurring bill is already recorded in models.Bill.
    Uses semantic aliases and amount proximity.
    """
    c_norm = re.sub(r"[^a-z0-9]", "", candidate_name.lower())

    for b in existing_bills:
        b_name = (b.name or "").lower()
        b_norm = re.sub(r"[^a-z0-9]", "", b_name)
        b_amt = float(b.amount or 0.0)

        # 1. Exact or strong substring name match
        if c_norm in b_norm or b_norm in c_norm:
            return True

        # 2. Known keyword overlap (e.g. "Airtel" in both)
        for kw in KNOWN_SUBSCRIPTION_KEYWORDS:
            if kw in candidate_name.lower() and kw in b_name:
                return True

        # 3. Exact amount match if names are slightly similar or general
        if abs(candidate_amount - b_amt) < 1.0:
            words_c = set(candidate_name.lower().split())
            words_b = set(b_name.split())
            if words_c.intersection(words_b):
                return True

    return False


def discover_recurring_charges(
    db: Session,
    tenant_id: str,
    min_occurrences: int = 2,
    variance_threshold: float = 0.15,
) -> List[Dict[str, Any]]:
    """
    Scans tenant's historical expenses (models.Expense), clusters repeated transactions,
    detects monthly cadences, calculates confidence, and filters out already tracked bills.
    """
    expenses = (
        db.query(models.Expense)
        .filter(models.Expense.tenant_id == tenant_id)
        .all()
    )
    existing_bills = (
        db.query(models.Bill)
        .filter(models.Bill.tenant_id == tenant_id)
        .all()
    )

    return analyze_transactions_for_recurring(expenses, existing_bills, min_occurrences, variance_threshold)


def analyze_transactions_for_recurring(
    expenses: List[Any],
    existing_bills: List[models.Bill],
    min_occurrences: int = 2,
    variance_threshold: float = 0.15,
) -> List[Dict[str, Any]]:
    """
    Core algorithmic clustering and cadence detection.
    Accepts list of Expense models or dictionaries.
    """
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for e in expenses:
        if isinstance(e, dict):
            desc = e.get("description", "") or e.get("remarks", "")
            amt = float(e.get("amount", 0.0) or 0.0)
            dt_raw = e.get("date", "")
            cat = e.get("category", "")
        else:
            desc = e.description or e.remarks or ""
            amt = float(e.amount or 0.0)
            dt_raw = e.date or ""
            cat = e.category or ""

        if amt <= 10.0:  # Ignore micro-transactions under ₹10
            continue

        parsed_d = parse_txn_date(dt_raw)
        if not parsed_d:
            continue

        norm_name = normalize_merchant(desc)
        group_key = norm_name.lower()

        groups[group_key].append({
            "name": norm_name,
            "raw_desc": desc,
            "amount": amt,
            "date": parsed_d,
            "category": cat,
        })

    candidates: List[Dict[str, Any]] = []

    for group_key, txns in groups.items():
        if len(txns) < min_occurrences:
            continue

        # Sort chronologically
        txns.sort(key=lambda x: x["date"])

        # Check distinct months
        month_keys = {t["date"].strftime("%Y-%m") for t in txns}
        if len(month_keys) < min_occurrences:
            days_deltas = []
            for i in range(len(txns) - 1):
                days_deltas.append((txns[i + 1]["date"] - txns[i]["date"]).days)
            if not any(20 <= d <= 35 for d in days_deltas):
                continue

        amounts = [t["amount"] for t in txns]
        avg_amt = sum(amounts) / len(amounts)
        min_amt = min(amounts)
        max_amt = max(amounts)

        spread = (max_amt - min_amt) / max(avg_amt, 1.0)
        if spread > variance_threshold:
            continue

        clean_name = txns[0]["name"]
        clean_cat = guess_category(clean_name, txns[0]["category"])
        typical_amt = round(amounts[-1], 2)  # Most recent charge

        # Check if already tracked in models.Bill
        if is_already_tracked(clean_name, typical_amt, existing_bills):
            continue

        # Detect typical due day (mode/median day of the month)
        days = [t["date"].day for t in txns]
        detected_day = max(set(days), key=days.count)
        detected_day = min(max(detected_day, 1), 28)

        # Confidence calculation
        conf = 0.70
        if len(txns) >= 3:
            conf += 0.12
        elif len(txns) >= 2:
            conf += 0.05

        if spread < 0.02:
            conf += 0.10
        elif spread < 0.08:
            conf += 0.05

        if any(kw in group_key for kw in KNOWN_SUBSCRIPTION_KEYWORDS):
            conf += 0.08

        conf = min(0.98, round(conf, 2))

        if conf >= 0.90:
            conf_label = "Very High"
        elif conf >= 0.80:
            conf_label = "High"
        else:
            conf_label = "Moderate"

        candidates.append({
            "id": f"radar_{re.sub(r'[^a-z0-9]', '_', clean_name.lower())}_{int(typical_amt)}",
            "name": clean_name,
            "merchant": clean_name,
            "amount": typical_amt,
            "average_amount": typical_amt,
            "due_day": detected_day,
            "detected_due_day": detected_day,
            "estimated_due_day": detected_day,
            "category": clean_cat,
            "frequency": "Monthly",
            "confidence": int(conf * 100) if conf <= 1.0 else int(conf),
            "confidence_ratio": conf,
            "confidence_label": conf_label,
            "occurrence_count": len(txns),
            "occurrences": len(txns),
            "months_active": len(month_keys),
            "last_date": txns[-1]["date"].strftime("%Y-%m-%d"),
            "historical_amounts": [round(a, 2) for a in amounts[-4:]],
            "raw_names": [t.get("raw_desc") or t.get("raw_title", "") for t in txns],
            "recommendation": f"Detected {len(txns)} monthly charges of ~₹{typical_amt:,.0f} around day {detected_day} of each month.",
        })

    candidates.sort(key=lambda x: (x["confidence"], x["occurrence_count"]), reverse=True)
    return candidates


# Convenient Aliases
discover_recurring_bills = discover_recurring_charges
normalize_merchant_name = normalize_merchant

