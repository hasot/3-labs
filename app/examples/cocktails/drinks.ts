import * as THREE from "three";

// [radius, height] in the glass's own space: the axis is Y, the foot stands on y = 0
export type P = [number, number];

export type GlassShape = {
  // Foot and stem as straight segments, from the axis on the floor up to where the bowl starts
  stem: P[];
  // Outside of the bowl, smoothed, continues the stem up to the rim
  outer: P[];
  // Inside of the bowl, smoothed, from the axis at the bottom of the cavity up to the rim
  inner: P[];
};

export type Garnish = "lemonTwist" | "olive" | "peaPod" | "grapefruit" | "olivePick" | "orangePeel";

export type Drink = {
  name: string;
  ingredients: string;
  // Back wall in the drink's own palette, and a tablecloth in a colour that goes with it
  wall: string;
  table: string;
  glass: GlassShape;
  // Liquid level, glass space
  fill: number;
  // Thin edge colour and the colour it sinks to through thick liquid
  color: string;
  deep: string;
  // How fast the colour goes from thin to deep, per unit of liquid crossed
  density: number;
  // 0 is a clear spirit you see straight through, 1 is milky and opaque
  opacity: number;
  // Foam head height under the surface, 0 for none
  foam: number;
  // Rising bubble streams, 0..1
  bubbles: number;
  // Edge length of each ice cube; positions are glass space
  ice: { size: number; position: [number, number, number]; rotation: [number, number, number] }[];
  garnish: Garnish[];
};

const footAndStem = (footR: number, stemR: number, stemTop: number): P[] => [
  [0, 0],
  [footR, 0],
  [footR, 0.012],
  [footR * 0.55, 0.03],
  [stemR * 1.6, 0.07],
  [stemR, 0.14],
  [stemR, stemTop],
];

const TULIP: GlassShape = {
  stem: footAndStem(0.34, 0.032, 0.92),
  outer: [
    [0.032, 0.92],
    [0.14, 0.98],
    [0.31, 1.15],
    [0.405, 1.46],
    [0.385, 1.86],
    [0.305, 2.2],
  ],
  inner: [
    [0, 0.99],
    [0.15, 1.02],
    [0.295, 1.17],
    [0.385, 1.46],
    [0.367, 1.86],
    [0.289, 2.195],
  ],
};

const MARTINI: GlassShape = {
  stem: footAndStem(0.33, 0.03, 0.96),
  outer: [
    [0.03, 0.96],
    [0.1, 1.02],
    [0.33, 1.3],
    [0.64, 1.68],
  ],
  inner: [
    [0, 1.02],
    [0.09, 1.08],
    [0.32, 1.33],
    [0.622, 1.678],
  ],
};

const NICK_AND_NORA: GlassShape = {
  stem: footAndStem(0.29, 0.028, 0.86),
  outer: [
    [0.028, 0.86],
    [0.17, 0.9],
    [0.34, 1.05],
    [0.425, 1.27],
    [0.43, 1.44],
  ],
  inner: [
    [0, 0.9],
    [0.17, 0.925],
    [0.325, 1.06],
    [0.408, 1.27],
    [0.413, 1.437],
  ],
};

const HIGHBALL: GlassShape = {
  stem: [[0, 0]],
  outer: [
    [0.3, 0],
    [0.305, 0.02],
    [0.312, 0.6],
    [0.322, 1.46],
  ],
  inner: [
    [0, 0.14],
    [0.2, 0.14],
    [0.278, 0.165],
    [0.292, 0.3],
    [0.305, 1.455],
  ],
};

const ROCKS: GlassShape = {
  stem: [[0, 0]],
  outer: [
    [0.39, 0],
    [0.398, 0.02],
    [0.405, 0.4],
    [0.42, 0.86],
  ],
  inner: [
    [0, 0.15],
    [0.28, 0.15],
    [0.365, 0.18],
    [0.385, 0.32],
    [0.403, 0.855],
  ],
};

export const DRINKS: Drink[] = [
  {
    name: "Negroni",
    ingredients: "1 oz campari  ·  1 oz gin  ·  1 oz sweet vermouth  ·  orange peel  ·  ice",
    wall: "#5c1218",
    table: "#d39552",
    glass: ROCKS,
    fill: 0.6,
    color: "#ff6040",
    deep: "#5c0404",
    density: 3.6,
    opacity: 0.84,
    foam: 0,
    bubbles: 0,
    ice: [{ size: 0.3, position: [-0.04, 0.42, -0.05], rotation: [0.05, 0.5, -0.03] }],
    garnish: ["orangePeel"],
  },
  {
    name: "Golden Ale",
    ingredients: "Belgian golden ale  ·  poured slow  ·  two fingers of foam",
    wall: "#5a3c0e",
    table: "#2f4a3c",
    glass: TULIP,
    fill: 1.78,
    color: "#ffc865",
    deep: "#a2440a",
    density: 2.4,
    opacity: 0.78,
    foam: 0.11,
    bubbles: 1,
    ice: [],
    garnish: [],
  },
  {
    name: "Dry Martini",
    ingredients: "2½ oz gin  ·  ½ oz dry vermouth  ·  lemon twist  ·  olive",
    wall: "#1f2b40",
    table: "#cfcac0",
    glass: MARTINI,
    fill: 1.55,
    color: "#eef3ec",
    deep: "#b8c6b0",
    density: 0.8,
    opacity: 0.1,
    foam: 0,
    bubbles: 0,
    ice: [],
    garnish: ["lemonTwist", "olive"],
  },
  {
    name: "Snap Pea Gimlet",
    ingredients: "2 oz gin  ·  ¾ oz lime  ·  ¾ oz snap pea syrup  ·  sugar snap",
    wall: "#3b5a2c",
    table: "#e8c7b8",
    glass: NICK_AND_NORA,
    fill: 1.36,
    color: "#eef4d6",
    deep: "#b6c98a",
    density: 3,
    opacity: 0.9,
    foam: 0,
    bubbles: 0,
    ice: [],
    garnish: ["peaPod"],
  },
  {
    name: "Bitter Highball",
    ingredients: "1½ oz bitter aperitivo  ·  grapefruit soda  ·  ice  ·  grapefruit",
    wall: "#7a2a12",
    table: "#2c5560",
    glass: HIGHBALL,
    fill: 1.3,
    color: "#f7a060",
    deep: "#4c0703",
    density: 3.2,
    opacity: 0.76,
    foam: 0,
    bubbles: 0.55,
    ice: [
      { size: 0.21, position: [0.05, 0.27, 0.03], rotation: [0.2, 0.6, 0.05] },
      { size: 0.2, position: [-0.06, 0.5, -0.04], rotation: [-0.3, 1.3, 0.25] },
      { size: 0.22, position: [0.04, 0.74, 0.05], rotation: [0.35, 0.2, -0.2] },
      { size: 0.2, position: [-0.05, 0.98, -0.02], rotation: [0.1, 0.9, 0.4] },
      { size: 0.21, position: [0.04, 1.22, 0.03], rotation: [-0.35, 0.4, 0.15] },
    ],
    garnish: ["grapefruit"],
  },
  {
    name: "Gibson on the Rocks",
    ingredients: "2 oz gin  ·  ½ oz dry vermouth  ·  big cube  ·  olive",
    wall: "#433f1c",
    table: "#a9573a",
    glass: ROCKS,
    fill: 0.64,
    color: "#fbefbc",
    deep: "#c49a36",
    density: 2.2,
    opacity: 0.5,
    foam: 0,
    bubbles: 0,
    ice: [{ size: 0.32, position: [0.05, 0.5, -0.08], rotation: [0.06, 0.35, -0.04] }],
    garnish: ["olivePick"],
  },
];

// Catmull-Rom through the control points, sampled evenly along the curve
export function smooth(points: P[], samples: number): P[] {
  if (points.length < 3) return points;
  const curve = new THREE.CatmullRomCurve3(
    points.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    "centripetal",
  );
  return curve.getSpacedPoints(samples).map((v) => [v.x, v.y]);
}

// Solid glass: outside up, a rounded lip, inside back down to the axis
export function glassProfile(shape: GlassShape): THREE.Vector2[] {
  const outer = smooth(shape.outer, 48);
  const inner = smooth(shape.inner, 48);
  const [ro, yo] = outer[outer.length - 1];
  const [ri, yi] = inner[inner.length - 1];
  const lip: P = [(ro + ri) / 2, Math.max(yo, yi) + (ro - ri) * 0.45];
  const [sr, sy] = shape.stem[shape.stem.length - 1];
  const joins = shape.outer[0][0] === sr && shape.outer[0][1] === sy;
  const points: P[] = [...shape.stem, ...(joins ? outer.slice(1) : outer), lip, ...inner.reverse()];
  return points.map(([r, y]) => new THREE.Vector2(r, y));
}

// Liquid volume: the cavity shrunk a hair off the walls, up to just under the rim.
// The shader cuts it at the live surface, so the mesh never changes while it pours.
export function liquidProfile(shape: GlassShape): THREE.Vector2[] {
  const inner = smooth(shape.inner, 64);
  const top = inner[inner.length - 1][1] - 0.02;
  const points: THREE.Vector2[] = [];
  for (const [r, y] of inner) {
    if (y > top) break;
    points.push(new THREE.Vector2(Math.max(0, r - 0.006), y + 0.004));
  }
  const last = points[points.length - 1];
  points.push(new THREE.Vector2(last.x * 0.5, last.y), new THREE.Vector2(0, last.y));
  return points;
}

export function cavityBottom(shape: GlassShape) {
  return shape.inner[0][1];
}

export function rimHeight(shape: GlassShape) {
  return shape.inner[shape.inner.length - 1][1];
}

// Inner radius at a given height, linear between the smoothed samples of the inside
export function innerRadiusAt(inner: P[], y: number) {
  for (let i = 1; i < inner.length; i++) {
    const [r0, y0] = inner[i - 1];
    const [r1, y1] = inner[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return inner[inner.length - 1][0];
}

// Where a hand closes around the glass: stemmed glasses by the stem, tumblers low on the wall
export function gripFor(shape: GlassShape) {
  if (shape.stem.length > 1) {
    const [r, top] = shape.stem[shape.stem.length - 1];
    return { y: top * 0.55, radius: r };
  }
  const y = rimHeight(shape) * 0.42;
  return { y, radius: innerRadiusAt(smooth(shape.inner, 64), y) + 0.02 };
}
