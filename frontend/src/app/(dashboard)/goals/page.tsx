"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertCircle,
  Target,
  PlusCircle,
  Trash2,
  CheckCircle2,
  Sparkles,
  Calendar,
  TrendingUp,
  Clock,
  Award,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { FadeIn, GlowCard, PulseRing, StaggerGrid, StaggerItem } from "@/components/ui/motion";
import { useToast } from "@/context/toast-context";
import { useSoundFX } from "@/context/sound-context";
import { triggerMilestoneCelebration } from "@/lib/celebrate";

type Goal = {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
};

export default function GoalsPage() {
  const { toast } = useToast();
  const { playSuccess, playCelebration, playClick } = useSoundFX();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

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
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-20 blur-lg animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Target className="h-6 w-6 text-emerald-600 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Loading Wealth Milestones...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-5 text-sm text-rose-800 shadow-sm backdrop-blur-sm">
        <AlertCircle size={20} className="shrink-0 text-rose-600" />
        <span className="font-medium">{error}</span>
      </div>
    );
  }

  const sortedGoals = [...goals].sort((a, b) => {
    return (
      new Date(a.target_date || "").getTime() -
      new Date(b.target_date || "").getTime()
    );
  });

  const totalTarget = goals.reduce((acc, g) => acc + (Number(g.target_amount) || 0), 0);
  const totalSaved = goals.reduce((acc, g) => acc + (Number(g.current_amount) || 0), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const completedGoals = goals.filter((g) => (Number(g.current_amount) || 0) >= (Number(g.target_amount) || 1));

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;
    const target_amount = parseFloat(formData.get("target_amount") as string);
    const current_amount =
      parseFloat(formData.get("current_amount") as string) || 0;
    const target_date = formData.get("target_date") as string;

    if (isNaN(target_amount) || target_amount <= 0) {
      toast.warning("Please enter a valid target amount.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuthClient("/api/v1/goals/", {
        method: "POST",
        body: JSON.stringify({
          name,
          target_amount,
          current_amount,
          target_date,
        }),
      });
      if (res.ok) {
        form.reset();
        setShowAddForm(false);
        if (current_amount >= target_amount) {
          triggerMilestoneCelebration();
          playCelebration();
          toast.success(`🎉 Milestone achieved!`, {
            description: `Congratulations on funding "${name}"!`,
          });
        } else {
          playSuccess();
          toast.success(`Milestone "${name}" created!`, {
            description: `Target: ₹${target_amount.toLocaleString("en-IN")}`,
          });
        }
        await loadData();
      } else {
        toast.error("Failed to add milestone.");
      }
    } catch (err) {
      toast.error(`Error adding milestone: ${String(err)}`);
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
        playClick();
        setGoals((prev) => prev.filter((g) => g.id !== id));
        toast.info("Milestone removed from your roadmap.");
      } else {
        toast.error("Failed to delete goal.");
      }
    } catch (err) {
      toast.error(`Error deleting goal: ${String(err)}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      {/* Page Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50/80 px-3 py-0.5 text-xs font-semibold text-emerald-800 shadow-2xs backdrop-blur-xs">
                <PulseRing color="#10b981" size={7} /> Wealth Roadmap
              </span>
              <span className="text-xs text-slate-400 font-medium">•</span>
              <span className="text-xs font-semibold text-slate-500">
                {goals.length} Tracked {goals.length === 1 ? "Goal" : "Goals"}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Financial Goals & Milestones
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              Track progress toward home ownership, retirement buffers, dream vacations, and emergency reserves with dynamic pacing.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#15332f] to-[#1a403a] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#15332f]/20 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98] cursor-pointer"
          >
            <PlusCircle size={17} className="transition-transform group-hover:rotate-90 duration-300" />
            <span>{showAddForm ? "Close Form" : "Create New Goal"}</span>
          </button>
        </div>
      </FadeIn>

      {/* Aggregate Progress Hero Banner */}
      {goals.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-[#15332f] via-[#1a403b] to-[#122c28] p-6 text-white shadow-xl">
            {/* Ambient background glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl" />

            <div className="relative z-10 grid gap-6 md:grid-cols-12 md:items-center">
              <div className="space-y-3 md:col-span-7">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/20 text-emerald-300">
                    <Sparkles size={16} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                    Portfolio Milestone Velocity
                  </span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  ₹{totalSaved.toLocaleString("en-IN")}{" "}
                  <span className="text-base font-normal text-emerald-200/80">
                    accumulated of ₹{totalTarget.toLocaleString("en-IN")}
                  </span>
                </h2>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-emerald-100">
                    <span>Overall Milestone Completion</span>
                    <span className="font-bold text-white">{overallProgress.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5 shadow-inner">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 shadow-sm"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 md:col-span-5 md:border-t-0 md:border-l md:pl-6 md:pt-0">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
                    Completed
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {completedGoals.length} <span className="text-xs font-normal text-emerald-200">/ {goals.length}</span>
                  </p>
                  <p className="text-[10px] text-emerald-100/70 mt-0.5">Milestones reached</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
                    Remaining
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-300">
                    ₹{Math.max(0, totalTarget - totalSaved).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-emerald-100/70 mt-0.5">Target deficit</p>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Collapsible / Animated Goal Creation Card */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="rounded-3xl border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/20 shadow-md">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-slate-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Target size={18} />
                  </div>
                  Define a New Target Milestone
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Set target capital requirements and your target target date to enable intelligent pacing calculations.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleAddGoal} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <label className="text-xs font-semibold text-slate-700">Goal Description</label>
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="e.g. Dream Villa, Emergency Fund, Tokyo Trip"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Target Amount (₹)</label>
                    <input
                      name="target_amount"
                      type="number"
                      step="0.01"
                      min="100"
                      required
                      placeholder="5000000"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Already Saved (₹)</label>
                    <input
                      name="current_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue="0"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Target Deadline</label>
                    <input
                      name="target_date"
                      type="date"
                      required
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="h-10 px-6 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : "Save Milestone"}
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals Staggered Grid */}
      {sortedGoals.length === 0 ? (
        <FadeIn>
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50/50 to-white p-12 text-center shadow-xs">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Target className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Milestones Established Yet</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Set your first target milestone above to begin tracking and unlocking AI-driven portfolio pacing recommendations.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-6 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              <PlusCircle size={15} /> Create First Goal
            </button>
          </div>
        </FadeIn>
      ) : (
        <StaggerGrid className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {sortedGoals.map((goal, idx) => {
            const target = Number(goal.target_amount) || 1;
            const current = Number(goal.current_amount) || 0;
            const progress = target > 0 ? (current / target) * 100 : 0;
            const safeProgress = Math.min(100, Math.max(0, progress));
            const remaining = Math.max(0, target - current);
            const isCompleted = safeProgress >= 100;

            // Days calculation
            let daysLeft = 0;
            if (goal.target_date) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const targetDate = new Date(goal.target_date);
              daysLeft = Math.ceil(
                (targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24)
              );
            }

            // Monthly savings needed
            const monthsLeft = daysLeft > 0 ? daysLeft / 30.4 : 0;
            const monthlyPace = monthsLeft > 0 && remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;

            return (
              <StaggerItem key={goal.id}>
                <GlowCard
                  hoverColor={isCompleted ? "rgba(16, 185, 129, 0.2)" : "rgba(14, 165, 233, 0.15)"}
                  className="group relative flex flex-col justify-between border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/40 to-slate-100/30 p-6 shadow-sm transition-all duration-300"
                >
                  <div className="space-y-4">
                    {/* Top Row: Name, Status Badge, Delete */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {goal.name}
                          </h3>
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 size={11} /> Achieved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar size={13} className="text-slate-400" />
                          <span>Deadline: {goal.target_date || "Open Target"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-tight ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : daysLeft > 30
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : daysLeft > 0
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isCompleted
                            ? "Completed"
                            : daysLeft > 0
                            ? `${daysLeft} days left`
                            : "Past Deadline"}
                        </span>

                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="rounded-lg p-1.5 text-slate-400 opacity-60 hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
                          title="Delete Milestone"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Financial Figures */}
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-2xl font-black tracking-tight text-slate-900">
                          ₹{current.toLocaleString("en-IN")}
                        </span>
                        <span className="ml-1.5 text-xs font-semibold text-slate-400">
                          of ₹{target.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xl font-black ${
                            isCompleted ? "text-emerald-600" : "text-sky-600"
                          }`}
                        >
                          {safeProgress.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with Gradient */}
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner">
                      <motion.div
                        className={`h-full rounded-full ${
                          isCompleted
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                            : "bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${safeProgress}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: idx * 0.1 }}
                      />
                    </div>
                  </div>

                  {/* Bottom Stats Card */}
                  <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="rounded-xl bg-slate-50/80 p-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Remaining Need
                      </span>
                      <span className="font-bold text-slate-800">
                        ₹{remaining.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/80 p-2.5 text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Target Pace
                      </span>
                      <span className="font-bold text-slate-800">
                        {isCompleted
                          ? "✓ Goal Funded"
                          : monthlyPace > 0
                          ? `₹${monthlyPace.toLocaleString("en-IN")} / mo`
                          : "Extend Date"}
                      </span>
                    </div>
                  </div>
                </GlowCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}
    </div>
  );
}
