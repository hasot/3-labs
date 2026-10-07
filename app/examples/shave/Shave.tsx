"use client";

import { useEffect, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Shaved portrait, its left/right 64 px already fade into the edge colors
const CLEAN_SRC = `${BASE_PATH}/images/shave-clean.webp`;
// Only the beard, cut from the bearded photo with a soft alpha edge
const BEARD_SRC = `${BASE_PATH}/images/shave-beard.webp`;
// 2×1536: per-row background color of the photo's left and right edge,
// stretched sideways so the page background continues the photo
const EDGES_SRC = `${BASE_PATH}/images/shave-edges.png`;

const PHOTO_W = 1024;
const PHOTO_H = 1536;
// Where the beard crop sits inside the photo, image px
const BEARD_X = 341;
const BEARD_Y = 493;

const MAX_DPR = 2;
// Cutting strip of the razor head, CSS px
const BLADE_W = 42;
const BLADE_H = 12;
// Share of the half-width / half-height where the cut turns ragged:
// some hairs get caught, some slip past, like a real razor leaves them
const BLADE_RAG_X = 0.45;
const BLADE_RAG_Y = 0.6;
// Grain of the ragged edge, image px: hair runs down, so the cells are tall
const RAG_CELL_X = 3;
const RAG_CELL_Y = 9;
// Beard pixels darker than this count toward the counter and drop hair
const DARK_LUM = 130;
// Chance that a removed dark pixel turns into a falling hair
const HAIR_CHANCE = 1 / 5;
const MAX_FALLING = 4000;
const MAX_LANDED = 25000;
// Fallen hair builds a heap at the bottom, column width and max height (share of height)
const PILE_BIN = 6;
const PILE_MAX = 0.12;
// Near the controls the razor turns back into the normal cursor, CSS px around them
const UI_ZONE = 56;
// Cut hair bursts away from the face, then drifts down like petals:
// weak gravity against air drag (terminal speed = GRAVITY / AIR_DRAG), px/s
const BURST_SIDE = 320;
const BURST_UP = 380;
const GRAVITY = 210;
const AIR_DRAG = 2;
// How fast a hair's sideways speed settles to the air around it, per second
const AIR_GRIP = 1.6;
// Gusty wind sweeping across the screen and each hair's own pendulum swing, px/s
const WIND = 70;
const SWAY = 85;
// "Blow the hair away": how many of the fallen hairs take off (the rest just vanish)
// and the gust speed range, px/s
const MAX_BLOWN = 5000;
const GUST_MIN = 520;
const GUST_MAX = 1100;
// Center of the chin in the photo, image px; hair flies away from it
const CHIN_X = 527;
// Sound keeps going this long after the last cut, ms
const CUT_HOLD = 90;
// Above this share the counter shows 100, the last specks are hard to catch
const DONE_AT = 0.97;

type Hair = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  len: number;
  curl: number;
  color: string;
  // Pendulum swing: phase and rate, rad/s
  phase: number;
  freq: number;
  // Tumbling around its length, the hair looks shorter when seen end-on
  flip: number;
  vflip: number;
  // Target sideways speed while a gust carries it off screen, 0 when it just drifts
  gust: number;
};

type Landed = { x: number; fromBottom: number; rot: number; len: number; curl: number; color: string };

type Layout = { vw: number; vh: number; x: number; y: number; w: number; h: number; s: number };

function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise, 0..1
function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function computeLayout(vw: number, vh: number): Layout {
  // Photo fills the height and stands on the bottom edge, centered
  const s = vh / PHOTO_H;
  const w = PHOTO_W * s;
  return { vw, vh, x: (vw - w) / 2, y: 0, w, h: vh, s };
}

function drawHair(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, len: number, curl: number, color: string) {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const hx = (len / 2) * c;
  const hy = (len / 2) * sn;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - hx, y - hy);
  ctx.quadraticCurveTo(x - sn * curl, y + c * curl, x + hx, y + hy);
  ctx.stroke();
}

// Electric razor buzz: two detuned saws through a band-pass, plus a hiss of cut hair
function createRazorSound() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1100;
  band.Q.value = 0.7;
  const buzz = ctx.createGain();
  buzz.gain.value = 0.5;
  band.connect(buzz).connect(master);

  for (const [freq, gain] of [
    [119, 0.6],
    [238.6, 0.35],
    [357, 0.15],
  ]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(band);
    osc.start();
  }

  // Motor rattle: the buzz pulses at the mains-like rate
  const rattle = ctx.createOscillator();
  rattle.frequency.value = 59.5;
  const rattleDepth = ctx.createGain();
  rattleDepth.gain.value = 0.25;
  rattle.connect(rattleDepth).connect(buzz.gain);
  rattle.start();

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 2600;
  const hiss = ctx.createGain();
  hiss.gain.value = 0;
  noise.connect(high).connect(hiss).connect(master);
  noise.start();

  // Gust of wind: the same noise through a sweeping band-pass, straight to the speakers
  const windBand = ctx.createBiquadFilter();
  windBand.type = "bandpass";
  windBand.Q.value = 1.4;
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  noise.connect(windBand).connect(windGain).connect(ctx.destination);

  let on = false;
  return {
    ctx,
    whoosh() {
      const t = ctx.currentTime;
      windBand.frequency.cancelScheduledValues(t);
      windBand.frequency.setValueAtTime(300, t);
      windBand.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
      windBand.frequency.exponentialRampToValueAtTime(250, t + 1.8);
      windGain.gain.cancelScheduledValues(t);
      windGain.gain.setValueAtTime(0, t);
      windGain.gain.linearRampToValueAtTime(0.9, t + 0.25);
      windGain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
    },
    set(cutting: boolean, amount: number) {
      const t = ctx.currentTime;
      if (cutting !== on) {
        on = cutting;
        master.gain.setTargetAtTime(cutting ? 0.32 : 0, t, cutting ? 0.015 : 0.05);
      }
      hiss.gain.setTargetAtTime(cutting ? Math.min(0.5, 0.08 + amount / 300) : 0, t, 0.03);
    },
  };
}

export function Shave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const razorRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<() => void>(() => {});
  const blowRef = useRef<() => void>(() => {});
  const [shaved, setShaved] = useState(0);
  const [ready, setReady] = useState(false);
  const startRef = useRef<() => void>(() => {});
  // The razor (and its sound) switch on with the start button: browsers only allow audio after a click
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const razor = razorRef.current!;
    const main = mainRef.current!;
    const controls = controlsRef.current!;
    const ctx = canvas.getContext("2d")!;
    let disposed = false;
    let raf = 0;

    const clean = new Image();
    const beard = new Image();
    const edges = new Image();
    clean.src = CLEAN_SRC;
    beard.src = BEARD_SRC;
    edges.src = EDGES_SRC;

    // Beard layer the razor cuts into, kept as raw pixels
    const beardCanvas = document.createElement("canvas");
    const beardCtx = beardCanvas.getContext("2d", { willReadFrequently: true })!;
    let bw = 0;
    let bh = 0;
    let orig: Uint8ClampedArray = new Uint8ClampedArray();
    let work: ImageData | null = null;
    let dark: Uint8Array = new Uint8Array();
    // Per-pixel threshold for the ragged cut edge
    let grain: Float32Array = new Float32Array();
    let totalDark = 0;
    let removedDark = 0;

    // Edge columns as 1 px wide canvases, so stretching one never bleeds into the other
    const leftEdge = document.createElement("canvas");
    const rightEdge = document.createElement("canvas");

    // Fallen hair is painted once onto its own layer
    const landedCanvas = document.createElement("canvas");
    const landedCtx = landedCanvas.getContext("2d")!;
    let landed: Landed[] = [];
    let pile: number[] = [];
    let falling: Hair[] = [];

    let layout = computeLayout(window.innerWidth, window.innerHeight);
    let dpr = 1;
    let dirty = true;
    let last: { x: number; y: number; t: number } | null = null;
    let lastCut = -Infinity;
    let cutAmount = 0;
    let tilt = 0;
    let sound: ReturnType<typeof createRazorSound> | null = null;
    let shownPct = -1;
    let on = false;

    const pileAt = (x: number) => pile[Math.max(0, Math.min(pile.length - 1, Math.floor(x / PILE_BIN)))] ?? 0;

    const paintLanded = (h: Landed) => {
      drawHair(landedCtx, h.x, layout.vh - h.fromBottom, h.rot, h.len, h.curl, h.color);
    };

    const rebuildLanded = () => {
      landedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      landedCtx.clearRect(0, 0, layout.vw, layout.vh);
      landedCtx.lineWidth = 1.1;
      landedCtx.lineCap = "round";
      pile = new Array(Math.ceil(layout.vw / PILE_BIN) + 1).fill(0);
      for (const h of landed) {
        const bin = Math.floor(h.x / PILE_BIN);
        if (bin >= 0 && bin < pile.length) pile[bin] = Math.max(pile[bin], h.fromBottom);
        paintLanded(h);
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      layout = computeLayout(window.innerWidth, window.innerHeight);
      for (const c of [canvas, landedCanvas]) {
        c.width = Math.round(layout.vw * dpr);
        c.height = Math.round(layout.vh * dpr);
      }
      canvas.style.width = `${layout.vw}px`;
      canvas.style.height = `${layout.vh}px`;
      rebuildLanded();
      dirty = true;
    };

    const updateCounter = () => {
      const pct = totalDark ? removedDark / totalDark : 0;
      const shown = pct >= DONE_AT ? 100 : Math.floor(pct * 100);
      if (shown !== shownPct) {
        shownPct = shown;
        setShaved(shown);
      }
    };

    // Cut along the segment between two points, image px relative to the beard crop
    const cut = (ax: number, ay: number, bx: number, by: number, speedX: number) => {
      if (!work) return;
      const s = layout.s;
      const halfW = BLADE_W / 2 / s;
      const halfH = BLADE_H / 2 / s;
      const ragX = halfW * BLADE_RAG_X;
      const ragY = halfH * BLADE_RAG_Y;
      const coreX = halfW - ragX;
      const coreY = halfH - ragY;
      const px = work.data;
      const dist = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(dist / halfH));
      let minX = bw;
      let minY = bh;
      let maxX = -1;
      let maxY = -1;
      let removed = 0;
      const samples: { x: number; y: number; color: string }[] = [];

      for (let k = 1; k <= steps; k++) {
        const cx = ax + ((bx - ax) * k) / steps;
        const cy = ay + ((by - ay) * k) / steps;
        const x0 = Math.max(0, Math.floor(cx - halfW));
        const x1 = Math.min(bw - 1, Math.ceil(cx + halfW));
        const y0 = Math.max(0, Math.floor(cy - halfH));
        const y1 = Math.min(bh - 1, Math.ceil(cy + halfH));
        if (x0 > x1 || y0 > y1) continue;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = y * bw + x;
            const a = px[i * 4 + 3];
            if (!a) continue;
            const fx = Math.max(0, (Math.abs(x + 0.5 - cx) - coreX) / ragX);
            const fy = Math.max(0, (Math.abs(y + 0.5 - cy) - coreY) / ragY);
            // Toward the edge of the head fewer hairs get cut; a fixed per-pixel
            // threshold keeps the edge ragged instead of eroding it on every step
            if (Math.max(fx, fy) >= grain[i]) continue;
            const na = 0;
            px[i * 4 + 3] = na;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (dark[i]) {
              const amount = (a - na) / 255;
              removed += amount;
              if (Math.random() < HAIR_CHANCE * amount) {
                const r = orig[i * 4] * 0.6;
                const g = orig[i * 4 + 1] * 0.6;
                const b = orig[i * 4 + 2] * 0.6;
                samples.push({ x, y, color: `rgb(${r | 0},${g | 0},${b | 0})` });
              }
            }
          }
        }
      }

      if (maxX >= 0) {
        beardCtx.putImageData(work, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
        dirty = true;
      }
      if (removed > 0.5) {
        removedDark += removed;
        lastCut = performance.now();
        cutAmount = removed;
        updateCounter();
      }

      const ox = layout.x + BEARD_X * s;
      const oy = layout.y + BEARD_Y * s;
      for (const p of samples) {
        if (falling.length >= MAX_FALLING) break;
        falling.push({
          x: ox + p.x * s,
          y: oy + p.y * s,
          vx:
            Math.sign(p.x + BEARD_X - CHIN_X || Math.random() - 0.5) * BURST_SIDE * (0.25 + Math.random() * 0.75) +
            speedX * 0.25,
          vy: -BURST_UP * (0.3 + Math.random() * 0.7),
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 3,
          len: 3 + Math.random() * 6,
          curl: (Math.random() - 0.5) * 3,
          color: p.color,
          phase: Math.random() * Math.PI * 2,
          freq: 1.6 + Math.random() * 1.8,
          flip: Math.random() * Math.PI,
          vflip: (Math.random() - 0.5) * 9,
          gust: 0,
        });
      }
    };

    const toBeard = (cx: number, cy: number) => ({
      x: (cx - layout.x) / layout.s - BEARD_X,
      y: (cy - layout.y) / layout.s - BEARD_Y,
    });

    const onMove = (e: PointerEvent) => {
      const r = controls.getBoundingClientRect();
      const overUi =
        !on ||
        (e.clientX > r.left - UI_ZONE &&
        e.clientX < r.right + UI_ZONE &&
        e.clientY > r.top - UI_ZONE &&
        e.clientY < r.bottom + UI_ZONE);
      razor.style.opacity = overUi ? "0" : "1";
      main.style.cursor = overUi ? "auto" : "none";
      if (overUi) {
        last = null;
        return;
      }
      const events = e.getCoalescedEvents?.() ?? [];
      const points = events.length ? events : [e];
      for (const p of points) {
        const now = p.timeStamp;
        if (last) {
          const dt = Math.max(1, now - last.t) / 1000;
          const vx = (p.clientX - last.x) / dt;
          const a = toBeard(last.x, last.y);
          const b = toBeard(p.clientX, p.clientY);
          cut(a.x, a.y, b.x, b.y, vx);
          tilt += (Math.max(-12, Math.min(12, vx * 0.012)) - tilt) * 0.2;
        }
        last = { x: p.clientX, y: p.clientY, t: now };
      }
      razor.dataset.x = String(e.clientX);
      razor.dataset.y = String(e.clientY);
    };

    const onLeave = () => {
      last = null;
      razor.style.opacity = "0";
    };

    startRef.current = () => {
      on = true;
      setStarted(true);
      if (sound) return;
      try {
        sound = createRazorSound();
        void sound.ctx.resume();
      } catch {
        sound = null;
      }
    };

    resetRef.current = () => {
      if (!work) return;
      work.data.set(orig);
      beardCtx.putImageData(work, 0, 0);
      removedDark = 0;
      landed = [];
      falling = [];
      rebuildLanded();
      updateCounter();
      dirty = true;
    };

    blowRef.current = () => {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const gust = () => dir * (GUST_MIN + Math.random() * (GUST_MAX - GUST_MIN));
      for (const h of falling) {
        h.gust = gust();
        h.vy = Math.min(h.vy, -120 - Math.random() * 260);
      }
      // A random share of the heap lifts off, so a huge pile stays smooth to animate
      const lift = landed.length <= MAX_BLOWN ? landed : landed.filter(() => Math.random() < MAX_BLOWN / landed.length);
      for (const l of lift) {
        falling.push({
          x: l.x,
          y: layout.vh - l.fromBottom,
          vx: dir * Math.random() * 200,
          vy: -250 - Math.random() * 480,
          rot: l.rot,
          vr: (Math.random() - 0.5) * 6,
          len: l.len,
          curl: l.curl,
          color: l.color,
          phase: Math.random() * Math.PI * 2,
          freq: 1.6 + Math.random() * 1.8,
          flip: Math.random() * Math.PI,
          vflip: (Math.random() - 0.5) * 14,
          gust: gust(),
        });
      }
      landed = [];
      rebuildLanded();
      sound?.whoosh();
      dirty = true;
    };

    const render = (dt: number) => {
      const now = performance.now();
      const cutting = now - lastCut < CUT_HOLD;
      sound?.set(cutting, cutAmount);

      // Razor follows the pointer, shivers while it cuts
      const rx = Number(razor.dataset.x ?? -999);
      const ry = Number(razor.dataset.y ?? -999);
      const jx = cutting ? (Math.random() - 0.5) * 1.6 : 0;
      const jy = cutting ? (Math.random() - 0.5) * 1.6 : 0;
      razor.style.transform = `translate(${rx + jx}px, ${ry + jy}px) rotate(${tilt}deg)`;
      tilt *= 0.92;

      if (falling.length) {
        const next: Hair[] = [];
        landedCtx.lineWidth = 1.1;
        landedCtx.lineCap = "round";
        const t = now / 1000;
        for (const h of falling) {
          // Wind changes over time and across the screen, so hairs drift apart in waves
          const wind =
            WIND * (0.6 * Math.sin(t * 0.37 + h.y * 0.004) + 0.4 * Math.sin(t * 1.13 + h.x * 0.009 + 1.7));
          const swing = Math.sin(t * h.freq + h.phase);
          if (h.gust) {
            // Carried off: the gust lifts the hair and sweeps it out of the screen
            h.vx += (h.gust + swing * SWAY - h.vx) * Math.min(1, 2.2 * dt);
            h.vy += (GRAVITY * 0.3 - AIR_DRAG * 0.45 * h.vy) * dt;
            h.x += h.vx * dt;
            h.y = Math.min(h.y + h.vy * dt, layout.vh - 2);
            h.rot += (h.vr + swing * 2) * dt;
            h.flip += h.vflip * dt;
            if (h.x > -40 && h.x < layout.vw + 40 && h.y > -60) next.push(h);
            continue;
          }
          const air = wind + swing * SWAY;
          h.vx += (air - h.vx) * Math.min(1, AIR_GRIP * dt);
          // Petals slow down at the ends of the swing and drop faster through the middle
          h.vy += (GRAVITY * (0.55 + 0.45 * Math.abs(Math.cos(t * h.freq + h.phase))) - AIR_DRAG * h.vy) * dt;
          // Keep the drift on screen
          if (h.x < 24) h.vx += 260 * dt;
          if (h.x > layout.vw - 24) h.vx -= 260 * dt;
          h.x += h.vx * dt;
          h.y += h.vy * dt;
          h.rot += (h.vr + swing * 1.4) * dt;
          h.flip += h.vflip * dt;
          const floor = layout.vh - pileAt(h.x);
          if (h.y >= floor - 1) {
            const bin = Math.floor(h.x / PILE_BIN);
            const top = layout.vh * PILE_MAX;
            const l: Landed = {
              x: h.x,
              fromBottom: Math.min(top, layout.vh - floor + Math.random() * 1.5),
              // Hair lies down flat-ish on the heap
              rot: (Math.random() - 0.5) * 1.2,
              len: h.len,
              curl: h.curl,
              color: h.color,
            };
            if (bin >= 0 && bin < pile.length) {
              pile[bin] = Math.min(top, pile[bin] + 0.14);
              if (bin > 0) pile[bin - 1] = Math.min(top, pile[bin - 1] + 0.05);
              if (bin < pile.length - 1) pile[bin + 1] = Math.min(top, pile[bin + 1] + 0.05);
            }
            paintLanded(l);
            if (landed.length < MAX_LANDED) landed.push(l);
          } else if (h.x > -20 && h.x < layout.vw + 20) {
            next.push(h);
          }
        }
        falling = next;
        dirty = true;
      }

      if (!dirty) return;
      dirty = false;
      const { vw, vh, x, y, w, h, s } = layout;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      ctx.drawImage(leftEdge, 0, 0, 1, PHOTO_H, 0, y, x + 1, h);
      ctx.drawImage(rightEdge, 0, 0, 1, PHOTO_H, x + w - 1, y, vw - x - w + 1, h);
      ctx.drawImage(clean, x, y, w, h);
      ctx.drawImage(beardCanvas, x + BEARD_X * s, y + BEARD_Y * s, bw * s, bh * s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(landedCanvas, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 1.1;
      ctx.lineCap = "round";
      for (const hair of falling) {
        const seen = 0.3 + 0.7 * Math.abs(Math.cos(hair.flip));
        drawHair(ctx, hair.x, hair.y, hair.rot, hair.len * seen, hair.curl * seen, hair.color);
      }
    };

    let prev = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - prev) / 1000);
      prev = t;
      render(dt);
      raf = requestAnimationFrame(loop);
    };

    Promise.all([clean.decode(), beard.decode(), edges.decode()]).then(() => {
      if (disposed) return;
      bw = beard.naturalWidth;
      bh = beard.naturalHeight;
      beardCanvas.width = bw;
      beardCanvas.height = bh;
      beardCtx.drawImage(beard, 0, 0);
      work = beardCtx.getImageData(0, 0, bw, bh);
      orig = new Uint8ClampedArray(work.data);
      dark = new Uint8Array(bw * bh);
      grain = new Float32Array(bw * bh);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const n = valueNoise(x / RAG_CELL_X, y / RAG_CELL_Y);
          // Never below 0.15, so the middle of the head always cuts clean
          grain[y * bw + x] = 0.15 + 0.85 * (0.6 * n + 0.4 * Math.random());
        }
      }
      totalDark = 0;
      for (let i = 0; i < bw * bh; i++) {
        const lum = (orig[i * 4] + orig[i * 4 + 1] + orig[i * 4 + 2]) / 3;
        if (lum < DARK_LUM && orig[i * 4 + 3] > 0) {
          dark[i] = 1;
          totalDark += orig[i * 4 + 3] / 255;
        }
      }

      for (const [c, col] of [
        [leftEdge, 0],
        [rightEdge, 1],
      ] as const) {
        c.width = 1;
        c.height = PHOTO_H;
        c.getContext("2d")!.drawImage(edges, col, 0, 1, PHOTO_H, 0, 0, 1, PHOTO_H);
      }

      resize();
      setReady(true);
      raf = requestAnimationFrame(loop);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerdown", onMove);
      document.documentElement.addEventListener("pointerleave", onLeave);
      window.addEventListener("resize", resize);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      void sound?.ctx.close();
    };
  }, []);

  return (
    <main
      ref={mainRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: "rgb(221 220 221)", cursor: "auto", touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      />

      <div
        ref={razorRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-20"
        style={{ opacity: 0, willChange: "transform", transformOrigin: "0 0" }}
      >
        <Razor />
      </div>

      {ready && (
        <div
          className="absolute inset-x-0 bottom-[14vh] z-10 flex justify-center transition-all duration-500"
          style={{
            opacity: started ? 0 : 1,
            transform: started ? "translateY(12px)" : "none",
            pointerEvents: started ? "none" : "auto",
          }}
        >
          <button
            type="button"
            onClick={() => startRef.current()}
            className="flex items-center gap-3 rounded-full bg-[#1f1c1a] py-4 pl-5 pr-7 text-lg font-medium text-[#f4f1ed] shadow-[0_14px_40px_rgba(0,0,0,0.28)] transition hover:scale-[1.03] hover:bg-[#3a3532] active:scale-[0.97]"
            style={{ cursor: "pointer" }}
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dd87a] opacity-70" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#7dd87a]" />
            </span>
            Начать бритьё
          </button>
        </div>
      )}

      <div ref={controlsRef} className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-3 text-[#2a2623]">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[#2a2623]/60">Побрито</span>
          <span className="w-[4.4ch] text-right text-3xl font-semibold tabular-nums">{shaved}%</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => blowRef.current()}
            className="rounded-full border border-[#1f1c1a]/25 bg-white/40 px-5 py-2.5 text-sm font-medium text-[#1f1c1a] backdrop-blur transition hover:bg-white/70 active:scale-[0.97]"
            style={{ cursor: "pointer" }}
          >
            Раздуть волосы
          </button>
          <button
            type="button"
            onClick={() => resetRef.current()}
            className="rounded-full bg-[#1f1c1a] px-5 py-2.5 text-sm font-medium text-[#f4f1ed] shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition hover:bg-[#3a3532] active:scale-[0.97]"
            style={{ cursor: "pointer" }}
          >
            Сбросить
          </button>
        </div>
      </div>
    </main>
  );
}

// Electric razor; its top foil is the blade, centered on the pointer
function Razor() {
  return (
    <svg
      width="50"
      height="94"
      viewBox="0 0 80 150"
      style={{ transform: "translate(-25px, -6px)", filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.28))" }}
    >
      <defs>
        <linearGradient id="razor-foil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.5" stopColor="#c3c8cd" />
          <stop offset="1" stopColor="#8d949b" />
        </linearGradient>
        <linearGradient id="razor-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a4f55" />
          <stop offset="0.35" stopColor="#2b2f33" />
          <stop offset="1" stopColor="#141618" />
        </linearGradient>
      </defs>
      <path d="M12 24 L68 24 L62 38 L18 38 Z" fill="#1c1e21" />
      <rect x="4" y="2" width="72" height="22" rx="8" fill="url(#razor-foil)" />
      <g stroke="#6f767d" strokeOpacity="0.45" strokeWidth="0.8">
        {Array.from({ length: 22 }, (_, i) => (
          <line key={i} x1={8 + i * 3} y1="5" x2={8 + i * 3} y2="21" />
        ))}
      </g>
      <rect x="4" y="2" width="72" height="22" rx="8" fill="none" stroke="#5c6268" strokeWidth="1" />
      <rect x="16" y="34" width="48" height="114" rx="22" fill="url(#razor-body)" />
      <rect x="21" y="44" width="4" height="90" rx="2" fill="#ffffff" opacity="0.12" />
      <circle cx="40" cy="72" r="7.5" fill="#1a1c1f" stroke="#5a6067" strokeWidth="1.2" />
      <circle cx="40" cy="72" r="2" fill="#7dd87a" />
      <g stroke="#0d0e10" strokeWidth="1.4" opacity="0.7">
        <line x1="30" y1="112" x2="50" y2="112" />
        <line x1="30" y1="118" x2="50" y2="118" />
        <line x1="30" y1="124" x2="50" y2="124" />
      </g>
    </svg>
  );
}
