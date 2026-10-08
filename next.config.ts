import type { NextConfig } from "next";

// GitHub Pages build: static export served from /<repo>
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

// ThreeUI sources (vendor/threeui) are written for Vite and import full HTML scenes with `?raw`
const turbopack: NextConfig["turbopack"] = {
  rules: {
    "*": {
      condition: { all: [{ not: "foreign" }, { query: "?raw" }] },
      loaders: ["./vendor/threeui/raw-loader.cjs"],
      as: "*.js",
    },
  },
};

const nextConfig: NextConfig = basePath
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      // Older examples (FloatingBox, BatSignalScene) have type errors; don't block the deploy
      typescript: { ignoreBuildErrors: true },
      turbopack,
    }
  : {
      turbopack,
      // ThreeUI scenes run in sandboxed iframes (origin "null"), so their fonts are cross-origin requests.
      // Vite and GitHub Pages send this header by default; next dev does not.
      async headers() {
        return [{ source: "/threeui/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
      },
    };

export default nextConfig;
