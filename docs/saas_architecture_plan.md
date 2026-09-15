# SaaS Architecture Blueprint: Single-User to Multi-Tenant Transition

This document outlines the architectural changes required to transition the Personal Financial Health Dashboard from a single-user prototype to a multi-tenant SaaS application.

## 1. Database Tenant Isolation

### 1.1 New User/Tenant Model
- Create a new `User` (or `Tenant`) model in `models.py`. 
- Fields should include: `id` (UUID or Integer), `email`, `hashed_password`, `is_active`, and `telegram_chat_id` (to map Telegram messages to the correct tenant).

### 1.2 Schema Updates
- Inject a `tenant_id` column into all 11 existing data models: `Expense`, `Income`, `Account`, `BalanceAdjustment`, `Budget`, `Loan`, `Investment`, `Goal`, `Bill`, `CreditScore`, and `Profile`.
- Configure `tenant_id` as a foreign key referencing `users.id`.
- Update the automated table creation and migration logic in `main.py` to accommodate `tenant_id` and the new `User` table.

### 1.3 PostgreSQL Row-Level Security (RLS)
- Enable RLS on all 11 tables to ensure data isolation at the database engine level.
- Example SQL policy to apply: 
  ```sql
  ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation_policy ON expenses 
  USING (tenant_id = current_setting('app.current_tenant')::integer);
  ```
- **Session Injection:** Modify the `get_db` SQLAlchemy dependency in FastAPI to set the `app.current_tenant` variable for the lifecycle of the request, ensuring all subsequent `db.query(...)` calls are automatically scoped to the current user without changing every single ORM query.

## 2. JWT Authentication

### 2.1 Authentication Flow
- Replace the static `X-API-Key` dependency with standard OAuth2 JWT (JSON Web Token) authentication.
- Integrate libraries like `PyJWT`, `passlib[bcrypt]`, and `python-multipart`.
- Expose new authentication routes:
  - `POST /api/v1/auth/register` (User signup)
  - `POST /api/v1/auth/login` (Validates credentials and issues a JWT access token)

### 2.2 Security Dependency
- Deprecate `verify_api_key`.
- Create a new dependency `get_current_user` that intercepts the `Authorization: Bearer <token>` header, decodes the JWT, verifies expiration/signatures, and returns the active `User` object.

## 3. Routing Updates

### 3.1 Endpoint Adjustments
- Update every existing endpoint in `main.py` (e.g., `/api/v1/dashboard/`, `/api/v1/expenses/`) to require `current_user: User = Depends(get_current_user)`.
- If RLS handles the isolation, the core SQLAlchemy queries (e.g., `db.query(models.Expense).all()`) can remain clean. Otherwise, queries will need to be explicitly scoped like `.filter(models.Expense.tenant_id == current_user.id)`. Using RLS is preferred as specified.

### 3.2 Telegram Agent Decoupling
- The current webhook hardcodes `TELEGRAM_CHAT_ID`.
- Update the `/api/v1/webhook/telegram` endpoint to dynamically look up the `User` in the database where `User.telegram_chat_id == sender_id`.
- Before executing the `async_process_telegram_message` background task, instantiate a database session, inject the specific user's `tenant_id` via PostgreSQL variables, and then process the AI logic to log expenses into the correct tenant's ledger.
- Move away from the single global `TELEGRAM_CHAT_ID` environment variable.

### 3.3 Daily Alerts & CRON Jobs
- Update the `scheduled_financial_health_check` APScheduler job. Instead of generating one global report, the job must iterate through all active `Users` (who have a linked `telegram_chat_id`), instantiate a tenant-scoped database session for each, generate their localized financial briefing, and dispatch it via the Telegram API individually.

---
**Status:** Pending User Approval
**Next Steps:** Upon approval, I will begin modifying `models.py` to add the `User` table and `tenant_id` fields, followed by implementing JWT auth and RLS configuration in `main.py`.
