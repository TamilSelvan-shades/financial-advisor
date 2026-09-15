import os
import json
import datetime
import shutil
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

import sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
load_dotenv()

BACKUP_DIR = "backups"
os.makedirs(BACKUP_DIR, exist_ok=True)
timestamp = datetime.datetime.now().strftime("%Y_%m_%d_%H%M%S")

db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise ValueError("DATABASE_URL is not configured in .env!")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

print(f"=== Starting Database Backup and Wipe ===")
print(f"Timestamp: {timestamp}")
print(f"Target Database: {db_url}")

engine = create_engine(db_url)
insp = inspect(engine)
tables = insp.get_table_names()
print(f"Found {len(tables)} tables: {tables}")

# 1. Export Data to JSON
backup_data = {}
total_records = 0

with engine.connect() as conn:
    for table_name in tables:
        rows = conn.execute(text(f'SELECT * FROM "{table_name}"')).mappings().all()
        # Convert row mappings to JSON serializable dictionaries
        table_rows = []
        for row in rows:
            row_dict = {}
            for col, val in row.items():
                if val is not None and not isinstance(val, (int, float, str, bool)):
                    row_dict[col] = str(val)
                else:
                    row_dict[col] = val
            table_rows.append(row_dict)
        backup_data[table_name] = table_rows
        count = len(table_rows)
        total_records += count
        print(f"  - Backed up {table_name}: {count} row(s)")

backup_file = os.path.join(BACKUP_DIR, f"postgres_backup_{timestamp}.json")
with open(backup_file, "w", encoding="utf-8") as f:
    json.dump(backup_data, f, indent=2, ensure_ascii=False)

print(f"\n[OK] Successfully backed up {total_records} records across {len(tables)} tables to:")
print(f"   -> {backup_file} ({os.path.getsize(backup_file)} bytes)")

# Also backup legacy SQLite finance.db if exists
if os.path.exists("finance.db"):
    sqlite_backup = os.path.join(BACKUP_DIR, f"finance_sqlite_backup_{timestamp}.db")
    shutil.copyfile("finance.db", sqlite_backup)
    print(f"[OK] Backed up legacy finance.db to: {sqlite_backup}")

# 2. Wipe PostgreSQL tables using TRUNCATE CASCADE
print("\n--- Executing Table Wipe (TRUNCATE ... CASCADE) ---")
with engine.begin() as conn:
    for table_name in tables:
        conn.execute(text(f'TRUNCATE TABLE "{table_name}" CASCADE;'))
        print(f"  - Truncated {table_name}")

print("\n--- Verifying Row Counts Post-Wipe ---")
all_empty = True
with engine.connect() as conn:
    for table_name in tables:
        count = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()
        print(f"  - {table_name}: {count} row(s)")
        if count != 0:
            all_empty = False

if all_empty:
    print("\n[SUCCESS] All tables in PostgreSQL have been completely wiped to 0 rows!")
else:
    print("\n[WARNING] Some tables still contain rows!")

# If finance.db exists, let's also remove or reset it if needed
if os.path.exists("finance.db"):
    os.remove("finance.db")
    print("[OK] Removed legacy finance.db to prevent any stale fallback data.")

print("\n=== Finished Database Backup and Wipe ===")
