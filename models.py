import uuid
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    telegram_chat_id = Column(String, unique=True, index=True, nullable=True)
    whatsapp_phone_number = Column(String, unique=True, index=True, nullable=True)
    notification_channel = Column(String, default="both")  # "whatsapp", "telegram", "both", "in_app"
    preferred_briefing_time = Column(String, default="08:00")
    telegram_link_token = Column(String, index=True, nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    expenses = relationship("Expense", back_populates="tenant", cascade="all, delete")
    incomes = relationship("Income", back_populates="tenant", cascade="all, delete")
    accounts = relationship("Account", back_populates="tenant", cascade="all, delete")
    balance_adjustments = relationship("BalanceAdjustment", back_populates="tenant", cascade="all, delete")
    budgets = relationship("Budget", back_populates="tenant", cascade="all, delete")
    loans = relationship("Loan", back_populates="tenant", cascade="all, delete")
    investments = relationship("Investment", back_populates="tenant", cascade="all, delete")
    goals = relationship("Goal", back_populates="tenant", cascade="all, delete")
    bills = relationship("Bill", back_populates="tenant", cascade="all, delete")
    credit_scores = relationship("CreditScore", back_populates="tenant", cascade="all, delete")
    profile = relationship("Profile", back_populates="tenant", cascade="all, delete")
    subscription = relationship("Subscription", back_populates="tenant", cascade="all, delete", uselist=False)
    tax_profile = relationship("TaxProfile", back_populates="tenant", cascade="all, delete", uselist=False)
    autonomous_rules = relationship("AutonomousRule", back_populates="tenant", cascade="all, delete")
    autonomous_actions = relationship("AutonomousActionLog", back_populates="tenant", cascade="all, delete")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    razorpay_customer_id = Column(String, nullable=True)
    razorpay_subscription_id = Column(String, nullable=True)
    plan_id = Column(String, nullable=True)
    status = Column(String, default="inactive")

    tenant = relationship("User", back_populates="subscription")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    date = Column(String, index=True)
    description = Column(String)
    amount = Column(Float)
    category = Column(String)
    account = Column(String, default="ICICI Savings Account", nullable=True)
    remarks = Column(Text, nullable=True)

    tenant = relationship("User", back_populates="expenses")

class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    date = Column(String, index=True)
    category = Column(String, index=True)
    amount = Column(Float, nullable=False)
    account = Column(String, default="ICICI Savings Account")
    description = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)

    tenant = relationship("User", back_populates="incomes")

class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (UniqueConstraint('tenant_id', 'name', name='uix_tenant_account_name'),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    account_type = Column(String, default="Bank Account")
    initial_balance = Column(Float, default=0.0)

    tenant = relationship("User", back_populates="accounts")

class BalanceAdjustment(Base):
    __tablename__ = "balance_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    date = Column(String, index=True)
    account = Column(String, index=True)
    amount = Column(Float, nullable=False)
    reason = Column(String, nullable=True)

    tenant = relationship("User", back_populates="balance_adjustments")

class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint('tenant_id', 'category', name='uix_tenant_budget_category'),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    category = Column(String, index=True)
    monthly_limit = Column(Float, default=0.0)

    tenant = relationship("User", back_populates="budgets")

class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=True)
    principal = Column(Float, default=0.0)
    sanctioned_amount = Column(Float, nullable=True)
    interest_rate = Column(Float, default=0.0)
    tenure_years = Column(Float, default=0.0)
    tenure_months = Column(Integer, nullable=True)
    start_date = Column(String, nullable=True)
    extra_prepayment = Column(Float, default=0.0)
    emi = Column(Float, nullable=True)

    tenant = relationship("User", back_populates="loans")

class Investment(Base):
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=True)
    category = Column(String, nullable=True)
    invested_amount = Column(Float, default=0.0)
    current_value = Column(Float, default=0.0)

    tenant = relationship("User", back_populates="investments")

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String)
    target_amount = Column(Float)
    current_amount = Column(Float, default=0.0)
    target_date = Column(String, nullable=True)

    tenant = relationship("User", back_populates="goals")

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String)
    amount = Column(Float)
    due_day = Column(Integer)
    next_due_date = Column(String, nullable=True)
    frequency = Column(String, default="Monthly")
    status = Column(String, default="Pending")

    tenant = relationship("User", back_populates="bills")

class CreditScore(Base):
    __tablename__ = "credit_scores"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    score = Column(Integer)
    date = Column(String)
    rating = Column(String, nullable=True)
    agency = Column(String, nullable=True)

    tenant = relationship("User", back_populates="credit_scores")

class Profile(Base):
    __tablename__ = "profile"
    __table_args__ = (UniqueConstraint('tenant_id', 'key', name='uix_tenant_profile_key'),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    key = Column(String, index=True)
    value = Column(String)

    tenant = relationship("User", back_populates="profile")
 
class TaxProfile(Base):
    __tablename__ = "tax_profiles"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    financial_year = Column(String, default="2024-2025")
    gross_salary = Column(Float, default=1200000.0)
    basic_salary = Column(Float, default=600000.0)
    hra_received = Column(Float, default=240000.0)
    rent_paid = Column(Float, default=240000.0)
    is_metro = Column(Boolean, default=True)
    section_80c = Column(Float, default=150000.0)
    section_80d_self = Column(Float, default=25000.0)
    section_80d_parents = Column(Float, default=25000.0)
    parents_senior_citizen = Column(Boolean, default=False)
    section_80ccd_1b = Column(Float, default=50000.0)
    section_24b = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    preferred_regime = Column(String, default="auto")

    tenant = relationship("User", back_populates="tax_profile")

class AutonomousRule(Base):
    __tablename__ = "autonomous_rules"
    __table_args__ = (UniqueConstraint('tenant_id', 'rule_type', name='uix_tenant_rule_type'),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    rule_type = Column(String, index=True, nullable=False)  # auto_sweep, budget_guardrail, round_up
    is_enabled = Column(Boolean, default=True)
    config_json = Column(Text, default="{}")

    tenant = relationship("User", back_populates="autonomous_rules")

class AutonomousActionLog(Base):
    __tablename__ = "autonomous_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    created_at = Column(String, index=True)
    rule_type = Column(String, index=True)  # auto_sweep, budget_guardrail, round_up
    action_type = Column(String)  # alert, simulated_transfer, recommendation
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    amount = Column(Float, nullable=True)
    status = Column(String, default="active")  # active, dismissed, executed

    tenant = relationship("User", back_populates="autonomous_actions")