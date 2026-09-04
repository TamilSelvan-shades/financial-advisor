import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
db_url = os.getenv("DATABASE_URL")

print(f"Connecting to database...")

try:
    engine = create_engine(db_url)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        print("\n Successfully connected to PostgreSQL!")
        print(f"Server Info: {result.fetchone()[0]}")
except Exception as e:
    print("\n Connection failed!")
    print(f"Error details: {e}")