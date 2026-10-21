"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";

export interface UserUsageData {
  status: string;
  plan_name: string;
  is_pro: boolean;
  ai_credits_used: number;
  ai_credits_limit: number;
  statement_imports_used: number;
  statement_imports_limit: number;
  email?: string;
}

interface UpgradeModalOptions {
  reason?: string;
  defaultPlan?: "plus" | "pro";
  billingCycle?: "monthly" | "annual";
}

interface UpgradeModalContextType {
  isOpen: boolean;
  upgradeReason: string | null;
  selectedPlan: "plus" | "pro";
  billingCycle: "monthly" | "annual";
  userUsage: UserUsageData | null;
  isLoading: boolean;
  openUpgradeModal: (options?: UpgradeModalOptions) => void;
  closeUpgradeModal: () => void;
  setSelectedPlan: (plan: "plus" | "pro") => void;
  setBillingCycle: (cycle: "monthly" | "annual") => void;
  refreshUsage: () => Promise<void>;
  markProActive: (planName?: string) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(undefined);

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"plus" | "pro">("pro");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [userUsage, setUserUsage] = useState<UserUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetchWithAuthClient("/api/v1/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUserUsage({
          status: data.subscription_status || "free",
          plan_name: data.plan_name || (data.subscription_status === "active" ? "pro" : "free"),
          is_pro: Boolean(data.is_pro || data.subscription_status === "active"),
          ai_credits_used: data.ai_credits_used ?? 0,
          ai_credits_limit: data.ai_credits_limit ?? 5,
          statement_imports_used: data.statement_imports_used ?? 0,
          statement_imports_limit: data.statement_imports_limit ?? 1,
          email: data.email,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch user usage details", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<UpgradeModalOptions>;
      if (customEvent.detail) {
        if (customEvent.detail.reason) setUpgradeReason(customEvent.detail.reason);
        if (customEvent.detail.defaultPlan) setSelectedPlan(customEvent.detail.defaultPlan);
        if (customEvent.detail.billingCycle) setBillingCycle(customEvent.detail.billingCycle);
      }
      setIsOpen(true);
    };

    const handleSubUpdated = () => {
      fetchUsage();
    };

    window.addEventListener("open-upgrade-modal", handleCustomEvent);
    window.addEventListener("subscription-updated", handleSubUpdated);

    return () => {
      window.removeEventListener("open-upgrade-modal", handleCustomEvent);
      window.removeEventListener("subscription-updated", handleSubUpdated);
    };
  }, [fetchUsage]);

  const openUpgradeModal = useCallback((options?: UpgradeModalOptions) => {
    if (options?.reason) setUpgradeReason(options.reason);
    if (options?.defaultPlan) setSelectedPlan(options.defaultPlan);
    if (options?.billingCycle) setBillingCycle(options.billingCycle);
    setIsOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsOpen(false);
    setUpgradeReason(null);
  }, []);

  const markProActive = useCallback((planName = "pro") => {
    setUserUsage((prev) =>
      prev
        ? {
            ...prev,
            status: "active",
            plan_name: planName,
            is_pro: true,
          }
        : {
            status: "active",
            plan_name: planName,
            is_pro: true,
            ai_credits_used: 0,
            ai_credits_limit: 5,
            statement_imports_used: 0,
            statement_imports_limit: 1,
          }
    );
    window.dispatchEvent(new CustomEvent("subscription-updated"));
  }, []);

  return (
    <UpgradeModalContext.Provider
      value={{
        isOpen,
        upgradeReason,
        selectedPlan,
        billingCycle,
        userUsage,
        isLoading,
        openUpgradeModal,
        closeUpgradeModal,
        setSelectedPlan,
        setBillingCycle,
        refreshUsage: fetchUsage,
        markProActive,
      }}
    >
      {children}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal() {
  const context = useContext(UpgradeModalContext);
  if (!context) {
    throw new Error("useUpgradeModal must be used within an UpgradeModalProvider");
  }
  return context;
}
