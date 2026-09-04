import datetime
import io
import json
import os
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st

st.set_page_config(
    page_title="Personal Financial Health Dashboard",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# --- Configuration & Credentials ---
API_URL = os.getenv("BACKEND_API_URL", "http://127.0.0.1:8000")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "default-api-key")
HEADERS = {"X-API-Key": API_SECRET_KEY}

# --- Custom Styling ---
st.markdown(
    """
<style>
    .metric-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px;
        text-align: center;
    }
    .kpi-title {
        color: #64748b;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 4px;
    }
    .kpi-value {
        color: #0f172a;
        font-size: 1.75rem;
        font-weight: 700;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        padding-top: 10px;
        padding-bottom: 10px;
    }
</style>
""",
    unsafe_allow_html=True,
)


# --- Data Fetching ---
@st.cache_data(ttl=3)
def fetch_dashboard_data():
    try:
        resp = requests.get(
            f"{API_URL}/api/v1/dashboard/", headers=HEADERS, timeout=10
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


data = fetch_dashboard_data()

if data is None:
    st.error(
        f"⚠️ Unable to connect to backend at `{API_URL}`. Make sure Uvicorn is running locally (`uvicorn main:app --reload --port 8000`)."
    )
    st.stop()

# --- Unpack Collections ---
expenses_raw = data.get("expenses", [])
incomes_raw = data.get("incomes", [])
accounts_raw = data.get("accounts", [])
balance_adjustments_raw = data.get("balance_adjustments", [])
loans_raw = data.get("loans", [])
investments_raw = data.get("investments", [])
budgets_raw = data.get("budgets", [])
goals_raw = data.get("goals", [])
bills_raw = data.get("bills", [])
credit_scores_raw = data.get("credit_scores", [])
profile_raw = data.get("profile", [])

# DataFrames
df_expenses = pd.DataFrame(expenses_raw)
df_incomes = pd.DataFrame(incomes_raw)
df_accounts = pd.DataFrame(accounts_raw)
df_adjustments = pd.DataFrame(balance_adjustments_raw)
df_budgets = pd.DataFrame(budgets_raw)

# Datetime Parsing
if not df_expenses.empty and "date" in df_expenses.columns:
    df_expenses["date"] = pd.to_datetime(df_expenses["date"], errors="coerce")
    df_expenses["year"] = df_expenses["date"].dt.year
    df_expenses["month"] = df_expenses["date"].dt.strftime("%b")
    df_expenses["month_num"] = df_expenses["date"].dt.month
else:
    df_expenses = pd.DataFrame(
        columns=[
            "id",
            "date",
            "category",
            "amount",
            "account",
            "description",
            "remarks",
            "year",
            "month",
            "month_num",
        ]
    )

if not df_incomes.empty and "date" in df_incomes.columns:
    df_incomes["date"] = pd.to_datetime(df_incomes["date"], errors="coerce")
    df_incomes["year"] = df_incomes["date"].dt.year
    df_incomes["month"] = df_incomes["date"].dt.strftime("%b")
    df_incomes["month_num"] = df_incomes["date"].dt.month
else:
    df_incomes = pd.DataFrame(
        columns=[
            "id",
            "date",
            "category",
            "amount",
            "account",
            "description",
            "remarks",
            "year",
            "month",
            "month_num",
        ]
    )

# Calculate Totals & Net Worth
total_investments = sum(
    float(i.get("current_value", 0.0)) for i in investments_raw
)
total_debt = sum(float(l.get("principal", 0.0)) for l in loans_raw)

# Calculate Account Balances
account_names = set()
if not df_accounts.empty and "name" in df_accounts.columns:
    account_names.update(df_accounts["name"].dropna().unique())
if not df_expenses.empty and "account" in df_expenses.columns:
    account_names.update(df_expenses["account"].dropna().unique())
if not df_incomes.empty and "account" in df_incomes.columns:
    account_names.update(df_incomes["account"].dropna().unique())

if not account_names:
    account_names = {"ICICI Savings Account", "Amazon Pay Credit Card", "Axis bank"}

account_balances = {}
for acc in sorted(list(account_names)):
    init_bal = 0.0
    if not df_accounts.empty and "name" in df_accounts.columns:
        match = df_accounts[df_accounts["name"].str.lower() == acc.lower()]
        if not match.empty:
            init_bal = float(match.iloc[0].get("initial_balance", 0.0))

    dep = (
        float(
            df_incomes[df_incomes["account"].str.lower() == acc.lower()][
                "amount"
            ].sum()
        )
        if not df_incomes.empty and "account" in df_incomes.columns
        else 0.0
    )
    wth = (
        float(
            df_expenses[df_expenses["account"].str.lower() == acc.lower()][
                "amount"
            ].sum()
        )
        if not df_expenses.empty and "account" in df_expenses.columns
        else 0.0
    )
    adj = (
        float(
            df_adjustments[df_adjustments["account"].str.lower() == acc.lower()][
                "amount"
            ].sum()
        )
        if not df_adjustments.empty and "account" in df_adjustments.columns
        else 0.0
    )

    account_balances[acc] = {
        "initial": init_bal,
        "deposits": dep,
        "withdrawals": wth,
        "adjustments": adj,
        "current": init_bal + dep - wth + adj,
    }

total_liquid_cash = sum(b["current"] for b in account_balances.values())
total_assets = total_investments + max(0.0, total_liquid_cash)
net_worth = total_assets - total_debt

total_income_all = df_incomes["amount"].sum() if not df_incomes.empty else 0.0
total_expenses_all = (
    df_expenses["amount"].sum() if not df_expenses.empty else 0.0
)
savings_rate_all = (
    ((total_income_all - total_expenses_all) / total_income_all * 100)
    if total_income_all > 0
    else 0.0
)

latest_score = credit_scores_raw[-1]["score"] if credit_scores_raw else 750
score_rating = (
    credit_scores_raw[-1].get("rating", "Excellent")
    if credit_scores_raw
    else "Excellent"
)

# --- Header ---
st.title("Personal Financial Health Dashboard")
st.caption("Enterprise Edition: 100% Decoupled & Authenticated via API Key")

# Top KPI Metric Cards
kpi1, kpi2, kpi3, kpi4, kpi5 = st.columns(5)
with kpi1:
    st.metric(
        label="Current Net Worth",
        value=f"₹{net_worth:,.2f}",
        delta=(
            f"₹{net_worth:,.2f}"
            if net_worth >= 0
            else f"-₹{abs(net_worth):,.2f}"
        ),
        delta_color="normal",
    )
with kpi2:
    st.metric(label="Total Assets", value=f"₹{total_assets:,.2f}")
with kpi3:
    st.metric(label="Total Debt", value=f"₹{total_debt:,.2f}")
with kpi4:
    st.metric(
        label="Credit Score", value=str(latest_score), delta=f"↑ {score_rating}"
    )
with kpi5:
    st.metric(
        label="Savings Rate",
        value=f"{savings_rate_all:.1f}%",
        delta="Healthy" if savings_rate_all >= 20 else "Review",
        delta_color="normal" if savings_rate_all >= 20 else "inverse",
    )

st.write("")

# --- Primary Tab Navigation ---
tab_chat, tab_exp, tab_loans, tab_inv, tab_goals, tab_bills, tab_credit = (
    st.tabs(
        [
            "💬 Chat with Financial AI",
            "📊 Expenses & Budgets",
            "🏛️ Loans & Prepayments",
            "📈 Savings & Investments",
            "🎯 Financial Goals",
            "📅 Bills & Subscriptions",
            "⭐ Credit Score & Health Report",
        ]
    )
)

# ==========================================
# TAB 1: Chat with Financial AI
# ==========================================
with tab_chat:
    st.subheader("Financial Advisory AI Agent")
    st.caption(
        "Directly connected to your live financial database via FastAPI tools."
    )

    if "chat_messages" not in st.session_state:
        st.session_state["chat_messages"] = [
            {
                "role": "assistant",
                "content": "Hello! I am your AI financial advisor. How can I assist you with your budget, net worth, or accounts today?",
            }
        ]

    for msg in st.session_state["chat_messages"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_query = st.chat_input(
        "Ask a question about your finances, bills, or investments..."
    )
    if user_query:
        st.session_state["chat_messages"].append(
            {"role": "user", "content": user_query}
        )
        with st.chat_message("user"):
            st.markdown(user_query)

        with st.chat_message("assistant"):
            with st.spinner("Analyzing your finances..."):
                try:
                    chat_resp = requests.post(
                        f"{API_URL}/api/v1/chat/",
                        headers=HEADERS,
                        json={"message": user_query},
                        timeout=30,
                    )
                    if chat_resp.status_code == 200:
                        agent_reply = chat_resp.json().get(
                            "reply", "No response."
                        )
                    else:
                        agent_reply = f"Error from AI backend (status {chat_resp.status_code})."
                except Exception as ex:
                    agent_reply = f"Failed to reach AI assistant: {ex}"
                st.markdown(agent_reply)
                st.session_state["chat_messages"].append(
                    {"role": "assistant", "content": agent_reply}
                )

# ==========================================
# TAB 2: Expenses & Budgets (Multi-View Dashboard)
# ==========================================
with tab_exp:
    st.subheader("Income, Expenses & Ledger Management")

    sub_view = st.radio(
        "Navigation",
        [
            "📅 Monthly Dashboard",
            "📈 Annual Dashboard",
            "⏱️ Custom Dashboard",
            "💳 Accounts & Balances",
            "⚙️ Category Budgets",
            "➕ Log Income / Expense",
            "📥 Import Statement / Spreadsheet",
        ],
        horizontal=True,
        label_visibility="collapsed",
    )
    st.markdown("---")

    # 1. MONTHLY DASHBOARD
    if sub_view == "📅 Monthly Dashboard":
        avail_years = sorted(
            list(
                set(
                    df_expenses["year"].dropna().astype(int).tolist()
                    + df_incomes["year"].dropna().astype(int).tolist()
                )
            ),
            reverse=True,
        )
        if not avail_years:
            avail_years = [datetime.date.today().year]

        month_order = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ]

        col_y, col_m, _ = st.columns([2, 2, 6])
        with col_y:
            sel_year = st.selectbox("Select Year", avail_years, index=0)
        with col_m:
            cur_m_idx = datetime.date.today().month - 1
            sel_month = st.selectbox(
                "Select Month", month_order, index=cur_m_idx
            )

        m_exp = (
            df_expenses[
                (df_expenses["year"] == sel_year)
                & (df_expenses["month"] == sel_month)
            ]
            if not df_expenses.empty
            else pd.DataFrame()
        )
        m_inc = (
            df_incomes[
                (df_incomes["year"] == sel_year)
                & (df_incomes["month"] == sel_month)
            ]
            if not df_incomes.empty
            else pd.DataFrame()
        )

        tot_m_inc = m_inc["amount"].sum() if not m_inc.empty else 0.0
        tot_m_exp = m_exp["amount"].sum() if not m_exp.empty else 0.0
        tot_m_net = tot_m_inc - tot_m_exp
        m_savings_rate = (
            (tot_m_net / tot_m_inc * 100) if tot_m_inc > 0 else 0.0
        )

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Total Income", f"₹{tot_m_inc:,.2f}")
        m2.metric("Total Expenses", f"₹{tot_m_exp:,.2f}")
        m3.metric(
            "Net Savings",
            f"₹{tot_m_net:,.2f}",
            delta=(
                f"₹{tot_m_net:,.2f}"
                if tot_m_net >= 0
                else f"-₹{abs(tot_m_net):,.2f}"
            ),
        )
        m4.metric(
            "Savings Rate",
            f"{m_savings_rate:.1f}%",
            delta="Healthy" if m_savings_rate >= 20 else "Low",
        )

        st.write("")

        if m_exp.empty and m_inc.empty:
            st.info(
                f"No transactions recorded for {sel_month} {sel_year}. Use the '📥 Import Statement / Spreadsheet' tab to upload your spreadsheet or statements."
            )
        else:
            c1, c2 = st.columns(2)
            with c1:
                st.markdown(
                    f"##### 📊 Expenses Breakdown — {sel_month} {sel_year}"
                )
                if not m_exp.empty:
                    exp_cat = (
                        m_exp.groupby("category")["amount"].sum().reset_index()
                    )
                    fig_exp = px.pie(
                        exp_cat,
                        names="category",
                        values="amount",
                        hole=0.55,
                        color_discrete_sequence=px.colors.qualitative.Safe,
                    )
                    fig_exp.update_traces(textinfo="percent+label")
                    fig_exp.update_layout(
                        showlegend=False,
                        margin=dict(t=20, b=20, l=10, r=10),
                        height=320,
                    )
                    st.plotly_chart(fig_exp, use_container_width=True)
                else:
                    st.write("No expenses logged for this month.")

            with c2:
                st.markdown("##### 🏆 Top 10 Expense Categories")
                if not m_exp.empty:
                    top_exp = (
                        m_exp.groupby("category")["amount"]
                        .sum()
                        .sort_values(ascending=True)
                        .tail(10)
                        .reset_index()
                    )
                    fig_bar = px.bar(
                        top_exp,
                        x="amount",
                        y="category",
                        orientation="h",
                        text_auto=",.0f",
                        color="amount",
                        color_continuous_scale="Blues",
                    )
                    fig_bar.update_layout(
                        coloraxis_showscale=False,
                        margin=dict(t=20, b=20, l=10, r=10),
                        height=320,
                    )
                    st.plotly_chart(fig_bar, use_container_width=True)
                else:
                    st.write("No expense data available.")

            st.markdown("##### 📋 Category Summary")
            if not m_exp.empty:
                cat_summary = (
                    m_exp.groupby("category")["amount"]
                    .agg(["sum", "count"])
                    .reset_index()
                )
                cat_summary.columns = [
                    "Category",
                    "Total Spent (₹)",
                    "Transactions",
                ]
                cat_summary["% of Total"] = (
                    cat_summary["Total Spent (₹)"] / tot_m_exp * 100
                ).round(1).astype(str) + "%"
                cat_summary = cat_summary.sort_values(
                    by="Total Spent (₹)", ascending=False
                )
                st.dataframe(
                    cat_summary, use_container_width=True, hide_index=True
                )

    # 2. ANNUAL DASHBOARD
    elif sub_view == "📈 Annual Dashboard":
        avail_years = sorted(
            list(
                set(
                    df_expenses["year"].dropna().astype(int).tolist()
                    + df_incomes["year"].dropna().astype(int).tolist()
                )
            ),
            reverse=True,
        )
        if not avail_years:
            avail_years = [datetime.date.today().year]

        sel_year = st.selectbox("Select Calendar Year", avail_years, index=0)

        y_exp = (
            df_expenses[df_expenses["year"] == sel_year]
            if not df_expenses.empty
            else pd.DataFrame()
        )
        y_inc = (
            df_incomes[df_incomes["year"] == sel_year]
            if not df_incomes.empty
            else pd.DataFrame()
        )

        tot_y_inc = y_inc["amount"].sum() if not y_inc.empty else 0.0
        tot_y_exp = y_exp["amount"].sum() if not y_exp.empty else 0.0
        tot_y_net = tot_y_inc - tot_y_exp
        y_savings_rate = (
            (tot_y_net / tot_y_inc * 100) if tot_y_inc > 0 else 0.0
        )

        y1, y2, y3, y4 = st.columns(4)
        y1.metric(f"Annual Income ({sel_year})", f"₹{tot_y_inc:,.2f}")
        y2.metric(f"Annual Expenses ({sel_year})", f"₹{tot_y_exp:,.2f}")
        y3.metric(
            "Annual Net Balance",
            f"₹{tot_y_net:,.2f}",
            delta=(
                f"₹{tot_y_net:,.2f}"
                if tot_y_net >= 0
                else f"-₹{abs(tot_y_net):,.2f}"
            ),
        )
        y4.metric("Annual Savings Rate", f"{y_savings_rate:.1f}%")

        st.write("")
        st.markdown(
            f"##### 📊 Monthly Inflow vs Outflow Cash Flow ({sel_year})"
        )

        month_order = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ]
        monthly_data = []
        for m in month_order:
            i_val = (
                y_inc[y_inc["month"] == m]["amount"].sum()
                if not y_inc.empty
                else 0.0
            )
            e_val = (
                y_exp[y_exp["month"] == m]["amount"].sum()
                if not y_exp.empty
                else 0.0
            )
            monthly_data.append(
                {
                    "Month": m,
                    "Income": i_val,
                    "Expense": e_val,
                    "Net": i_val - e_val,
                }
            )

        df_monthly_trend = pd.DataFrame(monthly_data)

        fig_annual = go.Figure()
        fig_annual.add_trace(
            go.Bar(
                x=df_monthly_trend["Month"],
                y=df_monthly_trend["Income"],
                name="Income",
                marker_color="#10b981",
            )
        )
        fig_annual.add_trace(
            go.Bar(
                x=df_monthly_trend["Month"],
                y=df_monthly_trend["Expense"],
                name="Expense",
                marker_color="#ef4444",
            )
        )
        fig_annual.update_layout(
            barmode="group",
            margin=dict(t=20, b=20, l=10, r=10),
            height=380,
            yaxis_title="Amount (₹)",
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=1.02,
                xanchor="right",
                x=1,
            ),
        )
        st.plotly_chart(fig_annual, use_container_width=True)

        if not y_exp.empty:
            st.markdown(f"##### 🏷️ Annual Spending by Category ({sel_year})")
            cat_y = (
                y_exp.groupby("category")["amount"]
                .sum()
                .sort_values(ascending=False)
                .reset_index()
            )
            cat_y.columns = ["Category", "Amount (₹)"]
            cat_y["% of Annual Total"] = (
                cat_y["Amount (₹)"] / tot_y_exp * 100
            ).round(2).astype(str) + "%"
            st.dataframe(cat_y, use_container_width=True, hide_index=True)

    # 3. CUSTOM DASHBOARD
    elif sub_view == "⏱️ Custom Dashboard":
        st.markdown("##### 📅 Custom Date Range Analysis")
        min_date = datetime.date(2024, 1, 1)
        max_date = datetime.date.today()

        d_col1, d_col2, _ = st.columns([2, 2, 4])
        with d_col1:
            start_d = st.date_input(
                "Start Date",
                value=datetime.date(2024, 7, 1),
                min_value=min_date,
                max_value=max_date,
            )
        with d_col2:
            end_d = st.date_input(
                "End Date",
                value=max_date,
                min_value=min_date,
                max_value=max_date,
            )

        if start_d <= end_d:
            start_ts = pd.to_datetime(start_d)
            end_ts = (
                pd.to_datetime(end_d)
                + pd.Timedelta(days=1)
                - pd.Timedelta(nanoseconds=1)
            )

            c_exp = (
                df_expenses[
                    (df_expenses["date"] >= start_ts)
                    & (df_expenses["date"] <= end_ts)
                ]
                if not df_expenses.empty
                else pd.DataFrame()
            )
            c_inc = (
                df_incomes[
                    (df_incomes["date"] >= start_ts)
                    & (df_incomes["date"] <= end_ts)
                ]
                if not df_incomes.empty
                else pd.DataFrame()
            )

            tot_c_inc = c_inc["amount"].sum() if not c_inc.empty else 0.0
            tot_c_exp = c_exp["amount"].sum() if not c_exp.empty else 0.0
            tot_c_net = tot_c_inc - tot_c_exp
            c_savings_rate = (
                (tot_c_net / tot_c_inc * 100) if tot_c_inc > 0 else 0.0
            )

            k1, k2, k3, k4 = st.columns(4)
            k1.metric("Period Income", f"₹{tot_c_inc:,.2f}")
            k2.metric("Period Expenses", f"₹{tot_c_exp:,.2f}")
            k3.metric(
                "Period Net Savings",
                f"₹{tot_c_net:,.2f}",
                delta=(
                    f"₹{tot_c_net:,.2f}"
                    if tot_c_net >= 0
                    else f"-₹{abs(tot_c_net):,.2f}"
                ),
            )
            k4.metric("Period Savings Rate", f"{c_savings_rate:.1f}%")

            st.write("")
            if not c_exp.empty:
                col_chart, col_tbl = st.columns([1, 1])
                with col_chart:
                    c_cat = (
                        c_exp.groupby("category")["amount"].sum().reset_index()
                    )
                    fig_c_pie = px.pie(
                        c_cat,
                        names="category",
                        values="amount",
                        hole=0.5,
                        title="Spending Distribution",
                    )
                    st.plotly_chart(fig_c_pie, use_container_width=True)
                with col_tbl:
                    st.markdown("###### Top Categories in Period")
                    c_tbl = (
                        c_exp.groupby("category")["amount"]
                        .sum()
                        .sort_values(ascending=False)
                        .reset_index()
                    )
                    c_tbl.columns = ["Category", "Amount (₹)"]
                    st.dataframe(c_tbl, use_container_width=True, hide_index=True)
        else:
            st.error("Start Date must be before End Date.")

    # 4. ACCOUNTS & BALANCES
    elif sub_view == "💳 Accounts & Balances":
        st.markdown("##### 🏦 Multi-Account Ledger & Balances")
        st.metric(
            "Total Liquid Funds Across All Accounts", f"₹{total_liquid_cash:,.2f}"
        )

        acc_cols = st.columns(len(account_balances) if account_balances else 1)
        for idx, (acc_name, bal_info) in enumerate(account_balances.items()):
            with acc_cols[idx % len(acc_cols)]:
                st.markdown(
                    f"""
                <div class="metric-card">
                    <div class="kpi-title">{acc_name}</div>
                    <div class="kpi-value">₹{bal_info['current']:,.2f}</div>
                    <p style="margin-top: 8px; font-size: 0.8rem; color: #64748b;">
                        Deposits: ₹{bal_info['deposits']:,.2f}<br>
                        Withdrawals: ₹{bal_info['withdrawals']:,.2f}
                    </p>
                </div>
                """,
                    unsafe_allow_html=True,
                )

        st.write("")
        st.markdown("##### 📑 Unified Ledger History")

        ledger_entries = []
        if not df_expenses.empty:
            for _, r in df_expenses.iterrows():
                ledger_entries.append(
                    {
                        "Date": (
                            r["date"].strftime("%Y-%m-%d")
                            if pd.notna(r["date"])
                            else ""
                        ),
                        "Type": "Expense",
                        "Account": r.get("account", "ICICI Savings Account"),
                        "Category": r["category"],
                        "Amount (₹)": -abs(float(r["amount"])),
                        "Description": r.get("description", ""),
                        "Remarks": r.get("remarks", ""),
                    }
                )
        if not df_incomes.empty:
            for _, r in df_incomes.iterrows():
                ledger_entries.append(
                    {
                        "Date": (
                            r["date"].strftime("%Y-%m-%d")
                            if pd.notna(r["date"])
                            else ""
                        ),
                        "Type": "Income",
                        "Account": r.get("account", "ICICI Savings Account"),
                        "Category": r["category"],
                        "Amount (₹)": abs(float(r["amount"])),
                        "Description": r.get("description", ""),
                        "Remarks": r.get("remarks", ""),
                    }
                )

        df_ledger = pd.DataFrame(ledger_entries)
        if not df_ledger.empty:
            df_ledger = df_ledger.sort_values(by="Date", ascending=False)
            filter_acc = st.selectbox(
                "Filter by Account",
                ["All Accounts"] + sorted(list(account_names)),
            )
            if filter_acc != "All Accounts":
                df_ledger = df_ledger[df_ledger["Account"] == filter_acc]
            st.dataframe(df_ledger, use_container_width=True, hide_index=True)
        else:
            st.info("No ledger entries recorded yet.")

    # 5. CATEGORY BUDGETS
    elif sub_view == "⚙️ Category Budgets":
        st.markdown("##### 🎯 Category Spending vs Budget Limits")

        cur_month_str = datetime.date.today().strftime("%b")
        cur_year_int = datetime.date.today().year
        cur_m_exp = (
            df_expenses[
                (df_expenses["year"] == cur_year_int)
                & (df_expenses["month"] == cur_month_str)
            ]
            if not df_expenses.empty
            else pd.DataFrame()
        )

        if budgets_raw:
            b_cols = st.columns(2)
            for i, b in enumerate(budgets_raw):
                cat = b["category"]
                lim = float(b.get("monthly_limit", 0.0))
                spent = (
                    float(
                        cur_m_exp[
                            cur_m_exp["category"].str.lower() == cat.lower()
                        ]["amount"].sum()
                    )
                    if not cur_m_exp.empty
                    else 0.0
                )
                pct = min(spent / lim, 1.0) if lim > 0 else 0.0

                with b_cols[i % 2]:
                    st.markdown(
                        f"**{cat}**: ₹{spent:,.2f} of ₹{lim:,.2f} ({(spent/lim*100) if lim > 0 else 0:.0f}%)"
                    )
                    st.progress(pct)
        else:
            st.info("No budgets configured yet. Create one below.")

        st.write("")
        with st.expander("⚙️ Set or Adjust Monthly Category Budget"):
            with st.form("budget_form"):
                cat_name = st.text_input(
                    "Category Name",
                    placeholder="e.g. Food & Groceries, Petrol, Rent",
                )
                lim_amt = st.number_input(
                    "Monthly Limit (₹)",
                    min_value=0.0,
                    value=5000.0,
                    step=500.0,
                )
                if st.form_submit_button("Save Budget Limit"):
                    if cat_name.strip():
                        b_resp = requests.post(
                            f"{API_URL}/api/v1/budgets/",
                            headers=HEADERS,
                            json={
                                "category": cat_name.strip(),
                                "monthly_limit": lim_amt,
                            },
                        )
                        if b_resp.status_code == 200:
                            st.success(
                                f"Budget for '{cat_name}' set to ₹{lim_amt:,.2f}"
                            )
                            st.cache_data.clear()
                            st.rerun()
                        else:
                            st.error(f"Error saving budget: {b_resp.text}")

    # 6. LOG INCOME / EXPENSE
    elif sub_view == "➕ Log Income / Expense":
        st.markdown("##### 📝 Manual Entry Form")
        with st.form("manual_tx_form"):
            t_type = st.radio(
                "Transaction Type", ["Expense", "Income"], horizontal=True
            )
            col1, col2 = st.columns(2)
            with col1:
                t_date = st.date_input("Date", value=datetime.date.today())
                t_cat = st.text_input(
                    "Category",
                    placeholder="e.g. Food & Groceries, Salary, Petrol",
                )
                t_amt = st.number_input("Amount (₹)", min_value=0.01, step=100.0)
            with col2:
                t_acc = st.selectbox("Account", sorted(list(account_names)))
                t_desc = st.text_input("Description (Optional)")
                t_rem = st.text_input("Remarks (Optional)")

            if st.form_submit_button(f"Save {t_type}"):
                payload = {
                    "date": t_date.strftime("%Y-%m-%d"),
                    "category": (
                        t_cat.strip()
                        if t_cat.strip()
                        else ("Salary" if t_type == "Income" else "General")
                    ),
                    "amount": t_amt,
                    "account": t_acc,
                    "description": t_desc,
                    "remarks": t_rem,
                }
                endpoint = (
                    "/api/v1/incomes/"
                    if t_type == "Income"
                    else "/api/v1/expenses/"
                )
                res = requests.post(
                    f"{API_URL}{endpoint}", headers=HEADERS, json=payload
                )
                if res.status_code == 200:
                    st.success(f"{t_type} of ₹{t_amt:,.2f} saved successfully!")
                    st.cache_data.clear()
                    st.rerun()
                else:
                    st.error(f"Failed to record transaction: {res.text}")

    # 7. IMPORT SPREADSHEET OR CSV
    elif sub_view == "📥 Import Statement / Spreadsheet":
        st.markdown(
            "##### ⚡ Upload Excel Spreadsheet (.xlsx) or Bank Statement (CSV)"
        )

        uploaded_file = st.file_uploader(
            "Upload File",
            type=["xlsx", "xls", "csv"],
            help="Supports the complete 'Income and Expense Spreadsheet-Tamil.xlsx' or standard CSV statements.",
        )

        if uploaded_file is not None:
            filename_lower = uploaded_file.name.lower()

            # Handle Excel (.xlsx / .xls)
            if filename_lower.endswith((".xlsx", ".xls")):
                st.info(f"📑 Excel file detected: **{uploaded_file.name}**")
                replace_existing = st.checkbox(
                    "Replace existing data with spreadsheet records",
                    value=True,
                )

                if st.button("🚀 Process & Ingest Excel File"):
                    with st.spinner(
                        "Reading sheets, accounts, incomes, and expenses..."
                    ):
                        try:
                            file_bytes = io.BytesIO(uploaded_file.read())
                            xl = pd.ExcelFile(file_bytes)

                            # 1. Accounts from Setup sheet
                            if "Setup" in xl.sheet_names:
                                df_setup = pd.read_excel(
                                    xl, sheet_name="Setup", header=None
                                )
                                for r in range(6, 25):
                                    val = df_setup.iloc[r, 14]
                                    if pd.notna(val) and val not in [
                                        "ACCOUNT",
                                        "SET ACCOUNTS",
                                    ]:
                                        requests.post(
                                            f"{API_URL}/api/v1/accounts/",
                                            headers=HEADERS,
                                            json={
                                                "name": str(val).strip(),
                                                "account_type": "Bank Account",
                                                "initial_balance": 0.0,
                                            },
                                        )

                            # 2. Incomes from Income sheet
                            bulk_inc = []
                            if "Income" in xl.sheet_names:
                                df_i = pd.read_excel(
                                    xl, sheet_name="Income", skiprows=5
                                ).dropna(subset=["DATE", "AMOUNT"])
                                for _, row in df_i.iterrows():
                                    bulk_inc.append(
                                        {
                                            "date": pd.to_datetime(
                                                row["DATE"]
                                            ).strftime("%Y-%m-%d"),
                                            "category": str(
                                                row["CATEGORY"]
                                            ).strip(),
                                            "amount": float(row["AMOUNT"]),
                                            "account": (
                                                str(row["ACCOUNT"]).strip()
                                                if pd.notna(row["ACCOUNT"])
                                                else "ICICI Savings Account"
                                            ),
                                            "description": (
                                                str(row["DESCRIPTION"]).strip()
                                                if pd.notna(row["DESCRIPTION"])
                                                else ""
                                            ),
                                            "remarks": (
                                                str(row["REMARKS"]).strip()
                                                if pd.notna(row["REMARKS"])
                                                else ""
                                            ),
                                        }
                                    )
                                if bulk_inc:
                                    requests.post(
                                        f"{API_URL}/api/v1/incomes/bulk",
                                        headers=HEADERS,
                                        json={
                                            "incomes": bulk_inc,
                                            "replace_all": replace_existing,
                                        },
                                    )

                            # 3. Expenses from Expenses sheet
                            bulk_exp = []
                            if "Expenses" in xl.sheet_names:
                                df_e = pd.read_excel(
                                    xl, sheet_name="Expenses", skiprows=5
                                ).dropna(subset=["DATE", "AMOUNT"])
                                for _, row in df_e.iterrows():
                                    bulk_exp.append(
                                        {
                                            "date": pd.to_datetime(
                                                row["DATE"]
                                            ).strftime("%Y-%m-%d"),
                                            "category": str(
                                                row["CATEGORY"]
                                            ).strip(),
                                            "amount": float(row["AMOUNT"]),
                                            "account": (
                                                str(row["ACCOUNT"]).strip()
                                                if pd.notna(row["ACCOUNT"])
                                                else "ICICI Savings Account"
                                            ),
                                            "description": (
                                                str(row["DESCRIPTION"]).strip()
                                                if pd.notna(row["DESCRIPTION"])
                                                else ""
                                            ),
                                            "remarks": (
                                                str(row["REMARKS"]).strip()
                                                if pd.notna(row["REMARKS"])
                                                else ""
                                            ),
                                        }
                                    )
                                if bulk_exp:
                                    requests.post(
                                        f"{API_URL}/api/v1/expenses/bulk",
                                        headers=HEADERS,
                                        json={
                                            "expenses": bulk_exp,
                                            "replace_all": replace_existing,
                                        },
                                    )

                            st.success(
                                f"Successfully imported {len(bulk_inc)} income rows and {len(bulk_exp)} expense rows!"
                            )
                            st.cache_data.clear()
                            st.rerun()
                        except Exception as ex:
                            st.error(f"Failed to process Excel file: {ex}")

            # Handle CSV
            elif filename_lower.endswith(".csv"):
                try:
                    df_csv = pd.read_csv(uploaded_file)
                    st.write("CSV Preview:", df_csv.head(3))
                    if st.button("Confirm and Upload CSV Expenses"):
                        records = []
                        for _, r in df_csv.iterrows():
                            records.append(
                                {
                                    "date": str(
                                        r.get(
                                            "date",
                                            datetime.date.today().strftime(
                                                "%Y-%m-%d"
                                            ),
                                        )
                                    ),
                                    "description": str(
                                        r.get("description", "Imported Expense")
                                    ),
                                    "amount": float(r.get("amount", 0.0)),
                                    "category": str(
                                        r.get("category", "General")
                                    ),
                                    "account": str(
                                        r.get(
                                            "account", "ICICI Savings Account"
                                        )
                                    ),
                                }
                            )
                        requests.post(
                            f"{API_URL}/api/v1/expenses/bulk",
                            headers=HEADERS,
                            json={"expenses": records, "replace_all": False},
                        )
                        st.success(
                            f"Uploaded {len(records)} transactions from CSV!"
                        )
                        st.cache_data.clear()
                        st.rerun()
                except Exception as ex:
                    st.error(f"Error parsing CSV: {ex}")

# ==========================================
# TAB 3: Loans & Prepayments
# ==========================================
with tab_loans:
    st.subheader("Loans, EMI & Early Prepayment Optimizer")

    if loans_raw:
        for loan in loans_raw:
            p = float(loan.get("principal", 0.0))
            r = float(loan.get("interest_rate", 8.5)) / 1200
            n = int(float(loan.get("tenure_years", 20)) * 12)
            emi = (
                (p * r * ((1 + r) ** n)) / (((1 + r) ** n) - 1)
                if r > 0 and n > 0
                else 0.0
            )

            l_col1, l_col2, l_col3 = st.columns(3)
            l_col1.metric("Loan Name", loan.get("name", "Home Loan"))
            l_col2.metric("Principal Outstanding", f"₹{p:,.2f}")
            l_col3.metric("Estimated EMI", f"₹{emi:,.2f}/mo")
    else:
        st.info("No active loans tracked.")

    with st.expander("➕ Add Loan Account"):
        with st.form("loan_form"):
            lname = st.text_input("Loan Name", "ICICI Home Loan")
            lprincipal = st.number_input(
                "Principal (₹)",
                min_value=0.0,
                value=2500000.0,
                step=50000.0,
            )
            lrate = st.number_input(
                "Interest Rate (%)", min_value=0.0, value=8.75, step=0.1
            )
            ltenure = st.number_input(
                "Tenure (Years)", min_value=1.0, value=20.0, step=1.0
            )
            if st.form_submit_button("Save Loan"):
                requests.post(
                    f"{API_URL}/api/v1/profile/",
                    headers=HEADERS,
                    json={"key": "loan", "value": lname},
                )
                st.success("Loan profile updated.")
                st.rerun()

# ==========================================
# TAB 4: Savings & Investments
# ==========================================
with tab_inv:
    st.subheader("Investment Portfolio & Asset Allocation")
    st.metric("Total Investments Portfolio", f"₹{total_investments:,.2f}")

    if investments_raw:
        df_inv = pd.DataFrame(investments_raw)
        inv_col1, inv_col2 = st.columns([1, 1])
        with inv_col1:
            fig_inv = px.pie(
                df_inv,
                names="category",
                values="current_value",
                hole=0.45,
                title="Asset Allocation",
            )
            st.plotly_chart(fig_inv, use_container_width=True)
        with inv_col2:
            st.dataframe(
                df_inv[["name", "category", "current_value"]],
                use_container_width=True,
                hide_index=True,
            )
    else:
        st.info("No investments added yet.")

    with st.expander("➕ Add Investment Asset"):
        with st.form("inv_form"):
            iname = st.text_input(
                "Asset Name (e.g. PPFAS Mutual Fund, Gold ETF, EPF)"
            )
            icategory = st.selectbox(
                "Asset Class",
                [
                    "Equity Mutual Funds",
                    "Direct Equity",
                    "Debt / Fixed Deposit",
                    "Gold",
                    "Real Estate",
                ],
            )
            ival = st.number_input(
                "Current Valuation (₹)", min_value=0.0, step=1000.0
            )
            if st.form_submit_button("Add Investment"):
                requests.post(
                    f"{API_URL}/api/v1/investments/",
                    headers=HEADERS,
                    json={
                        "name": iname,
                        "category": icategory,
                        "current_value": ival,
                    },
                )
                st.success("Investment logged!")
                st.cache_data.clear()
                st.rerun()

# ==========================================
# TAB 5: Financial Goals
# ==========================================
with tab_goals:
    st.subheader("Financial Milestones & Goals Tracker")
    if goals_raw:
        for g in goals_raw:
            tgt = float(g.get("target_amount", 1.0))
            cur = float(g.get("current_amount", 0.0))
            progress = min(cur / tgt, 1.0) if tgt > 0 else 0.0
            st.markdown(
                f"**{g.get('name', 'Goal')}**: ₹{cur:,.2f} of ₹{tgt:,.2f} (Target Date: {g.get('target_date', 'N/A')})"
            )
            st.progress(progress)
    else:
        st.info("No financial goals configured yet.")

    with st.expander("➕ Create Goal"):
        with st.form("goal_form"):
            gname = st.text_input(
                "Goal Name (e.g. Emergency Fund, Balcony Project, New Car)"
            )
            gtgt = st.number_input(
                "Target Amount (₹)", min_value=1.0, step=10000.0
            )
            gcur = st.number_input(
                "Current Saved (₹)", min_value=0.0, step=5000.0
            )
            gdate = st.date_input("Target Completion Date")
            if st.form_submit_button("Save Goal"):
                requests.post(
                    f"{API_URL}/api/v1/goals/",
                    headers=HEADERS,
                    json={
                        "name": gname,
                        "target_amount": gtgt,
                        "current_amount": gcur,
                        "target_date": gdate.strftime("%Y-%m-%d"),
                    },
                )
                st.success("Goal saved!")
                st.cache_data.clear()
                st.rerun()

# ==========================================
# TAB 6: Bills & Subscriptions
# ==========================================
with tab_bills:
    st.subheader("Recurring Bills & Active Subscriptions")
    if bills_raw:
        b_df = pd.DataFrame(bills_raw)
        st.dataframe(
            b_df[["name", "amount", "due_day", "status"]],
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("No bills registered.")

    with st.expander("➕ Add Recurring Bill"):
        with st.form("bill_form"):
            bname = st.text_input(
                "Bill Name (e.g. Hathway Broadband, Electricity, Mobile Recharge)"
            )
            bamt = st.number_input("Amount (₹)", min_value=1.0, step=100.0)
            bday = st.number_input(
                "Due Day of the Month (1 - 31)",
                min_value=1,
                max_value=31,
                value=5,
            )
            if st.form_submit_button("Add Bill"):
                requests.post(
                    f"{API_URL}/api/v1/bills/",
                    headers=HEADERS,
                    json={
                        "name": bname,
                        "amount": bamt,
                        "due_day": int(bday),
                        "status": "Pending",
                    },
                )
                st.success("Bill registered!")
                st.cache_data.clear()
                st.rerun()

# ==========================================
# TAB 7: Credit Score & Health Report
# ==========================================
with tab_credit:
    st.subheader("Credit Score Tracking & Financial Health")
    c_kpi1, c_kpi2, c_kpi3 = st.columns(3)
    c_kpi1.metric("Current Score", str(latest_score), delta=score_rating)
    c_kpi2.metric(
        "Debt-to-Asset Ratio",
        (
            f"{(total_debt / total_assets * 100):.1f}%"
            if total_assets > 0
            else "0.0%"
        ),
    )
    c_kpi3.metric(
        "Emergency Fund Runway",
        (
            f"{(total_liquid_cash / (tot_m_exp if 'tot_m_exp' in locals() and tot_m_exp > 0 else 50000)):.1f} Months"
        ),
    )

    if credit_scores_raw:
        cs_df = pd.DataFrame(credit_scores_raw)
        fig_cs = px.line(
            cs_df, x="date", y="score", markers=True, title="Score History"
        )
        st.plotly_chart(fig_cs, use_container_width=True)

    with st.expander("➕ Log New Credit Score"):
        with st.form("cs_form"):
            n_score = st.number_input(
                "CIBIL / Experian Score",
                min_value=300,
                max_value=900,
                value=780,
            )
            n_date = st.date_input("Report Date", value=datetime.date.today())
            n_rating = st.selectbox(
                "Rating Tier", ["Excellent", "Good", "Fair", "Needs Attention"]
            )
            if st.form_submit_button("Record Score"):
                requests.post(
                    f"{API_URL}/api/v1/credit-scores/",
                    headers=HEADERS,
                    json={
                        "score": int(n_score),
                        "date": n_date.strftime("%Y-%m-%d"),
                        "rating": n_rating,
                    },
                )
                st.success("Credit score updated!")
                st.cache_data.clear()
                st.rerun()