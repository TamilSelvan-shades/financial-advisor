"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Star, Trash2, ShieldCheck } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type CreditScore = {
  id: number;
  score: number;
  bureau?: string;
  agency?: string;
  rating?: string;
  date: string;
};

export default function CreditPage() {
  const [scores, setScores] = useState<CreditScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const res = await fetchWithAuthClient("/api/v1/dashboard/");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const data = await res.json();
      setScores(data.credit_scores || []);
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
    return <div className="p-8 text-center animate-pulse">Loading credit score data...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
        <AlertCircle size={20} />
        {error}
      </div>
    );
  }

  // Filter valid numeric scores and sort chronologically for chart
  const validScores = scores
    .map(s => ({
      ...s,
      score: Number(s.score),
      bureau: s.bureau || s.agency || "CIBIL",
      date: s.date || new Date().toISOString().split("T")[0]
    }))
    .filter(s => !isNaN(s.score) && s.score >= 300 && s.score <= 900);

  const chartData = [...validScores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestScore = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  const getRating = (scoreVal: number | null | undefined) => {
    if (scoreVal === null || scoreVal === undefined || isNaN(scoreVal)) {
      return { text: "No Score", color: "text-slate-500", bg: "bg-slate-100" };
    }
    if (scoreVal >= 750) return { text: "Excellent", color: "text-emerald-600", bg: "bg-emerald-100" };
    if (scoreVal >= 700) return { text: "Good", color: "text-blue-600", bg: "bg-blue-100" };
    if (scoreVal >= 650) return { text: "Fair", color: "text-amber-500", bg: "bg-amber-100" };
    return { text: "Needs Attention", color: "text-rose-600", bg: "bg-rose-100" };
  };

  const rating = latestScore ? getRating(latestScore.score) : null;
  const validScoreNum = latestScore ? latestScore.score : null;
  const strokeOffset = validScoreNum 
    ? Math.max(0, Math.min(502, 502 - (502 * (validScoreNum - 300)) / 600))
    : 502;

  const handleAddScore = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const rawScore = formData.get("score") as string;
    const score = parseInt(rawScore, 10);
    const bureau = (formData.get("bureau") as string) || "CIBIL";
    const date = (formData.get("date") as string) || new Date().toISOString().split("T")[0];

    if (isNaN(score) || score < 300 || score > 900) {
      alert("Please enter a valid credit score between 300 and 900.");
      setSubmitting(false);
      return;
    }

    const r = getRating(score);

    try {
      const res = await fetchWithAuthClient("/api/v1/credit-scores/", {
        method: "POST",
        body: JSON.stringify({ 
          score, 
          date, 
          rating: r.text, 
          bureau, 
          agency: bureau 
        }),
      });
      if (res.ok) {
        form.reset();
        await loadData();
      } else {
        alert("Failed to log score. Please try again.");
      }
    } catch (err) {
      alert("Error logging score: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteScore = async (id: number) => {
    if (!confirm("Are you sure you want to delete this credit score record?")) return;
    try {
      const res = await fetchWithAuthClient(`/api/v1/credit-scores/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setScores(prev => prev.filter(s => s.id !== id));
      } else {
        alert("Failed to delete record.");
      }
    } catch (err) {
      alert("Error deleting record: " + String(err));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Credit Health & Bureau Records</h1>
        <p className="text-muted-foreground">Monitor your credit score rating and trajectory across major Indian credit bureaus.</p>
      </div>

      <Card className="bg-slate-50 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" /> Log New Credit Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddScore} className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Record Date</label>
              <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Credit Bureau / Agency</label>
              <select name="bureau" required className="w-full h-10 px-3 border rounded-md bg-white">
                <option value="CIBIL">CIBIL (TransUnion)</option>
                <option value="Experian">Experian India</option>
                <option value="Equifax">Equifax</option>
                <option value="CRIF High Mark">CRIF High Mark</option>
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Score (300-900)</label>
              <input name="score" type="number" min="300" max="900" required placeholder="750" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              className="h-10 px-6 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-medium disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Record"}
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Gauge Card */}
        <Card className="md:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latest Official Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 text-center">
            {latestScore && validScoreNum !== null ? (
              <>
                <div className="relative mb-4">
                  <svg className="w-48 h-48 transform -rotate-90">
                    <circle className="text-slate-100" strokeWidth="12" stroke="currentColor" fill="transparent" r="80" cx="96" cy="96" />
                    <circle 
                      className={rating?.color} 
                      strokeWidth="12" 
                      strokeDasharray="502" 
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round" 
                      stroke="currentColor" 
                      fill="transparent" 
                      r="80" 
                      cx="96" 
                      cy="96" 
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-extrabold text-slate-900">{validScoreNum}</span>
                    <span className="text-xs text-muted-foreground mt-1">out of 900</span>
                  </div>
                </div>
                <div className={`px-4 py-1 rounded-full text-sm font-bold ${rating?.bg} ${rating?.color} flex items-center gap-1.5`}>
                  <Star size={14} fill="currentColor" />
                  {rating?.text}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Updated on {latestScore.date} • {latestScore.bureau}
                </p>
              </>
            ) : (
              <div className="text-slate-400 py-12 text-center space-y-2">
                <ShieldCheck size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-medium">No score recorded yet</p>
                <p className="text-xs text-muted-foreground">Use the form above to log your current credit score.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Line Chart */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Credit Score Trajectory</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length < 2 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-sm space-y-2">
                <p>Need at least 2 records to render trend line.</p>
                <p className="text-xs text-slate-400">Log periodic score checks to see your progress over time.</p>
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis domain={[300, 900]} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: any) => [`${value} pts`, "Credit Score"]}
                      contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: "#3b82f6" }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Score History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Logged Bureau Records</CardTitle>
        </CardHeader>
        <CardContent>
          {validScores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No records found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...validScores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(score => {
                const r = getRating(score.score);
                return (
                  <div key={score.id} className="py-3.5 flex justify-between items-center gap-4">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{score.bureau}</p>
                      <p className="text-xs text-muted-foreground">{score.date}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${r.bg} ${r.color}`}>{r.text}</div>
                      <div className="font-bold text-lg w-12 text-right text-slate-900">{score.score}</div>
                      <button 
                        onClick={() => handleDeleteScore(score.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                        title="Delete Record"
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
  );
}
