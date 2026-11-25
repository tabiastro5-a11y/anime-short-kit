// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]  (GPU via ANGLE, jpeg)
// COMP=<composition> picks the composition (default BridgeShort). The bundle is reused while sources are unchanged and
// the stills wait for any other heavy job (scripts/heavy.mjs).
// PROPS='{"noCaps":true}' passes inputProps to the composition.
// BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
import fs from "node:fs";
// each bundle copies public/ (~1.3 GB) into the temp dir; C: is full, so keep bundles on D:
// Remotion bundles fill the temp folder (~1.3 GB each): set REMOTION_TMP to a folder on a big drive
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
// this PC: installed Chrome + ANGLE. A rented Linux GPU (scripts/remote/): Remotion's own browser, RENDER_GL / RENDER_CHROME_MODE
const win = process.platform === "win32";
const browserExecutable = win ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : null;
const chromiumOptions = { gl: process.env.RENDER_GL || (win ? "angle" : "vulkan") };
const chromeMode = process.env.RENDER_CHROME_MODE || "headless-shell";
const { heavyLock, cachedBundle } = await import("./heavy.mjs");
await heavyLock(`stills ${process.env.COMP || "BridgeShort"}`);
const serveUrl = await cachedBundle(process.env.BRIDGE_ENTRY || "src/index.ts"); // reused while sources are unchanged
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "BridgeShort", browserExecutable, chromiumOptions, chromeMode, inputProps });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale), inputProps,
    browserExecutable, chromiumOptions, chromeMode, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
