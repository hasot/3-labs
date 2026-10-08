// Sound of the smoke, synthesised on the fly: slow, calm breathing. When the
// cursor starts to pour, a long warm exhale, as if letting smoke out; while it
// keeps pouring, a soft inhale and another exhale, like a breathing exercise; when
// it stops, the breath finishes its exhale and goes quiet. Under it a very quiet
// hum while smoke hangs in the air, all in a small, soft room

// Exhale and inhale lengths, s (each varies by up to JITTER), and the pause after
// an inhale before the next exhale
const EXHALE = 4.2;
const INHALE = 2.4;
const JITTER = 0.4;
const HOLD = 0.25;
// The breath goes on while the cursor moved within this many seconds
const KEEP_BREATHING = 1.2;
// Loudness of the exhale and the inhale at full strength, and the hum
const EXHALE_GAIN = 0.9;
const INHALE_GAIN = 0.2;
const HUM = 0.08;
const HUM_EASE = 0.6;
// The hum's chord, Hz: a low open fifth with an octave on top
const HUM_NOTES = [73.4, 110, 146.8];
// Voice of the breath: the vowel's two formants (Hz, with their sharpness and
// level), the air on top, and how much the exhale sinks toward its end
const EXHALE_FORMANTS = [
  { f: 640, q: 3, level: 1 },
  { f: 1150, q: 4, level: 0.55 },
];
const INHALE_FORMANTS = [
  { f: 1400, q: 1.6, level: 0.8 },
  { f: 2600, q: 1.4, level: 0.5 },
];
const AIR = { f: 3200, q: 0.7, exhale: 0.3, inhale: 0.55 };
const EXHALE_SINK = 0.85;
const REVERB_SECONDS = 3;
const REVERB_MIX = 0.3;
// Envelope: share of the breath spent swelling up, and how steep the long fade
// after it is (higher dies sooner, the very end always reaches silence)
const SWELL = 0.25;
const FADE = 3.2;
// RMS the noise is made at
const NOISE_RMS = 0.3;

type Nodes = {
  ctx: AudioContext;
  noise: AudioBuffer;
  master: GainNode;
  voice: GainNode;
  humGain: GainNode;
  pan: StereoPannerNode;
};

function build(): Nodes {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const rate = ctx.sampleRate;

  // A soft limiter last, so nothing ever clips
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 12;
  limiter.ratio.value = 6;
  limiter.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(limiter);

  // Room: an impulse of darkened, decaying noise, a little different in each ear
  const reverb = ctx.createConvolver();
  const impulse = ctx.createBuffer(2, rate * REVERB_SECONDS, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < d.length; i++) {
      lp += 0.3 * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.pow(1 - i / d.length, 3);
    }
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = REVERB_MIX;
  reverb.connect(wet).connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 1 - REVERB_MIX;
  dry.connect(master);

  // The breath sits near the middle, leaning a little toward the cursor; a gentle
  // low-pass keeps it soft
  const pan = ctx.createStereoPanner();
  const soft = ctx.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 5000;
  soft.connect(pan);
  pan.connect(dry);
  pan.connect(reverb);
  const voice = ctx.createGain();
  voice.connect(soft);

  const noise = ctx.createBuffer(1, rate * 4, rate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * NOISE_RMS * Math.sqrt(3);

  // Hum: soft sines, each breathing slowly at its own pace, straight to the room
  const humGain = ctx.createGain();
  humGain.gain.value = 0;
  humGain.connect(dry);
  humGain.connect(reverb);
  HUM_NOTES.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const level = ctx.createGain();
    level.gain.value = 0.5 / (i + 1);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + i * 0.05;
    const depth = ctx.createGain();
    depth.gain.value = 0.25 / (i + 1);
    lfo.connect(depth).connect(level.gain);
    osc.connect(level).connect(humGain);
    osc.start();
    lfo.start();
  });

  return { ctx, noise, master, voice, humGain, pan };
}

// One breath: noise shaped by the vowel's formants and a little air, swelling in
// and out along a smooth curve. Returns when it ends (audio clock)
function breathe(n: Nodes, kind: "in" | "out", strength: number) {
  const { ctx, noise, voice } = n;
  const exhale = kind === "out";
  const length = (exhale ? EXHALE : INHALE) + (Math.random() * 2 - 1) * JITTER;
  const t0 = ctx.currentTime + 0.02;
  const t1 = t0 + length;

  const src = ctx.createBufferSource();
  src.buffer = noise;
  const out = ctx.createGain();
  // A smooth swell up, then a long fade that trails off into silence: an
  // exponential tail, eased to exactly zero at the very end, never a cut
  const peak = (exhale ? EXHALE_GAIN : INHALE_GAIN) * strength;
  const curve = new Float32Array(128);
  for (let i = 0; i < curve.length; i++) {
    const x = i / (curve.length - 1);
    const rise = Math.sin(Math.min(x / SWELL, 1) * (Math.PI / 2));
    const y = Math.max(x - SWELL, 0) / (1 - SWELL);
    const fall = Math.exp(-FADE * y) * Math.cos(y * (Math.PI / 2));
    curve[i] = Math.max(peak * rise * rise * fall, 0.0001);
  }
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.setValueCurveAtTime(curve, t0, length);
  out.connect(voice);

  const formants = exhale ? EXHALE_FORMANTS : INHALE_FORMANTS;
  for (const { f, q, level } of formants) {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = q;
    band.frequency.setValueAtTime(f, t0);
    // An exhale sinks a little as the lungs empty; an inhale opens up
    band.frequency.linearRampToValueAtTime(f * (exhale ? EXHALE_SINK : 1.12), t1);
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(band).connect(g).connect(out);
  }
  const air = ctx.createBiquadFilter();
  air.type = "bandpass";
  air.Q.value = AIR.q;
  air.frequency.value = AIR.f;
  const airGain = ctx.createGain();
  airGain.gain.value = exhale ? AIR.exhale : AIR.inhale;
  src.connect(air).connect(airGain).connect(out);

  src.start(t0, Math.random() * 3);
  src.stop(t1 + 0.05);
  return t1;
}

export function createSmokeSound() {
  let nodes: Nodes | null = null;
  let on = false;
  // Audio-clock time the current breath ends, what comes next, and when the cursor
  // last moved
  let breathEnds = 0;
  let next: "in" | "out" = "out";
  let lastMove = -Infinity;
  // The strongest pour since the breath began, 0..1
  let strength = 0;

  return {
    get on() {
      return on;
    },
    // Must be called from a user gesture, or the browser keeps the audio muted
    enable() {
      nodes ??= build();
      nodes.ctx.resume().catch(() => {});
      nodes.master.gain.setTargetAtTime(1, nodes.ctx.currentTime, 0.3);
      on = true;
    },
    disable() {
      if (nodes) nodes.master.gain.setTargetAtTime(0, nodes.ctx.currentTime, 0.2);
      on = false;
    },
    // speed: the cursor's speed in word heights per second; x: 0..1 across the
    // screen; smoke: 0..1, how much smoke hangs in the air
    update(speed: number, x: number, smoke: number) {
      if (!nodes || !on) return;
      const t = nodes.ctx.currentTime;
      if (speed > 0.05) {
        lastMove = t;
        strength = Math.max(strength, Math.min(0.45 + speed / 6, 1));
      }
      const breathing = t - lastMove < KEEP_BREATHING;
      if (t >= breathEnds) {
        if (breathing) {
          // Exhale on the first stroke; then in and out for as long as it goes on
          breathEnds = breathe(nodes, next, strength) + (next === "in" ? HOLD : 0);
          next = next === "out" ? "in" : "out";
          strength = 0.45;
        } else {
          // Still: the next breath, whenever it comes, is an exhale again
          next = "out";
        }
      }
      nodes.pan.pan.setTargetAtTime((x * 2 - 1) * 0.3, t, 0.3);
      nodes.humGain.gain.setTargetAtTime(HUM * Math.min(smoke, 1), t, HUM_EASE);
    },
    dispose() {
      nodes?.ctx.close().catch(() => {});
      nodes = null;
      on = false;
    },
  };
}
