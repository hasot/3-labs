"use client";

import { useEffect, useRef } from "react";

// Prefix for public assets when the site is served from a subpath (GitHub Pages)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Projector lens in the source video, normalized to the video frame (measured on 3840x2160)
const LENS = { x: 0.93, y: 0.811, r: 0.005 };

// Cone spread: spot radius grows by this many px per px of distance from the lens
const BEAM_SPREAD = 0.075;
const MIN_SPOT_RADIUS = 55;

// Heavy projector head: the spot follows the cursor with inertia
const FOLLOW = 0.12;

// Beam is soft, so it is rendered at reduced resolution
const BEAM_SCALE = 0.5;

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

export default function BatSignalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    };
    resize();

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

      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(nightVideo, cover.x, cover.y, cover.w, cover.h);
      if (lensLight <= 0.001) return;

      // 1. Volumetric beam: a cone from the lens to the spot, lit fog in the air
      const halfAngle = Math.atan2(spotR - lensR, dist);
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
      ctx.globalAlpha = flicker * light;
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
        className="absolute inset-0 w-full h-full cursor-pointer"
      />
    </div>
  );
}
