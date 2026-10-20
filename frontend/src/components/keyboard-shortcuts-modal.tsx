"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivacy } from "@/context/privacy-context";
import { useSoundFX } from "@/context/sound-context";
import { Command, Keyboard, X, ArrowRight, Eye, Volume2, Sparkles } from "lucide-react";

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { togglePrivacy } = usePrivacy();
  const { toggleSound, playClick } = useSoundFX();

  useEffect(() => {
    let lastKey = "";
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      const key = e.key.toLowerCase();

      // Help Modal: ?
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        playClick();
        setIsOpen((prev) => !prev);
        return;
      }

      // Close modal on Escape
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        return;
      }

      // Single-key toggles
      if (key === "p" && now - lastKeyTime > 600) {
        playClick();
        togglePrivacy();
        return;
      }

      if (key === "m" && now - lastKeyTime > 600) {
        playClick();
        toggleSound();
        return;
      }

      // Two-key navigation: "g" followed by target
      if (lastKey === "g" && now - lastKeyTime < 1000) {
        const routes: Record<string, string> = {
          d: "/dashboard",
          e: "/expenses",
          g: "/goals",
          b: "/bills",
          i: "/investments",
          l: "/loans",
          c: "/chat",
          r: "/reports",
        };

        if (routes[key]) {
          e.preventDefault();
          playClick();
          router.push(routes[key]);
          lastKey = "";
          return;
        }
      }

      lastKey = key;
      lastKeyTime = now;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, router, togglePrivacy, toggleSound, playClick]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-white shadow-2xl backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Keyboard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white">
                    Keyboard Shortcuts
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Linear-style navigation and instant controls
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content Groups */}
            <div className="py-4 space-y-4 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Navigation (Press G then...)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { keys: ["G", "D"], label: "Dashboard" },
                    { keys: ["G", "E"], label: "Expenses" },
                    { keys: ["G", "G"], label: "Goals" },
                    { keys: ["G", "B"], label: "Bills & Radar" },
                    { keys: ["G", "I"], label: "Investments" },
                    { keys: ["G", "L"], label: "Loans & Debt" },
                    { keys: ["G", "C"], label: "AI Co-Pilot" },
                    { keys: ["G", "R"], label: "Reports" },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/5"
                    >
                      <span className="text-slate-300 font-medium">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white shadow-2xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Global Toggles
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/5">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Eye size={12} className="text-emerald-400" /> Privacy Mode
                    </span>
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-mono font-bold text-white">
                      P
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/5">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Volume2 size={12} className="text-sky-400" /> Sound FX
                    </span>
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-mono font-bold text-white">
                      M
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/5">
                    <span className="text-slate-300 font-medium">Command Menu</span>
                    <div className="flex gap-1">
                      <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">
                        ⌘
                      </kbd>
                      <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">
                        K
                      </kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/5">
                    <span className="text-slate-300 font-medium">Show This Help</span>
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-mono font-bold text-white">
                      ?
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 text-center">
              <span className="text-[11px] text-slate-400">
                Tip: Press <kbd className="font-mono text-white bg-white/10 px-1 rounded">?</kbd> anywhere to toggle this cheat sheet
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
