// The track of the club scene, played through Web Audio so the page can listen to it:
// an analyser finds the kicks and the strobe fires on them.
// Audio: "Blade - Vampire Dance Club Theme", YouTube cNOP2t9FObw, its fade-out cut so
// the loop doesn't sag. A copyrighted soundtrack: fine for a private lab, not for a
// public page

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SRC = `${BASE_PATH}/sounds/blade-rave.mp3`;

const VOLUME = 0.9;
const FADE_S = 1.2;
// Kick band, Hz
const KICK = [40, 140];
// A kick: the bass band jumps this far over its recent average, and not sooner than
// this after the last one (138 BPM: a beat is 0.43 s). Run over this track offline it
// finds 2.2–2.3 kicks a second all the way through
const KICK_RISE = 1.6;
const KICK_GAP_S = 0.3;
// How fast the running averages follow, per second
const AVG_RATE = 1.6;

export type Listen = {
  // A kick landed this frame
  kick: boolean;
  // 0..1: the bass against its recent average
  bass: number;
  // Seconds into the track
  time: number;
};

const SILENT: Listen = { kick: false, bass: 0, time: 0 };

export function createRaveSound() {
  let el: HTMLAudioElement | null = null;
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let out: GainNode | null = null;
  let spectrum: Float32Array<ArrayBuffer> | null = null;
  let playing = false;
  let muted = false;

  let bassAvg = 0;
  let prevBass = 0;
  let lastKick = -1;

  const element = () => {
    if (!el) {
      el = new Audio(SRC);
      el.loop = true;
      el.preload = "auto";
    }
    return el;
  };

  // Mean power of a band, linear
  const band = (from: number, to: number) => {
    if (!analyser || !spectrum || !ctx) return 0;
    const hz = ctx.sampleRate / analyser.fftSize;
    const a = Math.max(1, Math.floor(from / hz));
    const b = Math.min(spectrum.length - 1, Math.ceil(to / hz));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += Math.pow(10, spectrum[i] / 10);
    return sum / (b - a + 1);
  };

  return {
    get playing() {
      return playing;
    },
    get muted() {
      return muted;
    },

    // Start buffering before the click so the music starts on it
    preload() {
      element().load();
    },

    // Call from the click: browsers keep audio off until a user gesture
    async start() {
      const audio = element();
      if (!ctx) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new Ctx();
        const source = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        // No smoothing: a kick is a few milliseconds of attack
        analyser.smoothingTimeConstant = 0;
        spectrum = new Float32Array(analyser.frequencyBinCount);
        out = ctx.createGain();
        out.gain.value = 0;
        source.connect(analyser);
        source.connect(out).connect(ctx.destination);
      }
      await ctx.resume().catch(() => {});
      await audio.play();
      playing = true;
      const now = ctx.currentTime;
      out!.gain.cancelScheduledValues(now);
      out!.gain.setValueAtTime(out!.gain.value, now);
      out!.gain.linearRampToValueAtTime(muted ? 0 : VOLUME, now + FADE_S);
    },

    // Silences the room but keeps the track running, so the lights keep the beat
    setMuted(on: boolean) {
      muted = on;
      if (!ctx || !out) return;
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(on ? 0 : VOLUME, now + 0.25);
    },

    listen(dt: number): Listen {
      if (!playing || !analyser || !spectrum || !el) return SILENT;
      analyser.getFloatFrequencyData(spectrum);
      const bass = band(KICK[0], KICK[1]);
      const k = 1 - Math.exp(-AVG_RATE * dt);
      bassAvg += (bass - bassAvg) * k;

      const time = el.currentTime;
      // The loop wraps the track time back to 0
      if (time < lastKick) lastKick = -1;
      const kick =
        bass > bassAvg * KICK_RISE && bass > prevBass && time - lastKick > KICK_GAP_S && bassAvg > 1e-7;
      if (kick) lastKick = time;
      prevBass = bass;

      return {
        kick,
        bass: Math.min(bass / Math.max(bassAvg * 2, 1e-12), 1),
        time,
      };
    },

    dispose() {
      el?.pause();
      el?.removeAttribute("src");
      el?.load();
      ctx?.close().catch(() => {});
      el = null;
      ctx = null;
      playing = false;
    },
  };
}

export type RaveSound = ReturnType<typeof createRaveSound>;
