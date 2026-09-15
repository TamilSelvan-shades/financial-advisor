"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface PrivacyContextType {
  isPrivate: boolean;
  togglePrivacy: () => void;
  setPrivacy: (value: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivate: false,
  togglePrivacy: () => {},
  setPrivacy: () => {},
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivate, setIsPrivate] = useState<boolean>(false);

  // Initialize from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai_advisor_privacy_mode");
      if (stored !== null) {
        setIsPrivate(stored === "true");
      }
    } catch (e) {
      console.warn("Could not read privacy preference:", e);
    }
  }, []);

  const togglePrivacy = () => {
    setIsPrivate((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ai_advisor_privacy_mode", String(next));
      } catch (e) {
        console.warn("Could not save privacy preference:", e);
      }
      return next;
    });
  };

  const setPrivacy = (value: boolean) => {
    setIsPrivate(value);
    try {
      localStorage.setItem("ai_advisor_privacy_mode", String(value));
    } catch (e) {
      console.warn("Could not save privacy preference:", e);
    }
  };

  // Global keyboard shortcut: Alt + P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        togglePrivacy();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy, setPrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}

/**
 * Visual helper component that wraps financial numbers.
 * When isPrivate is true, blurs the value with a stylish frosted blur effect.
 */
export function PrivacyValue({
  value,
  className = "",
}: {
  value: React.ReactNode;
  className?: string;
}) {
  const { isPrivate } = usePrivacy();

  if (isPrivate) {
    return (
      <span
        className={`inline-block filter blur-[6px] select-none transition-all duration-300 opacity-60 hover:opacity-100 ${className}`}
        title="Privacy Mode Active (Alt+P to reveal)"
      >
        {value}
      </span>
    );
  }

  return <span className={className}>{value}</span>;
}
