"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Landmark,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Wallet,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useCurrency } from "@/context/currency-context";
import { PrivacyValue } from "@/context/privacy-context";

interface LeakItem {
  category: string;
  current_7d_spend: number;
  weekly_baseline: number;
  surge_pct: number;
  delta: number;
  is_leak: boolean;
}

interface BillItem {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  days_away: number;
  status: string;
}

interface ExecutiveBriefingData {
  briefing_date: string;
  date_range: string;
  cash_velocity: {
    weekly_inflow: number;
    weekly_outflow: number;
    net_weekly_cashflow: number;
    daily_burn_rate: number;
    wow_expense_change_pct: number;
    savings_rate_pct: number;
    status: string;
    prior_week_outflow: number;
  };
  category_leaks: {
    has_leaks: boolean;
    leak_count: number;
    leaks: LeakItem[];
    top_categories: LeakItem[];
  };
  upcoming_horizon: {
    horizon_days: number;
    current_liquid_balance: number;
    upcoming_bills: BillItem[];
    total_bills_due: number;
    projected_emis: number;
    total_7d_commitments: number;
    projected_7d_liquidity: number;
    liquidity_status: string;
  };
  ai_pro_tip: string;
}

export default function ExecutiveReportsPage() {
  const { formatCurrency, currency } = useCurrency();
  const [briefing, setBriefing] = useState<ExecutiveBriefingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);

  async function loadBriefing() {
    setLoading(true);
    try {
      const res = await fetchWithAuthClient("/api/v1/reports/executive-briefing");
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      }
    } catch (err) {
      console.error("Failed to load executive briefing:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBriefing();
  }, []);

  async function handleDownloadReport() {
    setDownloading(true);
    try {
      const res = await fetchWithAuthClient("/api/v1/reports/executive-briefing/download");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Executive_Briefing_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  }

  const cv = briefing?.cash_velocity;
  const cl = briefing?.category_leaks;
  const uh = briefing?.upcoming_horizon;
  const isNetPositive = (cv?.net_weekly_cashflow ?? 0) >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-slate-800 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Sunday Executive Briefing</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                Weekly Digest
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {briefing ? `Reporting Period: ${briefing.date_range}` : "Loading real-time executive briefing..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadBriefing}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all border border-slate-700 disabled:opacity-50"
            title="Refresh Briefing"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={downloading || !briefing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
          >
            <Download size={14} />
            <span>{downloading ? "Preparing HTML..." : "Download Executive Report"}</span>
          </button>
        </div>
      </div>

      {loading && !briefing ? (
        <div className="p-16 text-center text-slate-400">
          <RefreshCw className="animate-spin mx-auto text-indigo-500 mb-3" size={32} />
          <p className="text-sm font-semibold">Synthesizing weekly financial telemetry...</p>
        </div>
      ) : briefing ? (
        <>
          {/* AI Executive Pro-Tip Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/40 text-white shadow-lg relative overflow-hidden">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5">
                <Sparkles size={20} />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                  <span>AI Executive Pro-Tip of the Week</span>
                  <span className="bg-indigo-500/20 text-[9px] px-1.5 py-0.2 rounded text-indigo-200">Gemini 2.5 Flash</span>
                </div>
                <p className="text-sm font-medium text-slate-200 leading-relaxed">
                  &ldquo;{briefing.ai_pro_tip}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Cash Velocity Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Inflow */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                <span>7-Day Inflow</span>
                <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
                  <ArrowDownRight size={14} />
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                <PrivacyValue value={formatCurrency(cv?.weekly_inflow ?? 0)} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total Income Logged</div>
            </div>

            {/* Outflow */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                <span>7-Day Outflow</span>
                <span className="p-1 rounded-md bg-rose-500/10 text-rose-400">
                  <ArrowUpRight size={14} />
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-rose-400">
                <PrivacyValue value={formatCurrency(cv?.weekly_outflow ?? 0)} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                <span className={cv?.wow_expense_change_pct && cv.wow_expense_change_pct > 0 ? "text-rose-400" : "text-emerald-400"}>
                  {cv?.wow_expense_change_pct ? `${cv.wow_expense_change_pct > 0 ? "+" : ""}${cv.wow_expense_change_pct}%` : "0%"}
                </span>{" "}
                vs. prior 7 days
              </div>
            </div>

            {/* Net Cashflow Velocity */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                <span>Net Cash Velocity</span>
                <span className={`p-1 rounded-md ${isNetPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {isNetPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </span>
              </div>
              <div className={`text-2xl font-black font-mono ${isNetPositive ? "text-emerald-400" : "text-rose-400"}`}>
                <PrivacyValue value={formatCurrency(cv?.net_weekly_cashflow ?? 0)} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium">
                {cv?.savings_rate_pct ?? 0}% Weekly Savings Rate
              </div>
            </div>

            {/* Daily Burn Rate */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                <span>Daily Burn Rate</span>
                <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
                  <Flame size={14} />
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">
                <PrivacyValue value={`${formatCurrency(cv?.daily_burn_rate ?? 0)}/day`} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Average Daily Spend</div>
            </div>
          </div>

          {/* Category Leak Analyzer & 7-Day Horizon Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Leak Radar Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={cl?.has_leaks ? "text-rose-400" : "text-emerald-400"} size={18} />
                  <h3 className="font-extrabold text-base">Category Leak Radar</h3>
                </div>
                <span className="text-xs text-slate-400">Threshold: &gt;30% above 4-week avg</span>
              </div>

              {cl?.has_leaks ? (
                <div className="space-y-3">
                  <p className="text-xs text-rose-300 font-medium">
                    ⚠️ {cl.leak_count} category spending surges detected this week:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                          <th className="pb-2">Category</th>
                          <th className="pb-2 text-right">7D Spend</th>
                          <th className="pb-2 text-right">Baseline</th>
                          <th className="pb-2 text-right">Surge</th>
                          <th className="pb-2 text-right">Leak Delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {cl.leaks.map((leak, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2.5 font-sans font-semibold text-slate-200">{leak.category}</td>
                            <td className="py-2.5 text-right text-rose-400 font-bold">{formatCurrency(leak.current_7d_spend)}</td>
                            <td className="py-2.5 text-right text-slate-400">{formatCurrency(leak.weekly_baseline)}</td>
                            <td className="py-2.5 text-right text-rose-400 font-extrabold">+{leak.surge_pct.toFixed(0)}%</td>
                            <td className="py-2.5 text-right text-rose-300">+{formatCurrency(leak.delta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2">
                  <CheckCircle2 className="mx-auto text-emerald-400" size={32} />
                  <h4 className="font-bold text-sm text-slate-200">Discipline Score 100%</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No spending category exceeded 30% of its historical 4-week average. Your cash outflows are tightly controlled.
                  </p>
                </div>
              )}
            </div>

            {/* Upcoming 7-Day Horizon Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="text-indigo-400" size={18} />
                  <h3 className="font-extrabold text-base">Upcoming 7-Day Horizon</h3>
                </div>
                <span
                  className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                    uh?.liquidity_status === "Strong Cushion"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : uh?.liquidity_status === "Moderate Buffer"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {uh?.liquidity_status}
                </span>
              </div>

              {/* Liquidity Projection */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 font-mono text-xs">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 block">Current Liquid Balance</span>
                  <span className="text-base font-black text-white">
                    <PrivacyValue value={formatCurrency(uh?.current_liquid_balance ?? 0)} />
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-400 block">Projected Net After 7D Outgo</span>
                  <span className="text-base font-black text-indigo-400">
                    <PrivacyValue value={formatCurrency(uh?.projected_7d_liquidity ?? 0)} />
                  </span>
                </div>
              </div>

              {/* Upcoming Bills List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Committed Bills &amp; Obligations (Next 7 Days):</div>
                {uh?.upcoming_bills && uh.upcoming_bills.length > 0 ? (
                  <div className="space-y-1.5">
                    {uh.upcoming_bills.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 text-xs font-mono"
                      >
                        <div className="font-sans">
                          <span className="font-semibold text-slate-200">{b.name}</span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            {b.days_away === 0 ? "Due Today" : `in ${b.days_away} days`}
                          </span>
                        </div>
                        <div className="font-bold text-indigo-300">{formatCurrency(b.amount)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/30 rounded-lg border border-slate-800/60">
                    ✅ No recurring bills scheduled for payment in the next 7 days.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
