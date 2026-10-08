// Type over the scene, one family throughout (Archivo, width axis): a quiet frame of
// small captions while the tiger walks in the dark, then a full title spread once the
// tear has opened onto the jungle

type Props = { phase: "idle" | "striking" | "tearing" | "revealed" };

const WIDE = { fontStretch: "125%" } as const;

// Fades in item by item once the jungle is up
function Reveal({ on, step, children, className = "" }: {
  on: boolean;
  step: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`transition-all duration-700 ease-out ${on ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"} ${className}`}
      style={{ transitionDelay: on ? `${250 + step * 110}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

export function Copy({ phase }: Props) {
  const dark = phase === "idle";
  const jungle = phase === "revealed";

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-[#efe7d8]">
      {/* Top bar stays in both scenes */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-6 sm:p-10">
        <span className="text-sm font-extrabold uppercase tracking-[0.32em]" style={WIDE}>
          Tigris
        </span>
        <nav
          className={`flex gap-6 text-[11px] uppercase tracking-[0.24em] transition-opacity duration-500 ${dark || jungle ? "opacity-70" : "opacity-0"}`}
        >
          <span>Journal</span>
          <span className="hidden sm:inline">Field notes</span>
          <span>About</span>
        </nav>
      </header>

      {/* Dark scene: captions pinned to the edges, out of the tiger's way */}
      <div className={`transition-opacity duration-300 ${dark ? "opacity-100" : "opacity-0"}`}>
        <p className="absolute left-6 top-1/2 hidden -translate-y-1/2 rotate-180 text-[10px] uppercase tracking-[0.4em] opacity-40 [writing-mode:vertical-rl] sm:left-10 sm:block">
          Panthera tigris · Night 01
        </p>
        {/* Keeps the captions readable where they cross the tiger's paws on narrow screens */}
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent sm:hidden" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-10">
          <div className="max-w-[16rem]">
            <p className="text-[11px] uppercase tracking-[0.24em] opacity-50">Chapter 01</p>
            <p className="mt-3 text-lg font-semibold leading-snug sm:text-xl">
              Something walks out of the dark. It has seen you first.
            </p>
          </div>
          <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] opacity-70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e2582c] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e2582c]" />
            </span>
            Click to provoke it
          </p>
        </div>
      </div>

      {/* Jungle scene: the spread, as if the story were already under way */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${jungle ? "opacity-100" : "opacity-0"}`}
        style={{
          background:
            "linear-gradient(to top, rgba(6,10,6,0.88) 0%, rgba(6,10,6,0.55) 38%, rgba(6,10,6,0) 70%), linear-gradient(to right, rgba(6,10,6,0.55), rgba(6,10,6,0) 55%), linear-gradient(to bottom, rgba(6,10,6,0.6), rgba(6,10,6,0) 18%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-end">
        <div>
          <Reveal on={jungle} step={0}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#c9e2a4]">
              Chapter 02 — The jungle
            </p>
          </Reveal>
          <Reveal on={jungle} step={1}>
            <h1
              className="mt-4 text-[clamp(3.5rem,11vw,11rem)] font-black uppercase leading-[0.84] tracking-[-0.02em]"
              style={WIDE}
            >
              Into
              <br />
              the green
            </h1>
          </Reveal>
        </div>
        <div className="lg:pb-3">
          <Reveal on={jungle} step={2}>
            <p className="max-w-[34ch] text-base leading-relaxed text-[#efe7d8]/85 sm:text-lg">
              Six days into the Sundarbans the forest stops being scenery. Every leaf watches
              back. This is a field journal of the tiger that walked us in, written in mud,
              light and the long silence before a roar.
            </p>
          </Reveal>
          <Reveal on={jungle} step={3}>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-[#efe7d8]/20 pt-4 text-[11px] uppercase tracking-[0.18em]">
              <div>
                <dt className="opacity-50">Where</dt>
                <dd className="mt-1">Sundarbans</dd>
              </div>
              <div>
                <dt className="opacity-50">Coords</dt>
                <dd className="mt-1">21°54′N 89°11′E</dd>
              </div>
              <div>
                <dt className="opacity-50">Entry</dt>
                <dd className="mt-1">06 / 12</dd>
              </div>
            </dl>
          </Reveal>
          <Reveal on={jungle} step={4}>
            <p className="mt-8 flex items-center justify-between text-[11px] uppercase tracking-[0.24em]">
              <span className="font-bold" style={WIDE}>
                Read the journal →
              </span>
              <span className="opacity-50">Click to go back</span>
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
