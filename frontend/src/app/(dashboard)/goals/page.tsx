"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Target, PlusCircle, Trash2, CheckCircle2 } from "lucide-react";

type Goal = {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const res = await fetchWithAuthClient("/api/v1/dashboard/");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const data = await res.json();
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
    return <div className="p-8 text-center animate-pulse">Loading financial goals...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
        <AlertCircle size={20} />
        {error}
      </div>
    );
  }

  const sortedGoals = [...goals].sort((a, b) => {
    return new Date(a.target_date || "").getTime() - new Date(b.target_date || "").getTime();
  });

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const target_amount = parseFloat(formData.get("target_amount") as string);
    const current_amount = parseFloat(formData.get("current_amount") as string) || 0;
    const target_date = formData.get("target_date") as string;

    if (isNaN(target_amount) || target_amount <= 0) {
      alert("Please enter a valid target amount.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuthClient("/api/v1/goals/", {
        method: "POST",
        body: JSON.stringify({ name, target_amount, current_amount, target_date }),
      });
      if (res.ok) {
        form.reset();
        await loadData();
      } else {
        alert("Failed to add goal.");
      }
    } catch (err) {
      alert("Error adding goal: " + String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    try {
      const res = await fetchWithAuthClient(`/api/v1/goals/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setGoals(prev => prev.filter(g => g.id !== id));
      } else {
        alert("Failed to delete goal.");
      }
    } catch (err) {
      alert("Error deleting goal: " + String(err));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Financial Goals & Milestones</h1>
        <p className="text-muted-foreground">Plan and track your progress toward retirement, home down payments, and major life goals.</p>
      </div>

      <Card className="bg-slate-50 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PlusCircle size={18} className="text-blue-600" /> Create New Goal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddGoal} className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Goal Description</label>
              <input name="name" type="text" required placeholder="e.g. Dream Home, Emergency Fund, Vacation" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Target Amount (₹)</label>
              <input name="target_amount" type="number" step="0.01" min="100" required placeholder="5000000" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Current Saved (₹)</label>
              <input name="current_amount" type="number" step="0.01" min="0" required defaultValue="0" className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-sm font-medium">Target Deadline</label>
              <input name="target_date" type="date" required className="w-full h-10 px-3 border rounded-md bg-white" />
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              className="h-10 px-6 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-medium disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Goal"}
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {sortedGoals.length === 0 ? (
          <div className="col-span-full p-12 flex flex-col items-center justify-center border border-dashed rounded-lg bg-slate-50">
            <Target className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium text-lg">No financial goals established.</p>
            <p className="text-slate-400 text-sm mt-1">Set a milestone above to start tracking your savings trajectory.</p>
          </div>
        ) : (
          sortedGoals.map(goal => {
            const target = Number(goal.target_amount) || 1;
            const current = Number(goal.current_amount) || 0;
            const progress = target > 0 ? (current / target) * 100 : 0;
            const safeProgress = Math.min(100, Math.max(0, progress));
            const remaining = Math.max(0, target - current);
            
            // Days calculation
            let daysLeft = 0;
            if (goal.target_date) {
              const today = new Date();
              const targetDate = new Date(goal.target_date);
              daysLeft = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            }

            return (
              <Card key={goal.id} className="relative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{goal.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        safeProgress >= 100 
                          ? 'bg-emerald-100 text-emerald-800'
                          : daysLeft > 0 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {safeProgress >= 100 ? 'Achieved!' : daysLeft > 0 ? `${daysLeft} days left` : 'Past Deadline'}
                      </span>
                      <button 
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">₹{current.toLocaleString("en-IN")}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">saved of ₹{target.toLocaleString("en-IN")}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${safeProgress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {safeProgress.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        safeProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${safeProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">
                      Remaining: <span className="font-semibold text-slate-800">₹{remaining.toLocaleString("en-IN")}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Deadline: <span className="font-semibold text-slate-800">{goal.target_date || "Open"}</span>
                    </span>
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
