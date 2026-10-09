"use client";

import { useImperativeHandle, useMemo, useRef, type Ref, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Drink spilled over the rim: drops that fall under gravity, and the wet stains they leave
// on the table. Stains stay for good, through every drink that follows.

const GRAVITY = 30;
const DROP_RADIUS = 0.028;
const MAX_DROPS = 240;
const MAX_STAINS = 96;
// Stain radius per sqrt(drops landed in it), and the biggest one can get
const STAIN_GROWTH = 0.07;
const STAIN_MAX = 1.1;

function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

class Drops {
  private pos = new Float32Array(MAX_DROPS * 3);
  private vel = new Float32Array(MAX_DROPS * 3);
  private life = new Float32Array(MAX_DROPS);
  private next = 0;
  private random = seededRandom(3);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  emit(origin: THREE.Vector3, velocity: THREE.Vector3) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_DROPS;
    const j = () => (this.random() - 0.5) * 0.05;
    this.pos.set([origin.x + j(), origin.y + j(), origin.z + j()], i * 3);
    this.vel.set([velocity.x + j() * 6, velocity.y + j() * 6, velocity.z + j() * 6], i * 3);
    this.life[i] = 2;
  }

  step(dt: number, mesh: THREE.InstancedMesh, onLand: (x: number, z: number) => void) {
    for (let i = 0; i < MAX_DROPS; i++) {
      if (this.life[i] <= 0) {
        mesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      const k = i * 3;
      this.vel[k + 1] -= GRAVITY * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.life[i] -= dt;
      if (this.pos[k + 1] <= 0.01) {
        onLand(this.pos[k], this.pos[k + 2]);
        this.life[i] = 0;
        mesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      // Stretched along the fall, so a run of drops reads as a stream
      this.v.set(this.vel[k], this.vel[k + 1], this.vel[k + 2]);
      const speed = this.v.length();
      this.q.setFromUnitVectors(UP, this.v.normalize());
      this.p.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      this.s.set(1, 1 + speed * 0.35, 1);
      mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

class Stains {
  private x = new Float32Array(MAX_STAINS);
  private z = new Float32Array(MAX_STAINS);
  private r = new Float32Array(MAX_STAINS);
  private drops = new Float32Array(MAX_STAINS);
  private turn = new Float32Array(MAX_STAINS);
  private owner = new Int16Array(MAX_STAINS).fill(-1);
  private colors = Array.from({ length: MAX_STAINS }, () => new THREE.Color());
  private next = 0;
  private random = seededRandom(9);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  splash(x: number, z: number, color: THREE.Color, owner: number) {
    // Lands in a stain of the same drink it touches: that stain grows
    for (let i = 0; i < MAX_STAINS; i++) {
      if (this.owner[i] !== owner) continue;
      const reach = STAIN_GROWTH * Math.sqrt(this.drops[i]) * 0.9 + 0.06;
      if (Math.hypot(x - this.x[i], z - this.z[i]) < reach) {
        this.drops[i] += 1;
        return;
      }
    }
    const i = this.next;
    this.next = (this.next + 1) % MAX_STAINS;
    this.x[i] = x;
    this.z[i] = z;
    this.r[i] = 0;
    this.drops[i] = 1;
    this.turn[i] = this.random() * Math.PI * 2;
    this.owner[i] = owner;
    // A little darker than the drink: it soaks into the cloth
    this.colors[i].copy(color).multiplyScalar(0.5);
  }

  step(dt: number, mesh: THREE.InstancedMesh) {
    for (let i = 0; i < MAX_STAINS; i++) {
      if (this.owner[i] < 0) {
        mesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      // Spreads out towards the size its drops make
      const target = Math.min(STAIN_MAX, STAIN_GROWTH * Math.sqrt(this.drops[i]) + 0.04);
      this.r[i] += (target - this.r[i]) * (1 - Math.exp(-dt * 2.5));
      this.p.set(this.x[i], 0.002 + i * 0.00002, this.z[i]);
      this.q.setFromEuler(this.e.set(-Math.PI / 2, 0, this.turn[i]));
      this.s.set(this.r[i] * 2, this.r[i] * 2, 1);
      mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
      mesh.setColorAt(i, this.colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

// Irregular wet blot: a few overlapping soft circles, white so each stain is tinted per instance
function useBlotTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const random = seededRandom(21);
    const c = size / 2;
    for (let i = 0; i < 14; i++) {
      const a = random() * Math.PI * 2;
      const d = random() * c * 0.5;
      const r = c * (0.12 + random() * 0.3);
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.75)");
      g.addColorStop(0.85, "rgba(255,255,255,0.7)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

export type PuddlesApi = { splash: (x: number, z: number, color: THREE.Color, owner: number) => void };

export function Puddles({ ref }: { ref?: Ref<PuddlesApi> }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const stains = useMemo(() => new Stains(), []);
  const blot = useBlotTexture();

  useImperativeHandle(ref, () => ({ splash: (x, z, color, owner) => stains.splash(x, z, color, owner) }), [stains]);
  useFrame((_, delta) => stains.step(Math.min(delta, 1 / 30), mesh.current));

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_STAINS]} receiveShadow frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      {/* Wet and glossy, so the key light glints on it */}
      <meshStandardMaterial
        map={blot}
        transparent
        opacity={0.75}
        roughness={0.12}
        envMapIntensity={0.8}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </instancedMesh>
  );
}

export type StreamApi = { emit: (origin: THREE.Vector3, velocity: THREE.Vector3) => void };

export function Stream({
  color,
  owner,
  puddles,
  ref,
}: {
  color: string;
  owner: number;
  puddles: RefObject<PuddlesApi | null>;
  ref?: Ref<StreamApi>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const drops = useMemo(() => new Drops(), []);
  const tint = useMemo(() => new THREE.Color(color), [color]);

  useImperativeHandle(ref, () => ({ emit: (o, v) => drops.emit(o, v) }), [drops]);
  useFrame((_, delta) =>
    drops.step(Math.min(delta, 1 / 30), mesh.current, (x, z) => puddles.current?.splash(x, z, tint, owner)),
  );

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_DROPS]} frustumCulled={false}>
      <sphereGeometry args={[DROP_RADIUS, 8, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        roughness={0.1}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}
