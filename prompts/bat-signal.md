# Промпт: сайт «Bat-Signal / GOTHAM»

> **Как пользоваться.** Создай пустую папку, открой её в Claude Code, Cursor, Codex или другом AI-агенте, который умеет запускать команды в терминале. Скопируй **всё, что ниже линии**, и отправь одним сообщением. Агент сам создаст проект, скачает видео и шрифт, разложит файлы и запустит сайт.
>
> Ассеты (2 видео, логотип, шрифт) скачиваются по адресу из переменной `ASSETS_BASE_URL` в шаге 2. Если файлы переедут в другое место, поменяй только эту строку.

---

Ты опытный фронтенд-разработчик. Собери с нуля и запусти локально интерактивный одностраничный сайт «Bat-Signal / GOTHAM». Ниже есть всё необходимое: команды, ссылки на ассеты и **полный исходный код каждого файла**. Работай по шагам, ничего не пропускай и в конце проверь результат по чек-листу.

## Что должно получиться

Полноэкранная страница на чёрном фоне. Видео ночного готического города, над ним тучи.

- **Лоадер.** Пока грузятся видео, по центру на чёрном фоне летает по петле и вращается белый бэтаранг (силуэт летучей мыши). Когда видео готово, лоадер плавно растворяется и проявляется сцена (1,5 с).
- **Прожектор.** На дальней башне горит «горячая» линза прожектора. От неё идёт объёмный световой конус (луч в тумане), который упирается в световое пятно. Пятно **следует за курсором с инерцией**, как тяжёлая поворотная голова прожектора. До первого движения мыши оно смотрит в левую верхнюю часть неба.
- **Пятно.** Внутри пятна видна та же сцена, но **освещённая**: это второе видео того же кадра, «днём под прожектором», показанное через мягкую эллиптическую маску. Пятно растягивается вдоль луча, чем дальше от прожектора, тем сильнее. В пятне лежит размытая тень логотипа летучей мыши, как трафарет на линзе. Лампа слегка мерцает.
- **Клик** по сцене выключает или включает лампу. Включение имитирует дуговую лампу: несколько вспышек, затем прогрев 0,6 с. Выключение быстрое (0,2 с), но линза остывает и светится ещё около секунды.
- **Светящаяся краска.** По небу крупно написано **GOTHAM** (шрифт Cinzel), справа столбиком мелко **YUNKOV** (шрифт Williwaw). Надписи **невидимы**, пока по ним не пройдёт луч. Где прошло пятно, буквы раскаляются добела, держат свет 2,5 с и гаснут за 1,5 с. До первого движения мыши надписи не светятся.
- **Шапка.** По центру ссылки Gotham / Arsenal / Allies / Signal (мелкий капс с разрядкой, появляются по очереди). Справа кнопка-бургер из двух линий, которая превращается в крестик. Слева **скрытый** логотип-летучая мышь: он появляется со вспышкой, только когда луч его «нашёл», и дальше остаётся видимым.
- **Меню.** Бургер открывает полноэкранное меню на размытом тёмном фоне, ссылки выезжают по очереди. Закрывается по клику или клавишей Esc.
- **Подсказка.** В правом нижнем углу иконка мыши, у которой «нажимается» левая кнопка: намёк, что сцену можно кликнуть. Показывается только на устройствах с мышью.
- Всё рисуется на одном `<canvas>` 2D (без WebGL и Three.js), с учётом Retina (devicePixelRatio, но не больше 2).

## Стек (версии важны)

- **Next.js 16.3.8** (App Router, Turbopack), **React 19.2.8**, **TypeScript**, **Tailwind CSS v4**.
- Никаких дополнительных npm-пакетов не нужно.
- Node.js **20.9 или новее** (проверь `node -v`; если старее, попроси пользователя обновить Node).

> ⚠️ **Важно для агента.** Next.js 16 отличается от того, что ты помнишь по обучению. В проекте после создания появится `AGENTS.md` с этим предупреждением. **Не «улучшай» и не переписывай код ниже.** Копируй файлы **дословно**, символ в символ: код проверен, он собирается (`tsc`, `eslint`, `next build` без ошибок) и работает. Если что-то не так, сначала смотри раздел «Если что-то не работает», а не переписывай логику. Если всё же нужно что-то поменять в API Next.js, сверяйся с документацией в `node_modules/next/dist/docs/`.

## Шаг 1. Создать проект

Выполни в текущей (пустой) папке:

```bash
npx --yes create-next-app@16.3.8 bat-signal --yes
cd bat-signal
```

Флаг `--yes` принимает настройки по умолчанию: TypeScript, Tailwind, ESLint, App Router, Turbopack, алиас `@/*`, без `src/`. В результате появятся `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts` и т. д.

**Все дальнейшие команды и пути указаны относительно папки `bat-signal`.**

Удали лишние картинки из шаблона, они не нужны:

```bash
rm -f public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

## Шаг 2. Скачать ассеты

```bash
# Откуда качать. Если ассеты переехали, поменяй только эту строку
# (структура папок на сервере должна остаться такой же: public/images/... и app/fonts/...)
ASSETS_BASE_URL="https://raw.githubusercontent.com/hasot/3-labs/main"

mkdir -p public/images app/fonts
curl -fL "$ASSETS_BASE_URL/public/images/base.mp4"      -o public/images/base.mp4
curl -fL "$ASSETS_BASE_URL/public/images/light-new.mp4" -o public/images/light-new.mp4
curl -fL "$ASSETS_BASE_URL/public/images/bat-logo.svg"  -o public/images/bat-logo.svg
curl -fL "$ASSETS_BASE_URL/app/fonts/Williwaw-Book.woff2" -o app/fonts/Williwaw-Book.woff2
curl -fL "$ASSETS_BASE_URL/app/fonts/Williwaw-OFL.txt"    -o app/fonts/Williwaw-OFL.txt

ls -l public/images app/fonts
```

Проверь размеры файлов: если какой-то весит пару сотен байт, вместо файла скачалась страница с ошибкой.

| Файл | Что это | Примерный размер |
|---|---|---|
| `public/images/base.mp4` | ночной город, 3840×2160, зациклено | ~17,7 МБ |
| `public/images/light-new.mp4` | **тот же кадр**, освещённый прожектором | ~9,8 МБ |
| `public/images/bat-logo.svg` | силуэт летучей мыши, чёрный на прозрачном | ~3 КБ |
| `app/fonts/Williwaw-Book.woff2` | шрифт Williwaw (Stephen T. French, SIL OFL) | десятки КБ |
| `app/fonts/Williwaw-OFL.txt` | лицензия шрифта | ~4 КБ |

Если `bat-logo.svg` не скачался, создай его вручную из содержимого в разделе «Запасной вариант: bat-logo.svg» в конце.

Если не скачался шрифт Williwaw, в `app/layout.tsx` замени `localFont(...)` для Williwaw на любой шрифт из `next/font/google` (например, `Cinzel_Decorative`) с тем же `variable: "--font-williwaw"`. Остальной код менять не нужно.

## Шаг 3. Файлы проекта

Создай или перезапиши файлы **ровно с этим содержимым**. Финальная структура:

```
bat-signal/
├─ app/
│  ├─ fonts/
│  │  ├─ Williwaw-Book.woff2
│  │  └─ Williwaw-OFL.txt
│  ├─ BatLoader.tsx      ← лоадер-бэтаранг
│  ├─ bat-logo.ts        ← путь к логотипу + CSS-маска силуэта
│  ├─ globals.css        ← Tailwind v4 + шрифты темы + все keyframes
│  ├─ layout.tsx         ← шрифты (Geist, Cinzel, Williwaw), чёрный body
│  └─ page.tsx           ← вся сцена: canvas, луч, пятно, надписи, шапка, меню
├─ public/images/
│  ├─ base.mp4
│  ├─ light-new.mp4
│  └─ bat-logo.svg
└─ next.config.ts        ← опциональный статический экспорт (GitHub Pages)
```

`app/favicon.ico`, `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs` и `package.json` из шаблона **не трогай**.

### `next.config.ts`

```ts
import type { NextConfig } from "next";

// Static export for GitHub Pages / any static host when NEXT_PUBLIC_BASE_PATH is set (e.g. "/my-repo")
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

const nextConfig: NextConfig = basePath
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
```

### `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Cinzel, Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Nav links
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// GOTHAM headline (canvas) and the fullscreen menu
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

// YUNKOV signature (canvas). Williwaw by Stephen T. French, SIL OFL (see app/fonts/Williwaw-OFL.txt)
const williwaw = localFont({
  src: "./fonts/Williwaw-Book.woff2",
  variable: "--font-williwaw",
});

export const metadata: Metadata = {
  title: "Gotham",
  description: "Interactive bat-signal: aim the searchlight with your cursor, click to toggle it",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${cinzel.variable} ${williwaw.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-slate-50">{children}</body>
    </html>
  );
}
```

### `app/globals.css`

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-heading: var(--font-cinzel);
}

@theme {
  --animate-logo-reveal: logo-reveal 1.8s ease-out both;
  --animate-mouse-click: mouse-click 2.4s ease-in-out infinite;

  /* Click hint: the left button flashes as if pressed */
  @keyframes mouse-click {
    0%,
    55%,
    100% {
      opacity: 0;
    }
    62% {
      opacity: 1;
    }
    78% {
      opacity: 0;
    }
  }

  /* Loader batarang: 3s smooth loop through its home point, then a 1s rest when caught */
  --animate-batarang-flight: batarang-flight 4s linear infinite;
  --animate-batarang-spin: batarang-spin 4s infinite;

  /* Points sample the ellipse x = 6.5vw * sin(t), y = -2.75vh * (1 - cos(t)), with t eased
     so it leaves and lands softly. Far end of the loop: smaller and tilted flat, as if
     flying away. */
  @keyframes batarang-flight {
    0% {
      transform: translate(0vw, 0vh) scale(1) rotateX(0deg);
    }
    3.125% {
      transform: translate(0.175vw, -0.001vh) scale(1) rotateX(0.009deg);
    }
    6.25% {
      transform: translate(0.694vw, -0.016vh) scale(0.999) rotateX(0.143deg);
    }
    9.375% {
      transform: translate(1.54vw, -0.078vh) scale(0.996) rotateX(0.711deg);
    }
    12.5% {
      transform: translate(2.656vw, -0.24vh) scale(0.989) rotateX(2.182deg);
    }
    15.625% {
      transform: translate(3.93vw, -0.559vh) scale(0.975) rotateX(5.086deg);
    }
    18.75% {
      transform: translate(5.172vw, -1.084vh) scale(0.951) rotateX(9.858deg);
    }
    21.875% {
      transform: translate(6.124vw, -1.829vh) scale(0.917) rotateX(16.623deg);
    }
    25% {
      transform: translate(6.5vw, -2.75vh) scale(0.875) rotateX(25deg);
    }
    28.125% {
      transform: translate(6.064vw, -3.741vh) scale(0.83) rotateX(34.007deg);
    }
    31.25% {
      transform: translate(4.722vw, -4.64vh) scale(0.789) rotateX(42.181deg);
    }
    34.375% {
      transform: translate(2.591vw, -5.272vh) scale(0.76) rotateX(47.927deg);
    }
    37.5% {
      transform: translate(0vw, -5.5vh) scale(0.75) rotateX(50deg);
    }
    40.625% {
      transform: translate(-2.591vw, -5.272vh) scale(0.76) rotateX(47.927deg);
    }
    43.75% {
      transform: translate(-4.722vw, -4.64vh) scale(0.789) rotateX(42.181deg);
    }
    46.875% {
      transform: translate(-6.064vw, -3.741vh) scale(0.83) rotateX(34.007deg);
    }
    50% {
      transform: translate(-6.5vw, -2.75vh) scale(0.875) rotateX(25deg);
    }
    53.125% {
      transform: translate(-6.124vw, -1.829vh) scale(0.917) rotateX(16.623deg);
    }
    56.25% {
      transform: translate(-5.172vw, -1.084vh) scale(0.951) rotateX(9.858deg);
    }
    59.375% {
      transform: translate(-3.93vw, -0.559vh) scale(0.975) rotateX(5.086deg);
    }
    62.5% {
      transform: translate(-2.656vw, -0.24vh) scale(0.989) rotateX(2.182deg);
    }
    65.625% {
      transform: translate(-1.54vw, -0.078vh) scale(0.996) rotateX(0.711deg);
    }
    68.75% {
      transform: translate(-0.694vw, -0.016vh) scale(0.999) rotateX(0.143deg);
    }
    71.875% {
      transform: translate(-0.175vw, -0.001vh) scale(1) rotateX(0.009deg);
    }
    75%,
    100% {
      transform: translate(0vw, 0vh) scale(1) rotateX(0deg);
    }
  }

  @keyframes batarang-spin {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.37, 0, 0.63, 1);
    }
    75%,
    100% {
      transform: rotate(2160deg);
    }
  }

  /* Caught by the beam: flares up, then settles with a faint afterglow */
  @keyframes logo-reveal {
    0% {
      opacity: 0;
      filter: drop-shadow(0 0 0 rgb(225 235 255 / 0)) brightness(1);
    }
    30% {
      opacity: 1;
      filter: drop-shadow(0 0 14px rgb(225 235 255 / 0.9)) brightness(1.8);
    }
    100% {
      opacity: 1;
      filter: drop-shadow(0 0 4px rgb(225 235 255 / 0.3)) brightness(1);
    }
  }
}

body {
  background: #000;
}
```

### `app/bat-logo.ts`

```ts
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
```

### `app/BatLoader.tsx`

```tsx
import { batMaskStyle } from "./bat-logo";

// White batarang on black, thrown on a loop and caught, then resting a beat. Dissolves once `visible` turns false.
export function BatLoader({ visible }: { visible: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-hidden={!visible}
      className={`absolute inset-0 z-40 flex items-center justify-center bg-black transition-opacity duration-700 ease-out ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Flight path outside, spin inside, so the batarang spins in its tilted plane */}
      <span className="block motion-safe:animate-batarang-flight">
        {/* Glow on the wrapper: a mask would clip a filter on the masked element */}
        <span
          className="block motion-safe:animate-batarang-spin"
          style={{
            filter:
              "drop-shadow(0 0 5px rgb(255 255 255 / 0.85)) drop-shadow(0 0 18px rgb(225 235 255 / 0.35))",
          }}
        >
          <span className="block h-7 w-15 bg-white" style={batMaskStyle} />
        </span>
      </span>
    </div>
  );
}
```

### `app/page.tsx`

Главный файл, около 750 строк. Скопируй целиком.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { BAT_LOGO_SRC, BASE_PATH, batMaskStyle } from "./bat-logo";
import { BatLoader } from "./BatLoader";

// Debug: keeps the loader on screen
const HOLD_LOADER = false;

// Light source in the source video, normalized to the video frame (measured on 3840x2160)
const LIGHT_SOURCES = {
  rooftop: { x: 0.93, y: 0.811, r: 0.005 }, // projector on the right rooftop
  tower: { x: 0.5974, y: 0.6102, r: 0.0025 }, // spire tip in the distance
  middle: { x: 0.7349, y: 0.663, r: 0.0025 }, // gothic tower in the middle of the skyline
  deep: { x: 0.7771, y: 0.6079, r: 0.0018 }, // far tower behind the middle one
};
const LENS = LIGHT_SOURCES.deep;

// Cone spread: spot radius grows by this many px per px of distance from the lens
const BEAM_SPREAD = 0.09;
const MIN_SPOT_RADIUS = 66;

// Where the spot points before the cursor moves, of the viewport
const START_AIM = { x: 0.16, y: 0.22 };

// Heavy projector head: the spot follows the cursor with inertia
const FOLLOW = 0.12;

// Beam is soft, so it is rendered at reduced resolution
const BEAM_SCALE = 0.5;

// Aiming close to the lens means the projector faces the viewer: the cone can't
// open wider than this, and the beam fades out as the spot covers the source
const MAX_BEAM_HALF_ANGLE = 0.2; // rad
const BEAM_FADE_NEAR = 0.8; // beam gone when spot center is this many spot radii from the lens
const BEAM_FADE_FAR = 2.5; // full beam from this many spot radii

// Cap for the canvas pixel ratio: 3x screens would cost a lot for no visible gain
const MAX_DPR = 2;

const LIGHT_RGB = "225, 235, 255";

// Stencil on the lens: its silhouette is cast as a shadow inside the spot
const BAT_SIZE = 1.25; // logo width relative to the spot radius
const BAT_SHADOW = 0.35; // how much light the stencil blocks
const BAT_BLUR = 0.03; // edge softness relative to the logo width (projection is never razor-sharp)
const BAT_STENCIL_WIDTH = 512; // resolution of the pre-blurred stencil

// Arc lamp switching (ms): it strikes with a few flashes and warms up,
// goes dark fast on shutdown, while the lens keeps glowing as it cools
const WARM_UP_MS = 600;
const SHUT_DOWN_MS = 200;
const LENS_COOL_MS = 1000;
const STRIKE_FLASHES: [until: number, level: number][] = [
  [70, 1],
  [140, 0.15],
  [190, 0.8],
  [270, 0.3],
];

// Texts in "luminous paint": invisible until the beam sweeps over them. Wherever the spot
// passes, the glyphs glow white-hot, hold the light for a while, then fade out.
// Hero headline across the sky
const HERO_TEXT = "GOTHAM";
const HERO_WIDTH = 0.612; // of the viewport width
const HERO_MAX_HEIGHT = 0.204; // cap on the letter height, of the viewport height
const HERO_CENTER_Y = 0.34; // of the viewport height
const HERO_TRACKING = 0.12; // letter spacing, em
const HERO_WEIGHT = 700;
const HERO_OPACITY = 0.7; // of the glow at full paint
// Signature stacked in a column on the right, in Williwaw
const SIDE_TEXT = "YUNKOV";
const SIDE_WEIGHT = 400;
const SIDE_SIZE = 0.025; // font size, of the viewport height
const SIDE_MAX_SIZE = 0.035; // cap on the font size, of the viewport width (narrow screens)
const SIDE_LINE_HEIGHT = 1.25; // em
const SIDE_CENTER_Y = 0.55; // of the viewport height
const SIDE_OPACITY = 0.3;
const GLOW_HALO_BLUR = 0.08; // of the font size
const GLOW_HALO_STRENGTH = 0.6;
const GLOW_REACH = 0.9; // painted radius, of the spot radius
const GLOW_HOLD_MS = 2500;
const GLOW_FADE_MS = 1500;
const GLOW_MASK_SCALE = 0.5; // the paint mask is soft, so it is kept at reduced resolution

const NAV_LINKS = ["Gotham", "Arsenal", "Allies", "Signal"];

// The nav logo is hidden until the beam finds it; once found it stays
const LOGO_REVEAL_REACH = 0.8; // spot center within this many spot radii of the logo

// Where the beam has been: each mark keeps the glyphs under it lit until it expires
type GlowMark = { x: number; y: number; r: number; t: number };

type Box = { x: number; y: number; w: number; h: number };
// A glyph and its pen position inside the text's box, CSS px
type Glyph = { char: string; x: number; baseline: number };
// One painted text, cropped to its box: prerendered glyphs, the beam's paint mask, their product
type GlowText = {
  box: Box; // incl. halo padding, CSS px
  opacity: number; // of the glow at full paint
  glyphs: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  glow: HTMLCanvasElement;
};

const smoothstep = (v: number) => v * v * (3 - 2 * v);

export default function BatSignalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false); // first video frame drawn: start the intro
  const [logoFound, setLogoFound] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen layers: light video masked by the spot, and the volumetric beam
    const spotCanvas = document.createElement("canvas");
    const spotCtx = spotCanvas.getContext("2d");
    const beamCanvas = document.createElement("canvas");
    const beamCtx = beamCanvas.getContext("2d");
    if (!spotCtx || !beamCtx) return;

    // Layout is in CSS px; the video layers are backed at device resolution so Retina
    // screens get the full video detail instead of an upscaled 1x canvas
    let W = 0;
    let H = 0;
    let dpr = 1;

    // next/font exposes the generated family names through CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const heroFamily = rootStyle.getPropertyValue("--font-cinzel").trim() || "serif";
    const sideFamily = rootStyle.getPropertyValue("--font-williwaw").trim() || "serif";
    const heroFont = (size: number) => `${HERO_WEIGHT} ${size}px ${heroFamily}`;
    const sideFont = (size: number) => `${SIDE_WEIGHT} ${size}px ${sideFamily}`;
    const createGlowText = (opacity = 1): GlowText => ({
      box: { x: 0, y: 0, w: 0, h: 0 },
      opacity,
      glyphs: document.createElement("canvas"),
      mask: document.createElement("canvas"),
      glow: document.createElement("canvas"),
    });
    const hero = createGlowText(HERO_OPACITY);
    const side = createGlowText(SIDE_OPACITY);
    const glowTexts = [hero, side];
    let glowMarks: GlowMark[] = [];

    // Prerenders white glyphs over a blurred halo, on black, so the paint mask can simply
    // be multiplied in. Drawn in device px: shadowBlur ignores transforms.
    const prerender = (
      item: GlowText,
      glyphs: Glyph[],
      size: number,
      font: (size: number) => string,
    ) => {
      const { box } = item;
      item.glyphs.width = item.glow.width = Math.ceil(box.w * dpr);
      item.glyphs.height = item.glow.height = Math.ceil(box.h * dpr);
      item.mask.width = Math.ceil(box.w * GLOW_MASK_SCALE);
      item.mask.height = Math.ceil(box.h * GLOW_MASK_SCALE);
      const c = item.glyphs.getContext("2d");
      if (!c) return;
      const drawGlyphs = (offsetX: number) => {
        for (const g of glyphs) c.fillText(g.char, g.x * dpr + offsetX, g.baseline * dpr);
      };
      c.fillStyle = "#000";
      c.fillRect(0, 0, item.glyphs.width, item.glyphs.height);
      c.font = font(size * dpr);
      c.fillStyle = "#fff";
      // Halo: glyphs off-canvas, only their blurred shadow lands
      c.shadowColor = `rgba(${LIGHT_RGB}, ${GLOW_HALO_STRENGTH})`;
      c.shadowBlur = size * GLOW_HALO_BLUR * dpr;
      c.shadowOffsetX = item.glyphs.width;
      drawGlyphs(-item.glyphs.width);
      c.shadowColor = "transparent";
      drawGlyphs(0);
    };

    // Headline fitted to the sky, centered
    const layoutHero = () => {
      const chars = HERO_TEXT.split("");
      ctx.font = heroFont(100);
      const metrics = chars.map((c) => ctx.measureText(c));
      const word = ctx.measureText(HERO_TEXT);
      const tracking = 100 * HERO_TRACKING;
      const advance = metrics.reduce((sum, m) => sum + m.width, 0) + tracking * (chars.length - 1);
      const inkHeight = word.actualBoundingBoxAscent + word.actualBoundingBoxDescent;
      const k = Math.min((W * HERO_WIDTH) / advance, (H * HERO_MAX_HEIGHT) / inkHeight);
      const size = 100 * k;
      const pad = Math.ceil(size * GLOW_HALO_BLUR * 2.5);

      hero.box.w = advance * k + pad * 2;
      hero.box.h = inkHeight * k + pad * 2;
      hero.box.x = (W - hero.box.w) / 2;
      hero.box.y = H * HERO_CENTER_Y - hero.box.h / 2;

      const baseline = pad + word.actualBoundingBoxAscent * k;
      let x = pad;
      const glyphs = chars.map((char, i) => {
        const g = { char, x, baseline };
        x += (metrics[i].width + tracking) * k;
        return g;
      });
      prerender(hero, glyphs, size, heroFont);
    };

    // Signature stacked letter by letter, aligned with the header's right edge
    const layoutSide = () => {
      const chars = SIDE_TEXT.split("");
      const size = Math.min(H * SIDE_SIZE, W * SIDE_MAX_SIZE);
      ctx.font = sideFont(size);
      const metrics = chars.map((c) => ctx.measureText(c));
      const ascent = ctx.measureText(SIDE_TEXT).actualBoundingBoxAscent;
      const lineHeight = size * SIDE_LINE_HEIGHT;
      const columnW = Math.max(...metrics.map((m) => m.width));
      const columnH = lineHeight * (chars.length - 1) + ascent;
      const pad = Math.ceil(size * GLOW_HALO_BLUR * 2.5);
      const margin = W >= 640 ? 40 : 24; // matches the header padding

      side.box.w = columnW + pad * 2;
      side.box.h = columnH + pad * 2;
      side.box.x = W - margin - columnW - pad;
      side.box.y = H * SIDE_CENTER_Y - side.box.h / 2;

      const glyphs = chars.map((char, i) => ({
        char,
        x: pad + (columnW - metrics[i].width) / 2,
        baseline: pad + ascent + lineHeight * i,
      }));
      prerender(side, glyphs, size, sideFont);
    };

    let logoRect: DOMRect | null = null;
    let logoRevealed = false;
    let sceneShown = false;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = spotCanvas.width = Math.round(W * dpr);
      canvas.height = spotCanvas.height = Math.round(H * dpr);
      beamCanvas.width = Math.ceil(W * BEAM_SCALE);
      beamCanvas.height = Math.ceil(H * BEAM_SCALE);
      // Resizing resets context state
      ctx.imageSmoothingQuality = spotCtx.imageSmoothingQuality = "high";
      layoutHero();
      layoutSide();
      logoRect = logoRef.current?.getBoundingClientRect() ?? null;
    };
    resize();
    let disposed = false;
    // Re-fit once the web font is in, the first layout may have used the fallback
    Promise.all([document.fonts.load(heroFont(100)), document.fonts.load(sideFont(100))])
      .then(() => !disposed && resize())
      .catch(() => {});

    const createVideo = (src: string, label: string) => {
      const video = document.createElement("video");
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.onerror = () => console.error(`${label} video failed to load`);
      video.onloadedmetadata = () => {
        video.play().catch((e) => console.error(`${label} video play error:`, e));
      };
      video.src = src;
      return video;
    };

    const nightVideo = createVideo(`${BASE_PATH}/images/base.mp4`, "Night");
    const lightVideo = createVideo(`${BASE_PATH}/images/light-new.mp4`, "Light");

    // Blurred stencil is rendered once. shadowBlur works in every browser (ctx.filter
    // does not in Safari): the logo is drawn off-canvas and only its blurred shadow lands.
    let batStencil: HTMLCanvasElement | null = null;
    const batLogo = new Image();
    batLogo.onload = () => {
      const w = BAT_STENCIL_WIDTH;
      const h = Math.round((w * batLogo.naturalHeight) / batLogo.naturalWidth);
      const blur = w * BAT_BLUR;
      const pad = Math.ceil(blur * 2);
      const stencil = document.createElement("canvas");
      stencil.width = w + pad * 2;
      stencil.height = h + pad * 2;
      const stencilCtx = stencil.getContext("2d");
      if (!stencilCtx) return;
      stencilCtx.shadowColor = "#000";
      stencilCtx.shadowBlur = blur;
      stencilCtx.shadowOffsetX = stencil.width;
      stencilCtx.drawImage(batLogo, pad - stencil.width, pad, w, h);
      batStencil = stencil;
    };
    batLogo.src = BAT_LOGO_SRC;

    let mouseX = W * START_AIM.x;
    let mouseY = H * START_AIM.y;
    let spotX = mouseX;
    let spotY = mouseY;

    // Texts only take paint once the user aims, so nothing glows at the start position
    let userAimed = false;

    const handlePointerMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      userAimed = true;
    };

    let lightOn = true;
    let power = 1; // lamp output, 0..1
    let lensHeat = 1; // lens glow, cools slower than the lamp
    let switchedOnAt = -Infinity;
    let lastTime = 0;

    const handleClick = () => {
      lightOn = !lightOn;
      if (lightOn) switchedOnAt = performance.now();
    };

    // "object-fit: cover" rect, so the lens position stays tied to the video
    const getCoverRect = () => {
      const vw = lightVideo.videoWidth || 3840;
      const vh = lightVideo.videoHeight || 2160;
      const scale = Math.max(W / vw, H / vh);
      const w = vw * scale;
      const h = vh * scale;
      return { x: (W - w) / 2, y: (H - h) / 2, w, h };
    };

    let rafId = 0;

    const drawFrame = (time: number) => {
      rafId = requestAnimationFrame(drawFrame);
      const dt = Math.min(time - lastTime, 100);
      lastTime = time;
      if (nightVideo.readyState < 2 || lightVideo.readyState < 2) return;
      if (!sceneShown) {
        sceneShown = true;
        setSceneReady(true);
      }

      if (lightOn) {
        power = Math.min(1, power + dt / WARM_UP_MS);
        lensHeat = Math.max(lensHeat, power);
      } else {
        power = Math.max(0, power - dt / SHUT_DOWN_MS);
        lensHeat = Math.max(0, lensHeat - dt / LENS_COOL_MS);
      }
      const sinceOn = time - switchedOnAt;
      const strike = STRIKE_FLASHES.find(([until]) => sinceOn < until)?.[1] ?? 1;
      const light = (1 - (1 - power) ** 3) * strike;
      const lensLight = Math.max(light, lensHeat * lensHeat);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spotCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cover = getCoverRect();

      spotX += (mouseX - spotX) * FOLLOW;
      spotY += (mouseY - spotY) * FOLLOW;

      const lensX = cover.x + LENS.x * cover.w;
      const lensY = cover.y + LENS.y * cover.h;
      const lensR = LENS.r * cover.w;

      const dx = spotX - lensX;
      const dy = spotY - lensY;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const angle = Math.atan2(dy, dx);

      // Spot is the cone cross-section at the target; it stretches along the beam
      // as the hit gets more oblique (farther from the projector)
      const spotR = Math.max(MIN_SPOT_RADIUS, lensR + dist * BEAM_SPREAD);
      const stretch = 1 + 0.3 * Math.min(dist / Math.hypot(W, H), 1);

      // Slight lamp flicker
      const flicker = 0.96 + 0.04 * Math.sin(time * 0.013) * Math.sin(time * 0.0071);

      // Casts the stencil silhouette onto a light layer. The logo stays upright
      // and is skewed by the same oblique stretch as the spot.
      // "destination-out" cuts it out (beam), "source-atop" darkens it in place (spot).
      const castBatShadow = (c: CanvasRenderingContext2D, op: GlobalCompositeOperation) => {
        if (!batStencil) return;
        const k = (spotR * BAT_SIZE) / BAT_STENCIL_WIDTH;
        const w = batStencil.width * k;
        const h = batStencil.height * k;
        c.save();
        c.globalCompositeOperation = op;
        c.globalAlpha = BAT_SHADOW;
        c.translate(spotX, spotY);
        c.rotate(angle);
        c.scale(stretch, 1);
        c.rotate(-angle);
        c.drawImage(batStencil, -w / 2, -h / 2, w, h);
        c.restore();
      };

      // Headline paint: while lit, the spot leaves a mark wherever it touches the headline.
      // A spot resting in place refreshes its last mark instead of piling up new ones.
      if (!logoRevealed && logoRect && light > 0.5) {
        const nearestX = Math.min(Math.max(spotX, logoRect.left), logoRect.right);
        const nearestY = Math.min(Math.max(spotY, logoRect.top), logoRect.bottom);
        if (Math.hypot(spotX - nearestX, spotY - nearestY) < spotR * LOGO_REVEAL_REACH) {
          logoRevealed = true;
          setLogoFound(true);
        }
      }

      const markR = spotR * GLOW_REACH;
      const overlaps = (box: Box, x: number, y: number, r: number) =>
        x + r > box.x && x - r < box.x + box.w && y + r > box.y && y - r < box.y + box.h;
      if (userAimed && light > 0.5 && glowTexts.some((t) => overlaps(t.box, spotX, spotY, markR))) {
        const last = glowMarks[glowMarks.length - 1];
        if (last && Math.hypot(spotX - last.x, spotY - last.y) < markR * 0.1) {
          last.t = time;
          last.r = markR;
        } else {
          glowMarks.push({ x: spotX, y: spotY, r: markR, t: time });
        }
      }
      glowMarks = glowMarks.filter((m) => time - m.t < GLOW_HOLD_MS + GLOW_FADE_MS);

      // Glyphs x paint mask, added on top as light
      const drawGlowText = (item: GlowText) => {
        const { box } = item;
        const marks = glowMarks.filter((m) => overlaps(box, m.x, m.y, m.r));
        if (marks.length === 0) return;
        const maskCtx = item.mask.getContext("2d");
        const glowCtx = item.glow.getContext("2d");
        if (!maskCtx || !glowCtx) return;
        // Grayscale mask, max-combined ("lighten" over opaque black) so overlapping marks
        // don't add up and each one fades on its own schedule
        maskCtx.setTransform(1, 0, 0, 1, 0, 0);
        maskCtx.globalCompositeOperation = "source-over";
        maskCtx.fillStyle = "#000";
        maskCtx.fillRect(0, 0, item.mask.width, item.mask.height);
        maskCtx.setTransform(
          GLOW_MASK_SCALE,
          0,
          0,
          GLOW_MASK_SCALE,
          -box.x * GLOW_MASK_SCALE,
          -box.y * GLOW_MASK_SCALE,
        );
        maskCtx.globalCompositeOperation = "lighten";
        for (const m of marks) {
          const age = time - m.t;
          const level = age < GLOW_HOLD_MS ? 1 : 1 - smoothstep((age - GLOW_HOLD_MS) / GLOW_FADE_MS);
          const v = Math.round(255 * level);
          const g = maskCtx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
          g.addColorStop(0, `rgb(${v},${v},${v})`);
          g.addColorStop(0.55, `rgb(${v},${v},${v})`);
          g.addColorStop(1, "#000");
          maskCtx.fillStyle = g;
          maskCtx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        }

        glowCtx.globalCompositeOperation = "source-over";
        glowCtx.drawImage(item.glyphs, 0, 0);
        glowCtx.globalCompositeOperation = "multiply";
        glowCtx.drawImage(item.mask, 0, 0, item.glow.width, item.glow.height);

        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = item.opacity;
        ctx.drawImage(item.glow, box.x, box.y, box.w, box.h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      };
      const drawGlowTexts = () => glowTexts.forEach(drawGlowText);

      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(nightVideo, cover.x, cover.y, cover.w, cover.h);
      if (lensLight <= 0.001) {
        drawGlowTexts();
        return;
      }

      // 1. Volumetric beam: a cone from the lens to the spot, lit fog in the air
      const halfAngle = Math.min(Math.atan2(spotR - lensR, dist), MAX_BEAM_HALF_ANGLE);
      const apexBack = lensR / Math.tan(halfAngle); // virtual cone apex behind the lens
      const feather = halfAngle * 1.5;
      const span = feather / Math.PI; // 2 * feather as a fraction of a full turn
      const beamLength = dist + spotR * stretch;

      beamCtx.setTransform(1, 0, 0, 1, 0, 0);
      beamCtx.globalCompositeOperation = "source-over";
      beamCtx.clearRect(0, 0, beamCanvas.width, beamCanvas.height);
      beamCtx.setTransform(BEAM_SCALE, 0, 0, BEAM_SCALE, 0, 0);
      beamCtx.translate(lensX, lensY);
      beamCtx.rotate(angle);

      const cone = beamCtx.createConicGradient(-feather, -apexBack, 0);
      cone.addColorStop(0, `rgba(${LIGHT_RGB}, 0)`);
      cone.addColorStop(span * 0.2, `rgba(${LIGHT_RGB}, 0.18)`);
      cone.addColorStop(span * 0.5, `rgba(${LIGHT_RGB}, 0.6)`);
      cone.addColorStop(span * 0.8, `rgba(${LIGHT_RGB}, 0.18)`);
      cone.addColorStop(span, `rgba(${LIGHT_RGB}, 0)`);
      cone.addColorStop(1, `rgba(${LIGHT_RGB}, 0)`);
      const coneHalfWidth = spotR * stretch * 2;
      beamCtx.fillStyle = cone;
      beamCtx.fillRect(0, -coneHalfWidth, beamLength, coneHalfWidth * 2);

      // Fade with distance: brightest at the lens, dimmer where it spreads out
      const fade = beamCtx.createLinearGradient(0, 0, beamLength, 0);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(dist / beamLength, "rgba(0,0,0,0.45)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      beamCtx.globalCompositeOperation = "destination-in";
      beamCtx.fillStyle = fade;
      beamCtx.fillRect(0, -coneHalfWidth, beamLength, coneHalfWidth * 2);

      // Keep the fog at the target from washing out the stencil shadow
      beamCtx.setTransform(BEAM_SCALE, 0, 0, BEAM_SCALE, 0, 0);
      castBatShadow(beamCtx, "destination-out");

      ctx.globalCompositeOperation = "screen";
      const nearT = Math.min(
        Math.max((dist / spotR - BEAM_FADE_NEAR) / (BEAM_FADE_FAR - BEAM_FADE_NEAR), 0),
        1,
      );
      const beamVisibility = nearT * nearT * (3 - 2 * nearT);
      ctx.globalAlpha = flicker * light * beamVisibility;
      ctx.drawImage(beamCanvas, 0, 0, W, H);

      // 2. Spot: reveal the lit video through a soft elliptical mask. Inside the light
      // only the lit layer is shown: any partial transparency would let the night video
      // (animated differently) bleed through as a ghost image.
      spotCtx.globalCompositeOperation = "source-over";
      spotCtx.clearRect(0, 0, W, H);
      spotCtx.save();
      spotCtx.translate(spotX, spotY);
      spotCtx.rotate(angle);
      spotCtx.scale(stretch, 1);
      const mask = spotCtx.createRadialGradient(0, 0, 0, 0, 0, spotR);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(0.7, "rgba(0,0,0,1)");
      mask.addColorStop(0.9, "rgba(0,0,0,0.45)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      spotCtx.fillStyle = mask;
      spotCtx.fillRect(-spotR, -spotR, spotR * 2, spotR * 2);
      spotCtx.restore();
      spotCtx.globalCompositeOperation = "source-in";
      spotCtx.drawImage(lightVideo, cover.x, cover.y, cover.w, cover.h);

      // Spot glow, only where the light actually lands
      spotCtx.save();
      spotCtx.globalCompositeOperation = "source-atop";
      spotCtx.translate(spotX, spotY);
      spotCtx.rotate(angle);
      spotCtx.scale(stretch, 1);
      const glow = spotCtx.createRadialGradient(0, 0, 0, 0, 0, spotR);
      glow.addColorStop(0, `rgba(${LIGHT_RGB}, 0.32)`);
      glow.addColorStop(0.6, `rgba(${LIGHT_RGB}, 0.2)`);
      glow.addColorStop(0.85, `rgba(${LIGHT_RGB}, 0.12)`);
      glow.addColorStop(1, `rgba(${LIGHT_RGB}, 0)`);
      spotCtx.fillStyle = glow;
      spotCtx.fillRect(-spotR, -spotR, spotR * 2, spotR * 2);
      spotCtx.restore();

      // Stencil darkens the lit layer instead of exposing the night one under it
      castBatShadow(spotCtx, "source-atop");

      // No flicker on the spot alpha, for the same ghosting reason
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = light;
      ctx.drawImage(spotCanvas, 0, 0, W, H);

      // Emissive, so it glows over the beam and the spot
      drawGlowTexts();

      // 3. Hot lens
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = flicker * lensLight;
      const lensGlowR = lensR * 7;
      const lensGlow = ctx.createRadialGradient(lensX, lensY, 0, lensX, lensY, lensGlowR);
      lensGlow.addColorStop(0, "rgba(255,255,255,1)");
      lensGlow.addColorStop(0.15, `rgba(${LIGHT_RGB}, 0.75)`);
      lensGlow.addColorStop(0.4, `rgba(${LIGHT_RGB}, 0.18)`);
      lensGlow.addColorStop(1, `rgba(${LIGHT_RGB}, 0)`);
      ctx.fillStyle = lensGlow;
      ctx.fillRect(lensX - lensGlowR, lensY - lensGlowR, lensGlowR * 2, lensGlowR * 2);

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    rafId = requestAnimationFrame(drawFrame);
    window.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("click", handleClick);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("resize", resize);
      for (const video of [nightVideo, lightVideo]) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full cursor-pointer transition-opacity duration-[1500ms] ease-out ${
          sceneReady ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Keeps the nav legible over bright clouds */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/60 to-transparent transition-opacity delay-500 duration-1000 ${
          sceneReady ? "opacity-100" : "opacity-0"
        }`}
      />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        {/* Wrapper carries the glow: a mask would clip a filter on the masked element */}
        <a
          ref={logoRef}
          href="#"
          aria-label="Home"
          tabIndex={logoFound ? 0 : -1}
          className={`group block ${logoFound ? "animate-logo-reveal" : "pointer-events-none opacity-0"}`}
        >
          <span
            className="block h-5 w-11 bg-slate-100/85 transition-colors group-hover:bg-white"
            style={batMaskStyle}
          />
        </a>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex">
          {NAV_LINKS.map((label, i) => (
            // Intro lives on a wrapper so its delay doesn't slow down the hover
            <span
              key={label}
              className={`transition-all duration-700 ease-out ${
                sceneReady ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
              }`}
              style={{ transitionDelay: `${800 + i * 90}ms` }}
            >
              <a
                href={`#${label.toLowerCase()}`}
                className="font-sans text-[11px] uppercase tracking-[0.32em] text-slate-300/70 transition-colors hover:text-white"
              >
                {label}
              </a>
            </span>
          ))}
        </nav>

        <div
          className={`transition-all delay-[1200ms] duration-700 ease-out ${
            sceneReady ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="group relative -mr-2 h-10 w-10 cursor-pointer"
          >
            <span
              className={`absolute left-2 right-2 h-px bg-slate-100/85 transition-all duration-300 group-hover:bg-white ${
                menuOpen ? "top-1/2 rotate-45" : "top-[15px]"
              }`}
            />
            <span
              className={`absolute right-2 h-px bg-slate-100/85 transition-all duration-300 group-hover:bg-white ${
                menuOpen ? "left-2 top-1/2 -rotate-45" : "left-4 top-[24px] group-hover:left-2"
              }`}
            />
          </button>
        </div>
      </header>

      {/* Hint that the scene is clickable (toggles the light). Mouse-only devices;
          clicks pass through to the canvas. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute bottom-6 right-6 z-20 transition-opacity delay-[1500ms] duration-1000 sm:bottom-8 sm:right-10 [@media(pointer:coarse)]:hidden ${
          sceneReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg width="18" height="28" viewBox="0 0 18 28" fill="none" className="text-slate-100/45">
          <rect
            x="0.75"
            y="0.75"
            width="16.5"
            height="26.5"
            rx="8.25"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M9 1v9" stroke="currentColor" strokeWidth="1.5" />
          {/* Left button, "pressed" on a loop */}
          <path
            d="M8.25 1.5A7.5 7.5 0 0 0 1.5 9v1h6.75z"
            fill="currentColor"
            className="motion-safe:animate-mouse-click"
          />
        </svg>
      </div>

      {/* Until the first video frame is ready */}
      <BatLoader visible={HOLD_LOADER || !sceneReady} />

      {/* Fullscreen menu */}
      <div
        className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/75 backdrop-blur-md transition-opacity duration-500 ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      >
        {NAV_LINKS.map((label, i) => (
          <a
            key={label}
            href={`#${label.toLowerCase()}`}
            className={`font-heading text-4xl uppercase tracking-[0.18em] text-slate-200 transition-all duration-500 hover:text-white sm:text-6xl ${
              menuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
            style={{ transitionDelay: menuOpen ? `${150 + i * 70}ms` : "0ms" }}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
```

## Шаг 4. Проверить и запустить

```bash
npx tsc --noEmit      # типы: без ошибок
npx eslint app        # линтер: без ошибок
npx next build        # продакшен-сборка: должна пройти, маршрут "/" помечен как Static
npm run dev           # дев-сервер на http://localhost:3000
```

Открой http://localhost:3000 в Chrome, Safari или Firefox и пройди чек-лист:

- [ ] Сначала на чёрном фоне крутится бэтаранг, потом плавно проявляется ночной город.
- [ ] На дальней башне справа от центра горит яркая точка-линза, от неё идёт луч в небо.
- [ ] Пятно плавно, с инерцией, догоняет курсор. Внутри пятна город освещён, видна размытая тень летучей мыши.
- [ ] Если провести пятном по небу над городом, проявляется светящееся **GOTHAM** и через несколько секунд гаснет. Справа так же проявляется вертикальное **YUNKOV**.
- [ ] Если навести пятно на левый верхний угол, там со вспышкой появляется логотип-мышь и остаётся.
- [ ] Клик по сцене выключает свет. Повторный клик включает его с несколькими вспышками.
- [ ] Бургер справа открывает полноэкранное меню, Esc или клик закрывает его.
- [ ] В правом нижнем углу мигает «кнопка» на иконке мыши.
- [ ] В консоли браузера нет ошибок `Night video failed to load` / `Light video failed to load`.

Если всё сходится, сообщи пользователю адрес http://localhost:3000. Если что-то не так, смотри следующий раздел.

## Если что-то не работает

| Симптом | Причина и что делать |
|---|---|
| Бэтаранг крутится бесконечно | Видео не загрузились. Сцена стартует, только когда **оба** видео отдали первый кадр. Проверь, что `public/images/base.mp4` и `light-new.mp4` на месте и весят мегабайты, а `http://localhost:3000/images/base.mp4` открывается. На медленном интернете первая загрузка (~27 МБ) идёт долго, это нормально. |
| `video failed to load` в консоли | Файл битый или это HTML вместо видео: перекачай. В headless Chromium (Playwright без `channel: "chrome"`) H.264 не поддерживается, проверяй в обычном Chrome или Safari. |
| Надписи GOTHAM / YUNKOV не проявляются | Сначала подвигай мышью: до первого движения краска не наносится, так задумано. Ещё надписи не рисуются при выключенной лампе. |
| Надписи другим шрифтом | Шрифт ещё грузится или не подключён. Проверь, что в `layout.tsx` CSS-переменные `--font-cinzel` и `--font-williwaw` повешены на `<html>`: canvas читает их через `getComputedStyle(document.documentElement)`. |
| Анимации лоадера, логотипа или подсказки не работают | В `globals.css` должен остаться блок `@theme { ... }` с `--animate-*` и `@keyframes`. Классы `animate-batarang-flight`, `animate-logo-reveal` и др. генерирует Tailwind v4 из этих переменных. При включённом в системе «уменьшении движения» лоадер намеренно не анимируется (`motion-safe:`). |
| Ошибка про `LayoutProps` | Это глобальный тип Next 16, его генерирует `next dev` / `next build` (`next typegen`). Запусти один из них, потом `tsc`. |
| Луч выходит не из башни | Координаты линзы (`LIGHT_SOURCES` в `page.tsx`) привязаны к кадру именно этого видео. Если видео другое, см. «Кастомизация». |

## Как это устроено (чтобы правки не ломали сцену)

Каждый кадр (`requestAnimationFrame`) рисуется на главном canvas в таком порядке:

1. **Ночное видео** на весь экран по правилу `object-fit: cover` (`getCoverRect`). Линза задана в долях кадра видео, поэтому при любом размере окна остаётся на башне.
2. **Объёмный луч** рисуется на отдельном canvas в половинном разрешении (`BEAM_SCALE = 0.5`, луч мягкий). Конус сделан `createConicGradient` с вершиной чуть позади линзы и затуханием по длине (`destination-in`). Тень мыши вырезается через `destination-out`. На главный слой ложится режимом `screen`. Когда пятно наведено почти на саму линзу (прожектор смотрит на зрителя), луч плавно исчезает (`BEAM_FADE_NEAR/FAR`).
3. **Пятно**: на отдельном canvas мягкая эллиптическая маска (радиальный градиент, повёрнутый по углу луча и растянутый `stretch`), в неё через `source-in` рисуется **освещённое видео**, сверху подсветка и тень трафарета через `source-atop`. Внутри пятна видно только освещённое видео: полупрозрачность пропустила бы ночное видео, анимированное иначе, и появился бы «призрак». Поэтому мерцание к пятну не применяется.
4. **Светящиеся надписи.** Глифы заранее отрисованы белым с ореолом на чёрном (`prerender`). Пятно оставляет «метки» (`glowMarks`) с временем жизни. Из меток строится серая маска (режим `lighten`, чтобы пересечения не складывались), глифы умножаются на маску (`multiply`) и кладутся на сцену режимом `screen`.
5. **Горячая линза**: радиальное свечение режимом `screen`. Остывает медленнее лампы (`lensHeat`).

Размытие трафарета и ореолов сделано через `shadowBlur` с выносом фигуры за край холста (видна только тень), потому что `ctx.filter` не работает в Safari. Реакт-состояние (`sceneReady`, `logoFound`, `menuOpen`) управляет только DOM-слоем: лоадер, шапка, меню, подсказка. Сама сцена живёт в одном `useEffect` без перерендеров.

## Кастомизация (константы в начале `app/page.tsx`)

- **Тексты**: `HERO_TEXT` (большая надпись), `SIDE_TEXT` (вертикальная подпись), `NAV_LINKS` (пункты шапки и меню).
- **Размеры и положение надписей**: `HERO_WIDTH`, `HERO_MAX_HEIGHT`, `HERO_CENTER_Y`, `SIDE_SIZE`, `SIDE_CENTER_Y`. Яркость: `HERO_OPACITY`, `SIDE_OPACITY`. Как долго держится свет: `GLOW_HOLD_MS`, `GLOW_FADE_MS`.
- **Прожектор**: `FOLLOW` (инерция, меньше значит тяжелее), `BEAM_SPREAD` и `MIN_SPOT_RADIUS` (размер пятна), `START_AIM` (куда смотрит до первого движения мыши), `LIGHT_RGB` (цвет света).
- **Трафарет**: `BAT_SIZE`, `BAT_SHADOW` (насколько темна тень), `BAT_BLUR`.
- **Лампа**: `WARM_UP_MS`, `SHUT_DOWN_MS`, `LENS_COOL_MS`, `STRIKE_FLASHES`.
- **Откуда бьёт луч**: `const LENS = LIGHT_SOURCES.deep;`. Можно выбрать `rooftop` (крыша справа), `tower`, `middle`.
- **Отладка лоадера**: `HOLD_LOADER = true` держит лоадер на экране.

**Свои видео.** Нужны два ролика **одного и того же кадра** (статичная камера, одинаковые разрешение, длительность и движение облаков): ночной (`base.mp4`) и освещённый (`light-new.mp4`). Положи их в `public/images/` под теми же именами. Затем найди в кадре точку, откуда должен бить луч, и запиши её в `LIGHT_SOURCES` в **долях кадра**: `x = px / ширина`, `y = py / высота`, `r` — радиус линзы в долях ширины (примерно 0,002–0,005). Если разрешение не 3840×2160, поправь запасные значения в `getCoverRect` (`|| 3840`, `|| 2160`). Они используются только до загрузки метаданных.

## Опционально: деплой

**Vercel**: просто импортируй репозиторий, настройки по умолчанию подходят.

**GitHub Pages** (статический экспорт; `next.config.ts` уже готов к этому). Создай `.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx next build
        env:
          NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
      - run: touch out/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

В настройках репозитория выбери Settings → Pages → Source: **GitHub Actions**. `NEXT_PUBLIC_BASE_PATH` подставляет префикс `/<имя-репо>` и к страницам, и к путям видео и логотипа (`BASE_PATH` в `bat-logo.ts`).

## Запасной вариант: `bat-logo.svg`

Используй, только если файл не скачался в шаге 2. Сохрани как `public/images/bat-logo.svg`:

```xml
<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
 "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="4000.000000pt" height="1887.000000pt" viewBox="0 0 4000.000000 1887.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,1887.000000) scale(0.100000,-0.100000)"
fill="#000000" stroke="none">
<path d="M21996 18817 c-162 -161 -390 -535 -654 -1069 l-137 -278 -35 0 c-19
0 -289 18 -599 39 -320 22 -571 35 -580 31 -9 -5 -266 -25 -571 -44 -305 -20
-570 -38 -588 -41 l-34 -4 -97 202 c-289 599 -561 1039 -729 1179 -51 43 -91
17 -141 -92 -96 -207 -191 -746 -271 -1535 -27 -265 -28 -322 -11 -635 41
-742 -90 -1577 -356 -2254 -19 -50 -71 -163 -114 -251 -375 -770 -873 -1317
-1453 -1599 -589 -286 -1246 -332 -2006 -141 -671 169 -1437 549 -2089 1036
-130 96 -177 150 -283 322 -360 580 -434 1251 -218 1979 222 749 772 1595
1507 2320 156 154 159 157 146 182 -16 31 -17 31 -112 5 -1607 -444 -3151
-960 -4491 -1502 -3256 -1316 -5597 -2884 -6900 -4622 -660 -881 -1040 -1776
-1134 -2675 -9 -85 -22 -191 -27 -235 -18 -130 -23 -495 -10 -665 46 -602 199
-1196 465 -1805 78 -177 275 -560 376 -730 572 -962 1386 -1855 2441 -2677
1424 -1109 3262 -2076 5509 -2898 351 -129 1025 -360 1047 -360 8 0 33 42 33
55 0 2 -48 55 -107 117 -662 700 -1302 1590 -1694 2353 -322 628 -491 1140
-560 1700 -21 164 -16 505 10 670 61 404 212 755 459 1069 71 91 339 358 419
418 108 80 297 146 539 189 112 20 163 23 389 23 277 0 392 -11 645 -60 1137
-223 2497 -1005 3912 -2251 l117 -102 47 87 c351 644 798 1158 1171 1346 132
66 214 88 368 98 77 5 168 11 203 14 115 10 309 -45 472 -134 874 -477 1963
-1998 3126 -4367 159 -325 389 -810 514 -1088 l53 -118 31 7 c39 8 36 4 76 94
83 188 322 695 469 998 1324 2727 2569 4373 3484 4604 63 16 98 19 170 14 51
-3 142 -7 202 -10 186 -7 363 -75 559 -213 99 -71 385 -353 488 -484 168 -210
349 -483 479 -719 33 -60 63 -110 66 -110 3 0 56 45 118 100 63 55 213 183
335 284 1449 1209 2804 1905 3924 2015 162 16 464 14 608 -5 272 -35 513 -117
637 -217 352 -285 619 -657 754 -1052 83 -243 114 -422 124 -700 16 -498 -100
-1025 -365 -1650 -367 -866 -1067 -1894 -1901 -2790 -61 -66 -111 -122 -111
-125 0 -3 8 -15 18 -28 l17 -22 250 84 c1705 573 3181 1218 4455 1946 969 554
1785 1132 2525 1791 326 289 784 767 1060 1104 884 1080 1406 2222 1541 3375
21 180 29 574 16 720 -43 457 -79 698 -144 954 -305 1223 -1134 2431 -2433
3550 -2097 1805 -5426 3367 -9780 4591 -148 41 -277 78 -285 80 -10 3 -22 -6
-33 -24 l-17 -29 118 -110 c270 -253 663 -702 899 -1027 713 -982 989 -1874
809 -2610 -88 -360 -254 -646 -553 -955 -590 -609 -1329 -1110 -1998 -1354
-202 -74 -454 -136 -675 -167 -142 -20 -488 -17 -630 5 -431 67 -805 236
-1170 529 -120 97 -397 381 -514 527 -205 257 -418 596 -600 955 -122 238
-172 356 -246 571 -216 632 -321 1375 -290 2056 6 128 13 253 16 278 9 71 -56
682 -117 1100 -37 253 -99 567 -135 680 -46 148 -104 240 -151 240 -8 0 -38
-24 -67 -53z"/>
</g>
</svg>
```
