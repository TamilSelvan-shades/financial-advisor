"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast, ToastItem } from "@/context/toast-context";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export function Toaster() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const iconMap = {
    success: <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />,
    error: <AlertCircle size={18} className="text-rose-500 shrink-0" />,
    warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
    info: <Info size={18} className="text-sky-500 shrink-0" />,
  };

  const borderMap = {
    success: "border-emerald-500/20 bg-slate-900/95 text-white shadow-emerald-950/20",
    error: "border-rose-500/20 bg-slate-900/95 text-white shadow-rose-950/20",
    warning: "border-amber-500/20 bg-slate-900/95 text-white shadow-amber-950/20",
    info: "border-sky-500/20 bg-slate-900/95 text-white shadow-sky-950/20",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.92, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-xl ${borderMap[toast.type]}`}
    >
      <div className="mt-0.5">{iconMap[toast.type]}</div>

      <div className="flex-1 space-y-1 pr-1">
        <p className="text-xs font-semibold leading-snug tracking-tight text-slate-100">
          {toast.message}
        </p>
        {toast.description && (
          <p className="text-[11px] text-slate-400 leading-normal">
            {toast.description}
          </p>
        )}

        {toast.action && (
          <div className="pt-1.5">
            <button
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
              className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        title="Dismiss"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}
