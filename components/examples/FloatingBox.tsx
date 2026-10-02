"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import { useRef } from "react";
import * as THREE from "three";

export function FloatingBox() {
  return (
    <Canvas
      camera={{ position: [0, 3, 8], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1} castShadow />

      {/* Environment */}
      <Environment preset="sunset" />

      {/* Physics simulation */}
      <Physics gravity={[0, -9.8, 0]}>
        {/* Floor */}
        <RigidBody type="fixed" position={[0, -2, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[20, 0.5, 20]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </RigidBody>

        {/* Falling box */}
        <FallingBox />
      </Physics>

      {/* Controls */}
      <OrbitControls
        autoRotate
        autoRotateSpeed={2}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  );
}

function FallingBox() {
  const ref = useRef<THREE.Mesh>(null);

  return (
    <RigidBody ref={ref} restitution={0.9}>
      <mesh castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#60a5fa"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </RigidBody>
  );
}
