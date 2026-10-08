import Link from "next/link";

const EXAMPLES = [
  {
    slug: "floating-box",
    title: "Floating Box",
    description: "Basic geometry + physics. Sphere falls under gravity.",
  },
  {
    slug: "rotating-cube",
    title: "Rotating Cube",
    description: "Simple animation and transforms.",
  },
  {
    slug: "particle-system",
    title: "Particle System",
    description: "Instanced particles with emitter.",
  },
  {
    slug: "bat-signal",
    title: "Bat Signal",
    description: "Interactive spotlight following mouse, realistic lighting with shadows.",
  },
  {
    slug: "hanging",
    title: "Hanging",
    description: "Upside-down figure on a web over the city. Push or drag it to swing.",
  },
  {
    slug: "hanging-2d",
    title: "Hanging 2D",
    description: "Same swing as a flat rim-lit silhouette in a hoodie.",
  },
  {
    slug: "mask-reveal",
    title: "Mask Reveal",
    description: "Sunny landing hero; the cursor tears a smoky trail to the night version.",
  },
  {
    slug: "tiger",
    title: "Tiger",
    description: "Mascot hero: a tiger cub turns its head to look at the cursor.",
  },
  {
    slug: "light-beam",
    title: "Light Beam",
    description: "Personal landing: a thin warm beam follows the cursor and lights the portrait.",
  },
  {
    slug: "shave",
    title: "Shave",
    description: "The cursor is an electric razor: shave a friend's beard, the hair piles up below.",
  },
  {
    slug: "tiger-walk",
    title: "Tiger Walk",
    description: "A dark tiger walks toward you from the bottom of a black screen.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            🎨 3D Labs
          </h1>
          <p className="text-slate-400 text-lg">
            Three.js learning laboratory with React Three Fiber
          </p>
        </header>

        <section>
          <h2 className="text-2xl font-semibold text-slate-100 mb-8">Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXAMPLES.map((example) => (
              <Link
                key={example.slug}
                href={`/examples/${example.slug}`}
                className="group relative overflow-hidden rounded-lg border border-slate-700 bg-slate-800/30 backdrop-blur p-6 transition-all hover:border-blue-400 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-blue-500/20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">
                    {example.title}
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">{example.description}</p>
                  <div className="flex items-center text-blue-400 text-sm font-medium">
                    View Example
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <Link
            href="/projects"
            className="group mb-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 p-6 transition-all hover:border-blue-400 hover:bg-slate-800/50"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-1">Projects</h2>
              <p className="text-slate-400 text-sm">
                Current landing pages as a gallery, each with a locked step-by-step prompt.
              </p>
            </div>
            <span className="text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <Link
            href="/refs/threeui"
            className="group mb-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 p-6 transition-all hover:border-blue-400 hover:bg-slate-800/50"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-1">ThreeUI</h2>
              <p className="text-slate-400 text-sm">
                The MengTo/threeui Community catalog, vendored: every component live, with variants and controls.
              </p>
            </div>
            <span className="text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <Link
            href="/refs"
            className="group flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 p-6 transition-all hover:border-blue-400 hover:bg-slate-800/50"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mb-1">Design References</h2>
              <p className="text-slate-400 text-sm">
                Vernacular graphics archives, galleries and tools — with notes on what to borrow.
              </p>
            </div>
            <span className="text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </section>

        <section className="mt-16 pt-8 border-t border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Info</h2>
          <p className="text-slate-400 text-sm">
            43 Three.js skills installed: Three.js Skills (10) + Game Skills (9) + Awesome Graphics (24)
          </p>
        </section>
      </div>
    </div>
  );
}
