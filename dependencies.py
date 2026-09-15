from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import Subscription, User
from auth import get_current_user
from database import get_db

def verify_active_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to verify that the current user has an active subscription.
    Raises 403 Forbidden if the subscription is not 'active'.
    """
    subscription = db.query(Subscription).filter(Subscription.tenant_id == current_user.id).first()
    
    if not subscription or subscription.status != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active subscription required. Please subscribe or renew your plan."
        )
        
    return current_user
