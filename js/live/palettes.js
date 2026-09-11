export const palettes = [
  ["hearth", "Hearth", "Warm paper and sage", "#f6f3eb", "#e3e9db", "#eee2d2"],
  ["meadow", "Meadow", "Fresh greens and soft blossom", "#eef3e9", "#d9e7ce", "#ecdde2"],
  ["shore", "Shore", "Sea glass and pale sand", "#edf3f3", "#d2e5e4", "#eee3d3"],
  ["autumn", "Autumn", "Clay, oat and fallen leaves", "#f4eee7", "#ead9c8", "#e3d6bd"],
  ["mountain", "Mountain", "Mist, stone and pine", "#eef0ed", "#d9e2db", "#e0ddd3"],
  ["twilight", "Twilight", "Lavender and the evening sky", "#f0edf5", "#e0d8ed", "#e8dce4"],
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
