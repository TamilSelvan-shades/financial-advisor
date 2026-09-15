"use client";

import React, { useState } from "react";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Flame, 
  Copy, 
  TrendingUp, 
  Check, 
  X, 
  ChevronRight, 
  Sparkles,
  Info,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PrivacyValue } from "@/context/privacy-context";
import { fetchWithAuthClient } from "@/lib/api-client";

export interface AnomalyItem {
  id: string;
  type: "duplicate_charge" | "price_creep" | "zombie_subscription" | "outlier_expense" | string;
  severity: "high" | "medium" | "low" | string;
  title: string;
  description: string;
  amount: number;
  date?: string;
  action_suggested?: string;
  confidence?: number;
}

interface AnomalyDetectorCardProps {
  anomalies?: AnomalyItem[];
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export function AnomalyDetectorCard({ anomalies = [], onDismiss, compact = false }: AnomalyDetectorCardProps) {
  const [items, setItems] = useState<AnomalyItem[]>(anomalies);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Sync with prop updates
  React.useEffect(() => {
    setItems(anomalies);
  }, [anomalies]);

  const handleDismiss = async (id: string) => {
    setDismissingId(id);
    try {
      await fetchWithAuthClient("/api/v1/intelligence/anomalies/dismiss", {
        method: "POST",
        body: JSON.stringify({ anomaly_id: id }),
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (onDismiss) onDismiss(id);
    } catch (e) {
      console.error("Failed to dismiss anomaly:", e);
    } finally {
      setDismissingId(null);
    }
  };

  const handleSeedDemo = async () => {
    setActionLoading(true);
    try {
      const res = await fetchWithAuthClient("/api/v1/intelligence/anomalies/seed-test-data", {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setActionLoading(true);
    try {
      const res = await fetchWithAuthClient("/api/v1/intelligence/anomalies/clear-test-data", {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (!items || items.length === 0) {
    if (compact) return null;
    return (
      <Card className="border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-white border shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 border border-emerald-200">
              <Check size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">Autonomous Guardian: Clean Standing</p>
              <p className="text-xs text-slate-500">
                0 leaks, double charges, or zombie subscriptions detected in your transactions.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedDemo}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors shrink-0 self-start sm:self-auto shadow-sm disabled:opacity-50"
          >
            <Sparkles size={13} />
            {actionLoading ? "Injecting..." : "🧪 Test with Demo Anomalies"}
          </button>
        </CardContent>
      </Card>
    );
  }

  const highSeverityCount = items.filter((i) => i.severity === "high").length;
  const totalLeakAmount = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  return (
    <Card className="border-rose-100/80 bg-gradient-to-br from-white via-rose-50/20 to-slate-50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-rose-100/60 bg-rose-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-slate-900">
                  Autonomous Anomaly & Zombie Detector
                </CardTitle>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-600 text-white shadow-sm">
                  {items.length} {items.length === 1 ? "Alert" : "Alerts"}
                </span>
                <button
                  onClick={handleClearDemo}
                  disabled={actionLoading}
                  title="Clear test anomalies and return to clean standing"
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors underline ml-2"
                >
                  🧹 Clear Demo Data
                </button>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Proactive scanner caught potential leaks, double charges, and subscription creeping.
              </CardDescription>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] font-medium text-slate-500 block">Total Flagged Capital</span>
            <span className="text-sm font-bold text-rose-600">
              <PrivacyValue value={formatINR(totalLeakAmount)} />
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {items.map((item) => {
          const isHigh = item.severity === "high";
          const isMedium = item.severity === "medium";

          let IconComponent = AlertTriangle;
          if (item.type === "duplicate_charge") IconComponent = Copy;
          else if (item.type === "price_creep") IconComponent = TrendingUp;
          else if (item.type === "zombie_subscription") IconComponent = Flame;

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isHigh
                  ? "bg-rose-50/70 border-rose-200 text-rose-950"
                  : isMedium
                  ? "bg-amber-50/60 border-amber-200 text-amber-950"
                  : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    isHigh
                      ? "bg-rose-200/80 text-rose-800"
                      : isMedium
                      ? "bg-amber-200/80 text-amber-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  <IconComponent size={16} />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold tracking-tight">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.2 rounded-full border ${
                        isHigh
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : isMedium
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      {item.severity}
                    </span>
                    {item.date && (
                      <span className="text-[11px] text-slate-500">{item.date}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                  {item.action_suggested && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium pt-0.5">
                      <Sparkles size={12} className="text-indigo-600" />
                      <span>Action: {item.action_suggested}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Impact</span>
                  <span className="text-sm font-bold text-slate-900">
                    <PrivacyValue value={formatINR(item.amount)} />
                  </span>
                </div>
                <button
                  onClick={() => handleDismiss(item.id)}
                  disabled={dismissingId === item.id}
                  title="Dismiss this alert"
                  className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors shrink-0 disabled:opacity-50"
                >
                  {dismissingId === item.id ? "..." : "Dismiss"}
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
