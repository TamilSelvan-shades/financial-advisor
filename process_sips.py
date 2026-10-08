from database import SessionLocal
import models
from datetime import datetime, timezone
from live_tracking import get_live_price

def process_daily_sips():
    db = SessionLocal()
    today = datetime.now()
    current_day = today.day
    current_date_str = today.strftime("%Y-%m-%d")
    
    print(f"Processing SIPs for day: {current_day} (Date: {current_date_str})")
    
    sips = db.query(models.Investment).filter(models.Investment.is_sip == True, models.Investment.sip_date == current_day).all()
    
    processed_count = 0
    for inv in sips:
        if not inv.sip_amount or inv.sip_amount <= 0:
            continue
            
        # Check if SIP was already processed today
        existing_tx = db.query(models.InvestmentTransaction).filter(
            models.InvestmentTransaction.investment_id == inv.id,
            models.InvestmentTransaction.type == "SIP",
            models.InvestmentTransaction.date == current_date_str
        ).first()
        
        if existing_tx:
            print(f"SIP already processed today for Investment ID {inv.id} ({inv.name}). Skipping.")
            continue
            
        # Determine execution price
        execution_price = inv.average_price or 1.0 # fallback
        if inv.ticker_symbol and inv.live_tracking_type:
            live_price = get_live_price(inv.ticker_symbol, inv.live_tracking_type)
            if live_price > 0:
                execution_price = live_price
                
        # Calculate quantity bought
        units_bought = inv.sip_amount / execution_price
        
        # Create transaction
        new_tx = models.InvestmentTransaction(
            investment_id=inv.id,
            type="SIP",
            date=current_date_str,
            amount=inv.sip_amount,
            quantity=units_bought,
            price_per_unit=execution_price
        )
        db.add(new_tx)
        
        # Update Investment
        inv.invested_amount += inv.sip_amount
        inv.quantity += units_bought
        if inv.quantity > 0:
            inv.average_price = inv.invested_amount / inv.quantity
            
        # Update current value if live price was fetched
        if inv.ticker_symbol and inv.live_tracking_type and execution_price > 0:
            inv.current_value = inv.quantity * execution_price
        else:
            # Fallback update
            inv.current_value += inv.sip_amount
            
        print(f"Processed SIP for {inv.name}: Added ₹{inv.sip_amount} ({units_bought:.4f} units at ₹{execution_price:.2f})")
        processed_count += 1
        
    db.commit()
    db.close()
    print(f"SIP processing complete. Processed {processed_count} SIPs.")

if __name__ == "__main__":
    process_daily_sips()
