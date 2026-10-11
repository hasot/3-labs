"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  ALL_MEDIA,
  CONTENTS,
  CONTENTS_ROW_H,
  COVER_MEDIA,
  COVER_PX,
  Media,
  PAGE_PX,
  SPREAD_H,
  SPREAD_W,
  SPREADS,
  drawBackCover,
  drawFrontCover,
  loadFonts,
  readFonts,
} from "./pages";

// A portrait page, the classic 8½ × 11 magazine trim; the soft covers are a hair larger
export const PAGE_W = 1;
export const PAGE_H = 1.33;
const COVER_W = PAGE_W + 0.012;
const COVER_H = PAGE_H + 0.032;
// Sheet 0 is the front cover, the last is the back cover; spread k is sheet k's back and k+1's front
export const SHEETS = SPREADS.length + 1;
// Plain bound pages under the turnable sheets on each half: they give the magazine its body,
// the nested arches at the gutter and the fanned fore-edge. The left half turns with the front
// cover, the right half with the back cover.
const FILLERS = 3;
// Every leaf in binding order: front cover, left fillers, inner sheets, right fillers, back cover
const LEAVES = SHEETS + FILLERS * 2;
const leafOfSheet = (i: number) => (i === 0 ? 0 : i === SHEETS - 1 ? LEAVES - 1 : FILLERS + i);
// Thickness one leaf adds to its stack
const GAP = 0.0024;
// Closed, a leaf fans up from the binding onto its stack over this length (the cover wraps the
// rounded spine more tightly than the pages inside)
const SPINE_L = 0.17;
const COVER_SPINE_L = 0.05;
// Open, every leaf leaves the gutter steeply (ARCH angle, decaying over ARCH_L), arches over and
// settles toward its outer edge (a dip of shape s/M·e^(1−s/M)). Top leaves arch the most, so the
// halves read as nested waves meeting in the binding.
const ARCH_MIN = 0.42;
const ARCH_MAX = 1.0;
const ARCH_L = 0.075;
const DIP_M = 0.3;
// Bend across a page at mid-turn when it moves at full speed, in radians from spine to edge;
// a cover is stiffer
const CURL = 1.7;
const COVER_CURL = 0.55;
// Delay between sheets when several turn at once (a jump, or closing the book)
const STAGGER = 0.07;
// Page springs: stiff enough to snap over, damped just under critical
const STIFF = 62;
const DAMP = 13;
// A hovered page edge lifts by this much of a turn, as an invitation
const PEEK = 0.045;
// Pointer travel before a press counts as a drag rather than a click
const DRAG_PX = 6;
// Book pose on the desk (closed, a little off-centre and askew) and in front of the camera
const DESK_POS = new THREE.Vector3(0.32, 0, 0.18);
const DESK_ROT = -0.3;
const READ_POS = new THREE.Vector3(0, 0, 0.04);
// How high the book lifts while it travels between the two poses
const CARRY_LIFT = 0.32;
// The closed magazine turning itself over at the end: pause, roll duration, how high it lifts
const FLIP_WAIT = 0.35;
const FLIP_S = 1.3;
const FLIP_LIFT = 0.55;
// Animated spreads redraw at this rate while open
const REDRAW_DT = 1 / 20;
// Print resolution over the canvases' design size: sharp for the open spread, its neighbours and
// the cover (a spread spans ~2600 device px on a retina screen), coarse for the rest of the issue
const HI_RES = 1.35;
const LO_RES = 0.5;
const COVER_RES = 1.6;

// The leaf's angle along its width s is
//   theta (the turn) + curl·s (the free edge trailing the motion)
//   + a·e^(−s/L) (leaving the binding) + d·(s/M)·e^(1−s/M) (settling back down),
// integrated along the leaf so the paper never stretches.
const BEND_GLSL = /* glsl */ `
uniform float uTheta;
uniform float uCurl;
uniform float uSpineA;
uniform float uSpineL;
uniform float uDip;
uniform float uLift;
uniform float uStretch;
varying vec2 vPageUv;
float pagePhi(float s) {
  float m = s / ${DIP_M.toFixed(3)};
  return uTheta + uCurl * s + uSpineA * exp(-s / uSpineL) + uDip * m * exp(1.0 - m);
}
void bendPage(vec3 p, out vec3 outP, out vec3 outN) {
  float s = p.x;
  const int STEPS = 32;
  float ds = s / float(STEPS);
  vec2 xy = vec2(0.0);
  for (int i = 0; i < STEPS; i++) {
    float phi = pagePhi((float(i) + 0.5) * ds);
    xy += vec2(cos(phi), sin(phi)) * ds;
  }
  float phi = pagePhi(s);
  outP = vec3(xy.x * uStretch, xy.y + uLift, p.z);
  outN = vec3(-sin(phi), cos(phi), 0.0);
}
`;

const FACES_GLSL = /* glsl */ `
uniform sampler2D uFrontMap;
uniform sampler2D uBackMap;
uniform vec2 uFrontRect;
uniform vec2 uBackRect;
uniform float uGutter;
varying vec2 vPageUv;
`;

// The back face is seen from the other side, so its u runs from the outer edge to the spine
const MAP_GLSL = /* glsl */ `
vec4 pageTexel = gl_FrontFacing
  ? texture2D(uFrontMap, vec2(uFrontRect.x + uFrontRect.y * vPageUv.x, vPageUv.y))
  : texture2D(uBackMap, vec2(uBackRect.x + uBackRect.y * (1.0 - vPageUv.x), vPageUv.y));
diffuseColor.rgb *= pageTexel.rgb;
// Paper darkens as it curves down into the gutter
diffuseColor.rgb *= mix(uGutter, 1.0, smoothstep(0.0, 0.12, vPageUv.x));
`;

type LeafUniforms = {
  uTheta: { value: number };
  uCurl: { value: number };
  uSpineA: { value: number };
  uSpineL: { value: number };
  uDip: { value: number };
  uLift: { value: number };
  uStretch: { value: number };
  uFrontMap: { value: THREE.Texture | null };
  uBackMap: { value: THREE.Texture | null };
  uFrontRect: { value: THREE.Vector2 };
  uBackRect: { value: THREE.Vector2 };
  uGutter: { value: number };
};

// A leaf's shape at rest on one side, closed (flat on its stack) or open (arched)
// stretch: bending pulls a leaf's outer edge in toward the spine, by more the more it bends; each
// rest shape is widened back so every edge lands flush (no page sticks out from under the cover)
type Pose = { a: number; L: number; d: number; lift: number; stretch: number };
type LeafPoses = { closedR: Pose; openR: Pose; closedL: Pose; openL: Pose };

type Leaf = {
  cover: boolean;
  leaf: number;
  curl: number;
  uniforms: LeafUniforms;
  mat: THREE.Material;
  depth: THREE.Material;
  geo: THREE.BufferGeometry;
  poses: LeafPoses;
};

type Sheet = Leaf & {
  p: number;
  v: number;
  // The resting side it is heading to, and the one it keeps until `goalAt` (riffles)
  goal: number;
  from: number;
  goalAt: number;
  dragging: boolean;
  dragP: number;
  dragDir: number;
};

type Filler = Leaf & { side: "L" | "R" };

function leafMaterials(u: LeafUniforms, cover: boolean) {
  // Coated stock: a matte ink layer under a clear gloss that catches the lamp and the softbox
  const mat = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    roughness: cover ? 0.6 : 0.68,
    metalness: 0,
    clearcoat: cover ? 0.35 : 0.4,
    clearcoatRoughness: cover ? 0.4 : 0.3,
    // Little base sheen: the gloss is the coat, and the lamp must not wash the print out
    specularIntensity: cover ? 0.25 : 0.45,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${BEND_GLSL}`)
      .replace(
        "#include <beginnormal_vertex>",
        `vec3 bentPos; vec3 objectNormal; bendPage(position, bentPos, objectNormal); vPageUv = uv;
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`,
      )
      .replace("#include <begin_vertex>", "vec3 transformed = bentPos;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FACES_GLSL}`)
      .replace("#include <map_fragment>", MAP_GLSL);
  };
  // Shadows must see the same bent leaf
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${BEND_GLSL}`)
      .replace("#include <begin_vertex>", "vec3 bentPos; vec3 bentN; bendPage(position, bentPos, bentN); vec3 transformed = bentPos;");
  };
  return { mat, depth };
}

// A canvas printed in design pixels at some resolution
type Print = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; w: number; h: number; res: number };

function canvasTexture(w: number, h: number, res: number, maxAniso: number): Print {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * res);
  canvas.height = Math.round(h * res);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return { canvas, ctx: canvas.getContext("2d")!, tex, w, h, res };
}

// Draws in design pixels, whatever the canvas resolution
function paint(print: Print, draw: (ctx: CanvasRenderingContext2D) => void) {
  print.ctx.setTransform(print.res, 0, 0, print.res, 0, 0);
  draw(print.ctx);
  print.tex.needsUpdate = true;
}

// Changes a canvas's resolution; the GPU copy is reallocated at the new size
function setRes(print: Print, res: number) {
  if (print.res === res) return false;
  print.res = res;
  print.canvas.width = Math.round(print.w * res);
  print.canvas.height = Math.round(print.h * res);
  print.tex.dispose();
  return true;
}

function paperTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 4;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 4, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type BookFocus = { f: number; v: number };

type Props = {
  open: boolean;
  turned: number;
  focus: RefObject<BookFocus>;
  onOpen: () => void;
  onTurnTo: (turned: number) => void;
  // The magazine closed on its back cover and turned itself over onto the front
  onFlipped: () => void;
};

const smoothstep = (x: number) => x * x * (3 - 2 * x);
const lerp = THREE.MathUtils.lerp;

// Where the outer edge of a leaf w wide ends up for a given shape (θ = 0)
function edgeOf(a: number, L: number, d: number, w: number) {
  const n = 96;
  const ds = w / n;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * ds;
    const m = s / DIP_M;
    const phi = a * Math.exp(-s / L) + d * m * Math.exp(1 - m);
    x += Math.cos(phi) * ds;
    y += Math.sin(phi) * ds;
  }
  return { x, y };
}

// The largest a in [0, π/2] (or dip d in [−3, 0]) whose leaf ends at height h; what bending
// cannot reach is made up as plain lift
function solve(h: number, f: (x: number) => number, lo: number, hi: number) {
  if (f(hi) < h) return { x: hi, lift: h - f(hi) };
  if (f(lo) > h) return { x: lo, lift: 0 };
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < h) lo = mid;
    else hi = mid;
  }
  return { x: lo, lift: 0 };
}

// Closed: fan up from the binding onto the stack. Open: an arch set by how high the leaf lies
function posesFor(leaf: number, cover: boolean): LeafPoses {
  const w = cover ? COVER_W : PAGE_W;
  const side = (h: number, sign: 1 | -1) => {
    const L = cover ? COVER_SPINE_L : SPINE_L;
    const c = solve(h, (a) => edgeOf(a, L, 0, w).y, 0, Math.PI / 2);
    const a = lerp(ARCH_MIN, ARCH_MAX, THREE.MathUtils.clamp(h / ((LEAVES - 1) * GAP * 0.6), 0, 1));
    const o = solve(h, (d) => edgeOf(a, ARCH_L, d, w).y, -3, 0);
    return {
      closed: { a: sign * c.x, L, d: 0, lift: c.lift, stretch: w / edgeOf(c.x, L, 0, w).x },
      open: { a: sign * a, L: ARCH_L, d: sign * o.x, lift: o.lift, stretch: w / edgeOf(a, ARCH_L, o.x, w).x },
    };
  };
  const r = side((LEAVES - 1 - leaf) * GAP, 1);
  const l = side(leaf * GAP, -1);
  return { closedR: r.closed, openR: r.open, closedL: l.closed, openL: l.open };
}

const tmpR: Pose = { a: 0, L: 0, d: 0, lift: 0, stretch: 1 };
const tmpL: Pose = { a: 0, L: 0, d: 0, lift: 0, stretch: 1 };
function mixPose(out: Pose, a: Pose, b: Pose, t: number) {
  out.a = lerp(a.a, b.a, t);
  out.L = lerp(a.L, b.L, t);
  out.d = lerp(a.d, b.d, t);
  out.lift = lerp(a.lift, b.lift, t);
  out.stretch = lerp(a.stretch, b.stretch, t);
  return out;
}

// Shape a leaf at turn progress p while the magazine is `open` (0 closed … 1 lying open)
function poseLeaf(leaf: Leaf, p: number, open: number) {
  const u = leaf.uniforms;
  const r = mixPose(tmpR, leaf.poses.closedR, leaf.poses.openR, open);
  const l = mixPose(tmpL, leaf.poses.closedL, leaf.poses.openL, open);
  const t = smoothstep(p);
  u.uTheta.value = p * Math.PI;
  u.uCurl.value = leaf.curl;
  u.uSpineA.value = lerp(r.a, l.a, t);
  u.uSpineL.value = lerp(r.L, l.L, t);
  u.uDip.value = lerp(r.d, l.d, t);
  u.uLift.value = lerp(r.lift, l.lift, t);
  u.uStretch.value = lerp(r.stretch, l.stretch, t);
}

// Every leaf back on the right at rest: the magazine closed face up, with no turn to animate
function closeOnFront(sheets: Sheet[]) {
  for (const sh of sheets) {
    sh.p = 0;
    sh.v = 0;
    sh.curl = 0;
    sh.goal = 0;
    sh.from = 0;
    sh.goalAt = 0;
  }
}

// Spring for the desk → reading move; returns the clamped progress
function stepFocus(focus: BookFocus, goal: number, dt: number) {
  focus.v += (90 * (goal - focus.f) - 17 * focus.v) * dt;
  focus.f += focus.v * dt;
  return THREE.MathUtils.clamp(focus.f, 0, 1);
}

export function Book({ open, turned, focus, onOpen, onTurnTo, onFlipped }: Props) {
  const { gl, camera } = useThree();
  const outer = useRef<THREE.Group>(null);
  const flipper = useRef<THREE.Group>(null);
  // Turning the closed magazine over: -1 idle, else progress 0…1 (after a short pause)
  const flip = useRef({ t: -1, wait: 0, swapped: false });
  const inner = useRef<THREE.Group>(null);
  const live = useRef({ open, turned, onOpen, onTurnTo, onFlipped });
  useLayoutEffect(() => {
    live.current = { open, turned, onOpen, onTurnTo, onFlipped };
  });

  const book = useMemo(() => {
    const aniso = gl.capabilities.getMaxAnisotropy();
    const spreads = SPREADS.map((_, i) => canvasTexture(SPREAD_W, SPREAD_H, i < 2 ? HI_RES : LO_RES, aniso));
    const front = canvasTexture(COVER_PX.w, COVER_PX.h, COVER_RES, aniso);
    const back = canvasTexture(COVER_PX.w, COVER_PX.h, COVER_RES, aniso);
    const pageGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 64, 1).rotateX(-Math.PI / 2).translate(PAGE_W / 2, 0, 0);
    const coverGeo = new THREE.PlaneGeometry(COVER_W, COVER_H, 64, 1).rotateX(-Math.PI / 2).translate(COVER_W / 2, 0, 0);
    const papers = ["#f2efe9", "#e9e5dc", "#f5f3ee", "#e2ddd3"].map(paperTexture);
    // Inside of the covers is printed dark, so no white shows between them when closed
    const coverInside = paperTexture("#141416");
    const full = new THREE.Vector2(0, 1);
    const leafBase = (cover: boolean, leaf: number, uniforms: LeafUniforms) => ({
      cover,
      leaf,
      curl: 0,
      uniforms,
      ...leafMaterials(uniforms, cover),
      geo: cover ? coverGeo : pageGeo,
      poses: posesFor(leaf, cover),
    });
    const shapeUniforms = () => ({
      uTheta: { value: 0 },
      uCurl: { value: 0 },
      uSpineA: { value: 0 },
      uSpineL: { value: SPINE_L },
      uDip: { value: 0 },
      uLift: { value: 0 },
      uStretch: { value: 1 },
    });
    const sheets: Sheet[] = [];
    for (let i = 0; i < SHEETS; i++) {
      const cover = i === 0 || i === SHEETS - 1;
      sheets.push({
        ...leafBase(cover, leafOfSheet(i), {
          ...shapeUniforms(),
          // Front: right half of the spread before it; back: left half of its spread. The covers'
          // insides carry no page: the first and last pages sit on the bound halves above them
          uFrontMap: { value: i === 0 ? front.tex : i === SHEETS - 1 ? coverInside : spreads[i - 1].tex },
          uBackMap: { value: i === SHEETS - 1 ? back.tex : i === 0 ? coverInside : spreads[i].tex },
          uFrontRect: { value: i === 0 || i === SHEETS - 1 ? full : new THREE.Vector2(0.5, 0.5) },
          uBackRect: { value: i === 0 || i === SHEETS - 1 ? full : new THREE.Vector2(0, 0.5) },
          uGutter: { value: cover ? 1 : 0.6 },
        }),
        p: 0,
        v: 0,
        goal: 0,
        from: 0,
        goalAt: 0,
        dragging: false,
        dragP: 0,
        dragDir: 1,
      });
    }
    const fillers: Filler[] = [];
    for (let k = 0; k < FILLERS * 2; k++) {
      const side = k < FILLERS ? "L" : "R";
      const leaf = side === "L" ? 1 + k : SHEETS - 1 + k;
      const paper = papers[k % papers.length];
      // The top leaf of each bound half carries the first (left) or last (right) printed page
      const firstPage = k === FILLERS - 1;
      const lastPage = k === FILLERS;
      fillers.push({
        ...leafBase(false, leaf, {
          ...shapeUniforms(),
          uFrontMap: { value: lastPage ? spreads[SPREADS.length - 1].tex : paper },
          uBackMap: { value: firstPage ? spreads[0].tex : paper },
          uFrontRect: { value: lastPage ? new THREE.Vector2(0.5, 0.5) : full },
          uBackRect: { value: firstPage ? new THREE.Vector2(0, 0.5) : full },
          uGutter: { value: 0.6 },
        }),
        side,
      });
    }
    const media = new Media();
    return { spreads, front, back, sheets, fillers, papers: [...papers, coverInside], pageGeo, coverGeo, media };
  }, [gl]);
  // Springs, uniforms and canvases change every frame; they are reached through this ref
  const data = useRef<typeof book | null>(null);
  useLayoutEffect(() => {
    data.current = book;
  }, [book]);

  // Print the book once the fonts are in
  useEffect(() => {
    let cancelled = false;
    const F = readFonts();
    const posters = data.current?.media.loadPosters(ALL_MEDIA);
    data.current?.media.preloadVideos(ALL_MEDIA);
    Promise.all([loadFonts(F), posters]).then(() => {
      const b = data.current;
      if (cancelled || !b) return;
      paint(b.front, (ctx) => drawFrontCover(ctx, F, b.media));
      paint(b.back, (ctx) => drawBackCover(ctx, F));
      SPREADS.forEach((s, i) => paint(b.spreads[i], (ctx) => s.draw(ctx, 0, F, b.media)));
      printed.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [book]);

  useEffect(
    () => () => {
      book.spreads.forEach((s) => s.tex.dispose());
      book.front.tex.dispose();
      book.back.tex.dispose();
      book.pageGeo.dispose();
      book.coverGeo.dispose();
      book.papers.forEach((t) => t.dispose());
      book.media.dispose();
      [...book.sheets, ...book.fillers].forEach((s) => {
        s.mat.dispose();
        s.depth.dispose();
      });
    },
    [book],
  );

  // New page count: sheets that change sides go one after another, in the direction of travel
  const clock = useRef(0);
  useEffect(() => {
    const b = data.current;
    if (!b) return;
    const now = clock.current;
    const changed: number[] = [];
    b.sheets.forEach((s, i) => {
      const goal = i < turned ? 1 : 0;
      if (goal !== s.goal) changed.push(i);
    });
    const forward = changed.length > 0 && changed[0] < turned;
    const order = forward ? changed : [...changed].reverse();
    order.forEach((i, k) => {
      const s = b.sheets[i];
      s.from = now >= s.goalAt ? s.goal : s.from;
      s.goal = i < turned ? 1 : 0;
      s.goalAt = now + k * STAGGER;
    });
  }, [turned, book]);

  // ── Pointer: click to open or turn, drag a page by its edge, hover to peek ──
  const hover = useRef<"L" | "R" | "book" | null>(null);
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const inv = new THREE.Matrix4();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.04);
    const hitP = new THREE.Vector3();
    const ray = new THREE.Ray();

    // Pointer on the book's top plane, in the spine's frame (x across, z down the page)
    const pick = (e: PointerEvent) => {
      const g = inner.current;
      if (!g) return null;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      inv.copy(g.matrixWorld).invert();
      ray.copy(raycaster.ray).applyMatrix4(inv);
      if (!ray.intersectPlane(plane, hitP)) return null;
      const sheets = data.current?.sheets ?? [];
      const right = sheets.some((s) => s.p < 0.5);
      const left = sheets.some((s) => s.p >= 0.5);
      const inZ = Math.abs(hitP.z) <= COVER_H / 2;
      const side: "L" | "R" | null =
        inZ && hitP.x >= 0 && hitP.x <= COVER_W && right ? "R" : inZ && hitP.x < 0 && hitP.x >= -COVER_W && left ? "L" : null;
      return { x: hitP.x, z: hitP.z, side };
    };

    let press: {
      id: number;
      x0: number;
      y0: number;
      side: "L" | "R";
      sheet: number;
      dir: 1 | -1;
      reach: number;
      moved: boolean;
      hitX: number;
      hitZ: number;
    } | null = null;

    const down = (e: PointerEvent) => {
      if (flip.current.t >= 0) return;
      const hit = pick(e);
      if (!hit?.side) return;
      const { open, turned } = live.current;
      const forward = hit.side === "R";
      const sheet = forward ? turned : turned - 1;
      press = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        side: hit.side,
        sheet,
        dir: forward ? 1 : -1,
        // The grabbed point stays under the pointer as the page swings
        reach: THREE.MathUtils.clamp(Math.abs(hit.x), PAGE_W * 0.35, PAGE_W),
        moved: false,
        hitX: hit.x,
        hitZ: hit.z,
      };
      // Pages only drag while the book is open and that sheet exists
      if (!open || sheet < 0 || sheet >= SHEETS) press.moved = true;
      el.setPointerCapture(e.pointerId);
    };

    const move = (e: PointerEvent) => {
      const sheets = data.current?.sheets;
      if (!sheets) return;
      if (press && press.id === e.pointerId) {
        const { open } = live.current;
        const far = Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > DRAG_PX;
        const held = sheets[press.sheet];
        if (open && held && far && !held.dragging) {
          held.dragging = true;
          held.dragDir = press.dir;
          press.moved = true;
        }
        if (held?.dragging) {
          const hit = pick(e);
          if (hit) {
            const theta = Math.acos(THREE.MathUtils.clamp(hit.x / press.reach, -1, 1));
            held.dragP = theta / Math.PI;
          }
          el.style.cursor = "grabbing";
        }
        return;
      }
      const hit = pick(e);
      const { open } = live.current;
      hover.current = hit?.side ? (open ? hit.side : "book") : null;
      el.style.cursor = hover.current ? (open ? "grab" : "pointer") : "";
    };

    const up = (e: PointerEvent) => {
      if (!press || press.id !== e.pointerId) return;
      const p = press;
      press = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const { open, turned, onOpen, onTurnTo } = live.current;
      const s = data.current?.sheets[p.sheet];
      if (s?.dragging) {
        s.dragging = false;
        // Commit on a page past halfway or a flick in the turn's direction
        const flick = s.v * p.dir;
        const commit = p.dir === 1 ? s.p > 0.5 || flick > 0.9 : s.p < 0.5 || flick > 0.9;
        if (commit && flick > -0.6) onTurnTo(turned + p.dir);
        el.style.cursor = "grab";
        return;
      }
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > DRAG_PX) return;
      if (!open) {
        onOpen();
        return;
      }
      // A click on the contents jumps to that chapter
      if (p.side === "L" && turned === 1) {
        const cx = (1 - -p.hitX / PAGE_W) * PAGE_PX;
        const cy = ((p.hitZ + PAGE_H / 2) / PAGE_H) * SPREAD_H;
        const row = CONTENTS.find((r) => cy > r.y - CONTENTS_ROW_H + 24 && cy <= r.y + 24);
        if (row && cx > 60 && cx < PAGE_PX - 60) {
          onTurnTo(row.spread + 1);
          return;
        }
      }
      onTurnTo(turned + p.dir);
    };

    const leave = () => {
      hover.current = null;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
      el.style.cursor = "";
    };
  }, [gl, camera]);

  const printed = useRef(false);
  const redraw = useRef({ acc: 0, t: 0, playing: "", lod: -1, fonts: null as ReturnType<typeof readFonts> | null });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    clock.current += dt;
    const now = clock.current;
    const { open, turned } = live.current;
    const b = data.current;
    if (!b) return;
    const sheets = b.sheets;

    // Book pose: carried from the desk into view and back
    const f = stepFocus(focus.current, open ? 1 : 0, dt);
    const o = outer.current;
    if (o) {
      o.position.lerpVectors(DESK_POS, READ_POS, smoothstep(f));
      o.position.y = Math.sin(Math.PI * f) * CARRY_LIFT;
      o.rotation.y = THREE.MathUtils.lerp(DESK_ROT, 0, smoothstep(f));
      // A slight tilt toward the reader mid-flight, like a book being picked up
      o.rotation.x = Math.sin(Math.PI * f) * 0.12;
    }

    sheets.forEach((s, i) => {
      let target = now >= s.goalAt ? s.goal : s.from;
      const settled = now >= s.goalAt + 0.4;
      if (settled && !s.dragging) {
        const h = hover.current;
        if (h === "R" && i === turned) target += PEEK;
        if (h === "L" && i === turned - 1) target -= PEEK;
        if (h === "book" && i === 0 && turned === 0) target += PEEK * 0.8;
        if (h === "book" && i === SHEETS - 1 && turned === SHEETS) target -= PEEK * 0.8;
      }
      const prev = s.p;
      if (s.dragging) {
        s.p += (s.dragP - s.p) * (1 - Math.exp(-dt * 22));
        s.v = (s.p - prev) / dt;
      } else {
        s.v += (STIFF * (target - s.p) - DAMP * s.v) * dt;
        s.p += s.v * dt;
      }
      // The free edge trails the motion; a held page bends a little toward the hand
      const p = THREE.MathUtils.clamp(s.p, 0, 1);
      const drive = THREE.MathUtils.clamp(s.v * 0.45 + (s.dragging ? 0.5 * s.dragDir : 0), -1, 1);
      const want = ((-(s.cover ? COVER_CURL : CURL)) / PAGE_W) * Math.sin(Math.PI * p) * drive;
      s.curl += (want - s.curl) * (1 - Math.exp(-dt * 14));
    });

    // How far the magazine lies open: the arch grows as the first cover leaves and the last stays
    const pFront = THREE.MathUtils.clamp(sheets[0].p, 0, 1);
    const pBack = THREE.MathUtils.clamp(sheets[SHEETS - 1].p, 0, 1);
    const openness = smoothstep(THREE.MathUtils.clamp(Math.min(pFront, 1 - pBack) * 1.6, 0, 1));
    sheets.forEach((s) => poseLeaf(s, THREE.MathUtils.clamp(s.p, 0, 1), openness));
    // The bound halves turn with their covers
    b.fillers.forEach((fl) => {
      const owner = fl.side === "L" ? sheets[0] : sheets[SHEETS - 1];
      fl.curl = owner.curl;
      poseLeaf(fl, fl.side === "L" ? pFront : pBack, openness);
    });

    // Closed on its back cover at the end of the issue, the magazine turns itself over onto the
    // front: a roll about its long side, lifted off the table. Edge-on halfway through, the leaves
    // are swapped for the same magazine closed face up, which then finishes the roll.
    const fl = flip.current;
    if (fl.t < 0) {
      const settled = turned === SHEETS && sheets.every((sh) => sh.p > 0.98 && Math.abs(sh.v) < 0.25);
      fl.wait = settled ? fl.wait + dt : 0;
      if (fl.wait > FLIP_WAIT) {
        fl.t = 0;
        fl.swapped = false;
      }
    }
    if (fl.t >= 0 && flipper.current) {
      fl.t = Math.min(1, fl.t + dt / FLIP_S);
      const e = fl.t < 0.5 ? 4 * fl.t ** 3 : 1 - (-2 * fl.t + 2) ** 3 / 2;
      if (!fl.swapped && e >= 0.5) {
        fl.swapped = true;
        closeOnFront(sheets);
      }
      // Before the swap the stack rolls from 0 up to edge-on; after, the face-up copy rolls on to flat
      const thick = (LEAVES - 1) * GAP;
      flipper.current.rotation.z = fl.swapped ? Math.PI * (e - 1) : Math.PI * e;
      flipper.current.position.y = Math.sin(Math.PI * e) * FLIP_LIFT + (fl.swapped ? 0 : e * thick * 2);
      if (fl.t >= 1) {
        fl.t = -1;
        flipper.current.rotation.z = 0;
        flipper.current.position.y = 0;
        live.current.onFlipped();
      }
    }

    // Closed, the book is centred on its cover; open, on the spine
    if (inner.current) {
      inner.current.position.x = (-COVER_W / 2) * (1 - pFront) + (COVER_W / 2) * pBack;
    }

    // Keep what is on show alive: the open spread, or the cover while it lies face up
    const r = redraw.current;
    r.t += dt;
    r.acc += dt;
    const k = turned - 1;
    // Recordings run only once the spread lies still: nothing decodes while pages are turning
    const still = sheets.every((sh) => Math.abs(sh.v) < 0.4 && !sh.dragging);
    const reading = f > 0.6 && k >= 0 && k < SPREADS.length && still;
    const coverUp = !reading && turned === 0 && pFront < 0.5;
    const playing = reading ? SPREADS[k].media : coverUp ? COVER_MEDIA : [];
    const key = playing.join();
    if (key !== r.playing) {
      r.playing = key;
      b.media.play(playing);
    }
    if (r.acc >= REDRAW_DT && (reading ? SPREADS[k].animated : coverUp)) {
      r.acc = 0;
      const F = (r.fonts ??= readFonts());
      if (reading) paint(b.spreads[k], (ctx) => SPREADS[k].draw(ctx, r.t, F, b.media));
      else paint(b.front, (ctx) => drawFrontCover(ctx, F, b.media));
    }

    // Sharp print for the open spread and the ones either side of it, coarse for the rest
    if (printed.current && r.lod !== turned) {
      r.lod = turned;
      const F = (r.fonts ??= readFonts());
      b.spreads.forEach((print, i) => {
        if (setRes(print, Math.abs(i - k) <= 1 ? HI_RES : LO_RES)) paint(print, (ctx) => SPREADS[i].draw(ctx, r.t, F, b.media));
      });
    }
  });

  return (
    <group ref={outer} position={DESK_POS} rotation={[0, DESK_ROT, 0]}>
      <group ref={flipper}>
      <group ref={inner} position-y={0.002}>
        {[...book.sheets, ...book.fillers].map((s, i) => (
          <mesh key={i} geometry={s.geo} material={s.mat} customDepthMaterial={s.depth} castShadow receiveShadow frustumCulled={false} />
        ))}
      </group>
      </group>
    </group>
  );
}
