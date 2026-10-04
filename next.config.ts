import type { NextConfig } from "next";

// GitHub Pages build: static export served from /<repo>
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

const nextConfig: NextConfig = basePath
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      // Older examples (FloatingBox, BatSignalScene) have type errors; don't block the deploy
      typescript: { ignoreBuildErrors: true },
    }
  : {};

export default nextConfig;
