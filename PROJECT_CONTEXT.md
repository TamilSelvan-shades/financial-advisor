# Personal Financial Health Dashboard -> IT SaaS Transition

## Current State

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL. Contains 11 data models (Expenses, Incomes, Accounts, Loans, etc.).
- **Frontend:** Streamlit dashboard with multi-tab navigation, Plotly charts, and an ICICI Bank `.xls` statement auto-parser.
- **AI & Automations:** Gemini AI integrated for financial chat. Background APScheduler jobs run daily at 8:00 AM for Telegram alerts. Webhook active for logging transactions via Telegram.
- **Recent Updates:** We just implemented dynamic loan tracking with mathematical amortization trajectory charts, and added transaction deletion capabilities.

## The Goal (Next Steps)

We are converting this single-user prototype into a Multi-Tenant SaaS product targeted at IT professionals in finance.

## Pending Architectural Shifts

1. **Database:** Implement `tenant_id` foreign keys and PostgreSQL Row-Level Security (RLS) across all 11 tables.
2. **Authentication:** Implement JWT-based auth and eventually SSO (Google/Azure AD).
3. **Frontend:** Migrated frontend from Streamlit to Next.js/React for proper state management and secure multi-tenant routing.
4. **Agent Decoupling:** Move the Telegram bot from a single hardcoded webhook to a multi-tenant Redis/Celery queue.
