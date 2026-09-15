import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from datetime import datetime, timedelta
import jwt
from database import SessionLocal
from models import User

# Load secret
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-change-in-prod")
ALGORITHM = "HS256"

db = SessionLocal()
user = db.query(User).filter(User.id == "bce1fcd3-6477-4e55-a866-091637f890eb").first()
if not user:
    print("User not found!")
    # Just try getting the first user
    user = db.query(User).first()
    if not user:
        sys.exit(1)

access_token_expires = timedelta(minutes=600)
expire = datetime.utcnow() + access_token_expires
to_encode = {"sub": str(user.id), "exp": expire}
token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

import requests
headers = {"Authorization": f"Bearer {token}"}
print("Testing loan creation...")
payload = { 
  "principal": 7309515,
  "sanctioned_amount": 7394999,
  "interest_rate": 7.4, 
  "tenure_months": 240, 
  "tenure_years": 20, 
  "bank_name": "ICICI Home Loan", 
  "name": "ICICI Home Loan" 
}
print("Testing loan creation via Next.js...")
try:
    res = requests.post("http://127.0.0.1:3000/api/v1/loans/", json=payload, headers=headers)
    print("Loan POST Status:", res.status_code)
    print("History:", res.history)
    print(res.text)
except Exception as e:
    print("Loan error:", e)
