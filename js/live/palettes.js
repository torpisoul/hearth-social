export const palettes = [
  ["hearth", "Hearth", "Warm paper and sage", "#e9e5d9", "#ced9bf", "#dfcfb9"],
  ["meadow", "Meadow", "Fresh greens and soft blossom", "#e1e8d9", "#c4d5b6", "#dfc8d0"],
  ["shore", "Shore", "Sea glass and pale sand", "#dce8e6", "#bcd5d0", "#dfd0b9"],
  ["autumn", "Autumn", "Clay, oat and fallen leaves", "#e9ddd0", "#dcc2a9", "#d3c29f"],
  ["mountain", "Mountain", "Mist, stone and pine", "#dfe4dc", "#bfcfc1", "#d1cbbb"],
  ["twilight", "Twilight", "Lavender and the evening sky", "#e4ddec", "#cbbbd9", "#d9c4d2"],
];
const key = "hearth-colour-palette";
export function savedPalette() {
  try { const value = localStorage.getItem(key); return palettes.some(p => p[0] === value) ? value : "hearth"; }
  catch { return "hearth"; }
}
export function applyPalette(value) {
  const palette = palettes.find(p => p[0] === value) || palettes[0];
  document.documentElement?.setAttribute("data-palette", palette[0]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palette[3]);
  return palette[0];
}
export function rememberPalette(value) {
  const selected = applyPalette(value);
  try { localStorage.setItem(key, selected); return true; } catch { return false; }
}
