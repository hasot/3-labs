// Finds the mouth in the webcam frame the hand tracker is already playing, with MediaPipe
// Face Detector. Reports it in the same mirrored 0..1 screen space as the hand, so bringing
// the glass to your own mouth on camera lines up with the glass on screen.

import { REACH } from "../mask-reveal/handTracker";

// Keep in sync with the installed @mediapipe/tasks-vision version
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

// BlazeFace keypoints: right eye, left eye, nose tip, mouth, right ear, left ear
const MOUTH = 3;

export type MouthPoint = { x: number; y: number } | null;

export async function startFaceTracking(
  video: HTMLVideoElement,
  onMouth: (point: MouthPoint) => void,
): Promise<() => void> {
  const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
  });

  let stopped = false;
  let raf = 0;
  let lastTime = -1;
  let frame = 0;
  const remap = (v: number) => Math.min(1, Math.max(0, (v - REACH) / (1 - 2 * REACH)));
  const tick = () => {
    if (stopped) return;
    // The face barely moves next to the hand: every other camera frame is plenty
    if (video.readyState >= 2 && video.currentTime !== lastTime && frame++ % 2 === 0) {
      lastTime = video.currentTime;
      const mouth = detector.detectForVideo(video, performance.now()).detections[0]?.keypoints[MOUTH];
      onMouth(mouth ? { x: remap(1 - mouth.x), y: remap(mouth.y) } : null);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    detector.close();
  };
}
