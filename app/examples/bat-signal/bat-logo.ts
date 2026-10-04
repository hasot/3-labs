import type { CSSProperties } from "react";

// Prefix for public assets when the site is served from a subpath (GitHub Pages)
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const BAT_LOGO_SRC = `${BASE_PATH}/images/bat-logo.svg`;

// Paints an element's background in the bat silhouette, so the color comes from CSS
const batMask = `url(${BAT_LOGO_SRC})`;
export const batMaskStyle: CSSProperties = {
  maskImage: batMask,
  WebkitMaskImage: batMask,
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
};
