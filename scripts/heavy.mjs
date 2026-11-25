// Shared by the studio's node tools (render-short.mjs, bridge-stills.mjs):
//  * heavyLock(label): one heavy job at a time on this PC (render, stills, QA, sound). Measured 2026-11-23: a render
//    alone uses ~30 % CPU, but bundling (60-92 %), QA (75-94 %) and sound synthesis on top of it pushed the PC past 90 %
//    and two renders at once were slower than one after the other. Python tools use scripts/heavy_lock.py (same file).
//  * cachedBundle(entry): the Remotion bundle (10-40 s at 60-92 % CPU) is kept in out/.bundle-cache/<hash> and reused
//    while nothing it is built from has changed (sources, imported episode data, public/ files, packages).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { fileURLToPath } from "node:url";
/** always the repo's out/ (not the caller's working directory) */
export const LOCK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out", ".heavy.lock");
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** wait for the heavy-job lock; returns release() (also released on exit) */
export async function heavyLock(label) {
  // rented GPU machines run several renders side by side on purpose (scripts/remote/): HEAVY_LOCK=off
  if (process.env.HEAVY_LOCK === "off") return () => {};
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  let told = false;
  for (;;) {
    try {
      fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, label, since: new Date().toISOString() }), { flag: "wx" });
      const release = () => { try { const o = JSON.parse(fs.readFileSync(LOCK, "utf8")); if (o.pid === process.pid) fs.rmSync(LOCK); } catch { /* gone */ } };
      process.on("exit", release);
      process.on("SIGINT", () => { release(); process.exit(130); });
      return release;
    } catch {
      let o = null; try { o = JSON.parse(fs.readFileSync(LOCK, "utf8")); } catch { /* being written */ }
      if (o && !alive(o.pid)) { try { fs.rmSync(LOCK); } catch { /* raced */ } continue; } // stale lock
      if (!told) { console.log(`waiting for another heavy job to finish (${o?.label ?? "?"} since ${o?.since ?? "?"})`); told = true; }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(p, out); } else out.push(p);
  }
  return out;
};
/** fingerprint of everything a bundle is built from */
const bundleHash = (entry) => {
  const h = crypto.createHash("sha256");
  h.update(path.resolve(entry));
  const contents = [...walk("src"), ...walk("episodes").filter((f) => /[\\/]data[\\/].*\.json$/.test(f)),
    ...["package.json", "package-lock.json", "remotion.config.ts", "tsconfig.json", entry].filter((f) => fs.existsSync(f))];
  for (const f of [...new Set(contents)].sort()) { h.update(f); h.update(fs.readFileSync(f)); }
  for (const f of walk("public").sort()) { const s = fs.statSync(f); h.update(`${f}|${s.size}|${s.mtimeMs}`); } // big files: name, size, time
  return h.digest("hex").slice(0, 16);
};

/** the Remotion serveUrl for `entry`, bundled once and reused until a source changes (keeps the 3 newest) */
export async function cachedBundle(entry = "src/index.ts") {
  const root = path.resolve("out/.bundle-cache"), key = bundleHash(entry), dir = path.join(root, key);
  if (fs.existsSync(path.join(dir, "index.html"))) { console.log(`bundle: reused ${key}`); return dir; }
  const { bundle } = await import("@remotion/bundler");
  const t0 = Date.now();
  fs.rmSync(dir, { recursive: true, force: true });
  const url = await bundle({ entryPoint: path.resolve(entry), publicDir: path.resolve("public"), outDir: dir });
  console.log(`bundle: built ${key} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const old = fs.readdirSync(root).map((n) => path.join(root, n)).filter((p) => p !== dir && fs.statSync(p).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const p of old.slice(2)) fs.rmSync(p, { recursive: true, force: true });
  return url;
}
