"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DISPLAY_LIB, MAX_STEPS, createBrush, createFluid } from "../ink-flow/fluid";

// A close-up of the head, wrapped in thick smoke that never stops: puffs are
// released all over the crown and the back of the head, rise, curl and drift
// off behind it. The smoke is the InkFlow fluid from ../ink-flow/fluid.ts; the
// cursor stirs it

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PHOTO_SRC = `${BASE_PATH}/images/beam-light.webp`;
// Silhouette of the figure, white on black
const MASK_SRC = `${BASE_PATH}/images/beam-mask.png`;

const MAX_DPR = 2;
const MAX_DT = 0.033;

// Close-up: the photo rows from VIEW_TOP to VIEW_BOTTOM (0..1, y down) fill the
// screen height, which leaves just the head and the neck
const VIEW_TOP = 0.085;
const VIEW_BOTTOM = 0.47;
// Head in photo coordinates: its centre, and where it sits across the screen
const HEAD = { x: 0.73, y: 0.23 };
const HEAD_ON_SCREEN = 0.5;
// The close-up shrunk a little, so there is some air around the head
const ZOOM = 0.9;

// Where the smoke comes from, in photo coordinates: an ellipse over the crown and
// the back of the head, minus the face
const SOURCE = { x: 0.76, y: 0.2, rx: 0.15, ry: 0.11 };
const FACE = { right: 0.72, top: 0.225 };
// The smoke drifts back and up (screen y is up here)
const DRIFT = normalize(0.75, 1);

// Roughly this many sim cells over the screen, whatever its shape
const GRID_CELLS = 576 * 360;
// Puffs per second, their size (share of the screen height) and the dye they carry
const EMIT_RATE = 260;
const EMIT_RADIUS = 0.022;
const PUFF = 0.4;
// How hard a puff is thrown along DRIFT, and how much its aim wanders, cells/s
const EMIT_SPEED = 18;
const EMIT_JITTER = 26;
// Smoke rises: push per unit of density, cells/s², screen y up
const BUOYANCY: [number, number] = [12, 40];
const CURL = 30;
const VEL_FADE = 0.3;
const DYE_FADE = 0.3;
// How the dye reads on screen: thickness, the most it ever covers, brightness
const SMOKE_GAIN = 1.8;
const SMOKE_MAX = 0.95;
const SMOKE_BRIGHT = 1.1;
// Smoke tint: warm where the rim light catches it, cool grey elsewhere
const COLORS = ["#efdcca", "#a9b3c6", "#f2bd8e"];

// The cursor stirs the smoke without adding any
const STIR_RADIUS = 0.035;
const STIR_FORCE = 0.12;

function normalize(x: number, y: number) {
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// The photo's own left and right edge columns, squeezed into a 2-px strip, so the
// navy backdrop carries on past the photo across the whole screen
function edgeStrip(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const strip = img.width * 0.04;
  ctx.drawImage(img, 0, 0, strip, img.height, 0, 0, 1, c.height);
  ctx.drawImage(img, img.width - strip, 0, strip, img.height, 1, 0, 1, c.height);
  return c;
}

// A random point of the smoke source, in photo coordinates
function sourcePoint() {
  for (;;) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random());
    const u = SOURCE.x + Math.cos(a) * r * SOURCE.rx;
    const v = SOURCE.y + Math.sin(a) * r * SOURCE.ry;
    if (!(u < FACE.right && v > FACE.top)) return { u, v };
  }
}

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uDye;
uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform sampler2D uEdge;
uniform vec2 uRes;
uniform vec4 uImg;   // x, y, w, h of the photo in device px, y down
out vec4 outColor;
${DISPLAY_LIB}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 pos = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 iuv = (pos - uImg.xy) / uImg.zw;
  vec2 tuv = vec2(iuv.x, 1.0 - iuv.y);
  bool inside = iuv.x >= 0.0 && iuv.x <= 1.0;
  float fig = inside ? texture(uMask, tuv).r : 0.0;

  // Photo faded on both sides into its own edge columns
  vec3 leftEdge = toLinear(texture(uEdge, vec2(0.25, tuv.y)).rgb);
  vec3 rightEdge = toLinear(texture(uEdge, vec2(0.75, tuv.y)).rgb);
  vec3 edge = mix(leftEdge, rightEdge, step(0.5, iuv.x));
  float inPhoto = smoothstep(0.0, 0.22, iuv.x) * (1.0 - smoothstep(0.95, 1.0, iuv.x) * (1.0 - fig));
  vec3 photo = toLinear(texture(uPhoto, tuv).rgb);
  vec3 base = mix(edge, photo, inside ? inPhoto : 0.0);

  // Smoke on top, grained like the shaders.com Stone filter
  vec3 st = stone(uv, uRes);
  vec3 dye = texture(uDye, st.xy).rgb;
  float peak = max(dye.r, max(dye.g, dye.b));
  float a = clamp(peak * ${SMOKE_GAIN.toFixed(2)}, 0.0, 1.0) * ${SMOKE_MAX.toFixed(2)};
  vec3 smoke = dye / max(peak, 1e-4) * ${SMOKE_BRIGHT.toFixed(2)} * mix(1.0, st.z, 0.4);
  outColor = vec4(toSrgb(mix(base, smoke, a)), 1.0);
}
`;

export function HeadSmoke() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      setFailed(true);
      return;
    }

    // Square-ish cells: the grid takes the screen's shape
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    const gh = Math.round(Math.sqrt(GRID_CELLS / aspect));
    const gw = Math.round(gh * aspect);
    const fluid = createFluid(gl, gw, gh);
    const display = fluid.program(DISPLAY_FS);
    const brush = createBrush(COLORS, 0.004, 0.03);

    const texture = (source: TexImageSource) => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return tex;
    };

    // Photo rect in device px: the close-up rows fill the height, unless the screen
    // is too narrow for the head, then its width (photo columns 0.55–0.95) decides
    const img = { x: 0, y: 0, w: 1, h: 1, aspect: 1 };
    const layout = () => {
      img.h = Math.min(canvas.height / (VIEW_BOTTOM - VIEW_TOP), canvas.width / (0.4 * img.aspect)) * ZOOM;
      img.w = img.h * img.aspect;
      img.y = canvas.height / 2 - img.h * ((VIEW_TOP + VIEW_BOTTOM) / 2);
      const across = canvas.width > canvas.height ? HEAD_ON_SCREEN : 0.5;
      img.x = canvas.width * across - img.w * HEAD.x;
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      layout();
    };

    // Pointer in 0..1 of the canvas, y up like the grid
    let pointer: { x: number; y: number } | null = null;
    let prev: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    };
    const onDown = (e: PointerEvent) => {
      onMove(e);
      prev = pointer;
    };

    const posArr = new Float32Array(MAX_STEPS * 2);
    const impArr = new Float32Array(MAX_STEPS * 2);
    const colArr = new Float32Array(MAX_STEPS * 3);

    // The cursor's path since the last frame pushes the smoke along with it
    const stir = (dt: number) => {
      if (!pointer) return;
      if (!prev) prev = pointer;
      const dx = pointer.x - prev.x;
      const dy = pointer.y - prev.y;
      const from = prev;
      prev = pointer;
      const dist = Math.hypot(dx, dy);
      if (dist < 6e-4 || dist > 0.25) return;
      const steps = Math.min(MAX_STEPS, Math.ceil(dist / 0.01));
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;
        posArr[s * 2] = (from.x + dx * t) * gw;
        posArr[s * 2 + 1] = (from.y + dy * t) * gh;
      }
      const k = STIR_FORCE / Math.max(dt, 0.001);
      fluid.splat(posArr, steps, STIR_RADIUS * gh, [dx * gw * k, dy * gh * k]);
    };

    let owed = 0;
    // Puffs from random points over the head, thrown back and up
    const emit = (dt: number) => {
      owed += EMIT_RATE * dt;
      while (owed >= 1) {
        const count = Math.min(MAX_STEPS, Math.floor(owed));
        owed -= count;
        for (let i = 0; i < count; i++) {
          const p = sourcePoint();
          const px = img.x + p.u * img.w;
          const py = img.y + p.v * img.h;
          posArr[i * 2] = (px / canvas.width) * gw;
          posArr[i * 2 + 1] = (1 - py / canvas.height) * gh;
          const angle = Math.random() * Math.PI * 2;
          impArr[i * 2] = DRIFT.x * EMIT_SPEED + Math.cos(angle) * EMIT_JITTER;
          impArr[i * 2 + 1] = DRIFT.y * EMIT_SPEED + Math.sin(angle) * EMIT_JITTER;
          const c = brush.next();
          colArr.set([c[0] * PUFF, c[1] * PUFF, c[2] * PUFF], i * 3);
        }
        fluid.splat(posArr, count, Math.max(EMIT_RADIUS * gh, 1), impArr, colArr);
      }
    };

    const step = (dt: number) => {
      brush.drift(dt);
      emit(dt);
      fluid.step(dt, { curl: CURL, buoyancy: BUOYANCY, velFade: VEL_FADE, dyeFade: DYE_FADE });
    };

    let photoTex: WebGLTexture | null = null;
    let maskTex: WebGLTexture | null = null;
    let edgeTex: WebGLTexture | null = null;
    const draw = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(display.p);
      fluid.bindTex(0, display.u("uDye"), fluid.dye());
      fluid.bindTex(1, display.u("uPhoto"), photoTex!);
      fluid.bindTex(2, display.u("uMask"), maskTex!);
      fluid.bindTex(3, display.u("uEdge"), edgeTex!);
      gl.uniform2f(display.u("uRes"), canvas.width, canvas.height);
      gl.uniform4f(display.u("uImg"), img.x, img.y, img.w, img.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    let last = performance.now();
    let disposed = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      if (dt < 0.001) return;
      stir(dt);
      step(dt);
      draw();
    };

    Promise.all([loadImage(PHOTO_SRC), loadImage(MASK_SRC)]).then(([photo, mask]) => {
      if (disposed) return;
      img.aspect = photo.width / photo.height;
      photoTex = texture(photo);
      maskTex = texture(mask);
      edgeTex = texture(edgeStrip(photo));
      resize();
      // A few seconds of smoke already in the air, so it never starts from nothing
      for (let i = 0; i < 180; i++) step(1 / 60);
      setReady(true);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    });

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden bg-[#06101f] text-white select-none">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-[1500ms] ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/50 md:px-12 md:py-8">
        <span>Head Smoke</span>
        <Link href="/" className="pointer-events-auto transition-colors hover:text-white">
          Labs
        </Link>
      </header>

      {failed && (
        <p className="absolute inset-x-0 bottom-10 text-center font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/45">
          This browser has no WebGL2 float targets
        </p>
      )}
    </main>
  );
}
