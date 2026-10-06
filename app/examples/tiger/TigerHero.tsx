"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const BG = "#F69844";

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

// Which frame looks which way: [angle from the head to the cursor in degrees,
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

// How fast the head catches up with the cursor, per second
const FOLLOW = 10;
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

    // Look straight up until the cursor shows up. The head is eased in angles,
    // not frames, so a turn never runs through the skipped blinks
    let target = 0;
    let current = 0;
    let drawn = -1;
    let last = performance.now();

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

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const dx = e.clientX - (r.left + HEAD_X * r.width);
      const dy = e.clientY - (r.top + HEAD_Y * r.height);
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

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
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

    Promise.all(loads).then(() => {
      if (disposed) return;
      draw(frameFor(current));
      setReady(true);
      last = performance.now();
      raf = requestAnimationFrame(tick);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, []);

  return (
    <main
      className="relative flex h-dvh w-full touch-none items-center justify-center overflow-hidden select-none"
      style={{ backgroundColor: BG }}
    >
      <canvas
        ref={canvasRef}
        className={`transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ transform: `translateY(${DROP * 100}%)` }}
      />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm tracking-[0.3em] text-white/90">
          {Math.round(progress * 100)}%
        </div>
      )}

      <Link
        href="/"
        className="absolute top-5 left-6 text-xs uppercase tracking-[0.25em] text-white/80 transition-colors hover:text-white md:top-8 md:left-12"
      >
        Labs
      </Link>
    </main>
  );
}
