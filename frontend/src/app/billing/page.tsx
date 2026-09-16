"use client";

import { useState } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

// Extend window to include Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Load Razorpay script
      const scriptLoaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load. Are you online?");
      }

      // 2. Create customer
      const custRes = await fetchWithAuthClient("/api/v1/billing/customer", {
        method: "POST",
      });
      if (custRes.status === 401) {
        document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        router.push("/login");
        return;
      }
      if (!custRes.ok) throw new Error("Failed to create customer profile");

      // 3. Create subscription
      const subRes = await fetchWithAuthClient("/api/v1/billing/subscription", {
        method: "POST",
      });
      if (subRes.status === 401) {
        document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        router.push("/login");
        return;
      }
      if (!subRes.ok) throw new Error("Failed to create subscription");
      
      const subData = await subRes.json();
      
      if (subData.status === "active") {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // 4. Open Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
        subscription_id: subData.razorpay_subscription_id,
        name: "AI Advisor Pro",
        description: "Monthly Pro Subscription",
        image: "https://your-logo-url.png",
        handler: async function (response: any) {
          // Force backend to sync the latest status from Razorpay
          try {
             await fetchWithAuthClient("/api/v1/billing/subscription/status");
          } catch(e) {
             console.error("Failed to sync status", e);
          }
          router.push("/dashboard");
          router.refresh(); // Refresh the server components
        },
        theme: {
          color: "#0f172a", // slate-900
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setError(response.error.description);
      });
      rzp.open();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const loadScript = (src: string) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Upgrade to AI Advisor Pro
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          You need an active subscription to access the dashboard.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          <div className="mb-6 text-center">
            <div className="text-5xl font-extrabold text-slate-900 mb-2">
              ₹{process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE || "999"}
            </div>
            <div className="text-slate-500 font-medium">per month</div>
          </div>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-center">
              <svg className="h-5 w-5 text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Unlimited AI Chat
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Advanced Loan tracking
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Smart Investment Insights
            </li>
          </ul>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
          >
            {loading ? "Processing..." : "Subscribe with Razorpay"}
          </button>
          
          <div className="mt-4 text-center">
             <button onClick={() => {
                // simple logout and go back to login
                document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                router.push('/login');
             }} className="text-sm text-slate-500 hover:text-slate-700">
               Sign in with a different account
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
