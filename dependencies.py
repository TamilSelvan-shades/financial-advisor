from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import Subscription, User
from auth import get_current_user
from database import get_db

FREE_AI_CREDITS_LIMIT = 5
FREE_STATEMENT_IMPORTS_LIMIT = 1

def get_or_create_subscription(user_id, db: Session) -> Subscription:
    subscription = db.query(Subscription).filter(Subscription.tenant_id == user_id).first()
    if not subscription:
        subscription = Subscription(
            tenant_id=user_id,
            status="free",
            plan_name="free",
            ai_credits_used=0,
            statement_imports_used=0
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
    return subscription

def verify_active_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Ensures user is authenticated, active, and has an initialized subscription record.
    Free-tier users are granted full access to core manual bookkeeping and dashboard.
    """
    get_or_create_subscription(current_user.id, db)
    return current_user

def verify_statement_quota(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Allows unlimited bank statement ingestion for active Plus/Pro users.
    Enforces 1 free statement import for Free-tier users.
    """
    sub = get_or_create_subscription(current_user.id, db)
    if sub.status == "active":
        return current_user

    used = sub.statement_imports_used or 0
    if used >= FREE_STATEMENT_IMPORTS_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"FREE_LIMIT_REACHED:STATEMENT_IMPORT - Free limit reached ({used}/{FREE_STATEMENT_IMPORTS_LIMIT}). Upgrade to Plus or Pro for unlimited statement imports."
        )

    sub.statement_imports_used = used + 1
    db.commit()
    return current_user

def verify_ai_quota(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Allows unlimited Fast Capture & AI Advisor actions for active Pro/Plus users.
    Enforces 5 free credits for Free-tier users.
    """
    sub = get_or_create_subscription(current_user.id, db)
    if sub.status == "active":
        return current_user

    used = sub.ai_credits_used or 0
    if used >= FREE_AI_CREDITS_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"FREE_LIMIT_REACHED:AI_CREDITS - Free limit reached ({used}/{FREE_AI_CREDITS_LIMIT}). Upgrade to Pro for unlimited AI and Fast Capture."
        )

    sub.ai_credits_used = used + 1
    db.commit()
    return current_user

def require_pro_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Strict Pro requirement for premium features (e.g. loan prepayment auto-sweep actions).
    """
    sub = get_or_create_subscription(current_user.id, db)
    if sub.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PRO_REQUIRED - Active Pro subscription required for this feature."
        )
    return current_user

