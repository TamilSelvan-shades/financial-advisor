from pydantic import BaseModel, Field
from typing import List, Optional

# --- Expense Schemas ---
class ExpenseCreate(BaseModel):
    date: str
    description: str = Field(..., min_length=2, max_length=255)
    amount: float = Field(..., gt=0)
    category: str

class BulkExpenseCreate(BaseModel):
    expenses: List[ExpenseCreate]
    replace_all: bool = False

# --- Other Financial Entities ---
class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float

class InvestmentCreate(BaseModel):
    name: str
    asset_type: str
    invested_amount: float
    current_value: float
    institution: str

class GoalCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: float
    target_date: str
    category: str

class BillCreate(BaseModel):
    name: str
    amount: float
    due_day: int
    category: str
    status: str

class CreditScoreCreate(BaseModel):
    date: str
    score: int
    agency: str
    remarks: str

class ProfileUpdate(BaseModel):
    key: str
    value: float

# --- AI Chat ---
class ChatRequest(BaseModel):
    message: str

# --- Dashboard Summary ---
class FinancialSummary(BaseModel):
    total_assets: float
    total_debt: float
    net_worth: float