#!/usr/bin/env bash
set -e

# Wait for the database to be ready (optional if using Docker Compose healthchecks, but good practice)
echo "Running pre-start scripts..."

# Run migrations
echo "Running alembic upgrade head..."
alembic upgrade head

echo "Pre-start scripts completed."
