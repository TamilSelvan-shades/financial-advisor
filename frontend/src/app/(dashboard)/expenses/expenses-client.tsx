"use client";

import React, { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AnomalyDetectorCard } from "@/components/anomaly-detector-card";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  PlusCircle,
  Trash2,
  Upload,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sliders,
  Receipt,
  Search,
  Filter,
  BarChart3,
  Clock,
  Landmark,
  Sparkles,
  Wifi,
  ShieldCheck,
  Tag,
  ArrowRight,
  Camera,
  Mic,
  Lock,
  Eye,
} from "lucide-react";
import { useCurrency } from "@/context/currency-context";
import ReceiptScannerModal from "@/components/receipt-scanner-modal";
import VoiceLedgerModal from "@/components/voice-ledger-modal";

type Expense = {
  id: number;
  amount: number;
  category: string;
  date: string;
  description?: string;
  account?: string;
  remarks?: string;
};

type Income = {
  id: number;
  amount: number;
  category: string;
  date: string;
  description?: string;
  account?: string;
  remarks?: string;
};

type Account = {
  id: number;
  name: string;
  account_type?: string;
  initial_balance?: number;
};

type Budget = {
  id?: number;
  category: string;
  monthly_limit: number;
};

type BalanceAdjustment = {
  id: number;
  date: string;
  account: string;
  amount: number;
  reason?: string;
};

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#14b8a6",
  "#6366f1",
];

const MONTH_NAMES = [
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
];

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
}

function CategoryIcon({ category }: { category: string }) {
  const cat = category.toLowerCase();
  if (cat.includes("food") || cat.includes("dining") || cat.includes("restaurant")) return <span>🍔</span>;
  if (cat.includes("grocer") || cat.includes("supermarket")) return <span>🛒</span>;
  if (cat.includes("fuel") || cat.includes("transport") || cat.includes("petrol") || cat.includes("uber")) return <span>⛽</span>;
  if (cat.includes("bill") || cat.includes("utilit") || cat.includes("electric")) return <span>⚡</span>;
  if (cat.includes("shop") || cat.includes("cloth")) return <span>🛍️</span>;
  if (cat.includes("travel") || cat.includes("flight") || cat.includes("hotel")) return <span>✈️</span>;
  if (cat.includes("fitness") || cat.includes("sport") || cat.includes("gym")) return <span>🏋️</span>;
  if (cat.includes("health") || cat.includes("med") || cat.includes("pharmacy")) return <span>💊</span>;
  if (cat.includes("salary") || cat.includes("income") || cat.includes("dividend")) return <span>💼</span>;
  if (cat.includes("invest") || cat.includes("fund") || cat.includes("stock")) return <span>📈</span>;
  return <span>💳</span>;
}

function ExpensesContent({ initialData }: { initialData?: any }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") || "monthly";

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [expenses, setExpenses] = useState<Expense[]>(initialData?.expenses || []);
  const [incomes, setIncomes] = useState<Income[]>(initialData?.incomes || []);
  const [accounts, setAccounts] = useState<Account[]>(initialData?.accounts || []);
  const [budgets, setBudgets] = useState<Budget[]>(initialData?.budgets || []);
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>(initialData?.balance_adjustments || []);
  const [anomalies, setAnomalies] = useState<any[]>(initialData?.anomalies || []);
  const [loading, setLoading] = useState(!initialData);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Global Currency Formatting
  const { formatCurrency, currency } = useCurrency();
  const formatINR = (val: number | null | undefined) => formatCurrency(val);

  // Multimodal Modal States
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);

  // Statement Parsing & Preview States
  const [statementPassword, setStatementPassword] = useState<string>("");
  const [statementPasswordHint, setStatementPasswordHint] = useState<string | null>(null);
  const [statementPreview, setStatementPreview] = useState<any | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const statementFormRef = useRef<HTMLFormElement>(null);

  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    MONTH_NAMES[new Date().getMonth()]
  );
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Category Budgets Collapsible State
  const [budgetExpanderOpen, setBudgetExpanderOpen] = useState(true);
  const [budgetCategoryInput, setBudgetCategoryInput] = useState("");
  const [budgetLimitInput, setBudgetLimitInput] = useState("5000");

  // Form submitting states
  const [submitting, setSubmitting] = useState(false);

  // Ledger table filters
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState("All Accounts");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("All");
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Log Form Type
  const [logTxType, setLogTxType] = useState<"Expense" | "Income">("Expense");
  const [logCategoryInput, setLogCategoryInput] = useState("");

  // Keep activeTab in sync with query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") || "monthly";
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, activeTab]);

  const switchTab = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/expenses?tab=${tabId}`);
  };

  // Load Data
  async function loadData() {
    try {
      const res = await fetchWithAuthClient("/api/v1/dashboard/");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const data = await res.json();
      setExpenses(data.expenses || []);
      setIncomes(data.incomes || []);
      setAccounts(data.accounts || []);
      setBudgets(data.budgets || []);
      setAdjustments(data.balance_adjustments || []);
      setAnomalies(data.anomalies || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData) {
      setExpenses(initialData.expenses || []);
      setIncomes(initialData.incomes || []);
      setAccounts(initialData.accounts || []);
      setBudgets(initialData.budgets || []);
      setAdjustments(initialData.balance_adjustments || []);
      setAnomalies(initialData.anomalies || []);
      setLoading(false);
    } else {
      loadData();
    }
  }, [initialData]);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  // Derive unique years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    expenses.forEach((e) => {
      if (e.date) {
        const y = parseInt(e.date.split("-")[0]);
        if (!isNaN(y)) years.add(y);
      }
    });
    incomes.forEach((i) => {
      if (i.date) {
        const y = parseInt(i.date.split("-")[0]);
        if (!isNaN(y)) years.add(y);
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses, incomes]);

  // Derive account names
  const accountNames = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => a.name && set.add(a.name));
    expenses.forEach((e) => e.account && set.add(e.account));
    incomes.forEach((i) => i.account && set.add(i.account));
    return Array.from(set).sort();
  }, [accounts, expenses, incomes]);

  // Calculate Account Balances
  const accountBalances = useMemo(() => {
    const balances: Record<
      string,
      { initial: number; deposits: number; withdrawals: number; adjustments: number; current: number; id?: number; type?: string }
    > = {};

    accountNames.forEach((name) => {
      const matchAcc = accounts.find((a) => a.name?.toLowerCase() === name.toLowerCase());
      const initBal = matchAcc?.initial_balance !== undefined && matchAcc?.initial_balance !== null
        ? Number(matchAcc.initial_balance)
        : 0;
      const accId = matchAcc?.id;
      const accType = matchAcc?.account_type || "Bank Account";

      const dep = incomes
        .filter((i) => (i.account || "").toLowerCase() === name.toLowerCase())
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

      const wth = expenses
        .filter((e) => (e.account || "").toLowerCase() === name.toLowerCase())
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const adj = adjustments
        .filter((a) => (a.account || "").toLowerCase() === name.toLowerCase())
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

      balances[name] = {
        initial: initBal,
        deposits: dep,
        withdrawals: wth,
        adjustments: adj,
        current: initBal + dep - wth + adj,
        id: accId,
        type: accType,
      };
    });

    return balances;
  }, [accountNames, accounts, incomes, expenses, adjustments]);

  const totalLiquidFunds = useMemo(() => {
    return Object.values(accountBalances).reduce((acc, b) => acc + b.current, 0);
  }, [accountBalances]);

  // Current month prefix & spending
  const currentMonthPrefix = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const curMExpTotal = useMemo(() => {
    return expenses
      .filter((e) => e.date && e.date.startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses, currentMonthPrefix]);

  // Unified Ledger Entries
  const unifiedLedger = useMemo(() => {
    const entries: {
      id: number;
      date: string;
      type: "Expense" | "Income";
      account: string;
      category: string;
      amount: number;
      description: string;
      remarks: string;
    }[] = [];

    expenses.forEach((e) => {
      entries.push({
        id: e.id,
        date: e.date || "",
        type: "Expense",
        account: e.account || "ICICI Savings Account",
        category: e.category || "General",
        amount: -(Number(e.amount) || 0),
        description: e.description || "",
        remarks: e.remarks || "",
      });
    });

    incomes.forEach((i) => {
      entries.push({
        id: i.id,
        date: i.date || "",
        type: "Income",
        account: i.account || "ICICI Savings Account",
        category: i.category || "Salary",
        amount: Number(i.amount) || 0,
        description: i.description || "",
        remarks: i.remarks || "",
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, incomes]);

  // Filtered Ledger Entries
  const filteredLedger = useMemo(() => {
    return unifiedLedger.filter((item) => {
      if (ledgerAccountFilter !== "All Accounts" && item.account !== ledgerAccountFilter) {
        return false;
      }
      if (ledgerTypeFilter !== "All" && item.type !== ledgerTypeFilter) {
        return false;
      }
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        return (
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.remarks.toLowerCase().includes(q) ||
          item.account.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [unifiedLedger, ledgerAccountFilter, ledgerTypeFilter, ledgerSearch]);

  // Delete transaction
  const handleDeleteTransaction = async (type: "Expense" | "Income", id: number) => {
    if (!confirm(`Are you sure you want to delete this ${type.toLowerCase()} record?`)) return;
    try {
      const endpoint = type === "Expense" ? `/api/v1/expenses/${id}` : `/api/v1/incomes/${id}`;
      const res = await fetchWithAuthClient(endpoint, { method: "DELETE" });
      if (res.ok) {
        showNotification(`${type} deleted successfully!`);
        await loadData();
      } else {
        showNotification(`Failed to delete ${type.toLowerCase()}.`, "error");
      }
    } catch (err) {
      showNotification(`Error: ${String(err)}`, "error");
    }
  };

  // Delete budget
  const handleDeleteBudget = async (id?: number) => {
    if (!id) return;
    if (!confirm("Are you sure you want to remove this category budget?")) return;
    try {
      const res = await fetchWithAuthClient(`/api/v1/budgets/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("Budget deleted successfully.");
        await loadData();
      } else {
        showNotification("Failed to delete budget.", "error");
      }
    } catch (err) {
      showNotification(`Error: ${String(err)}`, "error");
    }
  };

  // Save budget
  const handleSaveBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const category = budgetCategoryInput.trim();
    const monthly_limit = parseFloat(budgetLimitInput);

    if (!category) {
      showNotification("Please specify a category name.", "error");
      setSubmitting(false);
      return;
    }
    if (isNaN(monthly_limit) || monthly_limit <= 0) {
      showNotification("Please specify a valid monthly limit.", "error");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuthClient("/api/v1/budgets/", {
        method: "POST",
        body: JSON.stringify({ category, monthly_limit }),
      });
      if (res.ok) {
        showNotification(`Budget limit for "${category}" set to ${formatINR(monthly_limit)}`);
        setBudgetCategoryInput("");
        await loadData();
      } else {
        showNotification("Failed to save budget limit.", "error");
      }
    } catch (err) {
      showNotification(`Error: ${String(err)}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Add Account
  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get("name") as string)?.trim();
    const account_type = (formData.get("account_type") as string) || "Bank Account";
    const initial_balance = parseFloat(formData.get("initial_balance") as string) || 0;

    if (!name) {
      showNotification("Account name is required.", "error");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuthClient("/api/v1/accounts/", {
        method: "POST",
        body: JSON.stringify({ name, account_type, initial_balance }),
      });
      if (res.ok) {
        form.reset();
        showNotification(`Account "${name}" created successfully.`);
        await loadData();
      } else {
        showNotification("Failed to create account.", "error");
      }
    } catch (err) {
      showNotification(`Error: ${String(err)}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Log Income / Expense
  const handleLogTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const date = (formData.get("date") as string) || new Date().toISOString().split("T")[0];
    const category = logCategoryInput.trim() || (formData.get("category") as string)?.trim() || (logTxType === "Income" ? "Salary" : "General");
    const amount = parseFloat(formData.get("amount") as string);
    const account = (formData.get("account") as string) || "ICICI Savings Account";
    const description = (formData.get("description") as string)?.trim() || category;
    const remarks = (formData.get("remarks") as string)?.trim() || "";

    if (isNaN(amount) || amount <= 0) {
      showNotification("Please enter a valid amount.", "error");
      setSubmitting(false);
      return;
    }

    try {
      const endpoint = logTxType === "Income" ? "/api/v1/incomes/" : "/api/v1/expenses/";
      const res = await fetchWithAuthClient(endpoint, {
        method: "POST",
        body: JSON.stringify({ date, category, amount, account, description, remarks }),
      });

      if (res.ok) {
        form.reset();
        setLogCategoryInput("");
        showNotification(`${logTxType} of ${formatINR(amount)} saved successfully! Switched to Monthly Overview.`);
        await loadData();
        switchTab("monthly");
      } else {
        showNotification(`Failed to record ${logTxType.toLowerCase()}.`, "error");
      }
    } catch (err) {
      showNotification(`Error: ${String(err)}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Statement Preview
  const handlePreviewStatement = async () => {
    if (!statementFormRef.current) return;
    setIsPreviewing(true);
    setStatementPasswordHint(null);
    setStatementPreview(null);
    const formData = new FormData(statementFormRef.current);
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      showNotification("Please select a statement file first.", "error");
      setIsPreviewing(false);
      return;
    }

    try {
      const res = await fetchWithAuthClient("/api/v1/statements/parse", {
        method: "POST",
        body: formData,
      });

      const resData = await res.json();
      if (res.status === 422 && resData.error === "PASSWORD_REQUIRED") {
        setStatementPasswordHint(resData.hint || "This statement is encrypted. Please enter the password.");
        showNotification(`Password required for ${resData.bank || "this PDF"}.`, "error");
      } else if (res.ok && resData.success && resData.data) {
        setStatementPreview(resData.data);
        showNotification(`Preview loaded: ${resData.data.total_transactions} transactions from ${resData.data.bank_name}!`);
      } else {
        showNotification(resData.detail || "Failed to preview statement.", "error");
      }
    } catch (err) {
      showNotification(`Preview Error: ${String(err)}`, "error");
    } finally {
      setIsPreviewing(false);
    }
  };

  // Handle Statement Ingest Commit
  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setStatementPasswordHint(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      showNotification("Please select a file to upload.", "error");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuthClient("/api/v1/statements/upload", {
        method: "POST",
        body: formData,
      });

      const resData = await res.json();
      if (res.status === 422 && resData.error === "PASSWORD_REQUIRED") {
        setStatementPasswordHint(resData.hint || "This statement is encrypted. Please enter the password.");
        showNotification(`Password required for ${resData.bank || "this PDF"}. Please enter password and retry.`, "error");
      } else if (res.ok) {
        showNotification(resData.message || "File parsed and transactions ingested successfully!");
        form.reset();
        setStatementPreview(null);
        setStatementPassword("");
        await loadData();
      } else {
        showNotification(resData.detail || "Failed to process statement file.", "error");
      }
    } catch (err) {
      showNotification(`Upload Error: ${String(err)}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl shadow-slate-950/10 border border-slate-800/80 relative overflow-hidden">
        {/* Glow ambient effects */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
            <Sparkles size={13} />
            <span>
              {activeTab === "monthly" && "Monthly Overview"}
              {activeTab === "annual" && "Annual Trends & Cash Flow"}
              {activeTab === "custom" && "Custom Range Analysis"}
              {activeTab === "accounts" && "Accounts & Unified Ledger"}
              {activeTab === "budgets" && "Category Budgets & Limits"}
              {activeTab === "log" && "Log Income / Expense"}
              {activeTab === "import" && "Bank Statement Ingestion"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Income, Expenses & Ledger Management
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Real-time financial telemetry, multi-account ledger balances, dynamic category budget limits, and bank statement ingestion.
          </p>
        </div>

        {/* Live Quick Stats Chips */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex flex-col">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-300">Total Liquid Funds</span>
            <span className="text-base font-bold text-emerald-400">{formatINR(totalLiquidFunds)}</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex flex-col">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-300">Active Budgets</span>
            <span className="text-base font-bold text-white">{budgets.length} Categories</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex flex-col">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-300">This Month Outflow</span>
            <span className="text-base font-bold text-rose-400">{formatINR(curMExpTotal)}</span>
          </div>

          {/* Multimodal Quick Actions */}
          <button
            type="button"
            onClick={() => setIsReceiptModalOpen(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-indigo-500/25 hover:bg-indigo-500/40 text-white text-xs font-bold border border-indigo-400/40 shadow-sm flex items-center gap-2 transition-all cursor-pointer backdrop-blur-md hover:scale-[1.02]"
            title="Scan paper receipt or digital invoice with camera"
          >
            <Camera size={14} className="text-indigo-300" />
            <span>📸 Scan Receipt</span>
          </button>

          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-violet-500/25 hover:bg-violet-500/40 text-white text-xs font-bold border border-violet-400/40 shadow-sm flex items-center gap-2 transition-all cursor-pointer backdrop-blur-md hover:scale-[1.02]"
            title="Record voice expense or income note"
          >
            <Mic size={14} className="text-violet-300" />
            <span>🎙️ Speak Txn</span>
          </button>
        </div>
      </div>

      {/* Dynamic Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-all shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertCircle size={20} className="text-red-600" />}
          <span>{feedback.message}</span>
        </div>
      )}



      {loading ? (
        <div className="p-16 text-center space-y-4 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent" />
          <p className="text-slate-600 text-sm font-medium">Synchronizing accounts and financial telemetry...</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. MONTHLY DASHBOARD */}
          {/* ========================================================================= */}
          {activeTab === "monthly" && (
            <div className="space-y-6">
              {/* 🛡️ Phase 2: Anomaly & Subscription Guardian */}
              <AnomalyDetectorCard anomalies={anomalies} />

              {/* Year & Month Control Card */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Year</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Month</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {MONTH_NAMES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <Calendar size={14} className="text-indigo-600" />
                  <span>Viewing period: {selectedMonth} {selectedYear}</span>
                </div>
              </div>

              {(() => {
                const mIdx = MONTH_NAMES.indexOf(selectedMonth) + 1;
                const prefix = `${selectedYear}-${String(mIdx).padStart(2, "0")}`;

                const mExp = expenses.filter((e) => e.date && e.date.startsWith(prefix));
                const mInc = incomes.filter((i) => i.date && i.date.startsWith(prefix));

                const totMInc = mInc.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const totMExp = mExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                const totMNet = totMInc - totMExp;
                const savingsRate = totMInc > 0 ? (totMNet / totMInc) * 100 : 0;

                const catTotals: Record<string, { total: number; count: number }> = {};
                mExp.forEach((e) => {
                  const cat = e.category || "Other";
                  const amt = Number(e.amount) || 0;
                  if (!catTotals[cat]) catTotals[cat] = { total: 0, count: 0 };
                  catTotals[cat].total += amt;
                  catTotals[cat].count += 1;
                });

                const pieData = Object.entries(catTotals)
                  .map(([name, val]) => ({ name, value: val.total }))
                  .sort((a, b) => b.value - a.value);

                const topCategories = [...pieData].slice(0, 10).reverse();

                return (
                  <div className="space-y-6">
                    {/* 4 KPI Metric Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Total Income
                          </CardTitle>
                          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <ArrowUpRight size={16} />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-emerald-600">{formatINR(totMInc)}</div>
                          <p className="text-xs text-slate-400 mt-1">Cash inflow for month</p>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Total Expenses
                          </CardTitle>
                          <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                            <ArrowDownRight size={16} />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-rose-600">{formatINR(totMExp)}</div>
                          <p className="text-xs text-slate-400 mt-1">Cash outflow for month</p>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Net Savings
                          </CardTitle>
                          <div className={`p-1.5 rounded-lg ${totMNet >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                            {totMNet >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold ${totMNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {formatINR(totMNet)}
                          </div>
                          <span
                            className={`inline-block mt-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                              totMNet >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {totMNet >= 0 ? `+${formatINR(totMNet)}` : `-${formatINR(Math.abs(totMNet))}`}
                          </span>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Savings Rate
                          </CardTitle>
                          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <ShieldCheck size={16} />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-slate-900">{savingsRate.toFixed(1)}%</div>
                          <span
                            className={`inline-block mt-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                              savingsRate >= 20 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {savingsRate >= 20 ? "Healthy (>20%)" : "Low (<20%)"}
                          </span>
                        </CardContent>
                      </Card>
                    </div>

                    {mExp.length === 0 && mInc.length === 0 ? (
                      <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-2">
                        <Receipt className="mx-auto text-slate-400" size={40} />
                        <p className="text-slate-800 font-semibold text-base">
                          No transactions recorded for {selectedMonth} {selectedYear}.
                        </p>
                        <p className="text-slate-400 text-xs">
                          Switch to &quot;Log Income / Expense&quot; to log entries or &quot;Import Statement / Spreadsheet&quot; to ingest your statement.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Donut Chart */}
                          <Card className="rounded-3xl border-slate-200 shadow-sm">
                            <CardHeader>
                              <CardTitle className="text-base font-bold flex items-center gap-2">
                                <span>📊</span> Expenses Breakdown — {selectedMonth} {selectedYear}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-[290px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={pieData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={65}
                                      outerRadius={95}
                                      paddingAngle={3}
                                      dataKey="value"
                                      label={({ name, percent }) =>
                                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                      }
                                    >
                                      {pieData.map((entry, index) => (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                                        />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => formatINR(Number(value))} />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Top 10 Categories Bar Chart */}
                          <Card className="rounded-3xl border-slate-200 shadow-sm">
                            <CardHeader>
                              <CardTitle className="text-base font-bold flex items-center gap-2">
                                <span>🏆</span> Top 10 Expense Categories
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-[290px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={topCategories}
                                    layout="vertical"
                                    margin={{ top: 10, right: 30, left: 35, bottom: 5 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} tick={{ fill: "#64748b", fontSize: 11 }} />
                                    <YAxis dataKey="name" type="category" width={110} tick={{ fill: "#64748b", fontSize: 11 }} />
                                    <Tooltip formatter={(value: any) => formatINR(Number(value))} />
                                    <Bar dataKey="value" name="Amount" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Category Summary Table */}
                        <Card className="rounded-3xl border-slate-200 shadow-sm">
                          <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                              <span>📋</span> Category Summary & Percentage Allocation
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b">
                                <tr>
                                  <th className="px-4 py-3">Category</th>
                                  <th className="px-4 py-3 text-right">Total Spent (₹)</th>
                                  <th className="px-4 py-3 text-center">Transactions</th>
                                  <th className="px-4 py-3 text-right">% of Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {pieData.map((item) => {
                                  const pct = totMExp > 0 ? (item.value / totMExp) * 100 : 0;
                                  const count = catTotals[item.name]?.count || 1;
                                  return (
                                    <tr key={item.name} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="px-4 py-3.5 font-semibold text-slate-800 flex items-center gap-2">
                                        <CategoryIcon category={item.name} />
                                        <span>{item.name}</span>
                                      </td>
                                      <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                                        {formatINR(item.value)}
                                      </td>
                                      <td className="px-4 py-3.5 text-center text-slate-500 font-medium">{count}</td>
                                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-600">
                                        {pct.toFixed(1)}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. ANNUAL DASHBOARD */}
          {/* ========================================================================= */}
          {activeTab === "annual" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold uppercase text-slate-500">Select Calendar Year</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="h-9 px-3 border border-slate-300 rounded-xl bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const yExp = expenses.filter((e) => e.date && e.date.startsWith(`${selectedYear}`));
                const yInc = incomes.filter((i) => i.date && i.date.startsWith(`${selectedYear}`));

                const totYInc = yInc.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const totYExp = yExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                const totYNet = totYInc - totYExp;
                const ySavingsRate = totYInc > 0 ? (totYNet / totYInc) * 100 : 0;

                const monthlyTrend = MONTH_NAMES.map((m, idx) => {
                  const prefix = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
                  const inc = yInc
                    .filter((i) => i.date && i.date.startsWith(prefix))
                    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
                  const exp = yExp
                    .filter((e) => e.date && e.date.startsWith(prefix))
                    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
                  return {
                    month: m,
                    Income: inc,
                    Expense: exp,
                    Net: inc - exp,
                  };
                });

                const catYMap: Record<string, number> = {};
                yExp.forEach((e) => {
                  const cat = e.category || "Other";
                  catYMap[cat] = (catYMap[cat] || 0) + (Number(e.amount) || 0);
                });
                const catYList = Object.entries(catYMap)
                  .map(([name, amt]) => ({ name, amt }))
                  .sort((a, b) => b.amt - a.amt);

                return (
                  <div className="space-y-6">
                    {/* Annual KPIs */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Annual Income</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-emerald-600">{formatINR(totYInc)}</div>
                          <p className="text-xs text-slate-400 mt-1">Calendar Year {selectedYear}</p>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Annual Expenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-rose-600">{formatINR(totYExp)}</div>
                          <p className="text-xs text-slate-400 mt-1">Calendar Year {selectedYear}</p>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Annual Net Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold ${totYNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {formatINR(totYNet)}
                          </div>
                          <span
                            className={`inline-block mt-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                              totYNet >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {totYNet >= 0 ? `+${formatINR(totYNet)}` : `-${formatINR(Math.abs(totYNet))}`}
                          </span>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Annual Savings Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-slate-900">{ySavingsRate.toFixed(1)}%</div>
                          <p className="text-xs text-slate-400 mt-1">Total Year Margin</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Grouped Bar Chart with SVG Gradients */}
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <span>📊</span> Monthly Inflow vs Outflow Cash Flow ({selectedYear})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[360px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyTrend} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                              <YAxis tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} tick={{ fill: "#64748b", fontSize: 11 }} />
                              <Tooltip formatter={(value: any) => formatINR(Number(value))} />
                              <Legend wrapperStyle={{ fontSize: "12px" }} />
                              <Bar dataKey="Income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                              <Bar dataKey="Expense" name="Expense" fill="#ef4444" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Category Summary */}
                    <Card className="rounded-3xl border-slate-200 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-bold">🏷️ Annual Spending by Category ({selectedYear})</CardTitle>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b">
                            <tr>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3 text-right">Amount (₹)</th>
                              <th className="px-4 py-3 text-right">% of Annual Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {catYList.map((c) => {
                              const pct = totYExp > 0 ? (c.amt / totYExp) * 100 : 0;
                              return (
                                <tr key={c.name} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3.5 font-semibold text-slate-800 flex items-center gap-2">
                                    <CategoryIcon category={c.name} />
                                    <span>{c.name}</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                                    {formatINR(c.amt)}
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-semibold text-indigo-600">
                                    {pct.toFixed(2)}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. CUSTOM DASHBOARD */}
          {/* ========================================================================= */}
          {activeTab === "custom" && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-10 px-3 border border-slate-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-10 px-3 border border-slate-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Range Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 30);
                      setCustomStartDate(d.toISOString().split("T")[0]);
                      setCustomEndDate(new Date().toISOString().split("T")[0]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors"
                  >
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 90);
                      setCustomStartDate(d.toISOString().split("T")[0]);
                      setCustomEndDate(new Date().toISOString().split("T")[0]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors"
                  >
                    Last 90 Days
                  </button>
                  <button
                    onClick={() => {
                      setCustomStartDate(`${new Date().getFullYear()}-01-01`);
                      setCustomEndDate(new Date().toISOString().split("T")[0]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors"
                  >
                    Year to Date
                  </button>
                </div>
              </div>

              {(() => {
                const cExp = expenses.filter(
                  (e) => e.date && e.date >= customStartDate && e.date <= customEndDate
                );
                const cInc = incomes.filter(
                  (i) => i.date && i.date >= customStartDate && i.date <= customEndDate
                );

                const totCInc = cInc.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const totCExp = cExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                const totCNet = totCInc - totCExp;
                const cSavingsRate = totCInc > 0 ? (totCNet / totCInc) * 100 : 0;

                const cCatTotals: Record<string, number> = {};
                cExp.forEach((e) => {
                  const cat = e.category || "Other";
                  cCatTotals[cat] = (cCatTotals[cat] || 0) + (Number(e.amount) || 0);
                });
                const cPieData = Object.entries(cCatTotals)
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value);

                return (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Period Income</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-emerald-600">{formatINR(totCInc)}</div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Period Expenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-rose-600">{formatINR(totCExp)}</div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Period Net Savings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold ${totCNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {formatINR(totCNet)}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Period Savings Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-slate-900">{cSavingsRate.toFixed(1)}%</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base font-bold">Spending Distribution in Period</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[290px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={cPieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={65}
                                  outerRadius={95}
                                  paddingAngle={3}
                                  dataKey="value"
                                  label={({ name, percent }) =>
                                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                  }
                                >
                                  {cPieData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => formatINR(Number(value))} />
                                <Legend wrapperStyle={{ fontSize: "11px" }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-3xl border-slate-200 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base font-bold">Top Categories in Period</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b">
                              <tr>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3 text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {cPieData.map((item) => (
                                <tr key={item.name} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3.5 font-semibold text-slate-800 flex items-center gap-2">
                                    <CategoryIcon category={item.name} />
                                    <span>{item.name}</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                                    {formatINR(item.value)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. ACCOUNTS & BALANCES (Revolut / Apple Wallet Digital Cards) */}
          {/* ========================================================================= */}
          {activeTab === "accounts" && (
            <div className="space-y-6">
              {/* Total Liquid Funds Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Wallet size={15} />
                    <span>Consolidated Liquid Reserves</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black mt-1 text-white">
                    {formatINR(totalLiquidFunds)}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Real-time aggregated liquid funds across all registered accounts.
                  </p>
                </div>

                {/* Add Account Inline Form */}
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                  <form onSubmit={handleAddAccount} className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      name="name"
                      required
                      placeholder="Account Name (e.g. HDFC Salary)"
                      className="h-9 px-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                    <select
                      name="account_type"
                      defaultValue="Savings Account"
                      className="h-9 px-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    >
                      <option value="Savings Account" className="bg-slate-900 text-white">Savings Account</option>
                      <option value="Salary Account" className="bg-slate-900 text-white">Salary Account</option>
                      <option value="Current Account" className="bg-slate-900 text-white">Current Account</option>
                      <option value="Fixed Deposit / Term" className="bg-slate-900 text-white">Fixed Deposit</option>
                      <option value="Digital Wallet" className="bg-slate-900 text-white">Digital Wallet</option>
                      <option value="Cash In Hand" className="bg-slate-900 text-white">Cash In Hand</option>
                    </select>
                    <input
                      name="initial_balance"
                      type="number"
                      step="0.01"
                      placeholder="Initial ₹ (0.00)"
                      className="h-9 w-28 px-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-xs shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
                    >
                      + Create Account
                    </button>
                  </form>
                </div>
              </div>

              {/* Digital Bank Cards Grid (Revolut / Apple Wallet style) */}
              {Object.keys(accountBalances).length === 0 ? (
                <div className="p-8 text-center rounded-3xl border border-dashed border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <Wallet size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Financial Accounts Linked</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-2">
                    Create an account using the form above to track liquid balances, register transactions, and reconcile statements.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(accountBalances).map(([accName, info], idx) => {
                    const cardGradients = [
                      "from-slate-950 via-slate-900 to-indigo-950",
                      "from-emerald-950 via-slate-900 to-teal-950",
                      "from-blue-950 via-slate-900 to-indigo-950",
                      "from-purple-950 via-slate-900 to-rose-950",
                    ];
                    const cardBg = cardGradients[idx % cardGradients.length];

                    return (
                      <div
                        key={accName}
                        className={`relative bg-gradient-to-br ${cardBg} p-6 rounded-3xl text-white shadow-xl border border-white/10 flex flex-col justify-between h-[210px] overflow-hidden hover:scale-[1.02] transition-transform duration-300`}
                      >
                        {/* Decorative Sheen */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                        {/* Card Top Row: EMV Chip & Account Type */}
                        <div className="flex items-center justify-between z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-7 bg-amber-200/80 rounded-md border border-amber-300/60 shadow-inner flex items-center justify-center">
                              <div className="w-5 h-4 border border-amber-800/40 rounded-sm" />
                            </div>
                            <Wifi size={16} className="text-slate-400 rotate-90" />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
                              {info.type || "SAVINGS"}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Active
                            </span>
                            {info.id && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete account "${accName}"?`)) return;
                                  try {
                                    const res = await fetchWithAuthClient(`/api/v1/accounts/${info.id}`, {
                                      method: "DELETE",
                                    });
                                    if (res.ok) {
                                      showNotification("Account removed.");
                                      await loadData();
                                    }
                                  } catch (e) {
                                    showNotification(String(e), "error");
                                  }
                                }}
                                className="text-slate-400 hover:text-red-400 p-1 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Card Middle: Balance */}
                        <div className="z-10">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                              Liquid Balance
                            </span>
                            {info.initial > 0 && (
                              <span className="text-[10px] text-slate-400">
                                Base: {formatINR(info.initial)}
                              </span>
                            )}
                          </div>
                          <div className="text-2xl font-black tracking-tight text-white mt-0.5">
                            {formatINR(info.current)}
                          </div>
                        </div>

                        {/* Card Bottom: Account Name & Flow Badges */}
                        <div className="z-10 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                          <div className="font-bold text-slate-200 truncate max-w-[140px]">{accName}</div>
                          <div className="flex items-center gap-2 text-[10px] font-semibold">
                            <span className="text-emerald-400">+{formatINR(info.deposits)}</span>
                            <span className="text-rose-400">-{formatINR(info.withdrawals)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unified Ledger History */}
              <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <span>📑</span> Unified Ledger History
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Complete chronological journal of all incoming and outgoing cash flows.
                      </CardDescription>
                    </div>

                    {/* Filter controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search transactions..."
                          value={ledgerSearch}
                          onChange={(e) => setLedgerSearch(e.target.value)}
                          className="h-9 pl-9 pr-3 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40 sm:w-56"
                        />
                      </div>

                      <select
                        value={ledgerAccountFilter}
                        onChange={(e) => setLedgerAccountFilter(e.target.value)}
                        className="h-9 px-3 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="All Accounts">All Accounts</option>
                        {accountNames.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>

                      <select
                        value={ledgerTypeFilter}
                        onChange={(e) => setLedgerTypeFilter(e.target.value)}
                        className="h-9 px-3 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="All">All Flows</option>
                        <option value="Expense">Expense Only</option>
                        <option value="Income">Income Only</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {filteredLedger.length === 0 ? (
                    <p className="py-12 text-center text-slate-400 text-sm">No ledger entries match your filter criteria.</p>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Flow</th>
                          <th className="px-4 py-3">Account</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Amount (₹)</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLedger.slice(0, 50).map((row) => (
                          <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{row.date}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  row.type === "Income"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 font-semibold whitespace-nowrap">
                              {row.account}
                            </td>
                            <td className="px-4 py-3 text-slate-600 flex items-center gap-1.5">
                              <CategoryIcon category={row.category} />
                              <span>{row.category}</span>
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
                                row.amount >= 0 ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {row.amount >= 0 ? `+${formatINR(row.amount)}` : formatINR(row.amount)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={row.description}>
                              {row.description || "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDeleteTransaction(row.type, row.id)}
                                title="Delete record"
                                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. CATEGORY BUDGETS (Executive Health Matrix - Highlighted in screenshot) */}
          {/* ========================================================================= */}
          {activeTab === "budgets" && (
            <div className="space-y-6">
              {/* Executive Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="text-rose-600">🎯</span> Category Spending vs Budget Limits
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live adherence matrix for {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                    {budgets.length} Configured Limits
                  </span>
                </div>
              </div>

              {/* Progress Cards Matrix */}
              {(() => {
                const now = new Date();
                const curPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                const curMExp = expenses.filter((e) => e.date && e.date.startsWith(curPrefix));

                if (budgets.length === 0) {
                  return (
                    <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-2">
                      <Sliders className="mx-auto text-slate-400" size={40} />
                      <p className="text-slate-800 font-semibold text-base">No budgets configured yet.</p>
                      <p className="text-slate-400 text-xs">
                        Use the tool below to establish spending ceilings for dining, travel, fuel, or groceries.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-6 md:grid-cols-2">
                    {budgets.map((b) => {
                      const lim = Number(b.monthly_limit) || 0;
                      const spent = curMExp
                        .filter((e) => e.category?.toLowerCase() === b.category?.toLowerCase())
                        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                      const pct = lim > 0 ? (spent / lim) * 100 : 0;
                      const clampedPct = Math.min(pct, 100);
                      const remaining = Math.max(0, lim - spent);

                      let barGradient = "from-blue-600 to-indigo-600";
                      let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";

                      if (pct >= 100) {
                        barGradient = "from-rose-500 to-red-600";
                        badgeColor = "bg-rose-100 text-rose-800 border-rose-300";
                      } else if (pct >= 80) {
                        barGradient = "from-amber-400 to-orange-500";
                        badgeColor = "bg-amber-100 text-amber-800 border-amber-300";
                      }

                      return (
                        <Card key={b.category} className="rounded-3xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-lg border border-slate-200">
                                  <CategoryIcon category={b.category} />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-base">{b.category}</div>
                                  <div className="text-xs text-slate-500">
                                    {formatINR(spent)} of {formatINR(lim)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
                                  {pct.toFixed(0)}%
                                </span>
                                {b.id && (
                                  <button
                                    onClick={() => handleDeleteBudget(b.id)}
                                    title="Delete budget"
                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-slate-100"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Dual-tone Gradient Progress Bar */}
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                              <div
                                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${barGradient}`}
                                style={{ width: `${clampedPct}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-slate-400">
                                {pct >= 100 ? (
                                  <span className="text-rose-600 font-bold flex items-center gap-1">
                                    🚨 Exceeded by {formatINR(spent - lim)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 font-medium">
                                    {formatINR(remaining)} remaining
                                  </span>
                                )}
                              </span>
                              <span className="text-slate-400 text-[11px]">Monthly Cap</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Accordion / Collapsible Form matching screenshot: "> ⚙️ Set or Adjust Monthly Category Budget" */}
              <div className="border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setBudgetExpanderOpen((prev) => !prev)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    {budgetExpanderOpen ? <ChevronDown size={18} className="text-indigo-600" /> : <ChevronRight size={18} className="text-indigo-600" />}
                    ⚙️ Set or Adjust Monthly Category Budget
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    {budgetExpanderOpen ? "Click to collapse" : "Click to expand form"}
                  </span>
                </button>

                {budgetExpanderOpen && (
                  <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
                    {/* Quick Category Suggestion Pills */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Quick Select Category</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["Travel", "Groceries", "Food & Dining", "Sports & Fitness", "Transport & Fuel", "Utilities & Bills", "Entertainment", "Shopping", "Healthcare"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setBudgetCategoryInput(c)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors border ${
                              budgetCategoryInput === c
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleSaveBudget} className="flex flex-wrap gap-4 items-end pt-2">
                      <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <label className="text-xs font-semibold text-slate-600 uppercase">Category Name</label>
                        <input
                          value={budgetCategoryInput}
                          onChange={(e) => setBudgetCategoryInput(e.target.value)}
                          required
                          placeholder="e.g. Travel, Groceries, Sports & Fitness"
                          className="w-full h-10 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-[160px]">
                        <label className="text-xs font-semibold text-slate-600 uppercase">
                          Monthly Limit (₹)
                        </label>
                        <input
                          value={budgetLimitInput}
                          onChange={(e) => setBudgetLimitInput(e.target.value)}
                          type="number"
                          step="100"
                          min="1"
                          required
                          className="w-full h-10 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="h-10 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors shadow-md shadow-slate-950/20 disabled:opacity-50"
                      >
                        {submitting ? "Saving..." : "Save Budget Limit"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. LOG INCOME / EXPENSE */}
          {/* ========================================================================= */}
          {activeTab === "log" && (
            <div className="space-y-6">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100">
                  <CardTitle className="text-lg font-extrabold flex items-center gap-2">
                    📝 Manual Transaction Entry Form
                  </CardTitle>
                  <CardDescription>
                    Record a single inflow or outflow transaction with automated account assignment.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleLogTransaction} className="space-y-6">
                    {/* Transaction Type Segmented Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase text-slate-500">Select Cash Flow Direction</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLogTxType("Expense")}
                          className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
                            logTxType === "Expense"
                              ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <ArrowDownRight size={17} /> Expense (Outflow)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogTxType("Income")}
                          className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
                            logTxType === "Income"
                              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <ArrowUpRight size={17} /> Income (Inflow)
                        </button>
                      </div>
                    </div>

                    {/* Quick Category Suggestion Pills */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Quick Suggest Category</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(logTxType === "Income"
                          ? ["Salary", "Interest Received", "Dividends", "Freelance", "Cash Deposit", "Other Income"]
                          : ["Food & Dining", "Groceries", "Transport & Fuel", "Utilities & Bills", "Shopping", "Entertainment", "Healthcare", "Travel", "Fitness", "Loans & EMI"]
                        ).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setLogCategoryInput(c)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors border ${
                              logCategoryInput === c
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-600">Date</label>
                        <input
                          name="date"
                          type="date"
                          required
                          defaultValue={new Date().toISOString().split("T")[0]}
                          className="w-full h-11 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-600">Amount (₹)</label>
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          className="w-full h-11 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-base"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-600">Category</label>
                        <input
                          name="category"
                          value={logCategoryInput}
                          onChange={(e) => setLogCategoryInput(e.target.value)}
                          required
                          placeholder="Category Name"
                          className="w-full h-11 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-600">Target Account</label>
                        <select
                          name="account"
                          className="w-full h-11 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium cursor-pointer"
                        >
                          {accountNames.map((acc) => (
                            <option key={acc} value={acc}>
                              {acc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-600">Description (Optional)</label>
                        <input
                          name="description"
                          placeholder="e.g. Swiggy, Uber, Client Payment"
                          className="w-full h-11 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-600">Remarks (Optional)</label>
                        <input
                          name="remarks"
                          placeholder="Additional notes"
                          className="w-full h-11 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className={`h-11 px-10 rounded-xl text-white font-bold text-sm transition-all shadow-md disabled:opacity-50 ${
                          logTxType === "Expense"
                            ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
                            : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
                        }`}
                      >
                        {submitting ? "Recording..." : `Commit ${logTxType}`}
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. UNIVERSAL MULTI-BANK & ENCRYPTED STATEMENT INGESTION */}
          {/* ========================================================================= */}
          {activeTab === "import" && (
            <div className="space-y-6">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-extrabold flex items-center gap-2">
                        <span>Universal Multi-Bank Statement Ingestion</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                          PDF • XLSX • CSV
                        </span>
                      </CardTitle>
                      <CardDescription>
                        Auto-detects HDFC, SBI, Axis, Kotak, ICICI, Amex, and spreadsheets with password decryption and auto-account matching.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Multi-Bank Badges */}
                  <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-blue-900 flex items-center gap-1">🏦 HDFC Bank</p>
                      <p className="text-[11px] text-blue-700">PDF / CC / XLS</p>
                    </div>
                    <div className="p-3 bg-sky-50/80 border border-sky-100 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-sky-900 flex items-center gap-1">🏦 SBI Bank</p>
                      <p className="text-[11px] text-sky-700">DOB+Mobile / PAN</p>
                    </div>
                    <div className="p-3 bg-rose-50/80 border border-rose-100 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-rose-900 flex items-center gap-1">🏦 Axis Bank</p>
                      <p className="text-[11px] text-rose-700">PDF / PAN Decrypt</p>
                    </div>
                    <div className="p-3 bg-red-50/80 border border-red-100 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-red-900 flex items-center gap-1">🏦 Kotak Bank</p>
                      <p className="text-[11px] text-red-700">CRN / DOB Decrypt</p>
                    </div>
                    <div className="p-3 bg-amber-50/80 border border-amber-100 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-amber-900 flex items-center gap-1">🏦 ICICI Bank</p>
                      <p className="text-[11px] text-amber-700">PDF & OpHistory</p>
                    </div>
                    <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-indigo-900 flex items-center gap-1">💳 Amex & CSV</p>
                      <p className="text-[11px] text-indigo-700">Auto Column Map</p>
                    </div>
                  </div>

                  {/* Statement Password Hint Alert if required */}
                  {statementPasswordHint && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 animate-in fade-in duration-200">
                      <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">Password-Protected PDF Detected</p>
                        <p className="text-amber-800">{statementPasswordHint}</p>
                      </div>
                    </div>
                  )}

                  {/* Upload Form */}
                  <form ref={statementFormRef} onSubmit={handleFileUpload} className="space-y-5">
                    <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <Upload size={24} />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Select statement file to ingest</p>
                      <p className="text-xs text-slate-400 mt-1">Supports PDF (encrypted or plain), XLSX, XLS, or CSV</p>
                      <input
                        name="file"
                        type="file"
                        required
                        accept=".pdf,.xlsx,.xls,.csv"
                        className="mt-4 block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer max-w-sm mx-auto shadow-sm"
                      />
                    </div>

                    {/* PDF Statement Password Input Field */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                        <Lock size={13} className="text-indigo-600" />
                        <span>PDF Statement Password (Optional)</span>
                      </label>
                      <input
                        name="password"
                        type="password"
                        value={statementPassword}
                        onChange={(e) => setStatementPassword(e.target.value)}
                        placeholder="e.g. PAN, DOB (DDMMYYYY), or mobile number if PDF is protected"
                        className="w-full h-11 px-3.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <p className="text-[11px] text-slate-400">
                        Leave blank if your statement is not password-protected. Passwords are processed strictly in-memory during decryption and never saved.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <input
                          id="replace_all"
                          name="replace_all"
                          type="checkbox"
                          value="true"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="replace_all" className="text-xs font-semibold text-slate-700 cursor-pointer">
                          Replace existing records with statement data
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Preview Button */}
                        <button
                          type="button"
                          disabled={isPreviewing || submitting}
                          onClick={handlePreviewStatement}
                          className="h-11 px-6 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Eye size={14} className="text-indigo-600" />
                          <span>{isPreviewing ? "Analyzing..." : "🔍 Preview Statement"}</span>
                        </button>

                        {/* Direct Ingest Button */}
                        <button
                          type="submit"
                          disabled={submitting || isPreviewing}
                          className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-slate-950/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          <FileSpreadsheet size={15} />
                          <span>{submitting ? "Ingesting..." : "⚡ Direct Ingest"}</span>
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Interactive Statement Preview Card */}
                  {statementPreview && (
                    <div className="mt-6 border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-md animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                              Statement Verified
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-white border border-indigo-400/30">
                              {statementPreview.bank_name}
                            </span>
                          </div>
                          <div className="text-base font-extrabold text-white mt-0.5">
                            Account: {statementPreview.account_name}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                            <span className="text-slate-300 text-[10px] block">Inflows</span>
                            <span className="font-bold text-emerald-400">
                              +{formatCurrency(statementPreview.total_credits)}
                            </span>
                          </div>
                          <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                            <span className="text-slate-300 text-[10px] block">Outflows</span>
                            <span className="font-bold text-rose-400">
                              -{formatCurrency(statementPreview.total_debits)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Transactions Table Preview */}
                      <div className="p-4 overflow-x-auto max-h-72 divide-y divide-slate-100">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[11px] font-bold uppercase text-slate-400 border-b border-slate-100 pb-2">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {statementPreview.transactions?.slice(0, 15).map((txn: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-slate-500">{txn.date}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate">
                                  {txn.description}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                    {txn.category}
                                  </span>
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-bold font-mono ${
                                    txn.type === "income" ? "text-emerald-600" : "text-rose-600"
                                  }`}
                                >
                                  {txn.type === "income" ? "+" : "-"}
                                  {formatCurrency(txn.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          Showing first {Math.min(15, statementPreview.total_transactions)} of {statementPreview.total_transactions} parsed transactions
                        </span>

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            if (statementFormRef.current) {
                              statementFormRef.current.requestSubmit();
                            }
                          }}
                          className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 size={14} />
                          <span>Commit & Ingest All {statementPreview.total_transactions} Transactions</span>
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Multimodal Modals */}
      <ReceiptScannerModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onSuccess={() => loadData()}
      />
      <VoiceLedgerModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}

export default function ExpensesClient({ initialData }: { initialData?: any }) {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400 text-sm">Loading financial intelligence...</div>}>
      <ExpensesContent initialData={initialData} />
    </Suspense>
  );
}
