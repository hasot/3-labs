"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import * as THREE from "three";

interface BatSignalSceneProps {}

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
        const type = idx % 3;
        const geometry =
          type === 0 ? <boxGeometry args={[1, 1, 1]} /> :
          type === 1 ? <sphereGeometry args={[0.8, 32, 32]} /> :
          <coneGeometry args={[0.8, 1.5, 32]} />;

        return (
          <mesh
            key={idx}
            position={item.pos}
            scale={item.scale}
            castShadow
            receiveShadow
          >
            {geometry}
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
  const spotLightRef = useRef<THREE.SpotLight | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 5));
  const intersectionRef = useRef(new THREE.Vector3());
  const { mouse, camera, scene } = useThree();

  useEffect(() => {
    if (!sceneRef.current) return;

    // Удаляем старые lights
    scene.children.forEach((child) => {
      if (child instanceof THREE.Light) {
        scene.remove(child);
      }
    });

    // Создаём ambient light
    const ambientLight = new THREE.AmbientLight(0x4a5a7f, 1.2);
    scene.add(ambientLight);

    // Создаём spotlight
    const spotLight = new THREE.SpotLight(0xffffff, 5);
    spotLight.position.set(8, 20, 12);
    spotLight.angle = Math.PI / 3.5;
    spotLight.penumbra = 0.8;
    spotLight.decay = 1;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.far = 150;
    spotLight.shadow.camera.near = 0.5;
    spotLight.target.position.set(0, 0, 0);
    scene.add(spotLight);
    scene.add(spotLight.target);
    spotLightRef.current = spotLight;

    return () => {
      scene.remove(ambientLight);
      scene.remove(spotLight);
      scene.remove(spotLight.target);
    };
  }, [scene]);

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
      <GeometryGroup />

      {/* Плоскость для получения теней */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1, 0]}
        receiveShadow
      >
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={0x0d0d1a} />
      </mesh>
    </group>
  );
};
