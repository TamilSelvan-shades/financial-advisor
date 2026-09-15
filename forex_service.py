"""
Forex & Multi-Currency Service
Provides real-time and cached exchange rates across INR, USD, EUR, GBP, AED, and SGD.
"""

import time
import requests
from typing import Dict, Any, Optional

# Supported Currencies Metadata
SUPPORTED_CURRENCIES = {
    "INR": {"symbol": "₹", "name": "Indian Rupee", "flag": "🇮🇳", "decimals": 2},
    "USD": {"symbol": "$", "name": "US Dollar", "flag": "🇺🇸", "decimals": 2},
    "EUR": {"symbol": "€", "name": "Euro", "flag": "🇪🇺", "decimals": 2},
    "GBP": {"symbol": "£", "name": "British Pound", "flag": "🇬🇧", "decimals": 2},
    "AED": {"symbol": "AED", "name": "UAE Dirham", "flag": "🇦🇪", "decimals": 2},
    "SGD": {"symbol": "S$", "name": "Singapore Dollar", "flag": "🇸🇬", "decimals": 2},
}

# Reliable reference fallback rates (Base: 1 INR)
DEFAULT_RATES_FROM_INR = {
    "INR": 1.0,
    "USD": 0.0115,     # 1 USD ≈ ₹86.95
    "EUR": 0.0109,     # 1 EUR ≈ ₹91.75
    "GBP": 0.0091,     # 1 GBP ≈ ₹109.80
    "AED": 0.0423,     # 1 AED ≈ ₹23.65
    "SGD": 0.0154,     # 1 SGD ≈ ₹64.90
}

_RATES_CACHE: Dict[str, Any] = {
    "timestamp": 0.0,
    "base": "INR",
    "rates": dict(DEFAULT_RATES_FROM_INR),
}

_CACHE_TTL_SECONDS = 6 * 3600  # 6 hours cache


def fetch_live_rates() -> Dict[str, float]:
    """
    Fetches real-time exchange rates with in-memory caching and graceful fallback.
    """
    global _RATES_CACHE
    now = time.time()
    if now - _RATES_CACHE["timestamp"] < _CACHE_TTL_SECONDS and _RATES_CACHE["rates"]:
        return _RATES_CACHE["rates"]

    try:
        url = "https://open.er-api.com/v6/latest/INR"
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("result") == "success" and "rates" in data:
                api_rates = data["rates"]
                updated_rates = {"INR": 1.0}
                for curr in SUPPORTED_CURRENCIES:
                    if curr in api_rates:
                        updated_rates[curr] = float(api_rates[curr])
                    else:
                        updated_rates[curr] = DEFAULT_RATES_FROM_INR.get(curr, 1.0)
                _RATES_CACHE["rates"] = updated_rates
                _RATES_CACHE["timestamp"] = now
                return updated_rates
    except Exception as e:
        print(f"Notice: Using fallback forex rates ({e})")

    # Fallback if network issue
    if not _RATES_CACHE["rates"]:
        _RATES_CACHE["rates"] = dict(DEFAULT_RATES_FROM_INR)
    _RATES_CACHE["timestamp"] = now
    return _RATES_CACHE["rates"]


def get_forex_overview() -> Dict[str, Any]:
    """
    Returns full forex overview including rates, reverse rates (in INR), and currency metadata.
    """
    rates = fetch_live_rates()
    reverse_in_inr = {}
    for code, rate in rates.items():
        if rate > 0:
            reverse_in_inr[code] = round(1.0 / rate, 2)
        else:
            reverse_in_inr[code] = 1.0

    return {
        "base": "INR",
        "supported_currencies": SUPPORTED_CURRENCIES,
        "rates_from_inr": rates,
        "rates_in_inr": reverse_in_inr,
        "last_updated": int(_RATES_CACHE.get("timestamp", time.time())),
    }


def convert_currency(
    amount: float,
    from_currency: str = "INR",
    to_currency: str = "USD"
) -> Dict[str, Any]:
    """
    Converts amount from from_currency to to_currency using current exchange rates.
    """
    rates = fetch_live_rates()
    fc = from_currency.upper().strip()
    tc = to_currency.upper().strip()

    if fc not in rates:
        fc = "INR"
    if tc not in rates:
        tc = "INR"

    # Convert from fc to INR, then INR to tc
    rate_from_inr_to_fc = rates.get(fc, 1.0)
    rate_from_inr_to_tc = rates.get(tc, 1.0)

    # amount in INR = amount / rate_from_inr_to_fc
    amount_in_inr = amount / rate_from_inr_to_fc if rate_from_inr_to_fc > 0 else amount
    converted_amount = amount_in_inr * rate_from_inr_to_tc
    exchange_rate = (rate_from_inr_to_tc / rate_from_inr_to_fc) if rate_from_inr_to_fc > 0 else 1.0

    target_meta = SUPPORTED_CURRENCIES.get(tc, {"symbol": "", "decimals": 2})
    formatted = f"{target_meta['symbol']}{converted_amount:,.{target_meta['decimals']}f}"

    return {
        "original_amount": round(amount, 2),
        "from_currency": fc,
        "to_currency": tc,
        "exchange_rate": round(exchange_rate, 6),
        "converted_amount": round(converted_amount, 2),
        "amount_in_inr": round(amount_in_inr, 2),
        "formatted": formatted,
    }
