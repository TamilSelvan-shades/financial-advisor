import os
import re
from typing import Any


_CURRENCY_ALIASES = {
    "$": "USD",
    "USD": "USD",
    "DOLLAR": "USD",
    "DOLLARS": "USD",
    "₹": "INR",
    "INR": "INR",
    "RS": "INR",
    "RS.": "INR",
    "RUPEE": "INR",
    "RUPEES": "INR",
}

_CURRENCY_SYMBOLS = {
    "USD": "$",
    "INR": "₹",
}

_AMOUNT_TOKEN_PATTERN = re.compile(r"(?i)\b(?:usd|inr|rs\.?|rupees?|dollars?)\b|[$₹,]")
_DEFAULT_CURRENCY = "INR"


def get_currency_code() -> str:
    raw_currency = os.getenv("APP_CURRENCY", _DEFAULT_CURRENCY).strip().upper()
    return _CURRENCY_ALIASES.get(raw_currency, _DEFAULT_CURRENCY)


def get_currency_symbol() -> str:
    return _CURRENCY_SYMBOLS[get_currency_code()]


def format_amount(amount: float) -> str:
    return f"{get_currency_symbol()}{amount:,.2f}"


def currency_label(label: str) -> str:
    return f"{label} ({get_currency_symbol()})"


def parse_amount(value: Any) -> float:
    cleaned_value = _AMOUNT_TOKEN_PATTERN.sub("", str(value)).strip()
    return float(cleaned_value)