"use client";

import React from "react";
import Link from "next/link";
import { Lock, ArrowRight, X, Shield, Sparkles } from "lucide-react";

interface DemoMutationModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionTitle?: string;
  actionDescription?: string;
}

export default function DemoMutationModal({
  isOpen,
  onClose,
  actionTitle = "Connect Your Real Financial Accounts",
  actionDescription = "You are currently viewing a simulated Indian tech salaried profile in read-only sandbox mode. Create your private workspace in 30 seconds to connect your live bank statements, Telegram bot, and loans.",
}: DemoMutationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#122b22] text-white shadow-2xl p-6"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1 text-emerald-100/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#41e296] text-[#122b22]">
            <Lock size={18} />
          </span>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#41e296]">
              Sandbox Mode
            </span>
            <h3 className="text-base font-bold text-white">{actionTitle}</h3>
          </div>
        </div>

        <p className="mt-3.5 text-xs leading-relaxed text-emerald-50/70">
          {actionDescription}
        </p>

        <div className="mt-5 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs text-emerald-100">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#41e296]" />
            <span>5 Free AI Fast Capture actions included</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-[#41e296]" />
            <span>Zero ad tracking & client-isolated tenancy</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            href="/register"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#41e296] px-4 text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300"
          >
            <span>Create Free Account in 30 Seconds</span>
            <ArrowRight size={14} />
          </Link>

          <Link
            href="/login"
            className="flex h-10 w-full items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            Sign In to Existing Account
          </Link>
        </div>
      </div>
    </div>
  );
}
