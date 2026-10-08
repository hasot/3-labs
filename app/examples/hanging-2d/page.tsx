"use client";

import { useEffect, useRef } from "react";
import {
  PIVOT_Y,
  ROPE_LENGTH,
  attachSwingPointer,
  createSwing,
  distToSegment,
  stepDangler,
  stepSwing,
  webLength,
  type Dangler,
  type DanglerConfig,
  type Point,
} from "../hanging/swing";
import { VersionSwitch } from "../hanging/VersionSwitch";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Placeholder background until the dedicated city loop is ready
const CITY_VIDEO_SRC = `${BASE_PATH}/images/base.mp4`;

const MAX_DPR = 2;

// Same framing as the 3D camera: fov 40° at this distance, looking at y = 0.2
const CAMERA_DISTANCE = 7.5;
const CAMERA_Y = 0.2;
const HALF_FOV_TAN = Math.tan((20 * Math.PI) / 180);

// Figure space: side view, meters, origin at the ankle wrap, +x is the way he faces,
// +y runs from the feet towards the head (down the screen when hanging straight).
// FIGURE_SCALE converts meters to world units.
const FIGURE_SCALE = 0.6;
const FIGURE_HEIGHT = 1.75;
const BODY_COM = 0.95 * FIGURE_SCALE;
const HIT_RADIUS = 0.3;

type Vec = [number, number];

// Limbs: polylines with a width at every point (baggy joggers and sleeves)
const FAR_LEG: Vec[] = [
  [0, 0],
  [0, 0.45],
  [-0.02, 0.88],
];
const FAR_LEG_W = [0.085, 0.12, 0.16];
// Near leg hooks its foot behind the straight one's knee
const NEAR_LEG: Vec[] = [
  [0, 0.88],
  [0.3, 0.58],
  [-0.05, 0.45],
];
const NEAR_LEG_W = [0.17, 0.125, 0.085];
const FAR_ARM: Vec[] = [
  [-0.02, 1.34],
  [0.16, 1.45],
  [0.25, 1.17],
];
const NEAR_ARM: Vec[] = [
  [0.0, 1.36],
  [0.1, 1.6],
  [0.25, 1.32],
];
const ARM_W = [0.11, 0.095, 0.085];
const FIST_R = 0.047;

// Hoodie body; the hem has slid towards the chest, upside down
const TORSO: Vec[] = [
  [0.135, 0.9],
  [0.155, 1.02],
  [0.155, 1.24],
  [0.09, 1.4],
  [-0.08, 1.43],
  [-0.155, 1.3],
  [-0.165, 1.05],
  [-0.14, 0.9],
];
// Hood up, its peak drooping towards the ground
const HOOD: Vec[] = [
  [0.08, 1.42],
  [-0.06, 1.42],
  [-0.15, 1.5],
  [-0.17, 1.66],
  [-0.12, 1.8],
  [-0.05, 1.86],
  [0.02, 1.83],
  [0.1, 1.76],
  [0.13, 1.66],
];
// Face profile inside the hood opening: chin towards the feet, forehead towards the ground
const FACE: Vec[] = [
  [0.07, 1.47],
  [0.115, 1.5],
  [0.125, 1.55],
  [0.135, 1.57],
  [0.128, 1.59],
  [0.158, 1.63],
  [0.135, 1.66],
  [0.128, 1.7],
  [0.1, 1.74],
  [0.04, 1.72],
  [0.03, 1.5],
];
// Sneaker, toe along +x, sole on top (he is upside down); placed at the ankle
const SHOE: Vec[] = [
  [-0.06, 0.02],
  [-0.085, -0.05],
  [-0.075, -0.1],
  [0.19, -0.1],
  [0.225, -0.075],
  [0.17, -0.035],
  [0.07, 0.0],
];
const SOLE: [Vec, Vec] = [
  [-0.08, -0.1],
  [0.215, -0.1],
];

// Web along the body: from the ankle wrap past the knee to the fists
const BODY_WEB: Vec[] = [
  [0.02, 0],
  [0.12, 0.3],
  [0.24, 0.78],
  [0.25, 1.17],
  [0.25, 1.32],
];

// Things that dangle with the world's gravity: hoodie drawstrings and the web's tail
const STRING_ANCHORS: Vec[] = [
  [0.09, 1.47],
  [0.06, 1.45],
];
const STRING_LENGTH = 0.17;
const TAIL_LENGTH = 0.24;
const dangler = (length: number, damping: number, at: number): DanglerConfig => ({
  length: length * FIGURE_SCALE,
  damping,
  radius: ROPE_LENGTH + at * FIGURE_SCALE,
  min: -1.4,
  max: 1.4,
});
const STRING: DanglerConfig = dangler(STRING_LENGTH, 1.4, 1.46);
const STRING_2: DanglerConfig = dangler(STRING_LENGTH * 0.9, 1.7, 1.45);
const TAIL: DanglerConfig = dangler(TAIL_LENGTH, 1.2, 1.32);
// Head lags a little on kicks
const HEAD: DanglerConfig = { ...dangler(0.2, 6, 1.42), min: -0.35, max: 0.35 };

// Palette: dark silhouette lit only from the edges
const INK = "#0d111c";
const INK_FAR = "#070910";
const INK_DETAIL = "#1b2232";
const SKIN = "#141018";
const SOLE_COLOR = "#c9d0dc";
const WEB_COLOR = "rgba(232, 238, 248, 0.9)";
// Rim lights fixed in the world: moonlight from the upper left, city glow from the lower right
const RIMS = [
  { color: "#a9c4ff", dx: 0.85, dy: 0.5, width: 1.3, alpha: 0.85 },
  { color: "#ff9a52", dx: -0.7, dy: -0.7, width: 1, alpha: 0.6 },
];

type Paint = { ink: string; far: string; detail: string | null; skin: string; sole: string | null };
const PAINT: Paint = { ink: INK, far: INK_FAR, detail: INK_DETAIL, skin: SKIN, sole: SOLE_COLOR };
const MASK: Paint = { ink: "#fff", far: "#fff", detail: null, skin: "#fff", sole: null };

// Smooth closed outline through the points (midpoint quadratic curves)
function blob(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (i: number): Vec => {
    const [ax, ay] = pts[i % n];
    const [bx, by] = pts[(i + 1) % n];
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  const [sx, sy] = mid(n - 1);
  ctx.moveTo(sx, sy);
  for (let i = 0; i < n; i++) {
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.closePath();
}

function limb(ctx: CanvasRenderingContext2D, pts: Vec[], widths: number[], color: string) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = (widths[i] + widths[i + 1]) / 2;
    ctx.beginPath();
    ctx.moveTo(...pts[i]);
    ctx.lineTo(...pts[i + 1]);
    ctx.stroke();
  }
}

function shoe(ctx: CanvasRenderingContext2D, at: Vec, angle: number, paint: Paint, color: string) {
  ctx.save();
  ctx.translate(...at);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  blob(ctx, SHOE);
  ctx.fill();
  if (paint.sole) {
    ctx.strokeStyle = paint.sole;
    ctx.lineWidth = 0.022;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(...SOLE[0]);
    ctx.lineTo(...SOLE[1]);
    ctx.stroke();
  }
  ctx.restore();
}

type Pose = {
  headTilt: number; // rad, head lag relative to the body
  strings: Vec[]; // drawstring directions in figure space
  tail: Vec; // web tail direction in figure space
};

// Draws the figure in figure space. With MASK paint everything comes out white, for the rims.
function drawFigure(ctx: CanvasRenderingContext2D, pose: Pose, paint: Paint) {
  // Far side first
  limb(ctx, FAR_LEG, FAR_LEG_W, paint.far);
  shoe(ctx, FAR_LEG[0], 0, paint, paint.far);
  limb(ctx, FAR_ARM, ARM_W, paint.far);

  // Hoodie
  ctx.fillStyle = paint.ink;
  blob(ctx, TORSO);
  ctx.fill();
  if (paint.detail) {
    // Kangaroo pocket and the hem riding up
    ctx.strokeStyle = paint.detail;
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(0.15, 1.12);
    ctx.quadraticCurveTo(0.06, 1.1, 0.04, 0.98);
    ctx.lineTo(0.13, 0.93);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.15, 0.95);
    ctx.quadraticCurveTo(0, 0.93, 0.14, 0.95);
    ctx.stroke();
  }

  // Head: hood, face and drawstrings, lagging a little on kicks
  ctx.save();
  ctx.translate(0, 1.42);
  ctx.rotate(pose.headTilt);
  ctx.translate(0, -1.42);
  ctx.fillStyle = paint.ink;
  blob(ctx, HOOD);
  ctx.fill();
  ctx.fillStyle = paint.skin;
  blob(ctx, FACE);
  ctx.fill();
  if (paint.detail) {
    ctx.strokeStyle = paint.detail;
    ctx.lineWidth = 0.014;
    ctx.beginPath();
    ctx.moveTo(0.08, 1.44);
    ctx.quadraticCurveTo(0.17, 1.6, 0.11, 1.77);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = paint.detail ?? paint.ink;
  ctx.lineWidth = 0.01;
  ctx.lineCap = "round";
  STRING_ANCHORS.forEach(([x, y], i) => {
    const [dx, dy] = pose.strings[i];
    const len = i ? STRING_LENGTH * 0.9 : STRING_LENGTH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * len, y + dy * len);
    ctx.stroke();
  });

  // Near leg over the hoodie hem
  limb(ctx, NEAR_LEG, NEAR_LEG_W, paint.ink);
  shoe(ctx, NEAR_LEG[2], -Math.PI / 2 - 0.15, paint, paint.ink);

  // Far fist on the web, then the near arm over everything
  ctx.fillStyle = paint.far;
  ctx.beginPath();
  ctx.arc(...FAR_ARM[2], FIST_R, 0, Math.PI * 2);
  ctx.fill();
  limb(ctx, NEAR_ARM, ARM_W, paint.ink);
  ctx.fillStyle = paint.ink;
  ctx.beginPath();
  ctx.arc(...NEAR_ARM[2], FIST_R, 0, Math.PI * 2);
  ctx.fill();
}

// Web along the body and its dangling tail, in figure space (drawn over the figure)
function drawBodyWeb(ctx: CanvasRenderingContext2D, pose: Pose) {
  ctx.strokeStyle = WEB_COLOR;
  ctx.lineWidth = 0.012;
  ctx.lineCap = "round";
  ctx.beginPath();
  BODY_WEB.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  const [hx, hy] = NEAR_ARM[2];
  ctx.lineTo(hx + pose.tail[0] * TAIL_LENGTH, hy + FIST_R + pose.tail[1] * TAIL_LENGTH);
  ctx.stroke();
  // Wrap around the ankles
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.ellipse(0, 0.01, 0.06, 0.022, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export default function Hanging2DPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    // Offscreen layers around the figure: lit figure, its white mask, one rim at a time
    const layers = [0, 1, 2].map(() => document.createElement("canvas"));
    const [figLayer, maskLayer, rimLayer] = layers;
    const [fig, mask, rim] = layers.map((c) => c.getContext("2d")!);

    const s = createSwing();
    const head: Dangler = { angle: 0, velocity: 0 };
    const strings: Dangler[] = [
      { angle: 0, velocity: 0 },
      { angle: 0, velocity: 0 },
    ];
    const tail: Dangler = { angle: 0, velocity: 0 };
    const ankles: Point = { x: 0, y: 0 };
    const headTop: Point = { x: 0, y: 0 };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let scale = 1; // px per world unit
    let cameraZ = CAMERA_DISTANCE;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const aspect = width / height;
      cameraZ = aspect < 1 ? CAMERA_DISTANCE / Math.max(aspect, 0.5) ** 0.8 : CAMERA_DISTANCE;
      scale = height / (2 * cameraZ * HALF_FOV_TAN);
      // Layers: a square around the figure with room for the swing of the limbs
      const side = Math.ceil(FIGURE_HEIGHT * FIGURE_SCALE * scale * 1.5 * dpr);
      for (const layer of layers) layer.width = layer.height = side;
    };
    resize();
    window.addEventListener("resize", resize);

    const toScreen = (x: number, y: number): Vec => [width / 2 + x * scale, height / 2 - (y - CAMERA_Y) * scale];
    const toWorld = (e: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - width / 2) / scale,
        y: CAMERA_Y - (e.clientY - rect.top - height / 2) / scale,
      };
    };
    const detach = attachSwingPointer(
      canvas,
      s,
      toWorld,
      (p) => distToSegment(p, ankles, headTop) < HIT_RADIUS,
    );

    // Direction of a world-hanging dangler in figure space
    const danglerDir = (d: Dangler, flip: number): Vec => {
      const rel = d.angle - s.theta;
      return [Math.sin(rel) * flip, Math.cos(rel)];
    };

    let raf = 0;
    let last = performance.now();
    const start = last;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      stepSwing(s, dt, (now - start) / 1000, BODY_COM);
      stepDangler(head, HEAD, s, dt);
      strings.forEach((d, i) => stepDangler(d, i ? STRING_2 : STRING, s, dt));
      stepDangler(tail, TAIL, s, dt);

      const length = webLength(s);
      const sin = Math.sin(s.theta);
      const cos = Math.cos(s.theta);
      ankles.x = length * sin;
      ankles.y = PIVOT_Y - length * cos;
      const figLen = FIGURE_HEIGHT * FIGURE_SCALE;
      headTop.x = ankles.x + figLen * sin;
      headTop.y = ankles.y - figLen * cos;

      // Twist around the web reads as the side view squashing and flipping over
      const turn = Math.cos(s.twist);
      const flip = turn < 0 ? -1 : 1;
      const sx = flip * Math.max(Math.abs(turn), 0.12);
      const pose: Pose = {
        headTilt: -(head.angle - s.theta) * flip,
        strings: strings.map((d) => danglerDir(d, flip)),
        tail: danglerDir(tail, flip),
      };

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Web from the anchor to the ankles, bowed by the swing
      const [px, py] = toScreen(0, PIVOT_Y);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-s.theta);
      ctx.strokeStyle = WEB_COLOR;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(200, 220, 255, 0.6)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2 * s.bend * scale, (length * scale) / 2, 0, length * scale);
      ctx.stroke();
      ctx.restore();

      // Figure layers: centered on the middle of the body
      const side = figLayer.width;
      const [cx, cy] = toScreen((ankles.x + headTop.x) / 2, (ankles.y + headTop.y) / 2);
      const m = FIGURE_SCALE * scale * dpr;
      const place = (c: CanvasRenderingContext2D) => {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, side, side);
        c.translate(side / 2, side / 2);
        c.rotate(-s.theta);
        c.translate(0, (-figLen / 2) * scale * dpr);
        c.scale(m * sx, m);
      };
      place(fig);
      drawFigure(fig, pose, PAINT);
      drawBodyWeb(fig, pose);
      place(mask);
      drawFigure(mask, pose, MASK);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const ox = cx * dpr - side / 2;
      const oy = cy * dpr - side / 2;
      ctx.drawImage(figLayer, ox, oy);
      // Rim = the mask minus itself shifted away from the light
      for (const r of RIMS) {
        rim.setTransform(1, 0, 0, 1, 0, 0);
        rim.globalCompositeOperation = "source-over";
        rim.clearRect(0, 0, side, side);
        rim.drawImage(maskLayer, 0, 0);
        rim.globalCompositeOperation = "source-in";
        rim.fillStyle = r.color;
        rim.fillRect(0, 0, side, side);
        rim.globalCompositeOperation = "destination-out";
        rim.drawImage(maskLayer, r.dx * r.width * dpr, r.dy * r.width * dpr);
        ctx.globalAlpha = r.alpha;
        ctx.drawImage(rimLayer, ox, oy);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      detach();
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <video
        src={CITY_VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      <VersionSwitch current="2d" />
    </div>
  );
}
