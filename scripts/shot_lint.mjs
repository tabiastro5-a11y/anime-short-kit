// Shot lint (src/lib/shotLint.tsx): checks every cut of a video before stills are rendered.
// usage: node scripts/shot_lint.mjs <LintComposition> [report.md]      e.g. node scripts/shot_lint.mjs UpsideLint out/upside/check/lint.md
// Exit code 1 when it finds something. One page load, no pictures (the scene is only posed and ray-tested).
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
import { renderStill, selectComposition } from "@remotion/renderer";
import os from "node:os";
import path from "node:path";
const [comp, report] = process.argv.slice(2);
if (!comp) { console.log("usage: node scripts/shot_lint.mjs <LintComposition> [report.md]"); process.exit(2); }
const win = process.platform === "win32";
const browserExecutable = win ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : null;
const chromiumOptions = { gl: process.env.RENDER_GL || (win ? "angle" : "vulkan") };
const chromeMode = process.env.RENDER_CHROME_MODE || "headless-shell";
const { heavyLock, cachedBundle } = await import("./heavy.mjs");
await heavyLock(`lint ${comp}`);
const serveUrl = await cachedBundle(process.env.BRIDGE_ENTRY || "src/index.ts");
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable, chromiumOptions, chromeMode, inputProps: {} });
let result = null;
const t0 = Date.now();
await renderStill({ composition, serveUrl, frame: 0, output: path.join(os.tmpdir(), `lint_${comp}.jpg`), imageFormat: "jpeg", scale: 0.25, inputProps: {},
  browserExecutable, chromiumOptions, chromeMode, timeoutInMilliseconds: 600000,
  onBrowserLog: (l) => { if (l.text.startsWith("[lint] ")) result = JSON.parse(l.text.slice(7)); else if (l.type === "error") console.log("[error]", l.text.slice(0, 300)); } });
if (!result) { console.log("lint: no result from the page"); process.exit(2); }
const KIND = { facing: "向き（人物）", vehicle: "向き（乗り物）", stray: "映り込み", hole: "抜け" };
const lines = [`# ${result.name} の点検（${result.shots} カット、${((Date.now() - t0) / 1000).toFixed(0)} 秒）`, "",
  result.issues.length ? `見つかったこと：${result.issues.length} 件` : "見つかったこと：なし", "",
  ...result.issues.map((i) => `- カット ${i.shot}（f${i.frame}）〔${KIND[i.kind] ?? i.kind}〕${i.text}`)];
console.log(lines.join("\n"));
if (report) { fs.mkdirSync(path.dirname(report), { recursive: true }); fs.writeFileSync(report, lines.join("\n") + "\n", "utf8"); }
process.exit(result.issues.length ? 1 : 0);
