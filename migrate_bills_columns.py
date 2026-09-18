import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("No DATABASE_URL found")
    exit(1)

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE bills ADD COLUMN frequency VARCHAR DEFAULT 'Monthly';"))
        conn.execute(text("ALTER TABLE bills ADD COLUMN next_due_date VARCHAR;"))
        conn.commit()
    print("Successfully added frequency and next_due_date columns to bills table.")
except Exception as e:
    print(f"Error (maybe columns already exist?): {e}")
