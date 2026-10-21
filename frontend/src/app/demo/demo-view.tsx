"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Wallet,
  TrendingUp,
  CreditCard,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  Bot,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sliders,
  Sparkles,
  ShieldCheck,
  PlusCircle,
  FileSpreadsheet,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import DemoBanner from "./demo-banner";
import DemoMutationModal from "./demo-modal";
import { sampleDemoData, DemoTransaction } from "./demo-data";
import UpgradeModal from "@/components/UpgradeModal";
import { UpgradeModalProvider, useUpgradeModal } from "@/context/upgrade-modal-context";
import { SoundProvider } from "@/context/sound-context";
import { ToastProvider } from "@/context/toast-context";
import { CurrencyProvider, useCurrency } from "@/context/currency-context";
import { PrivacyProvider, PrivacyValue } from "@/context/privacy-context";

const PIE_COLORS = ["#167d6b", "#3f72af", "#df6c4f", "#d4a02e", "#8b5cf6"];

function DemoContent() {
  const { formatCurrency } = useCurrency();
  const { openUpgradeModal } = useUpgradeModal();

  const [activeTab, setActiveTab] = useState<"overview" | "loans" | "advisor" | "transactions">("overview");
  const [modalState, setModalState] = useState<{ isOpen: boolean; title?: string; description?: string }>({
    isOpen: false,
  });

  // Prepayment Simulator state
  const [extraPrepayment, setExtraPrepayment] = useState<number>(10000);
  const [sweepSimulated, setSweepSimulated] = useState<boolean>(false);
  const [txFilter, setTxFilter] = useState<string>("all");

  const openModal = (title?: string, description?: string) => {
    setModalState({ isOpen: true, title, description });
  };

  const closeModal = () => {
    setModalState({ isOpen: false });
  };

  const filteredTx = sampleDemoData.recent_transactions.filter((tx) => {
    if (txFilter === "all") return true;
    if (txFilter === "groceries") return tx.category.includes("Groceries");
    if (txFilter === "dining") return tx.category.includes("Discretionary");
    if (txFilter === "utilities") return tx.category.includes("Utilities");
    if (txFilter === "loans") return tx.category.includes("Housing");
    return true;
  });

  // Simulated interest savings calculation
  const calculatedSavings = extraPrepayment === 5000 ? 742000 : extraPrepayment === 10000 ? 1420000 : 2150000;
  const calculatedTenureReduced = extraPrepayment === 5000 ? "4 years 2 months" : extraPrepayment === 10000 ? "5 years 2 months" : "7 years 6 months";

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#15332f]">
      {/* Sticky Top Banner */}
      <DemoBanner onUpgradeClick={() => openUpgradeModal({ reason: "Sandbox demo live upgrade CTA" })} />

      {/* Demo App Header */}
      <header className="border-b border-[#15332f]/10 bg-white/90 backdrop-blur-md px-4 sm:px-8 py-3.5 sticky top-[57px] z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight text-[#15332f]">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#41e296] text-[#122b22]">
                <Landmark size={15} />
              </span>
              <span>Ledgerly</span>
            </Link>
            <span className="hidden sm:inline-block h-4 w-px bg-slate-200" />
            <span className="rounded-full bg-emerald-100/80 border border-emerald-300/60 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              Demo Persona: {sampleDemoData.profile.role} (₹1.2L/mo)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => openModal("Connect Your Live Bank Account", "In live mode, Ledgerly connects with HDFC, ICICI, SBI, and Axis statement parsers with automatic encrypted PDF decryption.")}
              className="flex items-center gap-1.5 rounded-lg border border-[#15332f]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#15332f] transition-all hover:bg-slate-50"
            >
              <FileSpreadsheet size={13} className="text-emerald-700" />
              <span className="hidden sm:inline">Upload Statement</span>
            </button>

            <button
              onClick={() => openModal("Log New Transaction", "Create a free account to log transactions instantly via Telegram bot, voice notes, or camera receipt OCR.")}
              className="flex items-center gap-1.5 rounded-lg bg-[#15332f] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#204943]"
            >
              <PlusCircle size={13} className="text-[#41e296]" />
              <span>Log Transaction</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Perspective Tabs */}
      <div className="border-b border-[#15332f]/10 bg-white px-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto py-2">
          {[
            { id: "overview", label: "Executive Overview", icon: Wallet },
            { id: "loans", label: "Loan Intelligence & Prepayment", icon: Landmark },
            { id: "advisor", label: "AI Advisor & Radar", icon: Bot },
            { id: "transactions", label: "Cash Flow & UPI Micro-Ledger", icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#15332f] text-white shadow-sm"
                    : "text-slate-600 hover:bg-[#15332f]/5 hover:text-[#15332f]"
                }`}
              >
                <Icon size={14} className={isActive ? "text-[#41e296]" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8">
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Top KPIs Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-[#15332f]/10 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Monthly Inflow</div>
                <div className="mt-2 text-2xl font-black text-emerald-800">
                  <PrivacyValue value={120000} />
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 flex items-center gap-0.5">
                  <ArrowUpRight size={12} />
                  <span>Salary on 1st of month</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#15332f]/10 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Monthly Outflow</div>
                <div className="mt-2 text-2xl font-black text-rose-800">
                  <PrivacyValue value={86500} />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  <span>₹65K EMI + ₹21.5K Living</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#15332f]/10 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Safe-to-Spend / Day</div>
                <div className="mt-2 text-2xl font-black text-[#15332f]">
                  <PrivacyValue value={1233} />
                </div>
                <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
                  <span>15 days left in cycle</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#15332f]/10 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Credit Score (CIBIL)</div>
                <div className="mt-2 text-2xl font-black text-indigo-900 flex items-baseline gap-1.5">
                  <span>785</span>
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Excellent</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  <span>Zero missed payments</span>
                </div>
              </div>
            </div>

            {/* Safe-to-Spend Commitment Breakdown Card */}
            <div className="rounded-2xl border border-[#15332f]/15 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#15332f] flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    Autonomous Safe-to-Spend Runway
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Calculated by reserving scheduled EMIs, registered utility bills, and emergency buffer from liquid accounts.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 self-start sm:self-auto">
                  Burn Rate: Healthy
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-[#f7f7f2] p-4 border border-[#15332f]/5">
                  <div className="text-xs text-slate-500">Liquid Checking</div>
                  <div className="text-lg font-extrabold text-[#15332f] mt-1">₹1,48,200</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">ICICI Salary Acct</div>
                </div>
                <div className="rounded-xl bg-rose-50/60 p-4 border border-rose-100">
                  <div className="text-xs text-rose-700 font-semibold">Scheduled Home EMI</div>
                  <div className="text-lg font-extrabold text-rose-900 mt-1">₹65,000</div>
                  <div className="text-[10px] text-rose-600 mt-0.5">HDFC Sarjapur Greens</div>
                </div>
                <div className="rounded-xl bg-amber-50/60 p-4 border border-amber-100">
                  <div className="text-xs text-amber-700 font-semibold">Pending Recurring Bills</div>
                  <div className="text-lg font-extrabold text-amber-900 mt-1">₹6,000</div>
                  <div className="text-[10px] text-amber-600 mt-0.5">Bescom + ACT + Gas</div>
                </div>
                <div className="rounded-xl bg-emerald-50/60 p-4 border border-emerald-100">
                  <div className="text-xs text-emerald-700 font-semibold">Uncommitted Idle Cash</div>
                  <div className="text-lg font-extrabold text-emerald-900 mt-1">₹18,500</div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">Available for Prepayment</div>
                </div>
              </div>
            </div>

            {/* Charts: Cash Flow Trend & Category Breakdown */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl border border-[#15332f]/15 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#15332f]">6-Month Inflow vs Outflow</h3>
                    <p className="text-xs text-slate-500">Consistent ₹1.2L salary with predictable Indian household costs</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                    Avg Savings: ₹33.8K/mo
                  </span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sampleDemoData.monthly_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                      <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, ""]} />
                      <Bar dataKey="income" name="Salary Inflow" fill="#167d6b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Outflow (EMI + Bills)" fill="#df6c4f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-[#15332f]/15 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#15332f] mb-1">Outflow by Category</h3>
                <p className="text-xs text-slate-500 mb-4">Home Loan EMI is dominant (75% of spend)</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sampleDemoData.expense_by_category}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {sampleDemoData.expense_by_category.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Amount"]} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Loan Intelligence & Prepayment */}
        {activeTab === "loans" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-[#15332f]/15 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-5">
                <div>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Active Home Loan
                  </span>
                  <h3 className="text-xl font-extrabold text-[#15332f] mt-1.5">
                    HDFC Bank Home Loan — Sarjapur Greens 3BHK
                  </h3>
                  <p className="text-xs text-slate-500">Account: 6248920194 • Sanctioned ₹52,00,000 @ 8.40% floating interest</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Monthly EMI</div>
                  <div className="text-2xl font-black text-rose-800">₹65,000</div>
                  <div className="text-[10px] text-slate-400">Due 5th of every month</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-[#f7f7f2] p-4">
                  <div className="text-xs text-slate-500">Original Principal</div>
                  <div className="text-lg font-bold text-[#15332f] mt-1">₹52,00,000</div>
                </div>
                <div className="rounded-xl bg-[#f7f7f2] p-4">
                  <div className="text-xs text-slate-500">Outstanding Balance</div>
                  <div className="text-lg font-bold text-rose-900 mt-1">₹48,95,000</div>
                </div>
                <div className="rounded-xl bg-[#f7f7f2] p-4">
                  <div className="text-xs text-slate-500">Remaining Tenure</div>
                  <div className="text-lg font-bold text-[#15332f] mt-1">18 Years (216 mos)</div>
                </div>
                <div className="rounded-xl bg-[#f7f7f2] p-4">
                  <div className="text-xs text-slate-500">Floating Interest Rate</div>
                  <div className="text-lg font-bold text-[#15332f] mt-1">8.40% p.a.</div>
                </div>
              </div>
            </div>

            {/* Interactive Prepayment Savings Simulator */}
            <div className="rounded-2xl border border-emerald-400/30 bg-[#122b22] text-white p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#41e296]/20 px-3 py-1 text-xs font-bold text-[#41e296]">
                    <Sparkles size={13} />
                    Autonomous Prepayment Simulator
                  </span>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
                    See How Much Interest You Can Wipe Out
                  </h3>
                  <p className="mt-1 text-xs text-emerald-100/70 max-w-xl">
                    By prepaying small incremental amounts from your idle monthly cash buffer, compound interest on your home loan drops drastically.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-black/40 p-1.5 border border-white/10 self-start sm:self-auto">
                  {[5000, 10000, 15000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setExtraPrepayment(amt)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                        extraPrepayment === amt
                          ? "bg-[#41e296] text-[#122b22] shadow"
                          : "text-emerald-100/70 hover:text-white"
                      }`}
                    >
                      +₹{amt.toLocaleString()}/mo
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Savings Card Result */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-emerald-200/70">Total Interest Saved</div>
                  <div className="mt-1 text-3xl font-black text-[#41e296]">
                    ₹{(calculatedSavings / 100000).toFixed(2)} Lakhs
                  </div>
                  <div className="mt-1 text-xs text-emerald-100/60">
                    Saves ₹{calculatedSavings.toLocaleString()} in interest
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-emerald-200/70">Tenure Reduced By</div>
                  <div className="mt-1 text-3xl font-black text-white">
                    {calculatedTenureReduced}
                  </div>
                  <div className="mt-1 text-xs text-emerald-100/60">
                    Loan finishes years earlier
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-emerald-200/70">Monthly Budget Impact</div>
                  <div className="mt-1 text-3xl font-black text-amber-300">
                    ₹{extraPrepayment.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-emerald-100/60">
                    Leaves ₹{(18500 - extraPrepayment).toLocaleString()} liquid buffer
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
                <p className="text-xs text-emerald-100/60">
                  Ready to link your real bank loan account and calculate precise amortization?
                </p>
                <button
                  onClick={() => openModal("Track Your Own Home Loan", "Create a free Ledgerly account to add your home, car, or personal loan, generate exact amortization schedules, and simulate prepayments.")}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#41e296] px-5 py-2.5 text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300"
                >
                  <span>Connect Real Loan Schedule</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: AI Advisor & Radar */}
        {activeTab === "advisor" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Actionable AI Recommendations */}
            <div className="rounded-2xl border border-[#15332f]/15 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#15332f] flex items-center gap-2">
                    <Bot size={18} className="text-[#167d6b]" />
                    AI Financial Advisor Recommendations
                  </h3>
                  <p className="text-xs text-slate-500">Autonomous synthesis across banking, loan schedule, and recurring bills</p>
                </div>
                <span className="rounded-full bg-[#15332f] px-2.5 py-0.5 text-[10px] font-bold text-[#41e296]">
                  3 Active Directives
                </span>
              </div>

              <div className="space-y-4">
                {sampleDemoData.aiInsights.map((insight) => (
                  <div key={insight.id} className="rounded-xl border border-slate-200 bg-[#f7f7f2]/60 p-4 transition-all hover:border-[#167d6b]/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#167d6b]">
                        {insight.tag}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">High ROI</span>
                    </div>
                    <h4 className="mt-1 text-sm font-bold text-[#15332f]">{insight.title}</h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{insight.recommendation}</p>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200/60 pt-3">
                      <div className="text-[11px] font-semibold text-emerald-800">
                        ⚡ Impact: {insight.impact}
                      </div>
                      <button
                        onClick={() => {
                          if (insight.id === "ai-1") {
                            setSweepSimulated(!sweepSimulated);
                          } else {
                            openModal(insight.title, "In your private workspace, the AI Financial Advisor executes directives with 1 click directly into your ledger.");
                          }
                        }}
                        className="rounded-lg bg-[#15332f] px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-[#204943] self-start sm:self-auto"
                      >
                        {insight.id === "ai-1" && sweepSimulated ? "✅ Sweep Simulation Active (-₹15k)" : insight.actionLabel}
                      </button>
                    </div>

                    {insight.id === "ai-1" && sweepSimulated && (
                      <div className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-50 p-3 text-xs text-emerald-900">
                        🎉 <span className="font-bold">Simulated Action:</span> ₹15,000 swept into HDFC Home Loan prepayment. Total projected interest decreased by ₹1,42,000. ICICI buffer maintained at ₹33,200.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Zombie Subscription & Anomaly Detector */}
            <div className="rounded-2xl border border-[#15332f]/15 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#15332f] flex items-center gap-2">
                    <AlertTriangle size={17} className="text-amber-500" />
                    Anomaly & Zombie Subscription Radar
                  </h3>
                  <p className="text-xs text-slate-500">Flags quiet price hikes, double debits, and draining unused SaaS</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {sampleDemoData.anomalies.map((anom) => (
                  <div key={anom.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        anom.severity === "high" ? "text-rose-600" : anom.severity === "medium" ? "text-amber-600" : "text-blue-600"
                      }`}>
                        {anom.type.replace("_", " ")}
                      </span>
                      <span className="text-xs font-black text-[#15332f]">₹{anom.amount.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 font-bold text-xs text-[#15332f]">{anom.title}</div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-normal">{anom.message}</p>
                    <button
                      onClick={() => openModal(`Take Action: ${anom.title}`, "Cancel subscriptions, dispute billing creep, and set category alert guardrails with 1 click in your live account.")}
                      className="mt-3 text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
                    >
                      Dismiss / Cancel →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Cash Flow & UPI Micro-Ledger */}
        {activeTab === "transactions" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-2xl border border-[#15332f]/15 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-[#15332f]">Indian UPI Micro-Transaction Feed</h3>
                  <p className="text-xs text-slate-500">Auto-categorized from simulated ICICI & HDFC statement uploads</p>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {[
                    { id: "all", label: "All" },
                    { id: "groceries", label: "Groceries (UPI)" },
                    { id: "dining", label: "Dining & Delivery" },
                    { id: "utilities", label: "Utilities" },
                    { id: "loans", label: "Home EMI" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setTxFilter(f.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors ${
                        txFilter === f.id
                          ? "bg-[#15332f] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredTx.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                        tx.type === "income" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {tx.type === "income" ? "↓" : "↑"}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#15332f]">{tx.description}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span>{tx.category}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-700">{tx.channel || "UPI"}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`text-xs font-black ${
                      tx.type === "income" ? "text-emerald-700" : "text-[#15332f]"
                    }`}>
                      {tx.type === "income" ? "+" : "-"}₹{tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mutation Interceptor Modal */}
      <DemoMutationModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        actionTitle={modalState.title}
        actionDescription={modalState.description}
      />

      {/* Upgrade Modal */}
      <UpgradeModal />
    </div>
  );
}

export default function DemoView() {
  return (
    <PrivacyProvider>
      <CurrencyProvider>
        <SoundProvider>
          <ToastProvider>
            <UpgradeModalProvider>
              <DemoContent />
            </UpgradeModalProvider>
          </ToastProvider>
        </SoundProvider>
      </CurrencyProvider>
    </PrivacyProvider>
  );
}
