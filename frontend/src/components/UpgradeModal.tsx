"use client";

import React, { useState } from "react";
import { useUpgradeModal } from "@/context/upgrade-modal-context";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useToast } from "@/context/toast-context";
import {
  Check,
  Crown,
  Sparkles,
  Zap,
  X,
  ShieldCheck,
  Bot,
  FileSpreadsheet,
  Lock,
  ArrowRight,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function UpgradeModal() {
  const {
    isOpen,
    closeUpgradeModal,
    upgradeReason,
    selectedPlan,
    setSelectedPlan,
    billingCycle,
    setBillingCycle,
    markProActive,
  } = useUpgradeModal();

  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Ensure Razorpay SDK is loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load. Please verify your internet connection.");
      }

      // 2. Initialize customer in backend
      const custRes = await fetchWithAuthClient("/api/v1/billing/customer", {
        method: "POST",
      });
      if (custRes.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!custRes.ok) {
        const custErr = await custRes.json().catch(() => ({}));
        throw new Error(custErr.detail || "Failed to initialize billing profile.");
      }

      // 3. Create Subscription on backend
      const subRes = await fetchWithAuthClient(
        `/api/v1/billing/subscription?plan_name=${selectedPlan}`,
        {
          method: "POST",
        }
      );
      if (subRes.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!subRes.ok) {
        const subErr = await subRes.json().catch(() => ({}));
        throw new Error(subErr.detail || "Failed to generate subscription checkout.");
      }

      const subData = await subRes.json();

      // If user already active in Razorpay
      if (subData.status === "active") {
        markProActive(selectedPlan);
        closeUpgradeModal();
        showToast({
          type: "success",
          message: "Subscription Active",
          description: "Your account already has an active Pro subscription!",
        });
        return;
      }

      // 4. Open Razorpay Checkout Modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TZU7ehVAbeDoEV",
        subscription_id: subData.razorpay_subscription_id,
        name: "Ledgerly Intelligence",
        description:
          selectedPlan === "pro"
            ? "AI Advisor Pro (Founding Member Access)"
            : "Ledgerly Plus Subscription",
        handler: async function (response: any) {
          try {
            // 5. Direct verification with backend
            const verifyRes = await fetchWithAuthClient("/api/v1/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                plan_name: selectedPlan,
              }),
            });

            if (!verifyRes.ok) {
              const verifyErr = await verifyRes.json().catch(() => ({}));
              console.warn("Verify check notification:", verifyErr);
            }

            // Instantly activate Pro in UI state
            markProActive(selectedPlan);
            closeUpgradeModal();

            showToast({
              type: "success",
              message: "🎉 Welcome to Pro!",
              description: `Successfully upgraded to ${
                selectedPlan === "pro" ? "AI Advisor Pro" : "Ledgerly Plus"
              }. All restrictions lifted!`,
            });
          } catch (e: any) {
            console.error("Verification error:", e);
            markProActive(selectedPlan);
            closeUpgradeModal();
          }
        },
        prefill: {
          name: "Ledgerly Member",
        },
        theme: {
          color: "#15332f",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (failResp: any) {
        setError(failResp.error?.description || "Payment failed or cancelled by user.");
      });
      rzp.open();
    } catch (err: any) {
      setError(err.message || "Something went wrong initiating checkout.");
    } finally {
      setLoading(false);
    }
  };

  const isPro = selectedPlan === "pro";
  const isAnnual = billingCycle === "annual";

  // Price calculations
  const plusPrice = isAnnual ? "159" : "199";
  const proPrice = isAnnual ? "399" : "499";
  const proOriginalPrice = isAnnual ? "799" : "999";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#122b22] text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
      >
        {/* Background ambient decorative glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#41e296]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#41e296] text-[#122b22]">
              <Crown size={15} className="fill-[#122b22]" />
            </span>
            <div>
              <h2 id="upgrade-title" className="text-base font-bold tracking-tight text-white">
                Unlock Full Financial Intelligence
              </h2>
              <p className="text-xs text-emerald-100/60">
                Tenant-isolated • Cancel anytime • 100% money-back guarantee
              </p>
            </div>
          </div>
          <button
            onClick={closeUpgradeModal}
            className="rounded-lg p-1.5 text-emerald-100/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {/* Paywall Context Banner if user hit limit */}
          {upgradeReason && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs text-amber-200">
              <Zap size={16} className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <span className="font-semibold text-amber-100">Free Tier Limit Reached: </span>
                {upgradeReason.replace("FREE_LIMIT_REACHED:", "")}
              </div>
            </div>
          )}

          {/* Billing Interval Toggle */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-4 py-1.5 font-semibold transition-all ${
                  !isAnnual
                    ? "bg-[#41e296] text-[#122b22] shadow"
                    : "text-emerald-50/70 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold transition-all ${
                  isAnnual
                    ? "bg-[#41e296] text-[#122b22] shadow"
                    : "text-emerald-50/70 hover:text-white"
                }`}
              >
                <span>Annual</span>
                <span className="rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-[#41e296]">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Plan Comparison Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Tier 1: Ledgerly Plus */}
            <div
              onClick={() => setSelectedPlan("plus")}
              className={`cursor-pointer rounded-xl border p-5 transition-all ${
                selectedPlan === "plus"
                  ? "border-[#41e296] bg-white/[0.07] ring-1 ring-[#41e296]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-100">Ledgerly Plus</span>
                {selectedPlan === "plus" && (
                  <span className="rounded-full bg-[#41e296]/20 px-2 py-0.5 text-[10px] font-bold text-[#41e296]">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-emerald-50/60">
                For everyday fast transaction tracking
              </p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">₹{plusPrice}</span>
                <span className="text-xs text-emerald-50/60">/ month</span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-50/40">
                {isAnnual ? "Billed annually (₹1,908/yr)" : "Billed monthly"}
              </p>

              <ul className="mt-5 space-y-2.5 text-xs text-emerald-50/80">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Unlimited Fast Capture (Telegram & Voice)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Unlimited Bank Statement Ingestion (PDF/CSV)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Multi-account liquid balance tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Automated daily WhatsApp/Telegram reminders</span>
                </li>
              </ul>
            </div>

            {/* Tier 2: AI Advisor Pro (Founding Member) */}
            <div
              onClick={() => setSelectedPlan("pro")}
              className={`relative cursor-pointer rounded-xl border p-5 transition-all ${
                selectedPlan === "pro"
                  ? "border-[#41e296] bg-white/[0.09] ring-2 ring-[#41e296]/60 shadow-[0_0_25px_rgba(65,226,150,0.15)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              {/* Founding Member Badge */}
              <div className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-emerald-400 to-[#41e296] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#122b22] shadow">
                Founding Member 50% Off
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#41e296]" />
                  AI Advisor Pro
                </span>
                {selectedPlan === "pro" && (
                  <span className="rounded-full bg-[#41e296] px-2 py-0.5 text-[10px] font-bold text-[#122b22]">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-emerald-50/70">
                Full AI Financial Advisor & Loan Optimization
              </p>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">₹{proPrice}</span>
                <span className="text-xs text-emerald-50/60">/ month</span>
                <span className="text-xs text-emerald-50/40 line-through">
                  ₹{proOriginalPrice}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-300 font-medium">
                {isAnnual ? "Billed annually (₹4,788/yr) • Lifetime price lock" : "Founding price locked for life"}
              </p>

              <ul className="mt-5 space-y-2.5 text-xs text-emerald-50/90 font-medium">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Everything in Ledgerly Plus</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Unlimited AI Financial Advisor chat & monthly audit</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Home Loan Amortization & Prepayment Simulator</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Autonomous Idle Cash Sweep & Zombie Subscription Radar</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-[#41e296]" />
                  <span>Tax planning (Old vs New regime) & Family workspace</span>
                </li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          {/* Primary Action Button */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#41e296] px-6 text-sm font-bold text-[#122b22] shadow-[0_4px_20px_rgba(65,226,150,0.3)] transition-all hover:bg-emerald-300 hover:shadow-[0_4px_25px_rgba(65,226,150,0.45)] disabled:opacity-50"
            >
              {loading ? (
                <span>Initializing Razorpay Checkout...</span>
              ) : (
                <>
                  <span>
                    {isPro ? "Unlock AI Advisor Pro (Founding Rate)" : "Start Ledgerly Plus 7-Day Trial"}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-4 text-[11px] text-emerald-50/50">
              <span className="flex items-center gap-1">
                <ShieldCheck size={13} className="text-[#41e296]" />
                256-Bit SSL Razorpay Encryption
              </span>
              <span>•</span>
              <span>Instant UI Activation</span>
              <span>•</span>
              <span>Cancel Anytime in 1-Click</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
