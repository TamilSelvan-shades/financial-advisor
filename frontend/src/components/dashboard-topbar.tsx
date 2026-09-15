"use client";

import React from "react";
import { Search, Eye, EyeOff, Sparkles, Activity } from "lucide-react";
import CurrencySelector from "@/components/currency-selector";
import NotificationBell from "@/components/notification-bell";
import { usePrivacy } from "@/context/privacy-context";

export default function DashboardTopBar() {
  const { isPrivate, togglePrivacy } = usePrivacy();

  const handleOpenCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true })
    );
  };

  return (
    <header className="relative z-40 flex items-center justify-between gap-3 mb-6 shrink-0 py-1.5 px-3 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-xs">
      {/* Left: Brand Status Pill */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Cloud Ledger:</span>
          <span className="text-emerald-700 font-bold">Active</span>
        </div>
      </div>

      {/* Right: Quick Action Controls Cluster */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Quick Search / Command Palette Pill */}
        <button
          onClick={handleOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all text-xs font-medium cursor-pointer"
          title="Open Command Palette (Ctrl+K / Cmd+K)"
        >
          <Search size={13} className="text-slate-500" />
          <span className="hidden md:inline text-[11px]">Command Palette</span>
          <kbd className="hidden sm:inline-block text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* In-App Notification Center */}
        <NotificationBell />

        {/* Privacy Toggle Pill */}
        <button
          onClick={togglePrivacy}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            isPrivate
              ? "bg-amber-500/10 text-amber-700 border-amber-300 shadow-2xs"
              : "bg-slate-100/90 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 border-slate-200"
          }`}
          title="Toggle Privacy Mode (Alt+P to mask balances)"
        >
          {isPrivate ? <EyeOff size={13} className="text-amber-600" /> : <Eye size={13} />}
          <span className="hidden sm:inline text-[11px]">{isPrivate ? "Private" : "Mask"}</span>
        </button>

        {/* Currency Selector */}
        <CurrencySelector />
      </div>
    </header>
  );
}
