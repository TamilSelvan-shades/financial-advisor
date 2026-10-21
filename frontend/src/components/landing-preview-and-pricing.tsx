"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Crown,
  FileSpreadsheet,
  Flame,
  Landmark,
  MessageSquare,
  Mic,
  PieChart as PieIcon,
  Receipt,
  ScanLine,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

export default function LandingPreviewAndPricing() {
  // Preview Tabs state
  const [activePreviewTab, setActivePreviewTab] = useState<"capture" | "statement" | "advisor">("capture");

  // Fast Capture simulation state
  const [simulatedMsgIndex, setSimulatedMsgIndex] = useState(0);
  const sampleMessages = [
    {
      input: "Paid ₹850 for groceries via UPI @ Nature's Basket",
      type: "Telegram Voice / UPI Text",
      amount: "₹850.00",
      category: "Groceries",
      account: "ICICI Savings Account",
      prevSafe: "₹24,800",
      newSafe: "₹23,950",
      budgetInfo: "₹5,500 / ₹8,800 (62% used)",
    },
    {
      input: "Swiggy dinner order ₹680 paid with Google Pay",
      type: "UPI Push Notification",
      amount: "₹680.00",
      category: "Discretionary Dining",
      account: "ICICI Savings Account",
      prevSafe: "₹23,950",
      newSafe: "₹23,270",
      budgetInfo: "₹7,450 / ₹10,000 (74% used)",
    },
    {
      input: "Bescom electricity bill paid ₹3,200",
      type: "Telegram Text Message",
      amount: "₹3,200.00",
      category: "Utilities",
      account: "ICICI Savings Account",
      prevSafe: "₹23,270",
      newSafe: "₹20,070",
      budgetInfo: "₹3,200 / ₹4,000 (80% used)",
    },
  ];

  // Statement & Loan Prepayment Simulator state
  const [prepaymentAmt, setPrepaymentAmt] = useState<number>(5000);

  // AI Advisor Sweep simulation state
  const [isSweepSimulated, setIsSweepSimulated] = useState<boolean>(false);

  // Pricing Interval state
  const [pricingInterval, setPricingInterval] = useState<"monthly" | "annual">("annual");
  const isAnnual = pricingInterval === "annual";

  const plusMonthlyRate = isAnnual ? "159" : "199";
  const proMonthlyRate = isAnnual ? "399" : "499";
  const proOriginalRate = isAnnual ? "799" : "999";

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          SECTION: Interactive Product Preview ("See How Ledgerly Works")
          ───────────────────────────────────────────────────────────── */}
      <section className="border-b border-[#15332f]/10 bg-[#122b22] text-white py-20 sm:py-28 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-[#41e296]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-5 sm:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#41e296] mb-3">
              <span className="h-px w-6 bg-[#41e296]" />
              Interactive Product Walkthrough
              <span className="h-px w-6 bg-[#41e296]" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold tracking-tight text-white leading-tight">
              See How Ledgerly Works
            </h2>
            <p className="mt-4 text-base sm:text-lg text-emerald-100/70 leading-relaxed">
              Experience the autonomous intelligence that runs your accounts, debt, and cash-flow without manual spreadsheets.
            </p>

            {/* Selectable Preview Tabs */}
            <div className="mt-8 inline-flex rounded-xl border border-white/10 bg-black/30 p-1.5 shadow-inner">
              <button
                onClick={() => setActivePreviewTab("capture")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                  activePreviewTab === "capture"
                    ? "bg-[#41e296] text-[#122b22] shadow"
                    : "text-emerald-100/70 hover:text-white"
                }`}
              >
                <Mic size={15} />
                <span>Fast Capture (Telegram & Voice)</span>
              </button>

              <button
                onClick={() => setActivePreviewTab("statement")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                  activePreviewTab === "statement"
                    ? "bg-[#41e296] text-[#122b22] shadow"
                    : "text-emerald-100/70 hover:text-white"
                }`}
              >
                <Landmark size={15} />
                <span>Statement & Loan Intelligence</span>
              </button>

              <button
                onClick={() => setActivePreviewTab("advisor")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                  activePreviewTab === "advisor"
                    ? "bg-[#41e296] text-[#122b22] shadow"
                    : "text-emerald-100/70 hover:text-white"
                }`}
              >
                <Sparkles size={15} />
                <span>AI Financial Advisor</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Fast Capture (Telegram & Voice) Mock Card */}
          {activePreviewTab === "capture" && (
            <div className="grid gap-6 lg:grid-cols-12 items-center animate-in fade-in duration-300">
              {/* Left Column: Simulated Chat Conversation */}
              <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-[#41e296] animate-pulse" />
                    <span>Ledgerly Telegram Bot & Voice Engine</span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-100/50">⚡ 420ms response</span>
                </div>

                {/* Sample Selector Buttons */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {sampleMessages.map((msg, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSimulatedMsgIndex(idx)}
                      className={`text-[11px] px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                        simulatedMsgIndex === idx
                          ? "bg-[#41e296] text-[#122b22] font-bold"
                          : "bg-white/10 text-emerald-100/70 hover:bg-white/15"
                      }`}
                    >
                      Sample #{idx + 1}
                    </button>
                  ))}
                </div>

                {/* Message Bubble: Incoming */}
                <div className="flex justify-end mb-4">
                  <div className="rounded-2xl rounded-tr-none bg-[#167d6b] p-4 text-white max-w-sm shadow-md">
                    <div className="flex items-center gap-2 text-[10px] text-emerald-200/80 uppercase font-bold tracking-wider mb-1">
                      <Mic size={12} />
                      <span>{sampleMessages[simulatedMsgIndex].type}</span>
                    </div>
                    <p className="text-sm font-medium leading-snug">
                      "{sampleMessages[simulatedMsgIndex].input}"
                    </p>
                    <span className="text-[10px] text-emerald-100/50 block text-right mt-1">20:29 • Seen</span>
                  </div>
                </div>

                {/* Message Bubble: Bot Response */}
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-none border border-white/10 bg-white/[0.08] p-4 text-emerald-50 max-w-sm shadow-md">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#41e296] mb-2">
                      <Check size={14} className="stroke-[3]" />
                      <span>Parsed & Recorded to Ledger</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-emerald-100/60">Amount:</span>
                        <span className="font-bold text-white font-mono">
                          {sampleMessages[simulatedMsgIndex].amount}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-emerald-100/60">Category:</span>
                        <span className="font-semibold text-emerald-200">
                          {sampleMessages[simulatedMsgIndex].category}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-emerald-100/60">Account:</span>
                        <span className="text-emerald-200">
                          {sampleMessages[simulatedMsgIndex].account}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-emerald-100/60">Monthly Budget:</span>
                        <span className="text-emerald-300 font-mono text-[11px]">
                          {sampleMessages[simulatedMsgIndex].budgetInfo}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Safe-to-Spend Balance Reaction Card */}
              <div className="lg:col-span-6 rounded-2xl border border-[#41e296]/30 bg-gradient-to-br from-[#15332f] to-[#0e2019] p-6 sm:p-8 shadow-2xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#41e296]/20 px-3 py-1 text-xs font-bold text-[#41e296] mb-4">
                  <Zap size={13} />
                  <span>Real-Time Safe-to-Spend Balance Update</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  Zero Reconciliations. Instant Guidance.
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-emerald-100/70 leading-relaxed">
                  The moment your voice note or UPI transaction is parsed, Ledgerly automatically recalculates your remaining safe-to-spend allowance for the cycle.
                </p>

                <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-100/60 font-medium">Safe-to-Spend Runway</span>
                    <span className="rounded-md bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-[#41e296]">
                      15 Days Remaining
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-emerald-100/50 uppercase">Prior Balance</div>
                      <div className="text-lg font-mono font-semibold text-emerald-100/70 line-through">
                        {sampleMessages[simulatedMsgIndex].prevSafe}
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-[#41e296]" />
                    <div className="text-right">
                      <div className="text-[10px] text-[#41e296] uppercase font-bold">Updated Allowance</div>
                      <div className="text-3xl font-mono font-extrabold text-[#41e296]">
                        {sampleMessages[simulatedMsgIndex].newSafe}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-[11px] text-emerald-100/60 border-t border-white/10 pt-3">
                    💡 Safe-to-spend pace: <span className="text-white font-bold">₹1,596/day</span> after reserving ₹65K EMI and bills.
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <Link
                    href="/demo"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#41e296] px-5 py-2.5 text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300"
                  >
                    <span>Test Interactive Demo</span>
                    <ArrowRight size={14} />
                  </Link>
                  <span className="text-xs text-emerald-100/50">No sign-up required</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Statement & Loan Intelligence Mock Card */}
          {activePreviewTab === "statement" && (
            <div className="grid gap-6 lg:grid-cols-12 items-center animate-in fade-in duration-300">
              {/* Left Column: 3-Month Bank Statement Auto-Categorization */}
              <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <FileSpreadsheet size={15} className="text-[#41e296]" />
                    <span>3-Month Bank Statement Auto-Ingestion</span>
                  </div>
                  <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-[#41e296]">
                    HDFC & SBI Verified
                  </span>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.04] p-4 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-100/70">Statements Ingested:</span>
                    <span className="font-bold text-white">HDFC_Savings_Q3.pdf (Encrypted)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <span className="text-emerald-100/70">Processed In:</span>
                    <span className="font-mono text-emerald-300">1.2 seconds • 148 Transactions</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <span className="text-emerald-100/70">Categorization Accuracy:</span>
                    <span className="font-bold text-[#41e296]">98.4% without manual rules</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <span className="text-emerald-100/80">Housing & Home Loan EMI</span>
                    <span className="font-mono font-bold text-rose-300">₹65,000 / mo</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <span className="text-emerald-100/80">Systematic Investment Plans (SIP)</span>
                    <span className="font-mono font-bold text-[#41e296]">₹20,000 / mo</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <span className="text-emerald-100/80">Utilities & Broadband</span>
                    <span className="font-mono font-bold text-amber-300">₹6,000 / mo</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <span className="text-emerald-100/80">Groceries & UPI Micro-spends</span>
                    <span className="font-mono font-bold text-emerald-200">₹5,500 / mo</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Home Loan Prepayment Savings Card */}
              <div className="lg:col-span-6 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-[#15332f] to-[#0e2019] p-6 sm:p-8 shadow-2xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#41e296]/20 px-3 py-1 text-xs font-bold text-[#41e296] mb-3">
                  <Landmark size={13} />
                  <span>Home Loan EMI Amortization & Prepayment</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  ₹50 Lakhs Home Loan @ 8.5%
                </h3>
                <p className="mt-1 text-xs text-emerald-100/70">
                  Standard EMI: ₹43,391/mo for 20 years. Toggle extra prepayment below:
                </p>

                {/* Prepayment Selector */}
                <div className="mt-5 flex gap-2">
                  {[5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setPrepaymentAmt(amt)}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                        prepaymentAmt === amt
                          ? "bg-[#41e296] text-[#122b22] shadow"
                          : "bg-white/10 text-emerald-100/70 hover:bg-white/15"
                      }`}
                    >
                      +₹{amt.toLocaleString()}/month Extra
                    </button>
                  ))}
                </div>

                {/* Savings Breakdown */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="text-[11px] text-emerald-200/70">Total Interest Saved</div>
                    <div className="text-2xl font-black text-[#41e296] mt-1 font-mono">
                      {prepaymentAmt === 5000 ? "₹7,42,000" : "₹14,20,000"}
                    </div>
                    <div className="text-[10px] text-emerald-100/50 mt-0.5">Direct interest wiped out</div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="text-[11px] text-emerald-200/70">Tenure Reduced</div>
                    <div className="text-2xl font-black text-white mt-1">
                      {prepaymentAmt === 5000 ? "4 Yrs 2 Mos" : "5 Yrs 2 Mos"}
                    </div>
                    <div className="text-[10px] text-emerald-100/50 mt-0.5">Debt-free years ahead</div>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href="/demo"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#41e296] px-5 py-2.5 text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300"
                  >
                    <span>Simulate Your Own Loan</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI Financial Advisor Mock Card */}
          {activePreviewTab === "advisor" && (
            <div className="grid gap-6 lg:grid-cols-12 items-center animate-in fade-in duration-300">
              {/* Left Column: Actionable AI Insight Card */}
              <div className="lg:col-span-7 rounded-2xl border border-emerald-400/30 bg-black/50 backdrop-blur-md p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#41e296] text-[#122b22]">
                      <Bot size={16} />
                    </span>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#41e296]">Autonomous Directive</span>
                      <h4 className="text-sm font-bold text-white">Monthly Idle Cash Optimization</h4>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold text-[#41e296]">
                    High Impact
                  </span>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-emerald-100 text-xs sm:text-sm leading-relaxed">
                  "You have <span className="font-bold text-white font-mono">₹18,500</span> idle after EMIs and bills this month — sweeping <span className="font-bold text-[#41e296] font-mono">₹15,000</span> into your SIP/prepayment reduces loan interest by <span className="font-bold text-[#41e296]">₹1.4L</span> while preserving a ₹3,500 liquid cushion."
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="text-xs text-emerald-100/60">
                    Calculated against your HDFC Home Loan & ICICI Checking balance.
                  </div>

                  <button
                    onClick={() => setIsSweepSimulated(!isSweepSimulated)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#41e296] px-4 py-2 text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300"
                  >
                    <Sparkles size={13} />
                    <span>{isSweepSimulated ? "Reset Sweep Simulation" : "Simulate Sweep Effect"}</span>
                  </button>
                </div>

                {isSweepSimulated && (
                  <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-4 text-xs text-emerald-100 animate-in fade-in">
                    <div className="flex items-center gap-2 font-bold text-[#41e296]">
                      <Check size={14} className="stroke-[3]" />
                      <span>Sweep Projected: ₹15,000 allocated to HDFC Home Loan Principal</span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-200/80">
                      Total loan interest drops by ₹1,42,000. Tenure reduced by 9 months. Liquid checking maintains healthy ₹33,200 emergency buffer.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Zombie Subscription Radar Card */}
              <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-gradient-to-br from-[#15332f] to-[#0e2019] p-6 shadow-2xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300 mb-3">
                  <Flame size={13} />
                  <span>Zombie Subscription Radar</span>
                </div>

                <h4 className="text-base font-bold text-white">Quiet Recurring Leaks Detected</h4>
                <p className="mt-1 text-xs text-emerald-100/70">
                  Ledgerly cross-checks transaction frequency with app activity:
                </p>

                <div className="mt-4 space-y-2.5">
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Disney+ Hotstar Annual</span>
                      <span className="font-mono text-amber-300">₹1,499</span>
                    </div>
                    <div className="mt-1 text-[11px] text-rose-300">
                      ⚠️ Renews in 4 days. Zero active logins detected for 45+ days.
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/40 p-3.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>ACT Fibernet Price Creep</span>
                      <span className="font-mono text-amber-300">+₹216</span>
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-100/70">
                      Quiet add-on booster detected over standard ₹1,199 base plan.
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <Link
                    href="/demo"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#41e296] hover:underline"
                  >
                    <span>Inspect Full Radar in Sandbox Demo →</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: Responsive Pricing Section (#pricing)
          ───────────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#fbf9f4] text-[#15332f] py-20 sm:py-28 border-b border-[#15332f]/10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#167d6b] mb-3">
              <span className="h-px w-6 bg-[#167d6b]" />
              Transparent Pricing • No Hidden Fees
              <span className="h-px w-6 bg-[#167d6b]" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold tracking-tight text-[#15332f] leading-tight">
              Invest in Total Financial Clarity
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#48615d] leading-relaxed">
              Start free today with no credit card. Upgrade when you're ready to automate your loan optimization and fast capture.
            </p>

            {/* Monthly / Annual Billing Toggle */}
            <div className="mt-8 inline-flex items-center rounded-full border border-[#15332f]/15 bg-white p-1.5 shadow-sm text-xs">
              <button
                type="button"
                onClick={() => setPricingInterval("monthly")}
                className={`rounded-full px-5 py-2 font-bold transition-all ${
                  !isAnnual
                    ? "bg-[#15332f] text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setPricingInterval("annual")}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 font-bold transition-all ${
                  isAnnual
                    ? "bg-[#15332f] text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Annual Billing</span>
                <span className="rounded-full bg-[#41e296] px-2 py-0.5 text-[10px] font-extrabold text-[#122b22]">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* 3 Pricing Tiers Grid */}
          <div className="grid gap-8 lg:grid-cols-3 items-stretch">
            {/* TIER 1: Free Starter */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#15332f]/15 bg-white p-7 sm:p-8 shadow-sm transition-all hover:shadow-md">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                  Starter Plan
                </div>
                <h3 className="mt-2 text-2xl font-bold text-[#15332f]">Free Starter</h3>
                <p className="mt-1 text-xs text-[#48615d]">
                  Essential manual cash-flow logging and single account visibility.
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[#15332f]">₹0</span>
                  <span className="text-xs text-[#48615d]">/ month forever</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">No credit card required</p>

                <ul className="mt-8 space-y-3 text-xs text-[#48615d]">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Manual income & expense logging</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>1 bank account & monthly cash-flow dashboard</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[#15332f]">
                      1 free bank statement import included
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[#15332f]">
                      5 free AI & Fast Capture credits included
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Standard privacy mask & display currencies</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  href="/register"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#15332f]/20 bg-white text-xs font-bold text-[#15332f] transition-all hover:bg-slate-50 hover:border-[#15332f]/40"
                >
                  <span>Start Free</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* TIER 2: Ledgerly Plus */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-emerald-600 bg-white p-7 sm:p-8 shadow-lg">
              {/* Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow">
                MOST POPULAR
              </div>

              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                  Automation Tier
                </div>
                <h3 className="mt-2 text-2xl font-bold text-[#15332f]">Ledgerly Plus</h3>
                <p className="mt-1 text-xs text-[#48615d]">
                  Unlimited automated inputs and multi-account balance tracking.
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[#15332f]">₹{plusMonthlyRate}</span>
                  <span className="text-xs text-[#48615d]">/ month</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">
                  {isAnnual ? "Billed annually (₹1,908/yr) • 20% discount" : "Billed monthly"}
                </p>

                <ul className="mt-8 space-y-3 text-xs text-[#48615d]">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[#15332f]">
                      Unlimited Fast Capture (Telegram bot & voice notes)
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Camera Receipt & Invoice OCR Scanner</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[#15332f]">
                      Unlimited bank statement CSV/PDF auto-ingestion
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Automated daily Telegram & WhatsApp briefings</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Multi-account & credit card balance tracking</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  href="/register?plan=plus"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow transition-all hover:bg-emerald-700 hover:shadow-md"
                >
                  <span>Start 7-Day Free Trial</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* TIER 3: AI Advisor Pro (Founding Member Price) */}
            <div className="relative flex flex-col justify-between rounded-2xl border border-emerald-400/40 bg-[#122b22] text-white p-7 sm:p-8 shadow-xl">
              {/* Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-[#41e296] px-3.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[#122b22] shadow">
                FULL AI SUITE
              </div>

              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#41e296]">
                  Founding Member Deal
                </div>
                <h3 className="mt-2 text-2xl font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={18} className="text-[#41e296]" />
                  AI Advisor Pro
                </h3>
                <p className="mt-1 text-xs text-emerald-100/70">
                  Full AI Financial Advisor, Loan Simulator, and Wealth Suite.
                </p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#41e296]">₹{proMonthlyRate}</span>
                  <span className="text-xs text-emerald-100/60">/ month</span>
                  <span className="text-sm text-emerald-100/40 line-through">
                    ₹{proOriginalRate}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-300 font-semibold mt-1">
                  {isAnnual ? "Billed annually (₹4,788/yr) • Lifetime price lock" : "Founding Member price locked for life"}
                </p>

                <ul className="mt-8 space-y-3 text-xs text-emerald-50/90">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#41e296] shrink-0" />
                    <span className="font-semibold text-white">Everything in Ledgerly Plus</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#41e296] shrink-0" />
                    <span>Unlimited AI Financial Advisor chat & monthly audit</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#41e296] shrink-0" />
                    <span className="font-semibold text-white">
                      Home Loan Amortization & Prepayment Simulator
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#41e296] shrink-0" />
                    <span>Autonomous Idle Cash Sweep & Zombie Subscription Radar</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#41e296] shrink-0" />
                    <span>Tax-saving optimization (Old vs New Regime)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#41e296] shrink-0" />
                    <span>Shared Family / Spouse workspace with privacy mask</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <Link
                  href="/register?plan=pro"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#41e296] text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300 hover:shadow-lg"
                >
                  <span>Unlock AI Advisor Pro</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
