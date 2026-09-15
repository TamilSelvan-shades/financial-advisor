"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  Send,
  RefreshCw,
  X,
  ShieldAlert,
  ArrowRight,
  Receipt,
  Wallet,
  Check,
  Settings,
  MessageCircle,
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useCurrency } from "@/context/currency-context";
import { PrivacyValue } from "@/context/privacy-context";
import NotificationChannelModal from "./notification-channel-modal";

interface BillItem {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  status: string;
  lifecycle_status: "overdue" | "due_today" | "upcoming_7d" | "paid" | "future";
  next_due_date: string;
  days_until_due: number;
  days_overdue: number;
  urgency: "critical" | "high" | "medium" | "low" | "none";
  label: string;
}

interface BudgetWarning {
  category: string;
  monthly_limit: number;
  spent_amount: number;
  percentage: number;
  severity: "critical" | "warning";
  message: string;
}

interface CashflowGuardian {
  liquid_balance: number;
  safety_buffer_threshold: number;
  d7_outflows: number;
  d14_outflows: number;
  projected_7d_balance: number;
  projected_14d_balance: number;
  has_deficit: boolean;
  overdraft_risk: boolean;
  buffer_breach_risk: boolean;
  deficit_amount: number;
  transfer_suggestion: string | null;
  alert_message: string | null;
}

interface ReminderStatusPayload {
  status: string;
  as_of_date: string;
  formatted_date: string;
  days_left_in_cycle: number;
  total_actionable_reminders: number;
  ai_insight: string;
  kpis: {
    net_worth: number;
    liquid_balance: number;
    uncommitted_balance: number;
    safe_to_spend_daily: number;
    burn_rate_status: string;
    yesterday_total_spend: number;
    total_pending_all_bills: number;
    scheduled_emis_amount: number;
  };
  bills: {
    overdue_count: number;
    overdue_amount: number;
    overdue_bills: BillItem[];
    due_today_count: number;
    due_today_amount: number;
    due_today_bills: BillItem[];
    upcoming_7d_count: number;
    upcoming_7d_amount: number;
    upcoming_7d_bills: BillItem[];
    settled_count: number;
  };
  budget_warnings: {
    count: number;
    has_critical: boolean;
    warnings: BudgetWarning[];
  };
  cashflow_guardian?: CashflowGuardian;
}

export default function NotificationBell() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<ReminderStatusPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "overdue" | "upcoming" | "budgets">("all");
  const [settlingBillId, setSettlingBillId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuthClient("/api/v1/reminders/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch reminders status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // Poll every 90 seconds
    const interval = setInterval(loadStatus, 90000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSettleBill = async (billId: number, billName: string) => {
    setSettlingBillId(billId);
    try {
      const res = await fetchWithAuthClient(`/api/v1/bills/${billId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_log_expense: true, account: "ICICI Savings Account" }),
      });

      if (res.ok) {
        setToastMessage(`✓ Settled "${billName}" & logged to expenses ledger!`);
        await loadStatus();
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        alert("Failed to settle bill.");
      }
    } catch (err) {
      alert("Error settling bill: " + String(err));
    } finally {
      setSettlingBillId(null);
    }
  };

  const handleTriggerTelegramBriefing = async () => {
    setSendingTelegram(true);
    setTelegramStatus(null);
    try {
      const res = await fetchWithAuthClient("/api/v1/reminders/trigger-briefing", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setTelegramStatus("✓ Dispatched daily status briefing to your Telegram!");
      } else {
        setTelegramStatus(`⚠️ ${json.detail || "Failed to dispatch Telegram message."}`);
      }
    } catch (err) {
      setTelegramStatus(`⚠️ Error: ${String(err)}`);
    } finally {
      setSendingTelegram(false);
      setTimeout(() => setTelegramStatus(null), 5000);
    }
  };

  const overdueCount = data?.bills.overdue_count || 0;
  const dueTodayCount = data?.bills.due_today_count || 0;
  const upcomingCount = data?.bills.upcoming_7d_count || 0;
  const budgetCount = data?.budget_warnings.count || 0;
  const hasCashflowDeficit = data?.cashflow_guardian?.has_deficit ?? false;
  const totalCount = overdueCount + dueTodayCount + budgetCount + (hasCashflowDeficit ? 1 : 0);

  // Determine badge styling
  let badgeColor = "bg-slate-400";
  let showPing = false;
  if (overdueCount > 0 || data?.cashflow_guardian?.overdraft_risk) {
    badgeColor = "bg-rose-600 text-white";
    showPing = true;
  } else if (dueTodayCount > 0 || hasCashflowDeficit || (data?.budget_warnings.has_critical ?? false)) {
    badgeColor = "bg-amber-500 text-white";
    showPing = true;
  } else if (upcomingCount > 0 || budgetCount > 0) {
    badgeColor = "bg-indigo-600 text-white";
  }

  return (
    <div className={`relative ${isOpen ? "z-50" : ""}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadStatus();
        }}
        className={`relative flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 border transition-all cursor-pointer ${
          isOpen
            ? "bg-slate-200/90 border-slate-300 text-slate-900 shadow-inner"
            : "bg-slate-100/90 hover:bg-slate-200/80 border-slate-200 shadow-2xs"
        }`}
        title="Pending Reminders & Daily Financial Status"
        aria-label="Notifications"
      >
        <Bell size={15} className={overdueCount > 0 ? "text-rose-600" : ""} />

        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center">
            {showPing && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  overdueCount > 0 ? "bg-rose-400" : "bg-amber-400"
                }`}
              />
            )}
            <span
              className={`relative inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1 h-4 leading-none shadow-xs ${badgeColor}`}
            >
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 sm:w-[420px] max-h-[85vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl ring-1 ring-black/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-400" />
                <h3 className="font-bold text-sm tracking-tight">Reminders & Daily Pulse</h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {data?.formatted_date || "Financial status & bill guardian"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Notification Channels & Delivery Settings (WhatsApp / Telegram)"
              >
                <Settings size={13} />
              </button>
              <button
                onClick={loadStatus}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="bg-emerald-50 text-emerald-800 text-xs px-3 py-2 border-b border-emerald-200 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Telegram Status Bar */}
          {telegramStatus && (
            <div className="bg-blue-50 text-blue-900 text-xs px-3 py-2 border-b border-blue-200 flex items-center gap-2">
              <Sparkles size={14} className="text-blue-600 shrink-0" />
              <span>{telegramStatus}</span>
            </div>
          )}

          {/* Cashflow Guardian Deficit Warning (High Priority Banner) */}
          {data?.cashflow_guardian?.has_deficit && (
            <div
              className={`px-4 py-3 border-b flex items-start gap-2.5 ${
                data.cashflow_guardian.overdraft_risk
                  ? "bg-rose-50 border-rose-200 text-rose-950"
                  : "bg-amber-50 border-amber-200 text-amber-950"
              }`}
            >
              <ShieldAlert
                size={18}
                className={`shrink-0 mt-0.5 ${
                  data.cashflow_guardian.overdraft_risk ? "text-rose-600" : "text-amber-600"
                }`}
              />
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-xs tracking-tight uppercase">
                    {data.cashflow_guardian.overdraft_risk
                      ? "🚨 Overdraft Risk Detected"
                      : "⚠️ Runway Safety Buffer Deficit"}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      data.cashflow_guardian.overdraft_risk
                        ? "bg-rose-200 text-rose-800"
                        : "bg-amber-200 text-amber-800"
                    }`}
                  >
                    Shortfall:{" "}
                    <PrivacyValue value={formatCurrency(data.cashflow_guardian.deficit_amount)} />
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {data.cashflow_guardian.alert_message}
                </p>
                {data.cashflow_guardian.transfer_suggestion && (
                  <div className="mt-1 p-1.5 rounded-lg bg-white/90 border border-amber-200/80 text-[11px] font-medium text-slate-800 flex items-center gap-1.5 shadow-2xs">
                    <Sparkles size={12} className="text-amber-600 shrink-0" />
                    <span>
                      <strong>Autonomous Suggestion:</strong>{" "}
                      {data.cashflow_guardian.transfer_suggestion}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Daily Insight */}
          {data?.ai_insight && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50/90 to-blue-50/70 border-b border-indigo-100 flex items-start gap-2.5">
              <Sparkles size={14} className="text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                {data.ai_insight}
              </p>
            </div>
          )}

          {/* KPIs Bar */}
          {data?.kpis && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border-b border-slate-100 text-xs">
              <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Safe-to-Spend
                </span>
                <span className="text-sm font-extrabold text-slate-900">
                  <PrivacyValue value={formatCurrency(data.kpis.safe_to_spend_daily)} />
                  <span className="text-[10px] font-normal text-slate-500">/day</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold block">
                  {data.kpis.burn_rate_status} Burn Pace
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Free Liquidity
                </span>
                <span className="text-sm font-extrabold text-indigo-950">
                  <PrivacyValue value={formatCurrency(data.kpis.uncommitted_balance)} />
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {data.days_left_in_cycle} days remaining
                </span>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-semibold bg-slate-50/80 shrink-0 px-2 pt-1 gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-t-lg transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white text-slate-900 border-t border-x border-slate-200 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("overdue")}
              className={`px-2.5 py-1.5 rounded-t-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "overdue"
                  ? "bg-white text-rose-700 border-t border-x border-slate-200 shadow-2xs"
                  : "text-slate-500 hover:text-rose-600"
              }`}
            >
              Overdue
              {overdueCount > 0 && (
                <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {overdueCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-2.5 py-1.5 rounded-t-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "upcoming"
                  ? "bg-white text-indigo-700 border-t border-x border-slate-200 shadow-2xs"
                  : "text-slate-500 hover:text-indigo-600"
              }`}
            >
              Upcoming
              {(dueTodayCount + upcomingCount) > 0 && (
                <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {dueTodayCount + upcomingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("budgets")}
              className={`px-2.5 py-1.5 rounded-t-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "budgets"
                  ? "bg-white text-amber-700 border-t border-x border-slate-200 shadow-2xs"
                  : "text-slate-500 hover:text-amber-600"
              }`}
            >
              Budgets
              {budgetCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {budgetCount}
                </span>
              )}
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1 text-xs">
            {/* OVERDUE BILLS */}
            {(activeTab === "all" || activeTab === "overdue") &&
              data?.bills.overdue_bills.map((bill) => (
                <div
                  key={`overdue-${bill.id}`}
                  className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-rose-600 text-white">
                        Overdue
                      </span>
                      <p className="font-bold text-slate-900 truncate">{bill.name}</p>
                    </div>
                    <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                      {bill.label} • Due day {bill.due_day}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="font-extrabold text-sm text-rose-950">
                      <PrivacyValue value={formatCurrency(bill.amount)} />
                    </span>
                    <button
                      onClick={() => handleSettleBill(bill.id, bill.name)}
                      disabled={settlingBillId === bill.id}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      {settlingBillId === bill.id ? "Settling..." : "Pay & Log"}
                    </button>
                  </div>
                </div>
              ))}

            {/* DUE TODAY BILLS */}
            {(activeTab === "all" || activeTab === "upcoming") &&
              data?.bills.due_today_bills.map((bill) => (
                <div
                  key={`today-${bill.id}`}
                  className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-amber-500 text-white">
                        Due Today
                      </span>
                      <p className="font-bold text-slate-900 truncate">{bill.name}</p>
                    </div>
                    <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                      Payment deadline is today
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="font-extrabold text-sm text-slate-900">
                      <PrivacyValue value={formatCurrency(bill.amount)} />
                    </span>
                    <button
                      onClick={() => handleSettleBill(bill.id, bill.name)}
                      disabled={settlingBillId === bill.id}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {settlingBillId === bill.id ? "Settling..." : "Pay & Log"}
                    </button>
                  </div>
                </div>
              ))}

            {/* UPCOMING 7 DAYS */}
            {(activeTab === "all" || activeTab === "upcoming") &&
              data?.bills.upcoming_7d_bills.map((bill) => (
                <div
                  key={`upcoming-${bill.id}`}
                  className="p-2.5 rounded-xl hover:bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{bill.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {bill.label} • {bill.next_due_date}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="font-bold text-xs text-slate-900">
                      <PrivacyValue value={formatCurrency(bill.amount)} />
                    </span>
                    <button
                      onClick={() => handleSettleBill(bill.id, bill.name)}
                      disabled={settlingBillId === bill.id}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {settlingBillId === bill.id ? "Settling..." : "Mark Paid"}
                    </button>
                  </div>
                </div>
              ))}

            {/* BUDGET WARNINGS */}
            {(activeTab === "all" || activeTab === "budgets") &&
              data?.budget_warnings.warnings.map((bw, idx) => (
                <div
                  key={`bw-${idx}`}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                    bw.severity === "critical"
                      ? "bg-rose-50/50 border-rose-200 text-rose-900"
                      : "bg-amber-50/50 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle
                        size={12}
                        className={bw.severity === "critical" ? "text-rose-600" : "text-amber-600"}
                      />
                      <p className="font-bold truncate">{bw.category}</p>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">{bw.message}</p>
                  </div>
                  <span className="font-extrabold text-xs shrink-0">
                    {bw.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}

            {/* EMPTY STATE */}
            {data &&
              overdueCount === 0 &&
              dueTodayCount === 0 &&
              upcomingCount === 0 &&
              budgetCount === 0 && (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                  <p className="font-semibold text-slate-800 text-xs">All Clear!</p>
                  <p className="text-[11px] text-slate-500">
                    No overdue dues, pending bills in the next 7 days, or budget breaches.
                  </p>
                </div>
              )}
          </div>

          {/* Footer Action Controls */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsOpen(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors shadow-2xs cursor-pointer"
                title="Configure WhatsApp & Telegram notification channels"
              >
                <Settings size={12} className="text-slate-500" />
                <span>Channels</span>
              </button>
              <button
                onClick={handleTriggerTelegramBriefing}
                disabled={sendingTelegram}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Push immediate briefing to your notification channels"
              >
                <Send size={12} className={sendingTelegram ? "animate-spin" : ""} />
                <span>{sendingTelegram ? "Sending..." : "Send Pulse"}</span>
              </button>
            </div>

            <Link
              href="/bills"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <span>Manage Bills</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* WhatsApp & Telegram Multi-Channel Delivery Modal */}
      <NotificationChannelModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={loadStatus}
      />
    </div>
  );
}
