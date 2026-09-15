"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Mic, Camera, MessageSquare, Sparkles, GripVertical } from "lucide-react";
import VoiceLedgerModal from "@/components/voice-ledger-modal";
import ReceiptScannerModal from "@/components/receipt-scanner-modal";

export default function FloatingActionDock() {
  const router = useRouter();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const dockRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Global hotkeys (V: voice, S: scan, E: log, A: chat)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Modifier key check: don't intercept Ctrl+C, Cmd+V, etc.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setVoiceOpen(true);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setScannerOpen(true);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        router.push("/expenses?tab=log");
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        router.push("/chat");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    if (dockRef.current) {
        dockRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    if (dockRef.current) {
        dockRef.current.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <>
      {/* Floating Bottom Center Dock */}
      <aside 
        ref={dockRef}
        aria-label="Quick Financial Actions Dock" 
        className="fixed bottom-6 left-1/2 z-40 flex items-center gap-1.5 p-1.5 rounded-full bg-slate-950/85 backdrop-blur-xl border border-slate-700/60 shadow-2xl shadow-indigo-950/40 text-white select-none touch-none"
        style={{ transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="pl-1 pr-0.5 cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300">
           <GripVertical size={16} />
        </div>
        {/* 1. Quick Add Expense */}
        <Link
          href="/expenses?tab=log"
          className="group relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          title="Log Expense (Press 'E')"
        >
          <Plus size={18} className="transition-transform group-hover:scale-110 text-blue-400" />
          <span className="sr-only">Log Expense</span>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-semibold text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
            Add Expense <kbd className="text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded ml-1">E</kbd>
          </span>
        </Link>

        {/* 2. Voice Ledger */}
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          className="group relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-slate-800 transition-all text-slate-300 hover:text-white cursor-pointer"
          title="Voice Ledger (Press 'V')"
        >
          <Mic size={18} className="transition-transform group-hover:scale-110 text-emerald-400" />
          <span className="sr-only">Voice Ledger</span>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-semibold text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
            Voice Log <kbd className="text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded ml-1">V</kbd>
          </span>
        </button>

        {/* Center Divider */}
        <div className="h-5 w-px bg-slate-800 my-auto" />

        {/* 3. Receipt Scanner OCR */}
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="group relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-slate-800 transition-all text-slate-300 hover:text-white cursor-pointer"
          title="Scan Receipt OCR (Press 'S')"
        >
          <Camera size={18} className="transition-transform group-hover:scale-110 text-amber-400" />
          <span className="sr-only">Scan Receipt</span>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-semibold text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
            Scan Receipt <kbd className="text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded ml-1">S</kbd>
          </span>
        </button>

        {/* 4. AI Financial Advisor */}
        <Link
          href="/chat"
          className="group relative flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 transition-all text-white shadow-md shadow-indigo-600/30"
          title="AI Advisor Chat (Press 'A')"
        >
          <MessageSquare size={17} className="transition-transform group-hover:scale-110" />
          <span className="sr-only">AI Advisor Chat</span>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-semibold text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
            AI Advisor <kbd className="text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded ml-1">A</kbd>
          </span>
        </Link>
      </aside>

      {/* Voice Ledger Modal Instance */}
      {voiceOpen && (
        <VoiceLedgerModal
          isOpen={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          onSuccess={() => {
            setVoiceOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Receipt Scanner Modal Instance */}
      {scannerOpen && (
        <ReceiptScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onSuccess={() => {
            setScannerOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
