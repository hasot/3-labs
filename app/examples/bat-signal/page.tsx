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
    const spotlightRadius = 70;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Light source position (fixed at right side)
    const lightSourceX = canvas.width - 50;
    const lightSourceY = 50;

    const drawFrame = () => {
      if (!nightVideoRef.current || !lightVideoRef.current) return;

      // Draw night video as base
      ctx.drawImage(nightVideoRef.current, 0, 0, canvas.width, canvas.height);

      // Draw light beam from source to mouse (subtle cone)
      const gradient = ctx.createLinearGradient(lightSourceX, lightSourceY, mouseX, mouseY);
      gradient.addColorStop(0, "rgba(255, 255, 200, 0.05)");
      gradient.addColorStop(1, "rgba(255, 255, 200, 0.15)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 400;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(lightSourceX, lightSourceY);
      ctx.lineTo(mouseX, mouseY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Create circular mask for spotlight
      ctx.save();
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, spotlightRadius, 0, Math.PI * 2);
      ctx.clip();

      // Draw light video inside spotlight
      ctx.drawImage(lightVideoRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Draw light oval background for bat logo
      ctx.fillStyle = "rgba(255, 255, 200, 0.9)";
      ctx.beginPath();
      ctx.ellipse(mouseX, mouseY, spotlightRadius * 1.2, spotlightRadius * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw bat logo in center of spotlight
      if (batLogoRef.current && batLogoRef.current.complete) {
        const logoSize = spotlightRadius * 1.3;
        ctx.drawImage(
          batLogoRef.current,
          mouseX - logoSize / 2,
          mouseY - logoSize / 2,
          logoSize,
          logoSize
        );
      }

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
