"""
executive_digest.py - Weekly Executive Financial Briefing & Automated Digest Engine
Computes:
  1. Weekly Cash Velocity (Inflows vs Outflows over 7 days + WoW velocity comparison)
  2. Category Leak Analyzer (detects categories >30% above 4-week historical average)
  3. Upcoming 7-Day Horizon (bills, EMIs, committed outgo, projected liquid balance)
  4. AI Executive Pro-Tip (Gemini 2.5 Flash personalized financial advisory)
  5. Executive 1-Page HTML/PDF Report Generator
"""

import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from google import genai

import models
import loan_math


def generate_weekly_executive_briefing(
    db: Session,
    tenant_id: str,
    ai_client: Optional[genai.Client] = None,
) -> Dict[str, Any]:
    """
    Generates a comprehensive weekly executive financial briefing for the tenant.
    """
    today = datetime.date.today()
    seven_days_ago = today - datetime.timedelta(days=7)
    fourteen_days_ago = today - datetime.timedelta(days=14)
    twenty_eight_days_ago = today - datetime.timedelta(days=28)

    today_str = today.strftime("%Y-%m-%d")
    seven_days_ago_str = seven_days_ago.strftime("%Y-%m-%d")
    fourteen_days_ago_str = fourteen_days_ago.strftime("%Y-%m-%d")
    twenty_eight_days_ago_str = twenty_eight_days_ago.strftime("%Y-%m-%d")

    # Fetch all records for tenant
    all_expenses = (
        db.query(models.Expense)
        .filter(models.Expense.tenant_id == tenant_id)
        .order_by(models.Expense.date.desc())
        .all()
    )
    all_incomes = (
        db.query(models.Income)
        .filter(models.Income.tenant_id == tenant_id)
        .order_by(models.Income.date.desc())
        .all()
    )
    all_accounts = (
        db.query(models.Account)
        .filter(models.Account.tenant_id == tenant_id)
        .all()
    )
    all_adjustments = (
        db.query(models.BalanceAdjustment)
        .filter(models.BalanceAdjustment.tenant_id == tenant_id)
        .all()
    )
    all_bills = (
        db.query(models.Bill)
        .filter(models.Bill.tenant_id == tenant_id)
        .all()
    )
    all_loans = (
        db.query(models.Loan)
        .filter(models.Loan.tenant_id == tenant_id)
        .all()
    )

    # --- 1. Weekly Cash Velocity ---
    # Current 7-Day Window [seven_days_ago to today]
    curr_7d_expenses = [
        e for e in all_expenses if e.date and seven_days_ago_str <= str(e.date) <= today_str
    ]
    curr_7d_expense_total = sum(float(e.amount or 0.0) for e in curr_7d_expenses)

    curr_7d_incomes = [
        i for i in all_incomes if i.date and seven_days_ago_str <= str(i.date) <= today_str
    ]
    curr_7d_income_total = sum(float(i.amount or 0.0) for i in curr_7d_incomes)

    # Prior 7-Day Window [fourteen_days_ago to seven_days_ago]
    prior_7d_expenses = [
        e for e in all_expenses if e.date and fourteen_days_ago_str <= str(e.date) < seven_days_ago_str
    ]
    prior_7d_expense_total = sum(float(e.amount or 0.0) for e in prior_7d_expenses)

    net_weekly_cashflow = round(curr_7d_income_total - curr_7d_expense_total, 2)
    daily_burn_rate = round(curr_7d_expense_total / 7.0, 2)

    # Week-over-Week Spend Velocity Change (%)
    if prior_7d_expense_total > 0:
        wow_expense_change_pct = round(
            ((curr_7d_expense_total - prior_7d_expense_total) / prior_7d_expense_total) * 100.0, 1
        )
    else:
        wow_expense_change_pct = 0.0

    if curr_7d_income_total > 0:
        savings_rate_pct = max(0.0, round((net_weekly_cashflow / curr_7d_income_total) * 100.0, 1))
    else:
        savings_rate_pct = 0.0

    velocity_status = "Positive Surplus" if net_weekly_cashflow >= 0 else "Net Outflow"

    # --- 2. Category Leak Analyzer ---
    # 4-Week Historical Window [twenty_eight_days_ago to today]
    four_week_expenses = [
        e for e in all_expenses if e.date and twenty_eight_days_ago_str <= str(e.date) <= today_str
    ]
    category_4w_totals: Dict[str, float] = {}
    for e in four_week_expenses:
        cat = (e.category or "Miscellaneous").strip()
        category_4w_totals[cat] = category_4w_totals.get(cat, 0.0) + float(e.amount or 0.0)

    category_curr_7d: Dict[str, float] = {}
    for e in curr_7d_expenses:
        cat = (e.category or "Miscellaneous").strip()
        category_curr_7d[cat] = category_curr_7d.get(cat, 0.0) + float(e.amount or 0.0)

    leaks: List[Dict[str, Any]] = []
    top_categories: List[Dict[str, Any]] = []

    for cat, curr_amt in sorted(category_curr_7d.items(), key=lambda x: x[1], reverse=True):
        four_w_amt = category_4w_totals.get(cat, curr_amt)
        weekly_baseline = max(1.0, four_w_amt / 4.0)
        surge_pct = round(((curr_amt - weekly_baseline) / weekly_baseline) * 100.0, 1)
        delta = round(curr_amt - weekly_baseline, 2)

        cat_info = {
            "category": cat,
            "current_7d_spend": round(curr_amt, 2),
            "weekly_baseline": round(weekly_baseline, 2),
            "surge_pct": surge_pct,
            "delta": delta,
            "is_leak": bool(surge_pct > 30.0 and delta >= 500.0),
        }
        top_categories.append(cat_info)
        if cat_info["is_leak"]:
            leaks.append(cat_info)

    # Sort leaks by largest absolute delta
    leaks.sort(key=lambda x: x["delta"], reverse=True)

    # --- 3. Upcoming 7-Day Horizon ---
    # Current Liquid Balance
    total_acc_balance = sum(float(a.initial_balance or 0.0) for a in all_accounts)
    total_adj = sum(float(ba.amount or 0.0) for ba in all_adjustments)
    all_time_income = sum(float(i.amount or 0.0) for i in all_incomes)
    all_time_expenses = sum(float(e.amount or 0.0) for e in all_expenses)
    liquid_balance = max(0.0, round(total_acc_balance + all_time_income - all_time_expenses + total_adj, 2))

    current_day = today.day
    upcoming_bills: List[Dict[str, Any]] = []
    total_upcoming_bills = 0.0

    for b in all_bills:
        due_day = b.due_day or 1
        # Days away calculation with wrap-around
        if due_day >= current_day:
            days_away = due_day - current_day
        else:
            # Due next month
            days_away = (30 - current_day) + due_day

        if 0 <= days_away <= 7 and b.status != "Paid":
            amt = float(b.amount or 0.0)
            total_upcoming_bills += amt
            upcoming_bills.append({
                "id": b.id,
                "name": b.name,
                "amount": round(amt, 2),
                "due_day": due_day,
                "days_away": days_away,
                "status": b.status or "Pending",
            })

    upcoming_bills.sort(key=lambda x: x["days_away"])

    # Scheduled monthly loan EMIs due in 7 days (prorated or scheduled)
    scheduled_emis_amount = 0.0
    for l in all_loans:
        p = float(l.principal or 0.0)
        r = float(l.interest_rate or 0.0)
        n = int(l.tenure_months or ((l.tenure_years or 1.0) * 12))
        if p > 0 and n > 0:
            emi = loan_math.calculate_emi(p, r, n)
            scheduled_emis_amount += emi

    # Horizon commitments
    total_7d_commitments = round(total_upcoming_bills + (scheduled_emis_amount * (7.0 / 30.0)), 2)
    projected_7d_liquidity = round(liquid_balance - total_7d_commitments, 2)

    liquidity_status = (
        "Strong Cushion"
        if projected_7d_liquidity >= 50000.0
        else ("Moderate Buffer" if projected_7d_liquidity >= 15000.0 else "Tight Liquidity")
    )

    # --- 4. AI Executive Pro-Tip Generator ---
    pro_tip = generate_pro_tip(
        ai_client=ai_client,
        net_cashflow=net_weekly_cashflow,
        burn_rate=daily_burn_rate,
        leaks=leaks,
        projected_liquidity=projected_7d_liquidity,
        top_categories=top_categories,
    )

    briefing_payload = {
        "briefing_date": today.strftime("%B %d, %Y"),
        "date_range": f"{seven_days_ago.strftime('%b %d')} – {today.strftime('%b %d, %Y')}",
        "cash_velocity": {
            "weekly_inflow": round(curr_7d_income_total, 2),
            "weekly_outflow": round(curr_7d_expense_total, 2),
            "net_weekly_cashflow": net_weekly_cashflow,
            "daily_burn_rate": daily_burn_rate,
            "wow_expense_change_pct": wow_expense_change_pct,
            "savings_rate_pct": savings_rate_pct,
            "status": velocity_status,
            "prior_week_outflow": round(prior_7d_expense_total, 2),
        },
        "category_leaks": {
            "has_leaks": len(leaks) > 0,
            "leak_count": len(leaks),
            "leaks": leaks,
            "top_categories": top_categories[:5],
        },
        "upcoming_horizon": {
            "horizon_days": 7,
            "current_liquid_balance": liquid_balance,
            "upcoming_bills": upcoming_bills,
            "total_bills_due": round(total_upcoming_bills, 2),
            "projected_emis": round(scheduled_emis_amount * (7.0 / 30.0), 2),
            "total_7d_commitments": total_7d_commitments,
            "projected_7d_liquidity": projected_7d_liquidity,
            "liquidity_status": liquidity_status,
        },
        "ai_pro_tip": pro_tip,
    }

    return briefing_payload


def generate_pro_tip(
    ai_client: Optional[genai.Client],
    net_cashflow: float,
    burn_rate: float,
    leaks: List[Dict[str, Any]],
    projected_liquidity: float,
    top_categories: List[Dict[str, Any]],
) -> str:
    """
    Generates a personalized, 2-sentence actionable executive pro-tip using Gemini 2.5 Flash.
    """
    if not ai_client:
        if leaks:
            return f"Your {leaks[0]['category']} spending surged {leaks[0]['surge_pct']:.0f}% this week above baseline. Reallocating ₹{leaks[0]['delta']:,.0f} from discretionary expenses will protect your upcoming liquidity."
        return f"Your daily cash burn is ₹{burn_rate:,.0f} with a projected liquid balance of ₹{projected_liquidity:,.0f}. Keep discretionary purchases steady to maintain your healthy weekly surplus."

    leak_summary = (
        f"Major leak in {leaks[0]['category']} (+{leaks[0]['surge_pct']}% / ₹{leaks[0]['delta']:,.0f})"
        if leaks
        else "No major category spending leaks."
    )
    top_cat_summary = (
        f"Top spend: {top_categories[0]['category']} (₹{top_categories[0]['current_7d_spend']:,.0f})"
        if top_categories
        else "Low discretionary spending."
    )

    prompt = f"""
    You are an elite Chief Financial Officer writing the "Sunday Morning Executive Briefing" for a client.
    Synthesize this real telemetry into EXACTLY 2 concise, highly punchy, highly actionable sentences:
    - Weekly Net Cashflow: ₹{net_cashflow:,.2f}
    - Daily Average Burn: ₹{burn_rate:,.2f}/day
    - Category Leak Alert: {leak_summary}
    - Top Category Spend: {top_cat_summary}
    - Projected 7-Day Net Liquidity: ₹{projected_liquidity:,.2f}

    Format requirements:
    - Exactly 2 sentences.
    - Highly prescriptive and empowering.
    - Mention specific category numbers or allocation moves.
    - No fluff or generic clichés.
    """

    try:
        response = ai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        tip = response.text.strip().replace('"', '')
        return tip
    except Exception as e:
        if leaks:
            return f"Your {leaks[0]['category']} spending surged {leaks[0]['surge_pct']:.0f}% this week above baseline. Reallocating ₹{leaks[0]['delta']:,.0f} from discretionary expenses will keep your cash velocity positive."
        return f"Your weekly cash velocity stands at ₹{net_cashflow:,.0f} with ₹{projected_liquidity:,.0f} in projected liquidity. Maintain your current daily burn rate to hit your monthly savings targets."


def generate_executive_report_html(briefing: Dict[str, Any]) -> str:
    """
    Renders an executive, high-resolution 1-page HTML report with embedded print styles.
    """
    cv = briefing.get("cash_velocity", {})
    cl = briefing.get("category_leaks", {})
    uh = briefing.get("upcoming_horizon", {})
    pro_tip = briefing.get("ai_pro_tip", "")
    date_range = briefing.get("date_range", "")
    briefing_date = briefing.get("briefing_date", "")

    # Build leak rows
    leak_rows_html = ""
    if cl.get("leaks"):
        for item in cl["leaks"]:
            leak_rows_html += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">{item['category']}</td>
                <td style="padding: 10px 12px; text-align: right; color: #e11d48; font-weight: 700;">₹{item['current_7d_spend']:,.2f}</td>
                <td style="padding: 10px 12px; text-align: right; color: #64748b;">₹{item['weekly_baseline']:,.2f}</td>
                <td style="padding: 10px 12px; text-align: right; color: #dc2626; font-weight: 700;">+{item['surge_pct']:.0f}%</td>
                <td style="padding: 10px 12px; text-align: right; color: #b91c1c; font-weight: 700;">+₹{item['delta']:,.0f}</td>
            </tr>
            """
    else:
        leak_rows_html = """
        <tr>
            <td colspan="5" style="padding: 16px; text-align: center; color: #16a34a; font-weight: 600;">
                ✅ Excellent discipline! No category spending exceeded 30% of its historical 4-week average.
            </td>
        </tr>
        """

    # Build upcoming bills rows
    bills_rows_html = ""
    if uh.get("upcoming_bills"):
        for b in uh["upcoming_bills"]:
            due_label = "TODAY" if b['days_away'] == 0 else f"in {b['days_away']} days"
            bills_rows_html += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">{b['name']}</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #0284c7;">₹{b['amount']:,.2f}</td>
                <td style="padding: 10px 12px; text-align: right; color: #475569;">Day {b['due_day']} ({due_label})</td>
                <td style="padding: 10px 12px; text-align: right;">
                    <span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">
                        {b['status']}
                    </span>
                </td>
            </tr>
            """
    else:
        bills_rows_html = """
        <tr>
            <td colspan="4" style="padding: 16px; text-align: center; color: #16a34a; font-weight: 600;">
                ✅ No pending recurring bills due in the next 7 days.
            </td>
        </tr>
        """

    net_color = "#16a34a" if cv.get("net_weekly_cashflow", 0) >= 0 else "#e11d48"
    net_sign = "+" if cv.get("net_weekly_cashflow", 0) >= 0 else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Executive Financial Briefing — {briefing_date}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }}
        body {{ background-color: #f8fafc; color: #0f172a; padding: 32px; font-size: 14px; line-height: 1.5; }}
        .container {{ max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
        .header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 28px; }}
        .brand {{ display: flex; align-items: center; gap: 12px; }}
        .brand-badge {{ background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; }}
        .brand-title {{ font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }}
        .brand-sub {{ font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; font-weight: 700; }}
        .report-meta {{ text-align: right; }}
        .report-meta h1 {{ font-size: 18px; font-weight: 700; color: #1e293b; }}
        .report-meta p {{ font-size: 12px; color: #64748b; margin-top: 2px; }}
        
        .kpi-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }}
        .kpi-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }}
        .kpi-label {{ font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }}
        .kpi-value {{ font-size: 22px; font-weight: 800; margin-top: 6px; }}
        .kpi-sub {{ font-size: 11px; color: #64748b; margin-top: 4px; }}
        
        .protip-box {{ background: linear-gradient(135deg, #eef2ff, #f5f3ff); border: 1px solid #c7d2fe; border-left: 5px solid #6366f1; border-radius: 12px; padding: 18px 20px; margin-bottom: 28px; }}
        .protip-title {{ font-size: 13px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }}
        .protip-text {{ font-size: 14px; font-weight: 500; color: #1e1b4b; line-height: 1.6; }}

        .section {{ margin-bottom: 28px; }}
        .section-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }}
        .section-title {{ font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; }}
        
        table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
        th {{ background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; }}
        th.text-right {{ text-align: right; }}
        
        .footer {{ border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; margin-top: 36px; }}
        
        @media print {{
            body {{ background: #fff; padding: 0; }}
            .container {{ box-shadow: none; border: none; padding: 20px; }}
            .no-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Brand Header -->
        <div class="header">
            <div class="brand">
                <div class="brand-badge">⚡</div>
                <div>
                    <div class="brand-title">AI Financial Advisor</div>
                    <div class="brand-sub">Executive Wealth Intelligence</div>
                </div>
            </div>
            <div class="report-meta">
                <h1>Sunday Executive Briefing</h1>
                <p>{date_range}</p>
            </div>
        </div>

        <!-- AI Pro-Tip Callout -->
        <div class="protip-box">
            <div class="protip-title">🤖 AI Executive Pro-Tip of the Week</div>
            <div class="protip-text">{pro_tip}</div>
        </div>

        <!-- Weekly Cash Velocity KPIs -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Weekly Inflow</div>
                <div class="kpi-value" style="color: #16a34a;">₹{cv.get('weekly_inflow', 0):,.2f}</div>
                <div class="kpi-sub">7-Day Income Logged</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Weekly Outflow</div>
                <div class="kpi-value" style="color: #e11d48;">₹{cv.get('weekly_outflow', 0):,.2f}</div>
                <div class="kpi-sub">{cv.get('wow_expense_change_pct', 0):+.1f}% vs prior week</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Net Velocity</div>
                <div class="kpi-value" style="color: {net_color};">{net_sign}₹{cv.get('net_weekly_cashflow', 0):,.2f}</div>
                <div class="kpi-sub">{cv.get('savings_rate_pct', 0):.1f}% savings rate</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Projected 7D Liquidity</div>
                <div class="kpi-value" style="color: #0284c7;">₹{uh.get('projected_7d_liquidity', 0):,.2f}</div>
                <div class="kpi-sub">{uh.get('liquidity_status', 'Healthy')}</div>
            </div>
        </div>

        <!-- Category Leak Analyzer -->
        <div class="section">
            <div class="section-header">
                <div class="section-title">🔍 Category Leak Radar (Surge &gt; 30% Above 4-Week Baseline)</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Category</th>
                        <th class="text-right">7-Day Spend</th>
                        <th class="text-right">4-Wk Avg Baseline</th>
                        <th class="text-right">Surge (%)</th>
                        <th class="text-right">Leak Delta</th>
                    </tr>
                </thead>
                <tbody>
                    {leak_rows_html}
                </tbody>
            </table>
        </div>

        <!-- Upcoming 7-Day Horizon -->
        <div class="section">
            <div class="section-header">
                <div class="section-title">📅 Upcoming 7-Day Commitment Horizon</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Bill / Obligation</th>
                        <th class="text-right">Committed Amount</th>
                        <th class="text-right">Due Horizon</th>
                        <th class="text-right">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {bills_rows_html}
                </tbody>
            </table>
        </div>

        <!-- Summary Footer -->
        <div class="footer">
            Generated autonomously by Personal AI Financial Advisor • Confidential Executive Telemetry • {briefing_date}
        </div>
    </div>
</body>
</html>"""
    return html
