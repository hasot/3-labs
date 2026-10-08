"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EnsoLoader } from "./EnsoLoader";
import { startHandTracking } from "./handTracker";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DAY_SRC = `${BASE_PATH}/videos/reveal-day.mp4`;
const NIGHT_SRC = `${BASE_PATH}/videos/reveal-night.mp4`;
// The night loop is nudged back in step with the day one once it drifts this far
const MAX_DRIFT = 0.08;

const MAX_DPR = 2;
// The trail is painted at a fraction of the screen size, the shader smooths it out
const TRAIL_SCALE = 0.5;
// Brush radius in CSS pixels, grows with pointer speed
const BRUSH_MIN = 90;
const BRUSH_MAX = 180;
// Fog: soft patches that live on the day side by themselves (the cursor never adds
// to them). Each patch shows as a light blue haze, and the drifting noise now and
// then tears small holes in it. Patches are computed in the shader in full float
// precision, so they fade in and out smoothly
const FOG_SLOTS = 18;
// Fog level inside a patch; the tear threshold is 0.44, so a bit lower than that
// means mostly haze with the occasional tear
const FOG_LEVEL = 0.325;
const FOG_EVERY_MIN = 900;
const FOG_EVERY_MAX = 1800;
// Lifetime of a patch in seconds: fade in, hold, fade out
const FOG_IN = 3;
const FOG_LIFE_MIN = 12;
const FOG_LIFE_MAX = 20;
const FOG_OUT = 5;
// How much of the trail is erased per frame at 60 fps, in 1/255 steps. The canvas
// keeps fill alpha in 8 bits, so only whole steps exist: they are spread over the
// frames (2, 2, 1, 2, 2, ...) so every frame still fades and nothing stutters
const TRAIL_FADE_STEPS = 1.8;

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
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uTrail;
uniform vec4 uFogSeg[${FOG_SLOTS}];
uniform vec2 uFogPar[${FOG_SLOTS}];
uniform vec2 uRes;
uniform vec2 uImg;
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

// 8-bit fading never quite reaches zero, drop the leftover. Averaged over a few
// taps: Chrome dithers canvas gradients, which would show as a checkerboard
// right at the tear threshold
float trailAt(vec2 uv) {
  vec2 px = 3.0 / uRes;
  float t = texture2D(uTrail, uv).r * 0.4;
  t += texture2D(uTrail, uv + vec2(px.x, 0.0)).r * 0.15;
  t += texture2D(uTrail, uv - vec2(px.x, 0.0)).r * 0.15;
  t += texture2D(uTrail, uv + vec2(0.0, px.y)).r * 0.15;
  t += texture2D(uTrail, uv - vec2(0.0, px.y)).r * 0.15;
  return smoothstep(0.24, 1.0, t);
}

// Fog field at a point in CSS pixels: each patch is a soft capsule (segment a-b,
// radius r) with a flat core, and the strongest patch wins
float fogAt(vec2 pos) {
  float f = 0.0;
  for (int i = 0; i < ${FOG_SLOTS}; i++) {
    vec4 seg = uFogSeg[i];
    vec2 par = uFogPar[i];
    vec2 ab = seg.zw - seg.xy;
    float h = clamp(dot(pos - seg.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float d = length(pos - seg.xy - ab * h);
    f = max(f, par.y * (1.0 - smoothstep(par.x * 0.5, par.x, d)));
  }
  return f;
}

// object-fit: cover
vec2 cover(vec2 uv) {
  float rs = uRes.x / uRes.y;
  float ri = uImg.x / uImg.y;
  vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = vUv * aspect;

  // Blot shape: the whole trail is bent by low-frequency noise (domain warp),
  // so even the head of the stroke turns into an uneven inky lobe
  vec2 bend = vec2(
    fbm(p * 2.2 + vec2(0.0, uTime * 0.05)),
    fbm(p * 2.2 + vec2(5.2, 1.3) - vec2(uTime * 0.05, 0.0))
  ) - 0.5;
  // A second, tighter warp adds smaller lobes and bays along the outline
  vec2 lobes = vec2(
    fbm(p * 6.0 + vec2(2.7, 0.0) + uTime * 0.04),
    fbm(p * 6.0 + vec2(0.0, 8.1) - uTime * 0.04)
  ) - 0.5;
  vec2 trailUv = vUv + (bend * 0.14 + lobes * 0.035) / aspect;

  // Torn, smoky edge: the trail value is pushed around by two layers of noise
  float coarse = fbm(p * 6.0 + vec2(0.0, uTime * 0.08));
  float fine = fbm(p * 24.0 - vec2(uTime * 0.05, 0.0));
  float trail = trailAt(trailUv);
  // Noise only acts near the trail, so untouched areas stay clean
  float gate = smoothstep(0.0, 0.08, trail);
  float v = trail + ((coarse - 0.5) * 0.5 + (fine - 0.5) * 0.18) * gate;

  float mask = smoothstep(0.44, 0.47, v);
  // Dusk band just outside the hole
  float halo = smoothstep(0.22, 0.44, v) * (1.0 - mask) * (0.4 + 0.6 * fine);
  // Thin moonlit line right on the edge
  float edge = smoothstep(0.41, 0.445, v) * (1.0 - smoothstep(0.445, 0.48, v));

  // Fog: same recipe with stronger noise. Its level sits below the hole
  // threshold, so it reads as haze, and only noise peaks break through
  // No haze around the hero: a soft oval in the middle of the frame stays clean
  float mem = fogAt(trailUv * uRes);
  float mgate = smoothstep(0.0, 0.08, mem);
  // Mostly finer noise than the cursor uses, so the tears come out smaller and
  // more frequent; a little of the coarse one keeps the odd bigger tear
  float speck = fbm(p * 12.0 + vec2(uTime * 0.03, uTime * 0.07));
  float mv = mem + ((coarse - 0.5) * 0.25 + (speck - 0.5) * 0.65 + (fine - 0.5) * 0.3) * mgate;
  // The haze may pass over the hero, but it never tears through him
  float fromHero = length(vec2((vUv.x - 0.475) / 0.065, (vUv.y - 0.48) / 0.2));
  float tearOk = smoothstep(1.0, 1.4, fromHero);
  float mmask = smoothstep(0.435, 0.48, mv) * tearOk;
  float mhalo = smoothstep(0.1, 0.44, mv) * (1.0 - mmask) * (0.4 + 0.6 * fine);
  float medge = smoothstep(0.41, 0.445, mv) * (1.0 - smoothstep(0.445, 0.48, mv)) * tearOk;

  vec2 iuv = cover(vUv);
  vec2 warp = (vec2(coarse, fine) - 0.5) * 0.012 * halo;
  vec3 day = texture2D(uDay, iuv + warp).rgb;
  vec3 night = texture2D(uNight, iuv).rgb;

  vec3 dusk = day * vec3(0.42, 0.5, 0.78);
  vec3 col = mix(day, dusk, max(halo, mhalo) * 0.75);
  col = mix(col, night, max(mask, mmask));
  // The fog rim is drawn only on the day side, never over the revealed night
  col += vec3(0.55, 0.7, 1.0) * max(edge, medge * (1.0 - mask)) * 0.1;

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

// Remembers that the visitor turned the sound off, across reloads
const MUTED_KEY = "mask-reveal:muted";
function readMuted() {
  try {
    return typeof window !== "undefined" && localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

// Muted, inline and looping, so browsers let it autoplay
// `onProgress` gets the buffered share of the clip, 0..1
function loadVideo(src: string, onProgress: (share: number) => void) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    const report = () => {
      const b = video.buffered;
      if (b.length && video.duration) onProgress(b.end(b.length - 1) / video.duration);
    };
    video.onprogress = report;
    video.onloadedmetadata = report;
    video.oncanplaythrough = () => {
      onProgress(1);
      resolve(video);
    };
    video.onerror = reject;
    video.src = src;
    video.load();
  });
}

type CamState = "idle" | "starting" | "on" | "denied" | "error";

// The scene, driven either by the mouse or by a hand seen through the webcam
export function MaskReveal({ input = "pointer" }: { input?: "pointer" | "hand" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<HTMLVideoElement>(null);
  const handDotRef = useRef<HTMLDivElement>(null);
  const startCameraRef = useRef<() => void>(() => {});
  const [camState, setCamState] = useState<CamState>("idle");
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [touched, setTouched] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // Only the day video carries sound; the night one stays muted
  const dayVideoRef = useRef<HTMLVideoElement | null>(null);
  // Set once the visitor turns sound off by hand, so later clicks don't undo it
  const userMutedRef = useRef(readMuted());

  const setSound = (on: boolean) => {
    userMutedRef.current = !on;
    try {
      localStorage.setItem(MUTED_KEY, on ? "0" : "1");
    } catch {}
    const day = dayVideoRef.current;
    if (!day) return;
    day.muted = !on;
    day.play().catch(() => {});
    setSoundOn(on);
  };

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
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uImg = gl.getUniformLocation(program, "uImg");
    const uTime = gl.getUniformLocation(program, "uTime");
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Offscreen trail: white blobs on black, slowly fading back to black
    const trail = document.createElement("canvas");
    const tctx = trail.getContext("2d")!;
    let trailTex: WebGLTexture | null = null;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, width, height);
      trail.width = Math.max(1, Math.round(width * TRAIL_SCALE));
      trail.height = Math.max(1, Math.round(height * TRAIL_SCALE));
      tctx.fillStyle = "#000";
      tctx.fillRect(0, 0, trail.width, trail.height);
    };
    window.addEventListener("resize", resize);

    // Each input paints its own stroke (mouse and hand can move at once without a
    // line being drawn between them)
    type Stroke = { x: number; y: number; px: number; py: number; active: boolean; moved: boolean; brush: number };
    const newStroke = (): Stroke => ({ x: 0, y: 0, px: 0, py: 0, active: false, moved: false, brush: BRUSH_MIN });
    const pointer = newStroke();
    const handStroke = newStroke();
    const onMove = (e: PointerEvent) => {
      if (!pointer.active) {
        pointer.px = e.clientX;
        pointer.py = e.clientY;
        pointer.active = true;
        setTouched(true);
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.moved = true;
    };
    // Browsers only allow sound after a real gesture (a click, tap or key press,
    // not a mouse move). A gesture that comes before the video has loaded is
    // remembered and applied once it is there
    let gestured = false;
    const unmute = () => {
      const day = dayVideoRef.current;
      if (!day || !day.muted || userMutedRef.current) return;
      day.muted = false;
      day.play().catch(() => {
        // Still blocked: stay silent and wait for the next gesture
        day.muted = true;
        setSoundOn(false);
      });
      setSoundOn(true);
    };
    const onGesture = () => {
      gestured = true;
      unmute();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    const onLeave = () => {
      pointer.active = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    document.addEventListener("pointerleave", onLeave);

    const dab = (x: number, y: number, r: number) => {
      const sx = x * TRAIL_SCALE;
      const sy = y * TRAIL_SCALE;
      const sr = r * TRAIL_SCALE;
      const g = tctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      tctx.fillStyle = g;
      tctx.beginPath();
      tctx.arc(sx, sy, sr, 0, Math.PI * 2);
      tctx.fill();
    };

    // One brush step is a clump of random dabs plus the odd splash drop,
    // so the stroke reads as an ink blot rather than a round brush
    const blot = (x: number, y: number, r: number) => {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r * 0.4;
        const dx = x + Math.cos(a) * d;
        const dy = y + Math.sin(a) * d;
        const dr = r * (0.6 + Math.random() * 0.4);
        dab(dx, dy, dr);
      }
      if (Math.random() < 0.05) {
        const a = Math.random() * Math.PI * 2;
        const d = r * (1.1 + Math.random() * 0.8);
        dab(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.2 + Math.random() * 0.25));
      }
    };

    // Random point away from the middle of the frame, where the hero stands
    const edgePoint = () => {
      for (;;) {
        const x = Math.random();
        const y = Math.random();
        const nx = (x - 0.5) / 0.2;
        const ny = (y - 0.5) / 0.4;
        if (nx * nx + ny * ny > 1) return { x: x * width, y: y * height };
      }
    };

    type Fog = { ax: number; ay: number; bx: number; by: number; r: number; age: number; life: number };
    const fogs: Fog[] = [];
    // A patch of fog near the edges: a short smear with a soft round outline
    const spawnFog = (age: number) => {
      const { x, y } = edgePoint();
      const angle = Math.random() * Math.PI * 2;
      const half = 40 + Math.random() * 110;
      fogs.push({
        ax: x - Math.cos(angle) * half,
        ay: y - Math.sin(angle) * half,
        bx: x + Math.cos(angle) * half,
        by: y + Math.sin(angle) * half,
        r: 70 + Math.random() * 60,
        age,
        life: FOG_LIFE_MIN + Math.random() * (FOG_LIFE_MAX - FOG_LIFE_MIN),
      });
    };
    resize();
    // The first patches are already there, each at a different point of its life
    for (let i = 0; i < FOG_SLOTS - 3; i++) spawnFog(FOG_IN + Math.random() * 6);
    let nextFog = performance.now() + FOG_EVERY_MIN;
    const fogSeg = new Float32Array(FOG_SLOTS * 4);
    const fogPar = new Float32Array(FOG_SLOTS * 2);
    const uFogSeg = gl.getUniformLocation(program, "uFogSeg");
    const uFogPar = gl.getUniformLocation(program, "uFogPar");

    // Hand: the latest palm position from the camera (about 30 times a second),
    // smoothed every frame into a cursor that glides instead of jumping
    const hand = { tx: 0, ty: 0, x: 0, y: 0, seen: false, lastSeen: -1e9 };
    let stopHand: (() => void) | null = null;
    startCameraRef.current = async () => {
      if (stopHand || !camRef.current) return;
      setCamState("starting");
      try {
        const stop = await startHandTracking(camRef.current, (pt) => {
          hand.seen = !!pt;
          if (!pt) return;
          hand.tx = pt.x * width;
          hand.ty = pt.y * height;
          hand.lastSeen = performance.now();
        });
        if (disposed) {
          stop();
          return;
        }
        stopHand = stop;
        setCamState("on");
      } catch (err) {
        if (disposed) return;
        setCamState((err as Error)?.name === "NotAllowedError" ? "denied" : "error");
      }
    };

    let videos: [HTMLVideoElement, HTMLVideoElement] | null = null;
    let dayTex: WebGLTexture | null = null;
    let nightTex: WebGLTexture | null = null;

    let fadeDebt = 0;
    let raf = 0;
    let disposed = false;
    let last = performance.now();
    const start = last;

    const paint = (s: Stroke) => {
      if (!s.active || !s.moved) {
        s.brush += (BRUSH_MIN - s.brush) * 0.1;
        return;
      }
      const dx = s.x - s.px;
      const dy = s.y - s.py;
      const dist = Math.hypot(dx, dy);
      const target = BRUSH_MIN + Math.min(dist / 40, 1) * (BRUSH_MAX - BRUSH_MIN);
      s.brush += (target - s.brush) * 0.15;

      // Max instead of add keeps a soft cone profile, so noise can tear the edge
      tctx.globalCompositeOperation = "lighten";
      const steps = Math.max(1, Math.ceil(dist / (s.brush * 0.25)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        blot(s.px + dx * t, s.py + dy * t, s.brush);
      }
      s.px = s.x;
      s.py = s.y;
      s.moved = false;
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 16.667, 3);
      last = now;

      fadeDebt += TRAIL_FADE_STEPS * dt;
      const fadeSteps = Math.floor(fadeDebt);
      if (fadeSteps > 0) {
        tctx.globalCompositeOperation = "source-over";
        tctx.fillStyle = `rgba(0,0,0,${fadeSteps / 255})`;
        tctx.fillRect(0, 0, trail.width, trail.height);
        fadeDebt -= fadeSteps;
      }

      if (now >= nextFog && fogs.length < FOG_SLOTS) {
        spawnFog(0);
        nextFog = now + FOG_EVERY_MIN + Math.random() * (FOG_EVERY_MAX - FOG_EVERY_MIN);
      }
      fogSeg.fill(0);
      fogPar.fill(0);
      for (let i = fogs.length - 1; i >= 0; i--) {
        const f = fogs[i];
        f.age += dt / 60;
        if (f.age >= f.life) fogs.splice(i, 1);
      }
      fogs.forEach((f, i) => {
        const fadeIn = Math.min(1, f.age / FOG_IN);
        const fadeOut = Math.min(1, (f.life - f.age) / FOG_OUT);
        const k = Math.min(fadeIn, fadeOut);
        // Flip y: the shader works with the origin at the bottom
        fogSeg.set([f.ax, height - f.ay, f.bx, height - f.by], i * 4);
        fogPar.set([f.r, FOG_LEVEL * k * k * (3 - 2 * k)], i * 2);
      });
      gl.uniform4fv(uFogSeg, fogSeg);
      gl.uniform2fv(uFogPar, fogPar);

      if (stopHand) {
        // A short grace period rides over frames where the model loses the hand
        const present = hand.seen || now - hand.lastSeen < 250;
        if (present) {
          if (!handStroke.active) {
            hand.x = hand.tx;
            hand.y = hand.ty;
            handStroke.px = hand.x;
            handStroke.py = hand.y;
            handStroke.active = true;
            setTouched(true);
          }
          const k = Math.min(1, 0.35 * dt);
          hand.x += (hand.tx - hand.x) * k;
          hand.y += (hand.ty - hand.y) * k;
          handStroke.x = hand.x;
          handStroke.y = hand.y;
          handStroke.moved = true;
        } else {
          handStroke.active = false;
        }
        const dot = handDotRef.current;
        if (dot) {
          dot.style.transform = `translate(${hand.x}px, ${hand.y}px)`;
          dot.style.opacity = present ? "1" : "0";
        }
      }

      paint(pointer);
      paint(handStroke);

      if (videos) {
        const [day, night] = videos;
        if (Math.abs(night.currentTime - day.currentTime) > MAX_DRIFT) {
          night.currentTime = day.currentTime;
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dayTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, day);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, nightTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, night);
      }

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, trailTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail);

      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };

    const shares = [0, 0];
    const track = (i: number) => (share: number) => {
      if (disposed) return;
      shares[i] = Math.max(shares[i], share);
      setProgress((shares[0] + shares[1]) / 2);
    };
    Promise.all([loadVideo(DAY_SRC, track(0)), loadVideo(NIGHT_SRC, track(1))]).then(([day, night]) => {
      if (disposed) {
        for (const v of [day, night]) {
          v.removeAttribute("src");
          v.load();
        }
        return;
      }
      videos = [day, night];
      dayVideoRef.current = day;
      gl.activeTexture(gl.TEXTURE0);
      dayTex = createTexture(gl, day);
      gl.activeTexture(gl.TEXTURE1);
      nightTex = createTexture(gl, night);
      gl.activeTexture(gl.TEXTURE2);
      trailTex = createTexture(gl, trail);

      gl.uniform1i(gl.getUniformLocation(program, "uDay"), 0);
      gl.uniform1i(gl.getUniformLocation(program, "uNight"), 1);
      gl.uniform1i(gl.getUniformLocation(program, "uTrail"), 2);
      gl.uniform2f(uImg, day.videoWidth, day.videoHeight);

      // Start both loops together
      day.currentTime = 0;
      night.currentTime = 0;
      night.play().catch(() => {});
      // Try to start with sound right away; browsers allow it only for sites the
      // visitor already engages with. Otherwise play silently and let the first
      // click or key press turn the sound on
      if (userMutedRef.current) {
        day.play().catch(() => {});
      } else {
        day.muted = false;
        day.play().then(
          () => setSoundOn(true),
          () => {
            day.muted = true;
            day.play().catch(() => {});
            if (gestured) unmute();
          },
        );
      }

      setReady(true);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      videos?.forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      dayVideoRef.current = null;
      stopHand?.();
      stopHand = null;
      // No loseContext() here: StrictMode remounts reuse the same canvas context
    };
  }, [input]);

  const handMode = input === "hand";

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black text-white select-none">
      <EnsoLoader progress={progress} done={ready} />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none transition-opacity duration-1000 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Readability gradients behind the text */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/60 to-transparent" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 md:px-12 md:py-8">
        <span className="font-[family-name:var(--font-cinzel)] text-lg tracking-[0.3em]">
          RONIN
        </span>
        <nav className="pointer-events-auto flex gap-6 text-xs uppercase tracking-[0.25em] text-white/80 md:gap-10">
          <a href="#" className="transition-colors hover:text-white">Story</a>
          <a href="#" className="transition-colors hover:text-white">World</a>
          <Link href="/" className="transition-colors hover:text-white">Labs</Link>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setSound(!soundOn)}
            className="uppercase tracking-[0.25em] transition-colors hover:text-white"
            aria-pressed={soundOn}
          >
            Sound {soundOn ? "on" : "off"}
          </button>
        </nav>
      </header>

      <section className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-10 md:px-12 md:pb-14">
        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-white/70">
          Chapter one · The cliff
        </p>
        <h1 className="font-[family-name:var(--font-cinzel)] text-5xl leading-none tracking-wide md:text-8xl">
          Day hides
          <br />
          the night
        </h1>
        <p className="mt-5 max-w-md text-sm text-white/75 md:text-base">
          Under every sunny hillside there is the same hill after the fight.
          {handMode ? " Wave your hand at the camera to see it." : " Move the cursor to see it."}
        </p>
      </section>

      {handMode && (
        <>
          {/* Where the palm is: the hand's stand-in for a cursor */}
          <div
            ref={handDotRef}
            className="pointer-events-none absolute top-0 left-0 z-10 -mt-5 -ml-5 h-10 w-10 rounded-full border border-white/70 opacity-0 shadow-[0_0_24px_rgba(180,210,255,0.6)] transition-opacity duration-300"
          />
          {/* Small mirrored camera preview, so it's clear what the page sees */}
          <video
            ref={camRef}
            muted
            playsInline
            className={`pointer-events-none absolute right-6 bottom-10 z-10 w-40 -scale-x-100 rounded-lg border border-white/20 object-cover opacity-0 transition-opacity duration-700 md:right-12 md:bottom-14 md:w-48 ${
              camState === "on" ? "opacity-70" : ""
            }`}
          />
          {camState !== "on" && (
            <div className="absolute right-6 bottom-10 z-10 flex max-w-xs flex-col items-end gap-2 text-right md:right-12 md:bottom-14">
              <button
                type="button"
                disabled={!ready || camState === "starting"}
                onClick={() => startCameraRef.current()}
                className="rounded-full border border-white/40 bg-black/30 px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-white backdrop-blur transition hover:border-white hover:bg-black/50 disabled:opacity-50"
              >
                {camState === "starting" ? "Starting camera…" : "Enable camera"}
              </button>
              {(camState === "denied" || camState === "error") && (
                <p className="text-xs text-white/70">
                  {camState === "denied"
                    ? "Camera access is blocked. Allow it in the browser settings."
                    : "The camera couldn't start."}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div
        className={`pointer-events-none absolute right-6 bottom-10 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/80 transition-opacity duration-700 md:right-12 md:bottom-14 ${
          ready && !touched && !handMode ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
        Move the cursor
      </div>
    </main>
  );
}
