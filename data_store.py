from pathlib import Path
import sqlite3


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "financial_memory.db"
STATEMENT_PATH = PROJECT_ROOT / "dummy_statement.csv"


def ensure_schema(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()

    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            description TEXT,
            amount REAL,
            category TEXT
        )
        '''
    )

    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            principal REAL,
            annual_rate REAL,
            tenure_months INTEGER,
            start_date TEXT
        )
        '''
    )

    conn.commit()


def connect_database() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    ensure_schema(conn)
    return conn