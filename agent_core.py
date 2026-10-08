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

def analyze_portfolio(portfolio_data: list):
    """
    Takes a list of investment dictionaries and returns AI rebalancing advice.
    """
    if not portfolio_data:
        return "No investments found to analyze."
        
    prompt = f"""
    You are an expert personal financial advisor and wealth manager. 
    Review the following user portfolio data:
    {json.dumps(portfolio_data, indent=2)}

    Provide a concise, professional "Portfolio X-Ray" report. 
    Format it in clean Markdown. It should include:
    1. **Asset Allocation Summary**: High-level view of where the money is.
    2. **Risk & Diversification**: Identify if they are too heavy in one asset or category.
    3. **Actionable Rebalancing Advice**: What should they consider buying or selling to optimize growth and safety?
    
    Keep the tone encouraging but objective. Don't invent data.
    """
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error calling Gemini for portfolio analysis: {e}")
        return "Sorry, I am currently unable to analyze the portfolio due to a system error."