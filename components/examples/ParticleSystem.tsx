"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

export function ParticleSystem() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.5} />
      <Environment preset="studio" />

      <ParticleEmitter />

      <OrbitControls enableDamping dampingFactor={0.05} autoRotate autoRotateSpeed={1} />
    </Canvas>
  );
}

function ParticleEmitter() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 1000;

  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 10;
      pos[i + 1] = (Math.random() - 0.5) * 10;
      pos[i + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, []);

  const velocities = useMemo(
    () =>
      new Float32Array(
        Array.from({ length: COUNT }, () => (Math.random() - 0.5) * 0.2 * 3)
      ),
    []
  );

  useFrame(() => {
    if (!ref.current) return;

    for (let i = 0; i < COUNT; i++) {
      const x = ref.current.geometry.attributes.position.array[i * 3];
      const y = ref.current.geometry.attributes.position.array[i * 3 + 1];
      const z = ref.current.geometry.attributes.position.array[i * 3 + 2];

      const newX = x + velocities[i * 3] * 0.1;
      const newY = y + velocities[i * 3 + 1] * 0.1 - 0.05;
      const newZ = z + velocities[i * 3 + 2] * 0.1;

      ref.current.geometry.attributes.position.array[i * 3] =
        newX > 5 || newX < -5 ? -newX : newX;
      ref.current.geometry.attributes.position.array[i * 3 + 1] =
        newY < -5 ? 5 : newY;
      ref.current.geometry.attributes.position.array[i * 3 + 2] =
        newZ > 5 || newZ < -5 ? -newZ : newZ;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshStandardMaterial
        color="#f97316"
        emissive="#f97316"
        emissiveIntensity={0.5}
      />
    </instancedMesh>
  );
}
