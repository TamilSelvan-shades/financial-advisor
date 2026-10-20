import confetti from "canvas-confetti";

export function triggerMilestoneCelebration() {
  if (typeof window === "undefined") return;

  const count = 180;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
    colors: ["#10b981", "#14b8a6", "#f59e0b", "#6366f1", "#fbbf24", "#e0e7ff"],
    disableForReducedMotion: true,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // Realistic multi-stage burst
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });

  fire(0.2, {
    spread: 60,
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}

export function triggerSubtleBurst(x = 0.5, y = 0.5) {
  if (typeof window === "undefined") return;

  confetti({
    particleCount: 40,
    angle: 90,
    spread: 55,
    origin: { x, y },
    colors: ["#10b981", "#3b82f6", "#14b8a6"],
    zIndex: 9999,
    scalar: 0.8,
    disableForReducedMotion: true,
  });
}
