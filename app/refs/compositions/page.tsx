import type { Metadata } from "next";
import { CompositionsView } from "./CompositionsView";

export const metadata: Metadata = {
  title: "Compositions — 3D Labs",
  description: "Hero and page composition patterns as pastel wireframes, with live examples.",
};

export default function CompositionsPage() {
  return <CompositionsView />;
}
