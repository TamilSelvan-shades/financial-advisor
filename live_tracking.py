import yfinance as yf
import requests

def get_live_price(ticker: str, asset_type: str) -> float:
    """
    Fetch live price for stocks or mutual funds.
    asset_type: 'mutual_fund', 'stock', or 'crypto'
    ticker: For mutual_fund in India, the mfapi.in scheme code (e.g. '122639' for Parag Parikh Flexi Cap)
            For stocks, the yfinance ticker (e.g. 'RELIANCE.NS')
    """
    if not ticker:
        return 0.0

    try:
        if asset_type == 'mutual_fund':
            # Use mfapi.in for Indian Mutual Funds
            # Example ticker: 122639
            url = f"https://api.mfapi.in/mf/{ticker}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "data" in data and len(data["data"]) > 0:
                    nav = float(data["data"][0]["nav"])
                    return nav
        elif asset_type == 'stock' or asset_type == 'crypto':
            # Use yfinance for stocks and crypto
            ticker_obj = yf.Ticker(ticker)
            # Try to get fast current price
            # Sometimes info is slow, history(period='1d') is more robust
            hist = ticker_obj.history(period='1d')
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
    except Exception as e:
        print(f"Error fetching price for {ticker}: {e}")
        
    return 0.0
