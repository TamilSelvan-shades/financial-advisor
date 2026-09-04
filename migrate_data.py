import os
import sqlite3
from database import SessionLocal
import models

def migrate_table(sqlite_cursor, pg_session, table_name, model_class, columns):
    """Reads from SQLite and bulk inserts into PostgreSQL using SQLAlchemy."""
    try:
        # 1. Fetch from old SQLite database
        sqlite_cursor.execute(f"SELECT {', '.join(columns)} FROM {table_name}")
        rows = sqlite_cursor.fetchall()
        
        if not rows:
            return 0
        
        # 2. Clear out the PostgreSQL table in case this is run twice
        pg_session.query(model_class).delete()
        
        # 3. Format and insert into PostgreSQL
        instances = []
        for row in rows:
            # Map column names to the row values
            kwargs = {col: val for col, val in zip(columns, row)}
            instances.append(model_class(**kwargs))
        
        pg_session.add_all(instances)
        pg_session.commit()
        return len(rows)
    
    except Exception as e:
        print(f"⚠️ Error migrating table '{table_name}': {e}")
        pg_session.rollback()
        return 0

def run_migration():
    if not os.path.exists("financial_memory.db"):
        print("No SQLite database found. Nothing to migrate.")
        return

    print("🚀 Starting data migration from SQLite to PostgreSQL...")
    
    # Open connections to both databases
    sqlite_conn = sqlite3.connect("financial_memory.db")
    sqlite_cursor = sqlite_conn.cursor()
    pg_session = SessionLocal()

    # Define the mapping of tables to their SQLAlchemy models and columns
    # Note: We purposely exclude auto-incrementing 'id' columns so PostgreSQL can generate fresh, sequential IDs.
    tables_to_migrate = [
        ("expenses", models.Expense, ["date", "description", "amount", "category"]),
        ("loans", models.Loan, ["name", "principal", "annual_rate", "tenure_months", "start_date"]),
        ("investments", models.Investment, ["name", "asset_type", "invested_amount", "current_value", "institution"]),
        ("budgets", models.Budget, ["category", "monthly_limit"]),  # Category is the primary key
        ("goals", models.Goal, ["name", "target_amount", "current_amount", "target_date", "category"]),
        ("bills", models.Bill, ["name", "amount", "due_day", "category", "status"]),
        ("credit_scores", models.CreditScore, ["date", "score", "agency", "remarks"]),
        ("profile", models.Profile, ["key", "value"]),              # Key is the primary key
    ]

    # Run the migration loop
    for table_name, model, cols in tables_to_migrate:
        count = migrate_table(sqlite_cursor, pg_session, table_name, model, cols)
        print(f"✅ Migrated {count} records into '{table_name}'.")

    # Close connections
    pg_session.close()
    sqlite_conn.close()
    print("\n🎉 Migration complete! Your PostgreSQL database is fully populated.")

if __name__ == "__main__":
    run_migration()