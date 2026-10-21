export interface DemoTransaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  account: string;
  type: "income" | "expense";
  channel?: "UPI" | "NetBanking" | "Auto-Debit" | "Card";
}

export interface DemoLoan {
  id: number;
  name: string;
  bank_name: string;
  principal: number;
  interest_rate: number;
  tenure_years: number;
  tenure_months: number;
  emi: number;
  start_date: string;
  remaining_balance: number;
  interest_saved_with_prepayment?: number;
  months_saved_with_prepayment?: number;
}

export interface DemoAccount {
  id: number;
  name: string;
  account_type: string;
  balance: number;
  institution: string;
}

export interface DemoAnomaly {
  id: string;
  type: "price_creep" | "zombie_subscription" | "spending_spike";
  title: string;
  message: string;
  amount: number;
  severity: "low" | "medium" | "high";
  date: string;
}

export interface DemoAIInsight {
  id: string;
  title: string;
  tag: string;
  recommendation: string;
  impact: string;
  actionLabel: string;
}

export const sampleDemoData = {
  profile: {
    name: "Amit Sharma",
    role: "Senior Tech Professional",
    city: "Bengaluru, India",
    monthlySalary: 120000,
  },
  kpis: {
    monthly_income: 120000,
    monthly_expenses: 86500,
    total_balance: 265700,
    total_debt: 5180000,
    total_investments: 1480000,
    net_worth: 4250000, // Includes estimated home equity
    safe_to_spend_daily: 1233,
    days_left_in_cycle: 15,
    committed_bills_amount: 6000,
    scheduled_emis_amount: 65000,
    uncommitted_balance: 18500,
    burn_rate_status: "Healthy" as const,
    credit_score: 785,
    credit_rating: "Excellent",
    credit_bureau: "CIBIL",
    active_loans_count: 1,
  },
  accounts: [
    {
      id: 1,
      name: "ICICI Salary Account",
      account_type: "Salary Account",
      balance: 148200,
      institution: "ICICI Bank",
    },
    {
      id: 2,
      name: "HDFC Savings Account",
      account_type: "Emergency Reserve",
      balance: 82500,
      institution: "HDFC Bank",
    },
    {
      id: 3,
      name: "Zerodha Liquid Funds",
      account_type: "Trading & Liquid",
      balance: 35000,
      institution: "Zerodha",
    },
  ],
  loans: [
    {
      id: 1,
      name: "HDFC Home Loan (Sarjapur Greens)",
      bank_name: "HDFC Bank",
      principal: 5200000,
      interest_rate: 8.4,
      tenure_years: 18,
      tenure_months: 216,
      emi: 65000,
      start_date: "2023-04-10",
      remaining_balance: 4895000,
      interest_saved_with_prepayment: 1420000,
      months_saved_with_prepayment: 62,
    },
  ],
  expense_by_category: [
    { name: "Housing & Home Loan EMI", value: 65000 },
    { name: "Investments & SIP", value: 20000 },
    { name: "Discretionary & Dining", value: 10000 },
    { name: "Utilities & Broadband", value: 6000 },
    { name: "Groceries & Micro-UPI", value: 5500 },
  ],
  monthly_trend: [
    { key: "1", month: "May", income: 120000, expense: 84200, savings: 35800 },
    { key: "2", month: "Jun", income: 120000, expense: 88100, savings: 31900 },
    { key: "3", month: "Jul", income: 120000, expense: 85400, savings: 34600 },
    { key: "4", month: "Aug", income: 120000, expense: 87300, savings: 32700 },
    { key: "5", month: "Sep", income: 120000, expense: 84900, savings: 35100 },
    { key: "6", month: "Oct (Current)", income: 120000, expense: 86500, savings: 33500 },
  ],
  anomalies: [
    {
      id: "a1",
      type: "zombie_subscription",
      title: "Zombie Subscription Warning",
      message: "Disney+ Hotstar Annual ₹1,499 renewal due in 4 days. Zero active logins detected for 45+ days.",
      amount: 1499,
      severity: "medium",
      date: "2026-10-25",
    },
    {
      id: "a2",
      type: "price_creep",
      title: "Broadband Price Creep (+18%)",
      message: "ACT Fibernet billed ₹1,415 instead of standard ₹1,199 base plan due to add-on booster.",
      amount: 216,
      severity: "low",
      date: "2026-10-18",
    },
    {
      id: "a3",
      type: "spending_spike",
      title: "Food Delivery Spike",
      message: "Swiggy & Zomato totaled ₹7,450 across 18 orders (+22% vs 3-month moving average).",
      amount: 7450,
      severity: "high",
      date: "2026-10-20",
    },
  ] as DemoAnomaly[],
  aiInsights: [
    {
      id: "ai-1",
      title: "Autonomous Cash Sweep Recommendation",
      tag: "Debt & Wealth Acceleration",
      recommendation:
        "You have ₹18,500 idle after EMIs and bills this month — sweeping ₹15,000 into your SIP/prepayment reduces loan interest by ₹1.4L and cuts tenure by 9 months.",
      impact: "Saves ₹1,42,000 in compound interest while leaving ₹3,500 liquid cushion.",
      actionLabel: "Simulate Sweep Effect",
    },
    {
      id: "ai-2",
      title: "Section 80C Tax Optimization Audit",
      tag: "Tax Planner",
      recommendation:
        "You have ₹35,000 remaining headroom under Section 80C before March 31. Deploying this into ELSS tax-saver mutual funds saves ₹10,920 under the Old Regime.",
      impact: "Immediate direct tax refund of ₹10,920 at the 31.2% tax bracket.",
      actionLabel: "View 80C Strategy",
    },
    {
      id: "ai-3",
      title: "Discretionary Dining Budget Anchor",
      tag: "Budget Guardrail",
      recommendation:
        "Weekend dining out and delivery accounted for 18 orders (₹7,450). Setting a weekend cap of ₹6,000 will easily redirect ₹1,450 towards your emergency reserve.",
      impact: "Grows emergency liquid reserve to 3.5 months of baseline expenses.",
      actionLabel: "Set Dining Cap",
    },
  ] as DemoAIInsight[],
  recent_transactions: [
    {
      id: "tx-1",
      description: "Monthly Salary Credit (Infosys Limited)",
      category: "Salary",
      amount: 120000,
      date: "2026-10-01",
      account: "ICICI Salary Account",
      type: "income",
      channel: "NetBanking",
    },
    {
      id: "tx-2",
      description: "HDFC Home Loan Auto-Debit EMI",
      category: "Housing & Home Loan EMI",
      amount: 65000,
      date: "2026-10-05",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "Auto-Debit",
    },
    {
      id: "tx-3",
      description: "Parag Parikh Flexi Cap Fund SIP",
      category: "Investments & SIP",
      amount: 10000,
      date: "2026-10-10",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "Auto-Debit",
    },
    {
      id: "tx-4",
      description: "UTI Nifty 50 Index Fund SIP",
      category: "Investments & SIP",
      amount: 10000,
      date: "2026-10-10",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "Auto-Debit",
    },
    {
      id: "tx-5",
      description: "Bescom Electricity Bill",
      category: "Utilities & Broadband",
      amount: 3200,
      date: "2026-10-12",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-6",
      description: "ACT Fibernet Broadband 300 Mbps",
      category: "Utilities & Broadband",
      amount: 1415,
      date: "2026-10-15",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-7",
      description: "Indane Piped Natural Gas",
      category: "Utilities & Broadband",
      amount: 800,
      date: "2026-10-16",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-8",
      description: "Nature's Basket Organic Groceries",
      category: "Groceries & Micro-UPI",
      amount: 850,
      date: "2026-10-20",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-9",
      description: "Blinkit Quick Commerce Delivery",
      category: "Groceries & Micro-UPI",
      amount: 420,
      date: "2026-10-19",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-10",
      description: "Zepto Fruits & Vegetables",
      category: "Groceries & Micro-UPI",
      amount: 380,
      date: "2026-10-18",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-11",
      description: "BigBasket Weekly Fresh Restock",
      category: "Groceries & Micro-UPI",
      amount: 1250,
      date: "2026-10-14",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-12",
      description: "Swiggy Dinner Order @ Meghana Foods",
      category: "Discretionary & Dining",
      amount: 680,
      date: "2026-10-19",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-13",
      description: "Zomato Weekend Lunch @ Truffles",
      category: "Discretionary & Dining",
      amount: 840,
      date: "2026-10-17",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-14",
      description: "Cult.fit Fitness Membership Pass",
      category: "Discretionary & Dining",
      amount: 1999,
      date: "2026-10-08",
      account: "HDFC Savings Account",
      type: "expense",
      channel: "Card",
    },
    {
      id: "tx-15",
      description: "Uber Premier Bangalore Airport Trip",
      category: "Discretionary & Dining",
      amount: 1150,
      date: "2026-10-11",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-16",
      description: "Namma Metro Card Smart Recharge",
      category: "Discretionary & Dining",
      amount: 500,
      date: "2026-10-15",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-17",
      description: "Blue Tokai Coffee Roasters",
      category: "Discretionary & Dining",
      amount: 320,
      date: "2026-10-16",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-18",
      description: "BookMyShow Movie Tickets (IMAX)",
      category: "Discretionary & Dining",
      amount: 980,
      date: "2026-10-13",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-19",
      description: "Zepto Midnight Dairy & Snacks",
      category: "Groceries & Micro-UPI",
      amount: 240,
      date: "2026-10-12",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-20",
      description: "Chai Point Office Chai Break",
      category: "Discretionary & Dining",
      amount: 110,
      date: "2026-10-19",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-21",
      description: "Amazon India Household Essentials",
      category: "Groceries & Micro-UPI",
      amount: 890,
      date: "2026-10-09",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-22",
      description: "Apollo Pharmacy Medical Supplies",
      category: "Discretionary & Dining",
      amount: 450,
      date: "2026-10-07",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-23",
      description: "Zepto Quick Delivery",
      category: "Groceries & Micro-UPI",
      amount: 210,
      date: "2026-10-06",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-24",
      description: "Third Wave Coffee Meeting",
      category: "Discretionary & Dining",
      amount: 380,
      date: "2026-10-04",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
    {
      id: "tx-25",
      description: "Corner House Ice Cream",
      category: "Discretionary & Dining",
      amount: 320,
      date: "2026-10-03",
      account: "ICICI Salary Account",
      type: "expense",
      channel: "UPI",
    },
  ] as DemoTransaction[],
};
