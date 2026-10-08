"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, TrendingDown, PlusCircle, Trash2, PieChart as PieIcon, Sparkles } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Investment = {
  id: number;
  name: string;
  category?: string;
  type?: string;
  invested_amount: number;
  current_value: number;
  ticker_symbol?: string;
  live_tracking_type?: string;
};

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [topUpInvestment, setTopUpInvestment] = useState<Investment | null>(null);

  async function loadData() {
    try {
      const res = await fetchWithAuthClient("/api/v1/dashboard/");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const data = await res.json();
      setInvestments(data.investments || []);
      setGoals(data.goals || []);
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

    const ticker_symbol = formData.get("ticker_symbol") as string;
    const live_tracking_type = formData.get("live_tracking_type") as string;
    const quantity = parseFloat(formData.get("quantity") as string) || 0;
    
    const is_sip = formData.get("is_sip") === "on";
    const sip_amount = parseFloat(formData.get("sip_amount") as string) || null;
    const sip_date = parseInt(formData.get("sip_date") as string) || null;
    const goal_id = parseInt(formData.get("goal_id") as string) || null;

    try {
      const res = await fetchWithAuthClient("/api/v1/investments/", {
        method: "POST",
        body: JSON.stringify({ 
          name, 
          category, 
          invested_amount: invested_amount || current_value,
          current_value,
          ticker_symbol: ticker_symbol || null,
          live_tracking_type: live_tracking_type !== "none" ? live_tracking_type : null,
          quantity,
          is_sip,
          sip_amount,
          sip_date,
          goal_id
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

  const handleRefreshPrice = async (id: number) => {
    try {
      const res = await fetchWithAuthClient(`/api/v1/investments/${id}/refresh`, {
        method: "POST",
      });
      if (res.ok) {
        await loadData();
      } else {
        alert("Failed to refresh price.");
      }
    } catch (err) {
      alert("Error refreshing price: " + String(err));
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisReport(null);
    try {
      const res = await fetchWithAuthClient(`/api/v1/investments/analyze`);
      if (res.ok) {
        const data = await res.json();
        setAnalysisReport(data.analysis);
      } else {
        alert("Failed to analyze portfolio.");
      }
    } catch (err) {
      alert("Error analyzing portfolio: " + String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!topUpInvestment) return;
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const amount = parseFloat(formData.get("amount") as string) || 0;
    const quantity = parseFloat(formData.get("quantity") as string) || 0;
    
    try {
      const res = await fetchWithAuthClient(`/api/v1/investments/${topUpInvestment.id}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          type: "BUY",
          date: new Date().toISOString().split("T")[0],
          amount,
          quantity: quantity || null
        })
      });
      if (res.ok) {
        setTopUpInvestment(null);
        await loadData();
      } else {
        alert("Failed to add funds.");
      }
    } catch (err) {
      alert("Error adding funds: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Investments & Portfolio</h1>
          <p className="text-muted-foreground">Track asset allocation, mutual funds, stocks, and overall portfolio gains.</p>
        </div>
        <button 
          onClick={handleAnalyze} 
          disabled={analyzing}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm disabled:opacity-70"
        >
          <Sparkles size={18} />
          {analyzing ? "Analyzing..." : "AI Portfolio X-Ray"}
        </button>
      </div>

      {analysisReport && (
        <Card className="bg-purple-50/50 border-purple-100 shadow-inner">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-purple-900">
              <Sparkles size={20} className="text-purple-600" /> AI Portfolio X-Ray
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-slate-800 prose-headings:text-purple-900 prose-p:leading-relaxed">
              <pre className="whitespace-pre-wrap font-sans text-sm">{analysisReport}</pre>
            </div>
            <button 
              onClick={() => setAnalysisReport(null)}
              className="mt-4 text-sm text-purple-700 font-medium hover:text-purple-900"
            >
              Close Report
            </button>
          </CardContent>
        </Card>
      )}

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
              <label className="text-sm font-medium">Tracking Type</label>
              <select name="live_tracking_type" className="w-full h-10 px-3 border rounded-md bg-white">
                <option value="none">Manual / None</option>
                <option value="mutual_fund">Mutual Fund (India)</option>
                <option value="stock">Stock (Yahoo)</option>
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Ticker/Scheme ID</label>
              <input name="ticker_symbol" type="text" placeholder="e.g. 122639 or RELIANCE.NS" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Invested (₹)</label>
              <input name="invested_amount" type="number" step="0.01" placeholder="40000" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Quantity/Units (for Live)</label>
              <input name="quantity" type="number" step="0.0001" placeholder="10.5" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Current Value (₹)</label>
              <input name="current_value" type="number" step="0.01" required placeholder="45000" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium">Link to Goal (Optional)</label>
              <select name="goal_id" className="w-full h-10 px-3 border rounded-md bg-white">
                <option value="">No Goal Linked</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name} (Target: ₹{Number(g.target_amount).toLocaleString("en-IN")})</option>
                ))}
              </select>
            </div>
            
            {/* SIP Section */}
            <div className="w-full flex gap-4 items-center p-3 bg-blue-50 border border-blue-100 rounded-md">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_sip" id="is_sip" className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="is_sip" className="text-sm font-medium text-blue-900">Auto-SIP</label>
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-blue-800">Monthly Amount (₹)</label>
                <input name="sip_amount" type="number" step="0.01" placeholder="2000" className="w-full h-8 px-2 text-sm border rounded bg-white" />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-blue-800">Day of Month</label>
                <input name="sip_date" type="number" min="1" max="28" placeholder="5" className="w-full h-8 px-2 text-sm border rounded bg-white" />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="h-10 px-6 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-medium disabled:opacity-50 w-full md:w-auto"
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
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{inv.category || inv.type || "Asset"}</p>
                          {(inv as any).goal_id && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                              🎯 {goals.find(g => g.id === (inv as any).goal_id)?.name || "Linked to Goal"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-sm text-slate-900">₹{curr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
                          <div className="flex items-center justify-end gap-2">
                            <p className={`text-xs font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {gain >= 0 ? '+' : ''}₹{gain.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ({gainPct.toFixed(1)}%)
                            </p>
                            {(inv as any).xirr !== undefined && (inv as any).xirr !== null && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                XIRR: {((inv as any).xirr).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        {inv.ticker_symbol && inv.live_tracking_type ? (
                          <button 
                            onClick={() => handleRefreshPrice(inv.id)}
                            title="Refresh Live Price"
                            className="text-blue-500 hover:text-blue-700 p-1 transition-colors"
                          >
                            <TrendingUp size={15} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => setTopUpInvestment(inv)}
                            title="Add Funds / Top-Up"
                            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded text-xs font-semibold transition-colors"
                          >
                            Top-Up
                          </button>
                        )}
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

      {topUpInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Add Funds to {topUpInvestment.name}</h3>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleTopUpSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Amount to Add (₹)</label>
                  <input name="amount" type="number" step="0.01" required placeholder="e.g. 5000" className="w-full h-10 px-3 border rounded-md" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Add Quantity / Grams (Optional)</label>
                  <input name="quantity" type="number" step="0.0001" placeholder="e.g. 2.5" className="w-full h-10 px-3 border rounded-md" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setTopUpInvestment(null)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                    {submitting ? "Saving..." : "Add Funds"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
