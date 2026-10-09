/** Looping CSS recreations of the reel's transitions; styles in transitions.css */

const STAR = "M50 4 C55 36 64 45 96 50 C64 55 55 64 50 96 C45 64 36 55 4 50 C36 45 45 36 50 4Z";

function Pull() {
  return (
    <div className="tr-stage tr-pull">
      <p className="ph p1">Moins de calculs</p>
      <p className="ph p2">Moins de messages</p>
      <p className="ph p3">
        Plus de temps
        <br />
        sur le terrain
      </p>
    </div>
  );
}

function Lid() {
  return (
    <div className="tr-stage tr-lid">
      <div className="msg m1">
        <i className="batt" />
        49 performance signals
      </div>
      <div className="msg m2">
        <i className="batt" />
        One clear answer
      </div>
      <div className="lid top" />
      <div className="lid bot" />
    </div>
  );
}

function Iris() {
  return (
    <div className="tr-stage tr-iris">
      <div className="logo">lumen</div>
      <div className="s2">
        <i className="cd cd1" />
        <i className="cd cd2" />
        <i className="cd cd3" />
        <span className="cap">night campaign</span>
      </div>
      <div className="ring" />
    </div>
  );
}

function Dot() {
  return (
    <div className="tr-stage tr-dot">
      <div className="roll">
        <ul>
          <li>Every run counts</li>
          <li>and you stay</li>
          <li>in control of</li>
          <li>your growth</li>
        </ul>
      </div>
      <svg viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength={100} d="M44 88 C 70 88, 76 34, 100 48 S 128 74, 140 20" />
      </svg>
      <div className="knob" />
      <div className="after">Next chapter</div>
    </div>
  );
}

const WORDS = ["That's", "exactly", "what", "you", "were", "looking", "for"];

function Words() {
  return (
    <div className="tr-stage tr-words">
      <p>
        {WORDS.map((w, i) => (
          <span key={w} className="w" style={{ "--i": i } as React.CSSProperties}>
            {w}{" "}
          </span>
        ))}
        <svg className="spark" viewBox="0 0 100 100" aria-hidden="true">
          <path d={STAR} />
        </svg>
      </p>
    </div>
  );
}

function Star() {
  return (
    <div className="tr-stage tr-star">
      <p className="wd wd1">your results</p>
      <p className="wd wd2">results</p>
      <p className="wd wd3">and</p>
      <svg className="sh s1" viewBox="0 0 100 100" aria-hidden="true">
        <path d={STAR} />
      </svg>
      <svg className="sh s2" viewBox="0 0 100 100" aria-hidden="true">
        <path d={STAR} />
      </svg>
    </div>
  );
}

const RUNNERS = [
  { name: "800 m : 3:27", sub: "4:19/km", pill: "Allure 10 km" },
  { name: "800 m : 3:04", sub: "3:50/km", pill: "VMA 18 km/h" },
  { name: "800 m : 3:56", sub: "4:55/km", pill: "+6% this week" },
];

function Cards() {
  return (
    <div className="tr-stage tr-cards">
      {RUNNERS.map((r, i) => (
        <div key={r.name} className={`card k${i + 1}`}>
          <i className="av" />
          <span>
            {r.name}
            <small>{r.sub}</small>
          </span>
          <span className="pill">{r.pill}</span>
        </div>
      ))}
    </div>
  );
}

// Deterministic so server and client render the same chart
const BARS = Array.from({ length: 56 }, (_, i) => {
  const noise = ((i * 9301 + 49297) % 233280) / 233280;
  // Rounded: Node and the browser may disagree on the last digits of Math.sin
  return Math.min(18 + 50 * Math.abs(Math.sin(i * 0.45)) + 32 * noise, 100).toFixed(1);
});

function Qa() {
  return (
    <div className="tr-stage tr-qa">
      <p className="q">What do I need to see right now?</p>
      <div className="win">
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
        <div className="kpis">
          <span>
            <small>Sessions</small>12.4k
          </span>
          <span>
            <small>Best 800 m</small>3:27
          </span>
          <span>
            <small>Load</small>+18%
          </span>
        </div>
        <div className="bars">
          {BARS.map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const DEMOS: Record<string, () => React.JSX.Element> = {
  pull: Pull,
  lid: Lid,
  iris: Iris,
  dot: Dot,
  words: Words,
  star: Star,
  cards: Cards,
  qa: Qa,
};
