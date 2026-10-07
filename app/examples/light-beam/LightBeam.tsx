"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DARK_SRC = `${BASE_PATH}/images/beam-dark.webp`;
const LIGHT_SRC = `${BASE_PATH}/images/beam-light.webp`;
// Silhouette of the figure (white on black), cut from the photos with GrabCut.
// The beam stops on it, so it lights the front of the body and leaves a shadow
const MASK_SRC = `${BASE_PATH}/images/beam-mask.png`;

const MAX_DPR = 2;
// Where the figure sits in the photo (0..1 of the image), used to aim the idle sweep
const FACE = { x: 0.6, y: 0.27 };
const CHEST = { x: 0.62, y: 0.5 };
// Beam core thickness (gaussian sigma) as a share of the screen height
const BEAM_WIDTH = 0.0095;
// How deep the light soaks into the body before it is fully blocked, share of height
const LIGHT_DEPTH = 0.13;
// The light source sits off screen to the left, its height partly follows the aim
const SOURCE_X = -0.18;
const SOURCE_Y = 0.36;
const SOURCE_FOLLOW = 0.82;
// Gap between the photo and the right edge of the screen, share of the width
const RIGHT_GAP = 0.07;
// Pointer smoothing, per second
const AIM_EASE = 7;
// Back to the idle sweep after this long without pointer movement, ms
const IDLE_AFTER = 4000;

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;
uniform sampler2D uDark;
uniform sampler2D uLight;
uniform sampler2D uMask;
uniform sampler2D uEdge;
uniform vec2 uRes;
uniform vec4 uImg;   // x, y, w, h of the photo in CSS px
uniform vec2 uSrc;   // light source, CSS px
uniform vec2 uDir;   // beam direction, normalized
uniform float uWidth;
uniform float uDepth;
uniform float uPower;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec2 imgUv(vec2 pos) {
  vec2 uv = (pos - uImg.xy) / uImg.zw;
  return vec2(uv.x, 1.0 - uv.y);
}

float maskAt(vec2 pos) {
  vec2 uv = (pos - uImg.xy) / uImg.zw;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uMask, vec2(uv.x, 1.0 - uv.y)).r;
}

void main() {
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 uv = imgUv(pos);

  // Photo, faded on both sides into a backdrop made from its own edge columns,
  // so the navy carries on across the whole screen. The right fade is narrow
  // (the figure stands close to that edge) and never eats into the figure
  float fig = maskAt(pos);
  vec3 leftEdge = texture2D(uEdge, vec2(0.25, uv.y)).rgb;
  vec3 rightEdge = texture2D(uEdge, vec2(0.75, uv.y)).rgb;
  float pastFig = 1.0 - fig;
  float toRight = smoothstep(0.95, 1.0, uv.x) * pastFig;
  vec3 edge = mix(leftEdge, rightEdge, step(0.5, uv.x));
  float inPhoto = smoothstep(0.0, 0.22, uv.x) * (1.0 - toRight);
  vec3 dark = mix(edge, texture2D(uDark, uv).rgb, inPhoto);
  vec3 light = mix(edge, texture2D(uLight, uv).rgb, inPhoto);

  // Beam coordinates: distance along the ray and across it
  vec2 rel = pos - uSrc;
  float along = dot(rel, uDir);
  float across = dot(rel, vec2(-uDir.y, uDir.x));
  // A touch wider near the source, tighter where it lands, like a focused beam
  float sigma = uWidth * mix(1.6, 0.85, smoothstep(0.0, uRes.x, along));
  float core = exp(-across * across / (2.0 * sigma * sigma));
  float halo = exp(-across * across / (2.0 * sigma * sigma * 16.0));
  float spill = exp(-across * across / (2.0 * sigma * sigma * 90.0));
  float beam = (core + halo * 0.35 + spill * 0.08) * step(0.0, along);

  vec3 col = dark;
  if (beam * uPower > 0.002) {
    // Walk back toward the source through the silhouette: whatever body lies in
    // between soaks the light up (Beer-Lambert), so only the near side is lit
    // and the wall behind the figure falls into shadow
    float reach = min(along, max(pos.x - uImg.x, 0.0) / max(uDir.x, 0.05));
    float trans = 1.0;
    if (reach > 1.0) {
      const int STEPS = 40;
      float stepLen = reach / float(STEPS);
      float jitter = hash(pos + fract(uTime)) * stepLen;
      float density = 0.0;
      for (int i = 0; i < STEPS; i++) {
        float s = jitter + float(i) * stepLen;
        density += maskAt(pos - uDir * s);
      }
      trans = exp(-density * stepLen * 3.0 / uDepth);
    }

    // Dust drifting along the ray
    float drift = along * 0.006 - uTime * 0.35;
    float dust = 0.7 + 0.45 * noise(vec2(drift, across * 0.04 + uTime * 0.1))
                     + 0.25 * noise(vec2(drift * 3.1, across * 0.15));
    // Fades in out of the dark on the left, like the reference shot
    float lead = smoothstep(-0.05, 0.45, along / uRes.x);

    // On the body the light spreads wider than the thin ray in the air, the way
    // a narrow beam still washes a whole face
    float onBody = core * 1.2 + halo * 0.8 + spill * 0.5;
    float inAir = core * 1.1 + halo * 0.45 + spill * 0.12;
    float lit = clamp(mix(inAir, onBody, fig) * trans, 0.0, 1.0) * uPower;
    // The warm photo comes through where the beam lands on the body
    vec3 warm = light * vec3(1.1, 1.0, 0.9) * 1.25;
    col = mix(col, warm, lit * (0.25 + 0.75 * fig));
    // Hot spot right where the ray meets the skin
    col += vec3(1.0, 0.6, 0.32) * core * fig * trans * trans * 0.18 * uPower;

    // Glow of the beam itself, hanging in the air; it hides behind the figure
    vec3 tint = vec3(1.0, 0.64, 0.36);
    float air = (core * 0.55 + halo * 0.14 + spill * 0.035) * dust * lead * trans * (1.0 - fig * 0.85);
    col += tint * air * uPower;
  }

  // Film grain over everything, so the backdrop and the photo read as one
  col += (hash(pos * 0.73 + uTime) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

function createTexture(gl: WebGLRenderingContext, source: TexImageSource) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return tex;
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

// Averaged colour of the photo's left and right strips, row by row (left in the
// first column, right in the second): the backdrop that continues the photo
// to the edges of the screen
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

export function LightBeam() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("uRes");
    const uImg = u("uImg");
    const uSrc = u("uSrc");
    const uDir = u("uDir");
    const uWidth = u("uWidth");
    const uDepth = u("uDepth");
    const uPower = u("uPower");
    const uTime = u("uTime");
    gl.uniform1i(u("uDark"), 0);
    gl.uniform1i(u("uLight"), 1);
    gl.uniform1i(u("uMask"), 2);
    gl.uniform1i(u("uEdge"), 3);

    // Photo rect in CSS px: full height, a little in from the right edge. On narrow
    // screens it is wider than the viewport, so it slides left to keep the figure
    // in frame
    const img = { x: 0, y: 0, w: 1, h: 1, aspect: 1 };
    let width = 0;
    let height = 0;
    const layout = () => {
      img.h = height;
      img.w = height * img.aspect;
      img.y = 0;
      img.x =
        width >= img.w
          ? width - img.w - Math.min(width * RIGHT_GAP, width - img.w)
          : Math.min(0, Math.max(width - img.w, width * 0.55 - img.w * 0.72));
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, width, height);
      layout();
    };
    window.addEventListener("resize", resize);

    const target = { x: 0, y: 0 };
    const aim = { x: 0, y: 0 };
    let lastMove = -Infinity;
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      lastMove = performance.now();
      setTouched(true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);

    let raf = 0;
    let disposed = false;
    Promise.all([loadImage(DARK_SRC), loadImage(LIGHT_SRC), loadImage(MASK_SRC)]).then(
      ([dark, light, mask]) => {
        if (disposed) return;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.activeTexture(gl.TEXTURE0);
        createTexture(gl, dark);
        gl.activeTexture(gl.TEXTURE1);
        createTexture(gl, light);
        gl.activeTexture(gl.TEXTURE2);
        createTexture(gl, mask);
        gl.activeTexture(gl.TEXTURE3);
        createTexture(gl, edgeStrip(dark));

        img.aspect = dark.width / dark.height;
        resize();
        const start = performance.now();
        // Start aimed at the face, so the first frame already tells the story
        aim.x = img.x + img.w * FACE.x;
        aim.y = img.y + img.h * FACE.y;
        let prev = start;
        setReady(true);

        const frame = (now: number) => {
          const dt = Math.min((now - prev) / 1000, 0.1);
          prev = now;
          const t = (now - start) / 1000;

          // Left alone, the beam slowly sweeps between the face and the chest
          if (now - lastMove > IDLE_AFTER) {
            const k = 0.5 + 0.5 * Math.sin(t * 0.45 - Math.PI / 2);
            target.x = img.x + img.w * (FACE.x + (CHEST.x - FACE.x) * k);
            target.y = img.y + img.h * (FACE.y + (CHEST.y - FACE.y) * k);
          }
          const ease = 1 - Math.exp(-dt * AIM_EASE);
          aim.x += (target.x - aim.x) * ease;
          aim.y += (target.y - aim.y) * ease;

          const sx = width * SOURCE_X;
          const sy = height * SOURCE_Y + (aim.y - height * SOURCE_Y) * SOURCE_FOLLOW;
          let dx = aim.x - sx;
          let dy = aim.y - sy;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;

          gl.uniform4f(uImg, img.x, img.y, img.w, img.h);
          gl.uniform2f(uSrc, sx, sy);
          gl.uniform2f(uDir, dx, dy);
          gl.uniform1f(uWidth, height * BEAM_WIDTH);
          gl.uniform1f(uDepth, height * LIGHT_DEPTH);
          // The beam switches on a moment after the photo appears
          const on = Math.min(Math.max((t - 0.6) / 1.4, 0), 1);
          gl.uniform1f(uPower, on * on * (3 - 2 * on));
          gl.uniform1f(uTime, t);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      },
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#020a16] text-white select-none">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none transition-opacity duration-[1500ms] ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/60 md:px-12 md:py-8">
        <span>Dmitry Yunkov</span>
        <nav className="pointer-events-auto flex gap-6 md:gap-10">
          <a href="#" className="transition-colors hover:text-white">Work</a>
          <a href="#" className="transition-colors hover:text-white">Contact</a>
          <Link href="/" className="transition-colors hover:text-white">Labs</Link>
        </nav>
      </header>

      {/* On phones the copy sits low, over the dark shirt, and keeps the face clear */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/70 to-transparent md:hidden" />

      <section
        className={`pointer-events-none absolute bottom-20 left-6 max-w-[17rem] transition-opacity delay-700 duration-[1500ms] md:top-1/2 md:bottom-auto md:left-12 md:max-w-xl md:-translate-y-1/2 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="mb-5 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.35em] text-[#f0b27a]/80">
          Designer &amp; developer
        </p>
        <h1 className="font-[family-name:var(--font-instrument)] text-5xl leading-[0.95] text-white/90 md:text-8xl">
          Dmitry
          <br />
          <em className="text-white/55">Yunkov</em>
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55 md:mt-6 md:text-base">
          I build small, strange, well-lit things on the web — and share how they are made.
        </p>
      </section>

      <p
        className={`pointer-events-none absolute bottom-8 left-6 flex items-center gap-3 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/50 transition-opacity duration-700 md:bottom-12 md:left-12 ${
          ready && !touched ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="h-px w-8 bg-[#f0b27a]/70" />
        <span className="pointer-coarse:hidden">Move the cursor to guide the light</span>
        <span className="hidden pointer-coarse:inline">Drag to guide the light</span>
      </p>
    </main>
  );
}
