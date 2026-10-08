// Sound of the claw strike: the tiger roars just after the click, as it leaps at the
// lens, then a cat's hiss for bite when the claws land and each claw whistles through
// the air.
// Recordings: "angry tiger" by schots and "Cat hissing" by Zabuhailo, both CC0 (freesound / Wikimedia Commons)

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SAMPLES = {
  roar: `${BASE_PATH}/sounds/tiger-roar.mp3`,
  hiss: `${BASE_PATH}/sounds/cat-hiss.mp3`,
};
type Sample = keyof typeof SAMPLES;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const buffers: Partial<Record<Sample, AudioBuffer>> = {};
let loading: Promise<void> | null = null;

function audio() {
  if (!ctx) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctx();
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return { ctx, noise: noise! };
}

// Fetch and decode the recordings ahead of the first click so the hit isn't late
export function preloadStrike() {
  if (loading) return loading;
  const { ctx } = audio();
  loading = Promise.all(
    (Object.keys(SAMPLES) as Sample[]).map(async (name) => {
      const res = await fetch(SAMPLES[name]);
      buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    }),
  ).then(() => {});
  return loading;
}

function playSample(name: Sample, at: number, gain: number, out: AudioNode) {
  const { ctx } = audio();
  const buffer = buffers[name];
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(out);
  src.start(at);
}

function output() {
  const { ctx } = audio();
  const out = ctx.createGain();
  out.gain.value = 0.95;
  out.connect(ctx.destination);
  return out;
}

// Call from the click itself: browsers keep audio muted until a user gesture,
// and the claws are scheduled later, from the animation loop
export function unlockStrike() {
  audio().ctx.resume().catch(() => {});
}

// The roar answers the click, `delay` seconds after it
export function playRoar(delay: number) {
  const { ctx } = audio();
  playSample("roar", ctx.currentTime + 0.01 + delay, 0.9, output());
}

// `claws`: seconds from now when each claw starts, `swipe`: how long one claw
// takes to cross
export function playClaws(claws: number[], swipe: number) {
  const { ctx, noise } = audio();
  const t0 = ctx.currentTime + 0.01;
  const out = output();

  playSample("hiss", t0, 0.35, out);

  // Swipes: one quiet whistle per claw, a noise band sweeping up as the claw crosses
  claws.forEach((at, i) => {
    const s = t0 + at;
    const air = ctx.createBufferSource();
    air.buffer = noise;
    air.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 2.2;
    band.frequency.setValueAtTime(700 + i * 120, s);
    band.frequency.exponentialRampToValueAtTime(5000 + i * 300, s + swipe);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.22, s + swipe * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, s + swipe * 0.8);
    air.connect(band).connect(g).connect(out);
    air.start(s);
    air.stop(s + swipe);
  });
}
