#!/usr/bin/env bash
set -e

# Wait for the database to be ready (optional if using Docker Compose healthchecks, but good practice)
echo "Running pre-start scripts..."

# (Database migrations are handled by SQLAlchemy create_all in main.py)
echo "Skipping alembic migrations as the app uses SQLAlchemy auto-creation."
echo "Pre-start scripts completed."
