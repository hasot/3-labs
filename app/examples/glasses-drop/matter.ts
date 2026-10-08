// Soft letters for GlassesDrop: wobbling jelly and water made of drops.
// Everything here works in screen px, y down.

export type Kind = "hard" | "jelly" | "water";

// --- Jelly -----------------------------------------------------------------

// Two damped springs per letter: sideways sway of the top and squash toward the bottom
const SWAY_K = 170;
const SWAY_C = 2.6;
const SQUASH_K = 260;
const SQUASH_C = 4.5;
const SWAY_MAX = 0.45; // share of the letter height
const SQUASH_MAX = 0.4;
const JELLY_STRIPS = 28;

export type Jelly = {
  sway: number;
  swayV: number;
  squash: number;
  squashV: number;
  sprite: HTMLCanvasElement;
  pad: number;
};

export function createJelly(
  ch: string,
  font: string,
  ink: { ox: number; oy: number; hw: number; hh: number },
  dpr: number,
): Jelly {
  const pad = Math.ceil(ink.hh * 0.08) + 2;
  const w = ink.hw * 2 + pad * 2;
  const h = ink.hh * 2 + pad * 2;
  const sprite = document.createElement("canvas");
  sprite.width = Math.ceil(w * dpr);
  sprite.height = Math.ceil(h * dpr);
  const g = sprite.getContext("2d")!;
  g.scale(dpr, dpr);
  g.font = font;
  g.textBaseline = "alphabetic";
  const x = pad + ink.hw - ink.ox;
  const y = pad + ink.hh - ink.oy;

  // Raspberry gummy: deep color at the bottom, lighter on top
  const body = g.createLinearGradient(0, pad, 0, h - pad);
  body.addColorStop(0, "#ff86b0");
  body.addColorStop(0.55, "#f2266f");
  body.addColorStop(1, "#b80b4c");
  g.fillStyle = body;
  g.fillText(ch, x, y);

  // Gloss and a darker inner edge, kept inside the glyph
  g.globalCompositeOperation = "source-atop";
  const gloss = g.createRadialGradient(w * 0.32, h * 0.2, 0, w * 0.32, h * 0.2, Math.max(w, h) * 0.55);
  gloss.addColorStop(0, "rgba(255,255,255,0.75)");
  gloss.addColorStop(0.35, "rgba(255,255,255,0.18)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gloss;
  g.fillRect(0, 0, w, h);
  g.lineWidth = Math.max(2, ink.hh * 0.07);
  g.strokeStyle = "rgba(120, 0, 40, 0.35)";
  g.strokeText(ch, x, y);
  g.globalCompositeOperation = "source-over";

  return { sway: 0, swayV: 0, squash: 0, squashV: 0, sprite, pad };
}

// Kick the springs. dvx/dvy: velocity change in the letter's own frame, m/s;
// the jelly lags behind it, so it bends against the change
export function kickJelly(j: Jelly, dvx: number, dvy: number, hh: number, swayGain: number, squashGain: number) {
  j.swayV -= dvx * swayGain * hh;
  j.squashV -= dvy * squashGain;
}

// Squeeze from a contact: always compresses, the sideways part bends it along the push
export function pressJelly(j: Jelly, fx: number, fy: number, hh: number, swayGain: number, squashGain: number) {
  j.swayV += fx * swayGain * hh;
  j.squashV += Math.abs(fy) * squashGain;
}

export function stepJelly(j: Jelly, dt: number, hh: number) {
  j.swayV += (-SWAY_K * j.sway - SWAY_C * j.swayV) * dt;
  j.sway += j.swayV * dt;
  j.squashV += (-SQUASH_K * j.squash - SQUASH_C * j.squashV) * dt;
  j.squash += j.squashV * dt;
  const swayMax = SWAY_MAX * hh * 2;
  if (Math.abs(j.sway) > swayMax) {
    j.sway = Math.sign(j.sway) * swayMax;
    j.swayV *= -0.3;
  }
  if (Math.abs(j.squash) > SQUASH_MAX) {
    j.squash = Math.sign(j.squash) * SQUASH_MAX;
    j.squashV *= -0.3;
  }
}

// Draw the glyph as horizontal strips: each shifts by the sway (more toward the top)
// and the whole letter squashes onto its bottom edge, keeping roughly its area
export function drawJelly(ctx: CanvasRenderingContext2D, j: Jelly, hw: number, hh: number) {
  const sy = 1 - j.squash;
  const sx = 1 + j.squash * 0.7;
  const w = hw * 2 + j.pad * 2;
  const h = hh * 2 + j.pad * 2;
  const srcScale = j.sprite.height / h;
  const stripH = h / JELLY_STRIPS;
  for (let i = 0; i < JELLY_STRIPS; i++) {
    const y0 = -hh - j.pad + i * stripH;
    // 0 at the bottom of the ink, 1 at the top
    const u = Math.min(1, Math.max(0, (hh - (y0 + stripH / 2)) / (hh * 2)));
    const off = j.sway * Math.pow(u, 1.4);
    ctx.drawImage(
      j.sprite,
      0,
      i * stripH * srcScale,
      j.sprite.width,
      stripH * srcScale,
      (-hw - j.pad) * sx + off,
      hh + (y0 - hh) * sy,
      w * sx,
      stripH * sy + 0.6,
    );
  }
}

// --- Water -----------------------------------------------------------------

const DROP_GRAVITY = 2600;
const DROP_AIR = 0.6;
// Spring that holds a drop in the letter, and how fast it comes back after a splash
const HOME_K = 420;
const HOME_C = 26;
const HOME_RAMP = 260; // stiffness gained per second while flowing back
// How long a splashed drop stays loose, s
const LOOSE_MIN = 1.4;
const LOOSE_MAX = 3.2;
// Pushed slower than this (px/s) the water only parts around the object, faster it splashes
const SPLASH_SPEED = 120;

export type Drop = {
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Seconds left loose; when it runs out the drop flows home
  loose: number;
  k: number;
  // 0..1 down the letter, for the color
  shade: number;
};

// An oriented box in screen px with its velocity: the glasses or a solid letter
export type Pusher = {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  angle: number;
  vx: number;
  vy: number;
  w: number;
  // Drops it touched this frame
  hits: number;
};

export function sampleGlyph(
  ch: string,
  font: string,
  originX: number,
  originY: number,
  ink: { left: number; right: number; top: number; bottom: number },
  spacing: number,
): Drop[] {
  const w = Math.ceil(ink.right - ink.left) + 2;
  const h = Math.ceil(ink.bottom - ink.top) + 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.font = font;
  g.textBaseline = "alphabetic";
  g.fillStyle = "#000";
  g.fillText(ch, 1 - ink.left, 1 - ink.top);
  const data = g.getImageData(0, 0, w, h).data;
  const drops: Drop[] = [];
  // Hex grid packs the drops evenly
  const rowH = spacing * 0.866;
  for (let row = 0, y = spacing / 2; y < h; row++, y += rowH) {
    for (let x = (row % 2 ? spacing / 2 : 0) + spacing / 4; x < w; x += spacing) {
      if (data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] < 140) continue;
      const hx = originX + ink.left - 1 + x;
      const hy = originY + ink.top - 1 + y;
      drops.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0, loose: 0, k: HOME_K, shade: y / h });
    }
  }
  return drops;
}

export function stepWater(
  drops: Drop[],
  dt: number,
  t: number,
  floorY: number,
  width: number,
  pushers: Pusher[],
  stir: { x: number; y: number; vx: number; vy: number; r: number } | null,
  radius: number,
) {
  for (const d of drops) {
    if (d.loose > 0) {
      d.loose -= dt;
      d.vy += DROP_GRAVITY * dt;
      d.vx *= 1 - DROP_AIR * dt;
      if (d.loose <= 0) d.k = 0;
    } else {
      // Flowing back: the pull grows from nothing, so drops rise off the floor gently
      d.k = Math.min(HOME_K, d.k + HOME_RAMP * dt);
      // A slow ripple runs through the resting water
      const hy = d.hy + Math.sin(t * 2.6 + d.hx * 0.045) * radius * 0.25;
      const c = HOME_C * Math.sqrt(d.k / HOME_K) + 4;
      d.vx += (d.k * (d.hx - d.x) - c * d.vx) * dt;
      d.vy += (d.k * (hy - d.y) - c * d.vy) * dt;
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;

    // Floor and side walls: drops spread into a puddle
    if (d.y > floorY - radius) {
      d.y = floorY - radius;
      if (d.vy > 0) d.vy *= -0.15;
      d.vx *= 1 - 3 * dt;
    }
    if (d.x < radius) {
      d.x = radius;
      d.vx = Math.abs(d.vx) * 0.3;
    } else if (d.x > width - radius) {
      d.x = width - radius;
      d.vx = -Math.abs(d.vx) * 0.3;
    }

    for (const p of pushers) pushDrop(d, p, radius);

    if (stir) {
      const dx = d.x - stir.x;
      const dy = d.y - stir.y;
      const dist = Math.hypot(dx, dy);
      if (dist < stir.r && dist > 0.001) {
        const speed = Math.hypot(stir.vx, stir.vy);
        d.x = stir.x + (dx / dist) * stir.r;
        d.y = stir.y + (dy / dist) * stir.r;
        if (speed > SPLASH_SPEED * 2) splash(d, stir.vx * 0.6, stir.vy * 0.6, dx / dist, dy / dist, speed * 0.3);
      }
    }
  }
}

function pushDrop(d: Drop, p: Pusher, radius: number) {
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const dx = d.x - p.cx;
  const dy = d.y - p.cy;
  // Into the box's own frame
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const ex = p.hw + radius;
  const ey = p.hh + radius;
  if (Math.abs(lx) >= ex || Math.abs(ly) >= ey) return;
  p.hits++;

  // Out through the nearest side
  let nx = 0;
  let ny = 0;
  if (ex - Math.abs(lx) < ey - Math.abs(ly)) nx = Math.sign(lx) || 1;
  else ny = Math.sign(ly) || 1;
  const ox = nx ? nx * ex : lx;
  const oy = ny ? ny * ey : ly;
  d.x = p.cx + ox * cos - oy * sin;
  d.y = p.cy + ox * sin + oy * cos;
  const wnx = nx * cos - ny * sin;
  const wny = nx * sin + ny * cos;

  // Velocity of the box at this point (spin included)
  const pvx = p.vx - p.w * dy;
  const pvy = p.vy + p.w * dx;
  const speed = Math.hypot(pvx, pvy);
  if (speed > SPLASH_SPEED) splash(d, pvx, pvy, wnx, wny, speed * 0.45);
  else {
    // Slow: just slide along, the water parts around it
    const vn = d.vx * wnx + d.vy * wny;
    if (vn < 0) {
      d.vx -= vn * wnx;
      d.vy -= vn * wny;
    }
  }
}

function splash(d: Drop, vx: number, vy: number, nx: number, ny: number, burst: number) {
  const spread = 0.6 + Math.random() * 0.8;
  d.vx = vx * spread + nx * burst + (Math.random() - 0.5) * burst * 0.8;
  // Splashes always throw some water up
  d.vy = vy * spread + ny * burst - Math.random() * burst * 0.9;
  d.loose = LOOSE_MIN + Math.random() * (LOOSE_MAX - LOOSE_MIN);
  d.k = 0;
}

const WATER_SHADES = ["#d9f6ff", "#93dcfa", "#4fb9ec", "#2a8fd0"];

// Plain discs; the canvas's goo filter melts them into one liquid surface
export function drawWater(ctx: CanvasRenderingContext2D, drops: Drop[], radius: number) {
  for (let s = 0; s < WATER_SHADES.length; s++) {
    ctx.fillStyle = WATER_SHADES[s];
    ctx.beginPath();
    for (const d of drops) {
      if (Math.min(WATER_SHADES.length - 1, Math.floor(d.shade * WATER_SHADES.length)) !== s) continue;
      ctx.moveTo(d.x + radius, d.y);
      ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
