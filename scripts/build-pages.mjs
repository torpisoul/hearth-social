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
await rm(new URL("docs", root), { recursive: true, force: true });
for (const file of [
  "index.html",
  "live.html",
  "demo.html",
  "styles/hearth.css",
  "styles/live.css",
  "js/hearth.js",
  "js/hearth-store.js",
  "public-config.json",
]) {
  const target = new URL("docs/" + file, root);
  await mkdir(new URL(".", target), { recursive: true });
  await copyFile(new URL(file, root), target);
}
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
// Serve the live app at old entrypoints too, preserving auth callback query/hash.
for (const file of [
  "app.html",
  "login.html",
  "onboarding.html",
  "parlor.html",
  "profile.html",
  "reset-password.html",
])
  await copyFile(new URL("live.html", root), new URL("docs/" + file, root));
await writeFile(
  new URL("docs/notice-board.html", root),
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./demo.html#gatherings"><title>Hearth gatherings demo</title><a href="./demo.html#gatherings">Explore demo gatherings</a></html>',
);
console.log("Built Hearth friends beta and fictional demo in docs/");
