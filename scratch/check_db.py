import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

load_dotenv()
db_url = os.getenv("DATABASE_URL")
print(f"Target DB URL: {db_url}")

try:
    engine = create_engine(db_url)
    insp = inspect(engine)
    tables = insp.get_table_names()
    print("Tables found:", tables)
    with engine.connect() as conn:
        for t in tables:
            count = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
            print(f"  - {t}: {count} row(s)")
except Exception as e:
    print(f"Error inspecting DB: {e}")
