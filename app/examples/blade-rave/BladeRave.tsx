"use client";

import { Anton } from "next/font/google";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRaveSound } from "./raveSound";

// The Blood Rave from Blade (1998) as a club-night hero: the still of Blade in the
// crowd sits in the dark and a strobe fires on every kick of the track, each flash a
// new freeze-frame (a punch-in, a shake, an RGB tear). Holding the mouse opens the
// sprinklers: blood sprays down from the ceiling, runs over the people and pools up
// from the floor; once it floods the whole screen it drains away onto the
// same room soaked in blood. One WebGL2 pass over the photos, Web Audio listening to
// the music

const anton = Anton({ weight: "400", subsets: ["latin"] });

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const IMAGE_SRC = `${BASE_PATH}/images/blade-rave.webp`;
// The same shot after the sprinklers
const BLOODY_SRC = `${BASE_PATH}/images/blade-rave-blood.webp`;
// The way in: steel double doors with a bouncer. The screen splits along the seam
// between the leaves (a share of the picture's width) and both halves swing open
const DOOR_SRC = `${BASE_PATH}/images/blade-rave-door.webp`;
const DOOR_SIZE = [1673, 940];
const DOOR_SEAM = 864 / 1673;
const DOOR_MS = 1700;

const MAX_DPR = 2;
const MAX_DT = 0.05;

// The strobe has three modes, cycled by the button in the header: hard to start with,
// soft, and off for anyone who gets a headache from it or can't take flashing light
type Strobe = "off" | "soft" | "hard";
const STROBE_NEXT: Record<Strobe, Strobe> = { off: "soft", soft: "hard", hard: "off" };

// Light in the room (1 = the photo as shot): before the music, with the strobe off, and
// between flashes in soft and hard mode, plus how much the bass pumps it
const IDLE_LIGHT = 0.34;
const STEADY_LIGHT = 0.7;
const SOFT_LIGHT = 0.42;
const DARK_LIGHT = 0.08;
const BASS_PUMP = 0.1;
// A flash overexposes the photo by this much on top (15% under the first cut, which
// was too much) and dies out in this many seconds
const FLASH_GAIN = 2.2;
const FLASH_TAU = 0.07;
// Soft mode: a dim, slow glow instead of a strobe
const SOFT_FLASH = 0.28;
const SOFT_TAU = 0.25;
// Every flash is a new freeze-frame: zoomed in this much at most, shaken this far
// (share of the image) and torn into RGB this wide
const PUNCH = 0.13;
const SHAKE = 0.012;
const TEAR = 0.014;
// Where the camera punches in: Blade's chest, in image coordinates from the top left,
// in the clean shot and the bloody one
const FOCUS = [0.51, 0.36];
const BLOODY_FOCUS = [0.5, 0.4];

// Flash colors: mostly white, some ice blue and club red
const TINTS: [number, number, number, number][] = [
  [1, 1, 1, 0.55],
  [0.72, 0.86, 1, 0.25],
  [1, 0.42, 0.42, 0.2],
];
const BLOOD_TINT = [1, 0.3, 0.28];
// The type under the blood: dark burgundy, still readable on red
const BURGUNDY = "#1f0206";

// Sprinklers: they open by themselves this long after walking in, or on the first
// click, and never close again. How fast the spray comes on (and stops, if it ever
// did), and seconds of it until the blood has run over everyone
const SPRINKLERS_AFTER_S = 10;
const RAIN_IN = 2.5;
const RAIN_OUT = 1.2;
const COAT_S = 4;
// The pool: it starts rising after this many seconds of rain, then takes this long to
// flood the screen; if the rain ever stopped it would seep away at this rate. Flooded,
// it stands a moment, then soaks in, patch by patch, into the bloody shot
const PUDDLE_S = 1.5;
const FILL_S = 5;
const SEEP_RATE = 0.7;
const FLOODED_S = 0.5;
const SOAK_S = 2.4;
// The stain the soaked-in blood leaves dries in about this long
const FILM_TAU = 2.5;
// Sprinkler nozzles above the frame, as a share of the width
const NOZZLES = [0.14, 0.38, 0.62, 0.86];

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uBloody;
uniform float uSwap;
uniform vec2 uRes;
uniform vec2 uImg;
uniform float uTime;
uniform float uLight;
uniform float uFlash;
uniform vec3 uTint;
uniform float uZoom;
uniform vec2 uShift;
uniform vec2 uFocus;
uniform float uTear;
uniform float uRain;
uniform float uCoat;
uniform float uLevel;
uniform float uFilm;
uniform float uSoak;
uniform float uNozzles[4];
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

vec3 photo(vec2 uv, vec2 tear) {
  if (uSwap > 0.5) {
    return vec3(texture(uBloody, uv + tear).r, texture(uBloody, uv).g, texture(uBloody, uv - tear).b);
  }
  return vec3(texture(uImage, uv + tear).r, texture(uImage, uv).g, texture(uImage, uv - tear).b);
}

// One sprinkler: a fan of jets flung down and out from a nozzle above the frame, each
// jet broken into drops flying away from it. p and nozzle in screen heights, y up
float spray(vec2 p, vec2 nozzle, float seed) {
  vec2 v = p - nozzle;
  float r = length(v);
  float ang = atan(v.x, -v.y);
  if (abs(ang) > 0.75) return 0.0;
  float k = 70.0;
  float a = ang * k + seed * 13.0;
  float lane = floor(a);
  float h = hash(vec2(lane, seed));
  // Off the jet's center line, in screen heights
  float across = (fract(a) - 0.5) / k * r;
  float along = r * 20.0 - uTime * (20.0 + h * 12.0) + h * 10.0;
  float cell = floor(along);
  float f = fract(along);
  float hc = hash(vec2(cell, lane + seed * 7.0));
  if (hc < 0.55) return 0.0;
  float len = 0.2 + 0.3 * hc;
  float drop = smoothstep(0.0, len, f) * (1.0 - smoothstep(len, len + 0.06, f));
  float body = smoothstep(0.0016 * (0.6 + hc), 0.0, abs(across));
  // Jets fall to different lengths; the steep ones reach the floor
  float reach = smoothstep(0.7 + h * 0.5 + cos(ang) * 0.4, 0.3, r);
  return drop * body * reach;
}

// The fine mist around the jets
float mist(vec2 p, vec2 nozzle) {
  vec2 v = p - nozzle;
  float ang = atan(v.x, -v.y);
  return exp(-ang * ang * 3.0) * exp(-length(v) * 1.6);
}

float luma(vec2 uv) {
  vec3 c = uSwap > 0.5 ? texture(uBloody, uv).rgb : texture(uImage, uv).rgb;
  return dot(c, vec3(0.3, 0.59, 0.11));
}

// Drops that land on someone and run down them. Every cell of a square screen grid
// lands a drop now and then at a random spot; if that spot is the top of something lit
// (a head, a shoulder, a raised arm) the drop sticks and trickles down, slow at first,
// a wavering trail behind a bead, then fades. st: screen from the top left; span and
// center map it on the photo
float drips(vec2 st, float sr, vec2 span, vec2 center) {
  const float ROWS = 20.0;
  vec2 grid = vec2(st.x * sr, st.y) * ROWS;
  vec2 base = floor(grid);
  float sum = 0.0;
  // A trail runs up to a few cells down from where its drop landed
  for (int j = -3; j <= 0; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = base + vec2(i, j);
      float h = hash(cell);
      float life = 1.8 + h * 1.4;
      float period = life + 0.4 + hash(cell + 9.1) * 1.2;
      float phase = uTime / period + h * 7.0;
      float n = floor(phase);
      float age = fract(phase) * period;
      if (age > life) continue;
      vec2 at = cell + vec2(hash(cell + n * 1.3), hash(cell + n * 2.7 + 5.0));
      // Lit below and dark above: the top edge of something
      vec2 auv = center + (vec2(at.x / sr, at.y) / ROWS - 0.5) * span;
      float above = luma(auv - vec2(0.0, 0.01));
      float below = luma(auv + vec2(0.0, 0.004));
      float surface = smoothstep(0.03, 0.12, below - above) + smoothstep(0.3, 0.55, below) * 0.6;
      if (surface < 0.25) continue;
      vec2 d = grid - at;
      // The bead gathers, then slides, gaining speed like a heavy drop on skin
      float slide = 0.8 + hash(cell + n * 3.3) * 1.2;
      // Never further than the three cells searched above
      float head = min(0.08 + slide * pow(age, 1.5) * 0.6, 2.8);
      float wob = (noise(vec2(d.y * 2.5, h * 50.0 + n)) - 0.5) * 0.18;
      float fade = 1.0 - smoothstep(life * 0.65, life, age);
      // The trail: thin under the hit, swelling toward the bead
      float along = clamp(d.y / max(head, 0.001), 0.0, 1.0);
      float w = 0.06 + 0.07 * along;
      float trail = smoothstep(w, w * 0.35, abs(d.x - wob)) * step(0.0, d.y) * step(d.y, head);
      // The bead at the front and the spot where it landed
      float bead = smoothstep(0.16, 0.06, length(d - vec2(wob, head)));
      float spot = smoothstep(0.14, 0.05, length(d * vec2(1.0, 1.6)));
      sum += max(max(trail * 0.85, bead), spot) * fade * min(surface, 1.0);
    }
  }
  return min(sum, 1.0);
}

void main() {
  // Screen from the top left, and the photo cropped to cover it
  vec2 st = vec2(vUv.x, 1.0 - vUv.y);
  float sr = uRes.x / uRes.y, ir = uImg.x / uImg.y;
  vec2 span = (sr > ir ? vec2(1.0, ir / sr) : vec2(sr / ir, 1.0)) / uZoom;
  vec2 center = mix(vec2(0.5, 0.46), uFocus, 1.0 - 1.0 / uZoom) + uShift;
  center = clamp(center, span * 0.5, 1.0 - span * 0.5);
  vec2 uv = center + (st - 0.5) * span;

  // The flash tears the frame into red, green and blue
  vec2 tear = (st - 0.5) * uTear + vec2(uTear * 0.4, 0.0);
  vec3 c = photo(uv, tear);

  // Spatter left on everyone: spots and thin runs crawling down the lit surfaces, a
  // light coat at most; the real soaking is the bloody shot after the flood. Pinned to
  // the photo, so it moves with every punch-in
  if (uCoat > 0.0) {
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    float spots = noise(uv * vec2(260.0, 160.0)) * 0.6 + noise(uv * vec2(640.0, 390.0)) * 0.4;
    float runs = noise(vec2(uv.x * 260.0, uv.y * 7.0 - uTime * 0.35)) * 0.8 + noise(uv * 900.0) * 0.2;
    float soak = max(spots, runs * 0.9) * 0.75 + lum * 0.5;
    float coat = smoothstep(1.2 - uCoat * 0.45, 1.25 - uCoat * 0.45, soak);
    vec3 wet = vec3(0.5, 0.02, 0.03) * (0.25 + lum * 1.3) + vec3(1.0, 0.45, 0.4) * pow(lum, 3.0) * 0.9;
    c = mix(c, wet, coat * 0.85);
  }

  // Darkness between flashes, the photo blown out on one, colored by the strobe gel
  c *= uLight + uFlash * ${FLASH_GAIN.toFixed(2)};
  c *= mix(vec3(1.0), uTint, min(uFlash, 1.0) * 0.7);

  // Sprinklers: a thin red mist in the room, jets of blood lit by every flash and
  // running down the crowd
  vec2 p = vec2(vUv.x * sr, vUv.y);
  float haze = 0.55 + 0.45 * noise(p * 3.0 + vec2(uTime * 0.15, -uTime * 0.1));
  if (uRain > 0.0) {
    float jets = 0.0, fog = 0.0;
    for (int i = 0; i < 4; i++) {
      // Nozzles well above the frame: what shows is the falling shower, not the burst
      vec2 nozzle = vec2(uNozzles[i] * sr, 1.22);
      jets += spray(p, nozzle, float(i) + 1.0);
      fog += mist(p, nozzle);
    }
    c = mix(c, c * vec3(1.1, 0.55, 0.55) + vec3(0.05, 0.0, 0.005) * haze, min(fog, 1.0) * uRain * 0.3);
    c = mix(c, vec3(0.5, 0.0, 0.02) * (0.5 + uFlash * 1.8), min(jets, 1.0) * uRain);
    float runs = drips(st, sr, span, center);
    c = mix(c, vec3(0.5, 0.015, 0.03) * (0.55 + uFlash * 1.6), runs * uRain);
  }

  // The pool rising from the floor, its surface sloshing
  float x = vUv.x * sr;
  float wave = 0.012 * sin(x * 9.0 + uTime * 2.6) + 0.007 * sin(x * 23.0 - uTime * 3.9)
    + 0.012 * (noise(vec2(x * 4.0, uTime * 0.8)) - 0.5);
  float depth = uLevel * 1.14 - 0.07 + wave - vUv.y;
  if (depth > 0.0) {
    // The room barely shows through, wobbling, and every flash lights the blood up
    vec2 wob = vec2(sin(vUv.y * 40.0 + uTime * 2.0) * 0.004, 0.0);
    vec3 seen = photo(uv + wob, vec2(0.0)) * (uLight + uFlash * 1.2);
    // Thick and dark, almost black deep down
    vec3 blood = vec3(0.14, 0.0, 0.008) * (1.0 - smoothstep(0.0, 0.8, depth) * 0.6);
    blood += seen * vec3(0.4, 0.03, 0.03) * 0.25;
    // Glossy: a lit band under the surface and slow ripples of light in it
    float ripple = noise(vec2(x * 6.0, vUv.y * 18.0 - uTime * 0.6));
    blood += vec3(0.5, 0.02, 0.03) * (exp(-depth * 22.0) * 0.35 + ripple * ripple * 0.06);
    blood += vec3(0.6, 0.03, 0.04) * uFlash * 0.45 * (0.5 + ripple);
    // Bright meniscus where it meets the air
    blood += vec3(0.95, 0.15, 0.14) * exp(-depth * 160.0) * 0.7;
    // Soaking in: holes open in the blood like a stain spreading through cloth, the
    // room showing through them, a dark wet rim around each
    float held = 1.0;
    if (uSoak > 0.0) {
      float field = noise(p * 3.0) * 0.5 + noise(p * 7.0 + 3.1) * 0.3 + noise(p * 17.0 + 7.7) * 0.2;
      field = field * 0.8 + luma(uv) * 0.2;
      float edge = uSoak * 1.25 - 0.1;
      held = smoothstep(edge - 0.03, edge + 0.03, field);
      c = mix(c, c * vec3(0.7, 0.25, 0.25), smoothstep(0.12, 0.0, edge - field) * (1.0 - held));
    }
    c = mix(c, blood, smoothstep(0.0, 0.004, depth) * held);
  }
  // The stain the blood leaves once it has soaked in, drying
  c = mix(c, c * vec3(1.0, 0.35, 0.35) + vec3(0.06, 0.0, 0.0), uFilm * 0.6);

  // Film curve: the photo as shot at 1, a flash burns into white
  c = (1.0 - exp(-1.6 * c)) / (1.0 - exp(-1.6));
  float vig = smoothstep(1.15, 0.35, length((st - 0.5) * vec2(sr * 0.75, 1.0)));
  c *= mix(0.45, 1.0, vig);
  c += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 100.0) - 0.5) * 0.05;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

type Phase = "idle" | "starting" | "live";

export function BladeRave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const doorRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const sound = useMemo(() => createRaveSound(), []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [strobe, setStrobe] = useState<Strobe>("hard");
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);
  // The doors are gone from the page once they have swung open
  const [inside, setInside] = useState(false);
  const live = useRef({ started: false, strobe: "hard" as Strobe, pouring: false });
  const [pouring, setPouring] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) {
      setFailed(true);
      return;
    }
    sound.preload();

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    gl.useProgram(program);
    const u = (name: string) => gl.getUniformLocation(program, name);

    // One triangle over the whole screen
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Both shots are 16:9; the bloody one is uploaded up front so the swap doesn't stall
    let imageSize: [number, number] | null = null;
    const load = (unit: number, src: string, onLoad?: (img: HTMLImageElement) => void) => {
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const image = new Image();
      image.onload = () => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        onLoad?.(image);
      };
      image.src = src;
    };
    load(0, IMAGE_SRC, (img) => (imageSize = [img.naturalWidth, img.naturalHeight]));
    load(1, BLOODY_SRC);

    gl.uniform1i(u("uImage"), 0);
    gl.uniform1i(u("uBloody"), 1);
    gl.uniform1fv(u("uNozzles"), NOZZLES);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    // The strobe
    let flash = 0;
    let tint = [1, 1, 1];
    let zoom = 1;
    let shift = [0, 0];
    let tear = 0;
    // The sprinklers: the spray, how far the blood has run over people, the pool's
    // level (1 = over the top of the screen), the film on the glass, and where the flood is at
    let rain = 0;
    let coat = 0;
    let level = 0;
    // Seconds of rain the floor holds
    let poured = 0;
    let film = 0;
    let soak = 0;
    let stage: "clean" | "flooded" | "soaking" | "bloody" = "clean";
    let flooded = 0;
    let beat = 60 / 138;
    let lastKick = -1;
    let offbeat = Infinity;

    const pickTint = () => {
      if ((live.current.pouring || stage !== "clean") && Math.random() < 0.5) return BLOOD_TINT;
      let r = Math.random();
      for (const [cr, cg, cb, w] of TINTS) {
        if ((r -= w) <= 0) return [cr, cg, cb];
      }
      return [1, 1, 1];
    };

    const fire = (strength: number) => {
      const soft = live.current.strobe === "soft";
      flash = soft ? SOFT_FLASH * strength : strength;
      tint = soft ? [1, 1, 1] : pickTint();
      if (soft) return;
      // A new freeze-frame: punch in, shake, tear
      zoom = 1 + Math.pow(Math.random(), 1.6) * PUNCH;
      shift = [(Math.random() * 2 - 1) * SHAKE, (Math.random() * 2 - 1) * SHAKE];
      tear = TEAR * (0.4 + Math.random() * 0.6) * strength;
      const title = titleRef.current;
      if (title) {
        title.style.transform = `translate(${(Math.random() * 2 - 1) * 6}px, ${(Math.random() * 2 - 1) * 4}px)`;
      }
    };

    let raf = 0;
    let last = performance.now();
    // When the music started, seconds
    let enteredAt = -1;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      const t = now / 1000;
      const { started, strobe } = live.current;
      if (started && enteredAt < 0) enteredAt = t;
      if (started && !live.current.pouring && t - enteredAt > SPRINKLERS_AFTER_S) {
        live.current.pouring = true;
        setPouring(true);
      }
      const pouring = started && live.current.pouring;
      const soft = strobe === "soft";
      const ear = sound.listen(dt);

      if (ear.kick && strobe !== "off") {
        if (lastKick >= 0) {
          const gap = ear.time - lastKick;
          // Keep a running beat length from kicks a beat apart
          if (gap > 0.35 && gap < 0.6) beat += (gap - beat) * 0.2;
        }
        lastKick = ear.time;
        fire(1);
        // The sprinklers double the strobe: one more flash on the offbeat
        offbeat = pouring && !soft ? ear.time + beat / 2 : Infinity;
      } else if (strobe !== "off" && ear.time >= offbeat) {
        offbeat = Infinity;
        fire(0.7);
      }

      flash *= Math.exp(-dt / (soft ? SOFT_TAU : FLASH_TAU));
      tear *= Math.exp(-dt / 0.09);
      const raining = pouring && (stage === "clean" || stage === "bloody") ? 1 : 0;
      rain += (raining - rain) * (1 - Math.exp(-(raining ? RAIN_IN : RAIN_OUT) * dt));
      if (stage === "clean") {
        // What has run over people stays on them
        if (pouring) coat = Math.min(coat + dt / COAT_S, 1);
        // The pool rises while the sprinklers run and seeps away when they stop
        poured = Math.max(poured + (pouring ? dt : -dt * SEEP_RATE), 0);
        level = Math.min(Math.max((poured - PUDDLE_S) / FILL_S, 0), 1);
        if (level >= 1) {
          stage = "flooded";
          flooded = 0;
        }
      } else if (stage === "flooded") {
        // Under the blood the room turns into the bloody shot
        if ((flooded += dt) > FLOODED_S) {
          stage = "soaking";
          coat = 0;
        }
      } else if (stage === "soaking") {
        soak += dt / SOAK_S;
        if (soak >= 1) {
          soak = 0;
          level = 0;
          film = 1;
          stage = "bloody";
        }
      } else {
        film *= Math.exp(-dt / FILM_TAU);
      }
      const swapped = stage === "soaking" || stage === "bloody";

      const light = !started
        ? IDLE_LIGHT + Math.sin(t * 1.3) * 0.03
        : { off: STEADY_LIGHT, soft: SOFT_LIGHT, hard: DARK_LIGHT }[strobe] + ear.bass * BASS_PUMP;

      if (!imageSize) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      gl.uniform2f(u("uRes"), canvas.width, canvas.height);
      gl.uniform2f(u("uImg"), imageSize[0], imageSize[1]);
      gl.uniform1f(u("uTime"), t % 1000);
      gl.uniform1f(u("uLight"), light);
      gl.uniform1f(u("uFlash"), flash);
      gl.uniform3f(u("uTint"), tint[0], tint[1], tint[2]);
      gl.uniform1f(u("uZoom"), zoom);
      gl.uniform2f(u("uShift"), shift[0], shift[1]);
      gl.uniform1f(u("uTear"), tear);
      gl.uniform1f(u("uRain"), rain);
      gl.uniform1f(u("uCoat"), coat);
      gl.uniform1f(u("uLevel"), level);
      gl.uniform1f(u("uFilm"), film);
      gl.uniform1f(u("uSoak"), soak);
      gl.uniform1f(u("uSwap"), swapped ? 1 : 0);
      const focus = swapped ? BLOODY_FOCUS : FOCUS;
      gl.uniform2f(u("uFocus"), focus[0], focus[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // The type goes black while a hard flash burns the room white, and burgundy
      // wherever the blood has risen over it; after the flood all of it stays burgundy
      const poster = posterRef.current;
      if (poster) {
        const burnt = flash > 0.5 && strobe === "hard";
        const surface = swapped ? 2 : level * 1.14 - 0.07;
        poster.style.setProperty("--ink", burnt ? "#000" : "#fff");
        poster.style.setProperty("--ink-low", burnt ? "#000" : BURGUNDY);
        // The blood line measured from the bottom of the title's box
        const title = titleRef.current;
        const below = title ? window.innerHeight - title.offsetTop - title.offsetHeight - poster.offsetTop : 0;
        poster.style.setProperty("--pool", `${Math.max(surface, 0) * window.innerHeight - below}px`);
      }
    };

    // One click anywhere in the club opens the sprinklers for good
    const down = (e: PointerEvent) => {
      if (!live.current.started || live.current.pouring || (e.target as Element).closest("button, a")) return;
      live.current.pouring = true;
      setPouring(true);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", down);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", down);
      sound.dispose();
    };
  }, [sound]);

  // Lay the door picture over the screen like cover would, and cut it along the seam
  useEffect(() => {
    const door = doorRef.current;
    if (!door) return;
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = Math.max(w / DOOR_SIZE[0], h / DOOR_SIZE[1]);
      const dw = DOOR_SIZE[0] * scale;
      const dh = DOOR_SIZE[1] * scale;
      // Centered on the seam where the screen allows it, so the doors stay in view
      const x = Math.min(0, Math.max(w - dw, w / 2 - DOOR_SEAM * dw));
      door.style.setProperty("--door-w", `${dw}px`);
      door.style.setProperty("--door-h", `${dh}px`);
      door.style.setProperty("--door-x", `${x}px`);
      door.style.setProperty("--door-y", `${(h - dh) / 2}px`);
      door.style.setProperty("--seam", `${x + DOOR_SEAM * dw}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const enter = async () => {
    if (phase !== "idle") return;
    setPhase("starting");
    setTimeout(() => setInside(true), DOOR_MS + 100);
    try {
      await sound.start();
      live.current.started = true;
      setPhase("live");
    } catch {
      // No sound (the browser refused it): the doors are open anyway, go in
      live.current.started = true;
      setPhase("live");
    }
  };

  const started = phase === "live";
  const mono = "font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em]";

  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden bg-black text-white select-none">
      {/* The club, walked into as the doors open */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full transition-transform ease-out"
        style={{ transform: phase === "idle" ? "scale(1.18)" : "scale(1)", transitionDuration: `${DOOR_MS + 600}ms` }}
      />

      <header className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 whitespace-nowrap md:px-12 md:py-8 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] md:tracking-[0.3em]`}>
        <span className={`${anton.className} text-lg tracking-[0.2em] text-white`}>Bloodbath</span>
        <nav className="flex gap-4 text-white/55 md:gap-10">
          <button
            type="button"
            onClick={() => {
              const next = STROBE_NEXT[strobe];
              live.current.strobe = next;
              setStrobe(next);
              if (next === "off" && titleRef.current) titleRef.current.style.transform = "";
            }}
            className="uppercase transition-colors hover:text-white"
          >
            Strobe {strobe}
          </button>
          {started && (
            <button
              type="button"
              onClick={() => {
                sound.setMuted(!muted);
                setMuted(!muted);
              }}
              className="uppercase transition-colors hover:text-white"
            >
              {muted ? "Sound off" : "Sound on"}
            </button>
          )}
          <Link href="/" className="hidden transition-colors hover:text-white sm:inline">
            Labs
          </Link>
        </nav>
      </header>

      {/* The poster type: white, black on every hard flash */}
      <div
        ref={posterRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6 md:px-12 md:pb-10"
      >
        {/* The small print stays white: too thin to read in burgundy on red */}
        <div className={`mb-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-2 text-white opacity-80 ${mono}`}>
          <p>
            <span className="hidden sm:inline">Night 01 · </span>Sat 31.10 · 23:00 till sunrise
          </p>
          <p className="hidden sm:block">Underground · 138 BPM · Dress in black</p>
        </div>
        <h1
          ref={titleRef}
          className={`${anton.className} bg-clip-text whitespace-nowrap text-[clamp(4.5rem,17.5vw,20rem)] leading-[0.8] tracking-[-0.01em] text-transparent uppercase`}
          style={{
            // The fill is the title's own background clipped to its letters, so it
            // moves with the shake; burgundy below the blood line, white above it
            backgroundImage: "linear-gradient(to top, var(--ink-low, #1f0206) var(--pool, 0px), var(--ink, #fff) var(--pool, 0px))",
            // A white outline keeps the burgundy letters readable on the blood
            WebkitTextStroke: "max(1.5px, 0.012em) #fff",
          }}
        >
          Blood rave
        </h1>
      </div>

      {/* Before the music: the doors. Click and they swing open into the club */}
      {!inside && (
        <div
          ref={doorRef}
          onClick={enter}
          className={`absolute inset-0 z-[5] [perspective:1400px] ${phase === "idle" ? "cursor-pointer" : "pointer-events-none"}`}
        >
          {(["left", "right"] as const).map((side) => (
            <div
              key={side}
              className="absolute inset-y-0 overflow-hidden ease-[cubic-bezier(0.6,0,0.2,1)] [backface-visibility:hidden] [transition-property:transform]"
              style={{
                left: side === "left" ? 0 : "var(--seam)",
                right: side === "left" ? "calc(100% - var(--seam))" : 0,
                transformOrigin: side === "left" ? "left center" : "right center",
                transform: phase === "idle" ? "rotateY(0deg)" : `rotateY(${side === "left" ? 105 : -105}deg)`,
                transitionDuration: `${DOOR_MS}ms`,
                backgroundImage: `url(${DOOR_SRC})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "var(--door-w) var(--door-h)",
                backgroundPosition:
                  side === "left" ? "var(--door-x) var(--door-y)" : "calc(var(--door-x) - var(--seam)) var(--door-y)",
              }}
            >
              {/* Each leaf darkens as it turns away from the light */}
              <div
                className="absolute inset-0 bg-black transition-opacity ease-in"
                style={{ opacity: phase === "idle" ? 0 : 0.85, transitionDuration: `${DOOR_MS}ms` }}
              />
            </div>
          ))}

          <div
            className={`absolute top-[42%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-5 transition-opacity duration-300 ${
              phase === "idle" ? "opacity-100" : "opacity-0"
            }`}
            style={{ left: "var(--seam)" }}
          >
            <button
              type="button"
              disabled={phase !== "idle" || failed}
              className={`${anton.className} group relative flex h-36 w-36 items-center justify-center rounded-full border border-white/40 bg-black/40 text-xl tracking-[0.12em] text-white uppercase backdrop-blur-sm transition-[transform,background-color,border-color] duration-300 hover:scale-105 hover:border-[#ff2a3d] hover:bg-[#ff2a3d]/20 md:h-44 md:w-44 md:text-2xl`}
            >
              <span className="absolute inset-0 animate-ping rounded-full border border-[#ff2a3d]/50 [animation-duration:1.8s]" />
              <span className="leading-none">
                Enter
                <br />
                the rave
              </span>
            </button>
            <p className={`text-center whitespace-nowrap text-white/60 ${mono} text-[10px]`}>Sound on</p>
          </div>
        </div>
      )}

      {/* In the club, until the sprinklers open */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-24 flex justify-center px-6 text-center transition-opacity duration-700 md:top-28 ${
          started && !pouring ? "opacity-100 delay-700" : "opacity-0"
        }`}
      >
        <p className={`text-white/45 ${mono}`}>
          <span className="pointer-coarse:hidden">Click to open the sprinklers</span>
          <span className="hidden pointer-coarse:inline">Tap to open the sprinklers</span>
        </p>
      </div>

      {failed && (
        <p className={`absolute inset-x-0 top-1/2 text-center text-white/55 ${mono}`}>This browser has no WebGL2</p>
      )}
    </main>
  );
}
