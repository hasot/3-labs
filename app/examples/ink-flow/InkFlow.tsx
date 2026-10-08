"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DISPLAY_LIB, MAX_STEPS, N, createBrush, createFluid, hexToLinear } from "./fluid";

// The shaders.com hero: <SolidColor #0F0F10/> + <Stone intensity=1 scale=200>
// <InkFlow custom colors/></Stone>, with the fluid itself in ./fluid.ts

const BG = "#0F0F10";
// The brush cycles color1 → color2 → color3 → color1 in OKLab as you paint
const COLORS = ["#2216f7", "#55bdff", "#a702ff"];

const MAX_DPR = 2;
const MAX_DT = 0.033;

// InkFlow props, the library defaults the hero uses
const RADIUS = 0.3;
const FORCE = 1;
const CURL = 0;
const DECAY = 0.5;
const MOMENTUM = 0.6;
const COLOR_SPEED = 1;

const IMPULSE_K = 0.16;
const CYCLE_PER_SPLAT = 0.006;
const CYCLE_TIME_RATE = 0.06;
// Velocity damping per second: momentum 0 stops at once, 1 coasts on and on
const VEL_FADE = 4 * Math.pow(0.05 / 4, MOMENTUM);
// Display alpha is the brightest dye channel times this
const GAIN = 1.35;
// Cursor jumps longer than this (share of the screen) per frame draw nothing
const TELEPORT = 0.25;
const MIN_DRAG = 6e-4;
// The sim stops once the ink has faded to 1/64 after the last stroke
const IDLE_AFTER = Math.log(64) / Math.max(DECAY, 0.05);

// Ink opacity range over which the hidden copy fades in, and how much of the
// ink's hue the letters take on (0 white, 1 the ink color)
const TEXT_REVEAL = ["0.04", "0.45"];
const TEXT_TINT = "0.3";

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uDye;
uniform sampler2D uText;
uniform vec2 uRes;
uniform vec3 uBg;
out vec4 outColor;
${DISPLAY_LIB}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 st = stone(uv, uRes);
  vec3 dye = texture(uDye, st.xy).rgb;
  float peak = max(dye.r, max(dye.g, dye.b));
  float alpha = clamp(peak * ${GAIN.toFixed(2)}, 0.0, 1.0);
  vec3 col = mix(uBg, dye * st.z, alpha);

  // The copy is painted in the background color: it only shows where the ink is,
  // lit up near white and tinted by the ink that carries it
  float glyph = texture(uText, uv).r;
  float reveal = smoothstep(${TEXT_REVEAL[0]}, ${TEXT_REVEAL[1]}, alpha);
  vec3 tint = dye / max(peak, 1e-4);
  vec3 lit = mix(vec3(1.0), tint, ${TEXT_TINT}) * mix(1.0, st.z, 0.5);
  col = mix(col, lit, glyph * reveal);
  outColor = vec4(toSrgb(col), 1.0);
}
`;

export function InkFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      setFailed(true);
      return;
    }
    const fluid = createFluid(gl);
    const display = fluid.program(DISPLAY_FS);
    const bg = hexToLinear(BG);
    const brush = createBrush(COLORS, CYCLE_PER_SPLAT * COLOR_SPEED, CYCLE_TIME_RATE * COLOR_SPEED);

    // The hidden copy as a mask: every word of the DOM text is drawn at the spot the
    // browser laid it out, so the reveal lines up with the real (transparent) letters
    const textTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const textCanvas = document.createElement("canvas");
    const paintText = () => {
      const copy = copyRef.current;
      const ctx = textCanvas.getContext("2d");
      if (!copy || !ctx) return;
      textCanvas.width = canvas.width;
      textCanvas.height = canvas.height;
      const box = canvas.getBoundingClientRect();
      ctx.setTransform(canvas.width / box.width, 0, 0, canvas.height / box.height, 0, 0);
      ctx.fillStyle = "#fff";
      const range = document.createRange();
      copy.querySelectorAll("[data-reveal]").forEach((el) => {
        const node = el.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) return;
        const cs = getComputedStyle(el);
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
        for (const word of (node.textContent ?? "").matchAll(/\S+/g)) {
          range.setStart(node, word.index);
          range.setEnd(node, word.index + word[0].length);
          const r = range.getBoundingClientRect();
          const ascent = ctx.measureText(word[0]).fontBoundingBoxAscent;
          ctx.fillText(word[0], r.left - box.left, r.top - box.top + ascent);
        }
      });
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      paintText();
      draw();
    };

    // Pointer in 0..1 of the canvas, y up like the grid
    let pointer: { x: number; y: number } | null = null;
    let prev: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    };
    // A finger lifted and put down elsewhere is a jump, not a stroke
    const onDown = (e: PointerEvent) => {
      onMove(e);
      prev = pointer;
    };

    const posArr = new Float32Array(MAX_STEPS * 2);
    const colArr = new Float32Array(MAX_STEPS * 3);
    const radius = Math.max(RADIUS * 0.1 * N, 1);
    const stepSize = Math.max(0.004, (radius / N) * 0.6);

    // Brush strokes laid along the path the cursor took since the last frame
    const stroke = (dt: number) => {
      if (!pointer) return false;
      if (!prev) prev = pointer;
      const dx = pointer.x - prev.x;
      const dy = pointer.y - prev.y;
      const dist = Math.hypot(dx, dy);
      const from = prev;
      prev = pointer;
      if (dist >= TELEPORT || dist <= MIN_DRAG) return false;

      const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(dist / stepSize)));
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;
        posArr[s * 2] = (from.x + dx * t) * N;
        posArr[s * 2 + 1] = (from.y + dy * t) * N;
        colArr.set(brush.next(), s * 3);
      }
      const k = (N * FORCE * IMPULSE_K) / Math.max(dt, 0.001);
      fluid.splat(posArr, steps, radius, [dx * k, dy * k], colArr);
      return true;
    };

    function draw() {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.useProgram(display.p);
      fluid.bindTex(0, display.u("uDye"), fluid.dye());
      fluid.bindTex(1, display.u("uText"), textTex);
      gl!.uniform2f(display.u("uRes"), canvas.width, canvas.height);
      gl!.uniform3f(display.u("uBg"), bg[0], bg[1], bg[2]);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    let raf = 0;
    let last = performance.now();
    // Seconds since the last stroke; the sim sleeps once the ink is gone
    let idle = Infinity;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      if (dt < 0.001) return;
      brush.drift(dt);

      if (stroke(dt)) {
        if (idle === Infinity) setPainted(true);
        idle = 0;
      }
      if (idle > IDLE_AFTER) return;
      idle += dt;
      fluid.step(dt, { curl: CURL, velFade: VEL_FADE, dyeFade: DECAY });
      draw();
    };

    resize();
    // Web fonts may land after the first paint; redraw the mask with the real ones
    document.fonts.ready.then(() => {
      paintText();
      draw();
    });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <main className="relative h-dvh w-full touch-none overflow-hidden bg-[#0F0F10] text-white select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/50 md:px-12 md:py-8">
        <span>Ink Flow</span>
        <Link href="/" className="pointer-events-auto transition-colors hover:text-white">
          Labs
        </Link>
      </header>

      <div
        ref={copyRef}
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center ${
          failed ? "text-white" : "text-transparent"
        }`}
      >
        <h1
          data-reveal
          className="max-w-[720px] text-balance font-[family-name:var(--font-geist-sans)] text-[40px] leading-none font-medium tracking-[-0.05em] sm:text-[52px] lg:text-[74px]"
        >
          Ink in the dark.
        </h1>
        <p
          data-reveal
          className="mt-[30px] max-w-[540px] text-balance text-base leading-[1.5] tracking-[0.01em]"
        >
          A real fluid field lives under the cursor. The ink drifts, curls and keeps moving after
          you stop.
        </p>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-center gap-3 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/45 transition-opacity duration-700 ${
          painted || failed ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="h-px w-8 bg-[#55bdff]/70" />
        <span className="pointer-coarse:hidden">Move the cursor</span>
        <span className="hidden pointer-coarse:inline">Drag your finger</span>
        <span className="h-px w-8 bg-[#55bdff]/70" />
      </div>

      {failed && (
        <p className="absolute inset-x-0 bottom-10 text-center font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-white/45">
          This browser has no WebGL2 float targets
        </p>
      )}
    </main>
  );
}
