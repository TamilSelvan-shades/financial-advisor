import { fetchWithAuth } from "@/lib/api-server";
import { redirect } from "next/navigation";

import CommandPalette from "@/components/command-palette";
import DashboardSidebar from "@/components/dashboard-sidebar";
import DashboardTopBar from "@/components/dashboard-topbar";
import FloatingActionDock from "@/components/floating-action-dock";
import { CurrencyProvider } from "@/context/currency-context";
import { PrivacyProvider } from "@/context/privacy-context";
import { SoundProvider } from "@/context/sound-context";
import { ToastProvider } from "@/context/toast-context";
import { Toaster } from "@/components/ui/toaster";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let shouldRedirectToBilling = false;
  let shouldRedirectToLogin = false;

  try {
    const res = await fetchWithAuth("/api/v1/auth/me", {
      next: { revalidate: 0 },
    });
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
        <SoundProvider>
          <ToastProvider>
            <CommandPalette />
            <FloatingActionDock />
            <KeyboardShortcutsModal />
            <Toaster />
            <div className="flex min-h-screen flex-col md:flex-row">
              <Suspense
                fallback={
                  <aside className="w-full shrink-0 bg-[#15332f] md:w-68" />
                }
              >
                <DashboardSidebar />
              </Suspense>

              <main className="flex min-w-0 flex-1 flex-col overflow-auto px-4 pb-24 pt-3 sm:px-5 md:px-8 md:pt-5 lg:px-10">
                <DashboardTopBar />
                <div className="page-reveal flex-1">{children}</div>
              </main>
            </div>
          </ToastProvider>
        </SoundProvider>
      </CurrencyProvider>
    </PrivacyProvider>
  );
}
