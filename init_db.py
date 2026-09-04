from database import engine, Base
import models

print("Connecting to PostgreSQL to generate enterprise schema...")

# This command creates all tables defined in models.py
Base.metadata.create_all(bind=engine)

print("✅ All 8 tables successfully created in PostgreSQL!")