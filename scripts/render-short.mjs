// Final render of a short, robust and fast (the studio's replacement for a bare `npx remotion render`):
//   node scripts/render-short.mjs <Composition> <out.mp4> [--audio mix.wav] [--chunk 240] [--concurrency N]
//        [--frames a-b] [--flash 112,113] [--scale 1] [--props '{"k":v}']
// What it fixes (measured on 01_inamura, 2026-11-23):
//   * reuses the bundle while sources are unchanged (scripts/heavy.mjs) and keeps ONE browser for all chunks (the chunk-by-chunk CLI re-bundled + restarted Chrome each time)
//   * watchdog: a chunk with no progress for 90 s is cancelled and retried (a CLI render hung 44 min at frame 0)
//   * WebGL context loss (GPU/system memory) now fails the chunk (src/lib/contextGuard.ts) and every finished chunk is
//     scanned for white/black frames before it is accepted (lost contexts used to write white frames silently)
//   * one tab by default (faster on this PC), lowered to 1 after a crash when more were asked for
//   * waits for any other heavy job (render, stills, QA, sound) to finish first (scripts/heavy.mjs)
//   * finished chunks are kept: re-running the same command resumes where it stopped
//   * joins the chunks, muxes the audio (-map 0:v:0 -map 1:a:0) and prints frames/s per chunk
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
const { renderMedia, selectComposition, openBrowser, makeCancelSignal } = await import("@remotion/renderer");
const { heavyLock, cachedBundle } = await import("./heavy.mjs");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const [compId, outFile] = argv;
if (!compId || !outFile) { console.log("usage: node scripts/render-short.mjs <Composition> <out.mp4> [--audio x.wav] [--chunk 240] [--concurrency N] [--frames a-b] [--flash f,f]"); process.exit(1); }
const CHUNK = Number(opt("chunk", 240));
const scale = Number(opt("scale", 1));
const inputProps = JSON.parse(opt("props", "{}"));
const flash = new Set(String(opt("flash", "")).split(",").filter(Boolean).map(Number));
const GB = 1024 ** 3;
// one tab by default: on this PC (integrated Radeon sharing system memory) two tabs were slower (7.3 -> 6.5 frames/s)
// and ran free memory down to 0 GB (measured 2026-11-23). --concurrency N still overrides.
const autoConc = () => Number(process.env.RENDER_CONC || 1);   // remote GPU boxes: RENDER_CONC=4 (scripts/remote/)
let conc = Number(opt("concurrency", 0)) || autoConc();
const work = outFile.replace(/\.mp4$/, "") + "_chunks";
fs.mkdirSync(work, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const t0 = Date.now();
await heavyLock(`render ${compId}`);
const serveUrl = await cachedBundle("src/index.ts");
log(`bundle ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
// GPU backend: this PC = Vulkan (ANGLE, Radeon 680M). A rented Linux GPU (scripts/remote/) sets RENDER_GL / RENDER_CHROME_MODE
// (Remotion cloud-gpu guide: --gl=vulkan with chrome-for-testing; its Docker guide: angle-egl).
const chromiumOptions = { gl: process.env.RENDER_GL || "vulkan" };
const chromeMode = process.env.RENDER_CHROME_MODE || "headless-shell";
let browser = await openBrowser("chrome", { chromiumOptions, chromeMode });
const composition = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser, chromiumOptions, inputProps });
const [F0, F1] = (opt("frames", `0-${composition.durationInFrames - 1}`)).split("-").map(Number);

/** white / black frames in a finished chunk (planned flash frames excepted) */
const badFrames = (file, a) => {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale=27:48", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 28 });
  const n = 27 * 48, bad = [];
  for (let i = 0; i * n < raw.length; i++) {
    let s = 0; for (let k = i * n; k < (i + 1) * n; k++) s += raw[k];
    const m = s / n;
    if ((m > 250 || m < 3) && !flash.has(a + i)) bad.push(a + i);
  }
  return { bad, frames: raw.length / n };
};

const chunks = [];
for (let a = F0; a <= F1; a += CHUNK) chunks.push([a, Math.min(F1, a + CHUNK - 1)]);
const files = [];
for (const [a, b] of chunks) {
  const file = path.join(work, `c_${String(a).padStart(5, "0")}_${b}.mp4`);
  files.push(file);
  if (fs.existsSync(file)) { log(`chunk ${a}-${b}: kept from an earlier run`); continue; }
  for (let attempt = 1; ; attempt++) {
    const tmp = file + ".part.mp4";
    const { cancelSignal, cancel } = makeCancelSignal();
    let last = Date.now(), done = 0, minFree = os.freemem();
    const dog = setInterval(() => { minFree = Math.min(minFree, os.freemem()); if (Date.now() - last > 90000) { log(`chunk ${a}-${b}: no progress for 90 s, cancelling`); cancel(); } }, 1000);
    const ts = Date.now();
    try {
      await renderMedia({
        composition, serveUrl, inputProps, codec: "h264", crf: 16, outputLocation: tmp, frameRange: [a, b], concurrency: conc, scale,
        puppeteerInstance: browser, chromiumOptions, timeoutInMilliseconds: 120000,
        onBrowserLog: (l) => { if (l.text.startsWith("[pool]")) log(l.text); }, cancelSignal, overwrite: true,
        onProgress: ({ renderedFrames }) => { if (renderedFrames !== done) { done = renderedFrames; last = Date.now(); } },
      });
      clearInterval(dog);
      const { bad, frames } = badFrames(tmp, a);
      if (frames !== b - a + 1 || bad.length) throw new Error(`checked: ${frames} frames, white/black at ${bad.slice(0, 8).join(",")}${bad.length > 8 ? "..." : ""}`);
      fs.renameSync(tmp, file);
      const s = (Date.now() - ts) / 1000;
      log(`chunk ${a}-${b}: ${s.toFixed(0)} s, ${((b - a + 1) / s).toFixed(2)} frames/s (concurrency ${conc}, lowest free memory ${(minFree / GB).toFixed(1)} GB)`);
      break;
    } catch (e) {
      clearInterval(dog);
      fs.rmSync(tmp, { force: true });
      log(`chunk ${a}-${b} attempt ${attempt} failed: ${String(e.message || e).split("\n")[0].slice(0, 200)}`);
      if (attempt >= 5) throw e;
      conc = Math.max(1, conc - 1);
      try { await browser.close({ silent: true }); } catch { /* already gone */ }
      browser = await openBrowser("chrome", { chromiumOptions, chromeMode });
    }
  }
}
await browser.close({ silent: true });

const list = path.join(work, "list.txt");
fs.writeFileSync(list, files.map((f) => `file '${path.resolve(f).replace(/\\/g, "/")}'`).join("\n"));
const video = outFile.replace(/\.mp4$/, "_video.mp4");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", video]);
const audio = opt("audio", "");
if (audio) execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", outFile]);
else fs.copyFileSync(video, outFile);
const total = (Date.now() - t0) / 1000;
log(`done: ${outFile}  ${F1 - F0 + 1} frames in ${total.toFixed(0)} s = ${((F1 - F0 + 1) / total).toFixed(2)} frames/s overall`);
// tidy up (2026-11-24): the soundless copy and the finished chunks are not needed once the film exists
// (they tripled every version's size). --keep-work keeps them (to resume or inspect).
if (!argv.includes("--keep-work")) {
  if (fs.existsSync(outFile) && video !== outFile) fs.rmSync(video, { force: true });
  fs.rmSync(work, { recursive: true, force: true });
}
