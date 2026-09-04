import os
import time
import datetime
import requests
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from currency_utils import currency_label, format_amount, parse_amount
from loan_math import calculate_emi, generate_amortization_schedule
from agent_core import batch_categorize_transactions

load_dotenv()

st.set_page_config(page_title="AI Financial Advisor", layout="wide")
st.title("Personal Financial Health Dashboard")
st.caption("Enterprise Edition: 100% Decoupled & Authenticated via API Key")

# --- API Configuration & Security Headers ---
API_URL = os.getenv("API_URL", "http://127.0.0.1:8000/api/v1")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-api-key")
HEADERS = {"X-API-Key": API_SECRET_KEY}

@st.cache_data(ttl=2)
def fetch_dashboard_data():
    try:
        response = requests.get(f"{API_URL}/dashboard/", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            return response.json()
        st.error(f"API Error ({response.status_code}): {response.text}")
    except Exception as e:
        st.error(f"Failed to connect to FastAPI Backend: {e}")
    return {}

data = fetch_dashboard_data()

df_expenses = pd.DataFrame(data.get("expenses", []))
df_loans = pd.DataFrame(data.get("loans", []))
df_investments = pd.DataFrame(data.get("investments", []))
df_budgets = pd.DataFrame(data.get("budgets", []))
df_goals = pd.DataFrame(data.get("goals", []))
df_bills = pd.DataFrame(data.get("bills", []))
df_credit = pd.DataFrame(data.get("credit_scores", []))
df_profile = pd.DataFrame(data.get("profile", []))

# --- KPI Calculations ---
monthly_income = 5000.0
if not df_profile.empty and "key" in df_profile.columns:
    income_match = df_profile[df_profile["key"] == "monthly_income"]
    if not income_match.empty:
        monthly_income = float(income_match.iloc[0]["value"])

total_debt = df_loans["principal"].sum() if not df_loans.empty and "principal" in df_loans.columns else 0.0
total_assets = df_investments["current_value"].sum() if not df_investments.empty and "current_value" in df_investments.columns else 0.0
total_invested = df_investments["invested_amount"].sum() if not df_investments.empty and "invested_amount" in df_investments.columns else 0.0
net_worth = total_assets - total_debt

monthly_emi_total = 0.0
if not df_loans.empty and "principal" in df_loans.columns:
    for _, l_row in df_loans.iterrows():
        monthly_emi_total += calculate_emi(float(l_row["principal"]), float(l_row["annual_rate"]), int(l_row["tenure_months"]))

total_monthly_spend = df_expenses["amount"].sum() if not df_expenses.empty and "amount" in df_expenses.columns else 0.0
dti_ratio = (monthly_emi_total / monthly_income * 100) if monthly_income > 0 else 0.0
savings_rate = ((monthly_income - total_monthly_spend) / monthly_income * 100) if monthly_income > 0 else 0.0

latest_score = int(df_credit.iloc[-1]["score"]) if not df_credit.empty and "score" in df_credit.columns else 750

kpi1, kpi2, kpi3, kpi4, kpi5 = st.columns(5)
kpi1.metric("Current Net Worth", format_amount(net_worth), delta=format_amount(net_worth))
kpi2.metric("Total Assets", format_amount(total_assets))
kpi3.metric("Total Debt", format_amount(total_debt))
kpi4.metric("Credit Score", f"{latest_score}", delta="Excellent" if latest_score >= 750 else "Good")
kpi5.metric("Savings Rate", f"{savings_rate:.1f}%", delta="Healthy" if savings_rate >= 20 else "Low")

st.divider()

tab_chat, tab_exp, tab_loan, tab_inv, tab_goals, tab_bills, tab_health = st.tabs([
    "💬 Chat with Financial AI", "📊 Expenses & Budgets", "🏦 Loans & Prepayments", 
    "📈 Savings & Investments", "🎯 Financial Goals", "📅 Bills & Subscriptions", "⭐ Credit Score & Health Report"
])

# ------------------ TAB 1: AI FINANCIAL ADVISOR CHAT ------------------
with tab_chat:
    st.subheader("Interactive Financial Advisor")
    if "messages" not in st.session_state:
        st.session_state.messages = [{"role": "assistant", "content": "Hello! I am securely connected to your FastAPI backend. How can I help?"}]

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_prompt = st.chat_input("Ask a financial question...")
    if user_prompt:
        st.session_state.messages.append({"role": "user", "content": user_prompt})
        with st.chat_message("user"): 
            st.markdown(user_prompt)

        with st.chat_message("assistant"):
            with st.spinner("Consulting backend AI Agent..."):
                try:
                    res = requests.post(f"{API_URL}/chat/", json={"message": user_prompt}, headers=HEADERS, timeout=30)
                    if res.status_code == 200:
                        reply = res.json().get("reply", "No response.")
                    else:
                        reply = f"API Error ({res.status_code}): {res.text}"
                except Exception as e:
                    reply = f"Connection Error: {e}"
                
                st.markdown(reply)
                st.session_state.messages.append({"role": "assistant", "content": reply})

# ------------------ TAB 2: EXPENSES & BUDGET OVERSIGHT ------------------
with tab_exp:
    st.subheader("Daily Spending & Budget Limits")
    with st.expander("📥 Upload Real Bank / Credit Card Statement (CSV)", expanded=False):
        uploaded_file = st.file_uploader("Upload bank statement (.csv)", type=["csv"])
        if uploaded_file is not None:
            raw_df = pd.read_csv(uploaded_file)
            cols = list(raw_df.columns)
            c1, c2, c3 = st.columns(3)
            with c1: date_col = st.selectbox("Date Column", cols, index=0)
            with c2: desc_col = st.selectbox("Description Column", cols, index=min(1, len(cols)-1))
            with c3: amt_col = st.selectbox("Amount Column", cols, index=min(2, len(cols)-1))
            append_mode = st.radio("Upload Mode", ["Append to existing records", "Replace all existing expenses"], horizontal=True)

            if st.button("🚀 Process & Categorize with API"):
                with st.spinner("Categorizing and sending to API..."):
                    clean_rows, descriptions_to_tag = [], []
                    for _, r in raw_df.iterrows():
                        try:
                            clean_amt = abs(parse_amount(r[amt_col]))
                            if clean_amt > 0:
                                descriptions_to_tag.append(str(r[desc_col]))
                                clean_rows.append((str(r[date_col]), str(r[desc_col]), clean_amt))
                        except Exception:
                            continue

                    assigned_cats = batch_categorize_transactions(descriptions_to_tag)
                    
                    payload = []
                    for idx, (d_val, desc_val, a_val) in enumerate(clean_rows):
                        c_val = assigned_cats[idx] if idx < len(assigned_cats) else "Miscellaneous"
                        payload.append({"date": d_val, "description": desc_val, "amount": a_val, "category": c_val})
                    
                    req_data = {"expenses": payload, "replace_all": append_mode == "Replace all existing expenses"}
                    res = requests.post(f"{API_URL}/expenses/bulk", json=req_data, headers=HEADERS)
                    
                    if res.status_code == 200:
                        st.success(f"Categorized {len(clean_rows)} transactions via API!")
                        st.cache_data.clear()
                        time.sleep(0.7)
                        st.rerun()
                    else:
                        st.error(f"Failed to upload: {res.text}")

    if not df_expenses.empty:
        spent_by_cat = df_expenses.groupby("category")["amount"].sum().reset_index()
        merged_budget = pd.merge(df_budgets, spent_by_cat, on="category", how="left").fillna(0.0) if not df_budgets.empty else pd.DataFrame(columns=["category", "monthly_limit", "amount"])
        
        col_b1, col_b2 = st.columns([1, 1])
        with col_b1:
            st.write("### Category Budget Status")
            for _, row in merged_budget.iterrows():
                cat, limit, spent = row["category"], row["monthly_limit"], row.get("amount", 0.0)
                pct = (spent / limit) if limit > 0 else 0.0
                st.write(f"**{cat}**: {format_amount(spent)} of {format_amount(limit)} ({pct*100:.0f}%)")
                st.progress(min(pct, 1.0))
        with col_b2:
            st.write("### Expenses Breakdown")
            st.bar_chart(spent_by_cat.set_index("category"))

    with st.expander("⚙️ Adjust Monthly Category Budgets"):
        with st.form("set_budget_form", clear_on_submit=True):
            b_cat = st.selectbox("Category", ["Groceries", "Utilities", "Dining", "Subscriptions", "Investment", "EMI/Loan", "Miscellaneous"])
            b_limit = st.number_input(currency_label("Monthly Limit"), min_value=10.0, value=200.0, step=25.0)
            
            if st.form_submit_button("Save Budget via API"):
                res = requests.post(f"{API_URL}/budgets/", json={"category": b_cat, "monthly_limit": b_limit}, headers=HEADERS)
                if res.status_code == 200:
                    st.success("Budget updated securely via API!")
                    st.cache_data.clear()
                    time.sleep(0.7)
                    st.rerun()
                else:
                    st.error(f"Error updating budget: {res.text}")

# ------------------ TAB 3: LOANS & PREPAYMENT ------------------
with tab_loan:
    st.subheader("Loan Amortization & Early Repayment Optimizer")
    default_principal = float(df_loans.iloc[0]["principal"]) if not df_loans.empty else 250000.0
    c1, c2, c3, c4 = st.columns(4)
    with c1: loan_amount = st.number_input(currency_label("Principal"), value=default_principal, step=5000.0)
    with c2: interest_rate = st.number_input("Rate (%)", value=7.5, step=0.1)
    with c3: tenure_years = st.slider("Tenure (Yrs)", 1, 30, 20)
    with c4: extra_payment = st.number_input(currency_label("Extra Prepayment"), value=200.0, step=50.0)

    _, base_summary = generate_amortization_schedule(loan_amount, interest_rate, tenure_years*12, 0.0)
    df_prepay, prepay_summary = generate_amortization_schedule(loan_amount, interest_rate, tenure_years*12, extra_payment)

    st.metric("Interest Saved", format_amount(base_summary['total_interest'] - prepay_summary['total_interest']))
    st.line_chart(df_prepay.set_index("Month")["Remaining Balance"])

# ------------------ TAB 4: SAVINGS & INVESTMENTS ------------------
with tab_inv:
    st.subheader("Portfolio Allocation & Asset Tracking")
    if not df_investments.empty:
        st.bar_chart(df_investments.groupby("asset_type")["current_value"].sum())
        st.dataframe(df_investments, use_container_width=True)

    with st.expander("➕ Add New Investment"):
        with st.form("add_inv_form", clear_on_submit=True):
            f_name = st.text_input("Asset Name")
            f_type = st.selectbox("Category", ["Mutual Funds", "Stocks", "Fixed Deposit", "Savings/Cash", "Crypto"])
            f_invested = st.number_input(currency_label("Invested"), step=100.0)
            f_current = st.number_input(currency_label("Current Value"), step=100.0)
            f_institution = st.text_input("Platform")
            
            if st.form_submit_button("Save Asset via API") and f_name:
                payload = {"name": f_name, "asset_type": f_type, "invested_amount": f_invested, "current_value": f_current, "institution": f_institution}
                res = requests.post(f"{API_URL}/investments/", json=payload, headers=HEADERS)
                if res.status_code == 200:
                    st.success("Investment saved via API!")
                    st.cache_data.clear()
                    time.sleep(0.7)
                    st.rerun()
                else:
                    st.error(f"Error saving asset: {res.text}")

# ------------------ TAB 5: FINANCIAL GOALS ------------------
with tab_goals:
    st.subheader("Target Milestones")
    if not df_goals.empty:
        for _, goal in df_goals.iterrows():
            pct = min(1.0, float(goal["current_amount"]) / float(goal["target_amount"])) if float(goal["target_amount"]) > 0 else 1.0
            st.write(f"### {goal['name']}")
            st.progress(pct)
            st.caption(f"Saved: {format_amount(goal['current_amount'])} / Target: {format_amount(goal['target_amount'])}")
    
    with st.expander("➕ Define a New Goal"):
        with st.form("add_goal_form", clear_on_submit=True):
            g_name = st.text_input("Goal Name")
            g_target = st.number_input(currency_label("Target"), step=500.0, value=5000.0)
            g_current = st.number_input(currency_label("Saved"), step=100.0)
            g_date = st.date_input("Deadline")
            
            if st.form_submit_button("Save Goal via API") and g_name:
                payload = {"name": g_name, "target_amount": g_target, "current_amount": g_current, "target_date": str(g_date), "category": "Custom"}
                res = requests.post(f"{API_URL}/goals/", json=payload, headers=HEADERS)
                if res.status_code == 200:
                    st.success("Goal saved successfully via API!")
                    st.cache_data.clear()
                    time.sleep(0.7)
                    st.rerun()
                else:
                    st.error(f"Error saving goal: {res.text}")

# ------------------ TAB 6: BILLS & SUBSCRIPTIONS ------------------
with tab_bills:
    st.subheader("Recurring Bills")
    if st.button("📲 Send Telegram Alert to My Phone Now"):
        with st.spinner("Dispatching background alert..."):
            res = requests.post(f"{API_URL}/trigger-daily-alert", headers=HEADERS)
            if res.status_code == 200:
                st.success("Alert dispatched in background! Check your phone.")
            else:
                st.error(f"Failed to trigger alert: {res.text}")
            
    if not df_bills.empty:
        st.dataframe(df_bills, use_container_width=True)

    with st.expander("➕ Add Bill"):
        with st.form("add_bill_form", clear_on_submit=True):
            b_name = st.text_input("Service Name")
            b_amount = st.number_input(currency_label("Amount"), step=5.0)
            b_day = st.number_input("Due Day", min_value=1, max_value=31)
            b_cat = st.selectbox("Category", ["Utilities", "Subscriptions", "Insurance"])
            
            if st.form_submit_button("Save Bill via API") and b_name:
                payload = {"name": b_name, "amount": b_amount, "due_day": b_day, "category": b_cat, "status": "Unpaid"}
                res = requests.post(f"{API_URL}/bills/", json=payload, headers=HEADERS)
                if res.status_code == 200:
                    st.success("Bill saved via API!")
                    st.cache_data.clear()
                    time.sleep(0.7)
                    st.rerun()
                else:
                    st.error(f"Error saving bill: {res.text}")

# ------------------ TAB 7: HEALTH REPORT ------------------
with tab_health:
    st.subheader("Monthly Health Diagnostics")
    c1, c2 = st.columns(2)
    with c1:
        if not df_credit.empty:
            st.line_chart(df_credit.set_index("date")["score"])
        with st.expander("➕ Log Credit Score"):
            with st.form("score_form", clear_on_submit=True):
                s_score = st.number_input("Score", 300, 900, 750)
                
                if st.form_submit_button("Save via API"):
                    payload = {"date": str(datetime.date.today()), "score": s_score, "agency": "Manual", "remarks": ""}
                    res = requests.post(f"{API_URL}/credit-scores/", json=payload, headers=HEADERS)
                    if res.status_code == 200:
                        st.success("Credit score saved via API!")
                        st.cache_data.clear()
                        time.sleep(0.7)
                        st.rerun()
                    else:
                        st.error(f"Error saving score: {res.text}")
    with c2:
        new_income = st.number_input(currency_label("Monthly Income"), value=monthly_income, step=250.0)
        if new_income != monthly_income:
            res = requests.post(f"{API_URL}/profile/", json={"key": "monthly_income", "value": new_income}, headers=HEADERS)
            if res.status_code == 200:
                st.cache_data.clear()
                st.rerun()
            else:
                st.error(f"Error updating income: {res.text}")