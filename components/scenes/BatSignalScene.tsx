"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export const BatSignalScene = () => {
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 8));
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
      spotLightRef.current.target.position.copy(worldPos);
      spotLightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={1.5} color={0x8899bb} />

      {/* Main Spotlight - Bat Signal */}
      <spotLight
        ref={spotLightRef}
        position={[12, 30, 18]}
        intensity={15}
        angle={Math.PI / 8}
        penumbra={0.3}
        decay={1}
        castShadow
      />

      {/* Extra fill light */}
      <pointLight position={[-10, 10, -10]} intensity={3} color={0x6b7a9e} />

      {/* Geometry */}
      <mesh position={[-3, 1, -3]} scale={1.2} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={0x3d5a80} emissive={0x1a2a3a} />
      </mesh>

      <mesh position={[3, 0.5, -2]} scale={0.8} castShadow receiveShadow>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color={0x3d5a80} emissive={0x1a2a3a} />
      </mesh>

      <mesh position={[0, 2, -5]} scale={1} castShadow receiveShadow>
        <coneGeometry args={[0.8, 1.5, 32]} />
        <meshStandardMaterial color={0x3d5a80} emissive={0x1a2a3a} />
      </mesh>

      <mesh position={[-2, 0.8, 2]} scale={0.9} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={0x3d5a80} emissive={0x1a2a3a} />
      </mesh>

      <mesh position={[2, 1.5, 1]} scale={1.1} castShadow receiveShadow>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color={0x3d5a80} emissive={0x1a2a3a} />
      </mesh>

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={0x000000} />
      </mesh>
    </>
  );
};
