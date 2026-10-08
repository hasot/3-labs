"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { playFlash } from "../light-beam/flashSound";
import { startHandTracking } from "../mask-reveal/handTracker";
import {
  type Drop,
  type Jelly,
  type Kind,
  type Pusher,
  createJelly,
  drawJelly,
  drawWater,
  kickJelly,
  pressJelly,
  sampleGlyph,
  stepJelly,
  stepWater,
} from "./matter";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PHOTO_SRC = `${BASE_PATH}/images/glasses-portrait.webp`;
// "Sunglasses Khronos" from KhronosGroup/glTF-Sample-Assets, CC-BY 4.0
const GLASSES_SRC = `${BASE_PATH}/models/sunglasses.glb`;

const PHOTO_W = 2560;
const PHOTO_H = 1440;
// Pupils in the photo, image px
const EYE_L = { x: 1162, y: 375 };
const EYE_R = { x: 1316, y: 355 };
// Frame width over the distance between the pupils
const FRAME_OVER_EYES = 2.25;
// The bridge sits a little below the pupil line, share of the eye distance
const WORN_DROP = 0.06;
// The head is turned slightly to the side, radians around the vertical axis
const WORN_YAW = -0.12;

const HEADLINE = "STAY COOL";
// What each character is made of: h = hard, j = jelly, w = water (aligned with HEADLINE)
const MATTER = "hjwj hwjh";
const KINDS: Record<string, Kind> = { h: "hard", j: "jelly", w: "water" };
const FONT = '900 {size}px "Arial Black", "Helvetica Neue", Arial, sans-serif';
// Headline width as a share of the screen, and its cap height limit as a share of the height
const HEADLINE_FILL = 0.6;
const HEADLINE_MAX_H = 0.16;
const LETTER_GAP = 0.04;
const FLOOR_MARGIN = 0.03;

// Physics runs in meters, the screen in CSS px
const PX_PER_M = 100;
const GRAVITY = 32;
const STEP = 1 / 120;
const MAX_SUBSTEPS = 6;
// Mouse spring: stiffness (1/s²) and damping ratio at the grab point
const GRAB_K = 520;
const GRAB_ZETA = 0.75;
const MAX_SPEED = 40;
const GLASSES_MASS = 1;
const LETTER_MASS = 1.4;
const JELLY_MASS = 0.9;
// Jelly reaction: sway (share of the letter half-height per m/s) and squash (per m/s)
const JELLY_SWAY = 0.22;
const JELLY_SQUASH = 0.2;
// Same for contact pushes from the glasses or other letters, per m/s of push
const JELLY_PRESS_SWAY = 0.35;
const JELLY_PRESS_SQUASH = 0.22;
// Water: drop spacing and radius as a share of the font size, goo blur over the radius
const DROP_SPACING = 0.034;
const DROP_RADIUS = 0.034;
const GOO_BLUR = 0.75;
// The cursor stirs the water within this radius, share of the font size
const STIR_RADIUS = 0.2;
// Water slows the glasses down: velocity kept per touched drop and step
const WATER_DRAG = 0.9985;
// Colliders of the letters and walls reach far along z so the glasses' temples always hit them
const DEPTH = 10;
// Glasses fly back onto the face for this long, ms
const RETURN_MS = 750;
// Let go of the glasses this close to the nose (share of the eye distance) and they click into place
const SNAP_DIST = 0.9;
const SNAP_ANGLE = 0.8;
const SNAP_MS = 240;
// Within this many snap distances the face turns the glasses to its own tilt
const MAGNET_RANGE = 1.8;
// Grab area around the glasses, share of their size
const HIT_PAD = 0.15;

// Glasses off this long and the sun comes up on the right and burns the whole screen white, ms
const SUN_DELAY = 10000;
// Meanwhile the heat builds: warm haze from the right that keeps growing, this curve over the countdown
const HEAT_CURVE = 1.7;
// The blinding lasts this long; the sun swells over the first SUN_RISE s, full white until SUN_HOLD s
const SUN_MS = 20000;
const SUN_RISE = 1.6;
const SUN_HOLD = 4;
// Sun center: just past the right edge, upper third (share of the screen)
const SUN_X = 1.04;
const SUN_Y = 0.3;
const SHAKE_PX = 16;

// Hand: pinch closes below this fingertip gap (over palm size) and opens above the other
const PINCH_CLOSE = 0.28;
const PINCH_OPEN = 0.45;
// Pinching this close to the glasses (share of the eye distance) still picks them up
const HAND_REACH = 1.6;
// How fast the hand cursor follows the camera, 1/s, and how long a lost hand still counts, ms
const HAND_FOLLOW = 22;
const HAND_GRACE = 250;

const CAMERA_FOV = 18;
// Look-only 3D tilt that follows the motion, radians per m/s, its limit and how fast it settles (1/s)
const TILT_PER_SPEED = 0.05;
const TILT_MAX = 0.7;
const TILT_RATE = 7;

type Letter = {
  ch: string;
  kind: Kind;
  // Water letters have no body: their drops live outside the physics world
  body: RAPIER.RigidBody | null;
  // Ink center relative to the text origin, px
  ox: number;
  oy: number;
  hw: number;
  hh: number;
  jelly?: Jelly;
  drops?: Drop[];
  // Velocity before the last physics step, m/s
  pvx: number;
  pvy: number;
};

type Grab = {
  body: RAPIER.RigidBody;
  // Grab point in the body's frame, m
  local: THREE.Vector3;
};

type GlassesState = "worn" | "free" | "returning";

export function GlassesDrop() {
  const mainRef = useRef<HTMLElement>(null);
  const lettersRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);
  const gooBlurRef = useRef<SVGFEGaussianBlurElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const heatRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const whiteRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const camRef = useRef<HTMLVideoElement>(null);
  const handDotRef = useRef<HTMLDivElement>(null);
  const startCameraRef = useRef<() => void>(() => {});
  const [camState, setCamState] = useState<"off" | "starting" | "on" | "denied" | "error">("off");
  const [blind, setBlind] = useState(false);
  const putBackRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [off, setOff] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const main = mainRef.current!;
    const lettersCanvas = lettersRef.current!;
    const glCanvas = glRef.current!;
    const ctx = lettersCanvas.getContext("2d")!;
    const waterCanvas = waterRef.current!;
    const wctx = waterCanvas.getContext("2d")!;
    const sceneEl = sceneRef.current!;
    const sunEl = sunRef.current!;
    const heatEl = heatRef.current!;
    const timerEl = timerRef.current!;
    const whiteEl = whiteRef.current!;
    let disposed = false;
    let raf = 0;
    const cleanups: (() => void)[] = [];

    const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 10, 20000);
    scene.add(new THREE.HemisphereLight(0xffe4ef, 0x5a1030, 0.9));
    const key = new THREE.DirectionalLight(0xfff0f4, 2.2);
    key.position.set(-0.6, 1, 1.2);
    scene.add(key);

    const glasses = new THREE.Group();
    scene.add(glasses);
    // Invisible box around the frame: the thin aviator rims alone are hard to hit
    const hitArea = new THREE.Group();
    glasses.add(hitArea);
    // Temples are hidden while worn: on the face they go behind the head
    const temples: THREE.Object3D[] = [];

    let W = 0;
    let H = 0;
    // Photo cover fit: screen px per image px and the image's top-left on screen
    let cover = 1;
    let coverX = 0;
    let coverY = 0;

    // Screen px (y down) -> scene px (centered, y up) and physics meters
    const toScene = (px: number, py: number) => new THREE.Vector2(px - W / 2, H / 2 - py);
    const fromImage = (ix: number, iy: number) => toScene(coverX + ix * cover, coverY + iy * cover);

    let world: RAPIER.World | null = null;
    let glassesBody: RAPIER.RigidBody | null = null;
    let walls: RAPIER.RigidBody | null = null;
    let letters: Letter[] = [];
    let glassesState: GlassesState = "worn";
    let glassesScale = 1;
    // Frame-center offset of the model and the collider boxes, model units
    let modelBoxes: { front: THREE.Box3; left: THREE.Box3; right: THREE.Box3 } | null = null;
    const wornPos = new THREE.Vector3();
    const wornQuat = new THREE.Quaternion();
    let returnFrom: { pos: THREE.Vector3; quat: THREE.Quaternion; t0: number; ms: number; lift: number } | null =
      null;
    let grab: Grab | null = null;
    const pointer = new THREE.Vector2();
    let fontSize = 100;
    let eyesPx = 100;
    let wornAngle = 0;
    let dpr = 1;
    const floorPx = () => H * (1 - FLOOR_MARGIN);
    let eventQueue: RAPIER.EventQueue | null = null;

    const setOffState = (v: boolean) => !disposed && setOff(v);

    const computeWorn = () => {
      const l = fromImage(EYE_L.x, EYE_L.y);
      const r = fromImage(EYE_R.x, EYE_R.y);
      const eyes = r.distanceTo(l);
      const tilt = Math.atan2(r.y - l.y, r.x - l.x);
      eyesPx = eyes;
      wornAngle = tilt;
      const mid = l.clone().add(r).multiplyScalar(0.5);
      // Drop along the face's own down direction
      const down = new THREE.Vector2(Math.sin(tilt), -Math.cos(tilt)).multiplyScalar(eyes * WORN_DROP);
      wornPos.set((mid.x + down.x) / PX_PER_M, (mid.y + down.y) / PX_PER_M, 0);
      wornQuat.setFromEuler(new THREE.Euler(0, WORN_YAW, tilt, "ZYX"));
      if (modelBoxes) {
        const frameW = modelBoxes.front.max.x - modelBoxes.front.min.x;
        glassesScale = (eyes * FRAME_OVER_EYES) / frameW;
      }
    };

    const buildLetters = () => {
      if (!world) return;
      for (const l of letters) if (l.body) world.removeRigidBody(l.body);
      letters = [];

      const chars = [...HEADLINE];
      const measure = (size: number) => {
        ctx.font = FONT.replace("{size}", String(size));
        return chars.map((ch) => ctx.measureText(ch));
      };
      // Fit by width, then cap by height
      let m = measure(100);
      const advance = m.reduce((s, t) => s + t.width, 0) + LETTER_GAP * 100 * (chars.length - 1);
      const capH = Math.max(...m.map((t) => t.actualBoundingBoxAscent));
      fontSize = Math.min((W * HEADLINE_FILL * 100) / advance, (H * HEADLINE_MAX_H * 100) / capH);
      m = measure(fontSize);
      const font = FONT.replace("{size}", String(fontSize));
      const total = m.reduce((s, t) => s + t.width, 0) + LETTER_GAP * fontSize * (chars.length - 1);

      let x = (W - total) / 2;
      chars.forEach((ch, i) => {
        const t = m[i];
        if (ch.trim()) {
          const left = -t.actualBoundingBoxLeft;
          const right = t.actualBoundingBoxRight;
          const top = -t.actualBoundingBoxAscent;
          const bottom = t.actualBoundingBoxDescent;
          const ox = (left + right) / 2;
          const oy = (top + bottom) / 2;
          const hw = (right - left) / 2;
          const hh = (bottom - top) / 2;
          const kind = KINDS[MATTER[i]] ?? "hard";
          const ink = { ox, oy, hw, hh };
          // Rest them on the floor: the bottom of the ink touches it
          const baseline = floorPx() - bottom;
          if (kind === "water") {
            const drops = sampleGlyph(ch, font, x, baseline, { left, right, top, bottom }, fontSize * DROP_SPACING);
            letters.push({ ch, kind, body: null, ...ink, drops, pvx: 0, pvy: 0 });
          } else {
            const c = toScene(x + ox, floorPx() - hh);
            const jelly = kind === "jelly";
            const body = world!.createRigidBody(
              RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(c.x / PX_PER_M, c.y / PX_PER_M + 0.002, 0)
                .enabledTranslations(true, true, false)
                .enabledRotations(false, false, true)
                .setLinearDamping(0.05)
                .setAngularDamping(jelly ? 0.8 : 0.4),
            );
            const desc = RAPIER.ColliderDesc.cuboid(hw / PX_PER_M, hh / PX_PER_M, DEPTH)
              .setMass(jelly ? JELLY_MASS : LETTER_MASS)
              .setFriction(jelly ? 0.5 : 0.8)
              // Jelly bounces whatever lands on it
              .setRestitution(jelly ? 0.65 : 0.05);
            if (jelly) desc.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0);
            world!.createCollider(desc, body);
            letters.push({
              ch,
              kind,
              body,
              ...ink,
              jelly: jelly ? createJelly(ch, font, ink, dpr) : undefined,
              pvx: 0,
              pvy: 0,
            });
          }
        }
        x += t.width + LETTER_GAP * fontSize;
      });
    };

    const buildWalls = () => {
      if (!world) return;
      if (walls) world.removeRigidBody(walls);
      walls = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const hw = W / 2 / PX_PER_M;
      const hh = H / 2 / PX_PER_M;
      const floorY = (H / 2 - floorPx()) / PX_PER_M;
      const t = 5;
      world.createCollider(RAPIER.ColliderDesc.cuboid(hw + t, t, DEPTH).setTranslation(0, floorY - t, 0).setFriction(0.9), walls);
      world.createCollider(RAPIER.ColliderDesc.cuboid(hw + t, t, DEPTH).setTranslation(0, hh + t, 0), walls);
      world.createCollider(RAPIER.ColliderDesc.cuboid(t, hh + t, DEPTH).setTranslation(-hw - t, 0, 0), walls);
      world.createCollider(RAPIER.ColliderDesc.cuboid(t, hh + t, DEPTH).setTranslation(hw + t, 0, 0), walls);
    };

    const buildGlassesBody = () => {
      if (!world || !modelBoxes) return;
      if (glassesBody) world.removeRigidBody(glassesBody);
      const s = glassesScale / PX_PER_M;
      glassesBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(wornPos.x, wornPos.y, 0)
          .setRotation(wornQuat)
          .enabledTranslations(true, true, false)
          // Spin only in the screen plane: tumbling in 3D they turn edge-on and the lenses vanish
          .enabledRotations(false, false, true)
          .setCcdEnabled(true)
          .setAngularDamping(0.6),
      );
      const boxes = [modelBoxes.front, modelBoxes.left, modelBoxes.right];
      const masses = [0.7, 0.15, 0.15];
      boxes.forEach((b, i) => {
        const c = b.getCenter(new THREE.Vector3()).multiplyScalar(s);
        const h = b.getSize(new THREE.Vector3()).multiplyScalar(s / 2);
        world!.createCollider(
          RAPIER.ColliderDesc.cuboid(Math.max(h.x, 0.02), Math.max(h.y, 0.02), Math.max(h.z, 0.02))
            .setTranslation(c.x, c.y, c.z)
            .setMass(GLASSES_MASS * masses[i])
            .setFriction(0.6)
            .setRestitution(0.3),
          glassesBody!,
        );
      });
      glassesState = "worn";
      setOffState(false);
    };

    const resize = () => {
      W = main.clientWidth;
      H = main.clientHeight;
      cover = Math.max(W / PHOTO_W, H / PHOTO_H);
      coverX = (W - PHOTO_W * cover) / 2;
      coverY = (H - PHOTO_H * cover) / 2;

      dpr = Math.min(window.devicePixelRatio, 2);
      lettersCanvas.width = Math.round(W * dpr);
      lettersCanvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The goo filter blurs the whole canvas every frame, so the water stays at 1x
      waterCanvas.width = W;
      waterCanvas.height = H;

      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.position.set(0, 0, H / 2 / Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)));
      camera.near = camera.position.z / 10;
      camera.far = camera.position.z * 10;
      camera.updateProjectionMatrix();

      computeWorn();
      glasses.scale.setScalar(glassesScale);
      // Simple and predictable: a new size starts the scene over
      grab = null;
      returnFrom = null;
      buildWalls();
      buildLetters();
      buildGlassesBody();
      gooBlurRef.current?.setAttribute("stdDeviation", String(fontSize * DROP_RADIUS * GOO_BLUR));
    };

    // --- Model -------------------------------------------------------------

    const loadModel = () =>
      new Promise<void>((resolve, reject) => {
        new GLTFLoader().load(
          GLASSES_SRC,
          (gltf) => {
            const root = gltf.scene;
            root.updateMatrixWorld(true);
            const boxOf = (...names: string[]) => {
              const b = new THREE.Box3();
              for (const n of names) {
                const o = root.getObjectByName(n);
                if (o) b.expandByObject(o);
              }
              return b;
            };
            const front = boxOf("Frames", "LensesExterior");
            const center = front.getCenter(new THREE.Vector3());
            root.position.sub(center);
            root.updateMatrixWorld(true);
            modelBoxes = {
              front: boxOf("Frames", "LensesExterior", "Nosepads"),
              left: boxOf("TempleLeft", "EarhookLeft"),
              right: boxOf("TempleRight", "EarhookRight"),
            };
            for (const n of ["TempleLeft", "TempleRight", "EarhookLeft", "EarhookRight"]) {
              const o = root.getObjectByName(n);
              if (o) temples.push(o);
            }
            for (const b of Object.values(modelBoxes)) {
              const size = b.getSize(new THREE.Vector3()).multiplyScalar(1 + HIT_PAD);
              const box = new THREE.Mesh(
                new THREE.BoxGeometry(size.x, size.y, Math.max(size.z, 0.02)),
                new THREE.MeshBasicMaterial({ visible: false }),
              );
              b.getCenter(box.position);
              hitArea.add(box);
            }

            const frame = new THREE.MeshPhysicalMaterial({
              color: 0x030303,
              roughness: 0.3,
              metalness: 0,
              clearcoat: 1,
              clearcoatRoughness: 0.08,
            });
            const lens = new THREE.MeshPhysicalMaterial({
              // Pitch black: only the highlights show it's glass
              color: 0x000000,
              roughness: 0.05,
              metalness: 0,
              clearcoat: 1,
              clearcoatRoughness: 0.02,
              envMapIntensity: 0.12,
            });
            const pads = new THREE.MeshPhysicalMaterial({
              color: 0x111111,
              roughness: 0.3,
            });
            root.traverse((o) => {
              if (!(o instanceof THREE.Mesh)) return;
              const name = o.parent?.name ?? o.name;
              if (name.startsWith("Lenses")) {
                o.material = lens;
                o.visible = name === "LensesExterior";
              } else if (name === "Nosepads") o.material = pads;
              else o.material = frame;
            });
            glasses.add(root);
            resolve();
          },
          undefined,
          reject,
        );
      });

    const loadEnvironment = () =>
      new Promise<void>((resolve) => {
        // The photo itself as the reflection map: the lenses mirror the pink room
        new THREE.TextureLoader().load(PHOTO_SRC, (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          const pmrem = new THREE.PMREMGenerator(renderer);
          scene.environment = pmrem.fromEquirectangular(tex).texture;
          tex.dispose();
          pmrem.dispose();
          resolve();
        }, undefined, () => resolve());
      });

    // --- Pointer -----------------------------------------------------------

    const raycaster = new THREE.Raycaster();
    // Mouse and hand both speak in screen px relative to the page
    const local = (e: PointerEvent) => {
      const r = main.getBoundingClientRect();
      return { sx: e.clientX - r.left, sy: e.clientY - r.top };
    };
    const toMeters = (sx: number, sy: number) => {
      const s = toScene(sx, sy);
      return new THREE.Vector2(s.x / PX_PER_M, s.y / PX_PER_M);
    };
    const rayAt = (sx: number, sy: number) => {
      raycaster.setFromCamera(new THREE.Vector2((sx / W) * 2 - 1, -(sy / H) * 2 + 1), camera);
      return raycaster.intersectObject(hitArea, true)[0];
    };

    const bodyQuat = (b: RAPIER.RigidBody) => {
      const q = b.rotation();
      return new THREE.Quaternion(q.x, q.y, q.z, q.w);
    };
    const bodyPos = (b: RAPIER.RigidBody) => {
      const t = b.translation();
      return new THREE.Vector3(t.x, t.y, t.z);
    };

    const startGrab = (body: RAPIER.RigidBody, worldPoint: THREE.Vector3) => {
      const local = worldPoint.sub(bodyPos(body)).applyQuaternion(bodyQuat(body).invert());
      grab = { body, local };
      body.wakeUp();
    };

    // Pick up whatever is under (sx, sy). `reach` (px) forgives a shaky hand:
    // that close to the glasses' center still counts as a grab
    const pressAt = (sx: number, sy: number, reach = 0) => {
      if (!world || !glassesBody) return false;
      const p = toMeters(sx, sy);
      pointer.copy(p);

      // Glasses first: a ray against their padded boxes
      let hitPoint = rayAt(sx, sy)?.point.clone().divideScalar(PX_PER_M);
      if (!hitPoint && reach > 0) {
        const g = bodyPos(glassesBody);
        if (Math.hypot(g.x - p.x, g.y - p.y) * PX_PER_M < reach) hitPoint = g;
      }
      if (hitPoint && glassesState !== "returning") {
        if (glassesState === "worn") {
          glassesBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
          glassesState = "free";
          setOffState(true);
        }
        startGrab(glassesBody, hitPoint);
      } else {
        // A letter under the cursor, in its own rotated frame
        for (const l of letters) {
          if (!l.body) continue;
          const c = bodyPos(l.body);
          const a = 2 * Math.atan2(l.body.rotation().z, l.body.rotation().w);
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          const lx = Math.cos(-a) * dx - Math.sin(-a) * dy;
          const ly = Math.sin(-a) * dx + Math.cos(-a) * dy;
          if (Math.abs(lx) * PX_PER_M <= l.hw && Math.abs(ly) * PX_PER_M <= l.hh) {
            startGrab(l.body, new THREE.Vector3(p.x, p.y, 0));
            break;
          }
        }
      }
      if (!grab) return false;
      setTouched(true);
      return true;
    };

    // The cursor (or hand) in screen px and its speed, for stirring the water
    const stir = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0 };
    const moveTo = (sx: number, sy: number, timeMs: number) => {
      pointer.copy(toMeters(sx, sy));
      const dt = Math.max(0.008, (timeMs - stir.t) / 1000);
      // Smoothed so one jumpy event doesn't splash the whole letter
      stir.vx += ((sx - stir.x) / dt - stir.vx) * 0.5;
      stir.vy += ((sy - stir.y) / dt - stir.vy) * 0.5;
      if (stir.t === 0 || dt > 0.25) stir.vx = stir.vy = 0;
      stir.x = sx;
      stir.y = sy;
      stir.t = timeMs;
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a,button")) return;
      const { sx, sy } = local(e);
      if (pressAt(sx, sy)) {
        main.setPointerCapture(e.pointerId);
        main.style.cursor = "grabbing";
      }
    };
    const onMove = (e: PointerEvent) => {
      const { sx, sy } = local(e);
      moveTo(sx, sy, e.timeStamp);
      // Hover cursor over the glasses
      if (!grab) main.style.cursor = rayAt(sx, sy) ? "grab" : "";
    };

    const zAngle = (q: THREE.Quaternion) => new THREE.Euler().setFromQuaternion(q, "ZYX").z;
    // How far the glasses are from sitting on the nose: distance in px and angle off
    const offNose = () => {
      const p = bodyPos(glassesBody!);
      const dist = Math.hypot(p.x - wornPos.x, p.y - wornPos.y) * PX_PER_M;
      const da = Math.atan2(Math.sin(wornAngle - zAngle(bodyQuat(glassesBody!))), Math.cos(wornAngle - zAngle(bodyQuat(glassesBody!))));
      return { dist, da };
    };

    const putBack = (ms: number, lift: number) => {
      if (!glassesBody || glassesState !== "free") return;
      grab = null;
      returnFrom = { pos: bodyPos(glassesBody), quat: bodyQuat(glassesBody), t0: performance.now(), ms, lift };
      glassesBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      glassesState = "returning";
      setOffState(false);
    };
    putBackRef.current = () => putBack(RETURN_MS, 0.8);

    // Straight onto the face, no flight: used while the screen is white
    const wearNow = () => {
      if (!glassesBody) return;
      if (grab?.body === glassesBody) grab = null;
      returnFrom = null;
      glassesBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      glassesBody.setTranslation({ x: wornPos.x, y: wornPos.y, z: 0 }, true);
      glassesBody.setRotation(wornQuat, true);
      glassesState = "worn";
      tilt.set(0, 0);
      setOffState(false);
    };

    const release = () => {
      if (!grab) return;
      if (grab.body === glassesBody) {
        const { dist, da } = offNose();
        if (dist < eyesPx * SNAP_DIST && Math.abs(da) < SNAP_ANGLE) {
          main.style.cursor = "";
          putBack(SNAP_MS, 0);
          return;
        }
      }
      // Cap the throw so nothing tunnels through the walls
      const v = grab.body.linvel();
      const sp = Math.hypot(v.x, v.y);
      if (sp > MAX_SPEED) grab.body.setLinvel({ x: (v.x / sp) * MAX_SPEED, y: (v.y / sp) * MAX_SPEED, z: 0 }, true);
      grab = null;
      main.style.cursor = "";
    };
    const onUp = () => release();

    // --- Hand ----------------------------------------------------------------

    // Latest pinch from the camera (~30 Hz), smoothed every frame into a hand cursor
    const hand = { tx: 0, ty: 0, x: 0, y: 0, seen: false, lastSeen: -1e9, ratio: 1, pinched: false, holding: false };
    let stopHand: (() => void) | null = null;
    startCameraRef.current = async () => {
      if (stopHand || !camRef.current) return;
      setCamState("starting");
      try {
        const stop = await startHandTracking(camRef.current, (pt) => {
          hand.seen = !!pt;
          if (!pt) return;
          hand.tx = pt.tipX * W;
          hand.ty = pt.tipY * H;
          hand.ratio = pt.pinch;
          hand.lastSeen = performance.now();
          // Hysteresis: a pinch has to open clearly before it lets go
          if (hand.pinched ? pt.pinch > PINCH_OPEN : pt.pinch < PINCH_CLOSE) hand.pinched = !hand.pinched;
        });
        if (disposed) {
          stop();
          return;
        }
        stopHand = stop;
        setCamState("on");
      } catch (err) {
        if (disposed) return;
        setCamState((err as Error)?.name === "NotAllowedError" ? "denied" : "error");
      }
    };

    const stepHand = (now: number, dt: number) => {
      if (!stopHand) return;
      // A short grace period rides over frames where the model loses the hand
      const present = hand.seen || now - hand.lastSeen < HAND_GRACE;
      const dot = handDotRef.current;
      if (!present) {
        if (hand.holding) release();
        hand.holding = false;
        if (dot) dot.style.opacity = "0";
        return;
      }
      const k = 1 - Math.exp(-dt * HAND_FOLLOW);
      hand.x += (hand.tx - hand.x) * k;
      hand.y += (hand.ty - hand.y) * k;
      moveTo(hand.x, hand.y, now);
      if (hand.pinched && !hand.holding) {
        hand.holding = true;
        pressAt(hand.x, hand.y, eyesPx * HAND_REACH);
      } else if (!hand.pinched && hand.holding) {
        hand.holding = false;
        release();
      }
      if (dot) {
        dot.style.opacity = "1";
        dot.style.transform = `translate(${hand.x}px, ${hand.y}px) scale(${hand.pinched ? 0.6 : 1})`;
        dot.dataset.pinched = hand.pinched ? "1" : "0";
      }
    };

    // --- Loop --------------------------------------------------------------

    const applyGrab = () => {
      if (!grab) return;
      const b = grab.body;
      const q = bodyQuat(b);
      const r = grab.local.clone().applyQuaternion(q);
      const p = bodyPos(b).add(r);
      const v = b.linvel();
      const w = b.angvel();
      const wv = new THREE.Vector3(w.x, w.y, w.z).cross(r);
      const vp = new THREE.Vector3(v.x + wv.x, v.y + wv.y, v.z + wv.z);
      const c = 2 * GRAB_ZETA * Math.sqrt(GRAB_K);
      const m = b.mass();
      const f = new THREE.Vector3(pointer.x - p.x, pointer.y - p.y, 0)
        .multiplyScalar(GRAB_K)
        .sub(vp.multiplyScalar(c))
        // Hold against gravity so the spring doesn't sag
        .add(new THREE.Vector3(0, GRAVITY, 0))
        .multiplyScalar(m * STEP);
      b.applyImpulseAtPoint({ x: f.x, y: f.y, z: 0 }, { x: p.x, y: p.y, z: p.z }, true);

      // Near the nose the face takes over the angle, like a magnet
      if (b === glassesBody) {
        const { dist, da } = offNose();
        const pull = 1 - dist / (eyesPx * SNAP_DIST * MAGNET_RANGE);
        if (pull > 0) {
          const wz = b.angvel().z;
          b.setAngvel({ x: 0, y: 0, z: wz + (da * 14 - wz) * Math.min(1, pull * 0.25) }, true);
        }
      }
    };

    const stepReturn = (now: number) => {
      if (!returnFrom || !glassesBody) return;
      const t = Math.min(1, (now - returnFrom.t0) / returnFrom.ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      // A small arc up on the way, as if lifted and put on
      const lift = Math.sin(Math.PI * t) * returnFrom.lift;
      const pos = returnFrom.pos.clone().lerp(wornPos, e);
      pos.y += lift;
      const quat = returnFrom.quat.clone().slerp(wornQuat, e);
      glassesBody.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: 0 });
      glassesBody.setNextKinematicRotation(quat);
      if (t >= 1) {
        returnFrom = null;
        glassesState = "worn";
      }
    };

    const letterAngle = (b: RAPIER.RigidBody) => {
      const rot = b.rotation();
      return 2 * Math.atan2(rot.z, rot.w);
    };

    // Before a step: remember velocities; after it: the change kicks the jelly
    const rememberVelocities = () => {
      for (const l of letters) {
        if (!l.jelly || !l.body) continue;
        const v = l.body.linvel();
        l.pvx = v.x;
        l.pvy = v.y;
      }
    };
    // A vector in screen orientation (y down) into the letter's own frame
    const toLocal = (x: number, y: number, a: number) => {
      // The letter is drawn rotated by -a on screen
      const c = Math.cos(a);
      const s = Math.sin(a);
      return { x: x * c - y * s, y: x * s + y * c };
    };
    const shakeJelly = () => {
      for (const l of letters) {
        if (!l.jelly || !l.body) continue;
        const v = l.body.linvel();
        const d = toLocal(v.x - l.pvx, -(v.y - l.pvy), letterAngle(l.body));
        kickJelly(l.jelly, d.x, d.y, l.hh, JELLY_SWAY, JELLY_SQUASH);
      }
      // Pushes from the glasses and other letters; the floor only holds it up
      eventQueue!.drainContactForceEvents((e) => {
        const c1 = world!.getCollider(e.collider1());
        const c2 = world!.getCollider(e.collider2());
        for (const [self, other] of [
          [c1, c2],
          [c2, c1],
        ]) {
          const body = self?.parent();
          if (!body || !other || other.parent() === walls) continue;
          const l = letters.find((x) => x.body === body);
          if (!l?.jelly) continue;
          const f = e.totalForce();
          // Make the force point from the other object into this letter
          const op = other.parent()!.translation();
          const sp = body.translation();
          const sign = f.x * (sp.x - op.x) + f.y * (sp.y - op.y) >= 0 ? 1 : -1;
          const dv = (STEP / (body.mass() || 1)) * sign;
          const d = toLocal(f.x * dv, -f.y * dv, letterAngle(body));
          pressJelly(l.jelly, d.x, d.y, l.hh, JELLY_PRESS_SWAY, JELLY_PRESS_SQUASH);
        }
      });
      for (const l of letters) if (l.jelly) stepJelly(l.jelly, STEP, l.hh);
    };

    // Solid things the water has to get out of the way of, in screen px
    const pushers: Pusher[] = [];
    let glassesPusher: Pusher | null = null;
    const collectPushers = () => {
      pushers.length = 0;
      glassesPusher = null;
      const add = (b: RAPIER.RigidBody, hw: number, hh: number) => {
        const t = b.translation();
        const v = b.linvel();
        pushers.push({
          cx: t.x * PX_PER_M + W / 2,
          cy: H / 2 - t.y * PX_PER_M,
          hw,
          hh,
          angle: -letterAngle(b),
          vx: v.x * PX_PER_M,
          vy: -v.y * PX_PER_M,
          w: -b.angvel().z,
          hits: 0,
        });
      };
      if (glassesBody && glassesState === "free" && modelBoxes) {
        const size = modelBoxes.front.getSize(new THREE.Vector3()).multiplyScalar(glassesScale / 2);
        add(glassesBody, size.x, size.y);
        glassesPusher = pushers[0];
      }
      for (const l of letters) if (l.body) add(l.body, l.hw, l.hh);
    };

    const stepWaterLetters = (dt: number, t: number) => {
      collectPushers();
      const radius = fontSize * DROP_RADIUS;
      const s = grab ? null : { ...stir, r: fontSize * STIR_RADIUS };
      // Stiff springs: small steps keep them stable on slow frames
      const n = Math.ceil(dt / STEP);
      for (let i = 0; i < n; i++) {
        for (const l of letters) {
          if (l.drops) stepWater(l.drops, dt / n, t, floorPx(), W, pushers, s, radius);
        }
      }
      // The cursor's speed dies out when it stops moving
      stir.vx *= Math.exp(-dt * 12);
      stir.vy *= Math.exp(-dt * 12);
      // Water drags on the glasses passing through it
      const g = glassesPusher;
      if (g && glassesBody && g.hits > 0 && grab?.body !== glassesBody) {
        const k = Math.pow(WATER_DRAG, Math.min(g.hits, 400));
        const v = glassesBody.linvel();
        glassesBody.setLinvel({ x: v.x * k, y: v.y * k, z: 0 }, true);
        const w = glassesBody.angvel();
        glassesBody.setAngvel({ x: 0, y: 0, z: w.z * k }, true);
      }
    };

    const drawLetters = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.font = FONT.replace("{size}", String(fontSize));
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fffafc";
      for (const l of letters) {
        if (!l.body) continue;
        const c = bodyPos(l.body);
        ctx.save();
        ctx.translate(c.x * PX_PER_M + W / 2, H / 2 - c.y * PX_PER_M);
        ctx.rotate(-letterAngle(l.body));
        if (l.jelly) drawJelly(ctx, l.jelly, l.hw, l.hh);
        else ctx.fillText(l.ch, -l.ox, -l.oy);
        ctx.restore();
      }

      wctx.clearRect(0, 0, W, H);
      const radius = fontSize * DROP_RADIUS;
      for (const l of letters) if (l.drops) drawWater(wctx, l.drops, radius);
    };

    // --- Sun -----------------------------------------------------------------

    let offSince: number | null = null;
    let shownCountdown: number | null = null;
    let blindStart: number | null = null;
    // The blast puts the glasses back once; after that they can be pulled off again
    let blastWore = false;
    const showCountdown = (v: number | null) => {
      if (v === shownCountdown || disposed) return;
      shownCountdown = v;
      setCountdown(v);
    };
    const ease3 = (x: number) => x * x * x;

    const stepSun = (now: number) => {
      const bare = glassesState === "free";
      let sunScale = 0;
      let sunAlpha = 0;
      let heat = 0;
      let white = 0;
      let shake = 0;

      if (blindStart === null) {
        if (!bare) {
          offSince = null;
          showCountdown(null);
        } else {
          offSince ??= now;
          const left = SUN_DELAY - (now - offSince);
          showCountdown(Math.max(1, Math.ceil(left / 1000)));
          // Heat builds smoothly the whole time; the white-hot sun only shows up at the very end
          heat = THREE.MathUtils.clamp(1 - left / SUN_DELAY, 0, 1) ** HEAT_CURVE;
          sunScale = 0.042 * heat ** 4;
          sunAlpha = heat ** 3;
          if (left <= 0) {
            blindStart = now;
            blastWore = false;
            offSince = null;
            showCountdown(null);
            if (!disposed) setBlind(true);
            playFlash(SUN_RISE, (SUN_MS - SUN_RISE * 1000) / 1000);
          }
        }
      }

      if (blindStart !== null) {
        const t = (now - blindStart) / 1000;
        // Under the full white the glasses are back on the nose, so they're there when it clears
        if (t >= SUN_RISE && !blastWore) {
          blastWore = true;
          if (glassesState !== "worn") wearNow();
        }
        const fade = THREE.MathUtils.clamp((t - SUN_HOLD) / (SUN_MS / 1000 - SUN_HOLD), 0, 1);
        // Swells from the edge, faster and faster, until it swallows the screen
        sunScale = t < SUN_RISE ? 0.042 + 1.26 * ease3(t / SUN_RISE) : 1.3 - 0.75 * fade;
        sunAlpha = (1 - fade) ** 1.5;
        heat = 1 - fade;
        white = t < SUN_RISE * 0.6 ? 0 : t < SUN_RISE ? ((t - SUN_RISE * 0.6) / (SUN_RISE * 0.4)) ** 2 : (1 - fade) ** 2.4;
        shake = THREE.MathUtils.clamp(1 - Math.abs(t - SUN_RISE - 0.5) / 1.6, 0, 1);
        if (t >= SUN_MS / 1000) {
          blindStart = null;
          // Pulled off again while still blind: the countdown starts over
          offSince = glassesState === "free" ? now : null;
          if (!disposed) setBlind(false);
        }
      }

      const diag = Math.hypot(W, H);
      sunEl.style.transform = `translate(${W * SUN_X - diag}px, ${H * SUN_Y - diag}px) scale(${sunScale})`;
      sunEl.style.width = sunEl.style.height = `${diag * 2}px`;
      sunEl.style.opacity = String(sunAlpha);
      // Haze: a wide soft glow anchored at the same spot, growing with the heat
      const heatScale = 0.35 + 0.8 * heat;
      heatEl.style.transform = `translate(${W * SUN_X - diag}px, ${H * SUN_Y - diag}px) scale(${heatScale})`;
      heatEl.style.width = heatEl.style.height = `${diag * 2}px`;
      heatEl.style.opacity = String(heat);
      whiteEl.style.opacity = String(white);
      // The picture warms up with the heat, then burns out under the glare
      const glare = Math.max(white, Math.min(1, sunScale / 1.3) * sunAlpha * 0.8);
      const warm = heat * (1 - glare);
      sceneEl.style.filter =
        glare + warm > 0.002
          ? `brightness(${1 + 0.3 * warm + 3 * glare}) sepia(${0.3 * warm}) saturate(${1 + 0.25 * warm - 0.6 * glare}) contrast(${1 - 0.35 * glare})`
          : "";

      // Countdown rides next to the glasses
      if (shownCountdown !== null && glassesBody) {
        const g = glassesBody.translation();
        timerEl.style.transform = `translate(${g.x * PX_PER_M + W / 2 + eyesPx * 1.15}px, ${H / 2 - g.y * PX_PER_M - eyesPx * 0.75}px)`;
      }
      sceneEl.style.transform = shake > 0
        ? `translate(${(Math.random() - 0.5) * 2 * SHAKE_PX * shake}px, ${(Math.random() - 0.5) * 2 * SHAKE_PX * shake}px)`
        : "";
    };

    let last = performance.now();
    let acc = 0;
    const tilt = new THREE.Vector2();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!world || !glassesBody) return;
      // rAF stamps can trail performance.now() on the first frame
      const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.1);
      acc = Math.min(acc + dt, STEP * MAX_SUBSTEPS);
      last = now;
      stepHand(now, dt);
      while (acc >= STEP) {
        stepReturn(now);
        applyGrab();
        rememberVelocities();
        world.step(eventQueue!);
        shakeJelly();
        acc -= STEP;
      }
      stepWaterLetters(dt, now / 1000);

      const t = glassesBody.translation();
      glasses.position.set(t.x * PX_PER_M, t.y * PX_PER_M, t.z * PX_PER_M);
      // Moving sideways turns them around the vertical axis, falling tips them forward
      const v = glassesState === "free" ? glassesBody.linvel() : { x: 0, y: 0 };
      const clampTilt = (a: number) => THREE.MathUtils.clamp(a, -TILT_MAX, TILT_MAX);
      const k = 1 - Math.exp(-dt * TILT_RATE);
      tilt.x += (clampTilt(-v.y * TILT_PER_SPEED) - tilt.x) * k;
      tilt.y += (clampTilt(v.x * TILT_PER_SPEED) - tilt.y) * k;
      glasses.quaternion
        .copy(bodyQuat(glassesBody))
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt.x, tilt.y, 0)));
      const worn = glassesState === "worn";
      for (const t of temples) t.visible = !worn;
      renderer.render(scene, camera);
      drawLetters();
      stepSun(now);
    };

    (async () => {
      await RAPIER.init();
      await Promise.all([loadModel(), loadEnvironment(), document.fonts.ready]);
      if (disposed) return;
      world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
      eventQueue = new RAPIER.EventQueue(true);
      world.timestep = STEP;
      resize();
      setReady(true);
      last = performance.now();
      raf = requestAnimationFrame(frame);

      window.addEventListener("resize", resize);
      main.addEventListener("pointerdown", onDown);
      main.addEventListener("pointermove", onMove);
      main.addEventListener("pointerup", onUp);
      main.addEventListener("pointercancel", onUp);
      cleanups.push(() => {
        window.removeEventListener("resize", resize);
        main.removeEventListener("pointerdown", onDown);
        main.removeEventListener("pointermove", onMove);
        main.removeEventListener("pointerup", onUp);
        main.removeEventListener("pointercancel", onUp);
      });
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      stopHand?.();
      eventQueue?.free();
      world?.free();
      renderer.dispose();
    };
  }, []);

  return (
    <main
      ref={mainRef}
      className="relative h-dvh w-full touch-none overflow-hidden bg-[#f4b4cc] text-[#3b0a24] select-none"
    >
      <div ref={sceneRef} className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PHOTO_SRC}
          alt="Portrait in a pink bucket hat"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        {/* Goo: blur the drops together, then cut the alpha sharp so they read as one liquid */}
        <svg className="absolute h-0 w-0" aria-hidden>
          <filter id="glasses-drop-goo" colorInterpolationFilters="sRGB">
            <feGaussianBlur ref={gooBlurRef} in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
          </filter>
        </svg>
        <canvas
          ref={lettersRef}
          className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700 [filter:drop-shadow(0_6px_8px_rgba(150,30,80,0.3))] ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
        <canvas
          ref={waterRef}
          className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700 [filter:url(#glasses-drop-goo)_drop-shadow(0_6px_8px_rgba(40,90,160,0.25))] ${
            ready ? "opacity-90" : "opacity-0"
          }`}
        />
        <canvas
          ref={glRef}
          className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700 [filter:drop-shadow(0_10px_10px_rgba(90,10,45,0.35))] ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.3em] text-[#3b0a24]/70 md:px-12 md:py-8">
        <span className="relative">
          <span
            className={`transition-opacity duration-700 ${ready && !touched ? "opacity-100" : "opacity-0"}`}
          >
            {camState === "on" ? (
              "Pinch the glasses"
            ) : (
              <>
                <span className="pointer-coarse:hidden">Grab the glasses</span>
                <span className="hidden pointer-coarse:inline">Drag the glasses off</span>
              </>
            )}
          </span>
          <span
            className={`absolute left-0 top-0 whitespace-nowrap transition-opacity duration-700 ${
              off ? "opacity-100 delay-700" : "opacity-0"
            }`}
          >
            {blind ? "Told you" : "Drop them back on the nose"}
          </span>
        </span>
        <nav className="pointer-events-auto flex items-center gap-6 md:gap-10">
          <button
            type="button"
            onClick={() => putBackRef.current()}
            className={`uppercase tracking-[0.3em] transition-opacity hover:text-[#3b0a24] ${
              off ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            Put them back
          </button>
          {camState !== "on" && (
            <button
              type="button"
              disabled={!ready || camState === "starting"}
              onClick={() => startCameraRef.current()}
              className="uppercase tracking-[0.3em] transition-colors hover:text-[#3b0a24] disabled:opacity-50"
            >
              {camState === "starting" ? "Starting camera…" : "Use hand"}
            </button>
          )}
          <Link href="/" className="transition-colors hover:text-[#3b0a24]">
            Labs
          </Link>
        </nav>
      </header>

      {(camState === "denied" || camState === "error") && (
        <p className="pointer-events-none absolute top-14 right-6 font-[family-name:var(--font-geist-mono)] text-[11px] text-[#3b0a24]/70 md:top-20 md:right-12">
          {camState === "denied"
            ? "Camera access is blocked. Allow it in the browser settings."
            : "The camera couldn't start."}
        </p>
      )}
      {/* Where the pinch is: an open ring, filled while the fingers are together */}
      <div
        ref={handDotRef}
        data-pinched="0"
        className="pointer-events-none absolute top-0 left-0 -mt-4 -ml-4 h-8 w-8 rounded-full border-2 border-white opacity-0 shadow-[0_0_18px_rgba(120,20,60,0.35)] transition-[opacity,background-color] duration-150 data-[pinched=1]:bg-white"
      />
      {/* Small mirrored camera preview, so it's clear what the page sees */}
      <video
        ref={camRef}
        muted
        playsInline
        className={`pointer-events-none absolute right-6 bottom-6 w-36 -scale-x-100 rounded-lg border border-white/40 object-cover opacity-0 transition-opacity duration-700 md:right-12 md:bottom-10 md:w-44 ${
          camState === "on" ? "opacity-80" : ""
        }`}
      />

      {/* Heat haze: lightens what's under it, like hot air glowing */}
      <div
        ref={heatRef}
        className="pointer-events-none absolute top-0 left-0 rounded-full opacity-0 mix-blend-screen will-change-transform"
        style={{
          background:
            "radial-gradient(circle closest-side, rgba(255,226,170,0.95) 0%, rgba(255,190,120,0.7) 22%, rgba(255,150,90,0.4) 45%, rgba(255,130,80,0.15) 70%, rgba(255,120,80,0) 100%)",
        }}
      />
      {/* Small countdown next to the glasses */}
      <div
        ref={timerRef}
        className={`pointer-events-none absolute top-0 left-0 transition-opacity duration-500 ${
          countdown !== null ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="block -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[11px] tabular-nums text-[#3b0a24] shadow-sm backdrop-blur-sm">
          {countdown ?? ""}
        </span>
      </div>
      {/* The sun: a huge soft disc centered just past the right edge, scaled up to swallow the screen */}
      <div
        ref={sunRef}
        className="pointer-events-none absolute top-0 left-0 rounded-full opacity-0 will-change-transform"
        style={{
          background:
            "radial-gradient(circle closest-side, #fff 0%, #fffef6 20%, #fff3c4 32%, rgba(255,214,130,0.8) 46%, rgba(255,170,90,0.35) 66%, rgba(255,150,70,0) 100%)",
        }}
      />
      <div ref={whiteRef} className="pointer-events-none absolute inset-0 bg-[#fffdf7] opacity-0" />
    </main>
  );
}
