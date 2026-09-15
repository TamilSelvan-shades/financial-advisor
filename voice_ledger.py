"""
Voice-to-Ledger Audio Ingestion Service
Transcribes spoken audio notes and extracts transaction parameters using Gemini 2.5 Flash Audio.
"""

import os
import json
import datetime
from typing import Dict, Any, Optional
from google import genai
from google.genai import types


def process_audio_voice_to_ledger(
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
    preferred_account: str = "Savings Account"
) -> Dict[str, Any]:
    """
    Transcribes spoken financial audio and extracts structured ledger transaction parameters.
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
    You are an elite financial speech-to-ledger parser.
    Today's Date: {today_str}
    Default/User Account: {preferred_account}

    Listen to the audio recording carefully.
    1. Transcribe the user's speech verbatim into "transcript".
    2. Determine if the user is logging an expense ("log_expense") or income ("log_income").
    3. Extract exact transaction parameters:
       - amount (positive float)
       - currency (INR, USD, EUR, GBP, etc. Default to INR if rupee/Rs or Indian accent/context)
       - category (Food & Dining, Shopping & Groceries, Fuel & Transport, Utilities & Bills, Entertainment, Health & Medical, Salary, Investments, Loans & EMI, Miscellaneous)
       - description (clean merchant or item description, e.g. "Shell Petrol", "Groceries at DMart")
       - account (e.g. "Credit Card", "HDFC Bank", "Cash", or default "{preferred_account}")
       - date (YYYY-MM-DD, default {today_str})
    4. Generate a concise, natural confirmation message in "spoken_response" (e.g., "Logged ₹850 for Fuel at Shell on Credit Card.").

    Return ONLY a valid JSON object with these exact keys:
    {{
        "transcript": "Exact transcribed words spoken by user",
        "action": "log_expense",
        "amount": 0.0,
        "currency": "INR",
        "category": "Category Name",
        "description": "Merchant or Item",
        "account": "Account Name",
        "date": "{today_str}",
        "spoken_response": "Conversational confirmation string"
    }}

    Return ONLY the JSON object. Do not wrap in markdown or backticks.
    """

    # Normalize mime type for common audio extensions
    clean_mime = mime_type.lower().split(";")[0].strip()
    if not clean_mime or clean_mime in ["application/octet-stream", "audio/x-m4a"]:
        clean_mime = "audio/mp4"

    try:
        part = types.Part.from_bytes(data=audio_bytes, mime_type=clean_mime)
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

        # Validate fields
        action = data.get("action", "log_expense")
        amt = float(data.get("amount", 0.0))
        desc = data.get("description", "Voice Transaction")
        cat = data.get("category", "Miscellaneous")
        acc = data.get("account", preferred_account)
        dt = data.get("date", today_str)
        curr = str(data.get("currency", "INR")).upper()
        transcript = data.get("transcript", "")
        spoken_response = data.get(
            "spoken_response",
            f"Logged {curr} {amt:,.2f} for {desc} ({cat})."
        )

        return {
            "success": True,
            "transcript": transcript,
            "action": action,
            "data": {
                "amount": amt,
                "currency": curr,
                "description": desc,
                "category": cat,
                "account": acc,
                "date": dt,
                "spoken_response": spoken_response,
            },
            "spoken_response": spoken_response,
        }

    except Exception as e:
        print(f"Voice-to-Ledger Error: {e}")
        return {
            "success": False,
            "error": f"Failed to transcribe or parse audio: {str(e)}",
            "data": None,
        }
