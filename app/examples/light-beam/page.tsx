import { Instrument_Serif } from "next/font/google";
import { LightBeam } from "./LightBeam";

// Narrow, cinematic serif for the name, quiet enough to let the light lead
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export default function LightBeamPage() {
  return (
    <div className={instrument.variable}>
      <LightBeam />
    </div>
  );
}
