"""
Multimodal Camera Receipt & Invoice OCR Scanner
Uses Gemini 2.5 Flash Vision to extract merchant, line items, taxes, and amounts from receipt photos and invoices.
"""

import os
import json
import datetime
from typing import Dict, Any, Optional
from google import genai
from google.genai import types


def scan_receipt_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg"
) -> Dict[str, Any]:
    """
    Extracts structured financial details from a receipt or invoice image using Gemini 2.5 Flash Vision.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    if not gemini_key:
        return {
            "success": False,
            "error": "Gemini API key is not configured on the backend.",
            "data": None,
        }

    client = genai.Client(api_key=gemini_key)

    prompt = f"""
    You are an expert financial auditor and OCR specialist. Analyze this receipt or invoice carefully.
    Current Date: {today_str}

    Extract and return ONLY a valid JSON object with these exact keys:
    {{
        "merchant": "Name of the merchant, store, or vendor (e.g., Starbucks, D-Mart, Shell)",
        "date": "Transaction date in YYYY-MM-DD format (if only year/month or missing, use {today_str})",
        "category": "One of: Food & Dining, Shopping & Groceries, Fuel & Transport, Utilities & Bills, Entertainment, Health & Medical, Miscellaneous",
        "total_amount": 0.0,
        "subtotal": 0.0,
        "tax_amount": 0.0,
        "tax_breakdown": "e.g. CGST 2.5% + SGST 2.5% or null",
        "payment_method": "Credit Card, Debit Card, UPI, Cash, or Unknown",
        "currency": "INR, USD, EUR, GBP, AED, SGD, etc. (Default to INR if rupee symbol or Indian merchant)",
        "invoice_number": "Invoice or bill number if visible, otherwise null",
        "line_items": [
            {{
                "name": "Item description",
                "quantity": 1.0,
                "unit_price": 0.0,
                "total_price": 0.0
            }}
        ],
        "notes": "Any additional discount, cashier name, or transaction notes",
        "confidence_score": 0.95
    }}

    IMPORTANT:
    - Ensure total_amount is a positive number.
    - If taxes are included, extract the tax amount.
    - Return ONLY the JSON object, without markdown formatting or backticks if possible.
    """

    try:
        part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, part],
            config=types.GenerateContentConfig(
                temperature=0.1,
            )
        )

        cleaned = response.text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        data = json.loads(cleaned)

        # Normalize and validate fields
        if not data.get("merchant"):
            data["merchant"] = "Scanned Receipt"
        if not data.get("date"):
            data["date"] = today_str
        if not data.get("category"):
            data["category"] = "Miscellaneous"
        data["total_amount"] = float(data.get("total_amount", 0.0))
        data["subtotal"] = float(data.get("subtotal", data["total_amount"]))
        data["tax_amount"] = float(data.get("tax_amount", 0.0))
        data["currency"] = str(data.get("currency", "INR")).upper()

        return {
            "success": True,
            "data": data,
        }

    except Exception as e:
        print(f"Receipt OCR Error: {e}")
        return {
            "success": False,
            "error": f"Failed to parse receipt image: {str(e)}",
            "data": None,
        }
