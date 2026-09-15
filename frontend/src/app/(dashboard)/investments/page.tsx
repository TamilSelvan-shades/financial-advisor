"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, TrendingDown, PlusCircle, Trash2, PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Investment = {
  id: number;
  name: string;
  category?: string;
  type?: string;
  invested_amount: number;
  current_value: number;
};

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const res = await fetchWithAuthClient("/api/v1/dashboard/");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const data = await res.json();
      setInvestments(data.investments || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center animate-pulse">Loading investments portfolio...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
        <AlertCircle size={20} />
        {error}
      </div>
    );
  }

  const totalInvested = investments.reduce((sum, inv) => {
    const val = Number(inv.invested_amount) || Number(inv.current_value) || 0;
    return sum + val;
  }, 0);

  const currentTotalValue = investments.reduce((sum, inv) => {
    const val = Number(inv.current_value) || Number(inv.invested_amount) || 0;
    return sum + val;
  }, 0);

  const absoluteReturn = currentTotalValue - totalInvested;
  const returnPercentage = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

  // Aggregate by category safely for pie chart
  const typeTotals = investments.reduce((acc, inv) => {
    const cat = inv.category || inv.type || "Other";
    const val = Number(inv.current_value) || Number(inv.invested_amount) || 0;
    acc[cat] = (acc[cat] || 0) + val;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(typeTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const handleAddInvestment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const category = (formData.get("category") as string) || "Equity";
    const invested_amount = parseFloat(formData.get("invested_amount") as string) || 0;
    const current_value = parseFloat(formData.get("current_value") as string) || invested_amount;

    try {
      const res = await fetchWithAuthClient("/api/v1/investments/", {
        method: "POST",
        body: JSON.stringify({ 
          name, 
          category, 
          invested_amount: invested_amount || current_value,
          current_value 
        }),
      });
      if (res.ok) {
        form.reset();
        await loadData();
      } else {
        alert("Failed to add investment.");
      }
    } catch (err) {
      alert("Error adding investment: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvestment = async (id: number) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;
    try {
      const res = await fetchWithAuthClient(`/api/v1/investments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInvestments(prev => prev.filter(inv => inv.id !== id));
      } else {
        alert("Failed to delete investment.");
      }
    } catch (err) {
      alert("Error deleting investment: " + String(err));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Investments & Portfolio</h1>
        <p className="text-muted-foreground">Track asset allocation, mutual funds, stocks, and overall portfolio gains.</p>
      </div>

      <Card className="bg-slate-50 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PlusCircle size={18} className="text-blue-600" /> Add New Asset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddInvestment} className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Asset Name</label>
              <input name="name" type="text" required placeholder="e.g. Nifty 50 Index Fund, S&P 500, Gold" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[160px]">
              <label className="text-sm font-medium">Category</label>
              <select name="category" required className="w-full h-10 px-3 border rounded-md bg-white">
                <option value="Equity">Equity / Stocks</option>
                <option value="Mutual Funds">Mutual Funds</option>
                <option value="Fixed Deposit">Fixed Deposit / Debt</option>
                <option value="Gold & Commodities">Gold & Commodities</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Crypto">Crypto</option>
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Invested (₹)</label>
              <input name="invested_amount" type="number" step="0.01" placeholder="40000" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Current Value (₹)</label>
              <input name="current_value" type="number" step="0.01" required placeholder="45000" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              className="h-10 px-6 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-medium disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Asset"}
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Invested</div>
            <div className="text-2xl font-bold">₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Current Portfolio Value</div>
            <div className="text-2xl font-bold">₹{currentTotalValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Absolute Return</div>
            <div className={`text-2xl font-bold ${absoluteReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {absoluteReturn >= 0 ? '+' : ''}₹{absoluteReturn.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Return %</div>
            <div className={`text-2xl font-bold flex items-center gap-1 ${returnPercentage >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {returnPercentage >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              {returnPercentage >= 0 ? '+' : ''}{returnPercentage.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Asset Class Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No investments logged yet.</p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Asset Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {investments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No assets found in portfolio.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto pr-1">
                {investments.map((inv) => {
                  const curr = Number(inv.current_value) || 0;
                  const invested = Number(inv.invested_amount) || curr;
                  const gain = curr - invested;
                  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;

                  return (
                    <div key={inv.id} className="py-3 flex justify-between items-center gap-4">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{inv.name}</p>
                        <p className="text-xs text-muted-foreground">{inv.category || inv.type || "Asset"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-sm text-slate-900">₹{curr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
                          <p className={`text-xs font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {gain >= 0 ? '+' : ''}₹{gain.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ({gainPct.toFixed(1)}%)
                          </p>
                        </div>
                        <button 
                          onClick={() => handleDeleteInvestment(inv.id)}
                          title="Delete Asset"
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors"
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
      </div>
    </div>
  );
}
