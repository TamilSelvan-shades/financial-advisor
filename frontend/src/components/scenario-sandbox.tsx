"use client";

import React, { useState, useMemo } from "react";
import { 
  Sparkles, 
  Car, 
  Palmtree, 
  TrendingUp, 
  Zap, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Calculator,
  Sliders,
  Award,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { PrivacyValue } from "@/context/privacy-context";

interface ScenarioSandboxProps {
  totalBalance?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  totalInvestments?: number;
  committedBills?: number;
  scheduledEmis?: number;
  daysLeftInCycle?: number;
  initialMode?: "car_loan" | "sabbatical" | "sip_boost";
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

export function ScenarioSandbox({
  totalBalance = 450000,
  monthlyIncome = 120000,
  monthlyExpenses = 55000,
  totalInvestments = 800000,
  committedBills = 15000,
  scheduledEmis = 12000,
  daysLeftInCycle = 15,
  initialMode = "car_loan",
}: ScenarioSandboxProps) {
  const [mode, setMode] = useState<"car_loan" | "sabbatical" | "sip_boost">(initialMode);

  // 1. Car Loan State
  const [loanAmount, setLoanAmount] = useState<number>(1200000);
  const [downPayment, setDownPayment] = useState<number>(200000);
  const [carInterestRate, setCarInterestRate] = useState<number>(8.5);
  const [carTenureMonths, setCarTenureMonths] = useState<number>(60);

  // 2. Sabbatical State
  const [sabbaticalMonths, setSabbaticalMonths] = useState<number>(6);
  const [incomeReplacementPct, setIncomeReplacementPct] = useState<number>(0);
  const [discretionaryCutPct, setDiscretionaryCutPct] = useState<number>(20);

  // 3. SIP Compounding State
  const [additionalSip, setAdditionalSip] = useState<number>(5000);
  const [expectedCagr, setExpectedCagr] = useState<number>(12);
  const [expenseCut, setExpenseCut] = useState<number>(2000);
  const [horizonYears, setHorizonYears] = useState<number>(10);

  // -------------------------------------------------------------
  // CALCULATIONS: Car Loan Scenario
  // -------------------------------------------------------------
  const carSimulation = useMemo(() => {
    const principal = Math.max(0, loanAmount - downPayment);
    const emi = calculateEMI(principal, carInterestRate, carTenureMonths);
    const totalInterest = Math.max(0, (emi * carTenureMonths) - principal);

    const newUncommitted = Math.max(0, totalBalance - downPayment - emi);
    const cycleDays = Math.max(1, daysLeftInCycle);
    const newDailySafe = Math.round(newUncommitted / cycleDays);

    const baselineSurplus = monthlyIncome - monthlyExpenses;
    const scenarioSurplus = baselineSurplus - emi;

    const postDpBalance = Math.max(0, totalBalance - downPayment);
    const monthsCushion = postDpBalance / Math.max(monthlyExpenses, 1000);
    const dtiRatio = (emi / Math.max(monthlyIncome, 1)) * 100;

    let score = 100;
    if (monthsCushion < 3.0) score -= Math.round((3.0 - monthsCushion) * 20);
    if (dtiRatio > 25.0) score -= Math.round((dtiRatio - 25.0) * 1.5);
    if (scenarioSurplus < 0) score -= 30;
    const feasibilityScore = Math.max(10, Math.min(100, score));

    // 5-Year timeline (every 3 months)
    const timeline = [];
    let bBal = totalBalance;
    let sBal = postDpBalance;
    let remLoan = principal;
    const rMonthly = (carInterestRate / 100) / 12;

    for (let m = 1; m <= 60; m++) {
      bBal += baselineSurplus;
      if (remLoan > 0) {
        const intAmt = remLoan * rMonthly;
        const pPaid = Math.min(remLoan, emi - intAmt);
        remLoan = Math.max(0, remLoan - pPaid);
        sBal += scenarioSurplus;
      } else {
        sBal += baselineSurplus;
      }

      if (m === 1 || m % 3 === 0 || m === carTenureMonths || m === 60) {
        timeline.push({
          month: m,
          label: `M${m}`,
          baseline: Math.round(bBal),
          scenario: Math.round(sBal),
          loanBalance: Math.round(remLoan),
        });
      }
    }

    return {
      principal,
      emi: Math.round(emi),
      totalInterest: Math.round(totalInterest),
      newDailySafe,
      baselineSurplus: Math.round(baselineSurplus),
      scenarioSurplus: Math.round(scenarioSurplus),
      feasibilityScore,
      monthsCushion: monthsCushion.toFixed(1),
      timeline,
    };
  }, [loanAmount, downPayment, carInterestRate, carTenureMonths, totalBalance, monthlyIncome, monthlyExpenses, daysLeftInCycle]);

  // -------------------------------------------------------------
  // CALCULATIONS: Sabbatical Scenario
  // -------------------------------------------------------------
  const sabbaticalSimulation = useMemo(() => {
    const fixed = committedBills + scheduledEmis;
    const discretionary = Math.max(0, monthlyExpenses - fixed);
    const reducedDiscretionary = discretionary * (1 - discretionaryCutPct / 100);
    const sabExpense = fixed + reducedDiscretionary;
    const sabIncome = monthlyIncome * (incomeReplacementPct / 100);
    const monthlyBurn = Math.max(0, sabExpense - sabIncome);

    const runwayMonths = monthlyBurn > 0 ? (totalBalance / monthlyBurn) : 99;

    const timeline = [];
    let bBal = totalBalance;
    let sBal = totalBalance;
    const baselineSurplus = monthlyIncome - monthlyExpenses;
    let depletionMonth: number | null = null;
    let minCushion = totalBalance;

    for (let m = 1; m <= 24; m++) {
      bBal += baselineSurplus;
      if (m <= sabbaticalMonths) {
        sBal -= monthlyBurn;
        if (sBal < 0 && depletionMonth === null) depletionMonth = m;
        minCushion = Math.min(minCushion, sBal);
      } else {
        sBal += baselineSurplus;
      }

      if (m === 1 || m % 2 === 0 || m === sabbaticalMonths || m === 24) {
        timeline.push({
          month: m,
          label: `M${m}`,
          baseline: Math.round(Math.max(0, bBal)),
          scenario: Math.round(sBal),
          isSabbatical: m <= sabbaticalMonths,
        });
      }
    }

    const feasibilityScore = depletionMonth !== null
      ? Math.max(10, Math.round((runwayMonths / sabbaticalMonths) * 50))
      : minCushion < monthlyExpenses * 2
      ? 65
      : 92;

    return {
      monthlyBurn: Math.round(monthlyBurn),
      runwayMonths: runwayMonths.toFixed(1),
      depletionMonth,
      minCushion: Math.round(minCushion),
      feasibilityScore,
      timeline,
    };
  }, [sabbaticalMonths, incomeReplacementPct, discretionaryCutPct, totalBalance, monthlyIncome, monthlyExpenses, committedBills, scheduledEmis]);

  // -------------------------------------------------------------
  // CALCULATIONS: SIP Booster Scenario
  // -------------------------------------------------------------
  const sipSimulation = useMemo(() => {
    const totalNewMonthly = additionalSip + expenseCut;
    const rMonthly = (expectedCagr / 100) / 12;
    const totalMonths = horizonYears * 12;

    let bInv = totalInvestments;
    let sInv = totalInvestments;
    const timeline = [];

    for (let m = 1; m <= totalMonths; m++) {
      bInv = bInv * (1 + rMonthly);
      sInv = (sInv * (1 + rMonthly)) + totalNewMonthly;

      if (m % 12 === 0) {
        const yr = m / 12;
        timeline.push({
          year: yr,
          label: `Yr ${yr}`,
          baseline: Math.round(bInv),
          scenario: Math.round(sInv),
          extraWealth: Math.round(sInv - bInv),
        });
      }
    }

    const extraWealthCreated = Math.round(sInv - bInv);
    const totalInvestedExtra = totalNewMonthly * totalMonths;

    return {
      totalNewMonthly,
      finalBaseline: Math.round(bInv),
      finalScenario: Math.round(sInv),
      extraWealthCreated,
      totalInvestedExtra,
      timeline,
    };
  }, [additionalSip, expectedCagr, expenseCut, horizonYears, totalInvestments]);

  return (
    <Card className="border-indigo-100 shadow-md bg-white overflow-hidden">
      {/* Header Banner with Mode Switcher */}
      <CardHeader className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles size={16} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Decision Intelligence
              </span>
            </div>
            <CardTitle className="text-xl md:text-2xl font-extrabold text-white">
              "What-If" Financial Scenario Sandbox
            </CardTitle>
            <CardDescription className="text-xs text-slate-300">
              Model major life decisions, stress-test your cash runway, and forecast multi-year trajectories before committing capital.
            </CardDescription>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0 self-start md:self-auto">
            <button
              onClick={() => setMode("car_loan")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "car_loan"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Car size={14} /> Car / Big Loan
            </button>
            <button
              onClick={() => setMode("sabbatical")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "sabbatical"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Palmtree size={14} /> Sabbatical
            </button>
            <button
              onClick={() => setMode("sip_boost")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "sip_boost"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp size={14} /> SIP Booster
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* ========================================================= */}
        {/* MODE 1: CAR LOAN SIMULATOR                                */}
        {/* ========================================================= */}
        {mode === "car_loan" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Sliders Panel */}
              <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600" /> Financed Purchase Parameters
                </h3>

                {/* Purchase Price */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Vehicle / Asset Value:</span>
                    <span className="font-bold text-slate-900"><PrivacyValue value={formatINR(loanAmount)} /></span>
                  </div>
                  <input
                    type="range"
                    min="200000"
                    max="3000000"
                    step="50000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>₹2L</span>
                    <span>₹15L</span>
                    <span>₹30L</span>
                  </div>
                </div>

                {/* Down Payment */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Upfront Down Payment:</span>
                    <span className="font-bold text-slate-900"><PrivacyValue value={formatINR(downPayment)} /></span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={loanAmount * 0.75}
                    step="25000"
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>₹0 (Zero DP)</span>
                    <span>25% DP</span>
                    <span>50% DP</span>
                  </div>
                </div>

                {/* Interest Rate & Tenure */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">Rate:</span>
                      <span className="font-bold text-slate-900">{carInterestRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="6.5"
                      max="16.0"
                      step="0.25"
                      value={carInterestRate}
                      onChange={(e) => setCarInterestRate(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">Tenure:</span>
                      <span className="font-bold text-slate-900">{carTenureMonths} Mos ({(carTenureMonths/12).toFixed(1)} Yrs)</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="84"
                      step="6"
                      value={carTenureMonths}
                      onChange={(e) => setCarTenureMonths(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* KPI Impact Panel */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 block">Monthly Loan EMI</span>
                    <div className="text-2xl font-black text-indigo-950">
                      <PrivacyValue value={formatINR(carSimulation.emi)} />
                    </div>
                    <span className="text-[11px] text-indigo-800">
                      Principal: <PrivacyValue value={formatINR(carSimulation.principal)} />
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Interest</span>
                    <div className="text-2xl font-black text-slate-900">
                      <PrivacyValue value={formatINR(carSimulation.totalInterest)} />
                    </div>
                    <span className="text-[11px] text-slate-500">Over {carTenureMonths} months</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">New Safe-to-Spend</span>
                    <div className="text-xl font-bold text-slate-900">
                      <PrivacyValue value={`${formatINR(carSimulation.newDailySafe)}/day`} />
                    </div>
                    <span className="text-[11px] text-slate-500">Recalibrated runway</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Feasibility Score</span>
                    <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span>{carSimulation.feasibilityScore}/100</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        carSimulation.feasibilityScore >= 75 ? "bg-emerald-100 text-emerald-800" :
                        carSimulation.feasibilityScore >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {carSimulation.feasibilityScore >= 75 ? "Low Risk" : carSimulation.feasibilityScore >= 50 ? "Moderate" : "Tight"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">{carSimulation.monthsCushion} mos reserve left</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-100 text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                  <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    Upfront down payment of <PrivacyValue value={formatINR(downPayment)} /> leaves <PrivacyValue value={formatINR(totalBalance - downPayment)} /> in liquid cash. Your monthly surplus adjusts from <PrivacyValue value={formatINR(carSimulation.baselineSurplus)} /> to <PrivacyValue value={formatINR(carSimulation.scenarioSurplus)} />.
                  </p>
                </div>
              </div>
            </div>

            {/* 5-Year Balance Projection Curve */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-indigo-600" /> 5-Year Projected Liquid Reserve Curve
                </h4>
                <span className="text-xs text-slate-500">Baseline (No Loan) vs Financed Scenario</span>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={carSimulation.timeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      tickFormatter={(val) => `₹${val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatINR(Number(val)), name === "baseline" ? "Baseline Cash" : "With Car Loan"]}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Line type="monotone" dataKey="baseline" name="Baseline (No Loan)" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="scenario" name="With Car Loan & EMI" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 2: SABBATICAL SIMULATOR                              */}
        {/* ========================================================= */}
        {mode === "sabbatical" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Palmtree size={16} className="text-emerald-600" /> Career Sabbatical Parameters
                </h3>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Break Duration:</span>
                    <span className="font-bold text-slate-900">{sabbaticalMonths} Months</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    step="1"
                    value={sabbaticalMonths}
                    onChange={(e) => setSabbaticalMonths(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1 Month</span>
                    <span>12 Months</span>
                    <span>24 Months</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Passive / Partial Income:</span>
                    <span className="font-bold text-slate-900">{incomeReplacementPct}% (<PrivacyValue value={formatINR(monthlyIncome * (incomeReplacementPct/100))} />/mo)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={incomeReplacementPct}
                    onChange={(e) => setIncomeReplacementPct(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Discretionary Spending Cut:</span>
                    <span className="font-bold text-slate-900">{discretionaryCutPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={discretionaryCutPct}
                    onChange={(e) => setDiscretionaryCutPct(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Monthly Burn</span>
                    <div className="text-2xl font-black text-amber-950">
                      <PrivacyValue value={formatINR(sabbaticalSimulation.monthlyBurn)} />
                    </div>
                    <span className="text-[11px] text-amber-700">Net monthly drain</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Runway Duration</span>
                    <div className="text-2xl font-black text-slate-900">
                      {sabbaticalSimulation.runwayMonths} Mos
                    </div>
                    <span className="text-[11px] text-slate-500">Liquid survival capacity</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Minimum Cushion</span>
                    <div className="text-xl font-bold text-slate-900">
                      <PrivacyValue value={formatINR(sabbaticalSimulation.minCushion)} />
                    </div>
                    <span className="text-[11px] text-slate-500">Lowest reserve hit</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Feasibility</span>
                    <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span>{sabbaticalSimulation.feasibilityScore}/100</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        sabbaticalSimulation.feasibilityScore >= 75 ? "bg-emerald-100 text-emerald-800" :
                        sabbaticalSimulation.feasibilityScore >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {sabbaticalSimulation.feasibilityScore >= 75 ? "Feasible" : sabbaticalSimulation.feasibilityScore >= 50 ? "Caution" : "High Risk"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">{sabbaticalSimulation.depletionMonth ? `⚠️ Depletes M${sabbaticalSimulation.depletionMonth}` : "✓ Fully Funded"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-100 text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                  <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    Your current liquid pool of <PrivacyValue value={formatINR(totalBalance)} /> can sustain a {sabbaticalMonths}-month break. {sabbaticalSimulation.depletionMonth ? `Warning: Cash drops to zero in Month ${sabbaticalSimulation.depletionMonth}; ensure backup lines or dip into investments.` : `You exit the sabbatical with ₹${sabbaticalSimulation.minCushion.toLocaleString("en-IN")} intact.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Sabbatical Burn Down Curve */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock size={16} className="text-emerald-600" /> 24-Month Sabbatical & Cash Recovery Curve
                </h4>
                <span className="text-xs text-slate-500">Liquid Balance (₹)</span>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sabbaticalSimulation.timeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSab" x1="0" y1="0" x2="0" y2="1">
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
                      formatter={(val: any) => [formatINR(Number(val)), "Liquid Balance"]}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="scenario" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSab)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 3: SIP BOOSTER SIMULATOR                             */}
        {/* ========================================================= */}
        {mode === "sip_boost" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={16} className="text-violet-600" /> Compounding Acceleration Controls
                </h3>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Additional Monthly SIP:</span>
                    <span className="font-bold text-slate-900"><PrivacyValue value={`${formatINR(additionalSip)}/mo`} /></span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="1000"
                    value={additionalSip}
                    onChange={(e) => setAdditionalSip(Number(e.target.value))}
                    className="w-full accent-violet-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>₹1,000/mo</span>
                    <span>₹25,000/mo</span>
                    <span>₹50,000/mo</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Discretionary Expense Cut Diverted to SIP:</span>
                    <span className="font-bold text-slate-900"><PrivacyValue value={`${formatINR(expenseCut)}/mo`} /></span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20000"
                    step="1000"
                    value={expenseCut}
                    onChange={(e) => setExpenseCut(Number(e.target.value))}
                    className="w-full accent-violet-600 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">Expected CAGR:</span>
                      <span className="font-bold text-slate-900">{expectedCagr}%</span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="20"
                      step="0.5"
                      value={expectedCagr}
                      onChange={(e) => setExpectedCagr(Number(e.target.value))}
                      className="w-full accent-violet-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">Time Horizon:</span>
                      <span className="font-bold text-slate-900">{horizonYears} Years</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="25"
                      step="1"
                      value={horizonYears}
                      onChange={(e) => setHorizonYears(Number(e.target.value))}
                      className="w-full accent-violet-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-violet-800 block">Extra Wealth Created</span>
                    <div className="text-2xl font-black text-violet-950">
                      <PrivacyValue value={`+${formatINR(sipSimulation.extraWealthCreated)}`} />
                    </div>
                    <span className="text-[11px] text-emerald-600 font-semibold">Over baseline growth</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Final Portfolio Value</span>
                    <div className="text-2xl font-black text-slate-900">
                      <PrivacyValue value={formatINR(sipSimulation.finalScenario)} />
                    </div>
                    <span className="text-[11px] text-slate-500">In {horizonYears} years</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">New Monthly Outflow</span>
                    <div className="text-xl font-bold text-slate-900">
                      <PrivacyValue value={`${formatINR(sipSimulation.totalNewMonthly)}/mo`} />
                    </div>
                    <span className="text-[11px] text-slate-500">SIP + Expense Cut</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Out-of-Pocket</span>
                    <div className="text-xl font-bold text-slate-900">
                      <PrivacyValue value={formatINR(sipSimulation.totalInvestedExtra)} />
                    </div>
                    <span className="text-[11px] text-slate-500">Contributed over {horizonYears} yrs</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-100 text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                  <Sparkles size={16} className="text-violet-600 shrink-0 mt-0.5" />
                  <p>
                    By redirecting <PrivacyValue value={formatINR(expenseCut)} /> from dining/discretionary spend and adding <PrivacyValue value={formatINR(additionalSip)} /> in mutual funds at {expectedCagr}% CAGR, you generate an extra <PrivacyValue value={formatINR(sipSimulation.extraWealthCreated)} /> in compounding net worth!
                  </p>
                </div>
              </div>
            </div>

            {/* Compounding Curve */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Award size={16} className="text-violet-600" /> {horizonYears}-Year Compounding Trajectory
                </h4>
                <span className="text-xs text-slate-500">Net Wealth (₹)</span>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sipSimulation.timeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSip" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      tickFormatter={(val) => `₹${val >= 10000000 ? `${(val / 10000000).toFixed(1)}Cr` : val >= 100000 ? `${(val / 100000).toFixed(0)}L` : val}`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatINR(Number(val)), name === "baseline" ? "Baseline Investments" : "Boosted Portfolio"]}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Area type="monotone" dataKey="baseline" name="Baseline (Current Portfolio)" stroke="#94a3b8" strokeDasharray="4 4" fill="none" />
                    <Area type="monotone" dataKey="scenario" name={`With Boosted SIP (+₹${sipSimulation.totalNewMonthly}/mo)`} stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSip)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
