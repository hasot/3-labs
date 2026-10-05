"use client";

// Ensō: a zen ink circle that is brushed in as the videos load. When everything
// is ready a red hanko seal is stamped and the whole loader dissolves.

// Arc around (100, 100), starting at the lower left and going clockwise almost
// all the way round, leaving the open gap an ensō has
const START = (125 * Math.PI) / 180;
const SWEEP = (322 * Math.PI) / 180;
function arc(r: number, sweep = SWEEP) {
  const x0 = 100 + r * Math.cos(START);
  const y0 = 100 + r * Math.sin(START);
  const x1 = 100 + r * Math.cos(START + sweep);
  const y1 = 100 + r * Math.sin(START + sweep);
  const f = (n: number) => n.toFixed(2);
  return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

// The brush is a bundle of bristles: the inner ones run the whole way, the outer
// ones give out earlier, so the stroke is fat at the start and frays at the tail
const BRISTLES = [
  { r: 63, w: 2.5, len: 0.78, o: 0.75 },
  { r: 65.5, w: 4, len: 0.9, o: 0.95 },
  { r: 68, w: 5, len: 1, o: 1 },
  { r: 70.5, w: 5, len: 0.97, o: 1 },
  { r: 73, w: 4, len: 0.86, o: 0.9 },
  { r: 75.5, w: 2.5, len: 0.7, o: 0.7 },
  { r: 77.5, w: 1.2, len: 0.55, o: 0.5 },
].map((b) => ({ ...b, d: arc(b.r, SWEEP * b.len) }));

export function EnsoLoader({ progress, done }: { progress: number; done: boolean }) {
  const p = done ? 1 : Math.min(progress, 0.97);

  return (
    <div
      aria-hidden={done}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b0d] transition-opacity duration-1000 ${
        done ? "opacity-0 delay-700" : "opacity-100"
      }`}
    >
      <div className="relative flex items-center gap-8">
        <svg viewBox="0 0 200 200" className="h-44 w-44 md:h-56 md:w-56">
          <defs>
            {/* Rough, wet ink edge */}
            <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="7" />
            </filter>
            <filter id="dry" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" />
              <feDisplacementMap in="SourceGraphic" scale="4" />
            </filter>
          </defs>

          <g filter="url(#ink)">
            {BRISTLES.map((b) => (
              <path
                key={b.r}
                d={b.d}
                pathLength={1}
                fill="none"
                stroke="#ebe6da"
                strokeOpacity={b.o}
                strokeWidth={b.w}
                strokeLinecap="round"
                strokeDasharray="1 1"
                strokeDashoffset={1 - p}
                className="transition-[stroke-dashoffset] duration-500 ease-out"
              />
            ))}
            {/* Ink pooled where the brush first touched the paper */}
            <circle cx={100 + 70 * Math.cos(START)} cy={100 + 70 * Math.sin(START)} r={9} fill="#ebe6da" />
          </g>

          {/* Hanko seal, stamped once loading is complete */}
          <g
            className={`origin-center transition-all duration-300 ease-out ${
              done ? "scale-100 opacity-100" : "scale-150 opacity-0"
            }`}
            style={{ transformBox: "fill-box" }}
          >
            <rect x="128" y="128" width="34" height="34" rx="4" fill="#b3261e" filter="url(#dry)" />
            <text
              x="145"
              y="146"
              fill="#f4ede0"
              fontSize="13"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif" }}
            >
              <tspan x="145" dy="-6">浪</tspan>
              <tspan x="145" dy="13">人</tspan>
            </text>
          </g>
        </svg>

        <div className="flex flex-col items-center gap-4">
          <p
            className="text-xl tracking-[0.4em] text-[#ebe6da]/85 md:text-2xl"
            style={{
              writingMode: "vertical-rl",
              fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif",
            }}
          >
            昼は夜を隠す
          </p>
          <span className="font-[family-name:var(--font-cinzel)] text-[10px] tracking-[0.3em] text-[#ebe6da]/45 tabular-nums">
            {Math.round(p * 100)}
          </span>
        </div>
      </div>
    </div>
  );
}
