"use client";

import React, { useState, useRef, useEffect } from "react";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/context/currency-context";
import { ChevronDown, Globe, RefreshCw } from "lucide-react";

export default function CurrencySelector({ className = "" }: { className?: string }) {
  const { currency, currencyMeta, ratesInINR, setCurrency, refreshRates } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    await refreshRates();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 text-white border border-slate-700/80 shadow-sm transition-all text-xs font-semibold group cursor-pointer"
        title="Switch display currency"
      >
        <span className="text-base leading-none">{currencyMeta.flag}</span>
        <span className="font-bold text-slate-100">{currency}</span>
        <span className="text-indigo-400 font-mono text-[11px]">({currencyMeta.symbol})</span>
        <ChevronDown
          size={13}
          className={`text-slate-400 group-hover:text-white transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="fixed top-20 right-4 sm:absolute sm:top-auto sm:right-0 sm:mt-2 w-[calc(100vw-2rem)] sm:w-64 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Globe size={13} className="text-indigo-400" />
              <span>Display Currency</span>
            </span>
            <button
              onClick={handleRefresh}
              className="p-1 hover:text-white transition-colors rounded hover:bg-slate-800"
              title="Refresh live Forex rates"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin text-indigo-400" : ""} />
            </button>
          </div>

          <div className="space-y-1">
            {Object.entries(SUPPORTED_CURRENCIES).map(([code, meta]) => {
              const isSelected = currency === code;
              const rateVal = ratesInINR[code];

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setCurrency(code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{meta.flag}</span>
                    <div className="text-left">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{code}</span>
                        <span className={`text-[10px] ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                          ({meta.symbol})
                        </span>
                      </div>
                      <div className={`text-[10px] truncate max-w-[110px] ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
                        {meta.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {code === "INR" ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-400 border border-slate-800">
                        Base
                      </span>
                    ) : (
                      <span className={`text-[10px] font-mono ${isSelected ? "text-indigo-100" : "text-emerald-400"}`}>
                        {rateVal ? `1 ${code} ≈ ₹${rateVal}` : "Live"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800/80 px-2.5 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Rates: Real-time sync</span>
            <span className="text-emerald-400">● Online</span>
          </div>
        </div>
      )}
    </div>
  );
}
