"use client";

import CurrencySelector from "@/components/currency-selector";
import NotificationBell from "@/components/notification-bell";
import { usePrivacy } from "@/context/privacy-context";
import { useSoundFX } from "@/context/sound-context";
import { Eye, EyeOff, Menu, Search, Volume2, VolumeX, Keyboard } from "lucide-react";
import { usePathname } from "next/navigation";

export default function DashboardTopBar() {
  const { isPrivate, togglePrivacy } = usePrivacy();
  const { soundEnabled, toggleSound, playClick } = useSoundFX();
  const pathname = usePathname();

  const pageNames: Record<string, string> = {
    "/dashboard": "Overview",
    "/expenses": "Transactions",
    "/loans": "Loans",
    "/investments": "Investments",
    "/goals": "Goals",
    "/bills": "Bills",
    "/credit": "Credit health",
    "/tax": "Tax planner",
    "/reports": "Briefings",
    "/chat": "Advisor",
  };
  const pageName = pageNames[pathname] || "Workspace";

  const handleOpenCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true }),
    );
  };

  return (
    <header className="sticky top-3 z-40 mb-6 flex min-h-12 shrink-0 items-center justify-between gap-3 rounded-lg border border-[#15332f]/10 bg-white/88 px-3 py-2 shadow-[0_8px_30px_rgba(21,51,47,0.08)] backdrop-blur-xl sm:px-4">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => window.dispatchEvent(new Event("toggleMobileSidebar"))}
          className="-ml-1 rounded-md p-2 text-slate-500 transition-colors hover:bg-[#15332f]/5 hover:text-[#15332f] md:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm font-extrabold tracking-tight text-[#15332f]">
            {pageName}
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 sm:flex">
            <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Ledger synced
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={handleOpenCommandPalette}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-[#15332f]/20 hover:bg-[#15332f]/5 hover:text-[#15332f]"
          title="Open Command Palette (Ctrl+K / Cmd+K)"
        >
          <Search size={13} className="text-slate-500" />
          <span className="hidden text-[11px] md:inline">Search</span>
        </button>

        <NotificationBell />

        <button
          onClick={togglePrivacy}
          className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors ${
            isPrivate
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-[#15332f]/5 hover:text-[#15332f]"
          }`}
          title="Toggle Privacy Mode (Alt+P to mask balances)"
        >
          {isPrivate ? (
            <EyeOff size={13} className="text-amber-600" />
          ) : (
            <Eye size={13} />
          )}
          <span className="hidden text-[11px] sm:inline">
            {isPrivate ? "Private" : "Mask"}
          </span>
        </button>

        <button
          onClick={() => {
            playClick();
            toggleSound();
          }}
          className={`flex cursor-pointer items-center justify-center rounded-md border p-2 text-xs font-semibold transition-colors ${
            soundEnabled
              ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-[#15332f]/5 hover:text-[#15332f]"
              : "border-slate-200 bg-slate-100/80 text-slate-400 line-through"
          }`}
          title={soundEnabled ? "Mute Sound FX (Press M)" : "Unmute Sound FX (Press M)"}
        >
          {soundEnabled ? <Volume2 size={13} className="text-emerald-600" /> : <VolumeX size={13} />}
        </button>

        <button
          onClick={() => {
            playClick();
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
          }}
          className="hidden cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-500 transition-colors hover:border-[#15332f]/20 hover:bg-[#15332f]/5 hover:text-[#15332f] sm:flex"
          title="Keyboard Shortcuts (Press ?)"
        >
          <Keyboard size={13} />
        </button>

        <CurrencySelector />
      </div>
    </header>
  );
}
