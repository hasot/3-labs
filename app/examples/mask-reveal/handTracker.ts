// Webcam hand tracking with MediaPipe Hand Landmarker. Reports the middle of the
// palm as a point in 0..1 screen space (mirrored, like looking in a mirror), or
// null while no hand is in view.

// Keep in sync with the installed @mediapipe/tasks-vision version
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// The hand rarely reaches the very edge of the camera frame, so this inner part
// of the frame is stretched to cover the whole screen
const REACH = 0.12;

// Landmarks around the palm: wrist and the base of each finger
const PALM = [0, 5, 9, 13, 17];

export type HandPoint = { x: number; y: number } | null;

export async function startHandTracking(
  video: HTMLVideoElement,
  onHand: (point: HandPoint) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  let stopped = false;
  const stopStream = () => stream.getTracks().forEach((t) => t.stop());

  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
    });

    let raf = 0;
    let lastTime = -1;
    const remap = (v: number) => Math.min(1, Math.max(0, (v - REACH) / (1 - 2 * REACH)));
    const tick = () => {
      if (stopped) return;
      // Only run the model when the camera has a new frame
      if (video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        const hand = landmarker.detectForVideo(video, performance.now()).landmarks[0];
        if (hand) {
          let x = 0;
          let y = 0;
          for (const i of PALM) {
            x += hand[i].x;
            y += hand[i].y;
          }
          onHand({ x: remap(1 - x / PALM.length), y: remap(y / PALM.length) });
        } else {
          onHand(null);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      landmarker.close();
      stopStream();
      video.srcObject = null;
    };
  } catch (err) {
    stopStream();
    throw err;
  }
}
