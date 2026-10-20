"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
  toast: {
    success: (message: string, options?: { description?: string; action?: ToastAction; duration?: number }) => string;
    error: (message: string, options?: { description?: string; action?: ToastAction; duration?: number }) => string;
    info: (message: string, options?: { description?: string; action?: ToastAction; duration?: number }) => string;
    warning: (message: string, options?: { description?: string; action?: ToastAction; duration?: number }) => string;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, message, description, action, duration = 4000 }: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, message, description, action, duration };

      setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep max 4 toasts stacked

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const toast = {
    success: (msg: string, opts?: { description?: string; action?: ToastAction; duration?: number }) =>
      showToast({ type: "success", message: msg, ...opts }),
    error: (msg: string, opts?: { description?: string; action?: ToastAction; duration?: number }) =>
      showToast({ type: "error", message: msg, ...opts }),
    info: (msg: string, opts?: { description?: string; action?: ToastAction; duration?: number }) =>
      showToast({ type: "info", message: msg, ...opts }),
    warning: (msg: string, opts?: { description?: string; action?: ToastAction; duration?: number }) =>
      showToast({ type: "warning", message: msg, ...opts }),
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
