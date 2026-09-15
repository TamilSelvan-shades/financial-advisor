import { fetchWithAuth } from "@/lib/api-server";
import ExpensesClient from "./expenses-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Income, Expenses & Accounts | AI Financial Advisor",
  description: "Enterprise multi-account liquid reserves, income tracking, expense categorization and budgets.",
};

async function getExpensesData() {
  try {
    const res = await fetchWithAuth("/api/v1/dashboard", {
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Expenses fetch returned non-ok status:", res.status);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch expenses data:", error);
    return null;
  }
}

export default async function ExpensesPage() {
  const data = await getExpensesData();
  return <ExpensesClient initialData={data} />;
}
