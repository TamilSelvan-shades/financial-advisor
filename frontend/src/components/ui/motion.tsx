"use client";

import {
  motion,
  useInView,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ─────────────────────────────────────────────
   1. FadeIn — Scroll-triggered or mount-triggered
   ───────────────────────────────────────────── */
interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  once?: boolean;
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  direction = "up",
  distance = 20,
  once = true,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-40px" });

  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, ...directionMap[direction] }
      }
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   2. StaggerGrid — Children animate in sequence
   ───────────────────────────────────────────── */
interface StaggerGridProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
}

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};

export function StaggerGrid({
  children,
  className,
  once = true,
}: StaggerGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-20px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   3. CountUp — Animated number counter
   ───────────────────────────────────────────── */
interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (n: number) => string;
}

export function CountUp({
  value,
  duration = 1.2,
  className,
  formatter,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  const springVal = useSpring(0, {
    stiffness: 60,
    damping: 20,
    duration: duration * 1000,
  });

  const display = useTransform(springVal, (latest) => {
    if (formatter) return formatter(Math.round(latest));
    return Math.round(latest).toLocaleString();
  });

  useEffect(() => {
    if (isInView) {
      springVal.set(value);
    }
  }, [isInView, value, springVal]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
}

/* ─────────────────────────────────────────────
   4. ScaleIn — Pop-in on mount
   ───────────────────────────────────────────── */
export function ScaleIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   5. GlowCard — Card with animated border glow
   ───────────────────────────────────────────── */
export function GlowCard({
  children,
  className = "",
  hoverColor = "rgba(16, 185, 129, 0.15)",
}: {
  children: ReactNode;
  className?: string;
  hoverColor?: string;
}) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl ${className}`}
      whileHover={{
        scale: 1.015,
        boxShadow: `0 8px 30px ${hoverColor}, 0 0 0 1px ${hoverColor}`,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   6. PulseRing — Animated status indicator
   ───────────────────────────────────────────── */
export function PulseRing({
  color = "#10b981",
  size = 8,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color, opacity: 0.4 }}
        animate={{ scale: [1, 2.2, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="relative inline-flex h-full w-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/* ─────────────────────────────────────────────
   7. ShimmerSkeleton — Loading placeholder
   ───────────────────────────────────────────── */
export function ShimmerSkeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <motion.div
      className={`rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 ${className}`}
      style={{ width, height, backgroundSize: "200% 100%" }}
      animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
    />
  );
}

/* ─────────────────────────────────────────────
   8. AnimatedGradientBorder — Rotating gradient
   ───────────────────────────────────────────── */
export function AnimatedGradientBorder({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative rounded-xl p-[1px] ${className}`}>
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{
          background:
            "conic-gradient(from 0deg, #10b981, #3b82f6, #8b5cf6, #f43f5e, #f59e0b, #10b981)",
          opacity: 0.3,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative rounded-xl bg-white dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   9. SpotlightCard — Cursor-following radial light
   ───────────────────────────────────────────── */
export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(16, 185, 129, 0.12)",
}: {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-shadow duration-300 hover:shadow-md ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isFocused ? 1 : 0,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
