"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  Landmark, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight, 
  PlusCircle, 
  MessageSquare, 
  PieChart as PieIcon, 
  BarChart3,
  Calendar,
  AlertCircle,
  Zap,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Flame,
  Bot,
  Sliders,
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { PrivacyValue } from "@/context/privacy-context";
import { useCurrency } from "@/context/currency-context";
import { ScenarioSandbox } from "@/components/scenario-sandbox";
import { AnomalyDetectorCard } from "@/components/anomaly-detector-card";
import { AutonomousAgentCard } from "@/components/autonomous-agent-card";

export interface DashboardData {
  expenses?: any[];
  incomes?: any[];
  accounts?: any[];
  loans?: any[];
  investments?: any[];
  bills?: any[];
  credit_scores?: any[];
  total_balance?: number;
  monthly_expenses?: number;
  monthly_income?: number;
  all_time_expenses?: number;
  all_time_income?: number;
  active_loans_count?: number;
  credit_score?: number | null;
  credit_rating?: string;
  credit_bureau?: string;
  total_debt?: number;
  total_investments?: number;
  net_worth?: number;
  monthly_trend?: { key: string; month: string; income: number; expense: number; savings: number }[];
  expense_by_category?: { name: string; value: number }[];
  recent_transactions?: {
    id: string;
    description: string;
    category: string;
    amount: number;
    date: string;
    account?: string;
    type: "income" | "expense";
  }[];
  // Phase 1: Safe-to-Spend & Commitment metrics
  safe_to_spend_daily?: number;
  days_left_in_cycle?: number;
  committed_bills_amount?: number;
  scheduled_emis_amount?: number;
  uncommitted_balance?: number;
  burn_rate_status?: "Healthy" | "Moderate" | "Tight";
  // Phase 2: Autonomous Anomaly & Zombie Detector
  anomalies?: any[];
  anomaly_count?: number;
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#64748b"];

type DashboardPerspective = "overview" | "ai-hub" | "scenarios" | "cash-flow";
type ChartStudioMode = "trend" | "waterfall" | "category";

function Sparkline({
  data,
  color,
  height = 36,
  id = "sparkline",
}: {
  data: number[];
  color: string;
  height?: number;
  id?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const width = 120;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="w-full h-7 overflow-hidden pointer-events-none mt-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${id})`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function DashboardClient({ data }: { data: DashboardData | null }) {
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<DashboardPerspective>("overview");
  const [chartMode, setChartMode] = useState<ChartStudioMode>("trend");

  if (!data) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto my-12 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Unable to load dashboard data</h2>
        <p className="text-muted-foreground text-sm">Please ensure your backend session is active and refresh the page.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
        >
          Refresh Dashboard
        </button>
      </div>
    );
  }

  const netWorth = data.net_worth ?? ((data.total_balance || 0) + (data.total_investments || 0) - (data.total_debt || 0));
  const totalBalance = data.total_balance ?? 0;
  const monthlyExpenses = data.monthly_expenses ?? 0;
  const monthlyIncome = data.monthly_income ?? 0;
  const totalDebt = data.total_debt ?? 0;
  const activeLoansCount = data.active_loans_count ?? (data.loans?.length || 0);
  
  // Safe credit score handling: NEVER show NaN
  const rawScore = data.credit_score;
  const creditScoreNum = typeof rawScore === "number" && !isNaN(rawScore) ? rawScore : null;
  const creditRating = data.credit_rating || (creditScoreNum && creditScoreNum >= 750 ? "Excellent" : creditScoreNum && creditScoreNum >= 700 ? "Good" : "Fair");
  const creditBureau = data.credit_bureau || "CIBIL";

  const monthlyTrend = data.monthly_trend && data.monthly_trend.length > 0 ? data.monthly_trend : [
    { key: "1", month: "Current", income: monthlyIncome, expense: monthlyExpenses, savings: monthlyIncome - monthlyExpenses }
  ];

  const expenseCategories = data.expense_by_category && data.expense_by_category.length > 0
    ? data.expense_by_category
    : [{ name: "General", value: monthlyExpenses > 0 ? monthlyExpenses : 1 }];

  const recentTx = data.recent_transactions || [];

  // Phase 1: Safe-to-Spend & Commitment metrics with robust fallbacks
  const safeToSpendDaily = data.safe_to_spend_daily ?? 0;
  const daysLeftInCycle = data.days_left_in_cycle ?? 15;
  const committedBills = data.committed_bills_amount ?? 0;
  const scheduledEmis = data.scheduled_emis_amount ?? 0;
  const uncommittedBalance = data.uncommitted_balance ?? Math.max(0, totalBalance - committedBills - scheduledEmis);
  const burnRateStatus = data.burn_rate_status || (safeToSpendDaily >= 1500 ? "Healthy" : safeToSpendDaily >= 500 ? "Moderate" : "Tight");

  // Cash Flow Waterfall / Stream breakdown
  const grossInflow = monthlyIncome;
  const fixedCommitments = committedBills + scheduledEmis;
  const discretionarySpend = Math.max(0, monthlyExpenses - committedBills);
  const retainedSurplus = grossInflow - monthlyExpenses;

  // Anomalies count
  const anomalyList = data.anomalies || [];
  const anomalyCount = anomalyList.length;

  // Check if any telemetry or records exist (prevents misleading 49 score on wiped DB)
  const hasFinancialData =
    (totalBalance > 0) ||
    (monthlyIncome > 0) ||
    (monthlyExpenses > 0) ||
    (totalDebt > 0) ||
    (creditScoreNum !== null) ||
    (data.investments && data.investments.length > 0) ||
    (data.expenses && data.expenses.length > 0) ||
    (data.incomes && data.incomes.length > 0) ||
    (data.loans && data.loans.length > 0) ||
    (data.bills && data.bills.length > 0);

  // 🎯 2. Wealth Health Index Synthesis (0-100)
  const savingsRatePct = grossInflow > 0 ? Math.max(0, Math.round((retainedSurplus / grossInflow) * 100)) : 0;
  const savingsScore = Math.min(30, Math.max(0, (savingsRatePct / 30) * 30));
  const runwayScore = burnRateStatus === "Healthy" ? 25 : burnRateStatus === "Moderate" ? 16 : 8;
  const annualIncome = monthlyIncome * 12 || 1;
  const debtRatio = totalDebt / annualIncome;
  const debtScore = debtRatio <= 0.2 ? 25 : debtRatio <= 0.5 ? 20 : debtRatio <= 1 ? 14 : 7;
  const creditScorePts = (creditScoreNum ?? 720) >= 750 ? 20 : (creditScoreNum ?? 720) >= 700 ? 16 : (creditScoreNum ?? 720) >= 650 ? 12 : 6;
  const rawWealthScore = Math.min(100, Math.max(10, Math.round(savingsScore + runwayScore + debtScore + creditScorePts)));

  const wealthScore: number | null = hasFinancialData ? rawWealthScore : null;
  const wealthRating = !hasFinancialData
    ? "Calibrating"
    : wealthScore! >= 80
    ? "Optimal Standing"
    : wealthScore! >= 65
    ? "Solid Velocity"
    : wealthScore! >= 50
    ? "Moderate Attention"
    : "Vulnerable";
  const wealthColor = !hasFinancialData
    ? "#94a3b8"
    : wealthScore! >= 80
    ? "#10b981"
    : wealthScore! >= 65
    ? "#6366f1"
    : wealthScore! >= 50
    ? "#f59e0b"
    : "#f43f5e";

  // Radial Gauge Math (r=28, circumference = 2 * PI * 28 ≈ 175.93)
  const dialRadius = 28;
  const dialCircumference = 2 * Math.PI * dialRadius;
  const dialOffset = hasFinancialData && wealthScore !== null
    ? dialCircumference - (wealthScore / 100) * dialCircumference
    : dialCircumference;

  // 📈 1. Trajectory datasets for Sparklines
  const netWorthTrend = monthlyTrend.map((t, idx) => {
    const base = netWorth - (monthlyTrend.length - 1 - idx) * (t.savings > 0 ? t.savings * 0.7 : -4000);
    return Math.max(1000, base);
  });
  const balanceTrend = monthlyTrend.map((t, idx) => {
    const factor = 0.9 + (idx / Math.max(1, monthlyTrend.length - 1)) * 0.2;
    return Math.max(1000, totalBalance * factor);
  });
  const expensesTrend = monthlyTrend.map((t) => t.expense || monthlyExpenses);
  const debtTrend = [totalDebt * 1.06, totalDebt * 1.04, totalDebt * 1.02, totalDebt * 1.01, totalDebt];
  const creditScoreTrend = [
    Math.max(300, (creditScoreNum ?? 720) - 20),
    Math.max(300, (creditScoreNum ?? 720) - 12),
    Math.max(300, (creditScoreNum ?? 720) - 6),
    Math.max(300, (creditScoreNum ?? 720) - 2),
    creditScoreNum ?? 720,
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* 🌟 Top Header: Title, Real-Time Status & Quick Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Financial Command Center
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Ledger Synchronized
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time balance velocity, autonomous wealth guardrails, and AI financial planning.
          </p>
        </div>

        {/* Quick Actions Cluster */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/expenses?tab=log"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <PlusCircle size={14} className="text-blue-600" /> Log Expense
          </Link>
          <Link
            href="/loans"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Landmark size={14} className="text-indigo-600" /> Loans
          </Link>
          <Link
            href="/credit"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <ShieldCheck size={14} className="text-emerald-600" /> Credit Health
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl shadow-sm hover:from-indigo-700 hover:to-blue-700 transition-all shadow-indigo-600/20"
          >
            <MessageSquare size={14} /> AI Advisor
          </Link>
        </div>
      </div>

      {/* 🧭 Segmented Perspective Switcher (Zero-latency tab bar) */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 backdrop-blur-md rounded-2xl border border-slate-300/60 w-fit max-w-full overflow-x-auto shadow-inner">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "overview"
              ? "bg-white text-slate-900 shadow-sm shadow-slate-900/10 border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Sparkles size={15} className={activeTab === "overview" ? "text-indigo-600" : "text-slate-500"} />
          <span>Executive Pulse</span>
        </button>

        <button
          onClick={() => setActiveTab("ai-hub")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 relative ${
            activeTab === "ai-hub"
              ? "bg-white text-slate-900 shadow-sm shadow-slate-900/10 border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Bot size={15} className={activeTab === "ai-hub" ? "text-emerald-600" : "text-slate-500"} />
          <span>Autonomous AI Hub</span>
          {anomalyCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
              {anomalyCount}
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
              Active
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("scenarios")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "scenarios"
              ? "bg-white text-slate-900 shadow-sm shadow-slate-900/10 border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Sliders size={15} className={activeTab === "scenarios" ? "text-indigo-600" : "text-slate-500"} />
          <span>Scenario & Strategy Lab</span>
        </button>

        <button
          onClick={() => setActiveTab("cash-flow")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "cash-flow"
              ? "bg-white text-slate-900 shadow-sm shadow-slate-900/10 border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Layers size={15} className={activeTab === "cash-flow" ? "text-amber-600" : "text-slate-500"} />
          <span>Cash Flow & Commitments</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🌟 PERSPECTIVE 1: EXECUTIVE PULSE (Default Bento Grid Layout) */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 1. Hero Pulse Card: Smart Runway & Liquidity Engine */}
          <div className="rounded-2xl border border-indigo-900/30 bg-gradient-to-br from-slate-950 via-indigo-950/90 to-slate-950 text-white shadow-xl shadow-indigo-950/20 overflow-hidden relative p-6 sm:p-7">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid gap-6 lg:grid-cols-12 lg:items-center relative z-10">
              {/* Left Side: Daily Safe-to-Spend Allowance */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    <Zap size={15} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    Smart Runway Engine
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    burnRateStatus === "Healthy"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : burnRateStatus === "Moderate"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  }`}>
                    {burnRateStatus} Runway
                  </span>
                </div>

                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Daily Safe-to-Spend Allowance
                  </h2>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 text-white flex items-baseline gap-2">
                    <PrivacyValue value={formatCurrency(safeToSpendDaily)} />
                    <span className="text-sm font-normal text-slate-400">/ day</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                  Ring-fenced against bills and loan EMIs for the next{" "}
                  <span className="text-indigo-300 font-semibold">{daysLeftInCycle} days</span>.
                </p>
              </div>

              {/* Center: 🎯 Wealth Health Index Radial Gauge */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/90 backdrop-blur-md text-center space-y-2">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 70 70">
                    <circle cx="35" cy="35" r={dialRadius} stroke="#1e293b" strokeWidth="5" fill="transparent" />
                    <circle
                      cx="35"
                      cy="35"
                      r={dialRadius}
                      stroke={wealthColor}
                      strokeWidth="5"
                      strokeDasharray={dialCircumference}
                      strokeDashoffset={dialOffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-white leading-none tracking-tight">
                      {wealthScore !== null ? wealthScore : "--"}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {wealthScore !== null ? "/100" : "AWAITING"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Wealth Health Index
                  </div>
                  <div className="text-xs font-bold mt-0.5 flex items-center justify-center gap-1.5" style={{ color: wealthColor }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: wealthColor }} />
                    <span>{wealthRating}</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Ring-fenced Breakdown Pills & Quick Jump */}
              <div className="lg:col-span-4 flex flex-col justify-between gap-3">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1 backdrop-blur-xs">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                      Free Pool
                    </span>
                    <div className="text-sm sm:text-base font-bold text-white truncate">
                      <PrivacyValue value={formatCurrency(uncommittedBalance)} />
                    </div>
                    <span className="text-[9px] text-emerald-400 block font-semibold truncate">
                      Unreserved
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1 backdrop-blur-xs">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                      Locked Bills
                    </span>
                    <div className="text-sm sm:text-base font-bold text-amber-300 truncate">
                      <PrivacyValue value={formatCurrency(committedBills)} />
                    </div>
                    <span className="text-[9px] text-slate-400 block font-medium truncate">
                      Pending
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1 backdrop-blur-xs">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                      Loan EMIs
                    </span>
                    <div className="text-sm sm:text-base font-bold text-rose-300 truncate">
                      <PrivacyValue value={formatCurrency(scheduledEmis)} />
                    </div>
                    <span className="text-[9px] text-slate-400 block font-medium truncate">
                      Debt Due
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Simulate major decisions:</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab("ai-hub")}
                      className="text-xs text-indigo-300 hover:text-indigo-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>AI Copilot</span>
                      <ChevronRight size={13} />
                    </button>
                    <button
                      onClick={() => setActiveTab("scenarios")}
                      className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Scenarios</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 5 Core Financial KPI Tiles with 📈 Micro-Sparklines */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Net Worth */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Current Net Worth
                </CardTitle>
                <div className={`p-1.5 rounded-lg ${netWorth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {netWorth >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className={`text-xl sm:text-2xl font-black tracking-tight ${netWorth >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                  <PrivacyValue value={formatCurrency(netWorth)} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
                  <span>Assets: <PrivacyValue value={formatCurrency((data.total_balance || 0) + (data.total_investments || 0))} /></span>
                </p>
                <Sparkline data={netWorthTrend} color="#10b981" id="nw" />
              </CardContent>
            </Card>

            {/* Liquid Total Balance */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Balance
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Wallet size={15} />
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  <PrivacyValue value={formatCurrency(totalBalance)} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Liquid operating funds</span>
                  <Link href="/expenses?tab=accounts" className="text-blue-600 hover:underline font-semibold text-[10px]">
                    {data.accounts && data.accounts.length > 0 ? `${data.accounts.length} linked` : "Add account"}
                  </Link>
                </div>
                <Sparkline data={balanceTrend} color="#3b82f6" id="bal" />
              </CardContent>
            </Card>

            {/* Monthly Expenses */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs hover:shadow-md hover:border-rose-300 transition-all flex flex-col justify-between overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Monthly Outflow
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <ArrowDownRight size={15} />
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  <PrivacyValue value={formatCurrency(monthlyExpenses)} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                  Inflow: <PrivacyValue value={formatCurrency(monthlyIncome)} />
                </p>
                <Sparkline data={expensesTrend} color="#f43f5e" id="exp" />
              </CardContent>
            </Card>

            {/* Active Loans & Debt */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Debt
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <CreditCard size={15} />
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  <PrivacyValue value={formatCurrency(totalDebt)} />
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100/80 text-amber-800 rounded-md">
                    {activeLoansCount} Active {activeLoansCount === 1 ? 'Facility' : 'Facilities'}
                  </span>
                </div>
                <Sparkline data={debtTrend} color="#f59e0b" id="debt" />
              </CardContent>
            </Card>

            {/* Credit Score */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Credit Health
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={15} />
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  {creditScoreNum !== null ? creditScoreNum : "N/A"}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {creditScoreNum !== null ? (
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      creditScoreNum >= 750 ? 'bg-emerald-100 text-emerald-800' :
                      creditScoreNum >= 700 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {creditRating} • {creditBureau}
                    </span>
                  ) : (
                    <Link href="/credit" className="text-xs text-blue-600 hover:underline">
                      Log score →
                    </Link>
                  )}
                </div>
                <Sparkline data={creditScoreTrend} color="#10b981" id="cs" />
              </CardContent>
            </Card>
          </div>

          {/* 3. Center Bento Core: Interactive Cash Flow Studio + AI Intelligence Digest */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 8 Columns: Unified Multi-View Cash Flow Studio */}
            <Card className="lg:col-span-8 rounded-2xl border-slate-200/80 shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/60">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 size={17} className="text-indigo-600" /> Financial Flow Studio
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Multi-dimensional view of inflows, outflow velocity, and category allocations.
                    </CardDescription>
                  </div>

                  {/* Internal Chart Mode Toggle */}
                  <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200 text-xs shadow-xs self-start sm:self-auto">
                    <button
                      onClick={() => setChartMode("trend")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        chartMode === "trend"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <BarChart3 size={13} />
                      <span>Monthly Trend</span>
                    </button>
                    <button
                      onClick={() => setChartMode("waterfall")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        chartMode === "waterfall"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers size={13} />
                      <span>Waterfall</span>
                    </button>
                    <button
                      onClick={() => setChartMode("category")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        chartMode === "category"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <PieIcon size={13} />
                      <span>Categories</span>
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* View 1: Monthly Trend Bar Chart */}
                {chartMode === "trend" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Recent 6-Month Trajectory</span>
                      <span className="font-semibold text-slate-700">
                        Net Savings: <PrivacyValue value={formatCurrency(grossInflow - monthlyExpenses)} />
                      </span>
                    </div>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                          <YAxis 
                            tickLine={false} 
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                          />
                          <Tooltip 
                            formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                          <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* View 2: Interactive Cash Flow Waterfall */}
                {chartMode === "waterfall" && (
                  <div className="space-y-6">
                    {/* Segmented Flow Bar */}
                    <div className="space-y-2">
                      <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                        <div 
                          style={{ width: `${grossInflow > 0 ? Math.min(100, Math.max(8, (fixedCommitments / grossInflow) * 100)) : 0}%` }}
                          className="bg-amber-500 transition-all duration-500" 
                          title={`Fixed Commitments: ${formatCurrency(fixedCommitments)}`}
                        />
                        <div 
                          style={{ width: `${grossInflow > 0 ? Math.min(100, Math.max(8, (discretionarySpend / grossInflow) * 100)) : 0}%` }}
                          className="bg-rose-500 transition-all duration-500" 
                          title={`Discretionary Spend: ${formatCurrency(discretionarySpend)}`}
                        />
                        <div 
                          style={{ width: `${grossInflow > 0 ? Math.min(100, Math.max(8, (Math.max(0, retainedSurplus) / grossInflow) * 100)) : 100}%` }}
                          className="bg-indigo-600 transition-all duration-500" 
                          title={`Retained Net Surplus: ${formatCurrency(retainedSurplus)}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                        <span>Total Inflow: <PrivacyValue value={formatCurrency(grossInflow)} /></span>
                        <span>Savings Rate: <strong className="text-slate-800">{grossInflow > 0 ? `${Math.max(0, Math.round((retainedSurplus / grossInflow) * 100))}%` : "0%"}</strong></span>
                        <span>Total Outflow: <PrivacyValue value={formatCurrency(monthlyExpenses)} /></span>
                      </div>
                    </div>

                    {/* Flow Columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                          <span>1. Inflow</span>
                          <ArrowRight size={13} className="text-emerald-500" />
                        </div>
                        <div className="text-lg font-bold text-emerald-950">
                          <PrivacyValue value={formatCurrency(grossInflow)} />
                        </div>
                        <span className="text-[10px] text-emerald-700 block">Active Salary</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                          <span>2. Fixed Dues</span>
                          <ArrowRight size={13} className="text-amber-500" />
                        </div>
                        <div className="text-lg font-bold text-amber-950">
                          <PrivacyValue value={formatCurrency(fixedCommitments)} />
                        </div>
                        <span className="text-[10px] text-amber-700 block">EMIs & Bills</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
                          <span>3. Discretionary</span>
                          <ArrowRight size={13} className="text-rose-500" />
                        </div>
                        <div className="text-lg font-bold text-rose-950">
                          <PrivacyValue value={formatCurrency(discretionarySpend)} />
                        </div>
                        <span className="text-[10px] text-rose-700 block">Living & Lifestyle</span>
                      </div>

                      <div className={`p-3.5 rounded-xl border space-y-1 ${
                        retainedSurplus >= 0 ? "bg-indigo-50/70 border-indigo-100" : "bg-red-50 border-red-100"
                      }`}>
                        <div className="flex items-center justify-between text-xs font-semibold text-indigo-800">
                          <span>4. Retained</span>
                          <Sparkles size={13} className="text-indigo-600" />
                        </div>
                        <div className="text-lg font-bold text-indigo-950">
                          <PrivacyValue value={formatCurrency(retainedSurplus)} />
                        </div>
                        <span className="text-[10px] text-indigo-700 block">
                          {retainedSurplus >= 0 ? "Compounding Growth" : "Deficit (Drain)"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* View 3: Expense Categories Donut */}
                {chartMode === "category" && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-6 h-[240px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseCategories}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {expenseCategories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any) => [formatCurrency(Number(value)), "Spent"]}
                            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="sm:col-span-6 space-y-2">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Top Expense Allocations
                      </div>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {expenseCategories.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="truncate font-medium text-slate-700">{c.name}</span>
                            </div>
                            <span className="font-bold text-slate-900 shrink-0 ml-2">
                              <PrivacyValue value={formatCurrency(c.value)} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right 4 Columns: AI Copilot & Proactive Digest Card */}
            <Card className="lg:col-span-4 rounded-2xl border-indigo-100 bg-gradient-to-b from-white via-indigo-50/20 to-slate-50/50 shadow-xs flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-indigo-100/60 bg-indigo-50/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                      <Bot size={16} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        AI Wealth Copilot
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-500">
                        Autonomous Sentinel &amp; Insights
                      </CardDescription>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Online
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                {/* Alert or Clean Status */}
                <div className="space-y-3">
                  {anomalyCount > 0 ? (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                          <ShieldAlert size={14} className="text-rose-600" />
                          <span>{anomalyCount} {anomalyCount === 1 ? 'Anomaly Flagged' : 'Anomalies Flagged'}</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase bg-rose-200/80 text-rose-800 px-1.5 py-0.2 rounded">
                          Action Needed
                        </span>
                      </div>
                      <p className="text-xs text-rose-700 leading-relaxed">
                        Potential subscription creep, duplicate charges, or outlier transactions caught by the autonomous radar.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        <span>Radar Status: Clear</span>
                      </div>
                      <p className="text-xs text-emerald-700">
                        Zero unauthorized price jumps or zombie subscriptions detected across your connected accounts.
                      </p>
                    </div>
                  )}

                  {/* Auto-Sweep & Liquidity Quick Fact */}
                  <div className="p-3.5 rounded-xl bg-slate-100/70 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1">
                        <Zap size={13} className="text-amber-500" />
                        <span>Surplus Auto-Sweep</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">Buffer ₹50k</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      The Ghost Accountant continuously sweeps surplus liquidity into high-yield liquid funds at ~7.1% yield.
                    </p>
                  </div>
                </div>

                {/* Direct Jumps to Dedicated Hubs */}
                <div className="space-y-2 pt-2 border-t border-slate-200/80">
                  <button
                    onClick={() => setActiveTab("ai-hub")}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs shadow-indigo-600/20"
                  >
                    <Bot size={14} />
                    <span>Open Autonomous AI Hub</span>
                    <ChevronRight size={14} />
                  </button>

                  <button
                    onClick={() => setActiveTab("scenarios")}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <Sliders size={13} className="text-indigo-600" />
                    <span>Launch What-If Sandbox</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Bottom Row: Connected Accounts, Recent Activity & Active Loan Portfolios */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Connected Accounts Card */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Wallet size={16} className="text-blue-600" />
                    <span>Connected Accounts</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">Operating banks & cash funds</CardDescription>
                </div>
                <Link href="/expenses?tab=accounts" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>Manage</span>
                  <ChevronRight size={13} />
                </Link>
              </CardHeader>
              <CardContent className="pt-2 flex-1 flex flex-col justify-between">
                {(!data.accounts || data.accounts.length === 0) ? (
                  <div className="py-8 text-center text-muted-foreground text-xs space-y-2 my-auto">
                    <CreditCard className="mx-auto text-slate-400" size={24} />
                    <p>No accounts registered yet.</p>
                    <Link href="/expenses?tab=accounts" className="text-xs text-indigo-600 hover:underline font-semibold block">
                      + Add your first account
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {data.accounts.map((acc: any) => (
                      <div key={acc.id || acc.name} className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            🏦
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{acc.name}</p>
                            <p className="text-[10px] text-slate-500">{acc.account_type || "Bank Account"}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-slate-900 font-mono">
                            <PrivacyValue value={formatCurrency(Number(acc.initial_balance) || 0)} />
                          </p>
                          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Total Liquid Funds:</span>
                  <span className="font-bold text-slate-900">
                    <PrivacyValue value={formatCurrency(totalBalance)} />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions Feed */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Recent Transactions</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Live entries from synced accounts</CardDescription>
                </div>
                <Link href="/expenses" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>View all</span>
                  <ChevronRight size={13} />
                </Link>
              </CardHeader>
              <CardContent className="pt-2">
                {recentTx.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-xs space-y-1">
                    <Clock className="mx-auto text-slate-400" size={24} />
                    <p>No recent transactions recorded yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentTx.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          }`}>
                            {tx.type === "income" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{tx.description}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <span className="font-medium text-slate-500">{tx.category}</span>
                              <span>•</span>
                              <span>{tx.date}</span>
                            </p>
                          </div>
                        </div>
                        <div className={`text-xs font-bold shrink-0 ${
                          tx.type === "income" ? "text-emerald-600" : "text-slate-900"
                        }`}>
                          <PrivacyValue value={tx.type === "income" ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Loans & Debt Summary */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Active Debt Facilities</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Monitored credit facilities &amp; EMIs</CardDescription>
                </div>
                <Link href="/loans" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>Loan manager</span>
                  <ChevronRight size={13} />
                </Link>
              </CardHeader>
              <CardContent className="pt-2">
                {(!data.loans || data.loans.length === 0) ? (
                  <div className="py-10 text-center text-muted-foreground text-xs space-y-2">
                    <Landmark className="mx-auto text-slate-400" size={24} />
                    <p>No active loans registered.</p>
                    <Link href="/loans" className="text-xs text-indigo-600 hover:underline font-semibold">
                      + Add a loan
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {data.loans.slice(0, 4).map((loan: any) => {
                      const p = Number(loan.principal) || 0;
                      const r = Number(loan.interest_rate) || 0;
                      const n = Number(loan.tenure_months) || (Number(loan.tenure_years) ? Number(loan.tenure_years) * 12 : 12);
                      const rMonthly = r / (12 * 100);
                      let emi = 0;
                      if (rMonthly > 0 && n > 0) {
                        emi = (p * rMonthly * Math.pow(1 + rMonthly, n)) / (Math.pow(1 + rMonthly, n) - 1);
                      } else if (n > 0) {
                        emi = p / n;
                      }

                      return (
                        <div key={loan.id} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-semibold text-xs text-slate-900 truncate">{loan.name || loan.bank_name || "Facility"}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {r}% Annual Interest • {n} Months
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-xs text-slate-900">
                              <PrivacyValue value={formatCurrency(p)} />
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              EMI: <span className="font-bold text-indigo-600"><PrivacyValue value={`${formatCurrency(emi)}/mo`} /></span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🤖 PERSPECTIVE 2: AUTONOMOUS AI HUB */}
      {/* ========================================================================= */}
      {activeTab === "ai-hub" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border border-emerald-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shrink-0">
                <Bot size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Autonomous Wealth Copilot Studio</h2>
                <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                  Intelligent background sentinel: real-time surplus auto-sweep simulator, budget velocity guardrails, and anomaly radar.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("overview")}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all self-start sm:self-auto shrink-0"
            >
              ← Back to Overview
            </button>
          </div>

          {/* Anomaly & Zombie Radar Component */}
          <AnomalyDetectorCard anomalies={data.anomalies} />

          {/* Ghost Accountant Autonomous Agent Engine */}
          <AutonomousAgentCard />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔮 PERSPECTIVE 3: SCENARIO & STRATEGY LAB */}
      {/* ========================================================================= */}
      {activeTab === "scenarios" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 text-white border border-indigo-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-400/30 shrink-0">
                <Sliders size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Predictive Scenario Sandbox</h2>
                <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                  Stress-test major decisions before spending a rupee. Simulate car loan amortizations, career sabbaticals, and compounded SIP boosts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("overview")}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all self-start sm:self-auto shrink-0"
            >
              ← Back to Overview
            </button>
          </div>

          {/* Full-width Scenario Sandbox Component */}
          <ScenarioSandbox
            totalBalance={totalBalance}
            monthlyIncome={monthlyIncome}
            monthlyExpenses={monthlyExpenses}
            totalInvestments={data.total_investments || 0}
            committedBills={committedBills}
            scheduledEmis={scheduledEmis}
            daysLeftInCycle={daysLeftInCycle}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌊 PERSPECTIVE 4: CASH FLOW & COMMITMENTS */}
      {/* ========================================================================= */}
      {activeTab === "cash-flow" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 text-white border border-amber-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30 shrink-0">
                <Layers size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Capital Allocation &amp; Waterfall Architecture</h2>
                <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                  Deep-dive visualization into how your gross earnings partition between fixed dues, lifestyle, and wealth retention.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("overview")}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all self-start sm:self-auto shrink-0"
            >
              ← Back to Overview
            </button>
          </div>

          {/* Full Cash Flow Stream & Waterfall */}
          <Card className="rounded-2xl border-slate-200/80 shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers size={18} className="text-indigo-600" /> Cash Flow Stream &amp; Capital Allocation
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Visualizing how your monthly inflow is allocated across fixed obligations, discretionary spend, and wealth retention.
                  </CardDescription>
                </div>
                <div className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
                  Net Savings Rate: {grossInflow > 0 ? `${Math.max(0, Math.round((retainedSurplus / grossInflow) * 100))}%` : "0%"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Segmented Flow Bar */}
              <div className="space-y-2">
                <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                  <div 
                    style={{ width: `${grossInflow > 0 ? Math.min(100, Math.max(8, (fixedCommitments / grossInflow) * 100)) : 0}%` }}
                    className="bg-amber-500 transition-all duration-500" 
                    title={`Fixed Commitments: ${formatCurrency(fixedCommitments)}`}
                  />
                  <div 
                    style={{ width: `${grossInflow > 0 ? Math.min(100, Math.max(8, (discretionarySpend / grossInflow) * 100)) : 0}%` }}
                    className="bg-rose-500 transition-all duration-500" 
                    title={`Discretionary Spend: ${formatCurrency(discretionarySpend)}`}
                  />
                  <div 
                    style={{ width: `${grossInflow > 0 ? Math.min(100, Math.max(8, (Math.max(0, retainedSurplus) / grossInflow) * 100)) : 100}%` }}
                    className="bg-indigo-600 transition-all duration-500" 
                    title={`Retained Net Surplus: ${formatCurrency(retainedSurplus)}`}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                  <span>Gross Inflow: <PrivacyValue value={formatCurrency(grossInflow)} /></span>
                  <span>Total Outflow: <PrivacyValue value={formatCurrency(monthlyExpenses)} /></span>
                </div>
              </div>

              {/* Interactive Flow Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">1. Total Inflow</span>
                    <ArrowRight size={14} className="text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold text-emerald-950">
                    <PrivacyValue value={formatCurrency(grossInflow)} />
                  </div>
                  <span className="text-xs text-emerald-700">Salary &amp; active income</span>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">2. Fixed Commitments</span>
                    <ArrowRight size={14} className="text-amber-500" />
                  </div>
                  <div className="text-xl font-bold text-amber-950">
                    <PrivacyValue value={formatCurrency(fixedCommitments)} />
                  </div>
                  <span className="text-xs text-amber-700">EMIs &amp; scheduled bills</span>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800">3. Discretionary</span>
                    <ArrowRight size={14} className="text-rose-500" />
                  </div>
                  <div className="text-xl font-bold text-rose-950">
                    <PrivacyValue value={formatCurrency(discretionarySpend)} />
                  </div>
                  <span className="text-xs text-rose-700">Lifestyle, food &amp; shopping</span>
                </div>

                <div className={`p-4 rounded-xl border space-y-1 ${
                  retainedSurplus >= 0 ? "bg-indigo-50/70 border-indigo-100" : "bg-red-50 border-red-100"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${retainedSurplus >= 0 ? "text-indigo-800" : "text-red-800"}`}>
                      4. Retained Wealth
                    </span>
                    <Sparkles size={14} className={retainedSurplus >= 0 ? "text-indigo-600" : "text-red-500"} />
                  </div>
                  <div className={`text-xl font-bold ${retainedSurplus >= 0 ? "text-indigo-950" : "text-red-900"}`}>
                    <PrivacyValue value={formatCurrency(retainedSurplus)} />
                  </div>
                  <span className={`text-xs ${retainedSurplus >= 0 ? "text-indigo-700" : "text-red-600"}`}>
                    {retainedSurplus >= 0 ? "Compounding / surplus" : "Deficit (draining balance)"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend & Expense Donut Side by Side */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Monthly Trend */}
            <Card className="lg:col-span-2 rounded-2xl border-slate-200/80 shadow-xs">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 size={17} className="text-indigo-600" /> Monthly Cash Flow Trend
                </CardTitle>
                <CardDescription className="text-xs">Income vs Expense comparison across recent months</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis 
                        tickLine={false} 
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                      />
                      <Tooltip 
                        formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                      <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieIcon size={17} className="text-indigo-600" /> Expense Breakdown
                </CardTitle>
                <CardDescription className="text-xs">Distribution by spending category</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[220px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expenseCategories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [formatCurrency(Number(value)), "Spent"]}
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t text-xs">
                  {expenseCategories.slice(0, 4).map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate text-slate-600">{c.name}</span>
                      <span className="font-bold ml-auto text-slate-800">
                        <PrivacyValue value={formatCurrency(c.value)} />
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
