"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BUTTERFLY_SIZE, Butterfly } from "./Butterfly";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const BG = "#F69844";
// The name behind the cub: a shade darker than the fur, tone on tone
const EMBER = "#E9792A";
// Text: the brown of the stripes
const STRIPE = "#2B1708";
const NAME = "Tora";

// The cut-out tiger clip at 48 fps: its head sweeps an arc from the lower left,
// over the top, to the lower right. Frames are transparent and cropped around the
// torso
const FRAME_COUNT = 239;
const frameSrc = (i: number) =>
  `${BASE_PATH}/frames/tiger/${String(i + 1).padStart(3, "0")}.webp`;
const FRAME_W = 820;
const FRAME_H = 873;
// Share of the screen height the frame takes
const HEIGHT_SHARE = 0.53;
// Shift of the frame down from the centre of the screen, as a share of its height
const DROP = 0.2;
// Soft contact shadow under the feet, in frame fractions
const SHADOW = { x: 0.49, y: 0.975, rx: 0.36, ry: 0.035 };
// Where the head turns from, in frame fractions
const HEAD_X = 0.5;
const HEAD_Y = 0.3;

// Which frame looks which way: [angle from the head to the butterfly in degrees,
// 1-based frame]. 0° is straight up, negative to the left, positive to the right.
// The head doesn't turn evenly in the clip, so the frames are pinned by hand, and
// the two blinks (frames 32–47 and 199–211) are jumped over
const LOOK: [number, number][] = [
  [-125, 1],
  [-105, 30],
  [-104.9, 49],
  [-75, 61],
  [-40, 81],
  [0, 113],
  [40, 145],
  [75, 170],
  [100, 196],
  [100.1, 213],
  [125, 239],
];
const MAX_ANGLE = 125;

// How fast the head catches up with the butterfly, per second
const FOLLOW = 10;

// The butterfly stands in for the cursor: it flies after it with a lag and a
// wobble, and the tiger watches the butterfly
// How fast it closes in on the cursor, per second
const FLY = 4;
// Wobble around its goal, in px
const WOBBLE_X = 10;
const WOBBLE_Y = 8;
// Wing beats per second, from hovering to full speed (px per second)
const FLAP_SLOW = 4;
const FLAP_FAST = 9;
const FAST_SPEED = 900;
// With no cursor movement for this long it flies by itself in a small patch right
// above the cub's head, between the ears and the top of the name, mostly side to
// side, as if someone were nudging the mouse back and forth. All in frame sizes:
// SWAY to each side of the head (share of the frame width), LIFT how high the
// middle of the patch sits above the top of the frame and BOB how far it rises
// and falls from there (shares of the frame height)
const IDLE_MS = 2500;
const SWAY = 0.4;
const LIFT = 0.13;
const BOB = 0.06;
// Below the head both ends of the sweep meet: the cursor has to cross this share of
// the screen width to the other side before the tiger flips to look that way
const FLIP_MARGIN = 0.04;
const MAX_DPR = 2;

const frameFor = (angle: number) => {
  for (let k = 1; k < LOOK.length; k++) {
    const [a1, f1] = LOOK[k];
    if (angle <= a1) {
      const [a0, f0] = LOOK[k - 1];
      const t = Math.max(0, (angle - a0) / (a1 - a0));
      return Math.round(f0 + (f1 - f0) * t) - 1;
    }
  }
  return FRAME_COUNT - 1;
};

export function TigerHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<SVGUseElement>(null);
  const rightRef = useRef<SVGUseElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    const frames: HTMLImageElement[] = [];

    // Look straight up until the butterfly takes off. The head is eased in angles,
    // not frames, so a turn never runs through the skipped blinks
    let target = 0;
    let current = 0;
    let drawn = -1;
    let last = performance.now();
    let time = 0;

    const fly = {
      x: window.innerWidth * 0.75,
      y: window.innerHeight * 0.3,
      heading: 0,
      phase: 0,
    };
    let pointer: { x: number; y: number } | null = null;
    let lastMove = -Infinity;

    const draw = (i: number) => {
      const img = frames[i];
      if (!img) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.globalCompositeOperation = "destination-over";
      ctx.save();
      ctx.translate(SHADOW.x * w, SHADOW.y * h);
      ctx.scale(SHADOW.rx * w, SHADOW.ry * h);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, "rgba(120, 50, 0, 0.35)");
      g.addColorStop(1, "rgba(120, 50, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      drawn = i;
    };

    const resize = () => {
      const h = window.innerHeight * HEIGHT_SHARE;
      const w = (h * FRAME_W) / FRAME_H;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.min(Math.round(w * dpr), FRAME_W);
      canvas.height = Math.min(Math.round(h * dpr), FRAME_H);
      ctx.imageSmoothingQuality = "high";
      if (drawn >= 0) draw(drawn);
    };

    const head = () => {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + HEAD_X * r.width, y: r.top + HEAD_Y * r.height };
    };

    const aim = (x: number, y: number) => {
      const h = head();
      const dx = x - h.x;
      const dy = y - h.y;
      const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (Math.abs(angle) <= MAX_ANGLE) {
        target = angle;
      } else if (
        Math.abs(dx) > FLIP_MARGIN * window.innerWidth ||
        Math.abs(target) !== MAX_ANGLE
      ) {
        target = dx < 0 ? -MAX_ANGLE : MAX_ANGLE;
      }
    };

    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      lastMove = performance.now();
    };
    const onLeave = () => {
      pointer = null;
    };

    const flyStep = (now: number, dt: number) => {
      let gx: number;
      let gy: number;
      if (pointer && now - lastMove < IDLE_MS) {
        gx = pointer.x + Math.sin(time * 2.3) * WOBBLE_X;
        gy = pointer.y + Math.cos(time * 1.9) * WOBBLE_Y;
      } else {
        // Side to side just above the head, never down across the cub
        const r = canvas.getBoundingClientRect();
        const h = head();
        gx = h.x + Math.sin(time * 0.6) * SWAY * r.width;
        gy = r.top - (LIFT + Math.sin(time * 1.1) * BOB) * r.height;
      }
      const px = fly.x;
      const py = fly.y;
      const k = 1 - Math.exp(-FLY * dt);
      fly.x += (gx - fly.x) * k;
      fly.y += (gy - fly.y) * k;

      const vx = (fly.x - px) / Math.max(dt, 1e-3);
      const vy = (fly.y - py) / Math.max(dt, 1e-3);
      const speed = Math.hypot(vx, vy);
      // Nose into the flight when moving, drift back upright when hovering
      const want = speed > 40 ? Math.atan2(vx, -vy) : 0;
      let turn = want - fly.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      fly.heading += turn * (1 - Math.exp(-(speed > 40 ? 8 : 2) * dt));

      const s = Math.min(speed / FAST_SPEED, 1);
      fly.phase += dt * Math.PI * 2 * (FLAP_SLOW + (FLAP_FAST - FLAP_SLOW) * s);
      // Wings stay open most of the beat and snap shut quickly
      const open = 0.18 + 0.82 * Math.pow(Math.abs(Math.cos(fly.phase / 2)), 0.6);
      leftRef.current?.setAttribute("transform", `scale(${-open} 1)`);
      rightRef.current?.setAttribute("transform", `scale(${open} 1)`);
      const bob = Math.sin(fly.phase) * 2;
      const root = flyRef.current;
      if (root) {
        root.style.transform = `translate(${fly.x - BUTTERFLY_SIZE / 2}px, ${
          fly.y - BUTTERFLY_SIZE / 2 + bob
        }px) rotate(${fly.heading}rad)`;
      }
      aim(fly.x, fly.y);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      time += dt;
      flyStep(now, dt);
      current += (target - current) * (1 - Math.exp(-FOLLOW * dt));
      const i = frameFor(current);
      if (i !== drawn) draw(i);
      raf = requestAnimationFrame(tick);
    };

    let loaded = 0;
    const loads = Array.from({ length: FRAME_COUNT }, (_, i) => {
      const img = new Image();
      img.src = frameSrc(i);
      frames[i] = img;
      return img
        .decode()
        .catch(() => {})
        .then(() => {
          loaded += 1;
          if (!disposed) setProgress(loaded / FRAME_COUNT);
        });
    });

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);

    Promise.all(loads).then(() => {
      if (disposed) return;
      draw(frameFor(current));
      setReady(true);
      if (flyRef.current) flyRef.current.style.opacity = "1";
      last = performance.now();
      raf = requestAnimationFrame(tick);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <main
      className="relative flex h-dvh w-full cursor-none touch-none items-center justify-center overflow-hidden select-none"
      style={{ backgroundColor: BG, color: STRIPE, fontFamily: "var(--font-bricolage)" }}
    >
      <style>{`
        @keyframes tora-rise {
          from { transform: translateY(35%); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
        .tora-letter { opacity: 0; }
        .tora-ready .tora-letter {
          animation: tora-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .tora-ready .tora-letter { animation: none; opacity: 1; }
        }
      `}</style>

      {/* The name sits behind the cub, whose head and ears cover its lower edge */}
      <h1
        aria-label={NAME}
        className={`pointer-events-none absolute inset-x-0 top-[38vh] -translate-y-[80%] text-center text-[34vw] leading-none md:text-[29vw] ${
          ready ? "tora-ready" : ""
        }`}
        style={{ color: EMBER, fontFamily: "var(--font-bagel)", letterSpacing: "-0.02em" }}
      >
        {NAME.toLowerCase()
          .split("")
          .map((c, i) => (
            <span
              key={i}
              aria-hidden
              className="tora-letter inline-block"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              {c}
            </span>
          ))}
      </h1>

      <canvas
        ref={canvasRef}
        className={`relative z-10 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ transform: `translateY(${DROP * 100}%)` }}
      />

      <Butterfly rootRef={flyRef} leftRef={leftRef} rightRef={rightRef} />

      <p className="absolute inset-x-6 bottom-6 z-10 text-center text-[15px] leading-snug md:inset-x-auto md:bottom-12 md:left-12 md:max-w-[17rem] md:text-left md:text-[17px]">
        {NAME} is four months old and has exactly one hobby: the butterfly.
      </p>
      <p className="absolute right-12 bottom-12 z-10 hidden max-w-[17rem] text-right text-[17px] leading-snug opacity-80 md:block">
        Move the cursor to lead the butterfly. Leave it, and it wanders off on its
        own. {NAME} keeps watching either way.
      </p>

      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-sm opacity-70">
          {Math.round(progress * 100)}%
        </div>
      )}

      <Link
        href="/"
        className="absolute top-5 left-6 z-30 cursor-none rounded text-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 md:top-8 md:left-12"
      >
        Labs
      </Link>
    </main>
  );
}
