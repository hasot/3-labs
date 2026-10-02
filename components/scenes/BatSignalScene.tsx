"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export const BatSignalScene = () => {
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const intersectionRef = useRef(new THREE.Vector3());
  const targetPosRef = useRef(new THREE.Vector3());
  const { mouse, camera } = useThree();

  useFrame(() => {
    if (spotLightRef.current) {
      // Get mouse position immediately every frame
      raycasterRef.current.setFromCamera(mouse, camera);
      raycasterRef.current.ray.intersectPlane(planeRef.current, intersectionRef.current);

      // Update target position directly - NO DELAY
      targetPosRef.current.copy(intersectionRef.current);
      targetPosRef.current.z = -20;
      spotLightRef.current.target.position.copy(targetPosRef.current);
      spotLightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Ambient light so we can see the canvas */}
      <ambientLight intensity={0.5} color={0x2a3a4a} />

      {/* POWERFUL PROJECTOR - sharp focused light from far away */}
      <spotLight
        ref={spotLightRef}
        position={[40, -35, 35]}
        intensity={150}
        angle={Math.PI / 40}
        penumbra={0}
        decay={0.3}
        castShadow
      />

      {/* FULL SCREEN background wall/canvas */}
      <mesh position={[0, 0, -10]} scale={[100, 75, 1]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={0x1a1a2a}
          side={THREE.DoubleSide}
          metalness={0.05}
          roughness={0.9}
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
