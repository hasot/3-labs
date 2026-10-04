"use client";

import { useEffect, useRef, useState } from "react";

// Prefix for public assets when the site is served from a subpath (GitHub Pages)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Light source in the source video, normalized to the video frame (measured on 3840x2160)
const LIGHT_SOURCES = {
  rooftop: { x: 0.93, y: 0.811, r: 0.005 }, // projector on the right rooftop
  tower: { x: 0.5974, y: 0.6102, r: 0.0025 }, // spire tip in the distance
  middle: { x: 0.7349, y: 0.663, r: 0.0025 }, // gothic tower in the middle of the skyline
  deep: { x: 0.7771, y: 0.6079, r: 0.0018 }, // far tower behind the middle one
};
const LENS = LIGHT_SOURCES.deep;

// Cone spread: spot radius grows by this many px per px of distance from the lens
const BEAM_SPREAD = 0.09;
const MIN_SPOT_RADIUS = 66;

// Heavy projector head: the spot follows the cursor with inertia
const FOLLOW = 0.12;

// Beam is soft, so it is rendered at reduced resolution
const BEAM_SCALE = 0.5;

// Aiming close to the lens means the projector faces the viewer: the cone can't
// open wider than this, and the beam fades out as the spot covers the source
const MAX_BEAM_HALF_ANGLE = 0.2; // rad
const BEAM_FADE_NEAR = 0.8; // beam gone when spot center is this many spot radii from the lens
const BEAM_FADE_FAR = 2.5; // full beam from this many spot radii

// Cap for the canvas pixel ratio: 3x screens would cost a lot for no visible gain
const MAX_DPR = 2;

const LIGHT_RGB = "225, 235, 255";

// Stencil on the lens: its silhouette is cast as a shadow inside the spot
const BAT_LOGO_SRC = `${BASE_PATH}/images/bat-logo.svg`;
const BAT_SIZE = 1.25; // logo width relative to the spot radius
const BAT_SHADOW = 0.35; // how much light the stencil blocks
const BAT_BLUR = 0.03; // edge softness relative to the logo width (projection is never razor-sharp)
const BAT_STENCIL_WIDTH = 512; // resolution of the pre-blurred stencil

// Arc lamp switching (ms): it strikes with a few flashes and warms up,
// goes dark fast on shutdown, while the lens keeps glowing as it cools
const WARM_UP_MS = 600;
const SHUT_DOWN_MS = 200;
const LENS_COOL_MS = 1000;
const STRIKE_FLASHES: [until: number, level: number][] = [
  [70, 1],
  [140, 0.15],
  [190, 0.8],
  [270, 0.3],
];

// Texts in "luminous paint": invisible until the beam sweeps over them. Wherever the spot
// passes, the glyphs glow white-hot, hold the light for a while, then fade out.
// Hero headline across the sky
const HERO_TEXT = "GOTHAM";
const HERO_WIDTH = 0.612; // of the viewport width
const HERO_MAX_HEIGHT = 0.204; // cap on the letter height, of the viewport height
const HERO_CENTER_Y = 0.34; // of the viewport height
const HERO_TRACKING = 0.12; // letter spacing, em
const HERO_WEIGHT = 700;
// Signature stacked in a column on the right
const SIDE_TEXT = "YUNKOV";
const SIDE_SIZE = 0.05; // font size, of the viewport height
const SIDE_MAX_SIZE = 0.07; // cap on the font size, of the viewport width (narrow screens)
const SIDE_LINE_HEIGHT = 1.25; // em
const SIDE_CENTER_Y = 0.55; // of the viewport height
const GLOW_HALO_BLUR = 0.08; // of the font size
const GLOW_HALO_STRENGTH = 0.6;
const GLOW_REACH = 0.9; // painted radius, of the spot radius
const GLOW_HOLD_MS = 2500;
const GLOW_FADE_MS = 1500;
const GLOW_MASK_SCALE = 0.5; // the paint mask is soft, so it is kept at reduced resolution

const NAV_LINKS = ["Gotham", "Arsenal", "Allies", "Signal"];

// The nav logo is hidden until the beam finds it; once found it stays
const LOGO_REVEAL_REACH = 0.8; // spot center within this many spot radii of the logo

// Where the beam has been: each mark keeps the glyphs under it lit until it expires
type GlowMark = { x: number; y: number; r: number; t: number };

type Box = { x: number; y: number; w: number; h: number };
// A glyph and its pen position inside the text's box, CSS px
type Glyph = { char: string; x: number; baseline: number };
// One painted text, cropped to its box: prerendered glyphs, the beam's paint mask, their product
type GlowText = {
  box: Box; // incl. halo padding, CSS px
  glyphs: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  glow: HTMLCanvasElement;
};

const smoothstep = (v: number) => v * v * (3 - 2 * v);

export default function BatSignalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false); // first video frame drawn: start the intro
  const [logoFound, setLogoFound] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  const batMask = `url(${BAT_LOGO_SRC})`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen layers: light video masked by the spot, and the volumetric beam
    const spotCanvas = document.createElement("canvas");
    const spotCtx = spotCanvas.getContext("2d");
    const beamCanvas = document.createElement("canvas");
    const beamCtx = beamCanvas.getContext("2d");
    if (!spotCtx || !beamCtx) return;

    // Layout is in CSS px; the video layers are backed at device resolution so Retina
    // screens get the full video detail instead of an upscaled 1x canvas
    let W = 0;
    let H = 0;
    let dpr = 1;

    // next/font exposes the generated family name through a CSS variable
    const heroFamily =
      getComputedStyle(document.documentElement).getPropertyValue("--font-cinzel").trim() ||
      "serif";
    const createGlowText = (): GlowText => ({
      box: { x: 0, y: 0, w: 0, h: 0 },
      glyphs: document.createElement("canvas"),
      mask: document.createElement("canvas"),
      glow: document.createElement("canvas"),
    });
    const hero = createGlowText();
    const side = createGlowText();
    const glowTexts = [hero, side];
    let glowMarks: GlowMark[] = [];
    const font = (size: number) => `${HERO_WEIGHT} ${size}px ${heroFamily}`;

    // Prerenders white glyphs over a blurred halo, on black, so the paint mask can simply
    // be multiplied in. Drawn in device px: shadowBlur ignores transforms.
    const prerender = (item: GlowText, glyphs: Glyph[], size: number) => {
      const { box } = item;
      item.glyphs.width = item.glow.width = Math.ceil(box.w * dpr);
      item.glyphs.height = item.glow.height = Math.ceil(box.h * dpr);
      item.mask.width = Math.ceil(box.w * GLOW_MASK_SCALE);
      item.mask.height = Math.ceil(box.h * GLOW_MASK_SCALE);
      const c = item.glyphs.getContext("2d");
      if (!c) return;
      const drawGlyphs = (offsetX: number) => {
        for (const g of glyphs) c.fillText(g.char, g.x * dpr + offsetX, g.baseline * dpr);
      };
      c.fillStyle = "#000";
      c.fillRect(0, 0, item.glyphs.width, item.glyphs.height);
      c.font = font(size * dpr);
      c.fillStyle = "#fff";
      // Halo: glyphs off-canvas, only their blurred shadow lands
      c.shadowColor = `rgba(${LIGHT_RGB}, ${GLOW_HALO_STRENGTH})`;
      c.shadowBlur = size * GLOW_HALO_BLUR * dpr;
      c.shadowOffsetX = item.glyphs.width;
      drawGlyphs(-item.glyphs.width);
      c.shadowColor = "transparent";
      drawGlyphs(0);
    };

    // Headline fitted to the sky, centered
    const layoutHero = () => {
      const chars = HERO_TEXT.split("");
      ctx.font = font(100);
      const metrics = chars.map((c) => ctx.measureText(c));
      const word = ctx.measureText(HERO_TEXT);
      const tracking = 100 * HERO_TRACKING;
      const advance = metrics.reduce((sum, m) => sum + m.width, 0) + tracking * (chars.length - 1);
      const inkHeight = word.actualBoundingBoxAscent + word.actualBoundingBoxDescent;
      const k = Math.min((W * HERO_WIDTH) / advance, (H * HERO_MAX_HEIGHT) / inkHeight);
      const size = 100 * k;
      const pad = Math.ceil(size * GLOW_HALO_BLUR * 2.5);

      hero.box.w = advance * k + pad * 2;
      hero.box.h = inkHeight * k + pad * 2;
      hero.box.x = (W - hero.box.w) / 2;
      hero.box.y = H * HERO_CENTER_Y - hero.box.h / 2;

      const baseline = pad + word.actualBoundingBoxAscent * k;
      let x = pad;
      const glyphs = chars.map((char, i) => {
        const g = { char, x, baseline };
        x += (metrics[i].width + tracking) * k;
        return g;
      });
      prerender(hero, glyphs, size);
    };

    // Signature stacked letter by letter, aligned with the header's right edge
    const layoutSide = () => {
      const chars = SIDE_TEXT.split("");
      const size = Math.min(H * SIDE_SIZE, W * SIDE_MAX_SIZE);
      ctx.font = font(size);
      const metrics = chars.map((c) => ctx.measureText(c));
      const ascent = ctx.measureText(SIDE_TEXT).actualBoundingBoxAscent;
      const lineHeight = size * SIDE_LINE_HEIGHT;
      const columnW = Math.max(...metrics.map((m) => m.width));
      const columnH = lineHeight * (chars.length - 1) + ascent;
      const pad = Math.ceil(size * GLOW_HALO_BLUR * 2.5);
      const margin = W >= 640 ? 40 : 24; // matches the header padding

      side.box.w = columnW + pad * 2;
      side.box.h = columnH + pad * 2;
      side.box.x = W - margin - columnW - pad;
      side.box.y = H * SIDE_CENTER_Y - side.box.h / 2;

      const glyphs = chars.map((char, i) => ({
        char,
        x: pad + (columnW - metrics[i].width) / 2,
        baseline: pad + ascent + lineHeight * i,
      }));
      prerender(side, glyphs, size);
    };

    let logoRect: DOMRect | null = null;
    let logoRevealed = false;
    let sceneShown = false;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = spotCanvas.width = Math.round(W * dpr);
      canvas.height = spotCanvas.height = Math.round(H * dpr);
      beamCanvas.width = Math.ceil(W * BEAM_SCALE);
      beamCanvas.height = Math.ceil(H * BEAM_SCALE);
      // Resizing resets context state
      ctx.imageSmoothingQuality = spotCtx.imageSmoothingQuality = "high";
      layoutHero();
      layoutSide();
      logoRect = logoRef.current?.getBoundingClientRect() ?? null;
    };
    resize();
    let disposed = false;
    // Re-fit once the web font is in, the first layout may have used the fallback
    document.fonts
      .load(`${HERO_WEIGHT} 100px ${heroFamily}`)
      .then(() => !disposed && resize())
      .catch(() => {});

    const createVideo = (src: string, label: string) => {
      const video = document.createElement("video");
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.onerror = () => console.error(`${label} video failed to load`);
      video.onloadedmetadata = () => {
        video.play().catch((e) => console.error(`${label} video play error:`, e));
      };
      video.src = src;
      return video;
    };

    const nightVideo = createVideo(`${BASE_PATH}/images/base.mp4`, "Night");
    const lightVideo = createVideo(`${BASE_PATH}/images/light-new.mp4`, "Light");

    // Blurred stencil is rendered once. shadowBlur works in every browser (ctx.filter
    // does not in Safari): the logo is drawn off-canvas and only its blurred shadow lands.
    let batStencil: HTMLCanvasElement | null = null;
    const batLogo = new Image();
    batLogo.onload = () => {
      const w = BAT_STENCIL_WIDTH;
      const h = Math.round((w * batLogo.naturalHeight) / batLogo.naturalWidth);
      const blur = w * BAT_BLUR;
      const pad = Math.ceil(blur * 2);
      const stencil = document.createElement("canvas");
      stencil.width = w + pad * 2;
      stencil.height = h + pad * 2;
      const stencilCtx = stencil.getContext("2d");
      if (!stencilCtx) return;
      stencilCtx.shadowColor = "#000";
      stencilCtx.shadowBlur = blur;
      stencilCtx.shadowOffsetX = stencil.width;
      stencilCtx.drawImage(batLogo, pad - stencil.width, pad, w, h);
      batStencil = stencil;
    };
    batLogo.src = BAT_LOGO_SRC;

    let mouseX = W * 0.35;
    let mouseY = H * 0.3;
    let spotX = mouseX;
    let spotY = mouseY;

    const handlePointerMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    let lightOn = true;
    let power = 1; // lamp output, 0..1
    let lensHeat = 1; // lens glow, cools slower than the lamp
    let switchedOnAt = -Infinity;
    let lastTime = 0;

    const handleClick = () => {
      lightOn = !lightOn;
      if (lightOn) switchedOnAt = performance.now();
    };

    // "object-fit: cover" rect, so the lens position stays tied to the video
    const getCoverRect = () => {
      const vw = lightVideo.videoWidth || 3840;
      const vh = lightVideo.videoHeight || 2160;
      const scale = Math.max(W / vw, H / vh);
      const w = vw * scale;
      const h = vh * scale;
      return { x: (W - w) / 2, y: (H - h) / 2, w, h };
    };

    let rafId = 0;

    const drawFrame = (time: number) => {
      rafId = requestAnimationFrame(drawFrame);
      const dt = Math.min(time - lastTime, 100);
      lastTime = time;
      if (nightVideo.readyState < 2 || lightVideo.readyState < 2) return;
      if (!sceneShown) {
        sceneShown = true;
        setSceneReady(true);
      }

      if (lightOn) {
        power = Math.min(1, power + dt / WARM_UP_MS);
        lensHeat = Math.max(lensHeat, power);
      } else {
        power = Math.max(0, power - dt / SHUT_DOWN_MS);
        lensHeat = Math.max(0, lensHeat - dt / LENS_COOL_MS);
      }
      const sinceOn = time - switchedOnAt;
      const strike = STRIKE_FLASHES.find(([until]) => sinceOn < until)?.[1] ?? 1;
      const light = (1 - (1 - power) ** 3) * strike;
      const lensLight = Math.max(light, lensHeat * lensHeat);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spotCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cover = getCoverRect();

      spotX += (mouseX - spotX) * FOLLOW;
      spotY += (mouseY - spotY) * FOLLOW;

      const lensX = cover.x + LENS.x * cover.w;
      const lensY = cover.y + LENS.y * cover.h;
      const lensR = LENS.r * cover.w;

      const dx = spotX - lensX;
      const dy = spotY - lensY;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const angle = Math.atan2(dy, dx);

      // Spot is the cone cross-section at the target; it stretches along the beam
      // as the hit gets more oblique (farther from the projector)
      const spotR = Math.max(MIN_SPOT_RADIUS, lensR + dist * BEAM_SPREAD);
      const stretch = 1 + 0.3 * Math.min(dist / Math.hypot(W, H), 1);

      // Slight lamp flicker
      const flicker = 0.96 + 0.04 * Math.sin(time * 0.013) * Math.sin(time * 0.0071);

      // Casts the stencil silhouette onto a light layer. The logo stays upright
      // and is skewed by the same oblique stretch as the spot.
      // "destination-out" cuts it out (beam), "source-atop" darkens it in place (spot).
      const castBatShadow = (c: CanvasRenderingContext2D, op: GlobalCompositeOperation) => {
        if (!batStencil) return;
        const k = (spotR * BAT_SIZE) / BAT_STENCIL_WIDTH;
        const w = batStencil.width * k;
        const h = batStencil.height * k;
        c.save();
        c.globalCompositeOperation = op;
        c.globalAlpha = BAT_SHADOW;
        c.translate(spotX, spotY);
        c.rotate(angle);
        c.scale(stretch, 1);
        c.rotate(-angle);
        c.drawImage(batStencil, -w / 2, -h / 2, w, h);
        c.restore();
      };

      // Headline paint: while lit, the spot leaves a mark wherever it touches the headline.
      // A spot resting in place refreshes its last mark instead of piling up new ones.
      if (!logoRevealed && logoRect && light > 0.5) {
        const nearestX = Math.min(Math.max(spotX, logoRect.left), logoRect.right);
        const nearestY = Math.min(Math.max(spotY, logoRect.top), logoRect.bottom);
        if (Math.hypot(spotX - nearestX, spotY - nearestY) < spotR * LOGO_REVEAL_REACH) {
          logoRevealed = true;
          setLogoFound(true);
        }
      }

      const markR = spotR * GLOW_REACH;
      const overlaps = (box: Box, x: number, y: number, r: number) =>
        x + r > box.x && x - r < box.x + box.w && y + r > box.y && y - r < box.y + box.h;
      if (light > 0.5 && glowTexts.some((t) => overlaps(t.box, spotX, spotY, markR))) {
        const last = glowMarks[glowMarks.length - 1];
        if (last && Math.hypot(spotX - last.x, spotY - last.y) < markR * 0.1) {
          last.t = time;
          last.r = markR;
        } else {
          glowMarks.push({ x: spotX, y: spotY, r: markR, t: time });
        }
      }
      glowMarks = glowMarks.filter((m) => time - m.t < GLOW_HOLD_MS + GLOW_FADE_MS);

      // Glyphs x paint mask, added on top as light
      const drawGlowText = (item: GlowText) => {
        const { box } = item;
        const marks = glowMarks.filter((m) => overlaps(box, m.x, m.y, m.r));
        if (marks.length === 0) return;
        const maskCtx = item.mask.getContext("2d");
        const glowCtx = item.glow.getContext("2d");
        if (!maskCtx || !glowCtx) return;
        // Grayscale mask, max-combined ("lighten" over opaque black) so overlapping marks
        // don't add up and each one fades on its own schedule
        maskCtx.setTransform(1, 0, 0, 1, 0, 0);
        maskCtx.globalCompositeOperation = "source-over";
        maskCtx.fillStyle = "#000";
        maskCtx.fillRect(0, 0, item.mask.width, item.mask.height);
        maskCtx.setTransform(
          GLOW_MASK_SCALE,
          0,
          0,
          GLOW_MASK_SCALE,
          -box.x * GLOW_MASK_SCALE,
          -box.y * GLOW_MASK_SCALE,
        );
        maskCtx.globalCompositeOperation = "lighten";
        for (const m of marks) {
          const age = time - m.t;
          const level = age < GLOW_HOLD_MS ? 1 : 1 - smoothstep((age - GLOW_HOLD_MS) / GLOW_FADE_MS);
          const v = Math.round(255 * level);
          const g = maskCtx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
          g.addColorStop(0, `rgb(${v},${v},${v})`);
          g.addColorStop(0.55, `rgb(${v},${v},${v})`);
          g.addColorStop(1, "#000");
          maskCtx.fillStyle = g;
          maskCtx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        }

        glowCtx.globalCompositeOperation = "source-over";
        glowCtx.drawImage(item.glyphs, 0, 0);
        glowCtx.globalCompositeOperation = "multiply";
        glowCtx.drawImage(item.mask, 0, 0, item.glow.width, item.glow.height);

        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 1;
        ctx.drawImage(item.glow, box.x, box.y, box.w, box.h);
        ctx.globalCompositeOperation = "source-over";
      };
      const drawGlowTexts = () => glowTexts.forEach(drawGlowText);

      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(nightVideo, cover.x, cover.y, cover.w, cover.h);
      if (lensLight <= 0.001) {
        drawGlowTexts();
        return;
      }

      // 1. Volumetric beam: a cone from the lens to the spot, lit fog in the air
      const halfAngle = Math.min(Math.atan2(spotR - lensR, dist), MAX_BEAM_HALF_ANGLE);
      const apexBack = lensR / Math.tan(halfAngle); // virtual cone apex behind the lens
      const feather = halfAngle * 1.5;
      const span = feather / Math.PI; // 2 * feather as a fraction of a full turn
      const beamLength = dist + spotR * stretch;

      beamCtx.setTransform(1, 0, 0, 1, 0, 0);
      beamCtx.globalCompositeOperation = "source-over";
      beamCtx.clearRect(0, 0, beamCanvas.width, beamCanvas.height);
      beamCtx.setTransform(BEAM_SCALE, 0, 0, BEAM_SCALE, 0, 0);
      beamCtx.translate(lensX, lensY);
      beamCtx.rotate(angle);

      const cone = beamCtx.createConicGradient(-feather, -apexBack, 0);
      cone.addColorStop(0, `rgba(${LIGHT_RGB}, 0)`);
      cone.addColorStop(span * 0.2, `rgba(${LIGHT_RGB}, 0.18)`);
      cone.addColorStop(span * 0.5, `rgba(${LIGHT_RGB}, 0.6)`);
      cone.addColorStop(span * 0.8, `rgba(${LIGHT_RGB}, 0.18)`);
      cone.addColorStop(span, `rgba(${LIGHT_RGB}, 0)`);
      cone.addColorStop(1, `rgba(${LIGHT_RGB}, 0)`);
      const coneHalfWidth = spotR * stretch * 2;
      beamCtx.fillStyle = cone;
      beamCtx.fillRect(0, -coneHalfWidth, beamLength, coneHalfWidth * 2);

      // Fade with distance: brightest at the lens, dimmer where it spreads out
      const fade = beamCtx.createLinearGradient(0, 0, beamLength, 0);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(dist / beamLength, "rgba(0,0,0,0.45)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      beamCtx.globalCompositeOperation = "destination-in";
      beamCtx.fillStyle = fade;
      beamCtx.fillRect(0, -coneHalfWidth, beamLength, coneHalfWidth * 2);

      // Keep the fog at the target from washing out the stencil shadow
      beamCtx.setTransform(BEAM_SCALE, 0, 0, BEAM_SCALE, 0, 0);
      castBatShadow(beamCtx, "destination-out");

      ctx.globalCompositeOperation = "screen";
      const nearT = Math.min(
        Math.max((dist / spotR - BEAM_FADE_NEAR) / (BEAM_FADE_FAR - BEAM_FADE_NEAR), 0),
        1,
      );
      const beamVisibility = nearT * nearT * (3 - 2 * nearT);
      ctx.globalAlpha = flicker * light * beamVisibility;
      ctx.drawImage(beamCanvas, 0, 0, W, H);

      // 2. Spot: reveal the lit video through a soft elliptical mask. Inside the light
      // only the lit layer is shown: any partial transparency would let the night video
      // (animated differently) bleed through as a ghost image.
      spotCtx.globalCompositeOperation = "source-over";
      spotCtx.clearRect(0, 0, W, H);
      spotCtx.save();
      spotCtx.translate(spotX, spotY);
      spotCtx.rotate(angle);
      spotCtx.scale(stretch, 1);
      const mask = spotCtx.createRadialGradient(0, 0, 0, 0, 0, spotR);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(0.7, "rgba(0,0,0,1)");
      mask.addColorStop(0.9, "rgba(0,0,0,0.45)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      spotCtx.fillStyle = mask;
      spotCtx.fillRect(-spotR, -spotR, spotR * 2, spotR * 2);
      spotCtx.restore();
      spotCtx.globalCompositeOperation = "source-in";
      spotCtx.drawImage(lightVideo, cover.x, cover.y, cover.w, cover.h);

      // Spot glow, only where the light actually lands
      spotCtx.save();
      spotCtx.globalCompositeOperation = "source-atop";
      spotCtx.translate(spotX, spotY);
      spotCtx.rotate(angle);
      spotCtx.scale(stretch, 1);
      const glow = spotCtx.createRadialGradient(0, 0, 0, 0, 0, spotR);
      glow.addColorStop(0, `rgba(${LIGHT_RGB}, 0.32)`);
      glow.addColorStop(0.6, `rgba(${LIGHT_RGB}, 0.2)`);
      glow.addColorStop(0.85, `rgba(${LIGHT_RGB}, 0.12)`);
      glow.addColorStop(1, `rgba(${LIGHT_RGB}, 0)`);
      spotCtx.fillStyle = glow;
      spotCtx.fillRect(-spotR, -spotR, spotR * 2, spotR * 2);
      spotCtx.restore();

      // Stencil darkens the lit layer instead of exposing the night one under it
      castBatShadow(spotCtx, "source-atop");

      // No flicker on the spot alpha, for the same ghosting reason
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = light;
      ctx.drawImage(spotCanvas, 0, 0, W, H);

      // Emissive, so it glows over the beam and the spot
      drawGlowTexts();

      // 3. Hot lens
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = flicker * lensLight;
      const lensGlowR = lensR * 7;
      const lensGlow = ctx.createRadialGradient(lensX, lensY, 0, lensX, lensY, lensGlowR);
      lensGlow.addColorStop(0, "rgba(255,255,255,1)");
      lensGlow.addColorStop(0.15, `rgba(${LIGHT_RGB}, 0.75)`);
      lensGlow.addColorStop(0.4, `rgba(${LIGHT_RGB}, 0.18)`);
      lensGlow.addColorStop(1, `rgba(${LIGHT_RGB}, 0)`);
      ctx.fillStyle = lensGlow;
      ctx.fillRect(lensX - lensGlowR, lensY - lensGlowR, lensGlowR * 2, lensGlowR * 2);

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    rafId = requestAnimationFrame(drawFrame);
    window.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("click", handleClick);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("resize", resize);
      for (const video of [nightVideo, lightVideo]) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full cursor-pointer transition-opacity duration-[1500ms] ease-out ${
          sceneReady ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Keeps the nav legible over bright clouds */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/60 to-transparent transition-opacity delay-500 duration-1000 ${
          sceneReady ? "opacity-100" : "opacity-0"
        }`}
      />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        {/* Wrapper carries the glow: a mask would clip a filter on the masked element */}
        <a
          ref={logoRef}
          href="#"
          aria-label="Home"
          tabIndex={logoFound ? 0 : -1}
          className={`group block ${logoFound ? "animate-logo-reveal" : "pointer-events-none opacity-0"}`}
        >
          <span
            className="block h-5 w-11 bg-slate-100/85 transition-colors group-hover:bg-white"
            style={{
              maskImage: batMask,
              WebkitMaskImage: batMask,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
          />
        </a>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex">
          {NAV_LINKS.map((label, i) => (
            // Intro lives on a wrapper so its delay doesn't slow down the hover
            <span
              key={label}
              className={`transition-all duration-700 ease-out ${
                sceneReady ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
              }`}
              style={{ transitionDelay: `${800 + i * 90}ms` }}
            >
              <a
                href={`#${label.toLowerCase()}`}
                className="font-sans text-[11px] uppercase tracking-[0.32em] text-slate-300/70 transition-colors hover:text-white"
              >
                {label}
              </a>
            </span>
          ))}
        </nav>

        <div
          className={`transition-all delay-[1200ms] duration-700 ease-out ${
            sceneReady ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="group relative -mr-2 h-10 w-10 cursor-pointer"
          >
            <span
              className={`absolute left-2 right-2 h-px bg-slate-100/85 transition-all duration-300 group-hover:bg-white ${
                menuOpen ? "top-1/2 rotate-45" : "top-[15px]"
              }`}
            />
            <span
              className={`absolute right-2 h-px bg-slate-100/85 transition-all duration-300 group-hover:bg-white ${
                menuOpen ? "left-2 top-1/2 -rotate-45" : "left-4 top-[24px] group-hover:left-2"
              }`}
            />
          </button>
        </div>
      </header>

      {/* Fullscreen menu */}
      <div
        className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/75 backdrop-blur-md transition-opacity duration-500 ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      >
        {NAV_LINKS.map((label, i) => (
          <a
            key={label}
            href={`#${label.toLowerCase()}`}
            className={`font-heading text-4xl uppercase tracking-[0.18em] text-slate-200 transition-all duration-500 hover:text-white sm:text-6xl ${
              menuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
            style={{ transitionDelay: menuOpen ? `${150 + i * 70}ms` : "0ms" }}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
