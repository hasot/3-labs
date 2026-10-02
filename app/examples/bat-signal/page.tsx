"use client";

import { Canvas } from "@react-three/fiber";
import { BatSignalScene } from "@/components/scenes/BatSignalScene";
import Link from "next/link";

export default function BatSignalPage() {
  return (
    <div className="relative w-full h-screen bg-black">
      {/* Canvas для 3D сцены */}
      <Canvas
        camera={{ position: [0, 8, 12], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        <BatSignalScene />
      </Canvas>

      {/* Back button */}
      <Link
        href="/"
        className="absolute top-8 left-8 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        ← Back
      </Link>

      {/* Info */}
      <div className="absolute bottom-8 left-8 text-slate-400 text-sm max-w-80">
        <p>Move your mouse to control the bat signal spotlight.</p>
        <p className="mt-2 text-xs opacity-70">
          The light illuminates the geometry in real-time.
        </p>
      </div>
    </div>
  );
}
