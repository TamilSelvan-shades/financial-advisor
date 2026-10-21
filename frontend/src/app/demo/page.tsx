import type { Metadata } from "next";
import DemoView from "./demo-view";

export const metadata: Metadata = {
  title: "Live Interactive Demo | Ledgerly Financial Intelligence",
  description:
    "Explore the full Ledgerly personal financial command center pre-loaded with realistic Indian salaried sample data. See loan amortization, automated fast capture, and AI advice in action.",
};

export default function DemoPage() {
  return <DemoView />;
}
