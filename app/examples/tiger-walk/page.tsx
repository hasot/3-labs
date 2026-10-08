import { Archivo } from "next/font/google";
import { TigerWalk } from "./TigerWalk";

// The one family for every line on the page; the width axis gives the wide titles
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
});

export default function TigerWalkPage() {
  return (
    <div className={archivo.className}>
      <TigerWalk />
    </div>
  );
}
