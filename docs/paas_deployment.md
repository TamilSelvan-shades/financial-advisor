# PaaS Deployment Guide (Render + Vercel)

This guide covers deploying the AI Advisor application using a decoupled architecture:
- **Database & Backend**: Render (Managed PostgreSQL + Python Web Service)
- **Frontend**: Vercel (Next.js)

## 1. Backend & Database Deployment (Render)

Render uses an Infrastructure-as-Code approach via the `render.yaml` Blueprint file at the root of the repository.

> [!WARNING]
> **SaaS Scaling Warning**: The backend runs an in-memory `BackgroundScheduler` in the FastAPI `lifespan` hook. **Do NOT scale the Render Web Service to multiple instances.** If you run more than 1 instance, the scheduled jobs (like the 8 AM daily pulse) will trigger multiple times. Keep it at 1 instance until a distributed job queue (like Celery/Redis) is implemented.

### Steps to Deploy on Render

1. **Push Changes to GitHub**: Ensure the `render.yaml` and `database.py` (which includes the PostgreSQL URL fix) are committed and pushed to your GitHub repository.
2. **Log into Render**: Go to [Render Dashboard](https://dashboard.render.com).
3. **Create a New Blueprint**:
   - Click the **New** button and select **Blueprint**.
   - Connect your GitHub account (if not already connected) and select this repository.
   - Render will automatically parse the `render.yaml` file.
   - Click **Apply** to provision both the **ai-advisor-db** (PostgreSQL) and the **ai-advisor-backend** (Python Web Service).
4. **Environment Variables on Render**:
   - In the Render Dashboard, go to your **ai-advisor-backend** service.
   - Click on the **Environment** tab.
   - The `DATABASE_URL` and `PYTHON_VERSION` are automatically injected by the Blueprint.
   
   > [!IMPORTANT]
   > **Manual Action Required**: For the new SaaS implementation, you MUST add these variables:
   > - `TELEGRAM_WEBHOOK_URL`: E.g., `https://ai-advisor-backend.onrender.com/api/v1/webhook/telegram`. **This is crucial to disable the local background poller in production.**
   > - `TELEGRAM_BOT_TOKEN`: Your live Telegram bot token.
   > - `WHATSAPP_PROVIDER`: `meta` or `twilio`.
   > - `WHATSAPP_PHONE_NUMBER_ID` & `WHATSAPP_ACCESS_TOKEN` (or equivalent for Twilio).
   > - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Live keys for SaaS billing.
   > - `JWT_SECRET`: A strong secret for user authentication.
   > - `BACKEND_CORS_ORIGINS`: `["https://your-vercel-domain.vercel.app"]`
   
5. **Database Migrations**: The `alembic upgrade head` pre-deploy command in `render.yaml` will automatically apply the new SaaS database schema migrations (Users, Subscriptions, etc.) during deployment.
6. **Verify Backend**: Once deployed, the service URL will be available on the Render dashboard (e.g., `https://ai-advisor-backend.onrender.com`).

---

## 2. Frontend Deployment (Vercel)

The Next.js frontend relies on `NEXT_PUBLIC_API_URL` to route API requests to the Render backend. The `next.config.ts` has been configured to proxy requests so cross-domain HTTP-only cookies function correctly.

### Steps to Deploy on Vercel

1. **Log into Vercel**: Go to [Vercel Dashboard](https://vercel.com).
2. **Add New Project**:
   - Click **Add New...** -> **Project**.
   - Import your GitHub repository.
3. **Configure Project**:
   - **Framework Preset**: Vercel should automatically detect Next.js.
   - **Root Directory**: Click "Edit" and select `frontend` as the root directory, since the Next.js app is located there.
4. **Environment Variables on Vercel**:
   - Before clicking Deploy, expand the **Environment Variables** section.
   - Add the following variable:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: Your Render backend URL (e.g., `https://ai-advisor-backend.onrender.com`).
     - *Note: Do NOT include a trailing slash in the URL.*
5. **Deploy**:
   - Click **Deploy**. Vercel will build and deploy the frontend.
6. **Verify Proxy**:
   - Once deployed, visit your Vercel URL (e.g., `https://your-project.vercel.app`).
   - Test login/API calls to ensure they are successfully proxied to the Render backend and cookies are set properly.
