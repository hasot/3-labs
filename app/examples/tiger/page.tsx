import { Bagel_Fat_One, Bricolage_Grotesque } from "next/font/google";
import { TigerHero } from "./TigerHero";

// Plump, rounded display face for the name, like the plush cub itself
const bagel = Bagel_Fat_One({
  variable: "--font-bagel",
  subsets: ["latin"],
  weight: "400",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export default function TigerPage() {
  return (
    <div className={`${bagel.variable} ${bricolage.variable}`}>
      <TigerHero />
    </div>
  );
}
