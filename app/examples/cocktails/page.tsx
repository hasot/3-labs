"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { startHandTracking } from "../mask-reveal/handTracker";
import { CocktailScene, type HandInput } from "./CocktailScene";
import { startFaceTracking } from "./faceTracker";
import { DRINKS } from "./drinks";

// Cap for the canvas pixel ratio: 3x screens would cost a lot for no visible gain
const MAX_DPR = 2;
// One wheel gesture or swipe moves one glass
const WHEEL_LOCK_MS = 450;
const SWIPE_PX = 45;
// Fingers curled over the palm size: the hand counts as closed below the first value and
// only opens again above the second, so a grip does not flicker
const GRIP_CLOSE = 0.62;
const GRIP_OPEN = 0.82;
// A hand out of view for this long lets go of the glass
const HAND_LOST_MS = 400;
// Closing or opening the hand reshapes the palm and drags its tracked centre sideways. While the
// fingers are moving (curl swinging by more than this within the window) the cursor and the
// wrist angle hold still, and keep holding for a moment after, so a grab or a release happens
// exactly where the hand was.
const CURL_SWING = 0.16;
const CURL_WINDOW_MS = 180;
const GESTURE_HOLD_MS = 220;
// One Euro filter for the cursor: steady when the hand is still, no lag when it moves fast
const CURSOR_MIN_CUTOFF = 1.2;
const CURSOR_BETA = 0.008;

// One Euro filter (Casiez et al.): the smoothing cutoff rises with speed
class OneEuro {
  private value: number | null = null;
  private speed = 0;
  constructor(
    private minCutoff: number,
    private beta: number,
  ) {}
  filter(v: number, dt: number) {
    if (this.value === null) {
      this.value = v;
      return v;
    }
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.speed += alpha(1) * ((v - this.value) / dt - this.speed);
    this.value += alpha(this.minCutoff + this.beta * Math.abs(this.speed)) * (v - this.value);
    return this.value;
  }
  reset() {
    this.value = null;
    this.speed = 0;
  }
}

export default function CocktailsPage() {
  // Unbounded, so the carousel never runs out: the drink is step mod DRINKS.length
  const [step, setStep] = useState(0);
  const grabbing = useRef(false);
  const [pourRequest, setPourRequest] = useState(0);
  const wheelLock = useRef(0);
  const swipeStart = useRef<number | null>(null);
  const hand = useRef<HandInput>({
    seen: false,
    x: 0,
    y: 0,
    gripping: false,
    settling: false,
    roll: 0,
    mouth: { seen: false, x: 0, y: 0 },
  });
  const cursor = useRef<HTMLDivElement>(null);

  const setGrabbing = useCallback((on: boolean) => {
    grabbing.current = on;
  }, []);
  const go = useCallback((by: number) => setStep((s) => s + by), []);

  // A click on the glass pours it again
  const pour = useCallback(() => setPourRequest((n) => n + 1), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " " || e.key === "Enter") setPourRequest((n) => n + 1);
    };
    const onWheel = (e: WheelEvent) => {
      // While a glass is held the wheel turns it instead
      if (grabbing.current) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 8 || performance.now() < wheelLock.current) return;
      wheelLock.current = performance.now() + WHEEL_LOCK_MS;
      go(d > 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [go]);

  // Webcam hand tracking starts with the page; the browser asks for the camera once.
  // Without a camera (or permission) the mouse keeps working on its own.
  useEffect(() => {
    const video = document.createElement("video");
    const target = { x: 0, y: 0, roll: 0, lastSeen: -Infinity, mouthX: 0, mouthY: 0, mouthSeen: -Infinity };
    const stops: (() => void)[] = [];
    let cancelled = false;
    const keep = (s: () => void) => {
      if (cancelled) s();
      else stops.push(s);
    };
    const curls: { t: number; curl: number }[] = [];
    let holdUntil = 0;
    startHandTracking(video, (point) => {
      if (!point) return;
      const now = performance.now();
      target.lastSeen = now;
      curls.push({ t: now, curl: point.curl });
      while (curls.length > 1 && now - curls[0].t > CURL_WINDOW_MS) curls.shift();
      const swing = Math.max(...curls.map((c) => c.curl)) - Math.min(...curls.map((c) => c.curl));
      if (swing > CURL_SWING) holdUntil = now + GESTURE_HOLD_MS;
      const h = hand.current;
      h.settling = now < holdUntil;
      if (!h.settling) {
        target.x = point.x * window.innerWidth;
        target.y = point.y * window.innerHeight;
        target.roll = point.roll;
      }
      if (h.gripping ? point.curl > GRIP_OPEN : point.curl < GRIP_CLOSE) h.gripping = !h.gripping;
    })
      .then((s) => {
        keep(s);
        // Same camera frames, a second model: where the mouth is, to drink from the glass
        return startFaceTracking(video, (mouth) => {
          if (!mouth) return;
          target.mouthX = mouth.x * window.innerWidth;
          target.mouthY = mouth.y * window.innerHeight;
          target.mouthSeen = performance.now();
        });
      })
      .then((s) => s && keep(s))
      .catch(() => {});

    // Camera frames come at ~30 Hz; the cursor glides between them every frame
    let raf = 0;
    let last = performance.now();
    const fx = new OneEuro(CURSOR_MIN_CUTOFF, CURSOR_BETA);
    const fy = new OneEuro(CURSOR_MIN_CUTOFF, CURSOR_BETA);
    const loop = () => {
      const now = performance.now();
      const dt = Math.max(1 / 240, (now - last) / 1000);
      last = now;
      const h = hand.current;
      const seen = now - target.lastSeen < HAND_LOST_MS;
      if (seen && !h.seen) {
        // Back in view: start from where the hand is, not from where it left
        fx.reset();
        fy.reset();
      }
      h.seen = seen;
      if (!seen) {
        h.gripping = false;
        h.settling = false;
      }
      h.x = fx.filter(target.x, dt);
      h.y = fy.filter(target.y, dt);
      // Wrist angle eases the short way round, so a jittery frame does not twitch the glass
      h.roll += Math.atan2(Math.sin(target.roll - h.roll), Math.cos(target.roll - h.roll)) * 0.3;
      const mouthSeen = performance.now() - target.mouthSeen < 600;
      if (mouthSeen && !h.mouth.seen) {
        h.mouth.x = target.mouthX;
        h.mouth.y = target.mouthY;
      }
      h.mouth.seen = mouthSeen;
      h.mouth.x += (target.mouthX - h.mouth.x) * 0.25;
      h.mouth.y += (target.mouthY - h.mouth.y) * 0.25;
      const el = cursor.current;
      if (el) {
        el.style.transform = `translate(${h.x}px, ${h.y}px)`;
        el.style.opacity = seen ? "1" : "0";
        el.dataset.grip = h.gripping ? "1" : "0";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stops.forEach((s) => s());
    };
  }, []);

  const index = ((step % DRINKS.length) + DRINKS.length) % DRINKS.length;
  const drink = DRINKS[index];

  return (
    <div
      className="relative h-dvh w-full touch-none select-none overflow-hidden bg-[#040405] text-[#ece6da]"
      onPointerDown={(e) => {
        swipeStart.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (swipeStart.current === null || grabbing.current) return;
        const dx = e.clientX - swipeStart.current;
        swipeStart.current = null;
        if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
      }}
    >
      <Canvas
        className="absolute inset-0"
        dpr={[1, MAX_DPR]}
        shadows="percentage"
        camera={{ position: [0, 2.25, 6.4], fov: 30 }}
      >
        <Suspense fallback={null}>
          <CocktailScene
            step={step}
            pourRequest={pourRequest}
            onPour={pour}
            onGrabChange={setGrabbing}
            hand={hand}
          />
        </Suspense>
      </Canvas>

      <style>{`@keyframes cocktail-title { from { opacity: 0; transform: translateY(10px); letter-spacing: 0.1em; } }`}</style>
      <header
        key={drink.name}
        className="pointer-events-none absolute inset-x-0 top-[7vh] px-5 text-center animate-[cocktail-title_0.6s_ease-out_both]"
      >
        <h1 className="font-heading text-[clamp(2.4rem,9vw,6.5rem)] leading-none tracking-[0.04em] uppercase">
          {drink.name}
        </h1>
        <p className="mt-4 font-display text-[clamp(0.8rem,1.4vw,1.05rem)] text-white/80">
          <span className="mr-3 text-white/45">Ingredients</span>
          {drink.ingredients}
        </p>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-6 p-5 sm:px-10 sm:py-8">
        <p className="font-mono text-[11px] tracking-[0.25em] text-white/50">
          {String(index + 1).padStart(2, "0")} / {String(DRINKS.length).padStart(2, "0")}
        </p>
        <p className="hidden font-mono text-[10px] tracking-[0.3em] text-white/35 uppercase sm:block">
          Close your hand on the glass · turn your wrist to tip it · bring it to your mouth to drink
        </p>
        <div className="pointer-events-auto flex shrink-0 gap-2">
          {[
            { by: -1, label: "Previous drink", glyph: "←" },
            { by: 1, label: "Next drink", glyph: "→" },
          ].map(({ by, label, glyph }) => {
            return (
              <button
                key={by}
                type="button"
                aria-label={label}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => go(by)}
                className="grid size-11 place-items-center rounded-full border border-white/20 text-lg text-white/85 transition hover:border-white/50 hover:text-white"
              >
                {glyph}
              </button>
            );
          })}
        </div>
      </div>
      {/* The webcam hand: an open ring, filled while the fingers are closed */}
      <div
        ref={cursor}
        data-grip="0"
        className="pointer-events-none absolute top-0 left-0 -mt-5 -ml-5 size-10 rounded-full border-2 border-white/90 opacity-0 shadow-[0_0_20px_rgba(0,0,0,0.35)] transition-[opacity,background-color,scale] duration-150 data-[grip=1]:scale-75 data-[grip=1]:bg-white/90"
      />
    </div>
  );
}
