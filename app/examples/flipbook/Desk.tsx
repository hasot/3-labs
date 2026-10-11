"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import type { BookFocus } from "./Book";

// A living-room corner seen from above: a black pebble side table on a kilim over an oak floor,
// a tufted leather lounge chair behind it. The table top is y = 0, where the magazine lies.
const TABLE_H = 1.9;
const FLOOR_Y = -TABLE_H;

// The camera leans over the table more steeply once it reads the open spread
const VIEW_OVERVIEW = new THREE.Vector3(0, 1, 0.6).normalize();
const VIEW_READING = new THREE.Vector3(0, 1, 0.38).normalize();
const FOV = 30;
// Width and height each pose must fit on screen, measured at the table top
const OVERVIEW = { w: 4.7, h: 3.5, at: new THREE.Vector3(0, 0, -0.05) };
const READING = { w: 2.35, h: 1.85, at: new THREE.Vector3(0, 0, 0.06) };

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

function texture(c: HTMLCanvasElement, repeat = 1, color = true) {
  const tex = new THREE.CanvasTexture(c);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

// Pale oak planks with long grain and staggered end joints
function oakFloor() {
  const { c, ctx } = canvas(2048, 2048);
  const rnd = seeded(5);
  const rows = 8;
  const ph = 2048 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 900;
    while (x < 2048) {
      const len = 700 + rnd() * 900;
      const tone = 168 + rnd() * 28;
      ctx.fillStyle = `rgb(${tone + 18},${tone - 4},${tone - 34})`;
      ctx.fillRect(x, r * ph, len, ph);
      for (let i = 0; i < 46; i++) {
        const y = r * ph + rnd() * ph;
        ctx.strokeStyle = `rgba(${rnd() > 0.5 ? "120,85,50" : "235,215,185"},${0.05 + rnd() * 0.1})`;
        ctx.lineWidth = 0.6 + rnd() * 2;
        ctx.beginPath();
        const amp = 2 + rnd() * 6;
        const ph0 = rnd() * 9;
        for (let xx = x; xx <= x + len; xx += 24) ctx.lineTo(xx, y + Math.sin(xx * 0.004 + ph0) * amp);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(60,40,20,0.35)";
      ctx.fillRect(x, r * ph, 2, ph);
      x += len;
    }
    ctx.fillStyle = "rgba(60,40,20,0.4)";
    ctx.fillRect(0, r * ph, 2048, 2);
  }
  return texture(c, 4);
}

// A faded kilim: bands of stepped diamonds in earth tones, woven texture, fringe at the ends
function kilim() {
  const W = 1024;
  const H = 1536;
  const FR = 60;
  const { c, ctx } = canvas(W, H);
  const rnd = seeded(9);
  const body = { y: FR, h: H - FR * 2 };
  ctx.fillStyle = "#4b3d30";
  ctx.fillRect(0, body.y, W, body.h);
  const palette = ["#6c5a3c", "#3a2e25", "#7d5843", "#38403b", "#8a7656", "#5a4636"];
  // Border
  ctx.strokeStyle = "#2f251e";
  ctx.lineWidth = 34;
  ctx.strokeRect(40, body.y + 40, W - 80, body.h - 80);
  // Bands of stepped diamonds
  const bands = 7;
  const bh = (body.h - 160) / bands;
  for (let b = 0; b < bands; b++) {
    const cy = body.y + 80 + bh * (b + 0.5);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const cx = 120 + ((W - 240) / (n - 1)) * i;
      const size = bh * 0.42;
      for (let ring = 4; ring >= 1; ring--) {
        ctx.fillStyle = palette[(b + i + ring) % palette.length];
        const s = (size * ring) / 4;
        ctx.beginPath();
        // Stepped outline, as weaving draws diagonals
        const steps = 6;
        for (let k = 0; k <= steps * 4; k++) {
          const t = k / (steps * 4);
          const ang = t * Math.PI * 2;
          const px = Math.sign(Math.cos(ang)) * Math.pow(Math.abs(Math.cos(ang)), 1) * s;
          const py = Math.sign(Math.sin(ang)) * Math.pow(Math.abs(Math.sin(ang)), 1) * s * 0.8;
          const q = 14;
          ctx.lineTo(cx + Math.round(px / q) * q, cy + Math.round(py / q) * q);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = "#2f251e";
    ctx.fillRect(60, cy + bh / 2 - 4, W - 120, 8);
  }
  // Weave: fine weft lines and wear
  for (let y = body.y; y < body.y + body.h; y += 3) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
    ctx.fillRect(0, y, W, 1);
  }
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? "220,200,170" : "20,14,10"},${rnd() * 0.08})`;
    ctx.fillRect(rnd() * W, body.y + rnd() * body.h, 2 + rnd() * 10, 1 + rnd() * 3);
  }
  // Fringe
  for (const y0 of [0, H - FR]) {
    for (let x = 30; x < W - 30; x += 9) {
      ctx.strokeStyle = "#cbbca0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const top = y0 === 0;
      ctx.moveTo(x, top ? FR : H - FR);
      ctx.lineTo(x + (rnd() - 0.5) * 8, top ? 6 + rnd() * 14 : H - 6 - rnd() * 14);
      ctx.stroke();
    }
  }
  const tex = texture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Buttoned leather: a bump map of dimples on a diamond grid with soft creases between them
function tufting() {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 512, 512);
  const pts: [number, number][] = [];
  for (let y = 0; y <= 512; y += 128) for (let x = (y / 128) % 2 ? 64 : 0; x <= 512; x += 128) pts.push([x, y]);
  for (const [x, y] of pts) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, 70);
    g.addColorStop(0, "#000");
    g.addColorStop(0.25, "#3c3c3c");
    g.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 70, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(40,40,40,0.5)";
  ctx.lineWidth = 6;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 64, y + 128);
    ctx.moveTo(x, y);
    ctx.lineTo(x - 64, y + 128);
    ctx.stroke();
  }
  return texture(c, 2, false);
}

function speckle(base: string, dots: string, n: number, seed: number) {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = dots;
    ctx.globalAlpha = 0.25 + rnd() * 0.6;
    ctx.beginPath();
    ctx.arc(rnd() * 512, rnd() * 512, 0.6 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return texture(c);
}

// A rounded, slightly triangular pebble outline
function pebble(rx: number, rz: number, wobble: number, turn: number) {
  const shape = new THREE.Shape();
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + wobble * Math.cos(3 * a + turn) + wobble * 0.35 * Math.cos(2 * a + turn * 1.7);
    const x = Math.cos(a) * rx * r;
    const y = Math.sin(a) * rz * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

const BLACK_STEEL = { color: "#141414", roughness: 0.62, metalness: 0.15 };

function SideTable() {
  const { top, foot } = useMemo(() => {
    const bevel = { bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4, curveSegments: 96 };
    const top = new THREE.ExtrudeGeometry(pebble(1.95, 1.65, 0.075, 0.6), { depth: 0.06, ...bevel });
    top.rotateX(Math.PI / 2);
    const foot = new THREE.ExtrudeGeometry(pebble(1.1, 0.95, 0.07, 1.1), { depth: 0.07, ...bevel });
    foot.rotateX(Math.PI / 2);
    return { top, foot };
  }, []);
  return (
    <group>
      {/* The top's upper face sits a hair under y = 0 so the magazine rests on it */}
      <mesh geometry={top} position={[0, -0.026, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...BLACK_STEEL} />
      </mesh>
      <mesh position={[0.05, -TABLE_H / 2, 0.05]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.44, TABLE_H - 0.1, 64]} />
        <meshStandardMaterial {...BLACK_STEEL} />
      </mesh>
      <mesh geometry={foot} position={[0.05, FLOOR_Y + 0.095, 0.05]} castShadow receiveShadow>
        <meshStandardMaterial {...BLACK_STEEL} />
      </mesh>
    </group>
  );
}

// A rocks glass of whisky with one big cube. Plain see-through glass (no refraction pass,
// which would render the whole scene a second time every frame), amber spirit, cloudy ice.
function Whisky() {
  const glass = useMemo(() => {
    const prof = [
      [0, 0],
      [0.2, 0],
      [0.215, 0.012],
      [0.225, 0.37],
      [0.214, 0.37],
      [0.205, 0.07],
      [0, 0.07],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(prof, 64);
  }, []);
  return (
    <group position={[-1.05, 0, -1.15]}>
      {/* Spirit first, then ice, then the glass over both */}
      <mesh position={[0, 0.07 + 0.075, 0]} renderOrder={1}>
        <cylinderGeometry args={[0.202, 0.2, 0.15, 64]} />
        <meshPhysicalMaterial color="#c46a1c" roughness={0.08} transparent opacity={0.82} clearcoat={1} depthWrite={false} />
      </mesh>
      <RoundedBox args={[0.2, 0.19, 0.2]} radius={0.03} smoothness={3} position={[0.01, 0.07 + 0.13, -0.01]} rotation={[0.18, 0.5, 0.1]} renderOrder={2}>
        <meshPhysicalMaterial color="#f4ead8" roughness={0.25} transparent opacity={0.55} clearcoat={1} depthWrite={false} />
      </RoundedBox>
      <mesh geometry={glass} castShadow renderOrder={3}>
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.02}
          metalness={0}
          transparent
          opacity={0.22}
          clearcoat={1}
          envMapIntensity={2.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Tufted leather lounge chair on a brass tube frame, a wool throw over its back
function Chair() {
  const bump = useMemo(() => tufting(), []);
  const wool = useMemo(() => speckle("#5f6266", "#2c2e31", 6000, 11), []);
  const leather = <meshStandardMaterial color="#3b2620" roughness={0.42} bumpMap={bump} bumpScale={3} />;
  const brass = <meshStandardMaterial color="#b08d57" metalness={1} roughness={0.28} />;
  const seatY = FLOOR_Y + 1.35;
  return (
    <group position={[3.35, 0, -2.6]} rotation={[0, -0.62, 0]}>
      <RoundedBox args={[2.7, 0.42, 2.3]} radius={0.18} smoothness={5} position={[0, seatY, 0]} castShadow receiveShadow>
        {leather}
      </RoundedBox>
      <RoundedBox args={[2.7, 0.42, 2.4]} radius={0.18} smoothness={5} position={[0, seatY + 1.0, -1.45]} rotation={[-1.05, 0, 0]} castShadow receiveShadow>
        {leather}
      </RoundedBox>
      <RoundedBox args={[2.2, 0.14, 1.4]} radius={0.06} smoothness={4} position={[-0.2, seatY + 1.6, -1.6]} rotation={[-1.0, 0.08, 0.06]} castShadow receiveShadow>
        <meshStandardMaterial map={wool} roughness={1} />
      </RoundedBox>
      {/* Tube frame: two side runners and a front rail */}
      {[-1.42, 1.42].map((x) => (
        <group key={x}>
          <mesh position={[x, FLOOR_Y + 0.65, 0.2]} rotation={[0.25, 0, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 1.5, 20]} />
            {brass}
          </mesh>
          <mesh position={[x, FLOOR_Y + 0.05, -0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 2.6, 20]} />
            {brass}
          </mesh>
        </group>
      ))}
      <mesh position={[0, seatY - 0.25, 1.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 2.84, 20]} />
        {brass}
      </mesh>
    </group>
  );
}

export function Desk() {
  const oak = useMemo(() => oakFloor(), []);
  const rug = useMemo(() => kilim(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial map={oak} roughness={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0.18]} position={[-0.2, FLOOR_Y + 0.008, 0.3]} receiveShadow>
        <planeGeometry args={[6.4, 9.6]} />
        <meshStandardMaterial map={rug} roughness={0.95} alphaTest={0.5} transparent={false} />
      </mesh>
      <SideTable />
      <Whisky />
      <Chair />
    </group>
  );
}

// Up and a little behind the book: its mirror image lands on the pages, not on the desk in front
const LAMP = new THREE.Vector3(-0.5, 6, -0.7);

// lamp off (default): soft daylight from a window to the upper left.
// lamp on: a single spot over the table in a dark room, its pool drifting toward the pointer.
export function Lights({ focus, lamp }: { focus: RefObject<BookFocus>; lamp: boolean }) {
  const spot = useRef<THREE.SpotLight>(null);
  const pointer = useRef(new THREE.Vector2());
  useEffect(() => {
    const onMove = (e: PointerEvent) => pointer.current.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    addEventListener("pointermove", onMove);
    return () => removeEventListener("pointermove", onMove);
  }, []);
  useFrame((_, dt) => {
    const s = spot.current;
    if (!s) return;
    const f = THREE.MathUtils.clamp(focus.current.f, 0, 1);
    const k = 1 - Math.exp(-dt * 3);
    const tx = THREE.MathUtils.lerp(0.3, 0, f) + pointer.current.x * 0.35;
    const tz = THREE.MathUtils.lerp(0.15, 0.05, f) + pointer.current.y * 0.2;
    // The lamp itself sways with the pointer, so the gloss slides across the paper
    s.position.x += (LAMP.x + pointer.current.x * 1.1 - s.position.x) * k;
    s.position.z += (LAMP.z + pointer.current.y * 0.6 - s.position.z) * k;
    s.target.position.x += (tx - s.target.position.x) * k;
    s.target.position.z += (tz - s.target.position.z) * k;
    s.target.updateMatrixWorld();
    // The cone widens once the book is open so the whole spread is lit
    s.angle = THREE.MathUtils.lerp(0.36, 0.42, f);
  });
  if (!lamp)
    return (
      <>
        <hemisphereLight args={["#e6e9ee", "#5a4a3a", 0.9]} />
        <directionalLight
          position={[-4.5, 7, -3]}
          intensity={2.4}
          color="#fff6ea"
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0005}
          shadow-camera-near={2}
          shadow-camera-far={20}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        {/* Faint window reflections on the gloss and the leather */}
        <Environment resolution={128} environmentIntensity={0.35} frames={1}>
          <Lightformer form="rect" intensity={2} color="#fff8ee" position={[-6, 4, -3]} rotation={[0, Math.PI / 2.4, 0]} scale={[5, 4, 1]} />
          <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} />
        </Environment>
      </>
    );
  return (
    <>
      <spotLight
        ref={spot}
        position={LAMP.toArray()}
        angle={0.36}
        penumbra={0.85}
        intensity={220}
        decay={2}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        // No normal bias: a turned page's vertex normal points into the book and would shadow itself
        shadow-bias={-0.0006}
        shadow-camera-near={3}
        shadow-camera-far={12}
      />
      <hemisphereLight args={["#8fa0c8", "#1a120d", 0.12]} />
      {/* Reflections only: a long softbox up and behind the book is what a glossy page mirrors
          toward the camera, so it streaks across a page as the page bends */}
      <Environment resolution={256} environmentIntensity={0.55} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[0, 4, -3]} rotation={[Math.PI / 2.6, 0, 0]} scale={[7, 1.4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#cfd8ff" position={[-5, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 4, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#ffffff" position={[3, 5, -1]} scale={1.2} />
      </Environment>
    </>
  );
}

// Frames the table in the overview and the open spread when reading, on any aspect ratio
export function CameraRig({ focus }: { focus: RefObject<BookFocus> }) {
  const at = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== FOV) {
      cam.fov = FOV;
      cam.updateProjectionMatrix();
    }
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const aspect = size.width / size.height;
    const fit = (v: { w: number; h: number }) => Math.max(v.w / 2 / (tanV * aspect), v.h / 2 / tanV);
    const f = THREE.MathUtils.clamp(focus.current.f, 0, 1);
    const e = f * f * (3 - 2 * f);
    const d = THREE.MathUtils.lerp(fit(OVERVIEW), fit(READING), e);
    at.current.lerpVectors(OVERVIEW.at, READING.at, e);
    dir.current.lerpVectors(VIEW_OVERVIEW, VIEW_READING, e).normalize();
    cam.position.copy(at.current).addScaledVector(dir.current, d);
    cam.lookAt(at.current);
  });
  return null;
}
