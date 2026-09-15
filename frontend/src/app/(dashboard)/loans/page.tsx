"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileText, Trash2, Edit2, Landmark, Calculator, Sparkles, Sliders, ChevronDown, ChevronUp } from "lucide-react";
import { PrivacyValue } from "@/context/privacy-context";
import { DebtPayoffMatrix } from "@/components/debt-payoff-matrix";
import { ScenarioSandbox } from "@/components/scenario-sandbox";

type Loan = {
  id: number;
  bank_name?: string;
  name?: string;
  principal: number;
  sanctioned_amount?: number;
  interest_rate: number;
  tenure_months: number;
  tenure_years?: number;
  start_date?: string;
  emi?: number;
  extra_prepayment?: number;
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showProspectiveSandbox, setShowProspectiveSandbox] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);

  const [formValues, setFormValues] = useState({
    sanctioned_amount: "",
    principal: "",
    interest_rate: "",
    original_tenure_months: "",
    emi: "",
    extra_prepayment: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues(prev => ({...prev, [e.target.name]: e.target.value}));
  };

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetchWithAuthClient("/api/v1/dashboard/");
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        const data = await res.json();
        setLoans(data.loans || []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center animate-pulse">Loading loans data...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
        <AlertCircle size={20} />
        {error}
      </div>
    );
  }

  const calculateEMI = (p: number, r: number, n: number) => {
    const principal = Number(p) || 0;
    const rate = Number(r) || 0;
    const months = Number(n) || 1;
    if (principal <= 0 || months <= 0) return 0;
    
    const rMonthly = rate / (12 * 100);
    if (rMonthly === 0) return principal / months;
    
    const emi = (principal * rMonthly * Math.pow(1 + rMonthly, months)) / (Math.pow(1 + rMonthly, months) - 1);
    return isNaN(emi) ? 0 : emi;
  };

  const guessOriginalEmi = (sanctioned: number, current: number, rate: number, remainingMonths: number) => {
    const rMonthly = rate / (12 * 100);
    if (rMonthly <= 0) return sanctioned / (remainingMonths + 1);
    
    let bestEmi = calculateEMI(current, rate, remainingMonths);
    let smallestDiff = Infinity;
    
    for (let elapsed = 1; elapsed <= 120; elapsed++) {
        const totalMonths = remainingMonths + elapsed;
        const testEmi = calculateEMI(sanctioned, rate, totalMonths);
        const rFactor = Math.pow(1 + rMonthly, elapsed);
        const pTest = sanctioned * rFactor - testEmi * ((rFactor - 1) / rMonthly);
        
        const diff = Math.abs(pTest - current);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            bestEmi = testEmi;
        }
    }
    return bestEmi;
  };

  const totalPrincipal = loans.reduce((sum, loan) => sum + (Number(loan.principal) || 0), 0);
  const totalEMI = loans.reduce((sum, loan) => {
    const months = loan.tenure_months || (loan.tenure_years ? loan.tenure_years * 12 : 12);
    let emiVal = loan.emi;
    if (!emiVal) {
      if (loan.sanctioned_amount && loan.sanctioned_amount > loan.principal) {
          emiVal = guessOriginalEmi(loan.sanctioned_amount, loan.principal, loan.interest_rate, months);
      } else {
          emiVal = calculateEMI(loan.principal, loan.interest_rate, months);
      }
    }
    return sum + emiVal;
  }, 0);

  const handleAddLoan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const principal = parseFloat(formData.get("principal") as string);
    const sanctionedStr = formData.get("sanctioned_amount") as string;
    const sanctioned_amount = sanctionedStr ? parseFloat(sanctionedStr) : undefined;
    const interest_rate = parseFloat(formData.get("interest_rate") as string);
    const original_tenure_months = parseInt(formData.get("original_tenure_months") as string, 10);
    const emiStr = formData.get("emi") as string;
    let emi = emiStr ? parseFloat(emiStr) : undefined;
    const extraPreStr = formData.get("extra_prepayment") as string;
    const extra_prepayment = extraPreStr ? parseFloat(extraPreStr) : undefined;
    const bank_name = (formData.get("bank_name") as string) || "Bank Loan";
    
    let tenure_months = original_tenure_months;
    if (sanctioned_amount && sanctioned_amount > principal) {
        const rMonthly = interest_rate / (12 * 100);
        if (rMonthly > 0) {
            const rFactor = Math.pow(1 + rMonthly, original_tenure_months);
            const inner = rFactor - (principal / sanctioned_amount) * (rFactor - 1);
            if (inner > 0) {
                const monthsElapsed = Math.log(inner) / Math.log(1 + rMonthly);
                tenure_months = Math.max(1, Math.round(original_tenure_months - monthsElapsed));
            }
        } else {
            const tempEmi = sanctioned_amount / original_tenure_months;
            const monthsElapsed = (sanctioned_amount - principal) / tempEmi;
            tenure_months = Math.max(1, Math.round(original_tenure_months - monthsElapsed));
        }
        
        if (!emi) {
            emi = calculateEMI(sanctioned_amount, interest_rate, original_tenure_months);
        }
    }
    
    const tenure_years = tenure_months / 12;

    const method = editingLoanId ? "PUT" : "POST";
    const url = editingLoanId ? `/api/v1/loans/${editingLoanId}` : "/api/v1/loans/";

    try {
      const res = await fetchWithAuthClient(url, {
        method: method,
        body: JSON.stringify({ 
          principal,
          sanctioned_amount,
          interest_rate, 
          tenure_months, 
          tenure_years, 
          bank_name, 
          name: bank_name,
          emi,
          extra_prepayment
        }),
      });
      if (res.ok) {
        form.reset();
        setFormValues({
          sanctioned_amount: "",
          principal: "",
          interest_rate: "",
          original_tenure_months: "",
          emi: "",
          extra_prepayment: ""
        });
        setEditingLoanId(null);
        // Refresh loans
        const dRes = await fetchWithAuthClient("/api/v1/dashboard/");
        if (dRes.ok) {
          const dData = await dRes.json();
          setLoans(dData.loans || []);
        }
      } else {
        alert("Failed to add loan. Please verify your inputs.");
      }
    } catch (err) {
      alert("Error adding loan: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLoan = async (id: number) => {
    if (!confirm("Are you sure you want to delete this loan?")) return;
    try {
      const res = await fetchWithAuthClient(`/api/v1/loans/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLoans(prev => prev.filter(l => l.id !== id));
      } else {
        alert("Failed to delete loan.");
      }
    } catch (err) {
      alert("Error deleting loan: " + String(err));
    }
  };

  const handleEditLoan = (loan: Loan) => {
    setEditingLoanId(loan.id);
    const months = loan.tenure_months || (loan.tenure_years ? Math.round(loan.tenure_years * 12) : 12);
    
    let originalTenure = months;
    if (loan.sanctioned_amount && loan.sanctioned_amount > loan.principal) {
        const rMonthly = loan.interest_rate / (12 * 100);
        let smallestDiff = Infinity;
        for (let elapsed = 1; elapsed <= 120; elapsed++) {
            const totalMonths = months + elapsed;
            const testEmi = calculateEMI(loan.sanctioned_amount, loan.interest_rate, totalMonths);
            const rFactor = Math.pow(1 + rMonthly, elapsed);
            const pTest = loan.sanctioned_amount * rFactor - testEmi * ((rFactor - 1) / rMonthly);
            const diff = Math.abs(pTest - loan.principal);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                originalTenure = totalMonths;
            }
        }
    }

    setFormValues({
      sanctioned_amount: loan.sanctioned_amount ? loan.sanctioned_amount.toString() : "",
      principal: loan.principal.toString(),
      interest_rate: loan.interest_rate.toString(),
      original_tenure_months: originalTenure.toString(),
      emi: loan.emi ? loan.emi.toString() : "",
      extra_prepayment: loan.extra_prepayment ? loan.extra_prepayment.toString() : "",
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  let preview: { type: "calculated", monthsElapsed: number, remainingTenure: number, originalEmi: number } | { type: "standard", emi: number, remainingTenure: number } | { type: "manual", emi: number, remainingTenure: number } | null = null;
  const sAmt = parseFloat(formValues.sanctioned_amount || "0");
  const cAmt = parseFloat(formValues.principal || "0");
  const iRate = parseFloat(formValues.interest_rate || "0");
  const oTenure = parseInt(formValues.original_tenure_months || "0", 10);
  const uEmi = parseFloat(formValues.emi || "0");

  if (cAmt > 0 && iRate > 0 && oTenure > 0) {
     if (uEmi > 0) {
        preview = { type: "manual", emi: uEmi, remainingTenure: oTenure };
     } else if (sAmt > cAmt) {
        const rMonthly = iRate / (12 * 100);
        const rFactor = Math.pow(1 + rMonthly, oTenure);
        const inner = rFactor - (cAmt / sAmt) * (rFactor - 1);
        if (inner > 0) {
            const monthsElapsed = Math.log(inner) / Math.log(1 + rMonthly);
            const remainingTenure = Math.max(1, Math.round(oTenure - monthsElapsed));
            const originalEmi = calculateEMI(sAmt, iRate, oTenure);
            preview = { type: "calculated", monthsElapsed: Math.round(monthsElapsed), remainingTenure, originalEmi };
        }
     } else {
        const emi = calculateEMI(cAmt, iRate, oTenure);
        preview = { type: "standard", emi, remainingTenure: oTenure };
     }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Loans & Prepayments</h1>
        <p className="text-muted-foreground">Manage your active loans, track outstanding liability, and calculate monthly EMI commitments.</p>
      </div>

      <Card className="bg-slate-50 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark size={18} className="text-blue-600" /> {editingLoanId ? "Edit Loan Facility" : "Add New Loan Facility"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">If this is an old loan, enter your Sanctioned Amount and Current Outstanding Principal and we will automatically calculate the remaining tenure.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddLoan} className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Bank/Lender Name</label>
              <input name="bank_name" type="text" required placeholder="e.g. ICICI Home Loan" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Sanctioned Amount (Optional)</label>
              <input name="sanctioned_amount" type="number" step="0.01" min="1000" placeholder="e.g. 7500000" value={formValues.sanctioned_amount} onChange={handleInputChange} className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Current Outstanding Principal</label>
              <input name="principal" type="number" step="0.01" min="1000" required placeholder="e.g. 7150000" value={formValues.principal} onChange={handleInputChange} className="w-full h-10 px-3 border rounded-md bg-white border-blue-200 focus:border-blue-500" />
            </div>
            <div className="space-y-1 flex-[0.5] min-w-[100px]">
              <label className="text-sm font-medium">Interest Rate (%)</label>
              <input name="interest_rate" type="number" step="0.01" min="0" max="40" required placeholder="8.5" value={formValues.interest_rate} onChange={handleInputChange} className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-[0.5] min-w-[120px]">
              <label className="text-sm font-medium">Total Tenure (Months)</label>
              <input name="original_tenure_months" type="number" min="1" max="480" required placeholder="240" value={formValues.original_tenure_months} onChange={handleInputChange} className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-[0.5] min-w-[150px]">
              <label className="text-sm font-medium">Monthly EMI (Optional)</label>
              <input name="emi" type="number" step="0.01" min="1" placeholder="e.g. 59123" value={formValues.emi} onChange={handleInputChange} className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-[0.5] min-w-[180px]">
              <label className="text-sm font-medium">Extra Prepayment/mo (Opt)</label>
              <input name="extra_prepayment" type="number" step="0.01" min="1" placeholder="e.g. 5000" value={formValues.extra_prepayment} onChange={handleInputChange} className="w-full h-10 px-3 border rounded-md bg-white border-green-200" />
            </div>
            <div className="flex gap-2">
              <button 
                type="submit" 
                disabled={submitting}
                className="h-10 px-6 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-medium disabled:opacity-50"
              >
                {submitting ? "Saving..." : (editingLoanId ? "Update Loan" : "Save Loan")}
              </button>
              {editingLoanId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingLoanId(null);
                    setFormValues({ sanctioned_amount: "", principal: "", interest_rate: "", original_tenure_months: "", emi: "", extra_prepayment: "" });
                  }}
                  className="h-10 px-4 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          {preview && preview.type === "calculated" && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-md text-sm flex gap-4 text-indigo-900 items-center">
              <Sparkles size={16} className="text-indigo-600" />
              <div><strong>Calculated EMI:</strong> ₹{preview.originalEmi.toLocaleString("en-IN", {maximumFractionDigits:0})}</div>
              <div><strong>Months Paid:</strong> {preview.monthsElapsed} Months</div>
              <div><strong>Calculated Remaining Tenure:</strong> {preview.remainingTenure} Months</div>
            </div>
          )}
          {preview && (preview.type === "standard" || preview.type === "manual") && (
            <div className="mt-4 p-3 bg-slate-100 border border-slate-200 rounded-md text-sm flex gap-4 text-slate-800 items-center">
              <Calculator size={16} className="text-slate-500" />
              <div><strong>{preview.type === "manual" ? "Manual EMI:" : "EMI:"}</strong> ₹{preview.emi.toLocaleString("en-IN", {maximumFractionDigits:0})}</div>
              <div><strong>Remaining Tenure:</strong> {preview.remainingTenure} Months</div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Outstanding Debt</div>
            <div className="text-2xl font-bold">
              <PrivacyValue value={`₹${totalPrincipal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Active Loan Accounts</div>
            <div className="text-2xl font-bold">{loans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Monthly EMI Commitment</div>
            <div className="text-2xl font-bold text-rose-600">
              <PrivacyValue value={`₹${totalEMI.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🚀 Phase 2: Algorithmic Debt Payoff Matrix (Snowball vs Avalanche) */}
      {loans.length > 0 && (
        <DebtPayoffMatrix loans={loans} />
      )}

      {/* Prospective Loan Simulator Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Active Loan Portfolio ({loans.length})</h2>
          <p className="text-xs text-muted-foreground">Individual facilities and current payment breakdowns</p>
        </div>
        <button
          type="button"
          onClick={() => setShowProspectiveSandbox(!showProspectiveSandbox)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors self-start sm:self-auto"
        >
          <Sparkles size={14} className="text-indigo-600" />
          {showProspectiveSandbox ? "Hide Scenario Simulator" : "Simulate New Loan / Purchase"}
          {showProspectiveSandbox ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showProspectiveSandbox && (
        <ScenarioSandbox initialMode="car_loan" />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {loans.length === 0 ? (
          <div className="col-span-full p-12 flex flex-col items-center justify-center border border-dashed rounded-lg bg-slate-50">
            <FileText className="h-8 w-8 text-slate-400 mb-4" />
            <p className="text-slate-500 font-medium">No loans recorded yet.</p>
          </div>
        ) : (
          loans.map(loan => {
            let months = loan.tenure_months || (loan.tenure_years ? Math.round(loan.tenure_years * 12) : 12);
            
            let emi = loan.emi;
            if (!emi) {
                if (loan.sanctioned_amount && loan.sanctioned_amount > loan.principal) {
                    emi = guessOriginalEmi(loan.sanctioned_amount, loan.principal, loan.interest_rate, months);
                } else {
                    emi = calculateEMI(loan.principal, loan.interest_rate, months);
                }
            }
            
            let effectiveMonths = months;
            let effectiveEmi = emi;
            let totalPayment = emi * months;
            const extra = loan.extra_prepayment || 0;
            
            if (extra > 0) {
               effectiveEmi = emi + extra;
               const rMonthly = loan.interest_rate / (12 * 100);
               if (rMonthly === 0) {
                   effectiveMonths = Math.ceil(loan.principal / effectiveEmi);
               } else {
                   const inner = 1 - (rMonthly * loan.principal) / effectiveEmi;
                   if (inner > 0) {
                       effectiveMonths = Math.ceil(-Math.log(inner) / Math.log(1 + rMonthly));
                   }
               }
               // Calculate true amortization interest
               let balance = loan.principal;
               let trueTotalPayment = 0;
               for (let i = 0; i < effectiveMonths; i++) {
                   const interest = balance * rMonthly;
                   let principalPayment = effectiveEmi - interest;
                   if (balance < principalPayment) {
                       principalPayment = balance;
                       effectiveEmi = principalPayment + interest;
                   }
                   balance -= principalPayment;
                   trueTotalPayment += effectiveEmi;
                   if (balance <= 0.01) break;
               }
               totalPayment = trueTotalPayment;
            }
            
            const totalInterest = Math.max(0, totalPayment - loan.principal);

            return (
              <Card key={loan.id} className="relative">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">{loan.name || loan.bank_name || "Loan Account"}</CardTitle>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEditLoan(loan)}
                      title="Edit Loan"
                      className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteLoan(loan.id)}
                      title="Delete Loan"
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="font-semibold text-slate-900">
                        <PrivacyValue value={`₹${(loan.principal || 0).toLocaleString("en-IN")}`} />
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Interest</p>
                      <p className="font-semibold text-slate-900">{loan.interest_rate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tenure</p>
                      <p className="font-semibold text-slate-900">
                        {extra > 0 ? (
                           <span className="text-green-600">{effectiveMonths} Mo <span className="text-xs line-through text-slate-400 ml-1">{months}</span></span>
                        ) : (
                           `${months} Months (${((months)/12).toFixed(1)} Yrs)`
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Extra Prepayment</p>
                      <p className="font-semibold text-slate-900">
                        {extra > 0 ? <span className="text-green-600 font-bold">+₹{extra.toLocaleString("en-IN")}/mo</span> : "₹0/mo"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 border border-slate-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Calculator size={14} className="text-blue-600" /> Monthly EMI:
                      </span>
                      <span className="font-bold text-slate-900">
                        <PrivacyValue value={`₹${emi.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Total Interest to Pay:</span>
                      <span className="font-semibold text-rose-600">
                        <PrivacyValue value={`₹${totalInterest.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
