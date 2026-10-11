"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Book, SHEETS, type BookFocus } from "./Book";
import { CameraRig, Desk, Lights } from "./Desk";

const MAX_DPR = 2;
// The book reaches the reading pose before its cover starts to turn
const OPEN_DELAY_MS = 380;
// After the last cover closes, wait for it to land before the book goes back to the desk
const SETTLE_MS = 650;
// Matches the riffle stagger in Book
const STAGGER_MS = 70;
const WHEEL_LOCK_MS = 420;

export default function FlipbookPage() {
  const [open, setOpen] = useState(false);
  const [turned, setTurned] = useState(0);
  // The desk lamp (spot, gloss, vignette); L toggles it
  const [lamp, setLamp] = useState(false);
  const focus = useRef<BookFocus>({ f: 0, v: 0 });
  // Handlers read the latest view without being recreated
  const state = useRef({ open, turned });
  useLayoutEffect(() => {
    state.current = { open, turned };
  });
  const timers = useRef<number[]>([]);
  const wheelLock = useRef(0);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // Every move goes through here: a closed cover sends the book back to the desk
  const turnTo = useCallback((next: number) => {
    clearTimers();
    const t = THREE.MathUtils.clamp(next, 0, SHEETS);
    const from = state.current.turned;
    setTurned(t);
    // Closed on the front cover it goes back to the table; closed on the back it first turns
    // itself over (Book reports it through onFlipped)
    if (t === 0) later(Math.abs(t - from) * STAGGER_MS + SETTLE_MS, () => setOpen(false));
  }, []);

  const openAt = useCallback(
    (t: number) => {
      clearTimers();
      if (state.current.open) {
        turnTo(t);
        return;
      }
      setOpen(true);
      later(OPEN_DELAY_MS, () => setTurned(t));
    },
    [turnTo],
  );

  // Once the issue has turned itself over it lies closed on its front cover, back on the table
  const flipped = useCallback(() => {
    clearTimers();
    setTurned(0);
    setOpen(false);
  }, []);

  const next = useCallback(() => {
    if (state.current.turned === SHEETS) return;
    if (!state.current.open) openAt(1);
    else turnTo(state.current.turned + 1);
  }, [openAt, turnTo]);
  const prev = useCallback(() => {
    if (state.current.turned === SHEETS) return;
    if (state.current.open) turnTo(state.current.turned - 1);
  }, [turnTo]);
  const close = useCallback(() => {
    if (state.current.open) turnTo(0);
  }, [turnTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
      else if (e.key === "l" || e.key === "L") setLamp((on) => !on);
      else if (e.key === "Enter" || e.key === " ") {
        if (!state.current.open) openAt(1);
      }
    };
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 8 || performance.now() < wheelLock.current) return;
      wheelLock.current = performance.now() + WHEEL_LOCK_MS;
      if (d > 0) next();
      else prev();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      timers.current.forEach(clearTimeout);
    };
  }, [next, prev, close, openAt]);


  return (
    <main className="fixed inset-0 overflow-hidden bg-[#070605] font-sans text-[#efede8] select-none">
      <Canvas
        className="absolute inset-0"
        dpr={[1, MAX_DPR]}
        shadows="percentage"
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ fov: 30, near: 0.1, far: 60, position: [0, 8, 3] }}
      >
        <color attach="background" args={[lamp ? "#070605" : "#2a2622"]} />
        <CameraRig focus={focus} />
        <Lights focus={focus} lamp={lamp} />
        <Desk />
        <Book open={open} turned={turned} focus={focus} onOpen={() => openAt(1)} onTurnTo={turnTo} onFlipped={flipped} />
      </Canvas>

{lamp && (
        <>
      {/* Vignette: the room falls off into the dark around the lamp */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 75% 70% at 50% 52%, transparent 40%, rgba(4,3,2,0.85) 100%)" }}
      />
        </>
      )}

    </main>
  );
}
