"use client";

import React, { useState, useMemo } from "react";
import { 
  Landmark, 
  TrendingDown, 
  Sparkles, 
  Award, 
  Calendar, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  Info,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from "recharts";
import { PrivacyValue } from "@/context/privacy-context";

interface Loan {
  id: number;
  name?: string;
  bank_name?: string;
  principal: number;
  interest_rate: number;
  tenure_months?: number;
  tenure_years?: number;
}

interface DebtPayoffMatrixProps {
  loans: Loan[];
}

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualRate <= 0) return principal / tenureMonths;
  const r = (annualRate / 100) / 12;
  const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  return isNaN(emi) ? 0 : emi;
}

interface StrategyResult {
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  payoffOrder: { name: string; month: number; principal: number }[];
  monthlyBalances: number[];
}

function simulateStrategy(
  loans: Loan[],
  extraMonthly: number,
  strategy: "baseline" | "snowball" | "avalanche"
): StrategyResult {
  const active = loans.map((l) => {
    const p = Number(l.principal) || 0;
    const r = Number(l.interest_rate) || 0;
    const n = Number(l.tenure_months) || (Number(l.tenure_years ? l.tenure_years * 12 : 12)) || 12;
    const emi = calculateEMI(p, r, n);
    return {
      id: l.id,
      name: l.name || l.bank_name || "Loan Account",
      balance: p,
      rate: r,
      rMonthly: (r / 100) / 12,
      emi,
      initialPrincipal: p,
      clearedMonth: null as number | null,
    };
  });

  let month = 0;
  let totalInterest = 0;
  const payoffOrder: { name: string; month: number; principal: number }[] = [];
  const monthlyBalances = [active.reduce((sum, l) => sum + l.balance, 0)];

  while (active.some((l) => l.balance > 0) && month < 360) {
    month += 1;

    let freedUpEmis = 0;
    for (const l of active) {
      if (l.balance > 0) {
        const interest = l.balance * l.rMonthly;
        totalInterest += interest;
        const minPrincipal = Math.min(l.balance, Math.max(0, l.emi - interest));
        l.balance -= minPrincipal;
        if (l.balance <= 0.01) {
          l.balance = 0;
          if (l.clearedMonth === null) {
            l.clearedMonth = month;
            payoffOrder.push({ name: l.name, month, principal: l.initialPrincipal });
          }
        }
      } else {
        if (strategy !== "baseline") {
          freedUpEmis += l.emi;
        }
      }
    }

    if (strategy !== "baseline") {
      let extraAvailable = extraMonthly + freedUpEmis;
      while (extraAvailable > 0.01) {
        const remaining = active.filter((l) => l.balance > 0);
        if (remaining.length === 0) break;

        let target = remaining[0];
        if (strategy === "snowball") {
          target = remaining.reduce((min, l) => (l.balance < min.balance ? l : min), remaining[0]);
        } else {
          target = remaining.reduce(
            (max, l) => (l.rate > max.rate ? l : l.rate === max.rate && l.balance < max.balance ? l : max),
            remaining[0]
          );
        }

        const payment = Math.min(extraAvailable, target.balance);
        target.balance -= payment;
        extraAvailable -= payment;

        if (target.balance <= 0.01) {
          target.balance = 0;
          if (target.clearedMonth === null) {
            target.clearedMonth = month;
            payoffOrder.push({ name: target.name, month, principal: target.initialPrincipal });
          }
        }
      }
    }

    monthlyBalances.push(Math.round(active.reduce((sum, l) => sum + l.balance, 0)));
  }

  const totalPrincipal = active.reduce((sum, l) => sum + l.initialPrincipal, 0);
  return {
    totalMonths: month,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(totalPrincipal + totalInterest),
    payoffOrder,
    monthlyBalances,
  };
}

export function DebtPayoffMatrix({ loans }: DebtPayoffMatrixProps) {
  const [extraMonthly, setExtraMonthly] = useState<number>(5000);

  const totalDebt = useMemo(() => loans.reduce((sum, l) => sum + (Number(l.principal) || 0), 0), [loans]);

  const simulation = useMemo(() => {
    if (!loans || loans.length === 0) return null;

    const baseline = simulateStrategy(loans, 0, "baseline");
    const snowball = simulateStrategy(loans, extraMonthly, "snowball");
    const avalanche = simulateStrategy(loans, extraMonthly, "avalanche");

    const snowballSaved = Math.max(0, baseline.totalInterest - snowball.totalInterest);
    const avalancheSaved = Math.max(0, baseline.totalInterest - avalanche.totalInterest);

    const snowballMonthsSaved = Math.max(0, baseline.totalMonths - snowball.totalMonths);
    const avalancheMonthsSaved = Math.max(0, baseline.totalMonths - avalanche.totalMonths);

    // Build chart timeline
    const maxLen = Math.max(
      baseline.monthlyBalances.length,
      snowball.monthlyBalances.length,
      avalanche.monthlyBalances.length
    );
    const step = maxLen <= 36 ? 1 : maxLen <= 72 ? 2 : 3;
    const timeline = [];

    for (let m = 0; m < maxLen; m += step) {
      timeline.push({
        month: m,
        label: `M${m}`,
        baseline: baseline.monthlyBalances[m] !== undefined ? baseline.monthlyBalances[m] : 0,
        snowball: snowball.monthlyBalances[m] !== undefined ? snowball.monthlyBalances[m] : 0,
        avalanche: avalanche.monthlyBalances[m] !== undefined ? avalanche.monthlyBalances[m] : 0,
      });
    }

    const diffSavings = avalancheSaved - snowballSaved;
    const diffMonths = snowball.totalMonths - avalanche.totalMonths;

    return {
      baseline,
      snowball: { ...snowball, saved: snowballSaved, monthsSaved: snowballMonthsSaved },
      avalanche: { ...avalanche, saved: avalancheSaved, monthsSaved: avalancheMonthsSaved },
      timeline,
      diffSavings,
      diffMonths,
    };
  }, [loans, extraMonthly]);

  if (!loans || loans.length === 0) {
    return null;
  }

  if (!simulation) return null;

  return (
    <Card className="border-indigo-100 shadow-md bg-white overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles size={16} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Algorithmic Debt Matrix
              </span>
            </div>
            <CardTitle className="text-xl md:text-2xl font-extrabold text-white">
              Debt Snowball vs. Debt Avalanche Optimizer
            </CardTitle>
            <CardDescription className="text-xs text-slate-300">
              Compare psychological momentum (Snowball) against mathematical interest savings (Avalanche) across your {loans.length} active loans.
            </CardDescription>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-right shrink-0">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Outstanding Debt</span>
            <span className="text-xl font-bold text-white">
              <PrivacyValue value={formatINR(totalDebt)} />
            </span>
          </div>
        </div>

        {/* Prepayment Slider Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400" /> Extra Monthly Prepayment Budget:
            </span>
            <span className="font-bold text-base text-amber-300">
              <PrivacyValue value={`${formatINR(extraMonthly)}/month`} />
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="50000"
            step="1000"
            value={extraMonthly}
            onChange={(e) => setExtraMonthly(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
            <span>₹0 (Minimums Only)</span>
            <span>₹25,000/mo</span>
            <span>₹50,000/mo</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Strategy Comparison Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Snowball Card */}
          <div className="rounded-2xl p-5 border border-blue-200 bg-gradient-to-br from-blue-50/50 via-white to-slate-50 space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700 font-bold">
                  ❄️
                </div>
                <div>
                  <h3 className="font-bold text-base text-blue-950">Debt Snowball</h3>
                  <p className="text-xs text-blue-700">Smallest Balance First • Psychological Wins</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Momentum
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-white rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Debt-Free In</span>
                <span className="text-lg font-bold text-slate-900">
                  {simulation.snowball.totalMonths} Months
                </span>
                <span className="text-[11px] text-emerald-600 block font-semibold">
                  (-{simulation.snowball.monthsSaved} mos vs base)
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Interest</span>
                <span className="text-lg font-bold text-slate-900">
                  <PrivacyValue value={formatINR(simulation.snowball.totalInterest)} />
                </span>
                <span className="text-[11px] text-emerald-600 block font-semibold">
                  Saved <PrivacyValue value={formatINR(simulation.snowball.saved)} />
                </span>
              </div>
            </div>

            {/* Payoff Order Sequence */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-slate-600 block">Elimination Sequence:</span>
              <div className="flex flex-wrap gap-1.5">
                {simulation.snowball.payoffOrder.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium"
                  >
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[120px]">{item.name}</span>
                    <span className="text-[10px] text-blue-600 font-semibold">(M{item.month})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Avalanche Card */}
          <div className="rounded-2xl p-5 border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-base text-emerald-950">Debt Avalanche</h3>
                  <p className="text-xs text-emerald-700">Highest Rate First • Mathematical Optimum</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Max Savings
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Debt-Free In</span>
                <span className="text-lg font-bold text-slate-900">
                  {simulation.avalanche.totalMonths} Months
                </span>
                <span className="text-[11px] text-emerald-600 block font-semibold">
                  (-{simulation.avalanche.monthsSaved} mos vs base)
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Interest</span>
                <span className="text-lg font-bold text-slate-900">
                  <PrivacyValue value={formatINR(simulation.avalanche.totalInterest)} />
                </span>
                <span className="text-[11px] text-emerald-600 block font-semibold">
                  Saved <PrivacyValue value={formatINR(simulation.avalanche.saved)} />
                </span>
              </div>
            </div>

            {/* Payoff Order Sequence */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-slate-600 block">Elimination Sequence:</span>
              <div className="flex flex-wrap gap-1.5">
                {simulation.avalanche.payoffOrder.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium"
                  >
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[120px]">{item.name}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">(M{item.month})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tactical Recommendation Banner */}
        <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
          <Sparkles size={18} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-indigo-950">
            <span className="font-bold">Algorithmic Recommendation:</span>
            <p className="leading-relaxed">
              {simulation.diffSavings > 1000 ? (
                <>
                  Debt Avalanche mathematically saves an extra{" "}
                  <span className="font-bold text-emerald-700">
                    <PrivacyValue value={formatINR(simulation.diffSavings)} />
                  </span>{" "}
                  over Snowball by attacking high-interest credit first. However, if staying motivated is tough, Snowball eliminates your first loan in Month{" "}
                  {simulation.snowball.payoffOrder[0]?.month || 1} for rapid psychological momentum.
                </>
              ) : (
                <>
                  Both strategies yield nearly identical interest savings (
                  <PrivacyValue value={formatINR(simulation.avalanche.saved)} />
                  ). In this portfolio, <span className="font-bold">Debt Snowball</span> is recommended for immediate psychological motivation!
                </>
              )}
            </p>
          </div>
        </div>

        {/* Visual Amortization Trajectory Chart */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingDown size={16} className="text-blue-600" /> Outstanding Liability Amortization Curve
            </h4>
            <span className="text-xs text-slate-500">Remaining Balance (₹) over Time</span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={simulation.timeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSnow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAva" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(val) => `₹${val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [formatINR(Number(value)), name === "baseline" ? "Baseline Minimums" : name === "snowball" ? "Debt Snowball" : "Debt Avalanche"]}
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="baseline" name="Baseline (Min. Only)" stroke="#94a3b8" strokeDasharray="4 4" fillOpacity={1} fill="url(#colorBase)" />
                <Area type="monotone" dataKey="snowball" name="Debt Snowball" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSnow)" />
                <Area type="monotone" dataKey="avalanche" name="Debt Avalanche" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAva)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
