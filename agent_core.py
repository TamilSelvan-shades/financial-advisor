import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def batch_categorize_transactions(descriptions):
    if not descriptions:
        return []
    prompt = f"""
    You are a financial AI agent. Categorize each transaction into one of these exact categories:
    Groceries, Utilities, Dining, Subscriptions, Investment, EMI/Loan, or Miscellaneous.

    Transactions:
    {json.dumps(descriptions)}

    Return ONLY a valid JSON list of category names in the exact same order. Example:
    ["Groceries", "Dining", "Subscriptions"]
    """
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        cleaned_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned_text)
    except Exception as e:
        print(f"Notice: Fallback used for categories ({e})")
        return ["Miscellaneous"] * len(descriptions)