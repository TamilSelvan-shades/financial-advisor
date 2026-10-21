"use client";

import { useUpgradeModal } from "@/context/upgrade-modal-context";
import { Crown } from "lucide-react";

export default function ProUpgradeButton({
  className,
  label = "Upgrade to Pro",
}: {
  className?: string;
  label?: string;
}) {
  const { openUpgradeModal, userUsage } = useUpgradeModal();

  if (userUsage?.is_pro) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
        ⭐ Pro Active
      </span>
    );
  }

  return (
    <button
      onClick={() => openUpgradeModal({ reason: "button_click" })}
      className={
        className ||
        "inline-flex items-center gap-2 rounded-lg bg-[#41e296] px-4 py-2 text-xs font-bold text-[#122b22] shadow transition-all hover:bg-emerald-300"
      }
    >
      <Crown size={14} className="fill-[#122b22]" />
      <span>{label}</span>
    </button>
  );
}
