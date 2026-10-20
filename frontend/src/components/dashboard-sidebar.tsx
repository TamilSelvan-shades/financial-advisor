"use client";

import { logout } from "@/app/actions/auth";
import { useCurrency } from "@/context/currency-context";
import { usePrivacy } from "@/context/privacy-context";
import { fetchWithAuthClient } from "@/lib/api-client";
import {
  BarChart3,
  Calculator,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PlusCircle,
  Receipt,
  Search,
  ShieldCheck,
  Sliders,
  Target,
  TrendingUp,
  User,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabParam = searchParams.get("tab") || "monthly";
  const { isPrivate, togglePrivacy } = usePrivacy();
  const { currency, currencyMeta } = useCurrency();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Auto-expand Expenses sub-menu if currently on /expenses
  const isExpensesRoute = pathname === "/expenses";
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const showExpensesMenu = expensesExpanded || isExpensesRoute;
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
        {
          href: "/expenses?tab=monthly",
          tabId: "monthly",
          label: "Monthly Overview",
          icon: Calendar,
        },
        {
          href: "/expenses?tab=annual",
          tabId: "annual",
          label: "Annual Trends",
          icon: BarChart3,
        },
        {
          href: "/expenses?tab=custom",
          tabId: "custom",
          label: "Custom Range",
          icon: Clock,
        },
        {
          href: "/expenses?tab=accounts",
          tabId: "accounts",
          label: "Accounts & Balances",
          icon: CreditCard,
        },
        {
          href: "/expenses?tab=budgets",
          tabId: "budgets",
          label: "Category Budgets",
          icon: Sliders,
        },
        {
          href: "/expenses?tab=log",
          tabId: "log",
          label: "Log Transaction",
          icon: PlusCircle,
        },
        {
          href: "/expenses?tab=import",
          tabId: "import",
          label: "Statement Ingestion",
          icon: FileSpreadsheet,
        },
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

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-70 shrink-0 transform flex-col border-r border-white/8 bg-gradient-to-b from-[#15332f] via-[#143330] to-[#112a27] p-4 text-white shadow-2xl shadow-black/20 transition-transform duration-300 md:relative md:w-68 md:translate-x-0 md:shadow-none ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand Header */}
        <div className="mb-5 flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-300 text-[#15332f] shadow-sm">
              <Landmark className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[17px] font-extrabold tracking-tight text-white">
                Ledgerly
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
                Private finance desk
              </div>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            className="rounded-lg p-1.5 text-emerald-100/60 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Search & Command Palette Pill */}
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                ctrlKey: true,
                metaKey: true,
              }),
            );
          }}
          className="group mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/6 px-3 py-2.5 text-xs text-emerald-50/60 transition-colors hover:border-emerald-200/30 hover:bg-white/10 hover:text-white"
          title="Open Command Palette (Ctrl+K / Cmd+K)"
        >
          <span className="flex items-center gap-2">
            <Search
              size={14}
              className="text-emerald-200/55 transition-colors group-hover:text-emerald-200"
            />
            <span>Search or take action</span>
          </span>
          <span className="text-[10px] font-semibold text-emerald-100/35">
            ⌘ K
          </span>
        </button>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1 text-[13px] font-semibold custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isMainActive = pathname === item.href;

            if (item.isExpandable) {
              return (
                <div key={item.href} className="space-y-1">
                  <div
                    className={`flex cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                      isMainActive
                        ? "bg-emerald-200 text-[#15332f] shadow-sm"
                        : "text-emerald-50/65 hover:bg-white/[0.07] hover:text-white"
                    }`}
                    onClick={() => setExpensesExpanded((prev) => !prev)}
                  >
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 flex-1"
                      onClick={() => {
                        if (!isExpensesRoute) {
                          setExpensesExpanded(true);
                        }
                        if (window.innerWidth < 768) {
                          setIsMobileOpen(false);
                        }
                      }}
                    >
                      <Icon
                        size={17}
                        className={
                          isMainActive
                            ? "text-[#19685a]"
                            : "text-emerald-200/55"
                        }
                      />
                      <span>{item.label}</span>
                    </Link>

                    {showExpensesMenu ? (
                      <ChevronDown size={15} className="shrink-0 opacity-60" />
                    ) : (
                      <ChevronRight size={15} className="shrink-0 opacity-60" />
                    )}
                  </div>

                  {/* Sub-menu items for Expenses */}
                  {showExpensesMenu && (
                    <div className="ml-5 space-y-1 border-l border-emerald-200/15 py-1 pl-4 pr-1">
                      {item.subItems?.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive =
                          pathname === "/expenses" &&
                          activeTabParam === sub.tabId;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={() => {
                              if (window.innerWidth < 768) {
                                setIsMobileOpen(false);
                              }
                            }}
                            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors ${
                              isSubActive
                                ? "bg-white/12 font-semibold text-emerald-100"
                                : "text-emerald-50/50 hover:bg-white/6 hover:text-white"
                            }`}
                          >
                            <SubIcon
                              size={13}
                              className={
                                isSubActive
                                  ? "text-emerald-200"
                                  : "text-emerald-100/45"
                              }
                            />
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                  isMainActive
                    ? "bg-emerald-200 font-bold text-[#15332f] shadow-sm shadow-emerald-300/20"
                    : "text-emerald-50/65 hover:bg-white/[0.07] hover:text-white hover:translate-x-0.5"
                }`}
                aria-current={isMainActive ? "page" : undefined}
              >
                <Icon
                  size={17}
                  className={
                    isMainActive ? "text-[#19685a]" : "text-emerald-200/55"
                  }
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer User, Privacy Mode & Logout */}
        <div className="mt-auto space-y-1.5 border-t border-white/8 pt-3">
          {/* Active Currency Display */}
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-[10px] text-emerald-50/55">
            <span className="flex items-center gap-1.5">
              <span>{currencyMeta.flag}</span>
              <span>Ledger Display:</span>
            </span>
            <span className="font-mono font-semibold text-emerald-200">
              {currency} ({currencyMeta.symbol})
            </span>
          </div>

          {/* Privacy Mode Toggle */}
          <button
            onClick={togglePrivacy}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              isPrivate
                ? "border border-amber-300/30 bg-amber-300/10 text-amber-200"
                : "border border-transparent text-emerald-50/60 hover:bg-white/[0.07] hover:text-white"
            }`}
            title="Toggle Privacy Mode (Alt+P to blur/reveal balances)"
          >
            <div className="flex items-center gap-2.5">
              {isPrivate ? (
                <EyeOff size={15} className="text-amber-400" />
              ) : (
                <Eye size={15} />
              )}
              <span>Privacy Mode</span>
            </div>
            <span className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider opacity-80">
              {isPrivate ? "Active" : "Off"}
            </span>
          </button>

          {/* User Profile Info */}
          {userEmail && (
            <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-200/10 text-emerald-200">
                <User size={14} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-50/35">
                  Signed in
                </span>
                <span className="truncate text-xs font-medium text-emerald-50/80">
                  {userEmail}
                </span>
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
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-200/75 transition-colors hover:bg-rose-300/10 hover:text-rose-100"
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
