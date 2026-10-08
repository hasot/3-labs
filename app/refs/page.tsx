import type { Metadata } from "next";
import { RefsView } from "./RefsView";

export const metadata: Metadata = {
  title: "References — 3D Labs",
  description: "Design references for the lab's pages: vernacular graphics archives, galleries and tools.",
};

export default function RefsPage() {
  return <RefsView />;
}
