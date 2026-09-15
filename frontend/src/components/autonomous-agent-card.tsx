"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  ShieldAlert,
  Zap,
  PiggyBank,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Coins,
  TrendingUp,
  X,
  Layers,
  Sparkles,
  Sliders,
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useCurrency } from "@/context/currency-context";
import { PrivacyValue } from "@/context/privacy-context";

interface GuardrailAlert {
  category: string;
  monthly_limit: number;
  spent_amount: number;
  spent_pct: number;
  days_remaining: number;
  projected_month_end_spend: number;
  projected_overage: number;
  severity: "critical" | "warning";
  title: string;
  message: string;
}

interface ActionLogItem {
  id: number;
  created_at: string;
  rule_type: string;
  action_type: string;
  title: string;
  message: string;
  amount: number | null;
  status: string;
}

interface AutonomousAgentState {
  liquid_balance: number;
  auto_sweep: {
    rule_type: string;
    is_enabled: boolean;
    liquid_balance: number;
    buffer_threshold: number;
    surplus_amount: number;
    target_destination: string;
    annual_yield_gain: number;
    has_surplus: boolean;
    recommendation: string;
  };
  budget_guardrails: {
    active_breaches_count: number;
    guardrails: GuardrailAlert[];
  };
  micro_savings: {
    is_enabled: boolean;
    round_up_step: number;
    target_goal: string;
    monthly_accrued_savings: number;
    qualifying_transactions_count: number;
    projected_12m_savings: number;
    projected_5y_compound_savings: number;
    summary: string;
  };
  action_logs: ActionLogItem[];
}

export function AutonomousAgentCard() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<AutonomousAgentState | null>(null);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [sweepSimulated, setSweepSimulated] = useState<boolean>(false);

  async function runEvaluation() {
    setEvaluating(true);
    try {
      const res = await fetchWithAuthClient("/api/v1/autonomous/evaluate", {
        method: "POST",
      });
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
      }
    } catch (err) {
      console.error("Error evaluating autonomous agent:", err);
    } finally {
      setEvaluating(false);
    }
  }

  useEffect(() => {
    runEvaluation();
  }, []);

  async function handleDismissAction(id: number) {
    try {
      const res = await fetchWithAuthClient(`/api/v1/autonomous/actions-log/${id}/dismiss`, {
        method: "POST",
      });
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            action_logs: prev.action_logs.filter((a) => a.id !== id),
          };
        });
      }
    } catch (err) {
      console.error("Failed to dismiss action:", err);
    }
  }

  const sweep = data?.auto_sweep;
  const guardrails = data?.budget_guardrails.guardrails || [];
  const micro = data?.micro_savings;

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-white shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">The Ghost Accountant</h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Autonomous Agent Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time surplus auto-sweep simulator, budget velocity guardrails &amp; micro-savings accumulator
            </p>
          </div>
        </div>

        <button
          onClick={runEvaluation}
          disabled={evaluating}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={13} className={evaluating ? "animate-spin" : ""} />
          <span>{evaluating ? "Evaluating..." : "Run Autonomous Check"}</span>
        </button>
      </div>

      {/* Tri-Column Feature Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. Auto-Sweep Simulator */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap size={15} className="text-amber-400" />
                <span>Auto-Sweep Radar</span>
              </span>
              <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">
                Buffer: ₹50k
              </span>
            </div>

            {sweep?.has_surplus ? (
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">Surplus Liquidity Detected:</div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  <PrivacyValue value={formatCurrency(sweep.surplus_amount)} />
                </div>
                <p className="text-[11px] text-slate-300 leading-tight pt-1">
                  Surplus above safety buffer can earn{" "}
                  <strong className="text-amber-400">+{formatCurrency(sweep.annual_yield_gain)}/yr</strong> (7.1% yield) in{" "}
                  <span className="text-indigo-300 font-semibold">{sweep.target_destination}</span>.
                </p>
              </div>
            ) : (
              <div className="py-3 text-center space-y-1">
                <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                <div className="text-xs font-bold text-slate-300">Balance Within Buffer</div>
                <p className="text-[11px] text-slate-500">Checking balance is safely within your ₹50,000 threshold.</p>
              </div>
            )}
          </div>

          {sweep?.has_surplus && (
            <button
              onClick={() => {
                setSweepSimulated(true);
                setTimeout(() => setSweepSimulated(false), 3500);
              }}
              className="w-full py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>{sweepSimulated ? "✅ Simulated Transfer Executed" : `Simulate Sweep (${formatCurrency(sweep.surplus_amount)})`}</span>
            </button>
          )}
        </div>

        {/* 2. Dynamic Budget Guardrails */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-rose-400" />
                <span>Budget Velocity Guardrails</span>
              </span>
              <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-rose-300">
                {guardrails.length} Alerts
              </span>
            </div>

            {guardrails.length > 0 ? (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {guardrails.map((g, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs ${
                      g.severity === "critical"
                        ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                        : "bg-amber-950/40 border-amber-500/40 text-amber-200"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{g.category}</span>
                      <span className="font-mono">{g.spent_pct.toFixed(0)}%</span>
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Spent {formatCurrency(g.spent_amount)} / {formatCurrency(g.monthly_limit)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-center space-y-1">
                <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                <div className="text-xs font-bold text-slate-300">Guardrails Nominal</div>
                <p className="text-[11px] text-slate-500">All categories are pacing safely below 80% limit.</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Micro-Savings Round-Up Accumulator */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <PiggyBank size={15} className="text-indigo-400" />
                <span>Micro-Savings Round-Ups</span>
              </span>
              <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">
                Nearest ₹50
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-slate-400">Accrued Spare Change (30D):</div>
              <div className="text-2xl font-black font-mono text-indigo-400">
                <PrivacyValue value={formatCurrency(micro?.monthly_accrued_savings ?? 0)} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-400">
                <div>
                  <span className="block text-[9px] uppercase text-slate-500">1-Year Value</span>
                  <span className="font-bold text-slate-200">{formatCurrency(micro?.projected_12m_savings ?? 0)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] uppercase text-slate-500">5-Yr Compounded</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(micro?.projected_5y_compound_savings ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Simulates spare change redirected into <span className="text-slate-300">{micro?.target_goal}</span> at 10% CAGR.
          </p>
        </div>
      </div>

      {/* Autonomous Action Log Audit Trail */}
      {data?.action_logs && data.action_logs.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Bot size={13} className="text-emerald-400" />
            <span>Agent Action Log &amp; Audit Trail</span>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {data.action_logs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-300"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      log.action_type === "alert"
                        ? "bg-rose-500"
                        : log.action_type === "simulated_transfer"
                        ? "bg-emerald-500"
                        : "bg-indigo-500"
                    }`}
                  />
                  <div>
                    <span className="font-bold text-white mr-2">{log.title}</span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">{log.message}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono">{log.created_at.slice(11, 16)}</span>
                  <button
                    onClick={() => handleDismissAction(log.id)}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    title="Dismiss alert"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
