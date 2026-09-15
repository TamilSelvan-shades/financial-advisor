import { fetchWithAuth } from "@/lib/api-server";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Dashboard Overview | AI Financial Advisor",
  description: "Enterprise multi-account financial dashboard with dynamic KPI tracking and AI advisor.",
};

async function getDashboardData() {
  try {
    const res = await fetchWithAuth("/api/v1/dashboard", {
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Dashboard fetch returned non-ok status:", res.status);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return null;
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardClient data={data} />;
}
