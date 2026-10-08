import type { Metadata } from "next";
// catalog.tsx pulls in client renderers, so the server side reads the generated index
import INDEX from "@/vendor/threeui/index.json";
import { ThreeUIDetail } from "../ThreeUIDetail";

export const dynamicParams = false;

export function generateStaticParams() {
  return INDEX.map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const shader = INDEX.find((item) => item.id === id);
  return { title: `${shader?.label ?? id} — ThreeUI — 3D Labs`, description: shader?.description };
}

export default async function ThreeUIItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThreeUIDetail id={id} />;
}
