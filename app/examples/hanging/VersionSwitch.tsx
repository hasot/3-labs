import Link from "next/link";

// Pill to flip between the 2D and 3D takes on the same scene
export function VersionSwitch({ current }: { current: "2d" | "3d" }) {
  const item = (id: "2d" | "3d", href: string) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 transition-colors ${
        current === id ? "bg-white/90 text-black" : "text-white/70 hover:text-white"
      }`}
    >
      {id.toUpperCase()}
    </Link>
  );
  return (
    <nav className="absolute right-4 top-4 z-10 flex gap-1 rounded-full border border-white/15 bg-black/40 p-1 text-xs font-medium tracking-wider backdrop-blur">
      {item("2d", "/examples/hanging-2d")}
      {item("3d", "/examples/hanging")}
    </nav>
  );
}
