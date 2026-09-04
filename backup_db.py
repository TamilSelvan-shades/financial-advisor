import os
import shutil
import sqlite3
import datetime

BACKUP_DIR = "backups"
DB_FILE = "financial_memory.db"
MAX_BACKUPS_TO_KEEP = 14  # Keeps the last 14 daily snapshots

def backup_database():
    """Creates a timestamped snapshot of the SQLite database using SQLite's backup API."""
    if not os.path.exists(DB_FILE):
        print(f"Database {DB_FILE} not found.")
        return None

    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

    timestamp = datetime.datetime.now().strftime("%Y_%m_%d_%H%M%S")
    backup_filename = os.path.join(BACKUP_DIR, f"financial_memory_backup_{timestamp}.db")

    # Use SQLite's online backup API (safe for active concurrent databases)
    src_conn = sqlite3.connect(DB_FILE)
    dst_conn = sqlite3.connect(backup_filename)

    with dst_conn:
        src_conn.backup(dst_conn)

    dst_conn.close()
    src_conn.close()

    print(f" Database successfully backed up to: {backup_filename}")
    cleanup_old_backups()
    return backup_filename

def cleanup_old_backups():
    """Rotates backups, keeping only the most recent files."""
    files = [os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if f.endswith(".db")]
    files.sort(key=os.path.getmtime)

    while len(files) > MAX_BACKUPS_TO_KEEP:
        oldest_file = files.pop(0)
        try:
            os.remove(oldest_file)
            print(f"Removed older backup snapshot: {oldest_file}")
        except Exception as e:
            print(f"Error removing {oldest_file}: {e}")

if __name__ == "__main__":
    backup_database()