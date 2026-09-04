from sqlalchemy import Column, Integer, String, Float
from database import Base

class Expense(Base):
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    description = Column(String)
    amount = Column(Float)
    category = Column(String, index=True)

class Loan(Base):
    __tablename__ = "loans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    principal = Column(Float)
    annual_rate = Column(Float)
    tenure_months = Column(Integer)
    start_date = Column(String)

class Investment(Base):
    __tablename__ = "investments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    asset_type = Column(String)
    invested_amount = Column(Float)
    current_value = Column(Float)
    institution = Column(String)

class Budget(Base):
    __tablename__ = "budgets"
    
    category = Column(String, primary_key=True, index=True)
    monthly_limit = Column(Float)

class Goal(Base):
    __tablename__ = "goals"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    target_amount = Column(Float)
    current_amount = Column(Float)
    target_date = Column(String)
    category = Column(String)

class Bill(Base):
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    amount = Column(Float)
    due_day = Column(Integer)
    category = Column(String)
    status = Column(String)

class CreditScore(Base):
    __tablename__ = "credit_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    score = Column(Integer)
    agency = Column(String)
    remarks = Column(String)

class Profile(Base):
    __tablename__ = "profile"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(Float)