import type { Metadata } from "next";
import { ThreeUIView } from "./ThreeUIView";

export const metadata: Metadata = {
  title: "ThreeUI — 3D Labs",
  description: "The ThreeUI Community catalog, vendored into the lab: Three.js scenes, WebGL backgrounds, buttons and text effects, all live.",
};

export default function ThreeUIPage() {
  return <ThreeUIView />;
}
