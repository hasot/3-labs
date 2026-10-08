// Swing physics shared by the 3D and 2D versions, so both feel the same.
// World units: the pivot sits at (0, PIVOT_Y), +y up, the figure hangs below it.

export const PIVOT_Y = 7.5; // above the top edge of the screen even on tall phones
export const ROPE_LENGTH = 6.7; // pivot to the ankles
// Stylized gravity: the long web would swing too lazily at 9.8
export const G = 16;

// Entrance: lowers in from above the screen on the web
const DESCENT = 4.5; // world units of web paid out
const DESCENT_SECONDS = 3.2;

// Main swing: damped pendulum
const SWING_DAMPING = 0.22;
export const MAX_SWING = 1.1; // rad
const START_SWING = 0.12; // rad, so it is already moving on arrival
const WIND = 0.03; // gentle idle sway, rad/s²

// Web elasticity: it stretches under load and springs back, so every kick and catch
// comes with a little bounce instead of a rigid jolt
const STRETCH_PER_G = 0.12; // extra length per extra g of load
const STRETCH_STIFFNESS = 60; // ~1.2 Hz bounce
const STRETCH_DAMPING = 3.5;
// The web bows sideways when the body accelerates: its middle lags behind the ends
const BEND_STIFFNESS = 25;
const BEND_DAMPING = 2.5;
const BEND_COUPLING = 0.5;
const MAX_BEND = 0.35;

// Rope torsion: the body slowly turns around the web and unwinds back
const TWIST_STIFFNESS = 1.2;
const TWIST_DAMPING = 0.5;
const TWIST_KICK = 0.05; // twist per unit of push speed
const MAX_TWIST_SPEED = 1.2; // rad/s

// Pushing with the cursor: the hand's speed is fed in over a short time, not in one jolt
const PUSH_MIN_SPEED = 0.3; // world units/s: a slow drift over the body does nothing
const PUSH_BLEND = 0.3; // how much of the hand's speed the body takes per event
const PUSH_SMOOTHING = 0.18; // s, time constant for feeding a push into the swing

// Dragging: the body follows the cursor on a soft spring, like pulling against the web
const GRAB_STIFFNESS = 30;
const GRAB_DAMPING = 8;

const MAX_SWING_ACCEL = 25; // clamp on the swing acceleration fed to the web and the limbs

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export type Point = { x: number; y: number };

export type SwingState = {
  theta: number; // swing angle, positive = to the right
  omega: number;
  accel: number; // angular acceleration this frame, clamped
  prevOmega: number;
  pendingPush: number; // angular velocity still to be fed into the swing
  twist: number; // rotation around the web
  twistVelocity: number;
  stretch: number;
  stretchVelocity: number;
  bend: number; // sideways bow of the web's middle
  bendVelocity: number;
  ropeLength: number; // paid out so far, without the stretch
  prevRopeSpeed: number;
  grabbed: boolean;
  grabTarget: number;
  grabOffset: number;
};

export function createSwing(): SwingState {
  return {
    theta: START_SWING,
    omega: 0,
    accel: 0,
    prevOmega: 0,
    pendingPush: 0,
    twist: 0,
    twistVelocity: 0,
    stretch: 0,
    stretchVelocity: 0,
    bend: 0,
    bendVelocity: 0,
    ropeLength: ROPE_LENGTH - DESCENT,
    prevRopeSpeed: 0,
    grabbed: false,
    grabTarget: 0,
    grabOffset: 0,
  };
}

// Length of the web from the pivot to the ankles, stretch included
export const webLength = (s: SwingState) => s.ropeLength + s.stretch;

// `bodyCom`: center of mass distance from the ankles. `t`: seconds since start.
export function stepSwing(s: SwingState, dt: number, t: number, bodyCom: number) {
  // 1. Entrance: pay out the web, decelerating to a stop
  const ropeLength = ROPE_LENGTH - DESCENT * (1 - easeOutCubic(Math.min(t / DESCENT_SECONDS, 1)));
  const ropeSpeed = (ropeLength - s.ropeLength) / dt;
  const ropeAccel = (ropeSpeed - s.prevRopeSpeed) / dt;
  s.ropeLength = ropeLength;
  s.prevRopeSpeed = ropeSpeed;

  // 2. Swing
  const reach = ropeLength + s.stretch + bodyCom;
  let alpha: number;
  if (s.grabbed) {
    alpha = GRAB_STIFFNESS * (s.grabTarget - s.theta) - GRAB_DAMPING * s.omega;
  } else {
    alpha =
      -(G / reach) * Math.sin(s.theta) -
      SWING_DAMPING * s.omega +
      WIND * (Math.sin(t * 0.37) + 0.5 * Math.sin(t * 0.91 + 1.3));
    // Feed pushes in gradually
    const fed = s.pendingPush * (1 - Math.exp(-dt / PUSH_SMOOTHING));
    s.pendingPush -= fed;
    s.omega += fed;
  }
  s.omega += alpha * dt;
  s.theta += s.omega * dt;
  if (Math.abs(s.theta) > MAX_SWING) {
    s.theta = Math.sign(s.theta) * MAX_SWING;
    s.omega *= -0.2;
  }
  s.accel = clamp((s.omega - s.prevOmega) / dt, -MAX_SWING_ACCEL, MAX_SWING_ACCEL);
  s.prevOmega = s.omega;

  // 3. Web stretch under load: gravity along the web + centripetal + braking the descent
  const load = G * Math.cos(s.theta) + reach * s.omega * s.omega - ropeAccel;
  const stretchTarget = (STRETCH_PER_G * (load - G)) / G;
  s.stretchVelocity += (STRETCH_STIFFNESS * (stretchTarget - s.stretch) - STRETCH_DAMPING * s.stretchVelocity) * dt;
  s.stretch += s.stretchVelocity * dt;

  // 4. Web bow: the middle lags behind when the swing speeds up or slows down
  s.bendVelocity += (-BEND_STIFFNESS * s.bend - BEND_DAMPING * s.bendVelocity - BEND_COUPLING * s.accel) * dt;
  s.bend = clamp(s.bend + s.bendVelocity * dt, -MAX_BEND, MAX_BEND);

  // 5. Rope torsion
  s.twistVelocity += (-TWIST_STIFFNESS * s.twist - TWIST_DAMPING * s.twistVelocity) * dt;
  s.twist += s.twistVelocity * dt;
}

// Limbs and strings that dangle on their own: little pendulums hung from the swinging
// body. `radius` is the attachment distance from the pivot, `min`/`max` limit the angle
// relative to the body.
export type DanglerConfig = { length: number; damping: number; radius: number; min: number; max: number };
export type Dangler = { angle: number; velocity: number };

export function stepDangler(d: Dangler, c: DanglerConfig, s: SwingState, dt: number) {
  const { theta, omega, accel } = s;
  // Acceleration of the attachment point: tangential + centripetal
  const at = c.radius * accel;
  const ac = c.radius * omega * omega;
  const ax = at * Math.cos(theta) - ac * Math.sin(theta);
  const ay = at * Math.sin(theta) + ac * Math.cos(theta);
  const alpha = -((G + ay) * Math.sin(d.angle) + ax * Math.cos(d.angle)) / c.length - c.damping * d.velocity;
  d.velocity += alpha * dt;
  d.angle += d.velocity * dt;
  // Bounce off the limits
  const rel = d.angle - theta;
  if (rel < c.min || rel > c.max) {
    d.angle = theta + clamp(rel, c.min, c.max);
    d.velocity = omega + (d.velocity - omega) * -0.3;
  }
}

// Wires the cursor to the swing: hover pushes the body along with the hand, press grabs it.
// `toWorld` maps a pointer event to the world plane, `hitsBody` tests a world point.
export function attachSwingPointer(
  el: HTMLElement,
  s: SwingState,
  toWorld: (e: PointerEvent) => Point | null,
  hitsBody: (p: Point) => boolean,
) {
  const velocity = { x: 0, y: 0 };
  let prev: Point | null = null;
  let prevTime = 0;
  const angleOf = (p: Point) => Math.atan2(p.x, PIVOT_Y - p.y);

  const onMove = (e: PointerEvent) => {
    const p = toWorld(e);
    if (!p) return;
    const dt = Math.max((e.timeStamp - prevTime) / 1000, 0.004);
    if (prev) {
      velocity.x += ((p.x - prev.x) / dt - velocity.x) * 0.5;
      velocity.y += ((p.y - prev.y) / dt - velocity.y) * 0.5;
    }
    prev = p;
    prevTime = e.timeStamp;

    if (s.grabbed) {
      s.grabTarget = clamp(angleOf(p) + s.grabOffset, -MAX_SWING, MAX_SWING);
      return;
    }
    const hit = hitsBody(p);
    el.style.cursor = hit ? "grab" : "";
    if (!hit) return;
    // Only the hand's motion along the swing direction moves the body
    const r = Math.hypot(p.x, PIVOT_Y - p.y);
    const vt = velocity.x * Math.cos(s.theta) + velocity.y * Math.sin(s.theta);
    const handOmega = vt / r;
    const bodyOmega = s.omega + s.pendingPush;
    // Push only when the hand outruns the body in its direction
    if (Math.abs(vt) > PUSH_MIN_SPEED && (handOmega - bodyOmega) * vt > 0) {
      s.pendingPush += (handOmega - bodyOmega) * PUSH_BLEND;
      s.twistVelocity = clamp(s.twistVelocity + vt * TWIST_KICK, -MAX_TWIST_SPEED, MAX_TWIST_SPEED);
    }
  };
  const onDown = (e: PointerEvent) => {
    const p = toWorld(e);
    if (!p || !hitsBody(p)) return;
    s.grabbed = true;
    s.pendingPush = 0;
    s.grabOffset = s.theta - angleOf(p);
    s.grabTarget = s.theta;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
  };
  const onUp = (e: PointerEvent) => {
    if (!s.grabbed) return;
    s.grabbed = false;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.style.cursor = e.pointerType === "mouse" ? "grab" : "";
  };
  const onLeave = () => {
    prev = null;
    velocity.x = velocity.y = 0;
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerleave", onLeave);
  return () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("pointerleave", onLeave);
  };
}

// Distance from point `p` to segment `a`–`b`
export function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const u = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
}
