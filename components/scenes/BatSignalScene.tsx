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
      spotLightRef.current.position.z = 10;
      spotLightRef.current.target.position.copy(worldPos);
      spotLightRef.current.target.position.z = -10;
      spotLightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Dark ambient light */}
      <ambientLight intensity={0.2} color={0x000000} />

      {/* Main Spotlight - follows mouse */}
      <spotLight
        ref={spotLightRef}
        position={[0, 0, 10]}
        intensity={20}
        angle={Math.PI / 2.5}
        penumbra={0.6}
        decay={2}
        castShadow
      />

      {/* Large background wall/canvas */}
      <mesh position={[0, 0, -5]} scale={[20, 15, 1]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={0x000000}
          emissive={0x000000}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Some 3D objects to add depth */}
      <mesh position={[-8, -5, -3]} scale={2} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={0x1a1a2e} />
      </mesh>

      <mesh position={[8, 5, -2]} scale={1.5} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={0x1a1a2e} />
      </mesh>

      <mesh position={[0, -6, -1]} scale={[25, 1, 1]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={0x0d0d1a} />
      </mesh>
    </>
  );
};
