"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "./Copy";
import { playClaws, playRoar, preloadStrike, unlockStrike } from "./strikeSound";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Share of the viewport height the tiger video takes, anchored to the bottom center
const VIDEO_HEIGHT_VH = 80;
// Idle: the first 8 s of the clip, the tiger slowly approaching (later its head runs into
// the top of the frame); it never returns to its starting distance, so the loop point
// hides in a quick, shallow dip of brightness
const WALK_SRC = `${BASE_PATH}/videos/tiger-walk.mp4`;
const LOOP_DIP_S = 0.2;
const LOOP_DIP_DEPTH = 0.4;
// Click plays the very end (from 13.4 s): one last step, then it leaps at the camera and slashes
const STRIKE_SRC = `${BASE_PATH}/videos/tiger-strike.mp4`;
// The strike clip plays sped up so the leap hits hard
const STRIKE_RATE = 2;
// Seconds into the strike clip (clip time, not wall time): the walk crossfades out (the
// roar starts ROAR_DELAY_S after the click), then the paw comes down and the screen tears
const CROSSFADE_S = 0.3;
const ROAR_DELAY_S = 0.3;
const HIT_AT = 1.25;
// What the claw tear opens onto
const REVEAL_SRC = `${BASE_PATH}/images/tiger-jungle.webp`;
// Lighter copy for inside the tear: the full-size picture under the mask and the blurred
// edge shadow makes Chrome stall on the hit; the full one only shows once the tear is gone
const TEAR_SRC = `${BASE_PATH}/images/tiger-jungle-tear.webp`;

// Timeline of one strike, ms: claws rip in, the tear hangs open, then it swallows the screen
const TEAR_MS = 750;
const HOLD_MS = 450;
const ZOOM_MS = 1200;
// After the hit the tiger dissolves into the dark instead of freezing on the last
// frame, leaving the bare cuts on black
const VANISH_DELAY_MS = 120;
const VANISH_MS = 300;
const SHAKE_MS = 380;

const SAMPLES = 180;

// Four claws, upper-left to lower-right like the reference; units are fractions of
// min(viewport width, height). The second claw is the deepest one
const CLAWS = [
  { offset: -1.55, shift: -0.06, length: 0.62, width: 0.016, delay: 0 },
  { offset: -0.5, shift: 0, length: 0.82, width: 0.024, delay: 0.06 },
  { offset: 0.5, shift: 0.03, length: 0.74, width: 0.021, delay: 0.12 },
  { offset: 1.5, shift: 0.07, length: 0.52, width: 0.014, delay: 0.18 },
];
// Share of TEAR_MS one claw takes to cross; the last one starts at 0.18
const SWIPE = 1 - 0.18;
const GAP = 0.085;

const VIDEO_CLASS = "absolute bottom-0 left-1/2 w-auto max-w-none -translate-x-1/2";
// Fade the frame edges into the black page so no rectangle shows
const SIDES_MASK = "linear-gradient(to right, transparent, #000 24%, #000 76%, transparent)";
const videoStyle = (mask: string): React.CSSProperties => ({
  height: `${VIDEO_HEIGHT_VH}vh`,
  maskImage: mask,
  WebkitMaskImage: mask,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
});
const VIDEO_STYLE = videoStyle(
  `${SIDES_MASK}, linear-gradient(to bottom, transparent, #000 6%, #000 86%, transparent)`,
);

// A sub-pixel sliver of tear kept in the mask while idle: it makes the browser decode the
// big jungle picture up front instead of stalling a quarter second on the hit
const WARM_POINTS = "0,0 0.5,0 0,0.5";
const idlePoints = (layer: number) => (layer === 0 ? WARM_POINTS : "");

type Phase ="idle" | "striking" | "tearing" | "revealed";

// Torn-paper edge: a slow wobble plus fine jitter, fixed per claw so it doesn't boil
function makeEdge(seed: number) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const p1 = rand() * 6.28;
  const p2 = rand() * 6.28;
  // Coarse random bumps, smoothed, read the tear as fibrous; the tiny jitter keeps it crisp
  const raw = Array.from({ length: SAMPLES + 1 }, () => rand() - 0.5);
  const bumps = raw.map((_, k) => {
    let sum = 0;
    for (let j = -3; j <= 3; j++) sum += raw[Math.min(SAMPLES, Math.max(0, k + j))];
    return sum / 7;
  });
  return bumps.map((b, k) => {
    const x = k / SAMPLES;
    return 0.16 * Math.sin(x * 13 + p1) + 0.1 * Math.sin(x * 37 + p2) + 0.9 * b + 0.07 * (rand() - 0.5);
  });
}

const EDGES = CLAWS.map((_, i) => [makeEdge(11 + i * 97), makeEdge(53 + i * 131)]);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Polygon of one claw: `grow` 0→1 runs the tip along the slash,
// `zoom` 0→1 scales the whole tear around the center and fattens it until claws merge
function clawPoints(i: number, w: number, h: number, grow: number, zoom: number) {
  const c = CLAWS[i];
  const u = Math.min(w, h);
  const len = Math.hypot(1, 1.15);
  const dx = 1 / len;
  const dy = 1.15 / len;
  const nx = -dy;
  const ny = dx;
  const cx = w / 2;
  const cy = h / 2;

  const scale = 1 + 22 * zoom ** 3;
  const fatten = 1 + 11 * zoom ** 2;
  const [top, bottom] = EDGES[i];

  const upper: string[] = [];
  const lower: string[] = [];
  for (let k = 0; k <= SAMPLES; k++) {
    const s = k / SAMPLES;
    if (s > grow) break;
    // Tapered at both ends, the leading tip stays needle-sharp while it travels
    const taper = Math.sin(Math.PI * s) ** 0.75 * Math.sqrt(clamp01((grow - s) / 0.08));
    const half = c.width * u * taper * fatten;
    const along = (c.shift + (s - 0.5) * c.length) * u;
    // A slight bow, like a swipe of a paw rather than a ruler
    const bow = (c.offset * GAP + 0.03 * Math.sin(Math.PI * s)) * u;
    const px = cx + nx * bow + dx * along;
    const py = cy + ny * bow + dy * along;
    const up = half * (1 + top[k]);
    const down = half * (1 + bottom[k]);
    upper.push(`${cx + (px + nx * up - cx) * scale},${cy + (py + ny * up - cy) * scale}`);
    lower.push(`${cx + (px - nx * down - cx) * scale},${cy + (py - ny * down - cy) * scale}`);
  }
  return upper.concat(lower.reverse()).join(" ");
}

export function TigerWalk() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const rootRef = useRef<HTMLElement>(null);
  const walkRef = useRef<HTMLVideoElement>(null);
  const strikeRef = useRef<HTMLVideoElement>(null);
  const fullRef = useRef<HTMLImageElement>(null);
  const rimRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGGElement>(null);
  const polys = useRef<SVGPolygonElement[]>([]);

  useEffect(() => {
    preloadStrike().catch(() => {});
    // Same for the strike clip: start its decoder once, so the click doesn't wait for it
    const strike = strikeRef.current;
    strike
      ?.play()
      .then(() => {
        strike.pause();
        strike.currentTime = 0;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (phase !== "idle") return;
    const walk = walkRef.current;
    if (!walk) return;
    let raf = 0;
    const frame = () => {
      const edge = Math.min(walk.currentTime, (walk.duration || Infinity) - walk.currentTime);
      walk.style.opacity = String(1 - LOOP_DIP_DEPTH * (1 - clamp01(edge / LOOP_DIP_S)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== "striking") return;
    const strike = strikeRef.current;
    const walk = walkRef.current;
    if (!strike || !walk) return;
    let raf = 0;
    // Picks up from wherever the loop dip left the walk, so a click mid-dip doesn't flash
    const walkFrom = Number(walk.style.opacity || 1);

    const hit = () => {
      playClaws(
        CLAWS.map((c) => (c.delay * TEAR_MS) / 1000),
        (SWIPE * TEAR_MS) / 1000,
      );
      setPhase("tearing");
    };

    const frame = () => {
      const t = strike.currentTime;
      const fade = clamp01(t / CROSSFADE_S);
      strike.style.opacity = String(fade);
      walk.style.opacity = String(walkFrom * (1 - fade));
      // `ended` covers a clip that stalls or runs short before the paw lands
      if (t >= HIT_AT || strike.ended) hit();
      else raf = requestAnimationFrame(frame);
    };

    strike.currentTime = 0;
    strike.playbackRate = STRIKE_RATE;
    strike.play().catch(hit);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== "tearing") return;
    const { w, h } = size;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const t = now - start;
      const tear = clamp01(t / TEAR_MS);
      const zoom = clamp01((t - TEAR_MS - HOLD_MS) / ZOOM_MS);

      CLAWS.forEach((c, i) => {
        const grow = 1 - (1 - clamp01((tear - c.delay) / SWIPE)) ** 3;
        const pts = clawPoints(i, w, h, grow, zoom);
        // Same polygon feeds the mask, the inner shadow and the paper rim
        for (let layer = 0; layer < 3; layer++) {
          polys.current[layer * CLAWS.length + i]?.setAttribute("points", pts);
        }
      });

      const strike = strikeRef.current;
      if (strike) strike.style.opacity = String(1 - clamp01((t - VANISH_DELAY_MS) / VANISH_MS));

      // The page jolts while the claws go through
      const jolt = t < SHAKE_MS ? 7 * (1 - t / SHAKE_MS) : 0;
      if (rootRef.current) {
        rootRef.current.style.transform = jolt
          ? `translate(${(Math.random() - 0.5) * jolt}px, ${(Math.random() - 0.5) * jolt}px)`
          : "";
      }
      // Rim and inner shadow belong to a small tear; blown up they turn into dirty bands
      const edge = String(clamp01(1 - zoom * 3));
      if (rimRef.current) rimRef.current.style.opacity = edge;
      if (shadowRef.current) shadowRef.current.style.opacity = edge;
      // The tear never quite covers the corners, so the picture fades in to finish
      if (fullRef.current) fullRef.current.style.opacity = String(clamp01((zoom - 0.75) / 0.25));

      if (zoom < 1) raf = requestAnimationFrame(frame);
      else setPhase("revealed");
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, size]);

  const onClick = () => {
    if (phase === "idle") {
      unlockStrike();
      playRoar(ROAR_DELAY_S);
      setPhase("striking");
    } else if (phase === "revealed") {
      polys.current.forEach((p, k) => p?.setAttribute("points", idlePoints(Math.floor(k / CLAWS.length))));
      if (fullRef.current) fullRef.current.style.opacity = "0";
      const strike = strikeRef.current;
      if (strike) {
        strike.pause();
        strike.style.opacity = "0";
      }
      if (walkRef.current) walkRef.current.style.opacity = "1";
      setPhase("idle");
    }
  };

  const polygonLayer = (layer: number, props: React.SVGProps<SVGPolygonElement>) =>
    CLAWS.map((_, i) => (
      <polygon
        key={i}
        ref={(el) => {
          if (el) polys.current[layer * CLAWS.length + i] = el;
        }}
        points={idlePoints(layer)}
        {...props}
      />
    ));

  return (
    <main
      ref={rootRef}
      onClick={onClick}
      className="relative h-dvh w-full cursor-pointer overflow-hidden bg-black"
    >
      <video
        ref={walkRef}
        src={WALK_SRC}
        autoPlay
        muted
        loop
        playsInline
        className={VIDEO_CLASS}
        style={VIDEO_STYLE}
      />
      {/* Waits fully buffered and invisible until the click */}
      <video
        ref={strikeRef}
        src={STRIKE_SRC}
        muted
        playsInline
        preload="auto"
        className={VIDEO_CLASS}
        style={{ ...VIDEO_STYLE, opacity: 0 }}
      />

      {phase !== "revealed" && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${size.w} ${size.h}`}
        >
          <defs>
            <mask id="claw-tear" maskUnits="userSpaceOnUse">
              {polygonLayer(0, { fill: "#fff" })}
            </mask>
            <filter id="claw-blur">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <g mask="url(#claw-tear)">
            <image
              href={TEAR_SRC}
              width={size.w}
              height={size.h}
              preserveAspectRatio="xMidYMid slice"
            />
            {/* Depth: the torn edge throws a soft shadow into the hole */}
            <g ref={shadowRef} filter="url(#claw-blur)">
              {polygonLayer(1, { fill: "none", stroke: "rgba(0,0,0,0.75)", strokeWidth: 10 })}
            </g>
          </g>
          {/* Thin pale rim of torn paper */}
          <g ref={rimRef}>
            {polygonLayer(2, {
              fill: "none",
              stroke: "rgba(245,238,226,0.9)",
              strokeWidth: 1.6,
              strokeLinejoin: "round",
            })}
          </g>
        </svg>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={fullRef}
        src={REVEAL_SRC}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ opacity: phase === "revealed" ? 1 : 0 }}
      />

      <Copy phase={phase} />
    </main>
  );
}
