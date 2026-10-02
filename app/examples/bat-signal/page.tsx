"use client";

import { useEffect, useRef } from "react";

export default function BatSignalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nightImageRef = useRef<HTMLImageElement | null>(null);
  const lightImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Load images
    const nightImg = new Image();
    const lightImg = new Image();

    nightImg.onload = () => {
      nightImageRef.current = nightImg;
      drawFrame();
    };
    lightImg.onload = () => {
      lightImageRef.current = lightImg;
      drawFrame();
    };

    nightImg.src = "/images/ночь.png";
    lightImg.src = "/images/свет.png";

    // Mouse position
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    const spotlightRadius = 70;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    const drawFrame = () => {
      if (!nightImageRef.current || !lightImageRef.current) return;

      // Draw night image as base
      ctx.drawImage(nightImageRef.current, 0, 0, canvas.width, canvas.height);

      // Create circular mask for spotlight
      ctx.save();
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, spotlightRadius, 0, Math.PI * 2);
      ctx.clip();

      // Draw light image inside spotlight
      ctx.drawImage(lightImageRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      requestAnimationFrame(drawFrame);
    };

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("mousemove", () => {});
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Back button */}
      <a
        href="/"
        className="absolute top-8 left-8 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors z-10"
      >
        ← Back
      </a>

      {/* Info */}
      <div className="absolute bottom-8 left-8 text-slate-400 text-sm max-w-80 z-10">
        <p>Move your mouse to control the bat signal light mask.</p>
        <p className="mt-2 text-xs opacity-70">
          The light reveals the bright image under the dark night.
        </p>
      </div>
    </div>
  );
}
