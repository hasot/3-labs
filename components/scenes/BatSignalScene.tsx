"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

interface BatSignalSceneProps {
  // Props будем добавлять по мере необходимости
}

const createRandomGeometry = () => {
  const shapes = [
    { type: "box" as const, args: [1, 1, 1] as [number, number, number] },
    { type: "sphere" as const, args: [0.8, 32, 32] as [number, number, number] },
    { type: "cone" as const, args: [0.8, 1.5, 32] as [number, number, number] },
  ];

  return shapes[Math.floor(Math.random() * shapes.length)];
};

const GeometryGroup = () => {
  const positions = [
    { pos: [-3, 1, -3] as [number, number, number], scale: 1.2 },
    { pos: [3, 0.5, -2] as [number, number, number], scale: 0.8 },
    { pos: [0, 2, -5] as [number, number, number], scale: 1 },
    { pos: [-2, 0.8, 2] as [number, number, number], scale: 0.9 },
    { pos: [2, 1.5, 1] as [number, number, number], scale: 1.1 },
  ];

  return (
    <group>
      {positions.map((item, idx) => {
        const geometry = createRandomGeometry();
        return (
          <mesh
            key={idx}
            position={item.pos}
            scale={item.scale}
            castShadow
            receiveShadow
          >
            {geometry.type === "box" && (
              <boxGeometry args={geometry.args as [number, number, number]} />
            )}
            {geometry.type === "sphere" && (
              <sphereGeometry args={geometry.args as [number, number, number]} />
            )}
            {geometry.type === "cone" && (
              <coneGeometry args={geometry.args as [number, number, number]} />
            )}
            <meshStandardMaterial
              color={0x4a90e2}
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export const BatSignalScene: React.FC<BatSignalSceneProps> = () => {
  const sceneRef = useRef<THREE.Group>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 5));
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
    <group ref={sceneRef}>
      {/* Ambient light для общего освещения */}
      <ambientLight intensity={0.3} color={0x1a1a2e} />

      {/* SpotLight - батсигнал */}
      <spotLight
        ref={spotLightRef}
        position={[0, 10, 5]}
        intensity={2}
        angle={Math.PI / 6}
        penumbra={0.5}
        decay={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
      />

      {/* Геометрия */}
      <GeometryGroup />

      {/* Плоскость для получения теней */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={0x0a0a0a} />
      </mesh>
    </group>
  );
};
