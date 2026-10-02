"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import * as THREE from "three";

export const BatSignalScene = () => {
  const raycasterRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const intersectionRef = useRef(new THREE.Vector3());

  const nightTextureRef = useRef<THREE.Texture | null>(null);
  const lightTextureRef = useRef<THREE.Texture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const mouseWorldPosRef = useRef(new THREE.Vector3());
  const { mouse, camera, scene } = useThree();

  // Initialize textures and canvas
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();

    // Load night image
    textureLoader.load("/images/ночь.png", (texture) => {
      texture.magFilter = THREE.LinearFilter;
      nightTextureRef.current = texture;
    });

    // Load light image
    textureLoader.load("/images/свет.png", (texture) => {
      texture.magFilter = THREE.LinearFilter;
      lightTextureRef.current = texture;
    });

    // Create canvas for light mask
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    canvasRef.current = canvas;

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTextureRef.current = canvasTexture;
  }, []);

  useFrame(() => {
    // Get mouse world position
    raycasterRef.current.setFromCamera(mouse, camera);
    raycasterRef.current.ray.intersectPlane(planeRef.current, intersectionRef.current);
    mouseWorldPosRef.current.copy(intersectionRef.current);

    // Update canvas with light mask
    if (canvasRef.current && nightTextureRef.current && lightTextureRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      // Draw night image as base
      const nightImage = nightTextureRef.current.image;
      ctx.drawImage(nightImage, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // Calculate spotlight circle position and size
      const spotlightRadius = 150; // Size of light circle in pixels
      const normalizedX = (mouse.x + 1) / 2; // Convert from -1 to 1 range to 0 to 1
      const normalizedY = -(mouse.y - 1) / 2; // Flip Y axis

      const spotX = normalizedX * canvasRef.current.width;
      const spotY = normalizedY * canvasRef.current.height;

      // Create circular mask for spotlight
      ctx.save();
      ctx.beginPath();
      ctx.arc(spotX, spotY, spotlightRadius, 0, Math.PI * 2);
      ctx.clip();

      // Draw light image in spotlight area
      const lightImage = lightTextureRef.current.image;
      ctx.drawImage(lightImage, 0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.restore();

      // Update canvas texture
      canvasTextureRef.current?.needsUpdate();
    }
  });

  return (
    <>
      {/* Full screen plane with canvas texture */}
      {canvasTextureRef.current && (
        <mesh position={[0, 0, -10]} scale={[100, 75, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={canvasTextureRef.current} />
        </mesh>
      )}

      {/* Fallback - show night image if canvas not ready */}
      {!canvasTextureRef.current && nightTextureRef.current && (
        <mesh position={[0, 0, -10]} scale={[100, 75, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={nightTextureRef.current} />
        </mesh>
      )}
    </>
  );
};
