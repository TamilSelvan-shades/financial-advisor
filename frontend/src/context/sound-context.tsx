"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  playClick: () => void;
  playSuccess: () => void;
  playSettle: () => void;
  playCelebration: () => void;
}

const SoundContext = createContext<SoundContextType>({
  soundEnabled: true,
  toggleSound: () => {},
  playClick: () => {},
  playSuccess: () => {},
  playSettle: () => {},
  playCelebration: () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai_advisor_sound_enabled");
      if (stored !== null) {
        setSoundEnabled(stored === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ai_advisor_sound_enabled", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // 1. Subtle, crisp micro-click (like Linear / Raycast)
  const playClick = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // AudioContext policy
    }
  }, [soundEnabled, getAudioContext]);

  // 2. Soft success chime (positive two-tone feedback)
  const playSuccess = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [
        { freq: 523.25, time: now, duration: 0.12 }, // C5
        { freq: 659.25, time: now + 0.08, duration: 0.2 }, // E5
      ].forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + duration);
      });
    } catch {
      // AudioContext policy
    }
  }, [soundEnabled, getAudioContext]);

  // 3. Settle / Ledger recording confirmation (satisfying mechanical cash sound)
  const playSettle = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [
        { freq: 440, time: now, duration: 0.08 },
        { freq: 554.37, time: now + 0.06, duration: 0.1 },
        { freq: 659.25, time: now + 0.12, duration: 0.25 },
      ].forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + duration);
      });
    } catch {
      // AudioContext policy
    }
  }, [soundEnabled, getAudioContext]);

  // 4. Milestone celebration arpeggio
  const playCelebration = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const time = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.35);
      });
    } catch {
      // AudioContext policy
    }
  }, [soundEnabled, getAudioContext]);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        playClick,
        playSuccess,
        playSettle,
        playCelebration,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundFX() {
  return useContext(SoundContext);
}
