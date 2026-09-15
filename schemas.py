from typing import List, Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID


# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Subscription Schemas ---
class SubscriptionResponse(BaseModel):
    id: int
    tenant_id: UUID
    razorpay_customer_id: Optional[str] = None
    razorpay_subscription_id: Optional[str] = None
    plan_id: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

# --- Expense Schemas ---
class ExpenseCreate(BaseModel):
    date: str
    description: str
    amount: float
    category: str
    account: Optional[str] = "ICICI Savings Account"
    remarks: Optional[str] = None


class BulkExpenseCreate(BaseModel):
    expenses: List[ExpenseCreate]
    replace_all: Optional[bool] = False


# --- Income Schemas ---
class IncomeCreate(BaseModel):
    date: str
    category: str
    amount: float
    account: Optional[str] = "ICICI Savings Account"
    description: Optional[str] = None
    remarks: Optional[str] = None


class BulkIncomeCreate(BaseModel):
    incomes: List[IncomeCreate]
    replace_all: Optional[bool] = False


# --- Account & Balance Schemas ---
class AccountCreate(BaseModel):
    name: str
    account_type: Optional[str] = "Bank Account"
    initial_balance: Optional[float] = 0.0


class BalanceAdjustmentCreate(BaseModel):
    date: str
    account: str
    amount: float
    reason: Optional[str] = None


# --- Budget Schemas ---
class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float


# --- Loan Schemas ---
class LoanCreate(BaseModel):
    name: Optional[str] = "Loan"
    bank_name: Optional[str] = None
    principal: float
    sanctioned_amount: Optional[float] = None
    interest_rate: Optional[float] = 0.0
    tenure_years: Optional[float] = 0.0
    tenure_months: Optional[int] = None
    start_date: Optional[str] = None
    extra_prepayment: Optional[float] = 0.0
    emi: Optional[float] = None


# --- Investment Schemas ---
class InvestmentCreate(BaseModel):
    name: str
    current_value: float
    invested_amount: Optional[float] = 0.0
    category: Optional[str] = "Equity"
    type: Optional[str] = None
    asset_type: Optional[str] = None


# --- Goal Schemas ---
class GoalCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: Optional[float] = 0.0
    target_date: Optional[str] = None


# --- Bill Schemas ---
class BillCreate(BaseModel):
    name: str
    amount: float
    due_day: Optional[int] = 1
    due_date: Optional[str] = None
    status: Optional[str] = "Pending"
    frequency: Optional[str] = "Monthly"
    category: Optional[str] = "Utilities"


class BillSettleRequest(BaseModel):
    auto_log_expense: Optional[bool] = True
    account: Optional[str] = "ICICI Savings Account"
    category: Optional[str] = "Utilities"
    payment_date: Optional[str] = None


class DiscoveredBillAcceptRequest(BaseModel):
    name: str
    amount: float
    due_day: Optional[int] = 1
    category: Optional[str] = "Utilities"


# --- Credit Score Schemas ---
class CreditScoreCreate(BaseModel):
    score: int
    date: str
    rating: Optional[str] = "Good"
    bureau: Optional[str] = None
    agency: Optional[str] = None


# --- Profile Schemas ---
class ProfileUpdate(BaseModel):
    key: str
    value: str


# --- AI Chat Schema ---
class ChatRequest(BaseModel):
    message: str


# --- Phase 2: Decision Intelligence & Scenario Schemas ---
class ScenarioSimulationRequest(BaseModel):
    scenario_type: str  # "car_loan", "sabbatical", "sip_boost"
    # Car loan params
    loan_amount: Optional[float] = 1200000.0
    down_payment: Optional[float] = 200000.0
    annual_interest_rate: Optional[float] = 8.5
    tenure_months: Optional[int] = 60
    # Sabbatical params
    sabbatical_months: Optional[int] = 6
    income_replacement_pct: Optional[float] = 0.0
    discretionary_cut_pct: Optional[float] = 0.20
    # SIP boost params
    additional_sip: Optional[float] = 5000.0
    expected_cagr_pct: Optional[float] = 12.0
    expense_cut: Optional[float] = 0.0
    horizon_years: Optional[int] = 10


class DebtPayoffMatrixRequest(BaseModel):
    extra_monthly: Optional[float] = 0.0


class AnomalyDismissRequest(BaseModel):
    anomaly_id: str


# --- Phase 4: Wealth Mastery & Autonomous Agent Schemas ---
class TaxCalculationRequest(BaseModel):
    gross_salary: float
    basic_salary: Optional[float] = None
    hra_received: Optional[float] = 0.0
    rent_paid: Optional[float] = 0.0
    is_metro: Optional[bool] = True
    section_80c: Optional[float] = 0.0
    section_80d_self: Optional[float] = 0.0
    section_80d_parents: Optional[float] = 0.0
    parents_senior_citizen: Optional[bool] = False
    section_80ccd_1b: Optional[float] = 0.0
    section_24b: Optional[float] = 0.0
    other_deductions: Optional[float] = 0.0
    financial_year: Optional[str] = "2024-2025"


class TaxProfileUpdate(BaseModel):
    gross_salary: Optional[float] = 1200000.0
    basic_salary: Optional[float] = 600000.0
    hra_received: Optional[float] = 240000.0
    rent_paid: Optional[float] = 240000.0
    is_metro: Optional[bool] = True
    section_80c: Optional[float] = 150000.0
    section_80d_self: Optional[float] = 25000.0
    section_80d_parents: Optional[float] = 25000.0
    parents_senior_citizen: Optional[bool] = False
    section_80ccd_1b: Optional[float] = 50000.0
    section_24b: Optional[float] = 0.0
    other_deductions: Optional[float] = 0.0
    financial_year: Optional[str] = "2024-2025"
    preferred_regime: Optional[str] = "auto"


class TaxProfileResponse(BaseModel):
    id: int
    tenant_id: UUID
    financial_year: str
    gross_salary: float
    basic_salary: float
    hra_received: float
    rent_paid: float
    is_metro: bool
    section_80c: float
    section_80d_self: float
    section_80d_parents: float
    parents_senior_citizen: bool
    section_80ccd_1b: float
    section_24b: float
    other_deductions: float
    preferred_regime: str

    class Config:
        from_attributes = True


class AutonomousRuleConfig(BaseModel):
    rule_type: str  # auto_sweep, budget_guardrail, round_up
    is_enabled: bool = True
    config: dict = {}


class AutonomousActionDismissRequest(BaseModel):
    action_id: int


class NotificationPreferencesResponse(BaseModel):
    notification_channel: str = "both"
    whatsapp_phone_number: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_connected: bool = False
    whatsapp_connected: bool = False
    preferred_briefing_time: str = "08:00"
    telegram_bot_username: Optional[str] = None
    telegram_connect_url: Optional[str] = None


class NotificationPreferencesUpdate(BaseModel):
    notification_channel: Optional[str] = None
    whatsapp_phone_number: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    preferred_briefing_time: Optional[str] = "08:00"


class TestNotificationRequest(BaseModel):
    channel: str = "whatsapp"  # "whatsapp" or "telegram"
    recipient: Optional[str] = None

