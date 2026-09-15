"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";

export interface CurrencyMeta {
  symbol: string;
  name: string;
  flag: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyMeta> = {
  INR: { symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", decimals: 2 },
  USD: { symbol: "$", name: "US Dollar", flag: "🇺🇸", decimals: 2 },
  EUR: { symbol: "€", name: "Euro", flag: "🇪🇺", decimals: 2 },
  GBP: { symbol: "£", name: "British Pound", flag: "🇬🇧", decimals: 2 },
  AED: { symbol: "AED", name: "UAE Dirham", flag: "🇦🇪", decimals: 2 },
  SGD: { symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬", decimals: 2 },
};

// Default static fallback rates from 1 INR
const DEFAULT_RATES_FROM_INR: Record<string, number> = {
  INR: 1.0,
  USD: 0.0115,
  EUR: 0.0109,
  GBP: 0.0091,
  AED: 0.0423,
  SGD: 0.0154,
};

interface CurrencyContextType {
  currency: string;
  currencyMeta: CurrencyMeta;
  rates: Record<string, number>;
  ratesInINR: Record<string, number>;
  setCurrency: (code: string) => Promise<void>;
  formatCurrency: (amountInINR: number | null | undefined, overrideCurrency?: string) => string;
  convertFromINR: (amountInINR: number | null | undefined, targetCurrency?: string) => number;
  convertToINR: (amountInCurrency: number, sourceCurrency?: string) => number;
  refreshRates: () => Promise<void>;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "INR",
  currencyMeta: SUPPORTED_CURRENCIES.INR,
  rates: DEFAULT_RATES_FROM_INR,
  ratesInINR: { USD: 86.95, EUR: 91.75, GBP: 109.8, AED: 23.65, SGD: 64.9, INR: 1.0 },
  setCurrency: async () => {},
  formatCurrency: () => "",
  convertFromINR: () => 0,
  convertToINR: () => 0,
  refreshRates: async () => {},
  isLoading: false,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>("INR");
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES_FROM_INR);
  const [ratesInINR, setRatesInINR] = useState<Record<string, number>>({
    USD: 86.95, EUR: 91.75, GBP: 109.8, AED: 23.65, SGD: 64.9, INR: 1.0
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch live exchange rates from backend
  const refreshRates = useCallback(async () => {
    try {
      const res = await fetchWithAuthClient("/api/v1/forex/rates");
      if (res.ok) {
        const data = await res.json();
        if (data.rates_from_inr) {
          setRates(data.rates_from_inr);
        }
        if (data.rates_in_inr) {
          setRatesInINR(data.rates_in_inr);
        }
      }
    } catch (e) {
      console.warn("Using offline fallback forex rates:", e);
    }
  }, []);

  // Initialize preference from localStorage or backend Profile
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_advisor_currency");
      if (saved && SUPPORTED_CURRENCIES[saved]) {
        setCurrencyState(saved);
      } else {
        // Try fetching user preferred currency from profile
        fetchWithAuthClient("/api/v1/profile/currency")
          .then((r) => r.json())
          .then((d) => {
            if (d.currency && SUPPORTED_CURRENCIES[d.currency]) {
              setCurrencyState(d.currency);
              localStorage.setItem("ai_advisor_currency", d.currency);
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }

    refreshRates();
  }, [refreshRates]);

  const setCurrency = async (code: string) => {
    const valid = SUPPORTED_CURRENCIES[code] ? code : "INR";
    setCurrencyState(valid);
    try {
      localStorage.setItem("ai_advisor_currency", valid);
      await fetchWithAuthClient("/api/v1/profile/currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: valid }),
      });
    } catch (e) {
      console.warn("Could not persist currency preference:", e);
    }
  };

  const convertFromINR = useCallback(
    (amountInINR: number | null | undefined, targetCurrency?: string): number => {
      if (amountInINR === null || amountInINR === undefined || isNaN(amountInINR)) return 0;
      const tc = targetCurrency || currency;
      if (tc === "INR") return amountInINR;
      const rate = rates[tc] || DEFAULT_RATES_FROM_INR[tc] || 1.0;
      return amountInINR * rate;
    },
    [currency, rates]
  );

  const convertToINR = useCallback(
    (amountInCurrency: number, sourceCurrency?: string): number => {
      const sc = sourceCurrency || currency;
      if (sc === "INR") return amountInCurrency;
      const rate = rates[sc] || DEFAULT_RATES_FROM_INR[sc] || 1.0;
      return rate > 0 ? amountInCurrency / rate : amountInCurrency;
    },
    [currency, rates]
  );

  const formatCurrency = useCallback(
    (amountInINR: number | null | undefined, overrideCurrency?: string): string => {
      if (amountInINR === null || amountInINR === undefined || isNaN(amountInINR)) return "₹0.00";
      const targetCode = overrideCurrency || currency;
      const meta = SUPPORTED_CURRENCIES[targetCode] || SUPPORTED_CURRENCIES.INR;
      const convertedVal = convertFromINR(amountInINR, targetCode);

      if (targetCode === "INR") {
        return `₹${convertedVal.toLocaleString("en-IN", {
          minimumFractionDigits: meta.decimals,
          maximumFractionDigits: meta.decimals,
        })}`;
      }

      return `${meta.symbol}${convertedVal.toLocaleString("en-US", {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      })}`;
    },
    [currency, convertFromINR]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyMeta: SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.INR,
        rates,
        ratesInINR,
        setCurrency,
        formatCurrency,
        convertFromINR,
        convertToINR,
        refreshRates,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
