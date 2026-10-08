"""
Records a looping, silent preview video of every lab page for /projects.

A scripted "visitor" moves the mouse like a person (curved paths, uneven speed,
small tremor, occasional overshoot), clicks where the page reacts, and the clip
is cut so its end cross-fades into its start: the video loops without a jump.

Needs: the dev server (npm run dev), Python Playwright with Chromium, ffmpeg.

    python3 scripts/record_previews.py                 # all projects
    python3 scripts/record_previews.py shave tiger     # only these
    BASE_URL=http://localhost:3007 python3 scripts/record_previews.py

Output: public/previews/<slug>.mp4 (H.264, no audio) and <slug>.jpg (poster).
"""

import asyncio
import base64
import json
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "previews"
W, H = 1280, 960
FPS = 30
# The last LOOP_FADE seconds of a clip blend into its first ones
LOOP_FADE = 0.9
# Mouse events per second while moving
MOVE_HZ = 60

# Drawn cursor: headless capture has no system cursor. Pages that draw their own
# (the razor in Shave, the butterfly in Tiger) get none.
CURSORS = {
    "arrow": '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2v19l5-5 3.6 7.6 3.3-1.5L11.4 14.6H18z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    "hand": '<svg width="34" height="34" viewBox="0 0 34 34"><path d="M10 18V8.5a2 2 0 0 1 4 0V16V6a2 2 0 0 1 4 0v10V7.5a2 2 0 0 1 4 0V17v-6a2 2 0 0 1 4 0v9c0 6-4 11-10 11-4.5 0-7-2.5-9-6l-3.2-5.6a2 2 0 0 1 3.4-2z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>',
}

CURSOR_SCRIPT = """
(kind) => {
  const markup = %s;
  const install = () => {
    const style = document.createElement("style");
    // Next's dev indicator would end up in every video
    style.textContent = "nextjs-portal{display:none!important}";
    document.head.appendChild(style);
    if (!markup[kind]) return;
    const el = document.createElement("div");
    el.innerHTML = markup[kind];
    el.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;opacity:0;" +
      "transition:scale .12s ease-out;filter:drop-shadow(0 2px 3px rgb(0 0 0/.35));" +
      (kind === "hand" ? "margin:-6px 0 0 -14px;" : "margin:-2px 0 0 -3px;");
    document.documentElement.appendChild(el);
    addEventListener("pointermove", (e) => {
      el.style.opacity = "1";
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, true);
    addEventListener("pointerdown", () => (el.style.scale = "0.86"), true);
    addEventListener("pointerup", () => (el.style.scale = "1"), true);
  };
  if (document.head) install();
  else addEventListener("DOMContentLoaded", install);
}
""" % (json.dumps(CURSORS),)


def bezier(p0, c1, c2, p1, t):
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t**3 * p1[0],
        u**3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t**3 * p1[1],
    )


def min_jerk(t):
    # Smooth start and stop, like a hand reaching for a target
    return t * t * t * (10 - 15 * t + 6 * t * t)


def catmull(points, t):
    # Position along a Catmull–Rom spline through `points`, t in 0..1
    n = len(points) - 1
    seg = min(int(t * n), n - 1)
    lt = t * n - seg
    p0 = points[max(seg - 1, 0)]
    p1 = points[seg]
    p2 = points[seg + 1]
    p3 = points[min(seg + 2, n)]

    def axis(i):
        a, b, c, d = p0[i], p1[i], p2[i], p3[i]
        return 0.5 * (2 * b + (-a + c) * lt + (2 * a - 5 * b + 4 * c - d) * lt**2 + (-a + 3 * b - 3 * c + d) * lt**3)

    return axis(0), axis(1)


class Visitor:
    """Drives the mouse in real time with human-looking motion."""

    def __init__(self, page, seed):
        self.page = page
        self.rng = random.Random(seed)
        self.pos = (W * 0.5, H * 0.5)
        self.phase = self.rng.uniform(0, 10)

    def px(self, p):
        return (p[0] * W, p[1] * H)

    def tremor(self, t):
        # Low, uneven wobble of a real hand, a pixel or so
        return (
            0.7 * math.sin(t * 7.3 + self.phase) + 0.4 * math.sin(t * 13.1),
            0.7 * math.sin(t * 6.1 + self.phase * 2) + 0.4 * math.cos(t * 11.7),
        )

    async def _play(self, fn, duration):
        steps = max(2, int(duration * MOVE_HZ))
        start = time.perf_counter()
        for i in range(1, steps + 1):
            x, y = fn(i / steps)
            wx, wy = self.tremor(time.perf_counter())
            await self.page.mouse.move(x + wx, y + wy)
            self.pos = (x, y)
            ahead = start + i / MOVE_HZ - time.perf_counter()
            if ahead > 0:
                await asyncio.sleep(ahead)

    async def move(self, target, speed=1.0):
        """Reach `target` (viewport fractions) along a curved path."""
        p0, p1 = self.pos, self.px(target)
        dist = math.dist(p0, p1)
        if dist < 1:
            return
        dx, dy = (p1[0] - p0[0]) / dist, (p1[1] - p0[1]) / dist
        nx, ny = -dy, dx
        bend1, bend2 = (self.rng.uniform(-0.18, 0.18) * dist for _ in range(2))
        c1 = (p0[0] + dx * dist * 0.3 + nx * bend1, p0[1] + dy * dist * 0.3 + ny * bend1)
        c2 = (p0[0] + dx * dist * 0.7 + nx * bend2, p0[1] + dy * dist * 0.7 + ny * bend2)
        # Long reaches sometimes overshoot a little and come back
        overshoot = dist > 280 and self.rng.random() < 0.35
        end = (p1[0] + dx * dist * 0.05, p1[1] + dy * dist * 0.05) if overshoot else p1
        duration = (0.28 + dist / 1100) * self.rng.uniform(0.85, 1.15) / speed
        await self._play(lambda t: bezier(p0, c1, c2, end, min_jerk(t)), duration)
        if overshoot:
            back = self.pos
            await self._play(lambda t: (back[0] + (p1[0] - back[0]) * min_jerk(t), back[1] + (p1[1] - back[1]) * min_jerk(t)), 0.22)

    async def stroke(self, points, duration):
        """Sweep smoothly through several points, e.g. painting or shaving."""
        pts = [self.pos] + [self.px(p) for p in points]
        await self._play(lambda t: catmull(pts, 0.5 - 0.5 * math.cos(math.pi * t)), duration)

    async def drift(self, seconds, radius=0.015):
        """A resting hand still moves a little."""
        cx, cy = self.pos
        r = radius * W
        a, b = self.rng.uniform(0, 6), self.rng.uniform(0, 6)
        await self._play(lambda t: (cx + r * math.sin(a + t * 2.1) * t, cy + r * math.sin(b + t * 1.7) * t), seconds)

    async def wait(self, seconds):
        await asyncio.sleep(seconds)

    async def click(self):
        await self.page.mouse.down()
        await asyncio.sleep(self.rng.uniform(0.07, 0.12))
        await self.page.mouse.up()

    async def to_text(self, text, speed=1.0):
        """Move onto the button with this label and return nothing."""
        box = await self.page.get_by_text(text, exact=True).first.bounding_box()
        target = ((box["x"] + box["width"] * self.rng.uniform(0.35, 0.65)) / W, (box["y"] + box["height"] * 0.55) / H)
        await self.move(target, speed)


# ── Scenarios: what the visitor does on each page. Coordinates are viewport fractions.
# Each one ends where it started, so the loop seam only blends near-identical frames.


async def bat_signal(v):
    await v.stroke([(0.38, 0.30), (0.16, 0.34), (0.30, 0.26), (0.58, 0.30), (0.74, 0.27)], 3.2)
    await v.move((0.06, 0.06), 0.9)  # the hidden logo shows up once the beam finds it
    await v.drift(0.6)
    await v.move((0.88, 0.30))
    await v.stroke([(0.90, 0.48), (0.88, 0.66)], 1.4)
    await v.click()  # lamp off
    await v.drift(1.1)
    await v.click()  # strikes and warms up again
    await v.drift(1.4)
    await v.move((0.55, 0.42), 0.8)
    await v.drift(0.5)


async def light_beam(v):
    await v.stroke([(0.78, 0.26), (0.86, 0.22), (0.84, 0.48), (0.80, 0.62)], 2.6)
    await v.move((0.30, 0.38), 0.9)
    await v.drift(0.7)
    await v.stroke([(0.55, 0.30), (0.83, 0.24)], 1.6)
    await v.drift(0.5)
    await v.click()  # the beam swells into the flash; a skeleton is left behind the white
    flash = time.perf_counter()
    await v.drift(2.2, 0.01)
    # Light the bones while the skeleton holds
    await v.stroke([(0.84, 0.30), (0.80, 0.55), (0.86, 0.45), (0.82, 0.24)], 4.2)
    await v.move((0.42, 0.40), 0.8)
    await v.drift(1.2)
    await v.stroke([(0.70, 0.34), (0.84, 0.28)], 2.0)
    # Wait out the hold and the burn-back (LightBeam: 1.15 s charge + 15 s + 2.5 s)
    await v.drift(max(0.5, 19.2 - (time.perf_counter() - flash)), 0.012)
    await v.move((0.62, 0.42), 0.8)
    await v.drift(0.5)


async def shave(v):
    await v.to_text("Начать бритьё")
    await v.drift(0.3, 0.004)
    await v.click()
    await v.move((0.42, 0.36), 0.9)
    passes = [0.355, 0.39, 0.425, 0.455, 0.485]
    for i, y in enumerate(passes):
        a, b = (0.41, 0.6) if i % 2 == 0 else (0.6, 0.41)
        await v.stroke([((a + b) / 2, y + 0.006), (b, y)], v.rng.uniform(0.75, 0.95))
        await v.move((b + (0.015 if i % 2 == 0 else -0.015), passes[min(i + 1, len(passes) - 1)]), 1.6)
    await v.drift(0.4)
    await v.to_text("Раздуть волосы")
    await v.drift(0.3, 0.004)
    await v.click()  # the hair gathers into a word, then the wind tears it away
    await v.drift(5.2, 0.006)
    await v.to_text("Сбросить", 1.3)
    await v.click()
    await v.drift(0.6, 0.006)
    await v.move((0.62, 0.74), 0.8)
    await v.drift(0.4)


async def tiger(v):
    # The butterfly only flies over the top of the name, from the "t" to the "a",
    # so the cub's head sweeps high and slow instead of chasing it down the sides
    await v.stroke([(0.38, 0.11), (0.24, 0.16)], 1.9)
    await v.drift(0.7)
    await v.stroke([(0.38, 0.10), (0.50, 0.15), (0.62, 0.10), (0.76, 0.16)], 3.6)
    await v.drift(0.8)
    await v.stroke([(0.62, 0.12), (0.50, 0.15)], 1.8)
    await v.drift(0.8)


async def tiger_walk(v):
    # Film the walk from its first frame: the tiger comes out of the dark almost all
    # the way (its idle loop is 8 s) before the visitor clicks
    await v.page.evaluate("""() => {
      const walk = document.querySelector('video[src*="tiger-walk"]');
      if (walk) walk.currentTime = 0;
    }""")
    await v.drift(1.0, 0.004)
    await v.move((0.70, 0.66), 0.5)  # the hand comes in from the edge
    await v.drift(2.0)
    await v.move((0.54, 0.58), 0.6)
    await v.drift(2.6, 0.006)
    await v.click()  # it leaps at the lens, the claws tear the screen onto the jungle
    await v.drift(3.4, 0.008)
    await v.move((0.66, 0.42), 0.6)
    await v.drift(2.8)  # the title spread fades in item by item
    await v.click()  # back into the dark
    await v.move((0.92, 0.80), 0.7)
    await v.drift(1.0)


async def mask_reveal(v, mirror=False):
    m = (lambda p: (1 - p[0], p[1])) if mirror else (lambda p: p)
    await v.stroke([m(p) for p in [(0.62, 0.24), (0.40, 0.30), (0.22, 0.44), (0.38, 0.56), (0.62, 0.46)]], 3.4)
    await v.drift(0.6)
    await v.stroke([m(p) for p in [(0.50, 0.62), (0.44, 0.40), (0.30, 0.28)]], 1.8)
    await v.move(m((0.80, 0.20)), 0.6)
    await v.drift(3.0)  # the night closes back up


async def ink_flow(v):
    # Pour smoke into the letters with quick sweeps, stir the smoke around the
    # word, then step aside and let it all swirl and fade back to the empty word
    await v.stroke([(0.12, 0.44), (0.32, 0.56), (0.52, 0.44), (0.72, 0.56), (0.90, 0.47)], 2.2)
    await v.drift(0.8)
    await v.stroke([(0.74, 0.42), (0.48, 0.58), (0.20, 0.48)], 1.5)
    await v.drift(0.6)
    await v.move((0.30, 0.22), 0.9)
    await v.stroke([(0.50, 0.18), (0.72, 0.24)], 1.4)
    await v.move((0.86, 0.82), 0.6)
    await v.drift(6.5)  # the wisps curl and fade, the word goes dark again


SCENARIOS = {
    # slug: (cursor, start point, seconds to let the page settle, scenario)
    "bat-signal": ("arrow", (0.55, 0.42), 6.0, bat_signal),
    "light-beam": ("arrow", (0.62, 0.42), 3.0, light_beam),
    "shave": (None, (0.62, 0.74), 3.0, shave),
    "tiger-walk": ("arrow", (0.995, 0.86), 4.0, tiger_walk),
    "tiger": (None, (0.50, 0.15), 3.0, tiger),
    "mask-reveal-hand": ("hand", (0.20, 0.20), 3.0, lambda v: mask_reveal(v, mirror=True)),
    "ink-flow": ("arrow", (0.86, 0.82), 7.0, ink_flow),
}


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def encode(frames, t0, t1, slug):
    """Frames with timestamps → constant-rate clip → seamless loop."""
    work = Path(tempfile.mkdtemp(prefix=f"preview-{slug}-"))
    clip = [(ts, data) for ts, data in frames if t0 <= ts <= t1 + 0.1]
    # Screencast only sends a frame when something changed: each one lasts until the next
    lines = []
    for i, (ts, data) in enumerate(clip):
        name = work / f"{i:05d}.jpg"
        name.write_bytes(data)
        nxt = clip[i + 1][0] if i + 1 < len(clip) else ts + 1 / FPS
        lines.append(f"file '{name}'\nduration {max(nxt - ts, 0.001):.4f}")
    lines.append(f"file '{work / f'{len(clip) - 1:05d}.jpg'}'")
    (work / "list.txt").write_text("\n".join(lines))

    raw = work / "raw.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(work / "list.txt"),
         "-vf", f"fps={FPS},scale={W}:{H}:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "fast", str(raw)])

    length = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(raw)]).decode())
    out = OUT_DIR / f"{slug}.mp4"
    # main = clip[F:], head = clip[:F]; main's tail fades into head, whose last frame is main's first
    fade = LOOP_FADE
    graph = (
        f"[0]split[a][b];"
        f"[a]trim=start={fade},setpts=PTS-STARTPTS[main];"
        f"[b]trim=end={fade},setpts=PTS-STARTPTS[head];"
        f"[main][head]xfade=transition=fade:duration={fade}:offset={length - 2 * fade:.3f},format=yuv420p[v]"
    )
    run(["ffmpeg", "-y", "-i", str(raw), "-filter_complex", graph, "-map", "[v]", "-an",
         "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-profile:v", "high", "-movflags", "+faststart", str(out)])
    run(["ffmpeg", "-y", "-i", str(out), "-frames:v", "1", "-q:v", "4", str(OUT_DIR / f"{slug}.jpg")])
    shutil.rmtree(work)
    return out, length - fade


async def record(browser, slug, seed):
    cursor, start, settle, scenario = SCENARIOS[slug]
    context = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    await context.add_init_script(f"({CURSOR_SCRIPT})({json.dumps(cursor or 'none')})")
    page = await context.new_page()
    await page.goto(f"{BASE_URL}/examples/{slug}/", wait_until="networkidle", timeout=120_000)

    v = Visitor(page, seed)
    # Put the hand at the start point before filming, so the first frame already has it
    await page.mouse.move(W * 0.5, H * 0.5)
    await v.move(start)
    await asyncio.sleep(settle)

    cdp = await context.new_cdp_session(page)
    frames = []

    async def ack(session_id):
        try:
            await cdp.send("Page.screencastFrameAck", {"sessionId": session_id})
        except Exception:
            pass  # a frame that arrives while the page is closing

    def on_frame(event):
        frames.append((event["metadata"]["timestamp"], base64.b64decode(event["data"])))
        asyncio.ensure_future(ack(event["sessionId"]))

    cdp.on("Page.screencastFrame", on_frame)
    await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": W, "maxHeight": H, "everyNthFrame": 1})
    await asyncio.sleep(0.4)
    t0 = time.time()
    await scenario(v)
    t1 = time.time()
    await asyncio.sleep(0.3)
    await cdp.send("Page.stopScreencast")
    await asyncio.sleep(0.2)
    await context.close()

    out, seconds = encode(frames, t0, t1, slug)
    rate = len([f for f in frames if t0 <= f[0] <= t1]) / (t1 - t0)
    print(f"{slug}: {seconds:.1f}s loop, ~{rate:.0f} captured fps → {out.relative_to(OUT_DIR.parent.parent)}")


async def main():
    slugs = sys.argv[1:] or list(SCENARIOS)
    unknown = [s for s in slugs if s not in SCENARIOS]
    if unknown:
        sys.exit(f"Unknown: {', '.join(unknown)}. Known: {', '.join(SCENARIOS)}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        # Headed with the real GPU: WebGL and video play at full speed, unlike headless
        browser = await p.chromium.launch(headless=False, args=[
            "--autoplay-policy=no-user-gesture-required",
            # Keep rendering at full rate even when the window is behind others
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling",
        ])
        for i, slug in enumerate(slugs):
            await record(browser, slug, seed=i + 1)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
