"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  WalletCards,
  MessageSquare,
  TrendingUp,
  Target,
  Receipt,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  PlusCircle,
  FileSpreadsheet,
  Command,
  Sparkles,
  ArrowRight,
  Camera,
  Mic,
  Globe,
  Calculator,
  FileText,
  Bot,
} from "lucide-react";
import { usePrivacy } from "@/context/privacy-context";
import { useCurrency } from "@/context/currency-context";

interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: "Navigation" | "Actions";
  icon: React.ComponentType<{ className?: string; size?: number }>;
  onSelect: () => void;
  badge?: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { isPrivate, togglePrivacy } = usePrivacy();
  const { setCurrency, currency } = useCurrency();
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = [
    // Navigation
    {
      id: "nav-dashboard",
      title: "Dashboard Overview",
      description: "KPIs, net worth, cash flow stream & safe-to-spend gauge",
      category: "Navigation",
      icon: LayoutDashboard,
      onSelect: () => router.push("/dashboard"),
    },
    {
      id: "nav-tax",
      title: "Tax Optimization Studio",
      description: "Old vs. New Tax Regime simulator, Chapter VI-A deductions & break-even radar",
      category: "Navigation",
      icon: Calculator,
      badge: "FY 2024–25",
      onSelect: () => router.push("/tax"),
    },
    {
      id: "nav-reports",
      title: "Executive Financial Briefing",
      description: "Weekly cash velocity, category leak analyzer & downloadable digest report",
      category: "Navigation",
      icon: FileText,
      badge: "Weekly Digest",
      onSelect: () => router.push("/reports"),
    },
    {
      id: "nav-loans",
      title: "Loans & Debt Engine",
      description: "Amortization schedules, prepayment savings & EMI math",
      category: "Navigation",
      icon: Landmark,
      onSelect: () => router.push("/loans"),
    },
    {
      id: "nav-expenses",
      title: "Expenses & Ledger",
      description: "Transaction history, category budgets & analytics",
      category: "Navigation",
      icon: WalletCards,
      onSelect: () => router.push("/expenses"),
    },
    {
      id: "nav-chat",
      title: "AI Financial Advisor Chat",
      description: "Conversational intelligence connected to your live database",
      category: "Navigation",
      icon: MessageSquare,
      badge: "Gemini 2.5",
      onSelect: () => router.push("/chat"),
    },
    {
      id: "nav-investments",
      title: "Investments Portfolio",
      description: "Asset distribution, portfolio value & allocation breakdown",
      category: "Navigation",
      icon: TrendingUp,
      onSelect: () => router.push("/investments"),
    },
    {
      id: "nav-goals",
      title: "Financial Goals",
      description: "Savings milestones, targets & progress tracking",
      category: "Navigation",
      icon: Target,
      onSelect: () => router.push("/goals"),
    },
    {
      id: "nav-bills",
      title: "Bills & Recurring Subscriptions",
      description: "Due date alerts, payment status & calendar forecast",
      category: "Navigation",
      icon: Receipt,
      onSelect: () => router.push("/bills"),
    },
    {
      id: "nav-credit",
      title: "Credit Score & Health",
      description: "Bureau rating, score history & credit health monitor",
      category: "Navigation",
      icon: ShieldCheck,
      onSelect: () => router.push("/credit"),
    },

    // Quick Actions
    {
      id: "action-privacy",
      title: isPrivate ? "Disable Privacy Mode (Reveal Balances)" : "Enable Privacy Mode (Blur Balances)",
      description: isPrivate ? "Show full numerical amounts on all screens" : "Blur all balances for public / coffee shop privacy",
      category: "Actions",
      icon: isPrivate ? Eye : EyeOff,
      badge: "Alt + P",
      onSelect: () => togglePrivacy(),
    },
    {
      id: "action-log-expense",
      title: "Log New Transaction",
      description: "Record an income or expense manually to your ledger",
      category: "Actions",
      icon: PlusCircle,
      onSelect: () => router.push("/expenses?tab=log"),
    },
    {
      id: "action-import-statement",
      title: "Universal Multi-Bank Ingestion",
      description: "Upload and auto-categorize HDFC, SBI, Axis, Kotak, ICICI, Amex statements",
      category: "Actions",
      icon: FileSpreadsheet,
      onSelect: () => router.push("/expenses?tab=import"),
      badge: "PDF / Excel",
    },
    {
      id: "action-scan-receipt",
      title: "Scan Receipt / Bill (Camera OCR)",
      description: "Extract merchant, items, and taxes using Gemini 2.5 Flash Vision",
      category: "Actions",
      icon: Camera,
      onSelect: () => router.push("/expenses?tab=import"),
      badge: "Gemini Vision",
    },
    {
      id: "action-voice-ledger",
      title: "Voice-to-Ledger (Voice Recording)",
      description: "Speak transactions naturally using speech-to-ledger audio AI",
      category: "Actions",
      icon: Mic,
      onSelect: () => router.push("/expenses?tab=import"),
      badge: "Audio AI",
    },
    {
      id: "action-tax-compare",
      title: "Calculate Income Tax Comparison",
      description: "Simulate Old vs. New Tax Regime and check deduction break-even",
      category: "Actions",
      icon: Calculator,
      onSelect: () => router.push("/tax"),
      badge: "Tax Studio",
    },
    {
      id: "action-download-briefing",
      title: "Download Sunday Executive Briefing",
      description: "View weekly velocity, leak radar & download formatted report",
      category: "Actions",
      icon: FileText,
      onSelect: () => router.push("/reports"),
      badge: "Weekly Report",
    },
    {
      id: "action-autonomous-check",
      title: "Run Autonomous Agent Check",
      description: "Evaluate surplus auto-sweep, budget guardrails & micro-savings",
      category: "Actions",
      icon: Bot,
      onSelect: () => router.push("/dashboard"),
      badge: "Ghost Accountant",
    },
    {
      id: "currency-inr",
      title: "Switch Currency to INR (₹)",
      description: "Display all figures in Indian Rupees (Base currency)",
      category: "Actions",
      icon: Globe,
      onSelect: () => setCurrency("INR"),
      badge: currency === "INR" ? "Active" : "🇮🇳",
    },
    {
      id: "currency-usd",
      title: "Switch Currency to USD ($)",
      description: "Convert all metrics to US Dollars using real-time forex",
      category: "Actions",
      icon: Globe,
      onSelect: () => setCurrency("USD"),
      badge: currency === "USD" ? "Active" : "🇺🇸",
    },
    {
      id: "currency-eur",
      title: "Switch Currency to EUR (€)",
      description: "Convert all metrics to Euros using real-time forex",
      category: "Actions",
      icon: Globe,
      onSelect: () => setCurrency("EUR"),
      badge: currency === "EUR" ? "Active" : "🇪🇺",
    },
    {
      id: "currency-gbp",
      title: "Switch Currency to GBP (£)",
      description: "Convert all metrics to British Pounds using real-time forex",
      category: "Actions",
      icon: Globe,
      onSelect: () => setCurrency("GBP"),
      badge: currency === "GBP" ? "Active" : "🇬🇧",
    },
    {
      id: "currency-aed",
      title: "Switch Currency to AED (AED)",
      description: "Convert all metrics to UAE Dirhams using real-time forex",
      category: "Actions",
      icon: Globe,
      onSelect: () => setCurrency("AED"),
      badge: currency === "AED" ? "Active" : "🇦🇪",
    },
    {
      id: "currency-sgd",
      title: "Switch Currency to SGD (S$)",
      description: "Convert all metrics to Singapore Dollars using real-time forex",
      category: "Actions",
      icon: Globe,
      onSelect: () => setCurrency("SGD"),
      badge: currency === "SGD" ? "Active" : "🇸🇬",
    },
  ];

  // Filter based on search query
  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  // Global keyboard shortcut: Cmd + K or Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle arrow navigation & selection inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].onSelect();
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search className="text-slate-400 shrink-0" size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to page... (e.g. Loans, Privacy, Log)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-900"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No matching commands or pages found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onSelect();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors text-sm ${
                    isSelected
                      ? "bg-indigo-50/80 text-indigo-950 border border-indigo-200/60"
                      : "text-slate-700 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {item.title}
                        {item.badge && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <ArrowRight size={14} className="text-indigo-600 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span>Navigate <kbd className="font-mono bg-white px-1 rounded border border-slate-200">↑↓</kbd></span>
            <span>Select <kbd className="font-mono bg-white px-1 rounded border border-slate-200">↵</kbd></span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
            <Sparkles size={12} />
            <span>AI Advisor OS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
