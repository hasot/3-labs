"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DISPLAY_LIB, MAX_STEPS, createFluid, hexToLinear } from "./fluid";
import { createSmokeSound } from "./smokeSound";

// SmokeFill smoke (shaders.com, MIT) poured by the cursor, over a giant word. Two
// walled fluids from ./fluid.ts: one fills the screen around the letters, the
// other lives inside them, so the letters are vessels of their own. Wherever the
// cursor goes it pours smoke that swirls in rings, faster strokes pour more, and a
// wisp fades in about five seconds

const BG = "#0F0F10";

const MAX_DPR = 2;
const MAX_DT = 0.033;
// Cursor jumps longer than this (share of the screen) per frame pour nothing
const TELEPORT = 0.25;
const MIN_DRAG = 6e-4;

const WORD = "NOTHING";
// The word fills this share of the screen width, its capitals at most this share
// of the height
const WORD_WIDTH = 0.92;
const WORD_HEIGHT = 0.6;
// Capital height of the font, in em
const CAP_HEIGHT = 0.72;

// Grids: rows of the one inside the word's box, and about how many cells the one
// over the whole screen gets
const FILL_ROWS = 180;
const OPEN_CELLS = 640 * 400;

// The smoke, the same in and out of the letters. Sizes and speeds are in word
// heights (the height of the word's box), so both grids pour alike.
// Fresh smoke and the color it ages into (the SmokeFill defaults)
const FRESH = "#8cf3ff";
const AGED = "#04a0d6";
// The cursor pours: how wide, the cone it spreads into, and how much of its own
// speed the smoke takes along, up to the SmokeFill source's speed
const EMIT_RADIUS = 0.05;
const SPREAD = 60;
const JET = 0.8;
const MAX_JET = 1.5;
// Each puff spins around where it lands, so the smoke curls into rings; word
// heights per second at the rim
const SPIN = 1.2;
// Power: smoke poured per (word heights per second) of cursor speed, capped
const POWER = 2.1;
const MAX_POWER = 7;
// Fade per second: a thin wisp is gone in about five seconds (e^-0.6·5 ≈ 1/20),
// thick smoke takes longer
const DISSIPATION = 0.6;
// Swirl detail (vorticity confinement), sinking, and how long the air keeps moving
const DETAIL = 40;
const GRAVITY = 0.15;
const VEL_FADE = 0.1;
const COLOR_DECAY = 0.4;
// Smoke from around that drifts up against a letter seeps in, weakly: the share of
// its density let in per second, and how far past the edge it is felt (word heights)
const SEEP = 0.8;
const SEEP_REACH = 0.03;
// Sound: how much "smoke in the air" a unit of pouring power adds per second; it
// fades at DISSIPATION, like the smoke itself
const SOUND_SMOKE = 0.06;
// The cursor also pushes the smoke already there
const MOUSE_INFLUENCE = 0.6;
const MOUSE_RADIUS = 0.1;
// How thick a unit of density looks, and how bright the smoke glows
const THICKNESS = 3.5;
const BRIGHT = 1.3;

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uOpen;   // smoke around the letters: density (r), age (g)
uniform sampler2D uFill;   // smoke in the letters: density (r), age (g)
uniform sampler2D uText;   // the letters, sharp, at screen resolution
uniform vec2 uRes;
uniform vec4 uBox;         // the letters' grid on screen: x, y (from the bottom), w, h in device px
uniform vec3 uBg;
uniform vec3 uFresh;
uniform vec3 uAged;
out vec4 outColor;
${DISPLAY_LIB}
vec3 smoke(vec2 s, float shade) {
  vec3 c = mix(uFresh, uAged, s.g) * ${BRIGHT.toFixed(2)} * shade;
  return mix(uBg, c, 1.0 - exp(-s.r * ${THICKNESS.toFixed(2)}));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 st = stone(uv, uRes);
  float glyph = texture(uText, uv).r;
  vec3 around = smoke(texture(uOpen, st.xy).rg, st.z);
  vec3 inside = smoke(texture(uFill, (st.xy * uRes - uBox.xy) / uBox.zw).rg, st.z);
  outColor = vec4(toSrgb(mix(around, inside, glyph)), 1.0);
}
`;

// SmokeFill sources along the cursor's path: the velocity near each one is blended
// toward a cone of jets that also spins around it, dense smoke sinks, and the
// cursor pushes whatever is under it
const pourVelFS = (header: string) => `${header}
uniform sampler2D uVel;
uniform sampler2D uDye;
uniform vec2 uEmit[${MAX_STEPS}];
uniform int uEmitCount;
uniform float uEmitRad;
uniform vec2 uEmitVel;
uniform vec2 uPerp;
uniform float uSpread;
uniform float uSpin;
uniform float uGravity;
uniform float uDt;
uniform vec2 uCursor;
uniform vec2 uCursorVel;
uniform float uMouseRad;
void main() {
  ivec2 c = cell();
  vec2 p = vec2(c) + 0.5;
  float m = open(c);
  vec4 v = texelFetch(uVel, c, 0);
  float dens = texelFetch(uDye, c, 0).r;
  float r2 = max(uEmitRad * uEmitRad, 1.0);
  float speed = length(uEmitVel);
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (i >= uEmitCount) break;
    vec2 d = p - uEmit[i];
    float inf = exp(-dot(d, d) / r2) * m;
    // Across the source the jets fan out into the cone
    float across = dot(d, uPerp) / max(uEmitRad, 1.0);
    vec2 jet = uEmitVel + uPerp * across * uSpread * speed;
    // and the whole puff turns around its centre, fastest at its rim
    vec2 swirl = vec2(-d.y, d.x) / max(uEmitRad, 1.0) * uSpin;
    v.xy = mix(v.xy, jet + swirl, min(inf * uDt * 3.0, 1.0));
  }
  v.y -= uGravity * dens * uDt * m;
  vec2 dc = p - uCursor;
  v.xy += uCursorVel * exp(-dot(dc, dc) / max(uMouseRad * uMouseRad, 1.0)) * m;
  outColor = vec4(v.xy, v.z, 0.0);
}
`;

// Smoke poured in at the sources; fresh smoke resets the age of what it lands on.
// The letters also let in a little of the smoke pressing on them from outside
const pourDyeFS = (header: string) => `${header}
uniform sampler2D uDye;
uniform vec2 uEmit[${MAX_STEPS}];
uniform int uEmitCount;
uniform float uEmitRad;
uniform float uIntensity;
uniform float uDt;
uniform sampler2D uSeep;    // the smoke around, density (r) and age (g), screen uv
uniform float uSeepRate;
uniform vec4 uToScreen;     // this grid's cells to screen uv: offset xy, size zw
uniform vec2 uSeepReach;    // in screen uv
void main() {
  ivec2 c = cell();
  vec2 p = vec2(c) + 0.5;
  float m = open(c);
  vec4 d = texelFetch(uDye, c, 0);
  float dens = d.r;
  float age = d.g;
  float r2 = max(uEmitRad * uEmitRad, 1.0);
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (i >= uEmitCount) break;
    vec2 e = p - uEmit[i];
    float add = uIntensity * exp(-dot(e, e) / r2) * m * uDt * 8.0;
    float next = min(dens + add, 1.0);
    age *= 1.0 - min(add / max(next, 0.001), 1.0);
    dens = next;
  }
  if (uSeepRate > 0.0 && m > 0.0) {
    // The thickest smoke just outside, looking a little way all around
    vec2 suv = uToScreen.xy + (p / vec2(SIZE)) * uToScreen.zw;
    vec2 near = vec2(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec2 s = texture(uSeep, suv + vec2(cos(a), sin(a)) * uSeepReach).rg;
      if (s.r > near.r) near = s;
    }
    float add = near.r * uSeepRate * uDt;
    float next = min(dens + add, 1.0);
    age = mix(age, near.g, min(add / max(next, 0.001), 1.0));
    dens = next;
  }
  outColor = vec4(dens, age, 0.0, 0.0);
}
`;

type Fluid = ReturnType<typeof createFluid>;
// A walled fluid with its pouring passes, laid over a rect of the screen (device
// px, y down)
type Vessel = {
  fluid: Fluid;
  vel: ReturnType<Fluid["program"]>;
  dye: ReturnType<Fluid["program"]>;
  rect: { x: number; y: number; w: number; h: number };
};

function vessel(gl: WebGL2RenderingContext, w: number, h: number): Vessel {
  const fluid = createFluid(gl, w, h);
  return {
    fluid,
    vel: fluid.program(pourVelFS(fluid.header)),
    dye: fluid.program(pourDyeFS(fluid.header)),
    rect: { x: 0, y: 0, w: 1, h: 1 },
  };
}

export function InkFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordRef = useRef<HTMLHeadingElement>(null);
  const [painted, setPainted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sound] = useState(createSmokeSound);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      setFailed(true);
      return;
    }
    const bg = hexToLinear(BG);
    const fresh = hexToLinear(FRESH);
    const aged = hexToLinear(AGED);

    // Square-ish cells over the screen
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    const oh = Math.round(Math.sqrt(OPEN_CELLS / aspect));
    const around = vessel(gl, Math.round(oh * aspect), oh);
    const display = around.fluid.program(DISPLAY_FS);
    // The letters' grid is sized from the first layout of the word
    let inside: Vessel | null = null;

    const maskTexture = () => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return tex;
    };
    const upload = (tex: WebGLTexture, source: HTMLCanvasElement) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    };

    // The letters as masks: the DOM word is drawn where the browser laid it out,
    // at screen resolution (crisp edges), on the letters' grid (their walls, open
    // inside) and on the screen grid (walls for the smoke around, open outside).
    // White on opaque black, or the soft edges would upload as solid white
    const textTex = maskTexture();
    const insideWalls = maskTexture();
    const aroundWalls = maskTexture();
    const textCanvas = document.createElement("canvas");
    const wallCanvas = document.createElement("canvas");
    // Word height in device px, the unit of the smoke's sizes and speeds
    let unit = 1;
    const paintText = () => {
      const el = wordRef.current;
      const node = el?.firstChild;
      const ctx = textCanvas.getContext("2d");
      if (!el || !node || node.nodeType !== Node.TEXT_NODE || !ctx) return;
      const view = canvas.getBoundingClientRect();
      const scale = canvas.width / view.width;
      textCanvas.width = canvas.width;
      textCanvas.height = canvas.height;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = "#fff";
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      const ascent = ctx.measureText(WORD).fontBoundingBoxAscent;
      ctx.fillText(WORD, r.left - view.left, r.top - view.top + ascent);
      upload(textTex, textCanvas);

      // The letters' grid covers the word with a little margin
      const pad = r.height * 0.06;
      const box = {
        x: (r.left - view.left - pad) * scale,
        y: (r.top - view.top - pad) * scale,
        w: (r.width + pad * 2) * scale,
        h: (r.height + pad * 2) * scale,
      };
      unit = box.h;
      inside ??= vessel(gl, Math.round((FILL_ROWS * box.w) / box.h), FILL_ROWS);
      inside.rect = box;
      around.rect = { x: 0, y: 0, w: canvas.width, h: canvas.height };

      const fill = inside.fluid;
      wallCanvas.width = fill.width;
      wallCanvas.height = fill.height;
      const wctx = wallCanvas.getContext("2d")!;
      wctx.drawImage(textCanvas, box.x, box.y, box.w, box.h, 0, 0, fill.width, fill.height);
      upload(insideWalls, wallCanvas);
      fill.setSolid(insideWalls);

      // Around: the letters inverted, so they are solid
      const open = around.fluid;
      wallCanvas.width = open.width;
      wallCanvas.height = open.height;
      wctx.fillStyle = "#fff";
      wctx.fillRect(0, 0, open.width, open.height);
      wctx.globalCompositeOperation = "difference";
      wctx.drawImage(textCanvas, 0, 0, open.width, open.height);
      wctx.globalCompositeOperation = "source-over";
      upload(aroundWalls, wallCanvas);
      open.setSolid(aroundWalls);
    };

    // Giant word: as wide as the screen allows, unless that makes it too tall
    const fitWord = () => {
      const el = wordRef.current;
      if (!el) return;
      el.style.fontSize = "100px";
      const range = document.createRange();
      range.selectNodeContents(el);
      const width = range.getBoundingClientRect().width;
      const view = canvas.getBoundingClientRect();
      const size = Math.min((view.width * WORD_WIDTH * 100) / Math.max(width, 1), (view.height * WORD_HEIGHT) / CAP_HEIGHT);
      el.style.fontSize = `${size}px`;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      fitWord();
      paintText();
    };

    // Pointer in 0..1 of the canvas, y up
    let pointer: { x: number; y: number } | null = null;
    let prev: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    };
    // A finger lifted and put down elsewhere is a jump, not a stroke. The first
    // press anywhere also lets the sound in (browsers want a gesture for audio)
    let soundAsked = false;
    const onDown = (e: PointerEvent) => {
      onMove(e);
      prev = pointer;
      if (!soundAsked && !(e.target as Element).closest("[data-sound]")) {
        soundAsked = true;
        sound.enable();
        setSoundOn(true);
      }
    };

    // This frame's cursor move in screen uv, or null when it did not move
    let move: { x: number; y: number; dx: number; dy: number } | null = null;
    const track = () => {
      move = null;
      if (!pointer) return;
      if (!prev) prev = pointer;
      const dx = pointer.x - prev.x;
      const dy = pointer.y - prev.y;
      const dist = Math.hypot(dx, dy);
      prev = pointer;
      if (dist >= TELEPORT || dist <= MIN_DRAG) return;
      move = { x: pointer.x, y: pointer.y, dx, dy };
      setPainted(true);
    };

    // SmokeFill poured along the cursor's path: blown the way it moves, spinning,
    // as much as it is fast; then the walled fluid moves
    const spread = Math.tan(Math.min((89 * Math.PI) / 180, (SPREAD * Math.PI) / 360));
    const emitPos = new Float32Array(MAX_STEPS * 2);
    const pour = (v: Vessel, dt: number, seep?: Vessel) => {
      const { fluid, rect } = v;
      // Cells per device px, and the word height in cells
      const cell = fluid.width / rect.w;
      const word = unit * cell;
      let count = 0;
      let jet = [0, 0];
      let perp = [1, 0];
      let spin = 0;
      let power = 0;
      if (move) {
        // The path in grid cells, y up
        const x1 = (move.x * canvas.width - rect.x) * cell;
        const y1 = fluid.height - ((1 - move.y) * canvas.height - rect.y) * cell;
        const mx = move.dx * canvas.width * cell;
        const my = move.dy * canvas.height * cell;
        const len = Math.hypot(mx, my);
        count = Math.min(MAX_STEPS, Math.max(1, Math.ceil(len / (EMIT_RADIUS * word * 0.6))));
        for (let s = 0; s < count; s++) {
          const t = (s + 1) / count;
          emitPos[s * 2] = x1 - mx * (1 - t);
          emitPos[s * 2 + 1] = y1 - my * (1 - t);
        }
        const speed = len / Math.max(dt, 0.001);
        const thrown = Math.min(speed * JET, MAX_JET * word) / Math.max(len, 1e-3);
        jet = [mx * thrown, my * thrown];
        perp = [-my / Math.max(len, 1e-3), mx / Math.max(len, 1e-3)];
        // Moving right the puffs turn one way, moving left the other
        spin = SPIN * word * (mx >= 0 ? -1 : 1);
        power = Math.min((speed / word) * POWER, MAX_POWER) / count;
      }
      fluid.pass(v.vel, "velocity", () => {
        gl.uniform2fv(v.vel.u("uEmit"), emitPos);
        gl.uniform1i(v.vel.u("uEmitCount"), count);
        gl.uniform1f(v.vel.u("uEmitRad"), EMIT_RADIUS * word);
        gl.uniform2f(v.vel.u("uEmitVel"), jet[0], jet[1]);
        gl.uniform2f(v.vel.u("uPerp"), perp[0], perp[1]);
        gl.uniform1f(v.vel.u("uSpread"), spread);
        gl.uniform1f(v.vel.u("uSpin"), spin);
        gl.uniform1f(v.vel.u("uGravity"), GRAVITY * word * 0.08 * 10);
        gl.uniform1f(v.vel.u("uDt"), dt);
        gl.uniform2f(v.vel.u("uCursor"), count ? emitPos[(count - 1) * 2] : -1e4, count ? emitPos[(count - 1) * 2 + 1] : -1e4);
        gl.uniform2f(v.vel.u("uCursorVel"), jet[0] * dt * 15 * MOUSE_INFLUENCE, jet[1] * dt * 15 * MOUSE_INFLUENCE);
        gl.uniform1f(v.vel.u("uMouseRad"), MOUSE_RADIUS * word);
      });
      fluid.pass(v.dye, "dye", () => {
        gl.uniform2fv(v.dye.u("uEmit"), emitPos);
        gl.uniform1i(v.dye.u("uEmitCount"), count);
        gl.uniform1f(v.dye.u("uEmitRad"), EMIT_RADIUS * word);
        gl.uniform1f(v.dye.u("uIntensity"), power);
        gl.uniform1f(v.dye.u("uDt"), dt);
        fluid.bindTex(2, v.dye.u("uSeep"), (seep ?? v).fluid.dye());
        gl.uniform1f(v.dye.u("uSeepRate"), seep ? SEEP : 0);
        gl.uniform4f(
          v.dye.u("uToScreen"),
          rect.x / canvas.width,
          1 - (rect.y + rect.h) / canvas.height,
          rect.w / canvas.width,
          rect.h / canvas.height,
        );
        gl.uniform2f(v.dye.u("uSeepReach"), (SEEP_REACH * unit) / canvas.width, (SEEP_REACH * unit) / canvas.height);
      });
      fluid.step(dt, { curl: DETAIL, velFade: VEL_FADE, dyeFade: DISSIPATION, ageRate: 0.4 * COLOR_DECAY });
    };

    const draw = () => {
      if (!inside) return;
      const box = inside.rect;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(display.p);
      around.fluid.bindTex(0, display.u("uOpen"), around.fluid.dye());
      around.fluid.bindTex(1, display.u("uFill"), inside.fluid.dye());
      around.fluid.bindTex(2, display.u("uText"), textTex);
      gl.uniform2f(display.u("uRes"), canvas.width, canvas.height);
      gl.uniform4f(display.u("uBox"), box.x, canvas.height - box.y - box.h, box.w, box.h);
      gl.uniform3f(display.u("uBg"), bg[0], bg[1], bg[2]);
      gl.uniform3f(display.u("uFresh"), fresh[0], fresh[1], fresh[2]);
      gl.uniform3f(display.u("uAged"), aged[0], aged[1], aged[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    let last = performance.now();
    let airborne = 0;
    let soundX = 0.5;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      if (dt < 0.001 || !inside) return;
      track();
      // Sound follows the cursor's speed and the smoke it leaves in the air
      const speed = move ? Math.hypot(move.dx * canvas.width, move.dy * canvas.height) / unit / dt : 0;
      airborne = Math.min(airborne * Math.exp(-DISSIPATION * dt) + Math.min(speed * POWER, MAX_POWER) * SOUND_SMOKE * dt, 1.5);
      if (move) soundX = move.x;
      sound.update(speed, soundX, airborne);
      pour(around, dt);
      pour(inside, dt, around);
      draw();
    };

    resize();
    // The web font lands after the first layout and is wider than the fallback:
    // ask for the exact face the word uses, and refit whenever a font arrives
    const refit = () => {
      fitWord();
      paintText();
    };
    const word = wordRef.current;
    if (word) {
      const cs = getComputedStyle(word);
      document.fonts.load(`${cs.fontWeight} 100px ${cs.fontFamily}`, WORD).then(refit, () => {});
    }
    document.fonts.ready.then(refit);
    document.fonts.addEventListener("loadingdone", refit);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.fonts.removeEventListener("loadingdone", refit);
      sound.dispose();
    };
  }, [sound]);

  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden bg-[#0F0F10] text-white select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/50 md:px-12 md:py-8">
        <span>Ink Flow</span>
        <nav className="pointer-events-auto flex gap-6 md:gap-10">
          <button
            type="button"
            data-sound
            onClick={() => {
              if (sound.on) sound.disable();
              else sound.enable();
              setSoundOn(sound.on);
            }}
            className="uppercase tracking-[0.3em] transition-colors hover:text-white"
          >
            {soundOn ? "Sound on" : "Sound off"}
          </button>
          <Link href="/" className="transition-colors hover:text-white">
            Labs
          </Link>
        </nav>
      </header>

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center ${
          failed ? "text-white" : "text-transparent"
        }`}
      >
        <h1
          ref={wordRef}
          className="whitespace-nowrap font-[family-name:var(--font-geist-sans)] text-[20vw] leading-none font-black tracking-[-0.06em]"
        >
          {WORD}
        </h1>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-center gap-3 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/45 transition-opacity duration-700 ${
          painted || failed ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="h-px w-8 bg-[#8cf3ff]/70" />
        <span className="pointer-coarse:hidden">Click for sound, swipe across the letters</span>
        <span className="hidden pointer-coarse:inline">Tap for sound, swipe across the letters</span>
        <span className="h-px w-8 bg-[#8cf3ff]/70" />
      </div>

      {failed && (
        <p className="absolute inset-x-0 bottom-10 text-center font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/45">
          This browser has no WebGL2 float targets
        </p>
      )}
    </main>
  );
}
