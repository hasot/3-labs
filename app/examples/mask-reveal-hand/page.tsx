import { MaskReveal } from "../mask-reveal/MaskReveal";

// Same scene, but the webcam reads the visitor's hand instead of the mouse
export default function MaskRevealHandPage() {
  return <MaskReveal input="hand" />;
}
