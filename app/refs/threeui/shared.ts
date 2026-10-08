import type { Lang } from "../i18n";
import type { ReadyShaderCategory } from "@/vendor/threeui/catalog";

export const CATEGORY_LABELS: Record<ReadyShaderCategory, { ru: string; en: string }> = {
  "Landing Pages": { ru: "Лендинги", en: "Landing pages" },
  Hero: { ru: "Первые экраны", en: "Hero" },
  "Three.js": { ru: "Three.js", en: "Three.js" },
  "Motion Design": { ru: "Моушн", en: "Motion design" },
  Sections: { ru: "Секции", en: "Sections" },
  Backgrounds: { ru: "Фоны", en: "Backgrounds" },
  Buttons: { ru: "Кнопки", en: "Buttons" },
  "Text Animation": { ru: "Анимация текста", en: "Text animation" },
  "UI Elements": { ru: "UI-элементы", en: "UI elements" },
  CSS: { ru: "CSS", en: "CSS" },
};

export const categoryLabel = (lang: Lang, category: ReadyShaderCategory) => CATEGORY_LABELS[category][lang];

/** Upstream paths in the catalog → where the files live in this repo */
export function localSourcePath(path: string) {
  return path.replace(/^src\/shaders\//, "vendor/threeui/shaders/").replace(/^public\//, "public/threeui/");
}
