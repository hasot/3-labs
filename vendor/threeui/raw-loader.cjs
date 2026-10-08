// 3-labs: Turbopack stand-in for Vite's `?raw` imports — the file's text as a default-exported string
module.exports = function rawLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};
