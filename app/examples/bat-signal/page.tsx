"use client";

import { useEffect, useRef } from "react";

export default function BatSignalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nightVideoRef = useRef<HTMLVideoElement | null>(null);
  const lightVideoRef = useRef<HTMLVideoElement | null>(null);
  const batLogoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create video elements
    const nightVideo = document.createElement("video");
    const lightVideo = document.createElement("video");

    nightVideo.autoplay = true;
    nightVideo.loop = true;
    nightVideo.muted = true;
    nightVideo.playsInline = true;
    lightVideo.autoplay = true;
    lightVideo.loop = true;
    lightVideo.muted = true;
    lightVideo.playsInline = true;

    nightVideoRef.current = nightVideo;
    lightVideoRef.current = lightVideo;

    // Add crossorigin for CORS
    nightVideo.crossOrigin = "anonymous";
    lightVideo.crossOrigin = "anonymous";

    // Error handling
    nightVideo.onerror = () => console.error("Night video failed to load");
    lightVideo.onerror = () => console.error("Light video failed to load");

    nightVideo.onloadedmetadata = () => {
      console.log("Night video loaded");
      nightVideo.play().catch(e => console.error("Night video play error:", e));
    };
    lightVideo.onloadedmetadata = () => {
      console.log("Light video loaded");
      lightVideo.play().catch(e => console.error("Light video play error:", e));
    };

    nightVideo.src = "/images/base.mp4";
    lightVideo.src = "/images/light.mp4";

    // Load bat logo
    const batLogo = new Image();
    batLogo.src = "/images/bat-logo.svg";
    batLogoRef.current = batLogo;

    // Mouse position
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    const baseSpotlightRadius = 90;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Light source position (right side, lower down)
    const lightSourceX = canvas.width - 80;
    const lightSourceY = canvas.height - 150;

    const drawFrame = () => {
      if (!nightVideoRef.current || !lightVideoRef.current) return;

      // Draw night video as base
      ctx.drawImage(nightVideoRef.current, 0, 0, canvas.width, canvas.height);

      // Draw cone-shaped light beam from bottom-right to mouse
      const dx = mouseX - lightSourceX;
      const dy = mouseY - lightSourceY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Normalize direction
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Perpendicular vector for cone width
      const perpX = -dirY;
      const perpY = dirX;

      // Dynamic cone width based on direction - distorts when pointing left, circular when pointing right
      const angleX = dirX; // -1 (left) to 1 (right)
      const baseWidth = 200;
      const coneWidth = baseWidth + angleX * 280; // Gets narrower going left, wider going right

      // Lantern size
      const lanternSize = 60;
      const lanternHalfSize = lanternSize / 2;

      // Draw visible lantern rectangle
      ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
      ctx.fillRect(
        lightSourceX - lanternHalfSize,
        lightSourceY - lanternHalfSize,
        lanternSize,
        lanternSize
      );

      // Lantern glow when not lit by spotlight
      ctx.fillStyle = "rgba(255, 180, 80, 0.4)";
      ctx.fillRect(
        lightSourceX - lanternHalfSize,
        lightSourceY - lanternHalfSize,
        lanternSize,
        lanternSize
      );

      // Create elliptical mask for spotlight that changes shape with direction
      const spotlightRadiusX = baseSpotlightRadius + angleX * 40; // Wider when pointing right
      const spotlightRadiusY = baseSpotlightRadius * (1 - Math.abs(angleX) * 0.3); // Taller when pointing center/left

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(mouseX, mouseY, spotlightRadiusX, spotlightRadiusY, Math.atan2(dy, dx), 0, Math.PI * 2);
      ctx.clip();

      // Draw light video inside spotlight
      ctx.drawImage(lightVideoRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      requestAnimationFrame(drawFrame);
    };

    drawFrame();

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
          The light reveals the bright video under the dark night.
        </p>
      </div>
    </div>
  );
}
