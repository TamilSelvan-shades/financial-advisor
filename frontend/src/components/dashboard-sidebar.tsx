"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  WalletCards,
  MessageSquare,
  TrendingUp,
  Target,
  Receipt,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sparkles,
  Calendar,
  BarChart3,
  Clock,
  CreditCard,
  Sliders,
  PlusCircle,
  FileSpreadsheet,
  Search,
  Eye,
  EyeOff,
  Calculator,
  FileText,
  X,
  User,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { usePrivacy } from "@/context/privacy-context";
import { useCurrency } from "@/context/currency-context";
import { fetchWithAuthClient } from "@/lib/api-client";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabParam = searchParams.get("tab") || "monthly";
  const { isPrivate, togglePrivacy } = usePrivacy();
  const { currency, currencyMeta } = useCurrency();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Auto-expand Expenses sub-menu if currently on /expenses
  const isExpensesRoute = pathname === "/expenses";
  const [expensesExpanded, setExpensesExpanded] = useState(isExpensesRoute);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (isExpensesRoute) {
      setExpensesExpanded(true);
    }
  }, [isExpensesRoute]);

  useEffect(() => {
    const handleToggle = () => setIsMobileOpen((prev) => !prev);
    const handleClose = () => setIsMobileOpen(false);

    window.addEventListener("toggleMobileSidebar", handleToggle);
    window.addEventListener("closeMobileSidebar", handleClose);

    // Auto-close when screen becomes md or larger
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener("toggleMobileSidebar", handleToggle);
      window.removeEventListener("closeMobileSidebar", handleClose);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetchWithAuthClient("/api/v1/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUserEmail(data.email);
        }
      } catch (err) {
        console.error("Failed to fetch user profile", err);
      }
    };
    fetchUser();
  }, []);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tax", label: "Tax Optimization", icon: Calculator },
    { href: "/reports", label: "Executive Briefing", icon: FileText },
    { href: "/loans", label: "Loans", icon: Landmark },
    {
      href: "/expenses",
      label: "Expenses & Ledger",
      icon: WalletCards,
      isExpandable: true,
      subItems: [
        { href: "/expenses?tab=monthly", tabId: "monthly", label: "Monthly Overview", icon: Calendar },
        { href: "/expenses?tab=annual", tabId: "annual", label: "Annual Trends", icon: BarChart3 },
        { href: "/expenses?tab=custom", tabId: "custom", label: "Custom Range", icon: Clock },
        { href: "/expenses?tab=accounts", tabId: "accounts", label: "Accounts & Balances", icon: CreditCard },
        { href: "/expenses?tab=budgets", tabId: "budgets", label: "Category Budgets", icon: Sliders },
        { href: "/expenses?tab=log", tabId: "log", label: "Log Transaction", icon: PlusCircle },
        { href: "/expenses?tab=import", tabId: "import", label: "Statement Ingestion", icon: FileSpreadsheet },
      ],
    },
    { href: "/chat", label: "AI Advisor Chat", icon: MessageSquare },
    { href: "/investments", label: "Investments", icon: TrendingUp },
    { href: "/goals", label: "Financial Goals", icon: Target },
    { href: "/bills", label: "Bills & Recurring", icon: Receipt },
    { href: "/credit", label: "Credit Health", icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-5 flex flex-col border-r border-slate-800/80 shrink-0 transform transition-transform duration-300 md:relative md:w-68 md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Brand Header */}
        <div className="mb-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Sparkles className="text-white h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                AI Advisor
              </div>
              <div className="text-[10px] uppercase font-semibold tracking-wider text-indigo-400">
                Enterprise Financials
              </div>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button 
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/50"
            onClick={() => setIsMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

      {/* Quick Search & Command Palette Pill */}
      <button
        onClick={() => {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true })
          );
        }}
        className="mb-4 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800/90 text-slate-400 hover:text-white hover:border-slate-700 transition-all text-xs group"
        title="Open Command Palette (Ctrl+K / Cmd+K)"
      >
        <span className="flex items-center gap-2">
          <Search size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
          <span>Quick Actions...</span>
        </span>
        <kbd className="text-[10px] font-semibold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">
          ⌘K
        </kbd>
      </button>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm font-medium">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isMainActive = pathname === item.href;

          if (item.isExpandable) {
            return (
              <div key={item.href} className="space-y-1">
                <div
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer select-none ${
                    isMainActive
                      ? "bg-indigo-600/20 text-white font-semibold border border-indigo-500/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                  onClick={() => setExpensesExpanded((prev) => !prev)}
                >
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 flex-1"
                    onClick={(e) => {
                      if (!isExpensesRoute) {
                        setExpensesExpanded(true);
                      }
                      if (window.innerWidth < 768) {
                        setIsMobileOpen(false);
                      }
                    }}
                  >
                    <Icon size={18} className={isMainActive ? "text-indigo-400" : "text-slate-400"} />
                    <span>{item.label}</span>
                  </Link>

                  {expensesExpanded ? (
                    <ChevronDown size={15} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight size={15} className="text-slate-400 shrink-0" />
                  )}
                </div>

                {/* Sub-menu items for Expenses */}
                {expensesExpanded && (
                  <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-800 ml-5">
                    {item.subItems?.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = pathname === "/expenses" && activeTabParam === sub.tabId;

                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => {
                            if (window.innerWidth < 768) {
                              setIsMobileOpen(false);
                            }
                          }}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                            isSubActive
                              ? "bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                          }`}
                        >
                          <SubIcon size={13} className={isSubActive ? "text-white" : "text-slate-400"} />
                          <span>{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileOpen(false);
                }
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isMainActive
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Icon size={18} className={isMainActive ? "text-white" : "text-slate-400"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer User, Privacy Mode & Logout */}
      <div className="mt-auto pt-3 border-t border-slate-800/80 space-y-1.5">
        {/* Active Currency Display */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span>{currencyMeta.flag}</span>
            <span>Ledger Display:</span>
          </span>
          <span className="font-bold text-indigo-300 font-mono">{currency} ({currencyMeta.symbol})</span>
        </div>

        {/* Privacy Mode Toggle */}
        <button
          onClick={togglePrivacy}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            isPrivate
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
          }`}
          title="Toggle Privacy Mode (Alt+P to blur/reveal balances)"
        >
          <div className="flex items-center gap-2.5">
            {isPrivate ? <EyeOff size={15} className="text-amber-400" /> : <Eye size={15} />}
            <span>Privacy Mode</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-mono opacity-80 bg-slate-900 px-1.5 py-0.5 rounded">
            {isPrivate ? "Active" : "Off"}
          </span>
        </button>

        {/* User Profile Info */}
        {userEmail && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-800/80">
            <div className="h-7 w-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <User size={14} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Logged in as</span>
              <span className="text-xs font-medium text-slate-200 truncate">{userEmail}</span>
            </div>
          </div>
        )}

        {/* Sign Out */}
        <form
          action={async () => {
            await logout();
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
      </aside>
    </>
  );
}
