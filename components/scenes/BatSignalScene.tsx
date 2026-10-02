"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export const BatSignalScene = () => {
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const intersectionRef = useRef(new THREE.Vector3());
  const { mouse, camera } = useThree();

  const getMouseWorldPosition = () => {
    raycasterRef.current.setFromCamera(mouse, camera);
    raycasterRef.current.ray.intersectPlane(
      planeRef.current,
      intersectionRef.current
    );
    return intersectionRef.current;
  };

  useFrame(() => {
    if (spotLightRef.current) {
      const worldPos = getMouseWorldPosition();
      spotLightRef.current.position.copy(worldPos);
      spotLightRef.current.position.z = 8;
      spotLightRef.current.target.position.copy(worldPos);
      spotLightRef.current.target.position.z = -10;
      spotLightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Ambient light so we can see the canvas */}
      <ambientLight intensity={0.5} color={0x2a3a4a} />

      {/* Main Spotlight - follows mouse - SHARP FOCUSED CIRCLE */}
      <spotLight
        ref={spotLightRef}
        position={[0, 0, 8]}
        intensity={100}
        angle={Math.PI / 6}
        penumbra={0}
        decay={0.5}
        castShadow
      />

      {/* Large background wall/canvas - GREY so spotlight is visible */}
      <mesh position={[0, 0, -5]} scale={[25, 18, 1]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={0x1a1a2a}
          side={THREE.DoubleSide}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>

      {/* Some objects for atmosphere */}
      <mesh position={[-10, -6, -3]} scale={2} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={0x0d0d15} />
      </mesh>

      <mesh position={[10, 6, -2]} scale={1.5} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={0x0d0d15} />
      </mesh>
    </>
  );
};
