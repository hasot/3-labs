import type { Metadata } from "next";
import { TransitionsView } from "./TransitionsView";

export const metadata: Metadata = {
  title: "Transitions — 3D Labs",
  description: "Motion design transitions rebuilt in CSS, next to the original reel frames.",
};

export default function TransitionsPage() {
  return <TransitionsView />;
}
