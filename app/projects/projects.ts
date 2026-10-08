export type PromptStep = {
  title: string;
  body: string;
};

export type Project = {
  slug: string;
  title: string;
  category: string;
  status: "New" | "Live" | "WIP";
  // Placeholder counter until real likes are stored somewhere
  likes: number;
  summary: string;
  stack: string[];
  prompt: PromptStep[];
  // Repo paths the agent downloads verbatim: the page's own sources, then its assets.
  // The shared layout, globals.css and fonts are added by buildPrompt for every project
  files: string[];
  // npm packages on top of a fresh create-next-app
  packages?: string[];
  // Numbered frame sequence: <dir>/001.webp … <dir>/<count>.webp
  frames?: { dir: string; count: number };
};

// Gallery order
export const PROJECTS: Project[] = [
  {
    slug: "ink-flow",
    title: "Nothing",
    category: "Hero",
    status: "New",
    likes: 41,
    summary:
      "A giant NOTHING on a black screen, made of empty glass vessels. Sweep the cursor and it pours smoke: the faster you go, the more. Smoke that lands in a letter swirls in rings inside its walls; the rest curls around the word and seeps in where it presses on it. A wisp is gone in five seconds, and every stroke breathes out with a slow, calm exhale.",
    stack: ["Next.js 16", "WebGL2 fluid sim", "Web Audio"],
    files: [
      "app/examples/ink-flow/page.tsx",
      "app/examples/ink-flow/InkFlow.tsx",
      "app/examples/ink-flow/fluid.ts",
      "app/examples/ink-flow/smokeSound.ts",
    ],
    prompt: [
      {
        title: "Stable fluids in WebGL2",
        body: "Port the stable-fluids solver of the shaders.com components (MIT) to WebGL2 fragment passes on half-float textures: curl, vorticity confinement, divergence, 10 Jacobi iterations, gradient subtraction, semi-Lagrangian advection. Grids of any shape with square cells, solid walls from a mask, dye stored as density and age.",
      },
      {
        title: "The word as a mask",
        body: "Fit one heavy word to 92% of the screen width and draw the real DOM text into a canvas at the spot the browser laid it out, white on opaque black. One copy at screen resolution for crisp edges, one on each simulation grid for the walls.",
      },
      {
        title: "Two vessels",
        body: "One fluid fills the screen with the letters as solid walls, a second lives inside the word's box with the letters as the only open space. Smoke pressing on a letter from outside seeps in at a small rate.",
      },
      {
        title: "The cursor pours SmokeFill",
        body: "Along the cursor's path, blend the velocity toward a cone of jets in the direction of motion, capped at the SmokeFill source speed, and spin every puff around its centre so the smoke curls into rings. Pour density by speed; fresh smoke resets its age; it fades in about five seconds.",
      },
      {
        title: "Shading",
        body: "Colour the smoke from fresh cyan to aged blue by its age, opacity from its density, with the frozen grain and pixel jitter of the shaders.com Stone filter. Inside a letter only its own smoke shows, so an empty letter is a dark silhouette in the swirl.",
      },
      {
        title: "A breathing sound",
        body: "Synthesise slow breathing with Web Audio: noise shaped by the formants of an open vowel. The first stroke breathes out for ~4 s with a long exponential fade; while strokes go on, a soft inhale and another exhale. Add a quiet hum while smoke hangs in the air and a soft room reverb. Sound starts on the first click.",
      },
    ],
  },
  {
    slug: "bat-signal",
    title: "Bat-Signal",
    category: "Hero",
    status: "Live",
    likes: 342,
    summary:
      "Gotham at night. A heavy projector on the far spire follows your cursor with inertia and casts the bat-signal into the clouds. The words GOTHAM and YUNKOV are written in luminous paint: invisible until the beam sweeps over them.",
    stack: ["Next.js 16", "Canvas 2D", "Video masking", "Custom fonts"],
    files: [
      "app/examples/bat-signal/page.tsx",
      "app/examples/bat-signal/BatLoader.tsx",
      "app/examples/bat-signal/bat-logo.ts",
      "public/images/base.mp4",
      "public/images/light-new.mp4",
      "public/images/bat-logo.svg",
    ],
    prompt: [
      {
        title: "Project and assets",
        body: "Create a Next.js 16 app, download two videos of the same frame (night and lit), the bat logo and the Williwaw font.",
      },
      {
        title: "Batarang loader",
        body: "While the videos load, a white batarang loops and spins in the middle of the black screen, then dissolves into the scene.",
      },
      {
        title: "Spot and cone",
        body: "The lit video shows through a soft elliptical spot that stretches along the beam; a volumetric cone runs from the hot lens to the spot. The spot follows the cursor with inertia.",
      },
      {
        title: "Stencil and arc lamp",
        body: "Cast a blurred bat shadow inside the spot. A click switches the arc lamp: a few strikes and a warm-up on, a fast cut off while the lens cools.",
      },
      {
        title: "Luminous paint",
        body: "Prerender the glyphs of GOTHAM and YUNKOV; wherever the spot passes, the glyphs glow white-hot, hold the light, then fade out.",
      },
      {
        title: "Nav, menu and hint",
        body: "Centred nav links, a hidden logo the beam has to find, a burger that opens a blurred full-screen menu, and a mouse icon hinting the scene is clickable.",
      },
    ],
  },
  {
    slug: "light-beam",
    title: "Light Beam",
    category: "Personal",
    status: "New",
    likes: 96,
    summary:
      "A personal landing in the dark. A thin warm beam follows the cursor and lights the portrait; the body blocks the light, so the wall behind it falls into shadow. Click and the beam swells into a blinding flash with a synthesised ringing in the ears — and for a while only a skeleton is left standing.",
    stack: ["Next.js 16", "WebGL shader", "Web Audio", "GrabCut mask"],
    files: [
      "app/examples/light-beam/page.tsx",
      "app/examples/light-beam/LightBeam.tsx",
      "app/examples/light-beam/flashSound.ts",
      "public/images/beam-dark.webp",
      "public/images/beam-light.webp",
      "public/images/beam-light-2.webp",
      "public/images/beam-mask.png",
      "public/images/beam-skeleton.webp",
      "public/images/beam-skeleton-mask.png",
    ],
    prompt: [
      {
        title: "Lit and unlit portrait",
        body: "Shoot the same frame dark and lit. Cut the figure's silhouette with GrabCut (white on black) — the beam will stop on it.",
      },
      {
        title: "Backdrop from the photo's own edges",
        body: "Fade the photo on both sides into a backdrop built from its edge columns, so the navy carries on across the whole screen and the figure stays close to the right edge.",
      },
      {
        title: "The beam",
        body: "In a fragment shader, take each pixel's distance along and across the ray from an off-screen source on the left. A gaussian core, a touch wider near the source, with dust drifting along it.",
      },
      {
        title: "Light that hits the body",
        body: "March back toward the source through the silhouette: whatever body lies in between soaks the light up (Beer–Lambert), so only the near side is lit.",
      },
      {
        title: "Idle sweep and pointer",
        body: "Smooth the pointer per second. Without movement for a while the beam goes back to a slow sweep over the figure.",
      },
      {
        title: "Click flash with sound",
        body: "The beam swells, floods the figure, the screen snaps to white and comes back through a blur. Synthesise a rising rush, a muffled thump and a thin ringing with Web Audio, started from the click.",
      },
      {
        title: "A skeleton after the blast",
        body: "Behind the white, swap the figure for the same pose as a skeleton with its own mask. Hold it for 15 s — the beam lights the bones warmer and brighter — then burn the figure back in patch by patch through a noisy dissolve.",
      },
    ],
  },
  {
    slug: "tiger-walk",
    title: "Tiger Walk",
    category: "Hero",
    status: "New",
    likes: 64,
    summary:
      "A tiger walks out of the dark straight at you. Click and it leaps at the lens with a roar, four claws rip the screen open, and the tear swallows everything into a sunlit jungle with a big editorial title. Click again to go back into the dark.",
    stack: ["Next.js 16", "Video", "SVG clip mask", "Web Audio"],
    files: [
      "app/examples/tiger-walk/page.tsx",
      "app/examples/tiger-walk/TigerWalk.tsx",
      "app/examples/tiger-walk/Copy.tsx",
      "app/examples/tiger-walk/strikeSound.ts",
      "public/videos/tiger-walk.mp4",
      "public/videos/tiger-strike.mp4",
      "public/images/tiger-jungle.webp",
      "public/images/tiger-jungle-tear.webp",
      "public/sounds/tiger-roar.mp3",
      "public/sounds/cat-hiss.mp3",
    ],
    prompt: [
      {
        title: "Walk loop in the dark",
        body: "Play the first 8 s of the walk clip, anchored to the bottom centre at 80% of the screen height, its sides faded into the black page. Hide the loop point in a quick, shallow dip of brightness.",
      },
      {
        title: "The leap",
        body: "On click, crossfade into the strike clip played at 2× speed: one last step, then the tiger leaps at the camera. The roar starts 0.3 s after the click.",
      },
      {
        title: "Four claws tear the screen",
        body: "At the hit, four slashes run upper-left to lower-right as polygons with torn-paper edges (slow wobble plus fine jitter, fixed per claw). Through them shows the jungle; the tiger dissolves into the dark and the screen shakes.",
      },
      {
        title: "The tear swallows the screen",
        body: "Hold the open tear for a moment, then scale and fatten it around the centre until the claws merge and the full jungle picture takes over.",
      },
      {
        title: "Type in two scenes",
        body: "One family throughout (Archivo, width axis): small captions at the edges while the tiger walks, then a big title spread fading in item by item over the jungle. A click there goes back to the walk.",
      },
      {
        title: "Sound and no stalls",
        body: "Decode the roar and hiss ahead of the first click and add a whistle per claw with Web Audio. Pre-buffer the strike clip and keep a sliver of the jungle in the mask so nothing stalls on the hit.",
      },
    ],
  },
  {
    slug: "mask-reveal-hand",
    title: "Mask Reveal",
    category: "Hero",
    status: "Live",
    likes: 187,
    summary:
      "A sunny landing hero with a swordsman on a cliff. Paint over it with the mouse — or with your palm in front of the webcam — and an inky, smoky trail tears the day open onto the night version of the same place. Fog drifts by itself; an ensō brush circle is the loader.",
    stack: ["Next.js 16", "WebGL shader", "Video loops", "MediaPipe Hands"],
    files: [
      "app/examples/mask-reveal-hand/page.tsx",
      "app/examples/mask-reveal/MaskReveal.tsx",
      "app/examples/mask-reveal/EnsoLoader.tsx",
      "app/examples/mask-reveal/handTracker.ts",
      "public/videos/reveal-day.mp4",
      "public/videos/reveal-night.mp4",
    ],
    packages: ["@mediapipe/tasks-vision@1.0.1"],
    prompt: [
      {
        title: "Day and night loops",
        body: "Render the same scene twice, day and night, as seamless loops. Keep the night loop nudged back in step with the day one when it drifts.",
      },
      {
        title: "Paint the trail",
        body: "Paint the brush trail on a small offscreen canvas; the brush grows with its speed and the trail fades every frame in whole 8-bit steps spread across frames.",
      },
      {
        title: "Smoky edge in the shader",
        body: "Bend the trail with low-frequency domain warp, add a tighter second warp, then push the edge around with two layers of noise — only near the trail.",
      },
      {
        title: "Fog patches",
        body: "Soft capsule-shaped haze patches live on the day side by themselves, fade in, hold, fade out, and now and then tear small holes.",
      },
      {
        title: "Mouse or hand",
        body: "Mouse and hand each paint their own stroke, so both can move at once. The hand comes from MediaPipe Hand Landmarker, run only when the camera has a new frame.",
      },
      {
        title: "Palm point",
        body: "Average the wrist and the bases of the fingers, mirror it like a mirror, and stretch the inner part of the camera frame over the whole screen.",
      },
      {
        title: "Camera on request and loader",
        body: "Ask for the camera only on the Enable camera click; until both videos can play, show the ensō brush circle, then dissolve it into the scene.",
      },
    ],
  },
  {
    slug: "tiger",
    title: "Tiger",
    category: "Mascot",
    status: "Live",
    likes: 214,
    summary:
      "Mascot hero: a tiger cub watches a blue morpho butterfly that chases your cursor. The head turn is a cut-out 48 fps clip, and the right frame is picked by the angle to the butterfly.",
    stack: ["Next.js 16", "Frame sequence", "SVG butterfly"],
    files: ["app/examples/tiger/page.tsx", "app/examples/tiger/TigerHero.tsx", "app/examples/tiger/Butterfly.tsx"],
    frames: { dir: "public/frames/tiger", count: 239 },
    prompt: [
      {
        title: "Generate the head sweep",
        body: "Make a clip where the cub's head sweeps an arc from the lower left, over the top, to the lower right. Cut it out frame by frame on transparency, cropped around the torso, 48 fps.",
      },
      {
        title: "Name behind the cub",
        body: "Set the name huge behind the cub, a shade darker than the fur, tone on tone. Text in the brown of the stripes.",
      },
      {
        title: "Angle → frame table",
        body: "The head doesn't turn evenly, so pin frames by hand: [angle from head to target, frame]. Skip the blink frames.",
      },
      {
        title: "Butterfly as the cursor",
        body: "Draw a morpho from above, one wing shape mirrored. It flies after the cursor with lag and wobble, wing beats speed up with its own speed.",
      },
      {
        title: "Idle flight",
        body: "With no pointer movement it hovers in a small patch above the cub's head, side to side, as if someone nudges the mouse.",
      },
    ],
  },
  {
    slug: "shave",
    title: "Shave",
    category: "Personal",
    status: "New",
    likes: 128,
    summary:
      "The cursor is an electric razor. Shave a friend's beard off his portrait: cut hair bursts away, drifts down like petals and piles up at the bottom. Blow on it and the hair gathers into a name, then the wind tears it away letter by letter.",
    stack: ["Next.js 16", "Canvas 2D", "Particles", "Touch"],
    files: [
      "app/examples/shave/page.tsx",
      "app/examples/shave/Shave.tsx",
      "public/images/shave-clean.webp",
      "public/images/shave-beard.webp",
      "public/images/shave-edges.png",
    ],
    prompt: [
      {
        title: "Two photos, one face",
        body: "Shoot the same portrait twice, with and without the beard. Cut the beard out of the bearded shot with a soft alpha edge and store where the crop sits inside the photo, in image pixels.",
      },
      {
        title: "Canvas that continues the photo",
        body: "Fade the left and right 64 px of the shaved photo into per-row edge colours and stretch them sideways, so the page background carries the photo to any screen width.",
      },
      {
        title: "Razor cursor",
        body: "Hide the system cursor over the scene and draw the razor head. Its cutting strip erases beard pixels; near the edges of the strip the cut turns ragged, so some hairs get caught and some slip past.",
      },
      {
        title: "Falling hair",
        body: "Every removed dark pixel has a chance to spawn a hair: it bursts away from the face, then floats down against air drag, swings like a pendulum and builds a heap at the bottom of the screen.",
      },
      {
        title: "Blow it into a word",
        body: "On the gust button the hair takes off in a stagger, springs into a phrase in the middle of the screen, holds, and the wind tears it off letter by letter.",
      },
      {
        title: "Touch and polish",
        body: "On touch screens the blade rides above the fingertip so the finger never hides it. Near the controls the razor turns back into the normal cursor. Check 60 fps on a phone.",
      },
    ],
  },
];

export const CATEGORIES = ["All", ...Array.from(new Set(PROJECTS.map((p) => p.category)))];
