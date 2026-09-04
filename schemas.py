from typing import List, Optional
from pydantic import BaseModel


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
    description: Optional[str] = None
    remarks: Optional[str] = None


# --- Budget Schemas ---
class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float


# --- Loan Schemas ---
class LoanCreate(BaseModel):
    name: Optional[str] = "Loan"
    principal: float
    interest_rate: Optional[float] = 0.0
    tenure_years: Optional[float] = 0.0
    extra_prepayment: Optional[float] = 0.0


# --- Investment Schemas ---
class InvestmentCreate(BaseModel):
    name: str
    current_value: float
    category: Optional[str] = "Equity"


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
    due_day: int
    status: Optional[str] = "Pending"


# --- Credit Score Schemas ---
class CreditScoreCreate(BaseModel):
    score: int
    date: str
    rating: Optional[str] = "Good"


# --- Profile Schemas ---
class ProfileUpdate(BaseModel):
    key: str
    value: str


# --- AI Chat Schema ---
class ChatRequest(BaseModel):
    message: str