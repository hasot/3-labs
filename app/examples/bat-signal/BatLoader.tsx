import { batMaskStyle } from "./bat-logo";

// White batarang on black, thrown on a loop and caught, then resting a beat. Dissolves once `visible` turns false.
export function BatLoader({ visible }: { visible: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-hidden={!visible}
      className={`absolute inset-0 z-40 flex items-center justify-center bg-black transition-opacity duration-700 ease-out ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Flight path outside, spin inside, so the batarang spins in its tilted plane */}
      <span className="block motion-safe:animate-batarang-flight">
        {/* Glow on the wrapper: a mask would clip a filter on the masked element */}
        <span
          className="block motion-safe:animate-batarang-spin"
          style={{
            filter:
              "drop-shadow(0 0 5px rgb(255 255 255 / 0.85)) drop-shadow(0 0 18px rgb(225 235 255 / 0.35))",
          }}
        >
          <span className="block h-7 w-15 bg-white" style={batMaskStyle} />
        </span>
      </span>
    </div>
  );
}
