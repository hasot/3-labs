"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
  useFBO,
} from "@react-three/drei";
import * as THREE from "three";
import {
  DRINKS,
  cavityBottom,
  glassProfile,
  innerRadiusAt,
  liquidProfile,
  gripFor,
  rimHeight,
  smooth,
  type Drink,
} from "./drinks";
import { Garnish } from "./Garnish";
import { Puddles, Stream, type PuddlesApi, type StreamApi } from "./Spill";
import { createLiquidMaterial, createLiquidUniforms, type LiquidUniforms } from "./liquidMaterial";

const POUR_SECONDS = 1.15;
const LATHE_SEGMENTS = 96;
// Conveyor: the next glass slides in from off screen while the old one slides out the other side
const SLIDE_SECONDS = 0.9;
// Liquid lag against the slide's acceleration
const SLIDE_SLOSH = 0.012;

// Grabbing (a fist from the webcam, or a mouse press) picks the glass up: it follows the hand
// across the screen and turns with the wrist (the mouse wheel turns it for a mouse), in the
// plane of the screen, like drinking seen in profile. Tipped past the brim the drink runs out:
// into your mouth if the rim is at your mouth on camera, otherwise onto the table.
const FOLLOW_STIFFNESS = 70;
const SETTLE_STIFFNESS = 160;
const ROLL_STIFFNESS = 60;
const MAX_ROLL = 2.6;
// Mouse wheel: radians of turn per wheel pixel
const WHEEL_ROLL = 0.004;
// Pour lost per second for each radian the glass is tipped past its brim
const DRAIN_RATE = 2.4;
// Rim this close to the mouth on screen (fraction of the screen height) drinks instead of spilling
const MOUTH_REACH = 0.12;
// With no face on camera, any rim raised above this line (fraction of the screen height) is at the mouth
const RAISED_LINE = 0.52;
// A press shorter than this that barely moves is a tap: pour the drink again
const TAP_MS = 220;
const TAP_PX = 6;
// A full glass spilled out makes about this many drops
const DROPS_PER_GLASS = 170;

// Key light: low and to the left, throwing long shadows to the back right like the reference
const LIGHT_POS = new THREE.Vector3(
  Math.cos((155 * Math.PI) / 180) * 5.2,
  4.4,
  Math.sin((155 * Math.PI) / 180) * 5.2,
);

// Seeded noise for the generated textures, so they come out the same on every render
function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// One refraction buffer for every glass: the scene without the glasses themselves.
// The shadow map from the last full frame is reused, so the glasses still shade the table.
function renderRefractionBuffer(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  target: THREE.WebGLRenderTarget,
  glasses: THREE.Mesh[],
) {
  for (const g of glasses) g.visible = false;
  gl.shadowMap.autoUpdate = false;
  gl.setRenderTarget(target);
  gl.render(scene, camera);
  gl.setRenderTarget(null);
  gl.shadowMap.autoUpdate = true;
  for (const g of glasses) g.visible = g.userData.show !== false;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// How far behind the glass the table ends
const TABLE_BACK = -2.4;
// The back edge runs at a slant behind the glass instead of straight across
const TABLE_SLANT = 0.24;

// Felt-like grain for the tablecloth, white so the material colour tints it
function useClothTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    const random = seededRandom(7);
    for (let i = 0; i < size * size; i++) {
      const v = 205 + random() * 50;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 16);
    texture.anisotropy = 8;
    return texture;
  }, []);
}

// Backdrop light falloff, brightest right behind the glass so the clear glass reads against it.
// White, so the wall colour of each drink tints it
function useBackdropTexture() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size * 0.66, 0, size / 2, size * 0.66, size * 0.62);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.45, "#9a9a9a");
    g.addColorStop(1, "#3a3a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

// Soft light pool that a full glass throws onto the table past its shadow
function useCausticTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size * 0.42, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,255,255,0.75)");
    g.addColorStop(0.5, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

export type Grab = {
  active: boolean;
  source: "mouse" | "hand";
  // Where the hand (or the mouse) holds the glass now, and where the press began, in pixels
  point: THREE.Vector2;
  start: THREE.Vector2;
  // Turn of the glass in the screen plane, radians, clockwise
  roll: number;
  // Wrist angle at the moment of the grab, so the glass starts upright whatever the hand's angle
  rollStart: number;
  t0: number;
};

type Shared = {
  index: number;
  grab: Grab;
  // Mouth on screen in pixels, from the face on camera; null with no face in view
  mouth: THREE.Vector2 | null;
  // +1 when moving forward (glasses travel right to left), -1 going back
  dir: number;
  // Parking spot just past the screen edge
  offscreen: number;
  pourRequest: number;
  glasses: THREE.Mesh[];
};

function Cocktail({
  drink,
  slot,
  shared,
  buffer,
  caustic,
  puddles,
  onGrab,
}: {
  drink: Drink;
  slot: number;
  shared: RefObject<Shared>;
  buffer: THREE.Texture;
  caustic: THREE.Texture;
  puddles: RefObject<PuddlesApi | null>;
  onGrab: (e: PointerEvent) => void;
}) {
  const root = useRef<THREE.Group>(null!);
  const stream = useRef<StreamApi>(null);
  const glass = useRef<THREE.Mesh>(null!);
  const liquid = useRef<THREE.Group>(null!);
  const liquidBack = useRef<THREE.Mesh>(null!);
  const causticPivot = useRef<THREE.Group>(null!);
  const causticMat = useRef<THREE.MeshBasicMaterial>(null!);
  const garnishRefs = useRef<(THREE.Group | null)[]>([]);

  const bottom = cavityBottom(drink.glass);
  const rim = rimHeight(drink.glass);
  const inner = useMemo(() => smooth(drink.glass.inner, 64), [drink]);
  const rimR = inner[inner.length - 1][0];
  const grip = useMemo(() => gripFor(drink.glass), [drink]);
  // Widest point of the base: how far the foot's edge dips when the glass turns
  const baseR = useMemo(
    () => Math.max(...[...drink.glass.stem, ...drink.glass.outer].filter(([, y]) => y < 0.05).map(([r]) => r)),
    [drink],
  );

  const { glassGeometry, liquidGeometry } = useMemo(
    () => ({
      glassGeometry: new THREE.LatheGeometry(glassProfile(drink.glass), LATHE_SEGMENTS),
      liquidGeometry: new THREE.LatheGeometry(liquidProfile(drink.glass), LATHE_SEGMENTS),
    }),
    [drink],
  );
  const uniforms = useMemo(() => createLiquidUniforms(drink, bottom), [drink, bottom]);
  const materials = useMemo(
    () => ({
      back: createLiquidMaterial(uniforms, THREE.BackSide),
      front: createLiquidMaterial(uniforms, THREE.FrontSide),
    }),
    [uniforms],
  );
  const causticColor = useMemo(() => new THREE.Color(drink.color), [drink]);
  useEffect(() => {
    const mesh = glass.current;
    mesh.userData.slot = slot;
    const list = shared.current.glasses;
    list.push(mesh);
    return () => {
      list.splice(list.indexOf(mesh), 1);
    };
  }, [shared, slot]);

  const state = useRef({
    pour: 0, // 0 empty … 1 full
    pouring: false,
    garnish: 0,
    x: 0,
    from: 0,
    to: 0,
    slide: 1, // tween progress 0 … 1
    parked: true,
    wasCurrent: false,
    seenRequest: 0,
    spill: 0, // drops owed to the stream, carried between frames
    steered: false,
    // Grip point minus the cursor's point when the grab began, so the glass does not jump
    offset: new THREE.Vector3(),
    hold: 0, // glass: 0 on the table … 1 lifted
    // Grip point in the world and its velocity, and the turn in the screen plane
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    lastVel: new THREE.Vector3(),
    roll: 0,
    rollV: 0,
    lastSlope: new THREE.Vector2(),
    wob: new THREE.Vector2(),
    wobV: new THREE.Vector2(),
  });

  const tmp = useMemo(
    () => ({
      light: new THREE.Vector3(),
      world: new THREE.Vector3(),
      up: new THREE.Vector3(),
      inv: new THREE.Matrix4(),
      dir: new THREE.Vector3(),
      slope: new THREE.Vector2(),
      kick: new THREE.Vector2(),
      goal: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      fwd: new THREE.Vector3(),
      local: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      raycaster: new THREE.Raycaster(),
      accel: new THREE.Vector3(),
      lip: new THREE.Vector3(),
      rimCenter: new THREE.Vector3(),
      flow: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const s = state.current;
    const sh = shared.current;
    const current = sh.index === slot;

    if (current !== s.wasCurrent) {
      s.wasCurrent = current;
      s.slide = 0;
      if (current) {
        // Comes in from the side it travels from, already poured
        s.from = s.parked ? sh.dir * sh.offscreen : s.x;
        s.to = 0;
        if (s.parked) {
          s.pour = 1;
          s.garnish = 1;
          s.pouring = false;
          s.pos.set(s.from, grip.y, 0);
          s.vel.set(0, 0, 0);
          s.lastVel.set(0, 0, 0);
          s.roll = 0;
          s.rollV = 0;
        }
        s.seenRequest = sh.pourRequest;
      } else {
        s.from = s.x;
        s.to = -sh.dir * sh.offscreen;
      }
    }
    if (s.slide < 1) {
      s.slide = Math.min(1, s.slide + dt / SLIDE_SECONDS);
      s.x = s.from + (s.to - s.from) * easeInOutCubic(s.slide);
    }
    s.parked = !current && s.slide >= 1;
    root.current.visible = !s.parked;
    causticPivot.current.visible = !s.parked;
    glass.current.userData.show = !s.parked;
    if (s.parked) return;


    if (current && s.seenRequest !== sh.pourRequest) {
      s.seenRequest = sh.pourRequest;
      s.pour = 0;
      s.garnish = 0;
      s.pouring = true;
    }
    if (s.pouring) {
      s.pour = Math.min(1, s.pour + dt / POUR_SECONDS);
      s.garnish = THREE.MathUtils.clamp((s.pour - 0.82) / 0.18, 0, 1);
      if (s.pour >= 1) s.pouring = false;
    }
    const level = bottom + (drink.fill - bottom) * easeOutCubic(s.pour);
    // How far the glass can tip before the drink reaches the brim
    const brim = Math.atan2(rim - level, rimR);

    const steering = current && sh.grab.active;
    s.hold += ((steering ? 1 : 0) - s.hold) * (1 - Math.exp(-dt * 7));

    // Goal for the grip point: under the cursor while held (on the upright plane through the
    // glass's spot, facing the camera), else back on its spot on the table, upright
    const g = sh.grab;
    let rollGoal = 0;
    if (steering) {
      tmp.ndc.set((g.point.x / window.innerWidth) * 2 - 1, -(g.point.y / window.innerHeight) * 2 + 1);
      tmp.raycaster.setFromCamera(tmp.ndc, camera);
      if (!tmp.raycaster.ray.intersectPlane(tmp.plane, tmp.goal)) tmp.goal.copy(s.pos);
      if (!s.steered) s.offset.subVectors(s.pos, tmp.goal);
      tmp.goal.add(s.offset);
      rollGoal = THREE.MathUtils.clamp(g.roll, -MAX_ROLL, MAX_ROLL);
    } else {
      tmp.goal.set(s.x, grip.y, 0);
    }
    s.steered = steering;
    // Keep every part of the glass above the table at this turn: the foot's edge and the rim's
    const c = Math.cos(s.roll);
    const sn = Math.abs(Math.sin(s.roll));
    const floor = Math.max(grip.y * c + baseR * sn, -(rim - grip.y) * c + rimR * sn) + (steering ? 0.03 : 0);
    tmp.goal.setY(Math.max(tmp.goal.y, floor));

    // Critically damped springs: the glass follows with a little weight, never overshooting
    const k = steering ? FOLLOW_STIFFNESS : SETTLE_STIFFNESS;
    s.vel.addScaledVector(tmp.goal.sub(s.pos).multiplyScalar(k).addScaledVector(s.vel, -2 * Math.sqrt(k)), dt);
    s.pos.addScaledVector(s.vel, dt);
    s.rollV += ((rollGoal - s.roll) * ROLL_STIFFNESS - s.rollV * 2 * Math.sqrt(ROLL_STIFFNESS)) * dt;
    s.roll += s.rollV * dt;
    // The drink lags behind the glass as it speeds up and brakes
    tmp.accel.subVectors(s.vel, s.lastVel).divideScalar(Math.max(dt, 1e-4));
    s.lastVel.copy(s.vel);
    const accel = tmp.accel.x;

    // Turn about the line of sight, so it reads as a turn in the screen, around the grip
    camera.getWorldDirection(tmp.fwd);
    tmp.q.setFromAxisAngle(tmp.fwd, s.roll);
    tmp.local.set(0, grip.y, 0).applyQuaternion(tmp.q);
    root.current.position.copy(s.pos).sub(tmp.local);
    root.current.quaternion.copy(tmp.q);

    // Tipped past the brim, the drink runs out: over the side, or into the mouth
    tmp.up.set(0, 1, 0).applyQuaternion(root.current.quaternion);
    const tipped = Math.acos(THREE.MathUtils.clamp(tmp.up.y, -1, 1));
    let drained = 0;
    if (tipped > brim && s.pour > 0 && !s.pouring) {
      const before = s.pour;
      s.pour = Math.max(0, s.pour - (tipped - brim) * DRAIN_RATE * dt);
      drained = before - s.pour;
    }

    // Uniforms are shared by both liquid meshes; reach them through the mesh, not the memo
    const u = (liquidBack.current.material as THREE.ShaderMaterial).uniforms as unknown as LiquidUniforms;
    u.uFill.value = level;
    u.uTime.value = clock.elapsedTime;
    // A tipped surface reaches further out than the level ring; let it run to the rim
    u.uSurfaceR.value = THREE.MathUtils.lerp(
      innerRadiusAt(inner, level),
      rimR + 0.05,
      THREE.MathUtils.clamp(tipped / 0.5, 0, 1),
    );
    liquid.current.visible = s.pour > 0.002;

    // The surface stays level with the world: world up seen from inside the glass.
    // How fast that level moves kicks the slosh, which rings out on its own spring.
    root.current.updateMatrixWorld();
    tmp.inv.copy(liquidBack.current.matrixWorld).invert();
    tmp.up.set(0, 1, 0).transformDirection(tmp.inv);
    tmp.slope.set(-tmp.up.x / Math.max(tmp.up.y, 0.2), -tmp.up.z / Math.max(tmp.up.y, 0.2));
    tmp.kick.copy(tmp.slope).sub(s.lastSlope).clampScalar(-0.2, 0.2);
    s.lastSlope.copy(tmp.slope);
    const stir = s.pouring ? 0.6 : 0;
    s.wobV.x += (-90 * s.wob.x - 4 * s.wobV.x + Math.sin(clock.elapsedTime * 9) * stir - accel * SLIDE_SLOSH) * dt - tmp.kick.x * 5;
    s.wobV.y += (-90 * s.wob.y - 4 * s.wobV.y + Math.cos(clock.elapsedTime * 7) * stir) * dt - tmp.kick.y * 5;
    s.wob.addScaledVector(s.wobV, dt);
    s.wob.clampScalar(-0.3, 0.3);
    u.uSlope.value.copy(tmp.slope).add(s.wob);

    // Spilled over the side (not drunk): drops leave the lowest point of the rim, heading
    // outwards and down. tmp.up is world up in the glass's own space here.
    if (drained > 0) {
      tmp.lip.set(-tmp.up.x, 0, -tmp.up.z).normalize().multiplyScalar(rimR).setY(rim);
      tmp.lip.applyMatrix4(liquidBack.current.matrixWorld);
      // Rim at the mouth: it is drunk, nothing falls
      tmp.flow.copy(tmp.lip).project(camera);
      const lipX = ((tmp.flow.x + 1) / 2) * window.innerWidth;
      const lipY = ((1 - tmp.flow.y) / 2) * window.innerHeight;
      const drinking = sh.mouth
        ? Math.hypot(lipX - sh.mouth.x, lipY - sh.mouth.y) < MOUTH_REACH * window.innerHeight
        : lipY < RAISED_LINE * window.innerHeight;
      if (!drinking) s.spill += drained * DROPS_PER_GLASS;
      tmp.rimCenter.set(0, rim, 0).applyMatrix4(liquidBack.current.matrixWorld);
      tmp.flow.subVectors(tmp.lip, tmp.rimCenter).setY(0).normalize().multiplyScalar(1.3).setY(0.25);
      while (s.spill >= 1) {
        stream.current?.emit(tmp.lip, tmp.flow);
        s.spill -= 1;
      }
    }
    u.uWaves.value = 0.002 + Math.min(0.006, s.wobV.length() * 0.004);

    // Camera and light in the glass's own space for the shader
    tmp.inv.copy(liquidBack.current.matrixWorld).invert();
    u.uCam.value.copy(camera.position).applyMatrix4(tmp.inv);
    tmp.world.setFromMatrixPosition(liquidBack.current.matrixWorld);
    tmp.light.copy(LIGHT_POS).sub(tmp.world).normalize();
    u.uLight.value.copy(tmp.light).transformDirection(tmp.inv);

    garnishRefs.current.forEach((g) => {
      if (!g) return;
      g.scale.setScalar(s.garnish <= 0 ? 0.0001 : easeOutBack(s.garnish));
      g.visible = s.garnish > 0;
    });

    // Light pool on the table: where the light through the middle of the drink lands
    // (only while the glass stands on the table)
    const centerY = (bottom + level) / 2;
    tmp.dir.set(s.x, centerY, 0).sub(LIGHT_POS);
    const hit = -LIGHT_POS.y / tmp.dir.y;
    causticPivot.current.visible = true;
    causticPivot.current.position.set(LIGHT_POS.x + tmp.dir.x * hit, 0.004, LIGHT_POS.z + tmp.dir.z * hit);
    causticPivot.current.rotation.y = -Math.atan2(tmp.dir.z, tmp.dir.x);
    const width = innerRadiusAt(inner, centerY) * 1.5 + 0.1;
    causticPivot.current.scale.set(width * 1.9, 1, width);
    causticMat.current.color
      .copy(causticColor)
      .multiplyScalar(0.55 * easeOutCubic(s.pour) * (0.6 + 0.4 * (1 - drink.opacity)) * (1 - s.hold));
  });

  return (
    <>
    <group ref={root} visible={false}>
          <mesh
            ref={glass}
            geometry={glassGeometry}
            castShadow
            onPointerDown={(e) => {
              const sh = shared.current;
              if (sh.index !== slot) return;
              e.stopPropagation();
              onGrab(e.nativeEvent);
            }}
            onPointerOver={() => {
              if (shared.current.index === slot) document.body.style.cursor = "grab";
            }}
            onPointerOut={() => {
              if (!shared.current.grab.active) document.body.style.cursor = "";
            }}
          >
            <MeshTransmissionMaterial
              buffer={buffer}
              transmission={1}
              thickness={0.035}
              roughness={0.015}
              ior={1.48}
              chromaticAberration={0.12}
              anisotropicBlur={0.02}
              distortion={0}
              samples={6}
              color="#ffffff"
              envMapIntensity={1.4}
            />
          </mesh>
          <group ref={liquid}>
            <mesh ref={liquidBack} geometry={liquidGeometry} material={materials.back} renderOrder={1} />
            <mesh geometry={liquidGeometry} material={materials.front} renderOrder={2} />
          </group>
          {drink.ice.map((cube, i) => (
            <RoundedBox
              key={i}
              args={[cube.size, cube.size, cube.size]}
              radius={cube.size * 0.14}
              smoothness={3}
              position={cube.position}
              rotation={cube.rotation}
            >
              <meshPhysicalMaterial
                color="#f4f9ff"
                transmission={0.82}
                thickness={cube.size}
                roughness={0.14}
                ior={1.31}
                clearcoat={1}
                clearcoatRoughness={0.04}
                envMapIntensity={1.6}
                attenuationColor="#dfeeff"
                attenuationDistance={1.2}
                // The drink's surface is drawn over the ice, so a cube under it gets tinted
                depthWrite={false}
              />
            </RoundedBox>
          ))}
          {drink.garnish.map((kind, i) => (
            <Garnish
              key={kind}
              kind={kind}
              rim={rim}
              fill={drink.fill}
              ref={(g) => {
                garnishRefs.current[i] = g;
              }}
            />
          ))}
    </group>
      <Stream ref={stream} color={drink.color} owner={slot} puddles={puddles} />
      <group ref={causticPivot} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={causticMat}
            map={caustic}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}

// Webcam hand as the page sees it: a cursor in screen pixels and whether the fingers are closed
export type HandInput = {
  seen: boolean;
  x: number;
  y: number;
  gripping: boolean;
  // The fingers are mid-way through closing or opening: position and wrist angle are on hold
  settling: boolean;
  // Wrist turn in the screen plane, radians clockwise
  roll: number;
  // Mouth of the face on camera, in screen pixels
  mouth: { seen: boolean; x: number; y: number };
};

export function CocktailScene({ step, pourRequest, onPour, onGrabChange, hand }: {
  // Unbounded carousel position: the drink is step mod DRINKS.length
  step: number;
  pourRequest: number;
  onPour: () => void;
  // Tells the page about a grab, so a drag on the glass is not taken for a swipe
  onGrabChange: (grabbing: boolean) => void;
  hand: RefObject<HandInput>;
}) {
  const index = ((step % DRINKS.length) + DRINKS.length) % DRINKS.length;
  const { camera, size } = useThree();
  const buffer = useFBO();
  const caustic = useCausticTexture();
  const spot = useRef<THREE.SpotLight>(null!);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0.4, 0.2, -0.3);
    return o;
  }, []);

  const tableMat = useRef<THREE.MeshStandardMaterial>(null!);
  const wallMat = useRef<THREE.MeshBasicMaterial>(null!);
  const tableColor = useMemo(() => new THREE.Color(), []);
  const wallColor = useMemo(() => new THREE.Color(), []);
  const cloth = useClothTexture();
  const backdrop = useBackdropTexture();
  const shared = useRef<Shared>({
    index,
    grab: {
      active: false,
      source: "mouse",
      point: new THREE.Vector2(),
      start: new THREE.Vector2(),
      roll: 0,
      rollStart: 0,
      t0: 0,
    },
    mouth: null,
    dir: 1,
    offscreen: 6,
    pourRequest,
    glasses: [],
  });
  const lastStep = useRef(step);
  useEffect(() => {
    const sh = shared.current;
    sh.dir = Math.sign(step - lastStep.current) || sh.dir;
    lastStep.current = step;
    sh.index = index;
  }, [step, index]);
  useEffect(() => {
    shared.current.pourRequest = pourRequest;
  }, [pourRequest]);

  const puddles = useRef<PuddlesApi>(null);

  const startGrab = useCallback(
    (source: Grab["source"], x: number, y: number, roll = 0) => {
      const g = shared.current.grab;
      g.active = true;
      g.source = source;
      g.point.set(x, y);
      g.start.set(x, y);
      g.roll = 0;
      g.rollStart = roll;
      g.t0 = performance.now();
      onGrabChange(true);
      if (source === "mouse") document.body.style.cursor = "grabbing";
    },
    [onGrabChange],
  );
  const endGrab = useCallback(() => {
    const g = shared.current.grab;
    // A quick click that barely moved pours the drink again
    const tap = performance.now() - g.t0 < TAP_MS && g.point.distanceTo(g.start) < TAP_PX;
    if (g.source === "mouse" && tap) onPour();
    g.active = false;
    onGrabChange(false);
    document.body.style.cursor = "";
  }, [onGrabChange, onPour]);
  const onGrab = useCallback((e: PointerEvent) => startGrab("mouse", e.clientX, e.clientY), [startGrab]);

  // The mouse is followed on the window, so the glass can be carried anywhere on screen;
  // the wheel turns the glass while it is held
  useEffect(() => {
    const g = shared.current.grab;
    const move = (e: PointerEvent) => {
      if (g.active && g.source === "mouse") g.point.set(e.clientX, e.clientY);
    };
    const release = () => {
      if (g.active && g.source === "mouse") endGrab();
    };
    const wheel = (e: WheelEvent) => {
      if (g.active && g.source === "mouse") {
        g.roll = THREE.MathUtils.clamp(g.roll + (e.deltaY + e.deltaX) * WHEEL_ROLL, -MAX_ROLL, MAX_ROLL);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("wheel", wheel);
    };
  }, [endGrab]);

  // Webcam hand: closing the fingers over the glass grabs it, opening them (or losing the hand) lets go
  const handWasGripping = useRef(false);
  const handProbe = useMemo(
    () => ({ ndc: new THREE.Vector2(), raycaster: new THREE.Raycaster(), box: new THREE.Box3(), corner: new THREE.Vector3() }),
    [],
  );

  // The fist has to close on the glass itself: its screen box, padded by a little for the
  // tracking wobble. The whole object (glass, drink, garnish) counts.
  const handOverGlass = useCallback(
    (glassMesh: THREE.Object3D, x: number, y: number, cam: THREE.Camera) => {
      const p = handProbe;
      p.box.setFromObject(glassMesh.parent ?? glassMesh);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < 8; i++) {
        p.corner
          .set(i & 1 ? p.box.max.x : p.box.min.x, i & 2 ? p.box.max.y : p.box.min.y, i & 4 ? p.box.max.z : p.box.min.z)
          .project(cam);
        const sx = ((p.corner.x + 1) / 2) * window.innerWidth;
        const sy = ((1 - p.corner.y) / 2) * window.innerHeight;
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
      const pad = window.innerHeight * 0.04;
      return x > minX - pad && x < maxX + pad && y > minY - pad && y < maxY + pad;
    },
    [handProbe],
  );

  // Portrait screens pull the camera back so the tallest glass still fits
  useEffect(() => {
    const aspect = size.width / size.height;
    // Looking down at the glass from about 25°, so the rim and the drink's surface show
    const dist = 7.4 * THREE.MathUtils.clamp(0.85 / aspect, 1, 1.7);
    camera.position.set(0, 3.9 * (dist / 7.4), dist);
    camera.lookAt(0, 1.18, 0);
    // Park the waiting glasses (and most of their shadows) just past the screen edge
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
    shared.current.offscreen = Math.tan(fov / 2) * dist * aspect + 1.2;
  }, [camera, size]);

  useFrame(({ gl, scene, camera: cam }, delta) => {
    const sh = shared.current;
    const h = hand.current;
    const gripping = h.seen && h.gripping;
    if (gripping && !handWasGripping.current && !sh.grab.active) {
      const target = sh.glasses.find((m) => m.userData.slot === sh.index);
      if (target && handOverGlass(target, h.x, h.y, cam)) startGrab("hand", h.x, h.y, h.roll);
    }
    if (sh.grab.active && sh.grab.source === "hand") {
      if (!gripping) endGrab();
      else if (h.settling) {
        // The fist is still forming: its knuckle line swings, so the turn counts from when it settles
        sh.grab.rollStart = h.roll;
      } else {
        sh.grab.point.set(h.x, h.y);
        // Wrist turn since the grab, wrapped to the short way round
        const turn = Math.atan2(Math.sin(h.roll - sh.grab.rollStart), Math.cos(h.roll - sh.grab.rollStart));
        sh.grab.roll = THREE.MathUtils.clamp(turn, -MAX_ROLL, MAX_ROLL);
      }
    }
    handWasGripping.current = gripping;
    sh.mouth = h.mouth.seen ? (sh.mouth ?? new THREE.Vector2()).set(h.mouth.x, h.mouth.y) : null;

    // Wall and cloth fade to the next drink's palette while it slides in
    const fade = 1 - Math.exp(-Math.min(delta, 1 / 30) * 4);
    tableMat.current.color.lerp(tableColor.set(DRINKS[index].table), fade);
    wallMat.current.color.lerp(wallColor.set(DRINKS[index].wall), fade);

    renderRefractionBuffer(gl, scene, cam, buffer, sh.glasses);
  });

  return (
    <>
      <color attach="background" args={["#0d0d0f"]} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={6} position={[-4, 2.5, 2]} scale={[2, 7, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={1.2} position={[4, 2, -2]} scale={[1, 6, 1]} target={[0, 1, 0]} />
        <Lightformer form="circle" intensity={0.8} position={[0, 6, 0]} scale={3} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.5} position={[0, 1.5, 6]} scale={[8, 1, 1]} target={[0, 1, 0]} />
      </Environment>

      <primitive object={target} />
      <spotLight
        ref={spot}
        position={LIGHT_POS}
        target={target}
        angle={0.5}
        penumbra={0.8}
        decay={0}
        intensity={8}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      <ambientLight intensity={0.04} />
      {/* Bounce from the lit paper, so the shadows stay deep grey instead of black */}
      <directionalLight position={[3, 5, 6]} intensity={0.18} color="#dfe6f0" />

      {/* Table with a back edge, so the cloth ends in a clean line against the wall */}
      <mesh
        rotation={[-Math.PI / 2, 0, TABLE_SLANT]}
        position={[-Math.sin(TABLE_SLANT) * 12, 0, TABLE_BACK + Math.cos(TABLE_SLANT) * 12]}
        receiveShadow
      >
        <planeGeometry args={[60, 24]} />
        <meshStandardMaterial
          ref={tableMat}
          color={DRINKS[0].table}
          map={cloth}
          roughness={1}
          envMapIntensity={0.04}
        />
      </mesh>
      <mesh position={[0, 6, TABLE_BACK - 5]}>
        <planeGeometry args={[60, 24]} />
        <meshBasicMaterial ref={wallMat} color={DRINKS[0].wall} map={backdrop} toneMapped={false} />
      </mesh>

      <Puddles ref={puddles} />

      {DRINKS.map((drink, slot) => (
        <Cocktail
          key={drink.name}
          drink={drink}
          slot={slot}
          shared={shared}
          buffer={buffer.texture}
          caustic={caustic}
          puddles={puddles}
          onGrab={onGrab}
        />
      ))}
    </>
  );
}
