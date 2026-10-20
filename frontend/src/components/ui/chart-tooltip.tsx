"use client";

import React from "react";

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    fill?: string;
    dataKey?: string;
  }>;
  label?: string | number;
  formatter?: (val: number) => string;
  title?: string;
}

export function CustomChartTooltip({
  active,
  payload,
  label,
  formatter = (v) => v.toLocaleString(),
  title,
}: CustomChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-md">
      {(title || label) && (
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {title || label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const color = entry.color || entry.fill || "#3b82f6";
          const val =
            typeof entry.value === "number"
              ? formatter(entry.value)
              : entry.value;

          return (
            <div key={`item-${idx}`} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
                />
                {entry.name || entry.dataKey}
              </span>
              <span className="font-bold text-white tracking-tight">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
    color: "#f8fafc",
    fontSize: "12px",
    padding: "10px 14px",
  },
  itemStyle: {
    color: "#f1f5f9",
    fontSize: "12px",
    padding: "2px 0",
  },
  labelStyle: {
    color: "#94a3b8",
    fontWeight: 600,
    fontSize: "11px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "4px",
  },
};
