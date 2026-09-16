# Use official, lightweight Python image
FROM python:3.11-slim

# Create a non-root user and group
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies required for PostgreSQL (psycopg2) and curl (for healthchecks)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq-dev gcc curl && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Ensure the prestart script is executable
RUN chmod +x prestart.sh

# Change ownership of the app directory to the non-root user
RUN chown -R appuser:appuser /app

# Switch to the non-root user
USER appuser

# Expose the API port
EXPOSE 8000

# Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Command to run prestart script and then start the server
# WARNING: Do NOT use multiple workers (--workers 4) because APScheduler runs in-memory and will duplicate jobs!
CMD ["sh", "-c", "./prestart.sh && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]