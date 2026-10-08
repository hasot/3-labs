"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import {
  PIVOT_Y,
  ROPE_LENGTH,
  attachSwingPointer,
  clamp,
  createSwing,
  distToSegment,
  stepDangler,
  stepSwing,
  webLength,
  type Dangler,
  type DanglerConfig,
} from "./swing";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Placeholder: Mixamo X Bot. Any Mixamo-rigged GLB with the same bone names drops in.
export const MODEL_SRC = `${BASE_PATH}/models/xbot.glb`;

export const CAMERA_DISTANCE = 7.5;

// Model space: the rig as authored, upright, soles at 0, facing +Z, its left on +X, meters.
// The whole figure is scaled down by MODEL_SCALE and hung upside down.
const MODEL_SCALE = 0.6;

const BODY_COM = 0.95 * MODEL_SCALE; // center of mass, from the ankles
const HIT_RADIUS = 0.3; // around the body axis, world units
const WEB_SEGMENTS = 24;

// Spider-Man pose, model space. The web runs from the ankles along the front of the body
// to the hands gripping it at chest level; its tail hangs past the hands.
const BODY_WEB: [number, number, number][] = [
  [0, 0.08, 0],
  [0.02, 0.45, 0.14],
  [0, 0.95, 0.22],
  [0, 1.2, 0.3],
  [0, 1.42, 0.3],
  [0.01, 1.55, 0.28],
];
// Wrists sit just off the web, so the curled fingers wrap around it
const LEFT_GRIP = new THREE.Vector3(0.06, 1.38, 0.3);
const RIGHT_GRIP = new THREE.Vector3(-0.06, 1.2, 0.3);
const GRIP_POINT_LEFT = new THREE.Vector3(0, 1.38, 0.32);
const GRIP_POINT_RIGHT = new THREE.Vector3(0, 1.2, 0.32);
// Elbows point out to the sides and back
const LEFT_ELBOW_POLE = new THREE.Vector3(1, 0, -0.4);
const RIGHT_ELBOW_POLE = new THREE.Vector3(-1, 0, -0.4);
// Left leg is wrapped by the web and stays straight; the right one hooks behind its knee
const LEFT_ANKLE = new THREE.Vector3(0, 0.08, 0);
const RIGHT_FOOT = new THREE.Vector3(0.05, 0.5, -0.14);
const RIGHT_KNEE_POLE = new THREE.Vector3(-0.7, 0, 1);
// Finger curl per joint, rad: fingers point along the bone's local X, palm towards -Y
const FINGER_CURL = [1.1, 1.3, 0.9];
const THUMB_CURL = 0.5;
const FINGER_CURL_AXIS = new THREE.Vector3(0, 0, 1);

// Head hangs along the body and lags a little on kicks
const HEAD: DanglerConfig = {
  length: 0.12,
  damping: 6,
  radius: ROPE_LENGTH + 1.6 * MODEL_SCALE,
  min: -0.35,
  max: 0.35,
};

const BONES = [
  "Head",
  "HeadTop_End",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "LeftHandMiddle1",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "RightHandMiddle1",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
] as const;
type BoneName = (typeof BONES)[number];
const FINGERS = ["Index", "Middle", "Ring", "Pinky"];

// GLTFLoader strips ":" from node names, so "mixamorig:Hips" becomes "mixamorigHips"
function findBone(root: THREE.Object3D, name: string) {
  return (root.getObjectByName(`mixamorig${name}`) ?? root.getObjectByName(`mixamorig:${name}`)) as
    | THREE.Bone
    | undefined;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();

// Rotates `bone` so the segment towards `child` points along `dir` (world space).
// Works regardless of how the rig's local axes are set up.
function aimBone(bone: THREE.Bone, child: THREE.Object3D, dir: THREE.Vector3) {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _b.sub(_a).normalize();
  _qDelta.setFromUnitVectors(_b, dir);
  bone.getWorldQuaternion(_q).premultiply(_qDelta);
  bone.parent!.getWorldQuaternion(_qParent).invert();
  bone.quaternion.copy(_qParent.multiply(_q));
  bone.updateMatrixWorld(true);
}

const _s = new THREE.Vector3();
const _m = new THREE.Vector3();
const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _webPoints = new Float32Array((WEB_SEGMENTS + 1) * 3);

// Two-bone IK (world space): bends upper/lower so `end` reaches `target`,
// with the middle joint pushed towards `pole`
function solveTwoBone(
  upper: THREE.Bone,
  lower: THREE.Bone,
  end: THREE.Object3D,
  target: THREE.Vector3,
  pole: THREE.Vector3,
) {
  upper.getWorldPosition(_s);
  lower.getWorldPosition(_m);
  end.getWorldPosition(_e);
  const a = _s.distanceTo(_m);
  const b = _m.distanceTo(_e);
  _n.copy(target).sub(_s);
  const d = clamp(_n.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  _n.normalize();
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  _p.copy(pole).addScaledVector(_n, -pole.dot(_n)).normalize();
  // Joint position, then aim each bone at the next point
  _m.copy(_s).addScaledVector(_n, a * cosA).addScaledVector(_p, a * Math.sqrt(1 - cosA * cosA));
  aimBone(upper, lower, _dir.copy(_m).sub(_s).normalize());
  lower.getWorldPosition(_m);
  aimBone(lower, end, _dir.copy(target).sub(_m).normalize());
}

export function HangingScene() {
  const { scene } = useGLTF(MODEL_SRC);
  const { camera, gl } = useThree();
  const pivotRef = useRef<THREE.Group>(null);
  const twistRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const webRef = useRef<Line2>(null);

  const rig = useMemo(() => {
    const bones = {} as Record<BoneName, THREE.Bone>;
    for (const name of BONES) {
      const bone = findBone(scene, name);
      if (!bone) throw new Error(`Bone ${name} not found in ${MODEL_SRC}`);
      bones[name] = bone;
    }
    // [bone, curl axis sign] for every finger joint of both hands
    const fingers: [THREE.Bone, number, number][] = [];
    for (const [side, sign] of [
      ["Left", -1],
      ["Right", 1],
    ] as const) {
      for (const finger of FINGERS) {
        FINGER_CURL.forEach((curl, i) => {
          const bone = findBone(scene, `${side}Hand${finger}${i + 1}`);
          if (bone) fingers.push([bone, sign, curl]);
        });
      }
      const thumb = findBone(scene, `${side}HandThumb2`);
      if (thumb) fingers.push([thumb, sign, THUMB_CURL]);
    }
    const rest = new Map<THREE.Bone, THREE.Quaternion>();
    for (const bone of [...Object.values(bones), ...fingers.map(([b]) => b)]) rest.set(bone, bone.quaternion.clone());
    // Bones move the skin far from its bind-pose bounds
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
    return { bones, fingers, rest };
  }, [scene]);

  const swing = useRef(createSwing());
  const extra = useRef({
    head: { angle: 0, velocity: 0 } as Dangler,
    // Body axis in world space, for hit testing: ankles to the top of the head
    bodyA: new THREE.Vector3(),
    bodyB: new THREE.Vector3(),
  });

  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ndc = new THREE.Vector2();
    const point = new THREE.Vector3();
    const toWorld = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, point);
    };
    const { bodyA, bodyB } = extra.current;
    return attachSwingPointer(el, swing.current, toWorld, (p) => distToSegment(p, bodyA, bodyB) < HIT_RADIUS);
  }, [camera, gl]);

  const tmp = useMemo(
    () => ({
      dir: new THREE.Vector3(),
      target: new THREE.Vector3(),
      pole: new THREE.Vector3(),
      q: new THREE.Quaternion(),
    }),
    [],
  );

  useFrame(({ clock, camera, size }, delta) => {
    // Narrow screens: pull the camera back so the swing fits horizontally
    const aspect = size.width / size.height;
    camera.position.z = aspect < 1 ? CAMERA_DISTANCE / Math.max(aspect, 0.5) ** 0.8 : CAMERA_DISTANCE;

    const pivot = pivotRef.current;
    const twist = twistRef.current;
    const body = bodyRef.current;
    const web = webRef.current;
    if (!pivot || !twist || !body || !web) return;
    const s = swing.current;
    const { head, bodyA, bodyB } = extra.current;
    const dt = Math.min(delta, 1 / 30);
    stepSwing(s, dt, clock.elapsedTime, BODY_COM);
    stepDangler(head, HEAD, s, dt);

    pivot.rotation.z = s.theta;
    twist.rotation.y = s.twist;
    const length = webLength(s);
    body.position.y = -length;

    // Web as a bowed curve from the pivot to the ankles
    const pts = _webPoints;
    for (let i = 0; i <= WEB_SEGMENTS; i++) {
      const u = i / WEB_SEGMENTS;
      pts[i * 3] = s.bend * Math.sin(Math.PI * u);
      pts[i * 3 + 1] = -u * length;
      pts[i * 3 + 2] = 0;
    }
    web.geometry.setPositions(pts);

    // Pose the rig from the rest pose
    const { bones, fingers, rest } = rig;
    for (const [bone, q] of rest) bone.quaternion.copy(q);
    body.updateMatrixWorld(true);
    body.getWorldQuaternion(tmp.q);
    const { dir, target, pole } = tmp;

    // Legs: left one straight into the wrap, right one hooked behind its knee
    body.localToWorld(target.copy(LEFT_ANKLE));
    bones.LeftUpLeg.getWorldPosition(dir);
    dir.subVectors(target, dir).normalize();
    aimBone(bones.LeftUpLeg, bones.LeftLeg, dir);
    aimBone(bones.LeftLeg, bones.LeftFoot, dir);
    solveTwoBone(
      bones.RightUpLeg,
      bones.RightLeg,
      bones.RightFoot,
      body.localToWorld(target.copy(RIGHT_FOOT)),
      pole.copy(RIGHT_KNEE_POLE).applyQuaternion(tmp.q),
    );

    // Head hangs along the body, lagging a little on kicks
    dir.set(Math.sin(head.angle), -Math.cos(head.angle), 0);
    aimBone(bones.Head, bones.HeadTop_End, dir);

    // Arms reach for the web, hands turned towards it, fingers wrapped around
    for (const [arm, foreArm, hand, middle, grip, gripPoint, elbowPole] of [
      [bones.LeftArm, bones.LeftForeArm, bones.LeftHand, bones.LeftHandMiddle1, LEFT_GRIP, GRIP_POINT_LEFT, LEFT_ELBOW_POLE],
      [bones.RightArm, bones.RightForeArm, bones.RightHand, bones.RightHandMiddle1, RIGHT_GRIP, GRIP_POINT_RIGHT, RIGHT_ELBOW_POLE],
    ] as const) {
      body.localToWorld(target.copy(grip));
      solveTwoBone(arm, foreArm, hand, target, pole.copy(elbowPole).applyQuaternion(tmp.q));
      body.localToWorld(target.copy(gripPoint));
      hand.getWorldPosition(dir);
      aimBone(hand, middle, dir.subVectors(target, dir).normalize());
    }
    for (const [bone, sign, curl] of fingers) {
      bone.quaternion.multiply(_q.setFromAxisAngle(FINGER_CURL_AXIS, sign * curl));
    }

    // Body axis for the cursor hit test
    body.localToWorld(bodyA.copy(LEFT_ANKLE));
    bones.HeadTop_End.getWorldPosition(bodyB);
  });

  return (
    <>
      {/* Night city: cool sky from behind, warm street glow from below */}
      <hemisphereLight args={["#8fa8ff", "#ffb070", 0.6]} />
      <directionalLight position={[-3, -2, 5]} intensity={1.4} color="#ffd2a1" />
      <directionalLight position={[2, 3, -4]} intensity={2.2} color="#9fc0ff" />

      <group ref={pivotRef} position={[0, PIVOT_Y, 0]}>
        <group ref={twistRef}>
          {/* Web from the anchor to the ankles: fixed width in pixels, so it doesn't
              vanish when the camera pulls back. Points are rewritten every frame. */}
          <Line
            ref={webRef}
            points={[
              [0, 0, 0],
              [0, -ROPE_LENGTH, 0],
            ]}
            lineWidth={1.5}
            color="#e8eef8"
            transparent
            opacity={0.85}
          />
          {/* Upside down: the model's soles sit at its origin */}
          <group ref={bodyRef} position={[0, -ROPE_LENGTH, 0]} rotation={[0, 0, Math.PI]} scale={MODEL_SCALE}>
            <primitive object={scene} />
            {/* Wrap around the ankles and the web running down to the hands */}
            <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.07, 0.016, 6, 20]} />
              <meshBasicMaterial color="#e8eef8" transparent opacity={0.85} />
            </mesh>
            <Line points={BODY_WEB} lineWidth={1.5} color="#e8eef8" transparent opacity={0.85} />
          </group>
        </group>
      </group>
    </>
  );
}

useGLTF.preload(MODEL_SRC);
