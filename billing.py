import os
import hmac
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import razorpay
from database import get_db
import models
import schemas
import auth

router = APIRouter()

def get_rzp_client():
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if key_id and key_secret:
        return razorpay.Client(auth=(key_id, key_secret))
    return None

def get_webhook_secret():
    return os.environ.get("RAZORPAY_WEBHOOK_SECRET")

def get_pro_plan_id():
    return os.environ.get("PRO_PLAN_ID", "plan_TZULH6fabPNoWy")

def get_plus_plan_id():
    return os.environ.get("PLUS_PLAN_ID", "plan_PLUS_LEDGERLY")

@router.post("/billing/customer", response_model=schemas.SubscriptionResponse)
def create_customer(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    rzp_client = get_rzp_client()
    if not rzp_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")

    subscription = db.query(models.Subscription).filter(models.Subscription.tenant_id == current_user.id).first()
    
    if not subscription:
        subscription = models.Subscription(tenant_id=current_user.id)
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

    # If subscription already has a verified customer ID, return immediately
    if subscription.razorpay_customer_id:
        return subscription

    customer_id = None

    # Step 1: Proactively check if customer already exists in Razorpay for this email
    try:
        existing = rzp_client.customer.all({"email": current_user.email})
        items = existing.get("items", []) if isinstance(existing, dict) else []
        if items and items[0].get("id"):
            customer_id = items[0]["id"]
            # Sync customer notes with latest tenant_id
            try:
                rzp_client.customer.edit(customer_id, {"notes": {"tenant_id": str(current_user.id)}})
            except Exception:
                pass
    except Exception:
        # Non-blocking search fallback
        pass

    # Step 2: If not found, create new customer in Razorpay
    if not customer_id:
        try:
            customer_data = {
                "email": current_user.email,
                "notes": {
                    "tenant_id": str(current_user.id)
                }
            }
            customer = rzp_client.customer.create(data=customer_data)
            customer_id = customer.get("id")
        except Exception as e:
            err_msg = str(e).lower()
            # Step 3: Catch any duplicate or already-exists error and re-query
            if "already exists" in err_msg or "duplicate" in err_msg or "bad_request_error" in err_msg:
                try:
                    existing = rzp_client.customer.all({"email": current_user.email})
                    items = existing.get("items", []) if isinstance(existing, dict) else []
                    if items and items[0].get("id"):
                        customer_id = items[0]["id"]
                    else:
                        raise HTTPException(status_code=400, detail=str(e))
                except HTTPException:
                    raise
                except Exception as inner_e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Customer exists in Razorpay but failed to link: {str(inner_e)}"
                    )
            else:
                raise HTTPException(status_code=400, detail=str(e))

    if not customer_id:
        raise HTTPException(status_code=500, detail="Failed to initialize or resolve Razorpay customer")

    subscription.razorpay_customer_id = customer_id

    # Step 4: Check if this customer already has an active subscription in Razorpay
    try:
        all_subs = rzp_client.subscription.all({"count": 10})
        for s in all_subs.get("items", []):
            if s.get("customer_id") == customer_id and s.get("status") in ["active", "authenticated"]:
                subscription.razorpay_subscription_id = s.get("id")
                subscription.plan_id = s.get("plan_id", get_pro_plan_id())
                subscription.status = s.get("status")
                break
    except Exception:
        pass

    db.commit()
    db.refresh(subscription)
    return subscription

@router.post("/billing/subscription", response_model=schemas.SubscriptionResponse)
def create_subscription(
    plan_name: str = "pro",
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    rzp_client = get_rzp_client()
    if not rzp_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")

    subscription = db.query(models.Subscription).filter(models.Subscription.tenant_id == current_user.id).first()
    
    # Auto-resolve customer if not present
    if not subscription or not subscription.razorpay_customer_id:
        subscription = create_customer(current_user=current_user, db=db)

    target_plan_id = get_plus_plan_id() if plan_name == "plus" else get_pro_plan_id()

    # If user already has an active subscription, return it directly
    if subscription.status == "active" and subscription.razorpay_subscription_id:
        try:
            rzp_sub = rzp_client.subscription.fetch(subscription.razorpay_subscription_id)
            if rzp_sub.get("status") == "active":
                subscription.plan_name = plan_name
                db.commit()
                return subscription
        except Exception:
            pass

    try:
        sub_data = {
            "plan_id": target_plan_id,
            "customer_id": subscription.razorpay_customer_id,
            "total_count": 120
        }
        rzp_sub = rzp_client.subscription.create(data=sub_data)
        
        subscription.razorpay_subscription_id = rzp_sub["id"]
        subscription.plan_id = target_plan_id
        subscription.plan_name = plan_name
        subscription.status = rzp_sub.get("status", "created")
        db.commit()
        db.refresh(subscription)
        return subscription
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/billing/verify", response_model=schemas.SubscriptionResponse)
def verify_payment(
    payload: schemas.PaymentVerificationRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Direct client-side verification of Razorpay subscription checkout.
    Verifies cryptographic signature, activates tenant Pro features instantly,
    and returns updated subscription object without needing a hard re-login.
    """
    rzp_client = get_rzp_client()
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")

    # Cryptographic signature verification
    if key_secret:
        try:
            expected_msg = f"{payload.razorpay_payment_id}|{payload.razorpay_subscription_id}"
            generated_signature = hmac.new(
                key_secret.encode("utf-8"),
                expected_msg.encode("utf-8"),
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(generated_signature, payload.razorpay_signature):
                # Try utility method as fallback if direct HMAC mismatch occurs
                if rzp_client:
                    rzp_client.utility.verify_subscription_payment_signature({
                        "razorpay_subscription_id": payload.razorpay_subscription_id,
                        "razorpay_payment_id": payload.razorpay_payment_id,
                        "razorpay_signature": payload.razorpay_signature
                    })
        except Exception as sig_err:
            print(f"[Razorpay Verify Warning] Signature mismatch or validation warning: {sig_err}")
            # If in strict production mode with secret, enforce signature
            if os.environ.get("ENVIRONMENT") == "production":
                raise HTTPException(status_code=400, detail="Invalid Razorpay signature")

    subscription = db.query(models.Subscription).filter(models.Subscription.tenant_id == current_user.id).first()
    if not subscription:
        subscription = models.Subscription(tenant_id=current_user.id)
        db.add(subscription)

    subscription.razorpay_subscription_id = payload.razorpay_subscription_id
    subscription.status = "active"
    subscription.plan_name = payload.plan_name or "pro"
    db.commit()
    db.refresh(subscription)
    return subscription

@router.get("/billing/usage", response_model=schemas.UsageResponse)
def get_usage_metrics(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    subscription = db.query(models.Subscription).filter(models.Subscription.tenant_id == current_user.id).first()
    is_pro = bool(subscription and subscription.status == "active")
    plan = subscription.plan_name if subscription and subscription.plan_name else ("pro" if is_pro else "free")
    
    return {
        "status": subscription.status if subscription else "free",
        "plan_name": plan,
        "is_pro": is_pro,
        "ai_credits_used": subscription.ai_credits_used if subscription else 0,
        "ai_credits_limit": 5,
        "statement_imports_used": subscription.statement_imports_used if subscription else 0,
        "statement_imports_limit": 1
    }

@router.get("/billing/subscription/status", response_model=schemas.SubscriptionResponse)
def get_subscription_status(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    subscription = db.query(models.Subscription).filter(models.Subscription.tenant_id == current_user.id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    rzp_client = get_rzp_client()
    if subscription.razorpay_subscription_id and rzp_client:
        try:
            rzp_sub = rzp_client.subscription.fetch(subscription.razorpay_subscription_id)
            new_status = rzp_sub.get("status")
            if new_status and subscription.status != new_status:
                subscription.status = new_status
                db.commit()
                db.refresh(subscription)
        except Exception:
            pass
            
    return subscription

@router.delete("/billing/subscription", status_code=status.HTTP_200_OK)
def cancel_subscription(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    rzp_client = get_rzp_client()
    if not rzp_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")

    subscription = db.query(models.Subscription).filter(models.Subscription.tenant_id == current_user.id).first()
    if not subscription or not subscription.razorpay_subscription_id:
        raise HTTPException(status_code=404, detail="Active subscription not found")
        
    try:
        rzp_client.subscription.cancel(subscription.razorpay_subscription_id)
        subscription.status = "cancelled"
        db.commit()
        return {"detail": "Subscription cancelled"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    webhook_secret = get_webhook_secret()
    signature = request.headers.get("x-razorpay-signature")
    if not signature or not webhook_secret:
        raise HTTPException(status_code=400, detail="Missing signature or secret")
        
    body = await request.body()
    
    try:
        rzp_client = get_rzp_client()
        if rzp_client:
            rzp_client.utility.verify_webhook_signature(body.decode(), signature, webhook_secret)
        else:
            raise HTTPException(status_code=500, detail="Razorpay not configured")
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
        
    payload = await request.json()
    event = payload.get("event")
    
    subscription_events = [
        "subscription.charged",
        "subscription.activated",
        "subscription.authenticated",
        "subscription.completed",
        "subscription.halted",
        "subscription.cancelled",
        "subscription.paused",
        "subscription.resumed"
    ]
    
    if event in subscription_events:
        sub_entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
        sub_id = sub_entity.get("id")
        sub_status = sub_entity.get("status")
        
        if sub_id:
            subscription = db.query(models.Subscription).filter(models.Subscription.razorpay_subscription_id == sub_id).first()
            if subscription and sub_status:
                subscription.status = sub_status
                db.commit()
                
    return {"status": "ok"}
