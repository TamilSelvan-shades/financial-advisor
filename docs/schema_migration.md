# Data Schema Migration Plan

Based on the approved Architecture Blueprint, the following exact SQLAlchemy code changes will be made to `models.py`.

## 1. Imports Update
We need to import `ForeignKey`, `Boolean`, and `UniqueConstraint` from `sqlalchemy`, as well as `relationship` from `sqlalchemy.orm`. To support enterprise security and UUID primary keys, we will also import `uuid` and `UUID` from the PostgreSQL dialects.

```python
import uuid
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID

Base = declarative_base()
```

## 2. New User Model
The new `User` model acts as our tenant scope. It uses a UUID for the primary key and defines bidirectional relationships with all 11 child models. The relationships are configured with `cascade="all, delete"` to complement the database-level cascade deletions.

```python
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    telegram_chat_id = Column(String, unique=True, index=True, nullable=True)
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
```

## 3. Updated Existing Models
All 11 existing models will receive a `tenant_id` column configured as `ForeignKey("users.id", ondelete="CASCADE")` to prevent orphaned data. They also receive a bidirectional `relationship` linking back to the `tenant`.

Composite Unique Constraints have been added for `Account.name`, `Budget.category`, and `Profile.key`. `BalanceAdjustment` has been corrected to use the actual `reason` column.

```python
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
    interest_rate = Column(Float, default=0.0)
    tenure_years = Column(Float, default=0.0)
    extra_prepayment = Column(Float, default=0.0)

    tenant = relationship("User", back_populates="loans")


class Investment(Base):
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=True)
    category = Column(String, nullable=True)
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
    status = Column(String, default="Pending")

    tenant = relationship("User", back_populates="bills")


class CreditScore(Base):
    __tablename__ = "credit_scores"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    score = Column(Integer)
    date = Column(String)
    rating = Column(String, nullable=True)

    tenant = relationship("User", back_populates="credit_scores")


class Profile(Base):
    __tablename__ = "profile"
    __table_args__ = (UniqueConstraint('tenant_id', 'key', name='uix_tenant_profile_key'),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    key = Column(String, index=True)
    value = Column(String)

    tenant = relationship("User", back_populates="profile")
```

---
**Status:** Pending User Approval
**Next Steps:** Upon your final approval, I will execute these precise changes within `models.py`.
