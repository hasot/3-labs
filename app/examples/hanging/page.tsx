"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { CAMERA_DISTANCE, HangingScene } from "./HangingScene";
import { VersionSwitch } from "./VersionSwitch";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Placeholder background until the dedicated city loop is ready
const CITY_VIDEO_SRC = `${BASE_PATH}/images/base.mp4`;

// Cap for the canvas pixel ratio: 3x screens would cost a lot for no visible gain
const MAX_DPR = 2;

export default function HangingPage() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <video
        src={CITY_VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      <Canvas
        className="absolute inset-0 touch-none"
        dpr={[1, MAX_DPR]}
        camera={{ position: [0, 0.2, CAMERA_DISTANCE], fov: 40 }}
      >
        <Suspense fallback={null}>
          <HangingScene />
        </Suspense>
      </Canvas>
      <VersionSwitch current="3d" />
    </div>
  );
}
