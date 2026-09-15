import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-server";

import DashboardSidebar from "@/components/dashboard-sidebar";
import CommandPalette from "@/components/command-palette";
import { PrivacyProvider } from "@/context/privacy-context";
import { CurrencyProvider } from "@/context/currency-context";
import DashboardTopBar from "@/components/dashboard-topbar";
import FloatingActionDock from "@/components/floating-action-dock";
import { Suspense } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let shouldRedirectToBilling = false;
  let shouldRedirectToLogin = false;

  try {
    const res = await fetchWithAuth("/api/v1/auth/me", { next: { revalidate: 0 } });
    if (res.ok) {
      const data = await res.json();
      const status = data.subscription_status;
      if (status !== "active") {
        shouldRedirectToBilling = true;
      }
    } else if (res.status === 401) {
      shouldRedirectToLogin = true;
    }
  } catch (error) {
    console.error("Failed to fetch user subscription status:", error);
  }

  if (shouldRedirectToBilling) {
    redirect("/billing");
  } else if (shouldRedirectToLogin) {
    redirect("/login");
  }
  return (
    <PrivacyProvider>
      <CurrencyProvider>
        <CommandPalette />
        <FloatingActionDock />
        <div className="flex min-h-screen flex-col md:flex-row bg-slate-50/50">
          {/* Interactive Fintech Sidebar */}
          <Suspense fallback={<aside className="w-full md:w-68 bg-slate-950 p-5 shrink-0" />}>
            <DashboardSidebar />
          </Suspense>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-8 pb-20 overflow-auto flex flex-col min-w-0">
            {/* Elevated Top Bar with Live Sync, Command Palette, Privacy & Currency Selector */}
            <DashboardTopBar />
            <div className="flex-1">
              {children}
            </div>
          </main>
        </div>
      </CurrencyProvider>
    </PrivacyProvider>
  );
}
