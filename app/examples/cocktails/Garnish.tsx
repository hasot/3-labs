"use client";

import { useMemo, type Ref } from "react";
import * as THREE from "three";
import type { Garnish as GarnishKind } from "./drinks";

// Everything here is built from primitives in the glass's own space, so no model files are loaded

function Olive({ pimento = true }: { pimento?: boolean }) {
  return (
    <group>
      <mesh castShadow scale={[1, 1.28, 1]}>
        <sphereGeometry args={[0.058, 32, 24]} />
        <meshPhysicalMaterial color="#8a9a22" roughness={0.32} clearcoat={1} clearcoatRoughness={0.15} />
      </mesh>
      {pimento && (
        <mesh position={[0, 0.066, 0]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.024, 16, 12]} />
          <meshPhysicalMaterial color="#c2261b" roughness={0.4} clearcoat={0.6} />
        </mesh>
      )}
    </group>
  );
}

function LemonTwist() {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const turns = 1.15;
    for (let i = 0; i <= 64; i++) {
      const s = i / 64;
      const a = s * Math.PI * 2 * turns;
      // Loose corkscrew that opens up towards both ends
      const r = 0.03 + Math.sin(s * Math.PI) * 0.018;
      points.push(new THREE.Vector3((s - 0.5) * 0.3, Math.cos(a) * r, Math.sin(a) * r));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 0.016, 10, false);
  }, []);
  return (
    <mesh geometry={geometry} castShadow scale={[1, 0.6, 1]}>
      <meshPhysicalMaterial color="#f6c623" roughness={0.45} clearcoat={0.5} clearcoatRoughness={0.3} />
    </mesh>
  );
}

function PeaPod() {
  const peas = [-0.11, -0.055, 0, 0.055, 0.11];
  return (
    <group>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.62]}>
        <capsuleGeometry args={[0.04, 0.3, 8, 24]} />
        <meshPhysicalMaterial color="#4f9a2c" roughness={0.42} clearcoat={0.7} clearcoatRoughness={0.25} sheen={0.4} sheenColor="#c8f08a" />
      </mesh>
      {peas.map((x) => (
        <mesh key={x} castShadow position={[x, 0.026, 0.004]}>
          <sphereGeometry args={[0.029, 20, 14]} />
          <meshPhysicalMaterial color="#86c440" roughness={0.35} clearcoat={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// Half-moon wheel standing upright: pink flesh inside a pale rind, flat side down
// Wide strip of peel that rises out of the drink, curls over the rim and twists as it goes
function OrangePeel() {
  const geometry = useMemo(() => {
    const rows = 48;
    const positions: number[] = [];
    const indices: number[] = [];
    const center = new THREE.Vector3();
    const across = new THREE.Vector3();
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      center.set(0.1 - t * 0.26 + Math.sin(t * Math.PI) * 0.06, t * 0.52 - Math.max(0, t - 0.75) * 0.5, -0.02 + t * 0.12);
      const twist = 0.3 + t * 1.5;
      const width = 0.085 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.15) * Math.PI));
      across.set(Math.cos(twist), 0.15, Math.sin(twist)).normalize().multiplyScalar(width / 2);
      positions.push(center.x - across.x, center.y - across.y, center.z - across.z);
      positions.push(center.x + across.x, center.y + across.y, center.z + across.z);
      if (i < rows) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);
  return (
    <mesh geometry={geometry} castShadow>
      <meshPhysicalMaterial
        color="#ff8a1c"
        roughness={0.42}
        clearcoat={0.6}
        clearcoatRoughness={0.3}
        side={THREE.DoubleSide}
        sheen={0.5}
        sheenColor="#ffd08a"
      />
    </mesh>
  );
}

// Segments with pale membranes and a white core; UVs of the extruded face are shape coordinates
function useSegmentTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const c = size / 2;
    const count = 12;
    ctx.fillStyle = "#ffd9c4";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < count; i++) {
      const a0 = (i / count) * Math.PI * 2;
      const a1 = ((i + 1) / count) * Math.PI * 2;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, "#ff9a7a");
      g.addColorStop(0.3, "#f2402a");
      g.addColorStop(1, "#d81f17");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c, a0 + 0.035, a1 - 0.035);
      ctx.closePath();
      ctx.fill();
    }
    // Juice sacs: short bright strokes pointing outwards, from a fixed seed
    let seed = 11;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 900; i++) {
      const a = random() * Math.PI * 2;
      const r = c * (0.18 + random() * 0.8);
      ctx.strokeStyle = `rgba(255, ${150 + random() * 80}, ${120 + random() * 60}, ${0.15 + random() * 0.25})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      ctx.lineTo(c + Math.cos(a) * (r + 6), c + Math.sin(a) * (r + 6));
      ctx.stroke();
    }
    ctx.fillStyle = "#fff0e0";
    ctx.beginPath();
    ctx.arc(c, c, 7, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

function GrapefruitWedge() {
  const segments = useSegmentTexture();
  const { flesh, rind, pith } = useMemo(() => {
    const R = 0.27;
    const depth = 0.075;
    const half = (r: number) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, r, 0, Math.PI, false);
      s.closePath();
      return s;
    };
    const ring = (outer: number, inner: number) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, outer, 0, Math.PI, false);
      s.absarc(0, 0, inner, Math.PI, 0, true);
      s.closePath();
      return s;
    };
    const settings = (d: number): THREE.ExtrudeGeometryOptions => ({
      depth: d,
      bevelEnabled: true,
      bevelSize: 0.006,
      bevelThickness: 0.006,
      bevelSegments: 2,
      curveSegments: 48,
    });
    const flesh = new THREE.ExtrudeGeometry(half(R - 0.034), settings(depth));
    const pith = new THREE.ExtrudeGeometry(ring(R - 0.022, R - 0.036), settings(depth));
    const rind = new THREE.ExtrudeGeometry(ring(R, R - 0.022), settings(depth));
    for (const g of [flesh, pith, rind]) g.translate(0, 0, -depth / 2);
    // Map the flesh's face so the texture's centre is the wheel's centre
    const uv = flesh.attributes.uv;
    const pos = flesh.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getY(i) / (2 * R) + 0.5);
    }
    return { flesh, rind, pith };
  }, []);
  return (
    <group>
      <mesh geometry={flesh} castShadow>
        <meshPhysicalMaterial map={segments} roughness={0.3} clearcoat={0.8} clearcoatRoughness={0.2} />
      </mesh>
      <mesh geometry={pith}>
        <meshPhysicalMaterial color="#ffd7b8" roughness={0.6} />
      </mesh>
      <mesh geometry={rind} castShadow>
        <meshPhysicalMaterial color="#f08a3a" roughness={0.5} clearcoat={0.3} />
      </mesh>
    </group>
  );
}

function OlivePick() {
  return (
    <group>
      <mesh castShadow position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.0055, 0.0055, 0.78, 8]} />
        <meshStandardMaterial color="#d8d8dc" metalness={1} roughness={0.18} />
      </mesh>
      <mesh castShadow position={[0, 0.56, 0]}>
        <torusGeometry args={[0.026, 0.006, 8, 24]} />
        <meshStandardMaterial color="#d8d8dc" metalness={1} roughness={0.18} />
      </mesh>
      <Olive />
    </group>
  );
}

// Where each garnish sits on a full glass; the caller pops it in once the pour is done
export function Garnish({
  kind,
  rim,
  fill,
  ref,
}: {
  kind: GarnishKind;
  rim: number;
  fill: number;
  ref?: Ref<THREE.Group>;
}) {
  switch (kind) {
    case "lemonTwist":
      return (
        <group ref={ref} position={[0.1, fill + 0.012, 0.06]} rotation={[0, 0.5, 0]}>
          <LemonTwist />
        </group>
      );
    case "olive":
      return (
        <group ref={ref} position={[0, 1.13, 0]} rotation={[0.3, 0, 0.5]}>
          <Olive />
        </group>
      );
    case "peaPod":
      return (
        <group ref={ref} position={[0, rim + 0.035, 0.4]} rotation={[0.05, 0, -0.03]}>
          <PeaPod />
        </group>
      );
    case "grapefruit":
      return (
        <group ref={ref} position={[-0.04, rim - 0.06, 0.02]} rotation={[0, 0.18, -0.22]}>
          <GrapefruitWedge />
        </group>
      );
    case "orangePeel":
      return (
        <group ref={ref} position={[0.24, fill - 0.08, 0.08]} rotation={[0.1, -0.5, 0.18]} scale={1.6}>
          <OrangePeel />
        </group>
      );
    case "olivePick":
      return (
        <group ref={ref} position={[-0.17, fill - 0.07, 0.17]} rotation={[0.25, 0.3, 0.38]}>
          <OlivePick />
        </group>
      );
  }
}
