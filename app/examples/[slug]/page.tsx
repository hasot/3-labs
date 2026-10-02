"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const FloatingBox = dynamic(() =>
  import("@/components/examples/FloatingBox").then((m) => ({
    default: m.FloatingBox,
  })),
  { ssr: false }
);

const RotatingCube = dynamic(() =>
  import("@/components/examples/RotatingCube").then((m) => ({
    default: m.RotatingCube,
  })),
  { ssr: false }
);

const ParticleSystem = dynamic(() =>
  import("@/components/examples/ParticleSystem").then((m) => ({
    default: m.ParticleSystem,
  })),
  { ssr: false }
);

const EXAMPLES = {
  "floating-box": {
    title: "Floating Box",
    description: "Basic geometry + physics",
    component: FloatingBox,
  },
  "rotating-cube": {
    title: "Rotating Cube",
    description: "Simple animation and transforms",
    component: RotatingCube,
  },
  "particle-system": {
    title: "Particle System",
    description: "Instanced particles with emitter",
    component: ParticleSystem,
  },
};

export default function ExamplePage({
  params,
}: {
  params: { slug: string };
}) {
  const example = EXAMPLES[params.slug as keyof typeof EXAMPLES];

  if (!example) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-4">
            Example not found
          </h1>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const Component = example.component;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-slate-100 mt-2">
              {example.title}
            </h1>
            <p className="text-slate-400 text-sm">{example.description}</p>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Suspense fallback={<div className="w-full h-full bg-slate-900" />}>
          <Component />
        </Suspense>
      </div>
    </div>
  );
}
