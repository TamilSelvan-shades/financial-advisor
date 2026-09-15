# Production Deployment Guide

This document outlines the steps required to deploy the Personal AI Advisor application into a production environment. 

## Prerequisites
- A production Linux server (e.g., Ubuntu 22.04 on AWS EC2, DigitalOcean Droplet, etc.)
- Docker and Docker Compose installed on the server.
- Domain name with DNS records pointing to your server's IP address.
- Optionally, a reverse proxy like Nginx or Traefik configured for SSL/TLS termination.
- Razorpay Production Credentials.
- Production PostgreSQL database (either self-hosted via Docker or a managed service like AWS RDS, Supabase, etc.).

## Environment Variables Configuration

Before deploying, you must configure the environment variables for both the backend and frontend. Templates have been provided:

1. **Backend**: Copy `.env.production.example` to `.env` in the root directory.
2. **Frontend**: Copy `frontend/.env.production.example` to `frontend/.env` in the `frontend` directory.

Fill in all the required production secrets (JWT secrets, Live Razorpay Keys, database credentials, and actual CORS origins).

## Production Docker Images

The application uses optimized Dockerfiles for production:

### Backend (`backend.Dockerfile`)
- Uses a lightweight `python:3.11-slim` image.
- Runs as a non-root user (`appuser`) for enhanced security.
- Includes a `prestart.sh` script that automatically runs database migrations (`alembic upgrade head`) before starting the server.
- Uses Uvicorn with standard production parameters.

### Frontend (`frontend/Dockerfile`)
- Uses a lightweight Node Alpine image.
- Implements Next.js standalone output to drastically reduce the final image size.
- Runs as a non-root user (`nextjs`).

## Orchestration with Docker Compose (`docker-compose.prod.yml`)

The production deployment relies on `docker-compose.prod.yml` to orchestrate the services. 

### Key Features:
- **Health Checks**: The backend waits until the database is healthy before starting. The frontend waits for the backend to be healthy.
- **Internal Networking**: Next.js communicates with FastAPI over the internal Docker network, removing the need for external network calls for Server-Side Rendering (SSR).
- **Restart Policies**: All services are configured to restart automatically unless explicitly stopped.

## Deployment Steps

1. **Clone the repository** to your production server.
2. **Set up Environment Variables**:
   ```bash
   cp .env.production.example .env
   cp frontend/.env.production.example frontend/.env
   # Edit both .env files with your production secrets
   nano .env
   nano frontend/.env
   ```
3. **Run Docker Compose**:
   Bring up the application in detached mode using the production compose file.
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

4. **Verify Deployment**:
   - Check the backend health: `curl http://localhost:8000/healthz` (Should return `{"status": "ok", "db": "connected"}`)
   - Check the frontend availability: `curl http://localhost:3000`

## Important Considerations

- **SSL/HTTPS**: The provided Docker Compose configuration exposes ports `8000` and `3000` locally. In a true production environment, you should place a reverse proxy (like Nginx, Traefik, or Cloudflare Tunnels) in front of these services to handle SSL/TLS termination and route external traffic securely to your containers.
- **Database Backups**: If using the Dockerized PostgreSQL database, ensure you have a cron job backing up the Docker volume `postgres_data_prod`. The application includes backup scripts (like `backup_db.py`) which you can schedule via cron on the host machine.
- **CORS Origins**: Ensure `BACKEND_CORS_ORIGINS` in your backend `.env` matches your exact frontend production domain (e.g., `https://my-finance-app.com`).
