"""
Universal Multi-Bank & Encrypted PDF Statement Parser
Supports HDFC, SBI, Axis, Kotak, ICICI, Amex, and generic statements (PDF, Excel, CSV)
with password decryption, auto-account matching, and auto-categorization.
"""

import io
import re
import datetime
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from pypdf import PdfReader


class StatementParserError(Exception):
    """Base exception for statement parsing errors."""
    pass


class PasswordRequiredError(StatementParserError):
    """Raised when a PDF is encrypted and requires a password to decrypt."""
    def __init__(self, message: str, bank_name: str = "Unknown Bank", password_hint: str = ""):
        super().__init__(message)
        self.bank_name = bank_name
        self.password_hint = password_hint


BANK_PASSWORD_HINTS = {
    "HDFC Bank": "HDFC statements are usually protected by your Customer ID (in lowercase/uppercase) or PAN card number.",
    "State Bank of India (SBI)": "SBI statements are usually protected by your 5-digit DOB (DDMM) + last 4 digits of your registered mobile number, or your PAN number.",
    "Axis Bank": "Axis Bank statements are usually protected by your 10-digit PAN number (all uppercase) or registered mobile number.",
    "Kotak Mahindra Bank": "Kotak statements are usually protected by your Date of Birth (DDMMYYYY) or Customer CRN number.",
    "ICICI Bank": "ICICI statements are usually protected by the first 4 letters of your name (in lowercase) + Date & Month of Birth (DDMM), or your PAN number.",
    "American Express (Amex)": "Amex statements are usually protected by your Date of Birth (DDMMYYYY) or registered postal PIN code.",
    "Generic": "Please enter your statement password (typically PAN, Date of Birth, or registered mobile number).",
}


def auto_categorize(remarks: str, is_expense: bool) -> str:
    r = str(remarks).upper()
    if not is_expense:
        if "SALARY" in r or "PAYROLL" in r:
            return "Salary"
        if "INTEREST" in r or "INT.PD" in r:
            return "Interest Received"
        if "DIVIDEND" in r:
            return "Dividends"
        if "CASH DEP" in r or "CDM" in r:
            return "Cash Deposit"
        if "REFUND" in r or "REVERSAL" in r:
            return "Refunds"
        return "Other Income"

    if any(kw in r for kw in ["ZOMATO", "SWIGGY", "SUNDAR VEG", "RESTAURANT", "HOTEL", "CAFE", "BAKERY", "FOOD", "STARBUCKS", "MCDONALD", "DOMINO", "KFC", "PIZZA"]):
        return "Food & Dining"
    elif any(kw in r for kw in ["RELIANCE", "AMAZON", "FLIPKART", "MYNTRA", "MART", "SUPERMARKET", "GROCERY", "DMART", "ZEPTO", "BLINKIT", "BIGBASKET", "INSTAMART"]):
        return "Shopping & Groceries"
    elif any(kw in r for kw in ["PETROL", "BUNK", "HPCL", "BPCL", "IOCL", "FUEL", "TOLL", "FASTAG", "UBER", "OLA", "RAPIDO", "IRCTC", "MAKE MY TRIP", "INDIGO", "AIR INDIA"]):
        return "Fuel & Transport"
    elif any(kw in r for kw in ["HATHWAY", "JIO", "AIRTEL", "VI", "RECHARGE", "ELECTRICITY", "EB", "TNEB", "BESCOM", "BROADBAND", "ACT", "DTH", "TATAPOWER", "ADANI"]):
        return "Utilities & Bills"
    elif any(kw in r for kw in ["NETFLIX", "PRIME", "HOTSTAR", "SPOTIFY", "CINEMA", "BOOKMYSHOW", "PVR", "INOX", "YOUTUBE"]):
        return "Entertainment"
    elif any(kw in r for kw in ["PHARMACY", "HOSPITAL", "CLINIC", "APOLLO", "MEDPLUS", "NETMEDS", "1MG", "DIAGNOSTICS", "DENTAL"]):
        return "Health & Medical"
    elif any(kw in r for kw in ["GROWW", "ZERODHA", "UPSTOX", "MUTUAL FUND", "AMC", "PPFAS", "SIP", "NIPPON", "HDFC AMC", "KOTAK MAHINDRA AMC", "SBI MUTUAL", "MIRAE"]):
        return "Investments"
    elif any(kw in r for kw in ["EMI", "LOAN", "CREDIT CARD", "SBI CARD", "HDFC CC", "BAJAJ FIN", "KREDITBEE", "HOME LOAN"]):
        return "Loans & EMI"
    elif any(kw in r for kw in ["ATM", "CASH WDL", "CASH WITHDRAWAL", "ATM WDL"]):
        return "Cash Withdrawal"
    elif any(kw in r for kw in ["UPI", "IMPS", "NEFT", "RTGS"]):
        return "Transfers & Payments"
    else:
        return "Others"


def detect_bank_from_text(text: str) -> Tuple[str, str]:
    """
    Detects bank name and extracts account/card number fragment if present.
    """
    t_upper = text.upper()
    
    banks = {
        "HDFC Bank": ["HDFC BANK", "HDFC"],
        "State Bank of India (SBI)": ["STATE BANK OF INDIA", "SBI"],
        "Axis Bank": ["AXIS BANK"],
        "Kotak Mahindra Bank": ["KOTAK MAHINDRA", "KOTAK BANK", "KOTAK"],
        "ICICI Bank": ["ICICI BANK", "ICICI"],
        "American Express (Amex)": ["AMERICAN EXPRESS", "AMEX"]
    }
    
    bank_name = "Generic"
    best_index = len(t_upper)
    
    for b_name, keywords in banks.items():
        for kw in keywords:
            idx = t_upper.find(kw)
            if idx != -1 and idx < best_index:
                best_index = idx
                bank_name = b_name

    # Detect account number fragment
    acc_num_match = re.search(r"(?:account|a/c|card|acc)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([xX*]*\d{4,})", text, re.IGNORECASE)
    acc_frag = ""
    if acc_num_match:
        raw_num = acc_num_match.group(1).strip()
        last_4 = raw_num[-4:]
        acc_frag = f"XX{last_4}"

    account_name = f"{bank_name} Savings Account ({acc_frag})" if acc_frag else f"{bank_name} Account"
    return bank_name, account_name


def parse_amount_str(amt_str: Any) -> float:
    """Safely parses amount string with commas, currency symbols, and signs."""
    if amt_str is None or pd.isna(amt_str):
        return 0.0
    clean = re.sub(r"[^\d.-]", "", str(amt_str).strip())
    try:
        return float(clean)
    except Exception:
        return 0.0


def normalize_date(date_str: str) -> str:
    """Normalizes multiple date formats to YYYY-MM-DD."""
    clean = date_str.strip().replace(",", "/").replace(".", "/")
    for fmt in [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%d %b %Y", "%d-%b-%Y", "%d %B %Y", "%Y-%m-%d"
    ]:
        try:
            return datetime.datetime.strptime(clean, fmt).strftime("%Y-%m-%d")
        except Exception:
            continue
    try:
        dt = pd.to_datetime(clean, errors="coerce")
        if pd.notna(dt) and str(dt) != "NaT":
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    return datetime.date.today().strftime("%Y-%m-%d")


def parse_pdf_statement(file_bytes: bytes, password: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses bank PDF statement with password decryption and tabular transaction extraction.
    """
    stream = io.BytesIO(file_bytes)
    try:
        reader = PdfReader(stream)
    except Exception as e:
        raise StatementParserError(f"Invalid or corrupted PDF file: {e}")

    if reader.is_encrypted:
        if not password:
            raise PasswordRequiredError(
                "PDF is password-protected. Please provide your statement password to proceed.",
                bank_name="Generic",
                password_hint=BANK_PASSWORD_HINTS["Generic"]
            )
        
        # Attempt decryption with raw password and case variations
        decrypted = False
        test_passwords = [password, password.lower(), password.upper()]
        for p in test_passwords:
            try:
                res = reader.decrypt(p)
                if res != 0:
                    decrypted = True
                    break
            except Exception:
                continue

        if not decrypted:
            raise StatementParserError("Incorrect statement password. Please verify your password and try again.")

    # Extract text from all pages
    full_text_pages = []
    for i, page in enumerate(reader.pages):
        try:
            txt = page.extract_text()
            if txt:
                full_text_pages.append(txt)
        except Exception:
            pass

    full_text = "\n".join(full_text_pages)
    if not full_text.strip():
        raise StatementParserError("Could not extract any readable text from this PDF.")

    bank_name, detected_account = detect_bank_from_text(full_text)
    
    # Regex parser for standard bank lines
    # Format: Date Narration Ref/Chq Withdrawal Deposit Balance
    transactions = []
    lines = full_text.splitlines()

    # Generic date line pattern: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or DD Mon YYYY
    date_regex = re.compile(r"^\s*(?:\d+\s+)?(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\b")
    amt_regex = re.compile(r"[\d,]+\.\d{2}")
    
    current_txn = None
    
    def process_accumulated_txn(txn_data):
        amounts = txn_data["amounts"]
        if not amounts:
            return
            
        amt_val = 0.0
        is_expense = txn_data["is_expense"] if txn_data["is_expense"] is not None else True
        
        if len(amounts) >= 2:
            amt_val = parse_amount_str(amounts[0])
        else:
            amt_val = parse_amount_str(amounts[0])

        if amt_val <= 0:
            return

        # Description is everything before the first amount
        text = txn_data["text"]
        first_amt_idx = text.find(amounts[0])
        narration = text[:first_amt_idx].strip() if first_amt_idx != -1 else text.strip()
        if not narration:
            narration = f"{bank_name} Transaction"

        category = auto_categorize(narration, is_expense)
        transactions.append({
            "date": txn_data["date"],
            "description": narration,
            "amount": round(amt_val, 2),
            "type": "expense" if is_expense else "income",
            "category": category,
            "account": detected_account,
            "remarks": f"Parsed from {bank_name} PDF Statement",
        })

    for line in lines:
        line_str = line.strip()
        if not line_str:
            continue

        date_m = date_regex.match(line_str)
        if date_m:
            if current_txn:
                process_accumulated_txn(current_txn)
            
            raw_date = date_m.group(1)
            remainder = line_str[date_m.end():].strip()
            
            current_txn = {
                "date": normalize_date(raw_date),
                "text": remainder + " ",
                "amounts": amt_regex.findall(remainder),
                "is_expense": None
            }
            if "CR" in remainder.upper() or "CREDIT" in remainder.upper():
                current_txn["is_expense"] = False
            elif "DR" in remainder.upper() or "DEBIT" in remainder.upper():
                current_txn["is_expense"] = True
        else:
            if current_txn:
                current_txn["text"] += line_str + " "
                current_txn["amounts"].extend(amt_regex.findall(line_str))
                if current_txn["is_expense"] is None:
                    if "CR" in line_str.upper() or "CREDIT" in line_str.upper():
                        current_txn["is_expense"] = False
                    elif "DR" in line_str.upper() or "DEBIT" in line_str.upper():
                        current_txn["is_expense"] = True

    if current_txn:
        process_accumulated_txn(current_txn)

    # If regex found fewer than 2 transactions, attempt Gemini 2.5 Flash fallback on the statement text snippet
    if len(transactions) < 2 and len(full_text) > 100:
        try:
            import os
            import json
            from google import genai
            gemini_key = os.getenv("GEMINI_API_KEY")
            if gemini_key:
                ai = genai.Client(api_key=gemini_key)
                prompt = f"""
                You are an elite bank statement parser. Extract all financial transactions from this text.
                Bank: {bank_name}
                Account: {detected_account}

                Statement text:
                {full_text[:6000]}

                Return a JSON array of objects with exact keys:
                - "date": "YYYY-MM-DD"
                - "description": merchant or narration
                - "amount": positive float number
                - "type": "expense" or "income"
                - "category": best financial category (Food & Dining, Shopping & Groceries, Fuel & Transport, Utilities & Bills, Entertainment, Health & Medical, Investments, Loans & EMI, Salary, Other Income, Others)
                - "account": "{detected_account}"
                - "remarks": "AI-parsed from {bank_name} PDF"

                Return ONLY valid JSON array.
                """
                resp = ai.models.generate_content(model="gemini-2.5-flash", contents=prompt)
                cleaned = resp.text.strip().replace("```json", "").replace("```", "").strip()
                ai_txns = json.loads(cleaned)
                if isinstance(ai_txns, list) and len(ai_txns) > 0:
                    transactions = ai_txns
        except Exception as ai_err:
            print(f"Notice: Gemini PDF statement fallback skipped ({ai_err})")

    total_debits = sum(t["amount"] for t in transactions if t["type"] == "expense")
    total_credits = sum(t["amount"] for t in transactions if t["type"] == "income")

    return {
        "bank_name": bank_name,
        "account_name": detected_account,
        "total_transactions": len(transactions),
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "transactions": transactions,
    }


def parse_excel_or_csv_statement(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Parses Excel (.xlsx, .xls) or CSV statements, preserving existing multi-sheet templates.
    """
    fn = filename.lower()
    transactions = []
    bank_name = "Generic Bank"
    account_name = "Bank Account"

    if fn.endswith((".xlsx", ".xls")):
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
        if "OpTransactionHistory" in xl.sheet_names:
            bank_name = "ICICI Bank"
            account_name = "ICICI Savings Account"
            df_bank = pd.read_excel(xl, sheet_name="OpTransactionHistory", skiprows=12)
            df_bank = df_bank.dropna(subset=['Transaction Date', 'Withdrawal Amount(INR)', 'Deposit Amount(INR)'], how='all')
            for _, row in df_bank.iterrows():
                dt = normalize_date(str(row['Transaction Date']))
                desc = str(row.get('Transaction Remarks', '')).strip()
                w_amt = parse_amount_str(row.get('Withdrawal Amount(INR)', 0))
                d_amt = parse_amount_str(row.get('Deposit Amount(INR)', 0))
                if w_amt > 0:
                    transactions.append({
                        "date": dt,
                        "description": desc,
                        "amount": round(w_amt, 2),
                        "type": "expense",
                        "category": auto_categorize(desc, is_expense=True),
                        "account": account_name,
                        "remarks": "Auto-imported from ICICI statement",
                    })
                if d_amt > 0:
                    transactions.append({
                        "date": dt,
                        "description": desc,
                        "amount": round(d_amt, 2),
                        "type": "income",
                        "category": auto_categorize(desc, is_expense=False),
                        "account": account_name,
                        "remarks": "Auto-imported from ICICI statement",
                    })
        else:
            if "Income" in xl.sheet_names:
                df_i = pd.read_excel(xl, sheet_name="Income", skiprows=5).dropna(subset=["DATE", "AMOUNT"])
                for _, row in df_i.iterrows():
                    amt = parse_amount_str(row["AMOUNT"])
                    if amt > 0:
                        transactions.append({
                            "date": normalize_date(str(row["DATE"])),
                            "description": str(row.get("DESCRIPTION", "")).strip() or "Template Income",
                            "amount": round(amt, 2),
                            "type": "income",
                            "category": str(row.get("CATEGORY", "Salary")).strip(),
                            "account": str(row.get("ACCOUNT", "Savings Account")).strip(),
                            "remarks": str(row.get("REMARKS", "Excel Template Import")).strip(),
                        })
            if "Expenses" in xl.sheet_names:
                df_e = pd.read_excel(xl, sheet_name="Expenses", skiprows=5).dropna(subset=["DATE", "AMOUNT"])
                for _, row in df_e.iterrows():
                    amt = parse_amount_str(row["AMOUNT"])
                    if amt > 0:
                        transactions.append({
                            "date": normalize_date(str(row["DATE"])),
                            "description": str(row.get("DESCRIPTION", "")).strip() or "Template Expense",
                            "amount": round(amt, 2),
                            "type": "expense",
                            "category": str(row.get("CATEGORY", "Miscellaneous")).strip(),
                            "account": str(row.get("ACCOUNT", "Savings Account")).strip(),
                            "remarks": str(row.get("REMARKS", "Excel Template Import")).strip(),
                        })
    elif fn.endswith(".csv"):
        df_csv = pd.read_csv(io.BytesIO(file_bytes))
        col_map = {str(c).lower().strip(): c for c in df_csv.columns}
        date_col = col_map.get("date") or col_map.get("transaction date") or col_map.get("txn date")
        desc_col = col_map.get("description") or col_map.get("narration") or col_map.get("remarks") or col_map.get("transaction remarks")
        amt_col = col_map.get("amount") or col_map.get("withdrawal amount(inr)") or col_map.get("withdrawal") or col_map.get("debit")
        cat_col = col_map.get("category")
        acc_col = col_map.get("account")
        type_col = col_map.get("type")

        for _, r in df_csv.iterrows():
            amt = parse_amount_str(r[amt_col]) if amt_col and pd.notna(r.get(amt_col)) else 0.0
            if amt == 0.0:
                continue
            desc = str(r[desc_col]).strip() if desc_col and pd.notna(r.get(desc_col)) else "CSV Transaction"
            dt = normalize_date(str(r[date_col])) if date_col and pd.notna(r.get(date_col)) else datetime.date.today().strftime("%Y-%m-%d")
            acc = str(r[acc_col]).strip() if acc_col and pd.notna(r.get(acc_col)) else "Bank Account"

            is_inc = False
            if type_col and pd.notna(r.get(type_col)) and str(r.get(type_col)).strip().lower() in ["income", "credit", "deposit", "cr"]:
                is_inc = True

            cat = str(r[cat_col]).strip() if cat_col and pd.notna(r.get(cat_col)) else auto_categorize(desc, is_expense=not is_inc)
            transactions.append({
                "date": dt,
                "description": desc,
                "amount": round(abs(amt), 2),
                "type": "income" if is_inc else "expense",
                "category": cat,
                "account": acc,
                "remarks": "CSV Import",
            })

    total_debits = sum(t["amount"] for t in transactions if t["type"] == "expense")
    total_credits = sum(t["amount"] for t in transactions if t["type"] == "income")

    return {
        "bank_name": bank_name,
        "account_name": account_name,
        "total_transactions": len(transactions),
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "transactions": transactions,
    }


def parse_universal_statement(
    file_bytes: bytes,
    filename: str,
    password: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main entry point for statement parsing. Dispatches to PDF or Excel/CSV parser.
    """
    fn = filename.lower()
    if fn.endswith(".pdf"):
        return parse_pdf_statement(file_bytes, password=password)
    elif fn.endswith((".xlsx", ".xls", ".csv")):
        return parse_excel_or_csv_statement(file_bytes, filename)
    else:
        raise StatementParserError("Unsupported file format. Supported formats: PDF, Excel (.xlsx, .xls), or CSV.")
