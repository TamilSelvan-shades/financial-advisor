# Frontend Architecture Blueprint

## 1. Project Setup

- **Framework:** Next.js with App Router (`/app` directory)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui

### Initialization Steps
```bash
# Create Next.js app
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Initialize shadcn/ui
npx shadcn@latest init
```

## 2. Auth & State Management

- **Token Persistence:** We will use **secure HTTP-only cookies** for token persistence. This is the most secure approach against XSS attacks. 
- **Next.js Server Proxy Pattern:** Client-side Axios interceptors cannot read HTTP-only cookies. Instead, we will use the Next.js Server Proxy / Server Components pattern. Next.js server actions and server components will read the HTTP-only cookie, extract the JWT, and attach it as an `Authorization: Bearer <token>` header before making server-to-server `fetch` requests to the FastAPI backend.
- **Route Protection:** We will leverage Next.js Middleware (`middleware.ts`) to intercept requests to protected routes. If the user is unauthenticated (missing valid token cookie), they will be redirected to the `/login` page.

## 3. Page Structure & Route Mapping

The application will follow Next.js App Router conventions:

- **Public Routes:**
    - `/login`: User authentication.
    - `/register`: New user onboarding.
- **Protected Routes (Wrapped in a unified Auth Layout):**
    - `/dashboard`: High-level overview of finances and AI insights.
    - `/loans`: Detailed loan management and amortization views.
    - `/expenses`: Expense tracking and categorization.
    - `/chat`: AI Advisor chat interface.

## 4. Math Parity & Visualization

- **Calculations:** The backend's logarithmic loan amortization logic will be ported to robust TypeScript utility functions (e.g., `frontend/src/utils/math.ts`). We will ensure strict parity by writing automated unit tests to verify parity with the backend results.
- **Charting:** We will transition from backend-generated Plotly charts to **Recharts** for the amortization visualizations. Recharts provides excellent React integration for area charts, cleanly displaying the loan amortization schedules over time.
