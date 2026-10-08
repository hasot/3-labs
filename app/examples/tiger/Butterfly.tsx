import type { RefObject } from "react";

export const BUTTERFLY_SIZE = 60;

// A blue morpho seen from above. The wings are one shape, mirrored for the left
// side; TigerHero flaps them by squeezing each side towards the body
export function Butterfly({
  rootRef,
  leftRef,
  rightRef,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  leftRef: RefObject<SVGUseElement | null>;
  rightRef: RefObject<SVGUseElement | null>;
}) {
  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-20 opacity-0 transition-opacity duration-500 will-change-transform"
      style={{
        width: BUTTERFLY_SIZE,
        height: BUTTERFLY_SIZE,
        filter: "drop-shadow(0 6px 6px rgba(110, 45, 0, 0.3))",
      }}
    >
      <svg viewBox="-50 -50 100 100" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="morpho" cx="0" cy="0" r="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#bdf0ff" />
            <stop offset="0.35" stopColor="#3fb8ff" />
            <stop offset="0.75" stopColor="#1463d6" />
            <stop offset="1" stopColor="#0b2a6b" />
          </radialGradient>
          <g id="wing">
            {/* Fore wing */}
            <path
              d="M1,-3 C5,-20 20,-41 41,-42 C50,-42 51,-33 47,-24 C41,-11 22,-3 1,0 Z"
              fill="url(#morpho)"
              stroke="#0a1a3d"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Hind wing */}
            <path
              d="M1,1 C16,-3 34,3 37,17 C40,31 26,41 15,37 C6,33 2,19 1,4 Z"
              fill="url(#morpho)"
              stroke="#0a1a3d"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Veins */}
            <path d="M2,-2 C14,-12 26,-24 38,-36 M2,-1 C18,-8 32,-14 44,-26 M2,3 C14,8 24,16 30,30" stroke="#0a1a3d" strokeWidth="0.9" opacity="0.45" fill="none" />
            <circle cx="40" cy="-36" r="2" fill="#fff" opacity="0.9" />
            <circle cx="45.5" cy="-30" r="1.6" fill="#fff" opacity="0.9" />
            <circle cx="46" cy="-24" r="1.2" fill="#fff" opacity="0.85" />
            <circle cx="22" cy="36" r="1.4" fill="#fff" opacity="0.8" />
            <circle cx="30" cy="32" r="1.2" fill="#fff" opacity="0.8" />
          </g>
        </defs>

        <use ref={leftRef} href="#wing" transform="scale(-1 1)" />
        <use ref={rightRef} href="#wing" />

        {/* Body, head and antennae */}
        <path d="M0,-17 C-3,-26 -7,-31 -10,-33" stroke="#1b1b1b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M0,-17 C3,-26 7,-31 10,-33" stroke="#1b1b1b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="-10" cy="-33" r="1.8" fill="#1b1b1b" />
        <circle cx="10" cy="-33" r="1.8" fill="#1b1b1b" />
        <ellipse cx="0" cy="2" rx="3" ry="15" fill="#1b1b1b" />
        <circle cx="0" cy="-15" r="3.6" fill="#1b1b1b" />
      </svg>
    </div>
  );
}
