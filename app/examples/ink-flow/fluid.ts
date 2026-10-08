// Stable-fluids ink, a WebGL2 port of the InkFlow component from shaders.com
// (MIT, github.com/shader-effects-inc/shaders). Their WebGPU compute kernels are
// redone as fragment passes on a grid that is stretched over the screen.

// Grid size the shaders.com component uses
export const N = 256;
const JACOBI_ITERS = 10;
// Pressure from the last frame is reused as the first guess, scaled by this
const PRESSURE_DECAY = 0.8;
// Brush splats laid in one frame, at most
export const MAX_STEPS = 16;

export type Vec3 = [number, number, number];

export function hexToLinear(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

function linearToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

// Brush color that walks a three-color cycle, mixing neighbours in OKLab.
// next() advances it by one splat, drift() by time
export function createBrush(colors: string[], perSplat: number, perSecond: number) {
  const stops = colors.map((c) => linearToOklab(hexToLinear(c)));
  let hue = 0;
  return {
    drift(dt: number) {
      hue += dt * perSecond;
    },
    next(): Vec3 {
      hue += perSplat;
      const h = ((hue % 1) + 1) % 1;
      const seg = Math.min(stops.length - 1, Math.floor(h * stops.length));
      const t = h * stops.length - seg;
      const a = stops[seg];
      const b = stops[(seg + 1) % stops.length];
      return oklabToLinear([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    },
  };
}

const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Every sim pass runs on the W×H grid; a cell's index is gl_FragCoord - 0.5
const header = (w: number, h: number) => `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 outColor;
const ivec2 SIZE = ivec2(${w}, ${h});
ivec2 cell() { return ivec2(gl_FragCoord.xy); }
// Clamped neighbour, so the walls mirror the edge cell
vec4 at(sampler2D t, ivec2 c) { return texelFetch(t, clamp(c, ivec2(0), SIZE - 1), 0); }
// Solid mask over the grid: 1 where the fluid may go, 0 inside walls
uniform sampler2D uSolid;
float open(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= SIZE.x || c.y >= SIZE.y) return 0.0;
  return step(0.5, texture(uSolid, (vec2(c) + 0.5) / vec2(SIZE)).r);
}
`;

// One frame of brush strokes: every splat along the path, in order. Each one only
// touches its own cell, so running them in a loop here equals running them as passes
const SPLAT_DYE = (H: string) => `${H}
uniform sampler2D uDye;
uniform vec2 uPos[${MAX_STEPS}];
uniform vec3 uCol[${MAX_STEPS}];
uniform int uCount;
uniform float uRadius;
void main() {
  ivec2 c = cell();
  vec2 p = vec2(c) + 0.5;
  vec3 dye = texelFetch(uDye, c, 0).rgb;
  float r2 = max(uRadius * uRadius, 1.0);
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (i >= uCount) break;
    vec2 d = p - uPos[i];
    float w = clamp(exp(-dot(d, d) / r2), 0.0, 1.0);
    dye = mix(dye, uCol[i], w);
  }
  outColor = vec4(dye, 0.0);
}
`;

const SPLAT_VEL = (H: string) => `${H}
uniform sampler2D uVel;
uniform vec2 uPos[${MAX_STEPS}];
uniform vec2 uImpulse[${MAX_STEPS}];
uniform int uCount;
uniform float uRadius;
void main() {
  ivec2 c = cell();
  vec2 p = vec2(c) + 0.5;
  vec4 vel = texelFetch(uVel, c, 0);
  float r2 = max(uRadius * uRadius, 1.0);
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (i >= uCount) break;
    vec2 d = p - uPos[i];
    vel.xy += uImpulse[i] * exp(-dot(d, d) / r2);
  }
  outColor = vec4(vel.xy, vel.z, 0.0);
}
`;

// Vorticity goes into z for the confinement pass
const CURL_FS = (H: string) => `${H}
uniform sampler2D uVel;
void main() {
  ivec2 c = cell();
  vec4 vL = at(uVel, c + ivec2(-1, 0));
  vec4 vR = at(uVel, c + ivec2(1, 0));
  vec4 vD = at(uVel, c + ivec2(0, -1));
  vec4 vU = at(uVel, c + ivec2(0, 1));
  vec4 v = texelFetch(uVel, c, 0);
  outColor = vec4(v.xy, ((vR.y - vL.y) - (vU.x - vD.x)) * 0.5, 0.0);
}
`;

const VORTICITY_FS = (H: string) => `${H}
uniform sampler2D uVel;
uniform float uCurl;
uniform float uDt;
void main() {
  ivec2 c = cell();
  float cL = abs(at(uVel, c + ivec2(-1, 0)).z);
  float cR = abs(at(uVel, c + ivec2(1, 0)).z);
  float cD = abs(at(uVel, c + ivec2(0, -1)).z);
  float cU = abs(at(uVel, c + ivec2(0, 1)).z);
  vec4 v = texelFetch(uVel, c, 0);
  vec2 g = vec2(cR - cL, cU - cD) * 0.5;
  g /= max(length(g), 1e-5);
  vec2 f = vec2(g.y, -g.x) * v.z * uCurl * uDt;
  outColor = vec4(v.xy + f, v.z, 0.0);
}
`;

// Dense ink pushes the fluid along uForce, like warm smoke rising
const BUOYANCY_FS = (H: string) => `${H}
uniform sampler2D uVel;
uniform sampler2D uDye;
uniform vec2 uForce;
uniform float uDt;
void main() {
  ivec2 c = cell();
  vec4 v = texelFetch(uVel, c, 0);
  vec3 d = texelFetch(uDye, c, 0).rgb;
  outColor = vec4(v.xy + uForce * max(d.r, max(d.g, d.b)) * uDt, v.z, 0.0);
}
`;

// At a wall (the screen edge or a solid cell) the cell beyond mirrors the normal
// velocity, so nothing leaks out
const DIVERGENCE_FS = (H: string) => `${H}
uniform sampler2D uVel;
void main() {
  ivec2 c = cell();
  vec2 v = texelFetch(uVel, c, 0).xy;
  float L = open(c + ivec2(-1, 0)) < 0.5 ? -v.x : at(uVel, c + ivec2(-1, 0)).x;
  float R = open(c + ivec2(1, 0)) < 0.5 ? -v.x : at(uVel, c + ivec2(1, 0)).x;
  float D = open(c + ivec2(0, -1)) < 0.5 ? -v.y : at(uVel, c + ivec2(0, -1)).y;
  float U = open(c + ivec2(0, 1)) < 0.5 ? -v.y : at(uVel, c + ivec2(0, 1)).y;
  outColor = vec4((R - L + U - D) * 0.5 * open(c), 0.0, 0.0, 0.0);
}
`;

const JACOBI_FS = (H: string) => `${H}
uniform sampler2D uPressure;
uniform sampler2D uDiv;
uniform float uScale;
void main() {
  ivec2 c = cell();
  float p = at(uPressure, c + ivec2(-1, 0)).x + at(uPressure, c + ivec2(1, 0)).x
          + at(uPressure, c + ivec2(0, -1)).x + at(uPressure, c + ivec2(0, 1)).x;
  outColor = vec4((p * uScale - texelFetch(uDiv, c, 0).x) * 0.25 * open(c), 0.0, 0.0, 0.0);
}
`;

const GRADIENT_FS = (H: string) => `${H}
uniform sampler2D uPressure;
uniform sampler2D uVel;
void main() {
  ivec2 c = cell();
  float pL = at(uPressure, c + ivec2(-1, 0)).x;
  float pR = at(uPressure, c + ivec2(1, 0)).x;
  float pD = at(uPressure, c + ivec2(0, -1)).x;
  float pU = at(uPressure, c + ivec2(0, 1)).x;
  vec4 v = texelFetch(uVel, c, 0);
  outColor = vec4(v.xy - vec2(pR - pL, pU - pD) * 0.5, v.z, 0.0);
}
`;

// Semi-Lagrangian step back along the velocity, then a fade. Velocities are in
// cells per second, so the back-traced point is in cells too. With uAgeRate set the
// dye is density (r) and age (g): only the density fades, the age counts up
const ADVECT_FS = (H: string) => `${H}
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform float uDt;
uniform float uFade;
uniform float uAgeRate;
void main() {
  ivec2 c = cell();
  vec2 back = clamp(vec2(c) - texelFetch(uVel, c, 0).xy * uDt, vec2(0.0), vec2(SIZE - 1));
  vec4 s = texture(uSrc, (back + 0.5) / vec2(SIZE));
  vec3 v = max(s.rgb / (1.0 + uFade * uDt), 0.0);
  if (uAgeRate > 0.0) v.g = min(s.g + uAgeRate * uDt, 1.0);
  outColor = vec4(v * open(c), 0.0);
}
`;

// MacCormack correction for the dye: advect forward (uHat), back again (uBack), and
// add half the round-trip error back on. The result is clamped to the four source
// texels, so thin threads of smoke stay sharp instead of blurring out
const MACCORMACK_FS = (H: string) => `${H}
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform sampler2D uHat;
uniform sampler2D uBack;
uniform float uDt;
uniform float uFade;
void main() {
  ivec2 c = cell();
  vec2 back = clamp(vec2(c) - texelFetch(uVel, c, 0).xy * uDt, vec2(0.0), vec2(SIZE - 1));
  ivec2 b0 = ivec2(floor(back));
  vec3 s00 = at(uSrc, b0).rgb;
  vec3 s10 = at(uSrc, b0 + ivec2(1, 0)).rgb;
  vec3 s01 = at(uSrc, b0 + ivec2(0, 1)).rgb;
  vec3 s11 = at(uSrc, b0 + ivec2(1, 1)).rgb;
  vec3 lo = min(min(s00, s10), min(s01, s11));
  vec3 hi = max(max(s00, s10), max(s01, s11));
  vec3 hat = texelFetch(uHat, c, 0).rgb;
  vec3 v = hat + 0.5 * (texelFetch(uSrc, c, 0).rgb - texelFetch(uBack, c, 0).rgb);
  outColor = vec4(max(clamp(v, lo, hi) / (1.0 + uFade * uDt), 0.0) * open(c), 0.0);
}
`;

// GLSL for the display passes: the Stone filter at scale 200, which is finer than a
// pixel, so on screen it reads as a frozen grain. stone(uv) gives the uv to sample
// the ink at (nudged a pixel or two) in xy and its shade in z
export const DISPLAY_LIB = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise with its analytic gradient
vec3 noised(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y,
              du * (vec2(b - a, c - a) + k * u.yx));
}

float fbm(vec2 p) {
  return noised(p).x * 0.5 + noised(p * 2.0 + vec2(5.37, 9.13)).x * 0.3
       + noised(p * 4.0 + vec2(1.79, 3.51)).x * 0.2;
}

vec3 stone(vec2 uv, vec2 res) {
  vec2 pos = vec2(uv.x * res.x / res.y, uv.y) * 800.0;
  vec2 grad = noised(pos).yz;
  float h = fbm(pos + grad * 0.4);
  return vec3(uv + grad * 0.15 * 0.012, clamp(1.0 + (h - 0.5) * 1.1, 0.0, 1.6));
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer };
type Pair = { read: Target; write: Target; swap: () => void };
export type Program = { p: WebGLProgram; u: (name: string) => WebGLUniformLocation | null };

export type StepParams = {
  // Vorticity confinement: spins the ink into eddies, 0 is off
  curl: number;
  // Push per unit of ink density, cells per second²
  buoyancy?: [number, number];
  // MacCormack dye advection: keeps fine threads sharp, costs two more passes
  sharp?: boolean;
  // Dye as density (r) and age (g): the age climbs this much per second instead of
  // fading. Not combined with sharp
  ageRate?: number;
  // Velocity and dye damping per second
  velFade: number;
  dyeFade: number;
};

export function createFluid(gl: WebGL2RenderingContext, w = N, h = N) {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const program = (fs: string): Program => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const u = (name: string) => (name in uniforms ? uniforms[name] : (uniforms[name] = gl.getUniformLocation(p, name)));
    return { p, u };
  };

  const H = header(w, h);
  const splatDye = program(SPLAT_DYE(H));
  const splatVel = program(SPLAT_VEL(H));
  const curl = program(CURL_FS(H));
  const vorticity = program(VORTICITY_FS(H));
  const buoyancy = program(BUOYANCY_FS(H));
  const divergence = program(DIVERGENCE_FS(H));
  const jacobi = program(JACOBI_FS(H));
  const gradient = program(GRADIENT_FS(H));
  const advect = program(ADVECT_FS(H));
  const maccormack = program(MACCORMACK_FS(H));

  // One triangle that covers the viewport
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const target = (): Target => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo };
  };
  const pair = (): Pair => {
    const p = {
      read: target(),
      write: target(),
      swap() {
        [p.read, p.write] = [p.write, p.read];
      },
    };
    return p;
  };
  const vel = pair();
  const dye = pair();
  const pressure = pair();
  const div = target();
  // Walls: a single white texel (no walls) until setSolid gives a mask
  const noWalls = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, noWalls);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  let solid = noWalls;
  // Scratch for the MacCormack round trip, made on first use
  let hat: Target | null = null;
  let roundTrip: Target | null = null;

  const bindTex = (unit: number, loc: WebGLUniformLocation | null, tex: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  };
  // Every sim pass sees the walls on texture unit 7
  const begin = (prog: Program) => {
    gl.useProgram(prog.p);
    bindTex(7, prog.u("uSolid"), solid);
  };
  const run = (out: Target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const impulses = new Float32Array(MAX_STEPS * 2);

  return {
    width: w,
    height: h,
    // Shader prelude of this grid (cell(), at(), open(), SIZE) for custom passes
    header: H,
    program,
    bindTex,
    dye: () => dye.read.tex,
    // Velocity in cells per second in xy
    velocity: () => vel.read.tex,
    // Walls: a mask over the grid (r: 1 open, 0 solid); null removes them
    setSolid(mask: WebGLTexture | null) {
      solid = mask ?? noWalls;
    },

    // A custom pass over the grid that rewrites the velocity or the dye. It sees the
    // current velocity as uVel (unit 0), the dye as uDye (unit 1) and the walls;
    // setup binds the rest
    pass(prog: Program, into: "velocity" | "dye", setup?: () => void) {
      gl.viewport(0, 0, w, h);
      begin(prog);
      bindTex(0, prog.u("uVel"), vel.read.tex);
      bindTex(1, prog.u("uDye"), dye.read.tex);
      setup?.();
      const pr = into === "velocity" ? vel : dye;
      run(pr.write);
      pr.swap();
    },

    // Gaussian splats at grid positions (cells), each pushing the fluid by its
    // impulse (cells per second): one [x, y] for all of them, or a pair per splat.
    // Without colors only the velocity is touched
    splat(
      pos: Float32Array,
      count: number,
      radius: number,
      impulse: [number, number] | Float32Array,
      colors?: Float32Array,
    ) {
      if (impulse instanceof Float32Array) impulses.set(impulse.subarray(0, count * 2));
      else for (let i = 0; i < count; i++) impulses.set(impulse, i * 2);
      gl.viewport(0, 0, w, h);
      begin(splatVel);
      bindTex(0, splatVel.u("uVel"), vel.read.tex);
      gl.uniform2fv(splatVel.u("uPos"), pos);
      gl.uniform1i(splatVel.u("uCount"), count);
      gl.uniform1f(splatVel.u("uRadius"), radius);
      gl.uniform2fv(splatVel.u("uImpulse"), impulses);
      run(vel.write);
      vel.swap();
      if (!colors) return;

      begin(splatDye);
      bindTex(0, splatDye.u("uDye"), dye.read.tex);
      gl.uniform2fv(splatDye.u("uPos"), pos);
      gl.uniform3fv(splatDye.u("uCol"), colors);
      gl.uniform1i(splatDye.u("uCount"), count);
      gl.uniform1f(splatDye.u("uRadius"), radius);
      run(dye.write);
      dye.swap();
    },

    step(dt: number, { curl: curlStrength, buoyancy: force, sharp, ageRate = 0, velFade, dyeFade }: StepParams) {
      gl.viewport(0, 0, w, h);

      begin(curl);
      bindTex(0, curl.u("uVel"), vel.read.tex);
      run(vel.write);
      vel.swap();

      if (curlStrength > 0) {
        begin(vorticity);
        bindTex(0, vorticity.u("uVel"), vel.read.tex);
        gl.uniform1f(vorticity.u("uCurl"), curlStrength);
        gl.uniform1f(vorticity.u("uDt"), dt);
        run(vel.write);
        vel.swap();
      }

      if (force) {
        begin(buoyancy);
        bindTex(0, buoyancy.u("uVel"), vel.read.tex);
        bindTex(1, buoyancy.u("uDye"), dye.read.tex);
        gl.uniform2f(buoyancy.u("uForce"), force[0], force[1]);
        gl.uniform1f(buoyancy.u("uDt"), dt);
        run(vel.write);
        vel.swap();
      }

      begin(divergence);
      bindTex(0, divergence.u("uVel"), vel.read.tex);
      run(div);

      begin(jacobi);
      bindTex(1, jacobi.u("uDiv"), div.tex);
      for (let i = 0; i < JACOBI_ITERS; i++) {
        bindTex(0, jacobi.u("uPressure"), pressure.read.tex);
        gl.uniform1f(jacobi.u("uScale"), i === 0 ? PRESSURE_DECAY : 1);
        run(pressure.write);
        pressure.swap();
      }

      begin(gradient);
      bindTex(0, gradient.u("uPressure"), pressure.read.tex);
      bindTex(1, gradient.u("uVel"), vel.read.tex);
      run(vel.write);
      vel.swap();

      begin(advect);
      gl.uniform1f(advect.u("uDt"), dt);
      bindTex(0, advect.u("uVel"), vel.read.tex);
      bindTex(1, advect.u("uSrc"), vel.read.tex);
      gl.uniform1f(advect.u("uFade"), velFade);
      gl.uniform1f(advect.u("uAgeRate"), 0);
      run(vel.write);
      vel.swap();

      // The dye rides the velocity that was just advected
      bindTex(0, advect.u("uVel"), vel.read.tex);
      if (!sharp) {
        bindTex(1, advect.u("uSrc"), dye.read.tex);
        gl.uniform1f(advect.u("uFade"), dyeFade);
        gl.uniform1f(advect.u("uAgeRate"), ageRate);
        run(dye.write);
        dye.swap();
        return;
      }

      hat ??= target();
      roundTrip ??= target();
      gl.uniform1f(advect.u("uFade"), 0);
      bindTex(1, advect.u("uSrc"), dye.read.tex);
      run(hat);
      gl.uniform1f(advect.u("uDt"), -dt);
      bindTex(1, advect.u("uSrc"), hat.tex);
      run(roundTrip);

      begin(maccormack);
      bindTex(0, maccormack.u("uVel"), vel.read.tex);
      bindTex(1, maccormack.u("uSrc"), dye.read.tex);
      bindTex(2, maccormack.u("uHat"), hat.tex);
      bindTex(3, maccormack.u("uBack"), roundTrip.tex);
      gl.uniform1f(maccormack.u("uDt"), dt);
      gl.uniform1f(maccormack.u("uFade"), dyeFade);
      run(dye.write);
      dye.swap();
    },
  };
}
