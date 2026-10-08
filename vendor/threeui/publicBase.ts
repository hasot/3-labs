/** 3-labs patch: ThreeUI loads its full-page scenes from root-relative URLs; here they live under public/threeui and respect the GitHub Pages basePath */
export const THREEUI_PUBLIC = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/threeui`;
