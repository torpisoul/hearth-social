import { mkdir, copyFile, rm, writeFile, readFile } from "node:fs/promises";
import { build } from "esbuild";
const root = new URL("../", import.meta.url);
const config = JSON.parse(
  await readFile(new URL("public-config.json", root), "utf8"),
);
if (
  config.supabasePublishableKey &&
  !config.supabasePublishableKey.startsWith("sb_publishable_")
)
  throw Error("Use a Supabase publishable key, never a secret key.");
if (
  config.supabaseUrl &&
  !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl)
)
  throw Error("Expected a hosted Supabase HTTPS project URL.");
if (Boolean(config.supabaseUrl) !== Boolean(config.supabasePublishableKey))
  throw Error("Set both public Supabase settings.");
// Fail before publishing if an accidental source overwrite corrupts a stylesheet.
for (const file of ["styles/hearth.css", "styles/live.css"]) {
  const css = await readFile(new URL(file, root), "utf8");
  const result = await build({stdin:{contents:css,loader:"css"},write:false,logLevel:"silent"});
  if (result.warnings.length) throw Error(`Invalid stylesheet ${file}: ${result.warnings.map(w=>w.text).join("; ")}`);
}
await rm(new URL("docs", root), { recursive: true, force: true });
for (const file of [
  "index.html",
  "live.html",
  "styles/hearth.css",
  "styles/live.css",
  "public-config.json",
  "manifest.webmanifest",
  "sw.js",
]) {
  const target = new URL("docs/" + file, root);
  await mkdir(new URL(".", target), { recursive: true });
  await copyFile(new URL(file, root), target);
}
await mkdir(new URL("docs/icons/", root), { recursive: true });
for (const file of ["hearth.svg", "hearth-192.png", "hearth-512.png"])
  await copyFile(new URL("icons/" + file, root), new URL("docs/icons/" + file, root));
await build({
  entryPoints: [new URL("js/live/app.js", root).pathname],
  outfile: new URL("docs/js/live-app.js", root).pathname,
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "eof",
});
await writeFile(new URL("docs/.nojekyll", root), "");
// CI verifies that post-deployment tests reached this exact release artifact.
await writeFile(new URL("docs/build-info.json", root), JSON.stringify({commit:process.env.GITHUB_SHA || null}) + "\n");
// Serve the live app at old entrypoints too, preserving auth callback query/hash.
for (const file of [
  "app.html",
  "login.html",
  "onboarding.html",
  "parlor.html",
  "profile.html",
  "reset-password.html",
  "notice-board.html",
])
  await copyFile(new URL("live.html", root), new URL("docs/" + file, root));
console.log("Built Hearth friends beta in docs/");
