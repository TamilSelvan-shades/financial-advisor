"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Save,
  HelpCircle,
  Percent,
  Layers,
  ChevronDown,
  ChevronUp,
  Landmark,
  Building2,
  HeartPulse,
  PiggyBank,
  Home,
  FileSpreadsheet,
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useCurrency } from "@/context/currency-context";
import { PrivacyValue } from "@/context/privacy-context";

interface SlabItem {
  bracket: string;
  rate: string;
  taxable_in_bracket: number;
  tax: number;
}

interface RegimeBreakdown {
  gross_income: number;
  total_deductions: number;
  taxable_income: number;
  base_tax: number;
  slabs_breakdown: SlabItem[];
  section_87a_rebate: number;
  marginal_relief?: number;
  surcharge: number;
  cess_4pct: number;
  net_tax_payable: number;
  effective_tax_rate: number;
  deductions_breakdown?: Record<string, number>;
}

interface TaxCalculationResult {
  financial_year: string;
  gross_salary: number;
  basic_salary: number;
  recommended_regime: "new" | "old" | "equal";
  savings_amount: number;
  recommendation_title: string;
  break_even: {
    break_even_deductions: number;
    current_deductions: number;
    deduction_gap: number;
    notes: string;
  };
  old_regime: RegimeBreakdown;
  new_regime: RegimeBreakdown;
  hra_calculation: {
    exemption: number;
    actual_hra: number;
    rent_minus_10pct: number;
    salary_pct_limit: number;
    taxable_hra: number;
  };
}

export default function TaxOptimizationPage() {
  const { formatCurrency, currency } = useCurrency();

  // Inputs
  const [grossSalary, setGrossSalary] = useState<number>(1200000);
  const [basicSalary, setBasicSalary] = useState<number>(600000);
  const [hraReceived, setHraReceived] = useState<number>(240000);
  const [rentPaid, setRentPaid] = useState<number>(240000);
  const [isMetro, setIsMetro] = useState<boolean>(true);
  const [section80C, setSection80C] = useState<number>(150000);
  const [section80DSelf, setSection80DSelf] = useState<number>(25000);
  const [section80DParents, setSection80DParents] = useState<number>(25000);
  const [parentsSeniorCitizen, setParentsSeniorCitizen] = useState<boolean>(false);
  const [section80CCD1B, setSection80CCD1B] = useState<number>(50000);
  const [section24B, setSection24B] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);

  // States
  const [result, setResult] = useState<TaxCalculationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showSlabsOld, setShowSlabsOld] = useState<boolean>(false);
  const [showSlabsNew, setShowSlabsNew] = useState<boolean>(false);

  // Load saved profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetchWithAuthClient("/api/v1/tax/profile");
        if (res.ok) {
          const prof = await res.json();
          if (prof) {
            if (prof.gross_salary) setGrossSalary(prof.gross_salary);
            if (prof.basic_salary) setBasicSalary(prof.basic_salary);
            if (prof.hra_received !== undefined) setHraReceived(prof.hra_received);
            if (prof.rent_paid !== undefined) setRentPaid(prof.rent_paid);
            if (prof.is_metro !== undefined) setIsMetro(prof.is_metro);
            if (prof.section_80c !== undefined) setSection80C(prof.section_80c);
            if (prof.section_80d_self !== undefined) setSection80DSelf(prof.section_80d_self);
            if (prof.section_80d_parents !== undefined) setSection80DParents(prof.section_80d_parents);
            if (prof.parents_senior_citizen !== undefined) setParentsSeniorCitizen(prof.parents_senior_citizen);
            if (prof.section_80ccd_1b !== undefined) setSection80CCD1B(prof.section_80ccd_1b);
            if (prof.section_24b !== undefined) setSection24B(prof.section_24b);
            if (prof.other_deductions !== undefined) setOtherDeductions(prof.other_deductions);
          }
        }
      } catch (err) {
        console.error("Failed to load tax profile:", err);
      }
    }
    loadProfile();
  }, []);

  // Debounced calculate
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuthClient("/api/v1/tax/calculate", {
          method: "POST",
          body: JSON.stringify({
            gross_salary: grossSalary,
            basic_salary: basicSalary,
            hra_received: hraReceived,
            rent_paid: rentPaid,
            is_metro: isMetro,
            section_80c: section80C,
            section_80d_self: section80DSelf,
            section_80d_parents: section80DParents,
            parents_senior_citizen: parentsSeniorCitizen,
            section_80ccd_1b: section80CCD1B,
            section_24b: section24B,
            other_deductions: otherDeductions,
            financial_year: "2024-2025",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setResult(data);
        }
      } catch (e) {
        console.error("Failed to calculate tax:", e);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [
    grossSalary,
    basicSalary,
    hraReceived,
    rentPaid,
    isMetro,
    section80C,
    section80DSelf,
    section80DParents,
    parentsSeniorCitizen,
    section80CCD1B,
    section24B,
    otherDeductions,
  ]);

  // Save profile handler
  async function handleSaveProfile() {
    setSavingProfile(true);
    setSaveSuccess(false);
    try {
      const res = await fetchWithAuthClient("/api/v1/tax/profile", {
        method: "PUT",
        body: JSON.stringify({
          gross_salary: grossSalary,
          basic_salary: basicSalary,
          hra_received: hraReceived,
          rent_paid: rentPaid,
          is_metro: isMetro,
          section_80c: section80C,
          section_80d_self: section80DSelf,
          section_80d_parents: section80DParents,
          parents_senior_citizen: parentsSeniorCitizen,
          section_80ccd_1b: section80CCD1B,
          section_24b: section24B,
          other_deductions: otherDeductions,
          preferred_regime: result?.recommended_regime || "auto",
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Error saving tax profile:", e);
    } finally {
      setSavingProfile(false);
    }
  }

  // Auto-sync basic salary when gross changes (if basic is roughly 50%)
  const handleGrossChange = (val: number) => {
    setGrossSalary(val);
    setBasicSalary(Math.round(val * 0.5));
  };

  const isNewOptimal = result?.recommended_regime === "new";
  const isOldOptimal = result?.recommended_regime === "old";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-900/40 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Tax Optimization Studio</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full">
                FY 2024–25 &amp; 2025–26
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Indian Income Tax Simulator (Old vs. New Tax Regime with Budget 2024 revisions &amp; Break-Even Radar)
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
        >
          <Save size={15} />
          <span>{savingProfile ? "Saving..." : saveSuccess ? "Saved!" : "Save Tax Profile"}</span>
        </button>
      </div>

      {/* Hero Recommendation Alert */}
      {result && (
        <div
          className={`p-6 rounded-2xl border-2 transition-all shadow-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 ${
            isNewOptimal
              ? "border-emerald-500/70 shadow-emerald-950/40"
              : isOldOptimal
              ? "border-blue-500/70 shadow-blue-950/40"
              : "border-slate-700"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  isNewOptimal
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                }`}
              >
                <Sparkles size={22} />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5 flex-wrap">
                  <span>{result.recommendation_title}</span>
                  <span
                    className={`text-[11px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                      isNewOptimal
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                        : "bg-blue-500/20 text-blue-300 border-blue-400/50"
                    }`}
                  >
                    {isNewOptimal ? "New Regime Optimal" : isOldOptimal ? "Old Regime Optimal" : "Equal Tax"}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                  {isNewOptimal ? (
                    <>
                      Under the New Regime (Budget 2024 slabs &amp; ₹75k standard deduction), your annual tax is{" "}
                      <span className="text-white font-bold font-mono">
                        {formatCurrency(result.new_regime.net_tax_payable)}
                      </span>{" "}
                      vs.{" "}
                      <span className="text-white font-bold font-mono">
                        {formatCurrency(result.old_regime.net_tax_payable)}
                      </span>{" "}
                      under Old Regime.
                    </>
                  ) : (
                    <>
                      Under the Old Regime, your Chapter VI-A deductions lower your taxable income to{" "}
                      <span className="text-white font-bold font-mono">
                        {formatCurrency(result.old_regime.taxable_income)}
                      </span>
                      , saving you{" "}
                      <span className="text-emerald-400 font-bold font-mono">
                        {formatCurrency(result.savings_amount)}
                      </span>{" "}
                      annually.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-left sm:text-right sm:border-l sm:border-slate-800 sm:pl-6 pt-2 sm:pt-0">
              <div className="text-xs uppercase tracking-wider font-bold text-slate-400">Annual Tax Savings</div>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                  isNewOptimal ? "text-emerald-400" : isOldOptimal ? "text-blue-400" : "text-white"
                }`}
              >
                {formatCurrency(result.savings_amount)}
              </div>
            </div>
          </div>

          {/* Break-Even Progress Bar */}
          <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-slate-800/90 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs mb-2 font-medium">
              <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                <Info size={14} className="text-indigo-400" />
                <span>Break-Even Deduction Analyzer:</span>
              </span>
              <span className="font-mono text-xs text-slate-300">
                Current: <strong className="text-white">{formatCurrency(result.break_even.current_deductions)}</strong>{" "}
                <span className="text-slate-600 mx-1">/</span> Needed:{" "}
                <strong className="text-indigo-400">{formatCurrency(result.break_even.break_even_deductions)}</strong>
              </span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/80">
              <div
                className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{
                  width: `${Math.min(
                    100,
                    result.break_even.break_even_deductions > 0
                      ? (result.break_even.current_deductions / result.break_even.break_even_deductions) * 100
                      : 100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-300 font-medium mt-2 flex items-start gap-1.5">
              <span className="text-indigo-400 font-bold">•</span>
              <span>{result.break_even.notes}</span>
            </p>
          </div>
        </div>
      )}

      {/* Dual Regime Comparison Cards */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* New Tax Regime Card */}
          <div
            className={`p-6 rounded-2xl border transition-all ${
              isNewOptimal
                ? "bg-gradient-to-b from-slate-900 via-slate-900/90 to-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-500/5"
                : "bg-slate-900/80 border-slate-800 text-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-white">New Tax Regime</h2>
                  <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                    Budget 2024
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Section 115BAC (Revised Slabs &amp; ₹75k Standard Deduction)</p>
              </div>
              {isNewOptimal && (
                <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={13} /> Recommended
                </span>
              )}
            </div>

            <div className="space-y-3 font-mono text-xs border-t border-slate-800 pt-4">
              <div className="flex justify-between text-slate-400">
                <span>Gross Annual Salary:</span>
                <span className="text-white font-semibold">{formatCurrency(result.new_regime.gross_income)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Standard Deduction:</span>
                <span className="text-emerald-400">- {formatCurrency(result.new_regime.total_deductions)}</span>
              </div>
              <div className="flex justify-between text-slate-400 font-semibold border-t border-slate-800/80 pt-2">
                <span>Taxable Income:</span>
                <span className="text-white">{formatCurrency(result.new_regime.taxable_income)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Base Tax on Slabs:</span>
                <span>{formatCurrency(result.new_regime.base_tax)}</span>
              </div>
              {(result.new_regime.section_87a_rebate ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Section 87A Rebate (up to ₹7L):</span>
                  <span>- {formatCurrency(result.new_regime.section_87a_rebate)}</span>
                </div>
              )}
              {(result.new_regime.marginal_relief ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Marginal Relief:</span>
                  <span>- {formatCurrency(result.new_regime.marginal_relief)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Health &amp; Education Cess (4%):</span>
                <span>{formatCurrency(result.new_regime.cess_4pct)}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between mt-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Net Tax Payable</div>
                  <div className="text-2xl font-black text-white font-mono">
                    {formatCurrency(result.new_regime.net_tax_payable)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Effective Rate</div>
                  <div className="text-lg font-bold text-indigo-400 font-mono">
                    {result.new_regime.effective_tax_rate}%
                  </div>
                </div>
              </div>
            </div>

            {/* Slabs Accordion */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowSlabsNew(!showSlabsNew)}
                className="w-full flex items-center justify-between text-xs text-indigo-400 hover:text-indigo-300 font-medium py-1"
              >
                <span>{showSlabsNew ? "Hide Slab Math" : "Show Slab Breakdown"}</span>
                {showSlabsNew ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showSlabsNew && (
                <div className="mt-2 space-y-1.5 text-[11px] bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
                  {result.new_regime.slabs_breakdown.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-slate-400">
                      <span>
                        {s.bracket} ({s.rate}):
                      </span>
                      <span className={s.tax > 0 ? "text-white" : "text-slate-500"}>{formatCurrency(s.tax)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Old Tax Regime Card */}
          <div
            className={`p-6 rounded-2xl border transition-all ${
              isOldOptimal
                ? "bg-gradient-to-b from-slate-900 via-slate-900/90 to-blue-950/20 border-blue-500/50 shadow-lg shadow-blue-500/5"
                : "bg-slate-900/80 border-slate-800 text-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-white">Old Tax Regime</h2>
                  <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    Traditional
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Chapter VI-A Deductions (80C, 80D, 80CCD, 24b, HRA)</p>
              </div>
              {isOldOptimal && (
                <span className="text-xs font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={13} /> Recommended
                </span>
              )}
            </div>

            <div className="space-y-3 font-mono text-xs border-t border-slate-800 pt-4">
              <div className="flex justify-between text-slate-400">
                <span>Gross Annual Salary:</span>
                <span className="text-white font-semibold">{formatCurrency(result.old_regime.gross_income)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Exemptions &amp; Deductions:</span>
                <span className="text-blue-400">- {formatCurrency(result.old_regime.total_deductions)}</span>
              </div>
              <div className="flex justify-between text-slate-400 font-semibold border-t border-slate-800/80 pt-2">
                <span>Taxable Income:</span>
                <span className="text-white">{formatCurrency(result.old_regime.taxable_income)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Base Tax on Slabs:</span>
                <span>{formatCurrency(result.old_regime.base_tax)}</span>
              </div>
              {result.old_regime.section_87a_rebate > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Section 87A Rebate (up to ₹5L):</span>
                  <span>- {formatCurrency(result.old_regime.section_87a_rebate)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Health &amp; Education Cess (4%):</span>
                <span>{formatCurrency(result.old_regime.cess_4pct)}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between mt-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Net Tax Payable</div>
                  <div className="text-2xl font-black text-white font-mono">
                    {formatCurrency(result.old_regime.net_tax_payable)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Effective Rate</div>
                  <div className="text-lg font-bold text-indigo-400 font-mono">
                    {result.old_regime.effective_tax_rate}%
                  </div>
                </div>
              </div>
            </div>

            {/* Slabs Accordion */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowSlabsOld(!showSlabsOld)}
                className="w-full flex items-center justify-between text-xs text-indigo-400 hover:text-indigo-300 font-medium py-1"
              >
                <span>{showSlabsOld ? "Hide Slab Math" : "Show Slab Breakdown"}</span>
                {showSlabsOld ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showSlabsOld && (
                <div className="mt-2 space-y-1.5 text-[11px] bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
                  {result.old_regime.slabs_breakdown.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-slate-400">
                      <span>
                        {s.bracket} ({s.rate}):
                      </span>
                      <span className={s.tax > 0 ? "text-white" : "text-slate-500"}>{formatCurrency(s.tax)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Income & Deductions Form */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-white space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Layers className="text-indigo-400" size={18} />
            <h3 className="font-bold text-base">Interactive Income &amp; Deduction Parameters</h3>
          </div>
          <span className="text-xs text-slate-400">Changes recalculate instantly</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Gross Salary */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <Landmark size={14} className="text-indigo-400" />
                <span>Gross Annual Salary</span>
              </label>
              <span className="font-mono text-indigo-300 font-bold">{formatCurrency(grossSalary)}</span>
            </div>
            <input
              type="range"
              min={300000}
              max={5000000}
              step={25000}
              value={grossSalary}
              onChange={(e) => handleGrossChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <input
              type="number"
              value={grossSalary}
              onChange={(e) => handleGrossChange(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          {/* Basic Salary */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <Building2 size={14} className="text-indigo-400" />
                <span>Basic Salary</span>
              </label>
              <span className="font-mono text-slate-400">{formatCurrency(basicSalary)}</span>
            </div>
            <input
              type="number"
              value={basicSalary}
              onChange={(e) => setBasicSalary(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white mt-5"
            />
            <span className="text-[10px] text-slate-500">Used for HRA exemption limit calculations</span>
          </div>

          {/* Section 80C */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <PiggyBank size={14} className="text-emerald-400" />
                <span>Section 80C (PPF, EPF, ELSS, Insurance)</span>
              </label>
              <span className="font-mono text-emerald-400">{formatCurrency(section80C)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={150000}
              step={5000}
              value={section80C}
              onChange={(e) => setSection80C(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <input
              type="number"
              max={150000}
              value={section80C}
              onChange={(e) => setSection80C(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          {/* Section 80D (Self & Family) */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <HeartPulse size={14} className="text-rose-400" />
                <span>80D Health Insurance (Self &amp; Family)</span>
              </label>
              <span className="font-mono text-rose-400">{formatCurrency(section80DSelf)}</span>
            </div>
            <input
              type="number"
              max={25000}
              value={section80DSelf}
              onChange={(e) => setSection80DSelf(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
            <span className="text-[10px] text-slate-500">Max limit: ₹25,000 for self/family</span>
          </div>

          {/* Section 80D (Parents) */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <HeartPulse size={14} className="text-rose-400" />
                <span>80D Health Insurance (Parents)</span>
              </label>
              <span className="font-mono text-rose-400">{formatCurrency(section80DParents)}</span>
            </div>
            <input
              type="number"
              max={parentsSeniorCitizen ? 50000 : 25000}
              value={section80DParents}
              onChange={(e) => setSection80DParents(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
            <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={parentsSeniorCitizen}
                onChange={(e) => setParentsSeniorCitizen(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span>Parents are Senior Citizens (&ge; 60 yrs, ₹50k limit)</span>
            </label>
          </div>

          {/* Section 80CCD(1B) - NPS */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <PiggyBank size={14} className="text-indigo-400" />
                <span>Section 80CCD(1B) (NPS Extra)</span>
              </label>
              <span className="font-mono text-indigo-400">{formatCurrency(section80CCD1B)}</span>
            </div>
            <input
              type="number"
              max={50000}
              value={section80CCD1B}
              onChange={(e) => setSection80CCD1B(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
            <span className="text-[10px] text-slate-500">Dedicated NPS Tier-1 limit up to ₹50,000</span>
          </div>

          {/* Section 24b - Home Loan Interest */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <Home size={14} className="text-amber-400" />
                <span>Section 24(b) (Home Loan Interest)</span>
              </label>
              <span className="font-mono text-amber-400">{formatCurrency(section24B)}</span>
            </div>
            <input
              type="number"
              max={200000}
              value={section24B}
              onChange={(e) => setSection24B(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
            <span className="text-[10px] text-slate-500">Capped at ₹2,00,000 for self-occupied property</span>
          </div>

          {/* HRA Received & Rent Paid */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <Building2 size={14} className="text-cyan-400" />
                <span>Annual HRA Received</span>
              </label>
              <span className="font-mono text-cyan-400">{formatCurrency(hraReceived)}</span>
            </div>
            <input
              type="number"
              value={hraReceived}
              onChange={(e) => setHraReceived(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1">
                <Building2 size={14} className="text-cyan-400" />
                <span>Annual Rent Paid</span>
              </label>
              <span className="font-mono text-cyan-400">{formatCurrency(rentPaid)}</span>
            </div>
            <input
              type="number"
              value={rentPaid}
              onChange={(e) => setRentPaid(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsMetro(true)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  isMetro ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                Metro (50%)
              </button>
              <button
                type="button"
                onClick={() => setIsMetro(false)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  !isMetro ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                Non-Metro (40%)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
