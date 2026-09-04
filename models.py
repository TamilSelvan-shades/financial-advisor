from sqlalchemy import Column, Integer, String, Float, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    description = Column(String)
    amount = Column(Float)
    category = Column(String)
    account = Column(String, default="ICICI Savings Account", nullable=True)
    remarks = Column(Text, nullable=True)


class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    category = Column(String, index=True)
    amount = Column(Float, nullable=False)
    account = Column(String, default="ICICI Savings Account")
    description = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    account_type = Column(String, default="Bank Account")
    initial_balance = Column(Float, default=0.0)


class BalanceAdjustment(Base):
    __tablename__ = "balance_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    account = Column(String, index=True)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, unique=True, index=True)
    monthly_limit = Column(Float, default=0.0)


class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    principal = Column(Float, default=0.0)
    interest_rate = Column(Float, default=0.0)
    tenure_years = Column(Float, default=0.0)
    extra_prepayment = Column(Float, default=0.0)


class Investment(Base):
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    category = Column(String, nullable=True)
    current_value = Column(Float, default=0.0)


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    target_amount = Column(Float)
    current_amount = Column(Float, default=0.0)
    target_date = Column(String, nullable=True)


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    amount = Column(Float)
    due_day = Column(Integer)
    status = Column(String, default="Pending")


class CreditScore(Base):
    __tablename__ = "credit_scores"

    id = Column(Integer, primary_key=True, index=True)
    score = Column(Integer)
    date = Column(String)
    rating = Column(String, nullable=True)


class Profile(Base):
    __tablename__ = "profile"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)