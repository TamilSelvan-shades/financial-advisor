import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from database import SessionLocal

db = SessionLocal()

try:
    print("Adding sanctioned_amount...")
    db.execute(text("ALTER TABLE loans ADD COLUMN sanctioned_amount FLOAT NULL;"))
except Exception as e:
    print(e)
    db.rollback()
else:
    db.commit()

try:
    print("Adding tenure_months...")
    db.execute(text("ALTER TABLE loans ADD COLUMN tenure_months INTEGER NULL;"))
except Exception as e:
    print(e)
    db.rollback()
else:
    db.commit()

try:
    print("Adding start_date...")
    db.execute(text("ALTER TABLE loans ADD COLUMN start_date VARCHAR NULL;"))
except Exception as e:
    print(e)
    db.rollback()
else:
    db.commit()

try:
    print("Adding extra_prepayment...")
    db.execute(text("ALTER TABLE loans ADD COLUMN extra_prepayment FLOAT DEFAULT 0.0;"))
except Exception as e:
    print(e)
    db.rollback()
else:
    db.commit()

db.close()
print("Done!")
