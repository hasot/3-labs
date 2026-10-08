# ThreeUI Community (vendored)

Source of [MengTo/threeui](https://github.com/MengTo/threeui) at commit `68802d5` (MIT, see `LICENSE` and the other license files here).
Browse it live at `/refs/threeui`.

- `shaders/` — every Community component, unchanged except for asset URLs
- `catalog.tsx` — the original catalog (`src/data/shaders.tsx`): labels, categories, variants, controls, lazy renderers
- `public/threeui/` — full-page HTML scenes and the sketchbook assets the components load

3-labs patches:

- root-relative scene URLs (`/landing-pages/…`, `/sketchbook/`, `/landscape.html`, …) go through `publicBase.ts`, so they respect `NEXT_PUBLIC_BASE_PATH`
- Vite `?raw` imports are served by `raw-loader.cjs` (Turbopack rule in `next.config.ts`)
- `three128` / `three165` are npm aliases in the root `package.json`, as upstream

Catalog thumbnails and preview videos load from threeui.com and are not copied here.
