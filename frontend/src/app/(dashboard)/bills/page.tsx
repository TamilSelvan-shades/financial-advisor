"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Calendar,
  PlusCircle,
  Trash2,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Receipt,
  Sparkles,
  ArrowUpRight,
  Radio,
  Zap,
} from "lucide-react";
import { useCurrency } from "@/context/currency-context";
import { PrivacyValue } from "@/context/privacy-context";

type Bill = {
  id: number;
  name: string;
  amount: number;
  due_date?: string;
  due_day?: number;
  frequency?: string;
  is_paid?: boolean;
  status?: string;
};

type DiscoveredBill = {
  merchant: string;
  average_amount: number;
  frequency: string;
  estimated_due_day: number;
  occurrences: number;
  confidence: number;
  category: string;
  raw_names: string[];
};

export default function BillsPage() {
  const { formatCurrency } = useCurrency();
  const [bills, setBills] = useState<Bill[]>([]);
  const [discoveredBills, setDiscoveredBills] = useState<DiscoveredBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [acceptingRadarMerchant, setAcceptingRadarMerchant] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function loadData() {
    try {
      const [dashRes, radarRes] = await Promise.all([
        fetchWithAuthClient("/api/v1/dashboard/"),
        fetchWithAuthClient("/api/v1/bills/discovered-recurring"),
      ]);

      if (!dashRes.ok) throw new Error("Failed to fetch dashboard data");
      const dashData = await dashRes.json();
      setBills(dashData.bills || []);

      if (radarRes.ok) {
        const radarData = await radarRes.json();
        setDiscoveredBills(radarData.discovered_bills || []);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date();
  const currentDay = today.getDate();

  // Classify bills
  const overdueBills = bills.filter((b) => {
    const isPaid = b.status === "Paid" || b.is_paid;
    const dueDay = b.due_day || 1;
    return !isPaid && dueDay < currentDay;
  });

  const dueTodayBills = bills.filter((b) => {
    const isPaid = b.status === "Paid" || b.is_paid;
    const dueDay = b.due_day || 1;
    return !isPaid && dueDay === currentDay;
  });

  const upcomingBills = bills
    .filter((b) => {
      const isPaid = b.status === "Paid" || b.is_paid;
      const dueDay = b.due_day || 1;
      return !isPaid && dueDay > currentDay;
    })
    .sort((a, b) => (a.due_day || 1) - (b.due_day || 1));

  const paidBills = bills
    .filter((b) => b.status === "Paid" || b.is_paid)
    .sort((a, b) => (b.due_day || 1) - (a.due_day || 1));

  const handleAddBill = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const due_day = parseInt(formData.get("due_day") as string, 10);
    const status = "Pending";

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid bill amount.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuthClient("/api/v1/bills/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, amount, due_day, status }),
      });
      if (res.ok) {
        form.reset();
        setToastMessage(`✓ Added recurring bill "${name}"!`);
        await loadData();
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        alert("Failed to add bill.");
      }
    } catch (err) {
      alert("Error adding bill: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleBill = async (id: number, billName: string) => {
    setSettlingId(id);
    try {
      const res = await fetchWithAuthClient(`/api/v1/bills/${id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_log_expense: true, account: "ICICI Savings Account" }),
      });
      if (res.ok) {
        setToastMessage(`✓ Settle complete: "${billName}" marked as paid & logged into expenses!`);
        await loadData();
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        alert("Failed to settle bill.");
      }
    } catch (err) {
      alert("Error settling bill: " + String(err));
    } finally {
      setSettlingId(null);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const res = await fetchWithAuthClient(`/api/v1/bills/${id}/toggle-status`, {
        method: "PUT",
      });
      if (res.ok) {
        await loadData();
      } else {
        alert("Failed to update status.");
      }
    } catch (err) {
      alert("Error updating status: " + String(err));
    }
  };

  const handleDeleteBill = async (id: number) => {
    if (!confirm("Are you sure you want to delete this bill?")) return;
    try {
      const res = await fetchWithAuthClient(`/api/v1/bills/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBills((prev) => prev.filter((b) => b.id !== id));
      } else {
        alert("Failed to delete bill.");
      }
    } catch (err) {
      alert("Error deleting bill: " + String(err));
    }
  };

  const handleAcceptDiscovered = async (item: DiscoveredBill) => {
    setAcceptingRadarMerchant(item.merchant);
    try {
      const res = await fetchWithAuthClient("/api/v1/bills/accept-discovered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.merchant,
          amount: item.average_amount,
          due_day: item.estimated_due_day,
          category: item.category || "Subscription",
        }),
      });
      if (res.ok) {
        setToastMessage(`✓ Tracked "${item.merchant}" into active bills!`);
        setDiscoveredBills((prev) => prev.filter((b) => b.merchant !== item.merchant));
        await loadData();
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        alert("Failed to track discovered subscription.");
      }
    } catch (err) {
      alert("Error accepting bill: " + String(err));
    } finally {
      setAcceptingRadarMerchant(null);
    }
  };

  const totalOverdue = overdueBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalUpcoming = (dueTodayBills.concat(upcomingBills)).reduce(
    (sum, b) => sum + (Number(b.amount) || 0),
    0
  );

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-slate-500">Loading recurring bills & reminder schedule...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
        <AlertCircle size={20} />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Recurring Bills & Reminders</h1>
        <p className="text-muted-foreground">
          Track monthly utilities, subscriptions, and auto-debits with proactive overdue tracking and 1-click ledger settlement.
        </p>
      </div>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* OVERDUE CRITICAL BANNER (if any) */}
      {overdueBills.length > 0 && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-rose-950">
                Action Required: {overdueBills.length} Overdue Bill(s) Totaling{" "}
                <PrivacyValue value={formatCurrency(totalOverdue)} />
              </h3>
              <p className="text-xs text-rose-700">
                These bills have passed their due day for this month. Settle now to prevent late fees or credit reporting.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById("overdue-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
          >
            Review Overdue ({overdueBills.length})
          </button>
        </div>
      )}

      {/* AI RECURRING BILL & SUBSCRIPTION RADAR (if discovered) */}
      {discoveredBills.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-blue-50/70 border-2 border-indigo-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-indigo-950">
                    AI Discovered Subscriptions Radar
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider">
                    {discoveredBills.length} Found
                  </span>
                </div>
                <p className="text-xs text-indigo-700 mt-0.5">
                  Our pattern engine detected recurring cadences from your past bank transactions that aren&apos;t tracked in your bills yet.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 border border-indigo-100 text-[11px] font-semibold text-indigo-900 shadow-2xs">
                <Radio size={12} className="text-indigo-600 animate-pulse" /> Auto-Cadence Radar
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {discoveredBills.map((item, idx) => (
              <div
                key={`disc-${idx}`}
                className="p-3.5 bg-white rounded-xl border border-indigo-100/90 shadow-2xs flex flex-col justify-between gap-3 hover:border-indigo-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {item.merchant}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                      {item.confidence}% Match
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{item.category || "Subscription"}</span>
                    <span>•</span>
                    <span>~Day {item.estimated_due_day} due</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-lg font-extrabold text-indigo-950">
                      <PrivacyValue value={formatCurrency(item.average_amount)} />
                    </span>
                    <span className="text-xs text-slate-400 font-normal"> / month</span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic">
                    Seen {item.occurrences}x recurring monthly in transactions
                  </p>
                </div>

                <button
                  onClick={() => handleAcceptDiscovered(item)}
                  disabled={acceptingRadarMerchant === item.merchant}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <PlusCircle size={14} />
                  <span>
                    {acceptingRadarMerchant === item.merchant ? "Adding..." : "Track This Bill"}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Bill Form */}
      <Card className="bg-slate-50 border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PlusCircle size={18} className="text-blue-600" /> Add New Recurring Bill
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddBill} className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-700">Bill / Provider Name</label>
              <input
                name="name"
                type="text"
                required
                placeholder="e.g. Broadband, Netflix, Electricity, Rent"
                className="w-full h-10 px-3 border rounded-lg bg-white text-sm"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-slate-700">Due Amount (₹)</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="999"
                className="w-full h-10 px-3 border rounded-lg bg-white text-sm"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-slate-700">Due Day of Month (1-28)</label>
              <input
                name="due_day"
                type="number"
                min="1"
                max="28"
                required
                defaultValue="10"
                className="w-full h-10 px-3 border rounded-lg bg-white text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-6 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium text-sm disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submitting ? "Saving..." : "Save Bill"}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={overdueBills.length > 0 ? "border-rose-300 bg-rose-50/20" : ""}>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Overdue Balance
            </div>
            <div className={`text-2xl font-bold ${overdueBills.length > 0 ? "text-rose-600" : "text-slate-800"}`}>
              <PrivacyValue value={formatCurrency(totalOverdue)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overdueBills.length} overdue invoice(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Upcoming Dues
            </div>
            <div className="text-2xl font-bold text-amber-600">
              <PrivacyValue value={formatCurrency(totalUpcoming)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dueTodayBills.length + upcomingBills.length} pending bill(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Settled this Month
            </div>
            <div className="text-2xl font-bold text-emerald-600">{paidBills.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Paid & ledger recorded</p>
          </CardContent>
        </Card>
      </div>

      {/* OVERDUE INVOICES LIST (if any) */}
      {overdueBills.length > 0 && (
        <Card id="overdue-section" className="border-rose-200 shadow-sm">
          <CardHeader className="bg-rose-50/40 border-b border-rose-100">
            <CardTitle className="text-sm font-bold text-rose-950 flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600" />
              Overdue Bills (Action Required)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="divide-y divide-rose-100">
              {overdueBills.map((bill) => {
                const daysOverdue = currentDay - (bill.due_day || 1);
                return (
                  <div key={`overdue-${bill.id}`} className="py-3 flex justify-between items-center gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-rose-600 text-white">
                          Overdue ({daysOverdue}d)
                        </span>
                        <p className="font-bold text-sm text-slate-900 truncate">{bill.name}</p>
                      </div>
                      <p className="text-xs text-rose-700 mt-0.5">
                        Due day was {bill.due_day} of this month
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-sm text-rose-950">
                        <PrivacyValue value={formatCurrency(bill.amount)} />
                      </span>
                      <button
                        onClick={() => handleSettleBill(bill.id, bill.name)}
                        disabled={settlingId === bill.id}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        title="Mark paid and auto-record to expense ledger"
                      >
                        {settlingId === bill.id ? "Settling..." : "Pay & Log"}
                      </button>
                      <button
                        onClick={() => handleDeleteBill(bill.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                        title="Delete Bill"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Upcoming vs Settled */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending & Upcoming Bills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Pending & Upcoming Bills</span>
              <span className="text-xs font-normal text-muted-foreground">
                {dueTodayBills.length + upcomingBills.length} items
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dueTodayBills.length === 0 && upcomingBills.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
                <Calendar className="h-10 w-10 text-slate-300" />
                <p className="text-sm">All pending bills are paid up!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Due Today */}
                {dueTodayBills.map((bill) => (
                  <div key={`today-${bill.id}`} className="py-3 flex justify-between items-center gap-4 bg-amber-50/50 -mx-4 px-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-500 text-white">
                          Due Today
                        </span>
                        <p className="font-bold text-sm text-slate-900 truncate">{bill.name}</p>
                      </div>
                      <p className="text-xs text-amber-700">Due day {bill.due_day} (Today)</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-sm text-slate-900">
                        <PrivacyValue value={formatCurrency(bill.amount)} />
                      </span>
                      <button
                        onClick={() => handleSettleBill(bill.id, bill.name)}
                        disabled={settlingId === bill.id}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {settlingId === bill.id ? "..." : "Pay & Log"}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Upcoming */}
                {upcomingBills.map((bill) => {
                  const daysAway = (bill.due_day || 1) - currentDay;
                  return (
                    <div key={bill.id} className="py-3 flex justify-between items-center gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">{bill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Due day {bill.due_day || 1} • in {daysAway} days
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-sm text-slate-900">
                          <PrivacyValue value={formatCurrency(bill.amount)} />
                        </span>
                        <button
                          onClick={() => handleSettleBill(bill.id, bill.name)}
                          disabled={settlingId === bill.id}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                          title="Settle bill & log expense"
                        >
                          {settlingId === bill.id ? "..." : "Pay & Log"}
                        </button>
                        <button
                          onClick={() => handleDeleteBill(bill.id)}
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                          title="Delete Bill"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settled Bills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Settled Bills</span>
              <span className="text-xs font-normal text-muted-foreground">{paidBills.length} items</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paidBills.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
                <p className="text-sm">No settled bills for this period.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paidBills.slice(0, 10).map((bill) => (
                  <div key={bill.id} className="py-3 flex justify-between items-center gap-4 opacity-75">
                    <div>
                      <p className="font-semibold text-sm line-through text-slate-500">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">Settled • Due day {bill.due_day || 1}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm text-slate-600">
                        <PrivacyValue value={formatCurrency(bill.amount)} />
                      </span>
                      <button
                        onClick={() => handleToggleStatus(bill.id)}
                        className="px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Reopen as pending"
                      >
                        <RotateCcw size={12} /> Reopen
                      </button>
                      <button
                        onClick={() => handleDeleteBill(bill.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                        title="Delete Bill"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
