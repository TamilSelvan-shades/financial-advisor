# PaaS Deployment Guide (Render + Vercel)

This guide covers deploying the AI Advisor application using a decoupled architecture:
- **Database & Backend**: Render (Managed PostgreSQL + Python Web Service)
- **Frontend**: Vercel (Next.js)

## 1. Backend & Database Deployment (Render)

Render uses an Infrastructure-as-Code approach via the `render.yaml` Blueprint file at the root of the repository.

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
   - **Manual Action Required**: Add any other required production backend environment variables here, such as:
     - `RAZORPAY_KEY_ID` (Live Key)
     - `RAZORPAY_KEY_SECRET` (Live Secret)
     - `SECRET_KEY` / `JWT_SECRET` (For authentication)
     - Any other API keys (e.g., Telegram, OpenAI).
5. **Verify Backend**: Once deployed, the service URL will be available on the Render dashboard (e.g., `https://ai-advisor-backend.onrender.com`). Visit this URL (or the `/docs` endpoint) to ensure the FastAPI server is running.

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
   - Add any other frontend-specific environment variables you have in your `.env.production.example`.
5. **Deploy**:
   - Click **Deploy**. Vercel will build and deploy the frontend.
6. **Verify Proxy**:
   - Once deployed, visit your Vercel URL (e.g., `https://your-project.vercel.app`).
   - Test login/API calls to ensure they are successfully proxied to the Render backend and cookies are set properly.

---

## Summary of Changes Made

1. **`render.yaml`**: Created at the project root to define the database and backend service, including deployment commands (`alembic upgrade head`) and start commands.
2. **`next.config.ts`**: Updated to proxy frontend `/api/v1/:path*` requests to `NEXT_PUBLIC_API_URL` to prevent cross-origin cookie issues.
3. **`database.py`**: Validated that it already replaces `postgres://` with `postgresql://` for SQLAlchemy 1.4+ compatibility.
