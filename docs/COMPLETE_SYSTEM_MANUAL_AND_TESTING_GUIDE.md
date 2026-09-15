# Enterprise Personal AI Financial Advisor — Complete System Manual & Real-Data Testing Guide

---

## 1. Executive System Overview & Architecture

### 1.1 Purpose & Vision
The **Personal AI Financial Advisor** is an enterprise-grade, multi-tenant SaaS application specifically engineered for modern IT professionals, freelancers, and salaried individuals. Rather than functioning as a passive expense tracker or static spreadsheet, the system operates as an **Autonomous Financial Guardian** and **Decision Intelligence Engine**. It proactively guards against budget overruns, detects hidden subscription price creep, calculates real-time Indian Income Tax regime trade-offs (FY 2024–25 / FY 2025–26), projects prospective What-If commitments, and communicates frictionlessly across Web, WhatsApp, and Telegram.

```
                                  +-------------------------------------------------------------------+
                                  |                         USER INTERFACES                           |
                                  |   Next.js 14 Web App  |  Telegram Bot  |  Meta WhatsApp Cloud API |
                                  +---------------------------------+---------------------------------+
                                                                    |
                                                                    v
                                  +-------------------------------------------------------------------+
                                  |                 FASTAPI BACKEND CORE ENGINE (v2.3.0)              |
                                  | - JWT Auth & Tenant RLS Isolation   - APScheduler (8:00 AM Cron)  |
                                  | - Multi-Currency & Live Forex       - Razorpay Subscriptions Gating|
                                  +---------------------------------+---------------------------------+
                                                                    |
                +-------------------------+-------------------------+-------------------------+
                |                         |                         |                         |
                v                         v                         v                         v
+-------------------------------+ +-------------------------------+ +-------------------------------+ +-------------------------------+
|     DECISION INTELLIGENCE     | |      MULTIMODAL INGESTION     | |      TAX OPTIMIZATION         | |     AUTONOMOUS GUARDIAN       |
| - Loan & Debt Payoff Engine   | | - Universal Statement Parser  | | - Union Budget 2024 Regimes   | | - Zombie Subscription Radar   |
| - What-If Scenario Sandbox    | | - Gemini 2.5 Flash Vision OCR | | - 80C, 80D, 80CCD(1B), 24b    | | - Auto-Sweep Idle Cash Engine |
| - Cashflow Guardian 7D/14D    | | - Gemini 2.5 Flash Audio      | | - HRA Exemption Sec 10(13A)   | | - Budget Guardrail Alerts     |
| - Safe-to-Spend Daily Math    | | - Voice-to-Ledger Transcription| | - Break-Even Deduction Gap   | | - Round-Up Micro-Savings Jar  |
+-------------------------------+ +-------------------------------+ +-------------------------------+ +-------------------------------+
                                                                    |
                                                                    v
                                  +-------------------------------------------------------------------+
                                  |                    POSTGRESQL MULTI-TENANT DB                     |
                                  | 16 Normalized Tables with Tenant Isolation via tenant_id UUID    |
                                  +-------------------------------------------------------------------+
```

---

### 1.2 Technology Stack
| Layer | Technologies Used | Key Responsibilities |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Canvas Confetti | Responsive UI, Chart Studio, Privacy Blur Mode, Hotkeys, Command Palette, Floating Dock, Interactive Sliders |
| **Backend API** | FastAPI (Python 3.11+), Uvicorn, Pydantic v2, SQLAlchemy ORM | REST API, Webhooks, Multi-tenant DB isolation, Business logic execution |
| **Database** | PostgreSQL, Alembic / SQLAlchemy Auto-Patch Migration Engine | Relational persistence, tenant UUID indexing, ACID transactions |
| **AI & LLM** | Google Gemini 2.5 Flash (Text, Multimodal Vision, and Audio) | Speech-to-ledger audio transcription, camera receipt OCR extraction, tool-calling financial advisor chat, natural language bot processing |
| **Background Jobs** | APScheduler (BackgroundScheduler) | Daily 8:00 AM Morning Pulse, Cashflow Guardian overdraft forecast, recurring reminders |
| **Integrations** | Razorpay SDK, Meta WhatsApp Cloud API (Graph API v21.0), Twilio WhatsApp API, Telegram Bot API, Open Exchange Rates API | Recurring subscription billing, multi-channel messaging, real-time forex rates |

---

### 1.3 Database Architecture (16 Normalized Tables)
All tenant data is strictly partitioned by `tenant_id` (UUID foreign key referencing `users.id` with `ondelete="CASCADE"`):

1. **`users`**: Master tenant identity (`id`, `email`, `hashed_password`, `telegram_chat_id`, `whatsapp_phone_number`, `notification_channel`, `preferred_briefing_time`, `telegram_link_token`, `is_active`).
2. **`subscriptions`**: Razorpay subscription lifecycle (`tenant_id`, `razorpay_customer_id`, `razorpay_subscription_id`, `plan_id`, `status`).
3. **`expenses`**: Outflow records (`tenant_id`, `date`, `description`, `amount`, `category`, `account`, `remarks`).
4. **`incomes`**: Inflow records (`tenant_id`, `date`, `category`, `amount`, `account`, `description`, `remarks`).
5. **`accounts`**: Bank/cash/wallet accounts (`tenant_id`, `name`, `account_type`, `initial_balance`). Unique on `(tenant_id, name)`.
6. **`balance_adjustments`**: Manual cash/account reconciliations (`tenant_id`, `date`, `account`, `amount`, `reason`).
7. **`budgets`**: Monthly category expenditure caps (`tenant_id`, `category`, `monthly_limit`). Unique on `(tenant_id, category)`.
8. **`loans`**: Debt liabilities (`tenant_id`, `name`, `principal`, `interest_rate`, `tenure_years`, `tenure_months`, `start_date`, `extra_prepayment`).
9. **`investments`**: Asset portfolio holdings (`tenant_id`, `name`, `category`, `invested_amount`, `current_value`).
10. **`goals`**: Financial milestones (`tenant_id`, `name`, `target_amount`, `current_amount`, `target_date`).
11. **`bills`**: Recurring commitments (`tenant_id`, `name`, `amount`, `due_day`, `status`).
12. **`credit_scores`**: Credit bureau history (`tenant_id`, `score`, `date`, `rating`, `agency`).
13. **`profile`**: Tenant key-value configuration (`tenant_id`, `key`, `value`). Unique on `(tenant_id, key)`.
14. **`tax_profiles`**: Indian tax deductions state (`tenant_id`, `gross_salary`, `basic_salary`, `hra_received`, `rent_paid`, `is_metro`, `section_80c`, `section_80d_self`, `section_80d_parents`, `parents_senior_citizen`, `section_80ccd_1b`, `section_24b`, `other_deductions`, `preferred_regime`).
15. **`autonomous_rules`**: Autonomous agent policies (`tenant_id`, `rule_type`, `is_enabled`, `config_json`). Unique on `(tenant_id, rule_type)`.
16. **`autonomous_action_logs`**: Proactive audit trail (`tenant_id`, `created_at`, `rule_type`, `action_type`, `title`, `message`, `amount`, `status`).

---

## 2. Authentication, Tenant Isolation & Commercial Billing

### 2.1 Purpose & Functionality
- **Multi-Tenant Security**: Protects user financial records. Each authenticated request resolves the tenant ID from the signed JWT bearer token. No tenant can ever view or mutate another tenant's financial data.
- **Commercial SaaS Monetization**: Endpoints (dashboard, intelligence, statement upload, tax calculation, reports) are protected by `dependencies.verify_active_subscription`. Inactive accounts are prompted to activate via Razorpay Pro Plan.

### 2.2 API Endpoints
- `POST /api/v1/auth/register`: Creates new user with bcrypt password hash.
- `POST /api/v1/auth/login`: OAuth2 password form authentication, returns signed JWT access token.
- `GET /api/v1/auth/me`: Fetches profile and live Razorpay subscription status.
- `POST /api/v1/billing/customer`: Creates/fetches Razorpay customer ID.
- `POST /api/v1/billing/subscription`: Generates 120-month recurring subscription link.
- `GET /api/v1/billing/subscription/status`: Polling endpoint for active status.
- `POST /api/v1/billing/webhook`: Verifies HMAC SHA-256 signature (`X-Razorpay-Signature`) and auto-activates subscription upon payment.

### 2.3 Verification & Real-Data Testing
```bash
# 1. Register a fresh tenant
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "tester@example.com", "password": "SecurePassword123!"}'

# 2. Login and extract Bearer Token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=tester@example.com&password=SecurePassword123!'

# Expected Response: {"access_token": "<JWT_TOKEN>", "token_type": "bearer"}
```

---

## 3. Core Financial Ledger & Multi-Account Management

### 3.1 Purpose & Mathematical Formulas
The ledger tracks money flows across various accounts (Savings, Credit Cards, Cash, Investments).

#### Core Balance Formula:
$$\text{Liquid Balance} = \sum(\text{Account Initial Balances}) + \sum(\text{All Incomes}) - \sum(\text{All Expenses}) + \sum(\text{Balance Adjustments})$$

#### Net Worth Formula:
$$\text{Net Worth} = (\text{Liquid Balance} + \text{Total Investments}) - \text{Total Outstanding Loan Debt}$$

#### Safe-to-Spend Daily Allowance:
$$\text{Uncommitted Cushion} = \max(0, \text{Liquid Balance} - \text{Unpaid Bills Due in Month} - \text{Monthly Loan EMIs})$$
$$\text{Daily Safe-to-Spend} = \frac{\text{Uncommitted Cushion}}{\text{Days Left in Current Calendar Month}}$$

Burn rate classifications:
- **Healthy**: $\ge ₹1,500/\text{day}$
- **Moderate**: $₹500 \text{ to } ₹1,499/\text{day}$
- **Tight**: $< ₹500/\text{day}$

---

### 3.2 The 7 Ledger Sub-Tabs (`/expenses`)
1. **Monthly Overview**:
   - Filter transactions by Year-Month selector.
   - Summary cards: Total Inflow, Total Outflow, Net Savings, Savings Rate %.
   - Interactive Pie Chart of expenses by category with dynamic color assignments.
   - Month-by-month cashflow bar chart.
   - Searchable, sortable transaction table with single-click deletion.
2. **Annual Trends & Cash Flow**:
   - 12-month historical breakdown of Inflow vs Outflow vs Savings.
   - Cumulative net savings trajectory.
3. **Custom Date Range Analysis**:
   - Start Date and End Date range pickers.
   - Category Leak Radar comparing the selected range spend to normalized weekly baselines.
4. **Accounts & Unified Ledger**:
   - Multi-account cards (ICICI, HDFC, Cash, Credit Card, etc.) displaying reconciled balances.
   - Balance adjustment tool (`/balance-adjustments/`) for auditing discrepancies.
   - Add new Account form.
5. **Category Budgets & Limits**:
   - Sets monthly spending limits per category (e.g., Food & Dining ₹15,000).
   - Visual progress bars with color-shifting indicators (Green $<80\%$, Yellow $80-99\%$, Red $\ge 100\%$).
6. **Manual Transaction Logging**:
   - Dual-mode tab for recording Income or Expense.
   - Fields: Amount, Category (auto-suggested), Account dropdown, Date picker, Description, Remarks.
7. **Universal Statement Ingestion**:
   - Drag-and-drop file upload supporting PDF, Excel (`.xlsx`, `.xls`), and CSV.
   - Password decryption field for encrypted bank statements.
   - Toggle options: "Auto-create bank account" and "Replace all transactions".

---

### 3.3 Verification & Real-Data Testing
```bash
# 1. Create an Account
curl -X POST http://localhost:8000/api/v1/accounts/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "HDFC Salary Account", "account_type": "Bank Account", "initial_balance": 50000.0}'

# 2. Log Monthly Income
curl -X POST http://localhost:8000/api/v1/incomes/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-09-01", "category": "Salary", "amount": 125000.0, "account": "HDFC Salary Account", "description": "Tech Corp Monthly Salary"}'

# 3. Log Multiple Expenses
curl -X POST http://localhost:8000/api/v1/expenses/bulk \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"expenses": [
    {"date": "2026-09-02", "category": "Rent & Housing", "amount": 30000.0, "account": "HDFC Salary Account", "description": "Apartment Rent"},
    {"date": "2026-09-03", "category": "Food & Dining", "amount": 4500.0, "account": "HDFC Salary Account", "description": "Gourmet Dinner"},
    {"date": "2026-09-05", "category": "Utilities & Bills", "amount": 2500.0, "account": "HDFC Salary Account", "description": "Electricity Bill"}
  ]}'

# 4. Set Category Budget
curl -X POST http://localhost:8000/api/v1/budgets/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"category": "Food & Dining", "monthly_limit": 12000.0}'

# 5. Verify Dashboard Aggregates
curl -X GET http://localhost:8000/api/v1/dashboard \
  -H "Authorization: Bearer <TOKEN>"
# Verify:
# - total_balance == 50000 + 125000 - 37000 = 138000.0
# - monthly_expenses == 37000.0
# - safe_to_spend_daily calculated against remaining days in cycle
```

---

## 4. Multimodal Ingestion Engine (Camera Vision OCR & Voice-to-Ledger)

### 4.1 Purpose & Functionality
Eliminates tedious manual expense logging by allowing users to take photos of paper receipts or dictate audio notes while on the move.

### 4.2 Camera Receipt OCR Scanner (`receipt_scanner.py`)
- **Engine**: Google Gemini 2.5 Flash Vision (`gemini-2.5-flash`).
- **Processing**:
  1. Accepts uploaded receipt or invoice images (JPEG, PNG, WebP).
  2. Extracts: Merchant Name, Transaction Date, Category, Total Amount, Subtotal, Tax Breakdown (CGST/SGST/VAT), Payment Method, Line Items (Item name, quantity, unit price, line total), and OCR Confidence Score.
  3. Automatically converts foreign currencies to INR using real-time forex rates.
  4. If `auto_commit=True`, creates an `Expense` record and ensures a corresponding `Budget` category exists.

### 4.3 Voice-to-Ledger Audio Engine (`voice_ledger.py`)
- **Engine**: Google Gemini 2.5 Flash Audio (`gemini-2.5-flash`).
- **Processing**:
  1. Accepts voice recordings (WebM, OGG, MP4, WAV).
  2. Generates exact verbatim speech transcript.
  3. Classifies financial intent (`log_expense` vs `log_income`).
  4. Extracts numeric amount, currency, merchant, category, account, and date.
  5. Produces natural conversational spoken confirmation (e.g., *"Logged ₹850 for Fuel at Shell on Credit Card"*).
  6. Automatically commits record to database if `auto_commit=True`.

### 4.4 Quick Hotkeys & Dock Integration
- **`S` key**: Opens Receipt Camera OCR modal from anywhere in the app.
- **`V` key**: Opens Voice-to-Ledger audio recording modal.
- **Floating Action Dock**: Persistent bottom-center dock with one-tap access.

### 4.5 Verification & Real-Data Testing
```bash
# Test Voice-to-Ledger via cURL with an audio file
curl -X POST http://localhost:8000/api/v1/multimodal/voice-to-ledger \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@sample_voice_expense.webm;type=audio/webm" \
  -F "auto_commit=true"

# Expected Response:
# {
#   "success": true,
#   "action": "log_expense",
#   "transcript": "Spent 650 rupees at Cafe Coffee Day on coffee and sandwiches",
#   "transaction": {"amount": 650.0, "category": "Food & Dining", "description": "Cafe Coffee Day", ...},
#   "amount_in_inr": 650.0,
#   "record_id": 42,
#   "spoken_response": "Logged ₹650 for Cafe Coffee Day under Food & Dining."
# }
```

---

## 5. Universal Bank Statement Parser (Multi-Bank & Encrypted PDF)

### 5.1 Purpose & Functionality
Parses statements from major Indian and global banks without requiring third-party aggregators or exposing bank login credentials.

### 5.2 Supported Institutions & Smart Heuristics
- **HDFC Bank**: Password hint: Customer ID or PAN card.
- **State Bank of India (SBI)**: Password hint: DOB (DDMM) + last 4 digits of mobile, or PAN.
- **ICICI Bank**: Password hint: First 4 letters of name (lowercase) + DOB (DDMM).
- **Axis Bank**: Password hint: 10-digit PAN (uppercase) or mobile number.
- **Kotak Mahindra Bank**: Password hint: DOB (DDMMYYYY) or CRN.
- **American Express (Amex)**: Password hint: DOB (DDMMYYYY) or postal PIN code.
- **Generic Statements**: Fallback regex parser for standard debit/credit/balance tables in PDF, CSV, and Excel formats.

### 5.3 Auto-Categorization Taxonomy
- **Food & Dining**: Zomato, Swiggy, Starbucks, McDonald's, Dominos, KFC, Restaurants.
- **Shopping & Groceries**: Amazon, Flipkart, D-Mart, Zepto, Blinkit, BigBasket, Myntra.
- **Fuel & Transport**: Shell, HPCL, BPCL, IOCL, Uber, Ola, Fastag, IRCTC, MakeMyTrip, Indigo.
- **Utilities & Bills**: Electricity (BESCOM, TNEB, Tata Power), Airtel, Jio, ACT, Hathway.
- **Investments**: Zerodha, Groww, Upstox, Mutual Funds, SIPs, PPFAS.
- **Loans & EMI**: Home Loan, HDFC CC, SBI Card, Bajaj Finance, KreditBee.

### 5.4 Verification & Real-Data Testing
```bash
# 1. Preview Statement without Committing
curl -X POST http://localhost:8000/api/v1/statements/parse \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@bank_statement.pdf" \
  -F "password=MYPAN1234F"

# 2. Ingest and Auto-Create Bank Account
curl -X POST http://localhost:8000/api/v1/statements/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@bank_statement.pdf" \
  -F "password=MYPAN1234F" \
  -F "auto_create_account=true" \
  -F "replace_all=false"

# Verify Response:
# - bank_name correctly detected
# - accounts table automatically populated with detected account
# - incomes and expenses inserted and visible in ledger
# - discovered_recurring_bills populated if repeating subscriptions found
```

---

## 6. Bills, Subscriptions & AI Recurring Radar

### 6.1 Purpose & Functionality
Prevents missed payment penalties, maintains clean credit ratings, and detects unmonitored subscription charges.

### 6.2 Calendar-Aware Due Date Timeline
Calculated in `reminder_service.py` with month-rollover protection:
- **Overdue** (`lifecycle_status: "overdue"`): Unpaid bills where `due_day < current_day` of the current calendar month. Marked with **Critical** urgency.
- **Due Today** (`lifecycle_status: "due_today"`): Unpaid bills where `due_day == current_day`. Marked with **High** urgency.
- **Upcoming 7 Days** (`lifecycle_status: "upcoming_7d"`): Bills due within the next 7 calendar days.
- **Future**: Bills due later in the billing cycle.
- **Paid**: Bills settled for the active cycle; next projected due date rolls over to next month (`today.month + 1`).

### 6.3 One-Click Settlement Engine (`/api/v1/bills/{id}/settle`)
When a bill is settled via Web, Telegram, or WhatsApp:
1. Bill status updates to `"Paid"`.
2. An `Expense` record is **automatically generated** in the database with:
   - `amount = bill.amount`
   - `category = "Utilities & Bills"`
   - `description = "Settled Bill: " + bill.name`
   - `account = "ICICI Savings Account"` (or user default)
   - `date = today's date`
3. Uncommitted balance and daily safe-to-spend allowance update dynamically.

### 6.4 AI Subscription Auto-Discovery Radar (`recurring_radar.py`)
- Analyzes expense history over the past 90 days.
- Groups transactions by normalized merchant name and amount variance ($\pm 10\%$).
- Detects monthly cadence ($\ge 2$ occurrences separated by 25–35 days).
- Computes confidence score based on regularity of the charge.
- Exposes candidates on `/bills/discovered-recurring`.
- Users can click **"Track"** on the Web UI, reply `TRACK 1` on WhatsApp, or tap the inline button on Telegram to convert the charge into a tracked recurring bill.

### 6.5 Verification & Real-Data Testing
```bash
# 1. Add a recurring bill due on the 5th
curl -X POST http://localhost:8000/api/v1/bills/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Airtel Fiber Broadband", "amount": 1179.0, "due_day": 5}'

# 2. Check Bill Status
curl -X GET http://localhost:8000/api/v1/reminders/status \
  -H "Authorization: Bearer <TOKEN>"
# Verify: If today is the 11th, Airtel Fiber is classified as "overdue" by 6 days.

# 3. Settle Bill in 1 Click
curl -X POST http://localhost:8000/api/v1/bills/1/settle \
  -H "Authorization: Bearer <TOKEN>"

# Verify:
# - Bill #1 status is now "Paid"
# - A new Expense of ₹1,179.00 exists in the expenses table under "Utilities & Bills"
```

---

## 7. Loans, Debt Payoff Matrix & Mathematical Amortization Engine

### 7.1 Mathematical EMI Calculation
For principal $P$, annual interest rate $R$, and tenure in months $N$:
$$r = \frac{R}{12 \times 100}$$
$$\text{EMI} = P \times r \times \frac{(1 + r)^N}{(1 + r)^N - 1}$$

### 7.2 Snowball vs. Avalanche Payoff Strategies
The Debt Payoff Matrix (`loan_math.py`) simulates accelerating debt reduction with an additional monthly budget (e.g., $+₹5,000/\text{month}$):
- **Snowball Method**: Directs extra prepayments to the loan with the **smallest outstanding principal**. Provides psychological wins by eliminating loans quickly.
- **Avalanche Method**: Directs extra prepayments to the loan with the **highest annual interest rate**. Minimizes total interest paid over time.
- **Payoff Matrix Output**:
  - Baseline debt-free date vs. Accelerated debt-free date.
  - Total interest saved under Snowball vs. Avalanche.
  - Month-by-month debt reduction schedule.

### 7.3 Verification & Real-Data Testing
```bash
# 1. Add Two Real-World Loans
curl -X POST http://localhost:8000/api/v1/loans/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "HDFC Car Loan", "principal": 450000.0, "interest_rate": 8.75, "tenure_months": 48}'

curl -X POST http://localhost:8000/api/v1/loans/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "ICICI Personal Loan", "principal": 120000.0, "interest_rate": 14.5, "tenure_months": 24}'

# 2. Run Payoff Matrix with ₹7,500 Extra Monthly Prepayment
curl -X POST http://localhost:8000/api/v1/loans/payoff-matrix \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"extra_monthly": 7500.0}'

# Verify Response:
# - Avalanche method saves more interest than Snowball due to targeting the 14.5% Personal Loan first.
# - Total months to debt-free status is significantly reduced.
```

---

## 8. Decision Intelligence & What-If Scenario Simulation Sandbox

### 8.1 Purpose & Scenarios
Simulates the financial impact of major life and purchase decisions before executing them.

1. **Financed Asset / Car Loan Simulator (`car_loan`)**:
   - Inputs: Loan Amount, Down Payment, Annual Interest Rate, Tenure (Months).
   - Simulates: Upfront cash reduction, resulting monthly EMI, impact on daily safe-to-spend allowance, Debt-to-Income (DTI) ratio, and Feasibility Score ($0-100$).
2. **Career Sabbatical / Income Pause Simulator (`sabbatical`)**:
   - Inputs: Sabbatical Duration (Months), Income Replacement %, Discretionary Spending Cut %.
   - Simulates: Total cash drain over the sabbatical period, runway exhaustion date, and remaining investment cushion.
3. **SIP Compounding & Wealth Accelerator (`sip_boost`)**:
   - Inputs: Additional Monthly SIP Amount, Expected Annual CAGR %, Investment Horizon (Years).
   - Mathematical Formula:
     $$FV = P \times \frac{(1 + r)^n - 1}{r} \times (1 + r)$$
   - Simulates: Total capital invested vs total wealth created, inflation-adjusted future value.
4. **Discretionary Expense Affordability Check**:
   - Evaluates whether spending ₹X on an immediate luxury (e.g. a vacation or gadget) will breach safety buffers or drop the daily safe-to-spend allowance below acceptable thresholds.
5. **EMI Purchase Impact Simulator**:
   - Analyzes whether buying an item on 3, 6, 9, or 12-month EMI fits within monthly cashflow without causing overdraft risk.
6. **Lump-Sum Loan Prepayment Simulator**:
   - Calculates exact interest saved and reduction in loan tenure achieved by paying a lump sum towards an active loan.

### 8.2 Verification & Real-Data Testing
```bash
# Test Sabbatical Simulation (6 months break with 20% discretionary cut)
curl -X POST http://localhost:8000/api/v1/intelligence/simulate \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_type": "sabbatical",
    "sabbatical_months": 6,
    "income_replacement_pct": 0.0,
    "discretionary_cut_pct": 0.25
  }'

# Verify Response:
# - Shows monthly fixed obligations (Bills + EMIs) that persist during sabbatical.
# - Calculates total reserve required for 6 months.
# - Returns feasibility score and risk rating (Low, Moderate, High).
```

---

## 9. Indian Income Tax Regime Optimization Studio (FY 2024–25 & FY 2025–26)

### 9.1 Purpose & Budget 2024 Revisions
Provides deterministic, side-by-side tax liability calculations under Indian Income Tax laws, updated for Union Budget 2024 revisions.

### 9.2 Tax Slabs Comparison Matrix

| Slab Range | Old Regime Tax Rate | New Regime Tax Rate (FY 24–25 / FY 25–26) |
|---|---|---|
| **₹0 to ₹2,50,000** | Nil (0%) | Nil (0%) |
| **₹2,50,001 to ₹3,00,000** | 5% | Nil (0%) |
| **₹3,00,001 to ₹5,00,000** | 5% | 5% |
| **₹5,00,001 to ₹7,00,000** | 20% | 5% (Effective 5% on ₹3L–₹7L) |
| **₹7,00,001 to ₹10,00,000** | 20% | 10% |
| **₹10,00,001 to ₹12,00,000** | 30% | 15% |
| **₹12,00,001 to ₹15,00,000** | 30% | 20% |
| **Above ₹15,00,000** | 30% | 30% |

### 9.3 Key Deduction Rules
- **Standard Deduction**: ₹75,000 in New Regime (Budget 2024 revision); ₹50,000 in Old Regime.
- **Section 87A Rebate**:
  - New Regime: Full rebate if taxable income $\le ₹7,00,000$ (Net Tax = ₹0), with Marginal Relief for income slightly above ₹7 Lakhs.
  - Old Regime: Full rebate if taxable income $\le ₹5,00,000$ (Net Tax = ₹0).
- **HRA Exemption (Sec 10(13A))**: Minimum of:
  1. Actual HRA received.
  2. Rent paid minus $10\%$ of Basic Salary.
  3. $50\%$ of Basic Salary (Metro) or $40\%$ (Non-Metro).
- **Chapter VI-A Deductions (Old Regime Only)**:
  - Section 80C: Cap ₹1,50,000 (EPF, PPF, ELSS, Life Insurance, Home Loan Principal).
  - Section 80D (Self & Family): Up to ₹25,000 (₹50,000 for Senior Citizens).
  - Section 80D (Parents): Up to ₹25,000 (₹50,000 if parents are Senior Citizens $\ge 60$).
  - Section 80CCD(1B): Up to ₹50,000 for National Pension System (NPS).
  - Section 24(b): Up to ₹2,00,000 for Home Loan Interest on self-occupied property.
- **Health & Education Cess**: $4\%$ applied on gross tax payable across both regimes.
- **Break-Even Deduction Gap**:
  $$\text{Deduction Gap} = \text{Break-Even Deductions Required} - \text{Current Deductions}$$
  Calculates the exact additional deductions needed for the Old Regime to match or exceed the tax savings of the New Regime.

### 9.4 Verification & Real-Data Testing
```bash
# Calculate Tax Comparison for ₹15 Lakh Salary
curl -X POST http://localhost:8000/api/v1/tax/calculate \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "gross_salary": 1500000.0,
    "basic_salary": 750000.0,
    "hra_received": 300000.0,
    "rent_paid": 300000.0,
    "is_metro": true,
    "section_80c": 150000.0,
    "section_80d_self": 25000.0,
    "section_80d_parents": 50000.0,
    "parents_senior_citizen": true,
    "section_80ccd_1b": 50000.0,
    "section_24b": 180000.0
  }'

# Verify Response:
# - Both Old and New regimes are computed with itemized slab breakdowns.
# - HRA exemption calculated correctly: min(300000, 300000 - 75000, 375000) = 225000.
# - Recommended regime identified with net savings amount and break-even deduction gap.
```

---

## 10. Weekly Executive Financial Briefing & Report Engine

### 10.1 Purpose & Functionality
Delivers a high-level briefing summarizing financial trajectory, velocity, and upcoming commitments.

### 10.2 Core Metrics (`executive_digest.py`)
1. **Weekly Cash Velocity**:
   - 7-Day Inflow vs 7-Day Outflow.
   - Net Cash Velocity ($\text{Inflow} - \text{Outflow}$).
   - Daily Burn Rate.
   - Week-over-Week (WoW) Expense Change % comparing current 7 days to prior 7 days.
   - Weekly Savings Rate %.
2. **Category Leak Radar**:
   - Calculates baseline weekly spending across each category over the previous 4 weeks.
   - Compares the active 7-day spending against this baseline.
   - Flags any category that surges $>30\%$ above baseline as an active leak.
3. **Upcoming 7-Day Horizon**:
   - Aggregates all unpaid bills due in the next 7 days.
   - Calculates pro-rated monthly EMIs.
   - Projects net 7-day liquid cash balance.
4. **AI Executive Pro-Tip**:
   - Personalized financial advice generated by Gemini 2.5 Flash based on the user's spending patterns and upcoming commitments.
5. **Downloadable HTML Report (`/api/v1/reports/executive-briefing/download`)**:
   - Generates a standalone, styled HTML report suitable for printing or saving as a PDF.

### 10.3 Verification & Real-Data Testing
```bash
# 1. Fetch Executive Briefing JSON
curl -X GET http://localhost:8000/api/v1/reports/executive-briefing \
  -H "Authorization: Bearer <TOKEN>"

# 2. Download Standalone Print-Ready HTML Report
curl -X GET http://localhost:8000/api/v1/reports/executive-briefing/download \
  -H "Authorization: Bearer <TOKEN>" \
  -o Sunday_Executive_Briefing.html

# Open Sunday_Executive_Briefing.html in any browser to verify print layout and styling.
```

---

## 11. Autonomous Financial Agent ("The Ghost Accountant")

### 11.1 Purpose & Three Active Policies
The autonomous agent operates in the background to monitor accounts and enforce financial discipline without requiring continuous user intervention.

1. **Auto-Sweep Idle Cash (`auto_sweep`)**:
   - Monitors liquid cash across all accounts.
   - When liquid cash exceeds a configurable safety threshold (default: ₹50,000), it calculates the surplus (e.g. ₹18,400) and recommends/simulates sweeping it into high-yield instruments (e.g. Liquid Mutual Fund @ 7.1% p.a.).
2. **Dynamic Budget Guardrails (`budget_guardrail`)**:
   - Monitors category expenditures against monthly limits.
   - Issues a **Warning Alert** at $80\%$ budget consumption.
   - Issues a **Critical Breach Alert** at $100\%$ consumption, calculating the projected month-end overage based on the current daily burn rate.
3. **Round-Up Micro-Savings Jar (`round_up`)**:
   - Scans discretionary spending (Dining, Shopping, Entertainment).
   - Rounds transactions up to the nearest ₹50 or ₹100.
   - Projects annual micro-savings and 5-year compounding returns if invested at $12\%$ CAGR.

### 11.2 Evaluation Cycle & Audit Trail
- **Execution Endpoint**: `POST /api/v1/autonomous/evaluate` runs an evaluation cycle across all active rules.
- **Action Log**: Recommendations and alerts are logged to `autonomous_action_logs` with statuses: `active`, `dismissed`, or `executed`.
- **Dismiss Action**: `POST /api/v1/autonomous/actions-log/{id}/dismiss` marks an action as dismissed.

### 11.3 Verification & Real-Data Testing
```bash
# 1. Update Autonomous Policy Rules
curl -X POST http://localhost:8000/api/v1/autonomous/rules \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "auto_sweep",
    "is_enabled": true,
    "config": {"buffer_threshold": 40000.0, "target_destination": "Arbitrage Fund", "expected_yield_pct": 7.25}
  }'

# 2. Trigger Evaluation Cycle
curl -X POST http://localhost:8000/api/v1/autonomous/evaluate \
  -H "Authorization: Bearer <TOKEN>"

# 3. View Action Audit Trail
curl -X GET http://localhost:8000/api/v1/autonomous/actions-log \
  -H "Authorization: Bearer <TOKEN>"

# 4. Dismiss an Action
curl -X POST http://localhost:8000/api/v1/autonomous/actions-log/1/dismiss \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 12. Anomaly Guardian & Zombie Subscription Detector

### 12.1 Purpose & Detection Algorithms (`anomaly_detector.py`)
1. **Accidental Duplicate Charge Detector**:
   - Flags identical or near-identical amounts ($\pm ₹1.00$) billed by the same merchant within a 72-hour window.
2. **Subscription Price Creep Detector**:
   - Tracks repeating merchant charges across consecutive months.
   - Flags stealth price hikes exceeding $8\%$ or $\ge ₹50$ (e.g. Netflix increasing from ₹649 to ₹799).
3. **Zombie Subscription Detector**:
   - Flags non-essential recurring subscriptions charged for 3 or more consecutive months without active engagement.

### 12.2 Test Data Seeding Endpoints
- `POST /api/v1/intelligence/anomalies/seed-test-data`: Injects real-world test anomalies (Amazon Prime duplicate charge ₹1,499; Netflix price creep ₹649 $\to$ ₹799; Cult.fit zombie subscription ₹1,499).
- `POST /api/v1/intelligence/anomalies/clear-test-data`: Cleans up seeded test anomalies.
- `POST /api/v1/intelligence/anomalies/dismiss`: Persists dismissed anomaly IDs in the user's profile.

### 12.3 Verification & Real-Data Testing
```bash
# 1. Seed Real-World Test Anomalies
curl -X POST http://localhost:8000/api/v1/intelligence/anomalies/seed-test-data \
  -H "Authorization: Bearer <TOKEN>"

# 2. Inspect Detected Anomalies
curl -X GET http://localhost:8000/api/v1/intelligence/anomalies \
  -H "Authorization: Bearer <TOKEN>"
# Verify: All 3 anomalies are identified with severity tags (High, Medium).

# 3. Dismiss an Anomaly by ID
curl -X POST http://localhost:8000/api/v1/intelligence/anomalies/dismiss \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"anomaly_id": "dup-amazon-prime-india"}'

# 4. Clear Test Data
curl -X POST http://localhost:8000/api/v1/intelligence/anomalies/clear-test-data \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 13. Multi-Channel Notification Engine (WhatsApp, Telegram & In-App)

### 13.1 Purpose & Architecture
Delivers timely financial updates to users on their everyday messaging platforms.

```
                           +-------------------------------------------------+
                           |      APScheduler Daily 8:00 AM Cron Engine      |
                           +------------------------+------------------------+
                                                    |
                                                    v
                           +-------------------------------------------------+
                           |       reminder_service.py Cashflow Guardian     |
                           |   - Overdue Bills & Due Today Calculations      |
                           |   - 7D / 14D Cashflow Overdraft Risk Forecaster |
                           |   - Daily Safe-to-Spend Allowance Calculation   |
                           +------------------------+------------------------+
                                                    |
                                                    v
                           +-------------------------------------------------+
                           |           notification_dispatcher.py            |
                           |     Routes message based on user preference     |
                           +--------+---------------+---------------+--------+
                                    |               |               |
             +----------------------+               |               +----------------------+
             v                                      v                                      v
+------------------------+             +------------------------+             +------------------------+
|        WHATSAPP        |             |        TELEGRAM        |             |         IN-APP         |
| Meta Cloud API v21.0 / |             | Telegram Bot API with  |             | Notification Bell &    |
| Twilio Webhook Copilot |             | Inline Action Buttons  |             | Floating Center Modal  |
+------------------------+             +------------------------+             +------------------------+
```

---

### 13.2 Telegram Bot Integration (`telegram_listener.py`)
- **Account Linking**: Deep-link token generated via `/api/v1/notifications/generate-telegram-link`. Users start the bot with `/start <token>` to securely bind their Telegram `chat_id` to their account.
- **Supported Commands**:
  - `/status`: Returns live financial health pulse, safe-to-spend allowance, and actionable bills with inline settlement buttons.
  - `/bills`: Displays pending dues with one-tap payment callback buttons.
  - `/radar`: Shows untracked recurring charges discovered by the AI radar, with one-tap "Track" buttons.
  - `/digest` or `/briefing`: Returns the Executive Financial Briefing with cash velocity and category leak analysis.
- **Natural Language Interaction**:
  - *"Paid electricity bill 1450 from HDFC"* $\to$ Marks bill paid and auto-records the expense.
  - *"Can I afford a ₹25,000 trip this weekend?"* $\to$ Runs affordability simulation and returns feasibility score.
  - *"Spent 350 on lunch at Subway"* $\to$ Logs expense under Food & Dining.
  - *"Got 65,000 freelance payment"* $\to$ Logs income under Freelance.
- **Multimodal Message Support**:
  - **Voice Notes**: Transcribes spoken audio and logs expenses or executes financial actions.
  - **Receipt Photos**: Runs Gemini Vision OCR to extract merchant, total, GST, and line items, logging the transaction directly to the ledger.

---

### 13.3 WhatsApp Integration (`whatsapp_service.py`)
- **Supported Providers**: Meta WhatsApp Cloud API (Graph API v21.0) and Twilio WhatsApp API.
- **Webhook Endpoint**: `POST /api/v1/webhook/whatsapp` handles inbound messages; `GET /api/v1/webhook/whatsapp` handles Meta verification challenge (`hub.mode`, `hub.verify_token`, `hub.challenge`).
- **Quick Reply Shortcuts**:
  - `PAY 1`, `PAY 2`: Settles the corresponding pending bill and updates the ledger.
  - `STATUS`: Returns the Daily Financial Pulse and daily safe-to-spend figure.
  - `BILLS`: Lists pending obligations.
  - `RADAR`: Returns detected untracked subscriptions.
  - Natural conversational financial queries powered by Gemini 2.5 Flash.

---

### 13.4 Verification & Real-Data Testing
```bash
# 1. Update Notification Preferences
curl -X PUT http://localhost:8000/api/v1/notifications/preferences \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "notification_channel": "both",
    "whatsapp_phone_number": "+919876543210",
    "preferred_briefing_time": "08:00"
  }'

# 2. Generate Telegram Linking Token
curl -X POST http://localhost:8000/api/v1/notifications/generate-telegram-link \
  -H "Authorization: Bearer <TOKEN>"
# Open the returned deep link (e.g. https://t.me/bot_name?start=a1b2c3d4) in Telegram and tap Start.

# 3. Trigger an Instant Test Alert to Telegram
curl -X POST http://localhost:8000/api/v1/notifications/test-telegram \
  -H "Authorization: Bearer <TOKEN>"

# 4. Trigger an Instant Test Alert to WhatsApp
curl -X POST http://localhost:8000/api/v1/notifications/test-whatsapp \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+919876543210"}'

# 5. Dispatch Daily Morning Pulse
curl -X POST http://localhost:8000/api/v1/reminders/trigger-briefing \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 14. AI Conversational Financial Copilot (Chat Studio with Tool Calling)

### 14.1 Purpose & Architecture
An interactive chat assistant embedded in the application (`/chat`), connected to backend data tools via Gemini 2.5 Flash function calling.

### 14.2 Connected Function-Calling Tools
1. `get_net_worth_tool`: Calculates real-time assets, debt liabilities, and net worth.
2. `get_upcoming_bills_tool`: Fetches all registered bills with due days and payment statuses.
3. `simulate_affordability_tool`: Checks discretionary purchase affordability against liquid cash and daily allowance.
4. `simulate_emi_purchase_tool`: Calculates EMI commitments, total interest, and impact on safe-to-spend allowance.
5. `simulate_loan_prepayment_tool`: Calculates interest and time saved from a lump-sum loan prepayment.
6. `simulate_loan_scenario_tool`: Simulates vehicle or asset loans.
7. `compare_debt_payoff_tool`: Compares Snowball vs Avalanche payoff strategies for active loans.
8. `check_anomalies_tool`: Inspects transactions for duplicates, price creep, and zombie subscriptions.
9. `calculate_tax_comparison_tool`: Calculates Old vs New tax regime liabilities and recommended options.
10. `convert_currency_tool`: Performs live multi-currency conversions.
11. `get_forex_rates_tool`: Returns live foreign exchange rates against INR.

### 14.3 Verification & Real-Data Testing
```bash
# Query the Chat Endpoint
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is my net worth right now, and what bills are coming up?"}'

# Verify Response:
# Assistant calls get_net_worth_tool and get_upcoming_bills_tool, returning an accurate summary based on live database values.
```

---

## 15. Global UX Utilities, Shortcuts & Minor Features

### 15.1 Global Privacy Mode (Frosted Glass Blur)
- **Shortcut**: `Alt + P`
- **Behavior**: Instantly applies a frosted CSS blur filter (`filter: blur(6px)`) over all financial amounts across all views, allowing safe usage in public or shared spaces.
- **Persistence**: Remembers setting across browser sessions using `localStorage` (`ai_advisor_privacy_mode`).

### 15.2 Global Command Palette (`Cmd + K` / `Ctrl + K`)
- Provides instant search and keyboard-driven navigation across all 10 application pages.
- Offers direct execution of quick actions:
  - Toggle Privacy Mode (`Alt + P`)
  - Log New Transaction (`/expenses?tab=log`)
  - Import Bank Statement (`/expenses?tab=import`)
  - Open Camera Receipt Scanner OCR
  - Open Voice-to-Ledger Audio Dictation
  - Calculate Tax Comparison (`/tax`)
  - Download Sunday Executive Briefing (`/reports`)
  - Switch Currency (INR, USD, EUR, GBP, AED, SGD, CAD, AUD, JPY)
  - Trigger Autonomous Agent Evaluation Cycle

### 15.3 Global Single-Key Hotkeys
- Press **`E`**: Opens the Expense logging screen.
- Press **`V`**: Launches the Voice-to-Ledger recording modal.
- Press **`S`**: Launches the Receipt Camera Scanner modal.
- Press **`A`**: Navigates directly to the AI Chat Advisor.
- *(Note: Hotkeys are disabled when typing within input fields, textareas, or modal inputs).*

### 15.4 Multi-Currency Conversion Engine (`currency-context.tsx`)
- Supports **INR (₹)**, **USD ($)**, **EUR (€)**, **GBP (£)**, **AED (AED)**, **SGD (S$)**, **CAD (C$)**, **AUD (A$)**, and **JPY (¥)**.
- Fetches real-time exchange rates with in-memory 6-hour caching and reliable offline fallbacks.
- Converts all displayed amounts dynamically when a different display currency is selected.

### 15.5 In-App Notification Center Bell (`notification-bell.tsx`)
- Animated bell icon in the dashboard top bar displaying an unread badge count for actionable alerts.
- Displays categorized notifications: Overdue Bills, Bills Due Today, Budget Warnings, and Cashflow Runways.
- One-click trigger to generate and dispatch the daily financial briefing.

### 15.6 Credit Score Bureau Gauge (`/credit`)
- Visual semi-circular SVG meter depicting scores from 300 to 900.
- Color-coded rating bands:
  - **Excellent**: $750-900$ (Emerald green)
  - **Good**: $700-749$ (Blue)
  - **Fair**: $650-699$ (Amber)
  - **Needs Attention**: $<650$ (Rose red)
- Historical tracking table for multiple bureaus (CIBIL, Experian, Equifax, CRIF High Mark).

### 15.7 Investment Portfolio Allocation (`/investments`)
- Interactive donut chart showing asset distribution across Equity, Debt, Mutual Funds, Gold, Real Estate, and Crypto.
- Calculates total invested capital, current valuation, absolute gains, and overall percentage return.

### 15.8 Financial Goal Milestone Tracker (`/goals`)
- Goal cards displaying target amounts, current savings progress, and visual completion bars.
- Automatic calculation of the remaining amount needed and sorting by target completion date.

---

## 16. Comprehensive Step-by-Step User Manual & Real-Data Verification Guide

This section is written as an **End-User Operational Manual**. Whether you are demonstrating the application, performing User Acceptance Testing (UAT), or training a new user, follow each scenario step-by-step. Each scenario specifies the exact page URL, on-screen buttons, form inputs, expected visual feedback, and mathematical validation criteria.

---

### Scenario 01: User Registration, Secure Login & Session Initialization
- **Objective / Purpose**: Establish a new tenant account with encrypted credentials and JWT session authentication.
- **Where to Navigate**: Open browser at `http://localhost:3000/register` (or click **"Sign Up"** on the login screen).
- **Step-by-Step User Action**:
  1. In the **Email Address** field, type a valid email: `alex.finance@example.com`.
  2. In the **Password** field, enter a secure password: `Password@123`.
  3. Click the blue **"Create Account"** button.
  4. Upon successful registration, you are automatically redirected to `http://localhost:3000/login`.
  5. Enter `alex.finance@example.com` and `Password@123`, then click **"Sign In"**.
- **Visual On-Screen Confirmation**:
  - The login card authenticates and redirects you to the main dashboard: `http://localhost:3000/dashboard`.
  - The top bar displays your user email badge and a green *"Active Session"* status indicator.
  - Initial KPI cards show clean zeroes (`₹0.00` Total Balance, `₹0.00` Net Worth).
- **Verification Criteria**:
  - Open Developer Tools (`F12` $\to$ **Application** $\to$ **Cookies** or **LocalStorage**).
  - Verify that `auth_token` or `access_token` contains a valid JWT string.
  - All subsequent API requests send the header `Authorization: Bearer <JWT_TOKEN>`.

---

### Scenario 02: Creating Bank Accounts & Setting Starting Balances
- **Objective / Purpose**: Establish real-world financial accounts (Savings accounts, Wallets, Cash in hand) with baseline balances to anchor the double-entry ledger.
- **Where to Navigate**: In the left navigation sidebar, click **"Expenses & Ledger"** $\to$ click the **"Accounts & Unified Ledger"** tab (URL: `http://localhost:3000/expenses?tab=accounts`).
- **Step-by-Step User Action**:
  1. Scroll to the **"Add New Account"** form card on the right side.
  2. In the **Account Name** field, type: `HDFC Salary Account`.
  3. In the **Account Type** dropdown, select: `Bank Account`.
  4. In the **Initial Balance (₹)** field, enter: `75000`.
  5. Click the blue **"Create Account"** button.
  6. Repeat steps 1–5 to add a second account:
     - Account Name: `ICICI Savings Account`
     - Account Type: `Bank Account`
     - Initial Balance: `25000`
- **Visual On-Screen Confirmation**:
  - A green notification toast appears: *"Account created successfully."*
  - The account grid instantly renders two card widgets:
    - **HDFC Salary Account**: Showing `₹75,000.00` initial balance.
    - **ICICI Savings Account**: Showing `₹25,000.00` initial balance.
- **Verification Criteria**:
  - Navigate back to **"Dashboard"** via the sidebar.
  - Verify that the **Total Liquid Balance** KPI card displays:
    $$\text{Total Balance} = ₹75,000 + ₹25,000 = ₹1,00,000.00$$

---

### Scenario 03: Logging Real Incomes with Multi-Account Attribution
- **Objective / Purpose**: Record salary, freelance earnings, or dividends with explicit account destination tracking.
- **Where to Navigate**: Left sidebar $\to$ **"Expenses & Ledger"** $\to$ click the **"Log Income / Expense"** tab (URL: `http://localhost:3000/expenses?tab=log`).
- **Step-by-Step User Action**:
  1. At the top of the logging card, click the **"Income"** tab toggle button (turns emerald green).
  2. In the **Date** field, select the 1st of the current month (e.g. `2026-09-01`).
  3. In the **Amount (₹)** field, enter: `140000`.
  4. In the **Category** dropdown, select: `Salary`.
  5. In the **Account** dropdown, select: `HDFC Salary Account`.
  6. In the **Description** field, enter: `Tech Corp Monthly Salary`.
  7. In the **Remarks** field, enter: `Base salary + monthly performance allowance`.
  8. Click the emerald green **"Record Income"** button.
- **Visual On-Screen Confirmation**:
  - Success banner appears: *"Income recorded successfully."*
  - Form fields reset to clean default values.
- **Verification Criteria**:
  - Click the **"Monthly Overview"** sub-tab (`/expenses?tab=monthly`).
  - Verify that **Total Inflow** displays `₹1,40,000.00`.
  - Navigate to **"Dashboard"**:
    $$\text{Total Balance} = ₹1,00,000 \text{ (Initial)} + ₹1,40,000 \text{ (Salary)} = ₹2,40,000.00$$

---

### Scenario 04: Setting Category Budgets & Manual Expense Logging
- **Objective / Purpose**: Establish monthly category spend guardrails and observe dynamic burn-rate and budget consumption visual indicators.
- **Step-by-Step User Action**:
  1. **Set Monthly Category Budgets**:
     - Navigate to **"Expenses & Ledger"** $\to$ click **"Category Budgets & Limits"** tab (`/expenses?tab=budgets`).
     - In the **Category** input, type or select: `Food & Dining`.
     - In the **Monthly Spend Limit (₹)** field, enter: `15000`.
     - Click **"Save Budget Limit"**.
     - Add a second budget: Category `Utilities & Bills`, Limit: `10000`.
  2. **Log Outflow Transactions**:
     - Click **"Log Income / Expense"** tab (`/expenses?tab=log`).
     - Ensure the **"Expense"** toggle is selected (blue/indigo).
     - **Transaction 1**: Date: Today, Amount: `3200`, Category: `Food & Dining`, Account: `HDFC Salary Account`, Description: `Weekend Family Dinner`. Click **"Record Expense"**.
     - **Transaction 2**: Date: Today, Amount: `1200`, Category: `Fuel & Transport`, Account: `HDFC Salary Account`, Description: `Shell Petrol Pump Fuel`. Click **"Record Expense"**.
- **Visual On-Screen Confirmation**:
  - Success toast confirms each logged expense.
  - Under **"Category Budgets & Limits"**, the `Food & Dining` bar shows:
    $$\frac{₹3,200}{₹15,000} = 21.3\% \text{ used (Green healthy indicator)}$$
- **Verification Criteria**:
  - In **Dashboard Overview**:
    - **Monthly Expenses KPI**: Displays `₹4,400.00`.
    - **Total Balance**: Drops from `₹2,40,000.00` to `₹2,35,600.00`.
    - **Category Breakdown Pie Chart**: Renders `Food & Dining` (72.7%) and `Fuel & Transport` (27.3%) slices.

---

### Scenario 05: Privacy Mode (Frosted Glass Blur) in Public Spaces
- **Objective / Purpose**: Mask sensitive financial balances with frosted blur for coffee shops, offices, or screen-sharing sessions.
- **Where to Navigate**: Any page in the application (Dashboard, Expenses, Loans, etc.).
- **Step-by-Step User Action**:
  1. On your keyboard, press **`Alt + P`** (or click the **Eye / Eye-Off** icon in the top header bar).
  2. Observe all numerical figures on the screen.
  3. Hover your mouse over any blurred number to verify temporary peak behavior.
  4. Press **`Alt + P`** again (or click the Eye icon).
- **Visual On-Screen Confirmation**:
  - Pressing `Alt + P` instantly applies a frosted glass blur (`filter: blur(6px)`) across all balances, net worth numbers, bank account balances, and table figures.
  - Hovering reveals a subtle tooltip: *"Privacy Mode Active (Alt+P to reveal)"*.
  - Pressing `Alt + P` a second time cleanly removes the blur effect.
- **Verification Criteria**:
  - Refresh the browser (`F5`).
  - Verify that the privacy state persists across page reloads via `localStorage` (`ai_advisor_privacy_mode`).

---

### Scenario 06: Global Command Palette (`Cmd + K` / `Ctrl + K`) Navigation & Shortcuts
- **Objective / Purpose**: Navigate across all 10 pages and trigger actions using purely keyboard commands.
- **Where to Navigate**: Any page in the application.
- **Step-by-Step User Action**:
  1. Press **`Ctrl + K`** (Windows) or **`Cmd + K`** (Mac).
  2. The dark Command Palette modal appears with an autofocus search bar.
  3. Type `Tax` in the input field.
  4. Use the arrow keys $\downarrow / \uparrow$ to highlight **"Tax Optimization Studio"** and press **Enter**.
  5. Press `Ctrl + K` again, type `Privacy`, and press **Enter** to toggle privacy mode.
  6. Press `Ctrl + K` again, type `USD`, and press **Enter** to switch application currency to US Dollars.
- **Visual On-Screen Confirmation**:
  - Instant modal appearance with smooth backdrop blur.
  - Hitting `Enter` immediately performs the action or transitions the page without full reload.
- **Verification Criteria**:
  - Selected actions take effect instantly; currency symbols change to `$` across cards, and navigation lands on the corresponding route.

---

### Scenario 07: Camera Receipt & Invoice OCR Scanner (Gemini Vision)
- **Objective / Purpose**: Scan paper receipts, digital bills, or supermarket invoices directly into ledger entries with itemized tax and line-item extraction.
- **Where to Navigate**: Anywhere in the app $\to$ press the **`S`** hotkey on your keyboard (or click the **Camera** icon in the floating bottom dock).
- **Step-by-Step User Action**:
  1. The **"Camera Receipt Scanner & OCR"** modal opens.
  2. Drag and drop any restaurant receipt, grocery bill, or fuel receipt image (JPEG, PNG, WebP) into the upload box (or click to browse).
  3. Ensure the toggle **"Auto-commit to ledger after scanning"** is switched **ON**.
  4. Select the payment account: `HDFC Salary Account`.
  5. Click the blue **"Scan & Extract Receipt"** button.
  6. Wait 2–4 seconds while Gemini 2.5 Flash Vision processes the image.
- **Visual On-Screen Confirmation**:
  - An animated scan-line sweeps across the receipt preview.
  - The modal updates with extracted metadata:
    - **Merchant**: e.g., *"Starbucks Coffee"* or *"D-Mart Supermarket"*.
    - **Total Amount**: Extracted exact numeric total.
    - **Tax / GST**: e.g., *"CGST 2.5% + SGST 2.5%"*.
    - **Line Items Breakdown**: Item names, quantities, and line totals.
  - A green checkmark confirms: *"Successfully parsed and logged to ledger!"*
- **Verification Criteria**:
  - Navigate to `/expenses?tab=monthly`.
  - Verify that the receipt merchant appears in the transaction table with the exact extracted total.
  - Verify that account balance drops by the receipt total.

---

### Scenario 08: Hands-Free Voice-to-Ledger Dictation (Gemini Audio)
- **Objective / Purpose**: Log transactions by speaking naturally without typing or navigating forms.
- **Where to Navigate**: Anywhere in the app $\to$ press the **`V`** hotkey on your keyboard (or click the **Mic** icon in the floating bottom dock).
- **Step-by-Step User Action**:
  1. The **"Voice-to-Ledger Audio Ingestion"** modal appears.
  2. Click the red **"Start Recording"** microphone button.
  3. Speak clearly into your microphone:
     > *"Spent 850 rupees on petrol at Shell using HDFC card"*
  4. Click the **"Stop & Process"** button.
  5. Gemini 2.5 Flash Audio transcribes your speech and parses the parameters.
- **Visual On-Screen Confirmation**:
  - Soundwave visualization ripples while recording.
  - The modal displays:
    - **Transcript**: *"Spent 850 rupees on petrol at Shell using HDFC card"*.
    - **Extracted Action**: Expense (`log_expense`).
    - **Amount**: `₹850.00`.
    - **Category**: `Fuel & Transport`.
    - **Merchant**: `Shell`.
    - **Spoken AI Response**: *"Logged ₹850 for Fuel at Shell on HDFC Salary Account."*
- **Verification Criteria**:
  - Check `/expenses?tab=monthly`: An expense of `₹850.00` under `Fuel & Transport` is present.
  - `Total Balance` decreases by `₹850.00`.

---

### Scenario 09: Universal Bank Statement Parsing (Encrypted PDF & Excel)
- **Objective / Purpose**: Bulk import an entire month or year of transactions from HDFC, SBI, ICICI, Axis, Kotak, or Amex statements.
- **Where to Navigate**: Left sidebar $\to$ **"Expenses & Ledger"** $\to$ click the **"Bank Statement Ingestion"** tab (`/expenses?tab=import`).
- **Step-by-Step User Action**:
  1. Under the upload area, click **"Select Statement File"** and choose your bank statement (PDF, `.xlsx`, `.xls`, or `.csv`). You can use the provided [dummy_statement.csv](file:///c:/Users/TamilselvanSubramani/personal-ai-advisor/dummy_statement.csv) for instant testing.
  2. If uploading an encrypted bank PDF, enter your bank password in the **"Statement Password (if encrypted)"** field (refer to on-screen hints for your bank, e.g., PAN number or DOB).
  3. Ensure **"Auto-create bank account if missing"** is checked.
  4. Leave **"Replace all existing transactions"** unchecked (to append) or check it if you want a clean import.
  5. Click the blue **"Upload & Process Statement"** button.
- **Visual On-Screen Confirmation**:
  - A progress spinner indicates parsing and auto-categorization.
  - A summary card appears:
    - *"Successfully ingested X incomes and Y expenses from HDFC Bank!"*
    - Total Credits (Inflow) and Total Debits (Outflow) are displayed.
    - AI Recurring Radar surfaces any repeating subscriptions found in the file.
- **Verification Criteria**:
  - Click **"Monthly Overview"** (`/expenses?tab=monthly`).
  - Verify that the imported transactions populate the table with categories (Food, Utilities, Fuel, Shopping, etc.) auto-assigned.

---

### Scenario 10: Bills Lifecycle Management & One-Click Settlement
- **Objective / Purpose**: Track recurring utility dues, verify overdue status classification, and execute one-click settlement that auto-creates an expense.
- **Where to Navigate**: Left sidebar $\to$ **"Bills & Subscriptions"** (URL: `http://localhost:3000/bills`).
- **Step-by-Step User Action**:
  1. **Add an Overdue Bill**:
     - In the **"Add Recurring Bill"** form, enter:
       - Bill Name: `Airtel Fiber Broadband`
       - Amount (₹): `1179`
       - Monthly Due Day: Enter **yesterday's date** (e.g., if today is the 11th, enter `10`).
     - Click **"Add Bill"**.
  2. **Add a Due-Today Bill**:
     - Bill Name: `Electricity Bill (BESCOM)`
     - Amount (₹): `2450`
     - Monthly Due Day: Enter **today's day** (e.g. `11`).
     - Click **"Add Bill"**.
  3. **Inspect Lifecycle Cards**:
     - Observe the **"Overdue Bills"** section at the top of the page.
     - Observe the **"Due Today"** section.
  4. **Execute One-Click Settlement**:
     - Locate the `Airtel Fiber Broadband` card under Overdue Bills.
     - Click the green **"Settle (₹1,179)"** button.
- **Visual On-Screen Confirmation**:
  - The `Airtel Fiber Broadband` card shifts from the red Overdue section to the green **"Settled Bills"** section at the bottom.
  - Status badge changes to *"Paid"*.
  - A confetti explosion triggers on screen celebrating the cleared obligation.
- **Verification Criteria**:
  - Navigate to `/expenses?tab=monthly`.
  - Look at the top of the transactions table: A new expense record of **`₹1,179.00`** has been **automatically inserted** under category `Utilities & Bills` with description `Settled Bill: Airtel Fiber Broadband`.
  - Check dashboard **Uncommitted Balance**: It increases because this commitment has transitioned from pending liability to settled ledger expense.

---

### Scenario 11: AI Recurring Subscription Auto-Discovery Radar
- **Objective / Purpose**: Automatically detect repeating recurring subscriptions from unmonitored bank transactions and promote them to tracked bills with 1 click.
- **Where to Navigate**: Left sidebar $\to$ **"Bills & Subscriptions"** (URL: `http://localhost:3000/bills`).
- **Step-by-Step User Action**:
  1. Scroll down to the **"AI Recurring Subscription Auto-Discovery Radar"** section.
  2. (If no recurring charges exist yet, log two expenses of `₹649` for `Netflix` 30 days apart, or upload a statement).
  3. The radar surfaces discovered candidates, e.g.:
     - **Merchant**: `Netflix Premium 4K`
     - **Estimated Monthly Amount**: `₹649.00`
     - **Detected Due Day**: Day `15`
     - **Confidence Score**: `95% (High)`
  4. Click the purple **"Track This Subscription"** button next to Netflix.
- **Visual On-Screen Confirmation**:
  - A success toast confirms: *"Subscribed bill tracked successfully."*
  - The subscription disappears from the Radar and is immediately added to your active **Bills & Commitments** list with calendar reminders.
- **Verification Criteria**:
  - Check the active bills table on `/bills`: `Netflix Premium 4K` is now listed with Due Day 15.
  - It will now factor into your **Daily Safe-to-Spend** calculation.

---

### Scenario 12: Loans, Mathematical Amortization & Debt Payoff Matrix
- **Objective / Purpose**: Track liabilities, calculate exact monthly EMIs, and compare Snowball vs. Avalanche payoff strategies with extra prepayment.
- **Where to Navigate**: Left sidebar $\to$ **"Loans & Debt Engine"** (URL: `http://localhost:3000/loans`).
- **Step-by-Step User Action**:
  1. **Add Two Loans**:
     - Loan 1: Bank Name: `HDFC Car Loan`, Principal: `450000`, Interest Rate (%): `8.75`, Tenure (Months): `48`. Click **"Add Loan"**.
     - Loan 2: Bank Name: `ICICI Personal Loan`, Principal: `120000`, Interest Rate (%): `14.5`, Tenure (Months): `24`. Click **"Add Loan"**.
  2. **Inspect Amortization Cards**:
     - HDFC Car Loan card calculates exact monthly EMI:
       $$\text{EMI} \approx ₹11,150/\text{month}$$
     - ICICI Personal Loan card calculates:
       $$\text{EMI} \approx ₹5,790/\text{month}$$
  3. **Simulate Debt Payoff Matrix**:
     - Scroll down to the **"Debt Payoff Strategy Matrix (Snowball vs. Avalanche)"** card.
     - Locate the **"Extra Monthly Prepayment"** slider.
     - Drag the slider from `₹0` to `₹7,500/month`.
- **Visual On-Screen Confirmation**:
  - The comparison matrix recalculates instantly:
    - **Snowball Strategy**: Prioritizes paying off the ₹1,20,000 Personal Loan first. Shows debt-free date brought forward by X months.
    - **Avalanche Strategy**: Prioritizes the 14.5% interest rate. Shows total interest saved: e.g. *"Saves ₹34,200 in interest and knocks 14 months off debt timeline"*.
    - Visual timeline chart plots baseline balance reduction vs accelerated payoff.
- **Verification Criteria**:
  - Check mathematical verification: Avalanche total interest paid is strictly less than Snowball total interest paid due to higher interest rate prioritization.

---

### Scenario 13: Decision Intelligence What-If Scenario Sandbox
- **Objective / Purpose**: Test major life decisions (buying a car, taking a career sabbatical, boosting monthly SIPs) before committing real funds.
- **Where to Navigate**: Left sidebar $\to$ **"Dashboard Overview"** $\to$ click the **"What-If Sandbox"** tab toggle (or scroll to the Scenario Sandbox card).
- **Step-by-Step User Action**:
  1. **Test Scenario 1: Financed Car Loan**:
     - Click the **"Car Loan"** tab.
     - Loan Amount: `₹12,00,000`.
     - Down Payment: `₹2,00,000`.
     - Interest Rate: `8.5%`.
     - Tenure: `60 months`.
     - Click **"Simulate Scenario"**.
     - Observe: Feasibility Score, DTI ratio, and 5-year balance trajectory.
  2. **Test Scenario 2: Career Sabbatical / Income Pause**:
     - Click the **"Career Sabbatical"** tab.
     - Sabbatical Duration: `6 months`.
     - Income Replacement: `0%` (complete career pause).
     - Discretionary Expense Cut: `25%`.
     - Click **"Simulate Scenario"**.
     - Observe: Required liquid reserve, runway exhaustion month, and remaining investment cushion.
  3. **Test Scenario 3: SIP Wealth Accelerator**:
     - Click the **"SIP Wealth Boost"** tab.
     - Additional Monthly SIP: `₹10,000`.
     - Expected CAGR: `12%`.
     - Horizon: `10 years`.
     - Click **"Simulate Scenario"**.
     - Observe: Total invested (`₹12 Lakhs`) vs Future Wealth Created (`~₹23.2 Lakhs`).
- **Visual On-Screen Confirmation**:
  - Circular Feasibility Gauge changes color: Green (Low Risk, $\ge 75$), Yellow (Moderate Risk, $50-74$), Red (High Risk, $<50$).
  - Dynamic narrative summary explains the impact on your daily safe-to-spend allowance.
- **Verification Criteria**:
  - The sabbatical simulator accounts for your actual active bills and loan EMIs stored in the database.

---

### Scenario 14: Indian Income Tax Regime Optimization Studio (FY 2024–25 & FY 2025–26)
- **Objective / Purpose**: Calculate side-by-side tax liabilities under Union Budget 2024 revisions, compute HRA exemptions, and identify the exact break-even deduction gap.
- **Where to Navigate**: Left sidebar $\to$ **"Tax Optimization"** (URL: `http://localhost:3000/tax`).
- **Step-by-Step User Action**:
  1. In the **Gross Annual Salary (CTC)** field, enter: `1500000` (₹15 Lakhs).
  2. In the **Basic Salary** field, enter: `750000`.
  3. In the **HRA Received** field, enter: `300000`.
  4. In the **Annual Rent Paid** field, enter: `300000`.
  5. Select **City of Residence**: `Metro (50% Basic Allowance)`.
  6. Fill in Chapter VI-A Deductions:
     - **Section 80C**: `150000`
     - **Section 80D (Self & Family)**: `25000`
     - **Section 80D (Parents - Senior Citizen)**: Check the Senior Citizen toggle and enter `50000`
     - **Section 80CCD(1B) NPS**: `50000`
     - **Section 24(b) Home Loan Interest**: `180000`
  7. Click the purple **"Calculate Tax Comparison"** button.
- **Visual On-Screen Confirmation**:
  - A recommendation banner appears at the top:
    - e.g., *"Old Tax Regime is Recommended! You will save ₹42,640 per year."*
  - **Side-by-Side Matrix Cards**:
    - **Old Regime Card**: Gross Income, Standard Deduction (₹50,000), HRA Exemption (₹2,25,000), Total Deductions, Slabs Breakdown, Cess (4%), Net Tax.
    - **New Regime Card**: Gross Income, Standard Deduction (₹75,000 - Budget 2024), 6 Revised Slabs, Cess (4%), Net Tax.
  - **Break-Even Radar Card**: Displays the exact deduction gap needed if the user wants to evaluate whether switching regimes is worthwhile.
  - Click **"Save to My Tax Profile"** to persist these inputs to your tenant profile.
- **Verification Criteria**:
  - **HRA Exemption Formula**:
    $$\text{Exemption} = \min(₹3,00,000, ₹3,00,000 - (0.10 \times ₹7,50,000), 0.50 \times ₹7,50,000)$$
    $$= \min(₹3,00,000, ₹2,25,000, ₹3,75,000) = ₹2,25,000.00$$
  - Verify that the Old Regime taxable income subtracts exactly ₹2,25,000 HRA exemption.

---

### Scenario 15: Weekly Executive Financial Briefing & Standalone HTML Report
- **Objective / Purpose**: View high-level weekly velocity and download a print-ready executive report.
- **Where to Navigate**: Left sidebar $\to$ **"Executive Reports"** (URL: `http://localhost:3000/reports`).
- **Step-by-Step User Action**:
  1. The page loads your **Weekly Executive Financial Briefing**.
  2. Inspect the **Cash Velocity Meter**:
     - 7-Day Inflow vs 7-Day Outflow.
     - Net Weekly Cashflow.
     - Week-over-Week (WoW) change percentage.
  3. Inspect the **Category Leak Radar**:
     - Checks if any spending category exceeded 30% above its 4-week historical weekly baseline.
  4. Inspect the **Upcoming 7-Day Horizon**:
     - Shows bills due and projected liquidity balance.
  5. Read the **AI Executive Pro-Tip** generated by Gemini 2.5 Flash.
  6. Click the blue **"Download Executive Briefing (HTML)"** button in the top right.
- **Visual On-Screen Confirmation**:
  - Browser downloads a file named `Executive_Briefing_YYYYMMDD.html`.
  - Open the file in Chrome, Edge, or Firefox.
- **Verification Criteria**:
  - The downloaded file renders a clean, standalone, responsive executive report with CSS styling, cards, and print styles (`@media print`) without needing internet or external assets.

---

### Scenario 16: Autonomous Financial Agent ("The Ghost Accountant") Policies
- **Objective / Purpose**: Enable autonomous financial rules and verify proactive sweep and budget breach logging.
- **Where to Navigate**: Left sidebar $\to$ **"Dashboard Overview"** $\to$ scroll down to the **"Autonomous Financial Agent"** card widget.
- **Step-by-Step User Action**:
  1. In the Autonomous Agent card, toggle **Auto-Sweep Idle Cash** to **ON**.
     - Set Buffer Threshold: `₹50,000`.
     - Destination: `Emergency Cushion Fund (7.1% yield)`.
  2. Toggle **Budget Guardrails** to **ON** (Warning at 80%, Critical at 100%).
  3. Toggle **Round-Up Micro-Savings** to **ON** (Round-up step: `₹50`).
  4. Click the purple **"Run Real-Time Agent Cycle"** button.
- **Visual On-Screen Confirmation**:
  - A loading spinner evaluates all accounts, budgets, and transactions.
  - The **Audit Trail Action Log** updates:
    - **Auto-Sweep Action**: If liquid balance is e.g. `₹2,34,750`, it logs a simulated sweep recommendation: *"Surplus of ₹1,84,750 detected above ₹50,000 safety threshold. Sweeping to Emergency Cushion Fund generates ~₹13,117/yr in passive yield."*
    - **Round-Up Action**: Displays spare-change accrued from dining/fuel purchases and projects 5-year compounding returns.
  - Click the **"Dismiss"** button on any action log to verify that it marks the action as dismissed.
- **Verification Criteria**:
  - Audit trail entries persist in the database (`autonomous_action_logs` table) with status `active` or `dismissed`.

---

### Scenario 17: Anomaly Guardian & Zombie Subscription Radar
- **Objective / Purpose**: Test automatic detection of accidental duplicate charges, stealth price hikes, and recurring zombie subscriptions.
- **Where to Navigate**: Left sidebar $\to$ **"Dashboard Overview"** $\to$ scroll to the **"Anomaly & Fraud Guardian"** card widget.
- **Step-by-Step User Action**:
  1. Click the amber **"Seed Test Anomalies"** button on the card.
  2. The system injects 3 real-world test cases:
     - **Duplicate Charge**: Two ₹1,499 charges from `Amazon Prime India` within 24 hours.
     - **Price Creep**: `Netflix Premium 4K` increasing from ₹649 to ₹799 (+23%).
     - **Zombie Subscription**: `Cult.fit Gym` billing ₹1,499 every month for 3 consecutive months.
  3. Review the populated anomaly cards with severity tags (**HIGH**, **MEDIUM**).
  4. Click the **"Dismiss Alert"** button on the duplicate charge card.
  5. Click the **"Clear Test Data"** button when testing is finished.
- **Visual On-Screen Confirmation**:
  - Clicking Seed immediately updates the Anomaly badge from 0 to 3.
  - Dismissing an alert removes it from the active display and records the ID in profile settings.
  - Clearing test data removes all test records and resets the badge count.
- **Verification Criteria**:
  - Query `/api/v1/intelligence/anomalies`: Only non-dismissed anomalies are returned.

---

### Scenario 18: Multi-Channel Setup: Connecting Telegram via 1-Click Deep Link
- **Objective / Purpose**: Connect your personal Telegram account to receive daily briefings, overdue warnings, and one-tap payment buttons.
- **Where to Navigate**: Click the **Notification Bell** icon in the dashboard top bar $\to$ click the **Settings (Gear)** icon (or select the **"Channels"** tab).
- **Step-by-Step User Action**:
  1. In the **"Notification Channels & Preferences"** modal, select the **"Telegram"** tab.
  2. Click the blue **"Generate Telegram Connect Link"** button.
  3. The system generates a secure, one-time deep link: e.g. `https://t.me/tamil_finance_agent_bot?start=a1b2c3d4`.
  4. Click **"Open Telegram"** (or scan the QR code with your mobile phone).
  5. In Telegram, tap the **"START"** button at the bottom of the bot chat window.
- **Visual On-Screen Confirmation**:
  - The Telegram bot replies instantly:
    > *"🎉 Telegram Connected Successfully! Your account is now linked to your Personal AI Financial Advisor. You will receive your 8:00 AM Morning Pulse and due reminders right here."*
  - On the web modal, the Telegram status pill switches from gray to an emerald green badge: **"Connected"** showing your Telegram Chat ID.
- **Verification Criteria**:
  - Click the **"Send Live Test Alert"** button in the Telegram tab of the web modal.
  - Check Telegram: An immediate test alert arrives with confirmation text and emoji styling.

---

### Scenario 19: Telegram Bot Natural Language Financial Commands
- **Objective / Purpose**: Manage finances directly within Telegram using natural language or quick commands.
- **Where to Navigate**: Open your linked chat with `@tamil_finance_agent_bot` in Telegram.
- **Step-by-Step User Action**:
  1. **Check Live Status**: Type `/status` and send.
     - Bot returns your net worth, liquid cash, daily safe-to-spend allowance, and overdue bills with inline buttons.
  2. **View Pending Obligations**: Type `/bills` and send.
     - Bot lists all unpaid bills with one-tap payment callback buttons.
  3. **One-Tap Settle via Inline Button**: Tap the **"✅ Settle Bill"** button directly beneath any bill in the Telegram message.
     - Bot answers callback and sends updated confirmation: *"Bill Settled & Recorded in Ledger!"*
  4. **Natural Language Bill Settlement**: Type:
     > *"paid electricity bill 2450"*
     - Bot matches your BESCOM Electricity bill, marks it Paid, and logs the expense.
  5. **Natural Language What-If Query**: Type:
     > *"Can I afford a ₹35,000 holiday this weekend?"*
     - Bot analyzes your liquid balance and days left in cycle, returning a feasibility score and daily safe-to-spend impact.
  6. **Voice Note / Photo Receipt Ingestion**:
     - Record and send an audio voice note: *"Spent 250 on coffee"*.
     - Or take a photo of a restaurant paper bill and send it as an image.
- **Visual On-Screen Confirmation**:
  - Bot transcribes voice notes or executes OCR on photos, confirming logged expenses.
  - Refresh your Web dashboard: Transactions logged via Telegram appear in the ledger immediately.

---

### Scenario 20: WhatsApp Financial Copilot (Meta Cloud API / Twilio)
- **Objective / Purpose**: Interact with your advisor over WhatsApp with quick reply options.
- **Where to Navigate**: Notification Channel Modal $\to$ **"WhatsApp"** tab.
- **Step-by-Step User Action**:
  1. Enter your phone number with country code: e.g. `+919876543210`.
  2. Ensure Notification Channel is set to **"Both"** or **"WhatsApp"**.
  3. Click **"Save Preferences"**.
  4. Click **"Send Live Test Message"** to verify webhook dispatch.
  5. In your WhatsApp conversation with the business number, test the following messages:
     - Send: `STATUS` $\to$ Bot returns morning pulse, liquid balance, and daily allowance.
     - Send: `BILLS` $\to$ Bot returns pending obligations numbered 1, 2, 3...
     - Send: `PAY 1` $\to$ Bot settles Bill #1 and logs the expense to the ledger.
     - Send: `RADAR` $\to$ Bot lists discovered untracked subscriptions with quick `TRACK 1` options.
     - Send: *"Spent 400 on movie tickets"* $\to$ Gemini 2.5 Flash logs the expense under Entertainment.
- **Visual On-Screen Confirmation**:
  - Structured WhatsApp formatting with bold headers, bullet points, and quick reply buttons.
- **Verification Criteria**:
  - Web dashboard reflects transactions logged via WhatsApp in real time.

---

### Scenario 21: Embedded AI Financial Copilot Chat Studio (`/chat`)
- **Objective / Purpose**: Query your financial database conversationally with Gemini 2.5 Flash function-calling tools.
- **Where to Navigate**: Left sidebar $\to$ **"AI Financial Chat"** (URL: `http://localhost:3000/chat`).
- **Step-by-Step User Action**:
  1. Type the following prompt into the chat bar:
     > *"What is my current net worth and how much total debt do I have?"*
  2. Press **Enter** (or click Send).
  3. Type a What-If planning prompt:
     > *"What happens if I buy a ₹90,000 laptop on a 6-month zero-cost EMI?"*
  4. Type a tax question:
     > *"Under FY 2024-25 rules, which tax regime saves me more money?"*
- **Visual On-Screen Confirmation**:
  - Animated thinking indicator while Gemini calls tools:
    - Calls `get_net_worth_tool` to retrieve live numbers.
    - Calls `simulate_emi_purchase_tool` to compute monthly payments and daily allowance impact.
    - Calls `calculate_tax_comparison_tool` to compute Old vs New regime calculations.
  - Answers are authoritative, concise, and grounded in your database records.
- **Verification Criteria**:
  - The assistant quotes exact numbers matching your current Dashboard KPI cards.

---

### Scenario 22: Multi-Currency Global Conversion Engine
- **Objective / Purpose**: View financial metrics in foreign currencies (USD, EUR, GBP, AED, SGD, CAD, AUD, JPY) using real-time forex exchange rates.
- **Where to Navigate**: Top bar $\to$ click the **Currency Selector** dropdown (displays flag and symbol, e.g. `🇮🇳 INR ₹`).
- **Step-by-Step User Action**:
  1. Click the Currency dropdown in the top header.
  2. Select **`🇺🇸 USD ($)`**.
  3. Observe all values across Dashboard KPI cards, transaction tables, and charts.
  4. Click the Currency dropdown and select **`🇪🇺 EUR (€)`**.
  5. Select **`🇦🇪 AED (AED)`**.
  6. Return to **`🇮🇳 INR (₹)`**.
- **Visual On-Screen Confirmation**:
  - All currency symbols update instantly.
  - Numerical values are divided by the live exchange rate (e.g. ₹86.95 per USD).
  - Formatting respects regional conventions (commas and decimal places).
- **Verification Criteria**:
  - If Total Balance is ₹2,40,000 and exchange rate is ₹86.95/USD, the balance card displays:
    $$\frac{₹2,40,000}{86.95} \approx \$2,760.21$$

---

### Scenario 23: Investment Portfolio Asset Allocation & Returns
- **Objective / Purpose**: Track asset distribution and evaluate overall portfolio gains.
- **Where to Navigate**: Left sidebar $\to$ **"Investments Portfolio"** (URL: `http://localhost:3000/investments`).
- **Step-by-Step User Action**:
  1. In the **"Add Investment Holding"** form, enter:
     - Investment Name: `Nifty 50 Index Mutual Fund`
     - Asset Category: `Mutual Funds`
     - Invested Amount (₹): `100000`
     - Current Market Value (₹): `118500`
     - Click **"Add Holding"**.
  2. Add a second holding:
     - Name: `Sovereign Gold Bond (SGB)`
     - Category: `Gold & Commodities`
     - Invested Amount (₹): `50000`
     - Current Market Value (₹): `56000`
     - Click **"Add Holding"**.
- **Visual On-Screen Confirmation**:
  - Total Portfolio Value displays: `₹1,74,500.00`.
  - Absolute Gain displays: `+₹24,500.00` with an emerald badge showing `+16.33%`.
  - The Donut Chart renders proportional slices: Mutual Funds (67.9%) and Gold (32.1%).
- **Verification Criteria**:
  - Navigate to **"Dashboard"**: Total Investments card reflects `₹1,74,500.00`, and Net Worth recalculates accordingly.

---

### Scenario 24: Credit Score Bureau Health Tracker
- **Objective / Purpose**: Monitor credit rating history and visualize standing on the semi-circular bureau gauge.
- **Where to Navigate**: Left sidebar $\to$ **"Credit Score & Health"** (URL: `http://localhost:3000/credit`).
- **Step-by-Step User Action**:
  1. In the **"Update Credit Score"** form, enter:
     - Credit Score (300–900): `785`
     - Bureau: `CIBIL`
     - Assessment Date: Today's date
  2. Click the blue **"Save Credit Score"** button.
- **Visual On-Screen Confirmation**:
  - The semi-circular SVG gauge needle animates to `785 / 900`.
  - The rating pill displays an emerald green badge: **"Excellent"**.
  - Historical line chart plots the score over time.
- **Verification Criteria**:
  - Entering a score $<650$ flags the rating pill as Rose Red **"Needs Attention"**.
  - Dashboard Overview reflects the latest CIBIL credit score badge.

---

### Scenario 25: Account Balance Reconciliation & Manual Adjustments
- **Objective / Purpose**: Correct physical cash discrepancies or untracked interest credits without modifying historical transaction entries.
- **Where to Navigate**: Left sidebar $\to$ **"Expenses & Ledger"** $\to$ click **"Accounts & Unified Ledger"** (`/expenses?tab=accounts`).
- **Step-by-Step User Action**:
  1. Locate the **"Balance Adjustments & Reconciliation"** section on the page.
  2. Select Account: `HDFC Salary Account`.
  3. Enter Adjustment Amount (₹): `+150` (or `-200` if cash is missing).
  4. Reason: `Bank quarterly savings account interest credit`.
  5. Click **"Apply Adjustment"**.
- **Visual On-Screen Confirmation**:
  - Adjustment appears in the audit list.
  - HDFC Account card balance increases by exactly ₹150.00.
- **Verification Criteria**:
  - Verify liquid balance formula updates by adding the balance adjustment value.

---

### Scenario 26: Commercial SaaS Subscription Upgrade & Webhook Verification
- **Objective / Purpose**: Validate Razorpay checkout integration and automatic account status transitions.
- **Where to Navigate**: Click user profile $\to$ **"Billing & Subscription"** (URL: `http://localhost:3000/billing`).
- **Step-by-Step User Action**:
  1. The page displays the current plan status (e.g. *"Inactive / Free Trial"*).
  2. Click the **"Upgrade to Pro"** button.
  3. Razorpay Checkout modal appears showing the Pro monthly plan price.
  4. In test mode, enter Razorpay test card credentials (or use UPI simulation).
  5. Complete payment.
- **Visual On-Screen Confirmation**:
  - Webhook triggers `subscription.activated` on backend.
  - Subscription status badge switches to emerald green: **"Active"**.
  - All gated endpoints grant full access.

---

### Scenario 27: System Clean State Reset (Developer / Admin Tool)
- **Objective / Purpose**: Reset database to clean factory defaults before running a fresh demonstration.
- **Execution**: Run via cURL or API client:
  ```bash
  curl -X POST http://localhost:8000/api/v1/system/reset-db \
    -H "Authorization: Bearer <TOKEN>"
  ```
- **Visual Confirmation**: Returns `{"message": "All database tables dropped and cleanly re-created from models.py."}`. All accounts, expenses, and loans are reset to clean zero states.

