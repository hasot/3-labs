// Sound of the click flash, synthesised on the fly: a rush that rises with the
// swelling beam, a muffled thump when the screen goes white, then the thin
// ringing in the ears you get after a blast, slowly dying away

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

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

// `charge`: seconds until the white hit; `ring`: how long the ringing lasts after it.
// Must be called from a user gesture, or the browser keeps the audio muted
export function playFlash(charge: number, ring: number) {
  const { ctx, noise } = audio();
  ctx.resume().catch(() => {});
  const t0 = ctx.currentTime + 0.01;
  const hit = t0 + charge;

  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);

  // Rush: noise through a band that sweeps up and gets louder
  const rush = ctx.createBufferSource();
  rush.buffer = noise;
  rush.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(220, t0);
  band.frequency.exponentialRampToValueAtTime(5200, hit);
  const rushGain = ctx.createGain();
  rushGain.gain.setValueAtTime(0.0001, t0);
  rushGain.gain.exponentialRampToValueAtTime(0.4, hit - 0.02);
  rushGain.gain.linearRampToValueAtTime(0, hit + 0.02);
  rush.connect(band).connect(rushGain).connect(out);
  rush.start(t0);
  rush.stop(hit + 0.05);

  // Thump: a falling low sine plus a burst of dark noise, heard as if through cotton
  const boom = ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(80, hit);
  boom.frequency.exponentialRampToValueAtTime(32, hit + 1);
  const boomGain = ctx.createGain();
  boomGain.gain.setValueAtTime(0.75, hit);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, hit + 1.3);
  boom.connect(boomGain).connect(out);
  boom.start(hit);
  boom.stop(hit + 1.4);

  const blast = ctx.createBufferSource();
  blast.buffer = noise;
  const dark = ctx.createBiquadFilter();
  dark.type = "lowpass";
  dark.frequency.value = 320;
  const blastGain = ctx.createGain();
  blastGain.gain.setValueAtTime(0.6, hit);
  blastGain.gain.exponentialRampToValueAtTime(0.0001, hit + 1);
  blast.connect(dark).connect(blastGain).connect(out);
  blast.start(hit);
  blast.stop(hit + 1.1);

  // Ringing: a near-pure high tone with a faint wobble, holds, then fades out
  const tone = ctx.createOscillator();
  tone.type = "sine";
  tone.frequency.value = 3700;
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 4.5;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 7;
  wobble.connect(wobbleDepth).connect(tone.frequency);
  const toneGain = ctx.createGain();
  toneGain.gain.setValueAtTime(0, hit);
  toneGain.gain.linearRampToValueAtTime(0.08, hit + 0.04);
  toneGain.gain.setValueAtTime(0.08, hit + ring * 0.25);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, hit + ring);
  tone.connect(toneGain).connect(out);
  tone.start(hit);
  wobble.start(hit);
  tone.stop(hit + ring + 0.1);
  wobble.stop(hit + ring + 0.1);
}
