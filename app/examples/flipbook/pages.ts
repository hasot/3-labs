// Everything printed in the magazine, drawn with Canvas 2D: a cover, a back cover and the
// spreads. A spread is one canvas two portrait pages wide, so a centerfold runs across the
// gutter; the left half lands on the back of one leaf, the right half on the front of the next.
// The projects are the lab's own: their texts come from the gallery, their pictures are the
// gallery's looping preview recordings, playing live while their spread is open.

import { PROJECTS, type Project } from "../../projects/projects";

// Portrait pages, the classic 8½ × 11 magazine trim (1 × 1.33 in world units)
export const SPREAD_W = 1800;
export const SPREAD_H = 1197;
export const PAGE_PX = SPREAD_W / 2;
export const COVER_PX = { w: 1000, h: 1330 };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ISSUE = "VOL. 03 · No. 10 · OCTOBER 2026";

export type Fonts = { sans: string; serif: string; mono: string };

// next/font hashes the family names; the CSS variables on <html> hold the real ones
export function readFonts(): Fonts {
  const cs = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    sans: pick("--font-geist-sans", "system-ui, sans-serif"),
    serif: pick("--font-faustina", "Georgia, serif"),
    mono: pick("--font-geist-mono", "ui-monospace, monospace"),
  };
}

export async function loadFonts(f: Fonts) {
  await Promise.all(
    [
      `400 40px ${f.sans}`,
      `600 40px ${f.sans}`,
      `400 40px ${f.serif}`,
      `800 40px ${f.serif}`,
      `italic 400 40px ${f.serif}`,
      `400 40px ${f.mono}`,
    ].map((spec) => document.fonts.load(spec).catch(() => undefined)),
  );
}

// ─── Media: every file downloaded up front, one video decoding at a time ───
// Posters and all the recordings are fetched as soon as the page opens, so turning to a spread
// never waits on the network; only the recordings of the spread on show actually play.

export class Media {
  private posters = new Map<string, HTMLImageElement>();
  private videos = new Map<string, HTMLVideoElement>();
  private files = new Map<string, string>();
  private disposed = false;

  // Downloads every recording now; until a file is in, its video streams from the network
  preloadVideos(slugs: string[]) {
    return Promise.all(
      slugs.map(async (slug) => {
        try {
          const res = await fetch(`${BASE_PATH}/previews/${slug}.mp4`);
          const url = URL.createObjectURL(await res.blob());
          if (this.disposed) URL.revokeObjectURL(url);
          else this.files.set(slug, url);
        } catch {
          // The network copy still works
        }
      }),
    );
  }

  loadPosters(slugs: string[]) {
    return Promise.all(
      slugs.map(
        (slug) =>
          new Promise<void>((done) => {
            const img = new Image();
            img.onload = img.onerror = () => done();
            img.src = `${BASE_PATH}/previews/${slug}.jpg`;
            this.posters.set(slug, img);
          }),
      ),
    );
  }

  // Plays these recordings and pauses every other one
  play(slugs: string[]) {
    for (const slug of slugs) {
      let v = this.videos.get(slug);
      if (!v) {
        v = document.createElement("video");
        v.src = this.files.get(slug) ?? `${BASE_PATH}/previews/${slug}.mp4`;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = "auto";
        this.videos.set(slug, v);
      }
      if (v.paused) v.play().catch(() => undefined);
    }
    for (const [slug, v] of this.videos) if (!slugs.includes(slug) && !v.paused) v.pause();
  }

  // The live frame when there is one, the poster otherwise
  get(slug: string): CanvasImageSource | null {
    const v = this.videos.get(slug);
    if (v && v.readyState >= 2 && !v.paused) return v;
    const img = this.posters.get(slug);
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  dispose() {
    this.disposed = true;
    for (const url of this.files.values()) URL.revokeObjectURL(url);
    this.files.clear();
    for (const v of this.videos.values()) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
    this.videos.clear();
  }
}

type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, t: number, F: Fonts, M: Media) => void;

const font = (size: number, family: string, weight = 400, italic = false) =>
  `${italic ? "italic " : ""}${weight} ${size}px ${family}`;

function text(ctx: Ctx, s: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign = "left", spacing = 0) {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = "0px";
}

// Word-wrapped paragraph; returns the baseline below the last line
function para(ctx: Ctx, s: string, x: number, y: number, maxW: number, lh: number, f: string, color: string, maxLines = 99) {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
  let line = "";
  let lines = 0;
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      if (++lines === maxLines) {
        ctx.fillText(`${line}…`, x, y);
        return y + lh;
      }
      ctx.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = next;
  }
  ctx.fillText(line, x, y);
  return y + lh;
}

// Largest size (up to max) at which s fits in width
function fitSize(ctx: Ctx, s: string, family: string, weight: number, width: number, max: number, spacing = 0) {
  ctx.font = font(100, family, weight);
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(s).width;
  ctx.letterSpacing = "0px";
  return Math.min(max, (100 * width) / w);
}

function hairline(ctx: Ctx, x0: number, x1: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, x1 - x0, 1.5);
}

// object-fit: cover into a box, around a focal point (0…1 of the source)
function cover(ctx: Ctx, img: CanvasImageSource | null, x: number, y: number, w: number, h: number, fx = 0.5, fy = 0.5, fallback = "#111") {
  ctx.fillStyle = fallback;
  ctx.fillRect(x, y, w, h);
  if (!img) return;
  const iw = img instanceof HTMLVideoElement ? img.videoWidth : (img as HTMLImageElement).naturalWidth;
  const ih = img instanceof HTMLVideoElement ? img.videoHeight : (img as HTMLImageElement).naturalHeight;
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  const sx = Math.min(Math.max(fx * iw - sw / 2, 0), iw - sw);
  const sy = Math.min(Math.max(fy * ih - sh / 2, 0), ih - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One tile of film grain over every page, so flat colour reads as paper
let grainTile: HTMLCanvasElement | null = null;
function grain(ctx: Ctx, x: number, y: number, w: number, h: number, alpha: number) {
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext("2d")!;
    const img = g.createImageData(256, 256);
    const rnd = mulberry(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(grainTile, "repeat")!;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function shade(ctx: Ctx, x: number, y0: number, w: number, y1: number, from: string, to: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(x, Math.min(y0, y1), w, Math.abs(y1 - y0));
}

const PAPER = "#f3f0ea";
const INK = "#141312";
const GREY = "#7d786f";

// Running heads and folios, as every magazine page has
function furniture(ctx: Ctx, n: number, F: Fonts, colorL: string, colorR = colorL) {
  text(ctx, String(n).padStart(2, "0"), 48, 64, font(15, F.mono), colorL, "left", 2);
  text(ctx, "LABS", PAGE_PX - 48, 64, font(15, F.mono), colorL, "right", 4);
  text(ctx, ISSUE, PAGE_PX + 48, 64, font(15, F.mono), colorR, "left", 2);
  text(ctx, String(n + 1).padStart(2, "0"), SPREAD_W - 48, 64, font(15, F.mono), colorR, "right", 2);
}

// Page number a spread starts on: the cover is 1, the contents 2–3
export const pageOf = (spread: number) => 2 + spread * 2;

// ─── Covers ────────────────────────────────────────────────────────────────

const COVER_STAR = "light-beam";

function barcode(ctx: Ctx, x: number, y: number, F: Fonts) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, 170, 96);
  const rnd = mulberry(3);
  let bx = x + 12;
  while (bx < x + 158) {
    const w = 1 + Math.floor(rnd() * 3);
    ctx.fillStyle = "#000";
    ctx.fillRect(bx, y + 10, w, 60);
    bx += w + 1 + Math.floor(rnd() * 3);
  }
  text(ctx, "0 74470 26100 3", x + 85, y + 88, font(13, F.mono), "#000", "center", 1);
}

export function drawFrontCover(ctx: Ctx, F: Fonts, M: Media) {
  const { w, h } = COVER_PX;
  cover(ctx, M.get(COVER_STAR), 0, 0, w, h, 0.74, 0.5, "#0d1424");
  shade(ctx, 0, 0, w, 420, "rgba(5,8,16,0.55)", "rgba(5,8,16,0)");
  shade(ctx, 0, h - 520, w, h, "rgba(5,8,16,0)", "rgba(5,8,16,0.75)");
  // Masthead
  const size = fitSize(ctx, "LABS", F.serif, 800, w - 90, 330, -6);
  text(ctx, "LABS", w / 2, 40 + size * 0.78, font(size, F.serif, 800), "#f4efe6", "center", -6);
  text(ctx, `INTERACTIVE · WEBGL · ${ISSUE}`, w / 2, 40 + size * 0.78 + 34, font(14, F.mono), "rgba(244,239,230,0.8)", "center", 3);
  // Cover lines
  text(ctx, "Eight heroes", 48, 560, font(64, F.serif, 800), "#f4efe6", "left", -1);
  text(ctx, "you can touch", 48, 622, font(64, F.serif, 400, true), "#f4efe6", "left", -1);
  hairline(ctx, 48, 300, 654, "rgba(244,239,230,0.5)");
  text(ctx, "THE CENTERFOLD", 48, 700, font(15, F.mono), "#f0b45a", "left", 3);
  text(ctx, "Tiger Walk", 48, 742, font(36, F.serif, 800), "#f4efe6");
  text(ctx, "PLUS", 48, 806, font(15, F.mono), "#f0b45a", "left", 3);
  para(ctx, "A razor, a bat-signal, a cocktail you can drink and a word made of smoke", 48, 842, 330, 34, font(24, F.serif, 400, true), "#f4efe6");
  text(ctx, "Dmitry Yunkov", w - 48, h - 150, font(40, F.serif, 800), "#f4efe6", "right");
  text(ctx, "on light, shadow & the cursor", w - 48, h - 112, font(24, F.serif, 400, true), "rgba(244,239,230,0.85)", "right");
  barcode(ctx, 48, h - 150, F);
  grain(ctx, 0, 0, w, h, 0.08);
}

export function drawBackCover(ctx: Ctx, F: Fonts) {
  const { w, h } = COVER_PX;
  ctx.fillStyle = "#0d0d0e";
  ctx.fillRect(0, 0, w, h);
  text(ctx, "LABS", w / 2, h / 2 + 10, font(120, F.serif, 800), "#2a2a2c", "center", -3);
  text(ctx, "Built in the browser, one page at a time.", w / 2, h / 2 + 70, font(26, F.serif, 400, true), "#555", "center");
  text(ctx, ISSUE, w / 2, h - 80, font(14, F.mono), "#444", "center", 3);
  grain(ctx, 0, 0, w, h, 0.12);
}

// ─── Spreads ───────────────────────────────────────────────────────────────

export type Spread = {
  title: string;
  // The project a spread is about (the nav links to it) and the recordings it shows
  slug?: string;
  media: string[];
  animated: boolean;
  draw: Draw;
};

const project = (slug: string) => PROJECTS.find((p) => p.slug === slug) as Project;

// Recordings across the gutter, the title huge over them — at the top when the recording
// carries its own headline at the bottom
function centerfold(slug: string, clip: string, n: number, fx: number, fy: number, label: string, titleTop: boolean): Draw {
  const p = project(slug);
  return (ctx, _t, F, M) => {
    cover(ctx, M.get(clip), 0, 0, SPREAD_W, SPREAD_H, fx, fy);
    shade(ctx, 0, 0, SPREAD_W, titleTop ? 460 : 160, "rgba(0,0,0,0.62)", "rgba(0,0,0,0)");
    shade(ctx, 0, SPREAD_H - 520, SPREAD_W, SPREAD_H, "rgba(0,0,0,0)", "rgba(0,0,0,0.78)");
    furniture(ctx, pageOf(n), F, "rgba(255,255,255,0.75)");
    const size = fitSize(ctx, p.title.toUpperCase(), F.serif, 800, 1100, 210, -4);
    const base = titleTop ? 120 + size * 0.75 : SPREAD_H - 150;
    text(ctx, label, 60, base - size * 0.75 - 40, font(16, F.mono), "#f0b45a", "left", 4);
    text(ctx, p.title.toUpperCase(), 52, base, font(size, F.serif, 800), "#f6f1e8", "left", -4);
    text(ctx, `${p.category.toUpperCase()} · ${p.stack.join(" · ")}`, 60, base + 58, font(15, F.mono), "rgba(246,241,232,0.7)", "left", 2);
    para(ctx, p.summary, SPREAD_W - 460, SPREAD_H - 300, 400, 28, font(19, F.sans), "rgba(246,241,232,0.88)", 8);
    text(ctx, `Play it → /examples/${slug}`, SPREAD_W - 460, SPREAD_H - 52, font(15, F.mono), "#f0b45a", "left", 1);
    grain(ctx, 0, 0, SPREAD_W, SPREAD_H, 0.06);
  };
}

// Words on paper on the left, the picture full-bleed on the right, the title over both
function editorial(slug: string, clip: string, n: number, fx: number, fy: number, dark: boolean, quote: string): Draw {
  const p = project(slug);
  return (ctx, _t, F, M) => {
    const paper = dark ? "#0e0e0f" : PAPER;
    const ink = dark ? "#f1ede6" : INK;
    const soft = dark ? "#8f8a82" : GREY;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, PAGE_PX, SPREAD_H);
    cover(ctx, M.get(clip), PAGE_PX, 0, PAGE_PX, SPREAD_H, fx, fy);
    furniture(ctx, pageOf(n), F, soft, "rgba(255,255,255,0.75)");

    // The headline starts on the paper and runs on over the picture
    const title = p.title.toUpperCase();
    const size = fitSize(ctx, title, F.serif, 800, 1560, 250, -4);
    text(ctx, title, 50, 140 + size * 0.75, font(size, F.serif, 800), ink, "left", -4);
    const top = 140 + size * 0.75 + 70;
    text(ctx, `${p.category.toUpperCase()} — ${String(n).padStart(2, "0")}`, 60, top, font(15, F.mono), soft, "left", 3);
    hairline(ctx, 60, PAGE_PX - 60, top + 22, dark ? "#2a2a2a" : "#d3cec4");

    // Two columns: the story, then how it is made
    const colW = (PAGE_PX - 60 * 2 - 40) / 2;
    const y = para(ctx, p.summary, 60, top + 70, colW, 30, font(19, F.serif), ink, 18);
    text(ctx, "STACK", 60, y + 30, font(13, F.mono), soft, "left", 3);
    p.stack.forEach((s, i) => text(ctx, s, 60, y + 62 + i * 28, font(17, F.sans), ink));
    const x2 = 60 + colW + 40;
    text(ctx, "HOW IT'S MADE", x2, top + 70, font(13, F.mono), soft, "left", 3);
    let yy = top + 104;
    p.prompt.forEach((step, i) => {
      if (yy > SPREAD_H - 120) return;
      text(ctx, `${i + 1}.`, x2, yy, font(17, F.serif, 800), ink);
      yy = para(ctx, step.title, x2 + 30, yy, colW - 30, 24, font(17, F.sans, 600), ink, 2);
      yy = para(ctx, step.body, x2 + 30, yy, colW - 30, 22, font(15, F.sans), soft, 3) + 12;
    });

    // Pull quote over the picture
    shade(ctx, PAGE_PX, SPREAD_H - 380, PAGE_PX, SPREAD_H, "rgba(0,0,0,0)", "rgba(0,0,0,0.7)");
    para(ctx, quote, PAGE_PX + 60, SPREAD_H - 200, PAGE_PX - 160, 46, font(38, F.serif, 400, true), "#f6f1e8", 3);
    text(ctx, `Play it → /examples/${slug}`, PAGE_PX + 60, SPREAD_H - 52, font(15, F.mono), "#f0b45a", "left", 1);
    grain(ctx, 0, 0, SPREAD_W, SPREAD_H, 0.06);
  };
}

type Feature = {
  slug: string;
  // A recording other than the gallery's own preview
  clip?: string;
  layout: "centerfold" | "editorial";
  fx: number;
  fy: number;
  dark?: boolean;
  titleTop?: boolean;
  words: string;
};

// Running order follows the projects gallery; centerfolds and editorial spreads mix through it
const FEATURES: Feature[] = [
  { slug: "ink-flow", layout: "editorial", fx: 0.35, fy: 0.5, dark: true, words: "A wisp is gone in five seconds." },
  { slug: "mask-reveal-hand", layout: "centerfold", fx: 0.5, fy: 0.5, titleTop: true, words: "OPENING SPREAD" },
  { slug: "light-beam", layout: "editorial", fx: 0.74, fy: 0.5, words: "The body blocks the light, so the wall behind it falls into shadow." },
  { slug: "tiger-walk", layout: "centerfold", fx: 0.5, fy: 0.55, titleTop: true, words: "THE CENTERFOLD" },
  { slug: "bat-signal", layout: "centerfold", fx: 0.5, fy: 0.45, words: "NIGHT SHIFT" },
  { slug: "shave", layout: "editorial", fx: 0.42, fy: 0.4, words: "Blow on it and the hair gathers into a name." },
  { slug: "cocktails", clip: "cocktails-carousel", layout: "centerfold", fx: 0.5, fy: 0.5, words: "LAST ORDERS" },
  { slug: "blade-rave", layout: "centerfold", fx: 0.5, fy: 0.5, words: "AFTER HOURS" },
];

const clipOf = (f: Feature) => f.clip ?? f.slug;

// Rows of the contents page, also hit-tested in the book: y in canvas pixels of the left page
export const CONTENTS_ROW_H = 78;
export const CONTENTS = FEATURES.map((f, i) => ({
  slug: f.slug,
  title: project(f.slug).title,
  category: project(f.slug).category,
  spread: i + 1,
  y: 330 + i * CONTENTS_ROW_H,
}));

function contents(ctx: Ctx, _t: number, F: Fonts, M: Media) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_PX, SPREAD_H);
  furniture(ctx, 2, F, GREY);
  text(ctx, "Contents", 52, 230, font(140, F.serif, 800), INK, "left", -4);
  for (const row of CONTENTS) {
    hairline(ctx, 60, PAGE_PX - 60, row.y - 52, "#d3cec4");
    text(ctx, String(pageOf(row.spread)).padStart(2, "0"), 60, row.y, font(40, F.serif, 800), INK);
    text(ctx, row.title, 150, row.y, font(32, F.serif), INK);
    text(ctx, row.category.toUpperCase(), PAGE_PX - 60, row.y - 6, font(14, F.mono), GREY, "right", 3);
  }
  hairline(ctx, 60, PAGE_PX - 60, CONTENTS[CONTENTS.length - 1].y + 26, "#d3cec4");
  text(ctx, "Click a line to jump there · drag a page by its corner", 60, SPREAD_H - 50, font(14, F.mono), "#a39e94", "left", 1);

  // Right: the editor's letter beside a framed picture
  const X = PAGE_PX;
  ctx.fillStyle = "#ebe6dd";
  ctx.fillRect(X, 0, PAGE_PX, SPREAD_H);
  text(ctx, "FROM THE EDITOR", X + 60, 130, font(15, F.mono), GREY, "left", 3);
  text(ctx, "Pages that", X + 56, 230, font(78, F.serif, 800), INK, "left", -2);
  text(ctx, "move back.", X + 56, 310, font(78, F.serif, 400, true), INK, "left", -2);
  const y = para(
    ctx,
    "Every spread in this issue is a page I built for the web, and every picture in it is that page running right now. Turn to one, then go and play with the real thing: a cursor that pours smoke, a razor, a tiger that leaps at the lens.",
    X + 60,
    380,
    PAGE_PX - 120,
    32,
    font(21, F.serif),
    INK,
  );
  text(ctx, "— Dmitry Yunkov", X + 60, y + 16, font(24, F.serif, 400, true), INK);
  cover(ctx, M.get("bat-signal"), X + 60, y + 60, PAGE_PX - 120, SPREAD_H - y - 150, 0.5, 0.45);
  const coverPage = pageOf(FEATURES.findIndex((f) => f.slug === COVER_STAR) + 1);
  text(ctx, `ON THE COVER: LIGHT BEAM, p. ${String(coverPage).padStart(2, "0")}`, X + 60, SPREAD_H - 50, font(13, F.mono), GREY, "left", 2);
  grain(ctx, 0, 0, SPREAD_W, SPREAD_H, 0.06);
}

function colophon(ctx: Ctx, _t: number, F: Fonts) {
  const n = FEATURES.length + 1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_PX, SPREAD_H);
  furniture(ctx, pageOf(n), F, GREY, "#6d6a63");
  text(ctx, "Colophon", 52, 230, font(120, F.serif, 800), INK, "left", -3);
  para(
    ctx,
    "Set in Faustina and Geist. No page in this magazine is a picture: each one is a canvas drawn in your browser, bent by a vertex shader and lit by one lamp over a desk. The pictures are the projects' own recordings, playing while their spread is open.",
    60,
    330,
    PAGE_PX - 120,
    34,
    font(23, F.serif),
    INK,
  );
  text(ctx, "IN THIS ISSUE", 60, 640, font(14, F.mono), GREY, "left", 3);
  FEATURES.forEach((f, i) => {
    const p = project(f.slug);
    text(ctx, p.title, 60 + (i % 2) * 400, 690 + Math.floor(i / 2) * 44, font(24, F.serif), INK);
  });

  const X = PAGE_PX;
  ctx.fillStyle = "#0d0d0e";
  ctx.fillRect(X, 0, PAGE_PX, SPREAD_H);
  text(ctx, "Build", X + 56, 330, font(150, F.serif, 800), "#f1ede6", "left", -4);
  text(ctx, "one yourself.", X + 56, 470, font(110, F.serif, 400, true), "#f1ede6", "left", -3);
  para(ctx, "Every project ships with the prompt that made it — step by step, ready for your own agent.", X + 60, 560, PAGE_PX - 140, 34, font(23, F.serif), "#bdb8af");
  text(ctx, "All projects → /projects", X + 60, 720, font(26, F.sans, 600), "#f0b45a");
  grain(ctx, X, 0, PAGE_PX, SPREAD_H, 0.08);
}

export const SPREADS: Spread[] = [
  { title: "Contents", media: ["bat-signal"], animated: true, draw: contents },
  ...FEATURES.map((f, i) => ({
    title: project(f.slug).title,
    slug: f.slug,
    media: [clipOf(f)],
    animated: true,
    draw:
      f.layout === "centerfold"
        ? centerfold(f.slug, clipOf(f), i + 1, f.fx, f.fy, f.words, !!f.titleTop)
        : editorial(f.slug, clipOf(f), i + 1, f.fx, f.fy, !!f.dark, f.words),
  })),
  { title: "Colophon", media: [], animated: false, draw: colophon },
];

export const ALL_MEDIA = [...new Set([COVER_STAR, ...FEATURES.map(clipOf)])];
export const COVER_MEDIA = [COVER_STAR];
