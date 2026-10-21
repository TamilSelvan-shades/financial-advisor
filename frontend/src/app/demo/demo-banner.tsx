"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, ShieldAlert, ArrowLeft } from "lucide-react";

export default function DemoBanner({
  onUpgradeClick,
}: {
  onUpgradeClick?: () => void;
}) {
  return (
    <div className="sticky top-0 z-50 border-b border-emerald-400/20 bg-[#122b22]/95 px-4 py-3 text-white backdrop-blur-md shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#41e296] text-[#122b22] text-xs font-black">
            ⚡
          </span>
          <p className="text-xs sm:text-sm font-medium text-emerald-50">
            <span className="font-bold text-white">Live Sandbox Mode: </span>
            You are viewing the Ledgerly Interactive Demo with sample data. Ready to automate your own finances?
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-200/70 hover:text-white px-2 py-1.5 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Exit Demo</span>
          </Link>

          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-white/20"
          >
            <span>Create Free Account</span>
          </Link>

          <button
            onClick={onUpgradeClick}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#41e296] px-3.5 py-1.5 text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300"
          >
            <Sparkles size={13} />
            <span>Upgrade to Pro</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
