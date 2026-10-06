"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Every frame of the 5 s tiger clip, background graded to BG
const FRAME_COUNT = 121;
const frameSrc = (i: number) =>
  `${BASE_PATH}/frames/tiger/${String(i + 1).padStart(3, "0")}.webp`;

const BG = "#F69844";
// Source frame size
const FRAME_W = 828;
const FRAME_H = 1108;
// Shift of the frame down from the centre of the screen, as a share of its height
const DROP = 0.1;
// Share of the screen height the frame takes
const HEIGHT_SHARE = 0.72;
// How fast the shown frame catches up with the cursor, per second
const FOLLOW = 10;
const MAX_DPR = 2;

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

    // Start looking straight ahead until the cursor shows up
    let target = (FRAME_COUNT - 1) / 2;
    let current = target;
    let drawn = -1;
    let last = performance.now();

    // A fractional position blends the two nearest frames, so the turn never steps
    const draw = (pos: number) => {
      const i = Math.floor(pos);
      const t = pos - i;
      const a = frames[i];
      if (!a) return;
      ctx.globalAlpha = 1;
      ctx.drawImage(a, 0, 0, canvas.width, canvas.height);
      const b = frames[i + 1];
      if (b && t > 0.01) {
        ctx.globalAlpha = t;
        ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
      drawn = pos;
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
      const x = Math.min(Math.max(e.clientX / window.innerWidth, 0), 1);
      target = x * (FRAME_COUNT - 1);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      current += (target - current) * (1 - Math.exp(-FOLLOW * dt));
      if (Math.abs(current - drawn) > 0.005) draw(current);
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
      draw(current);
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
        style={{
          transform: `translateY(${DROP * 100}%)`,
          // Feather the frame edges into the page so its border never shows
          maskImage:
            "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)",
          maskComposite: "intersect",
        }}
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
