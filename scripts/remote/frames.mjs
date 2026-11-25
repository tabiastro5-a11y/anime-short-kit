// prints a composition's durationInFrames (used by par-render.sh on the rented GPU machine)
//   node scripts/remote/frames.mjs <Composition>
const { selectComposition } = await import("@remotion/renderer");
const { cachedBundle } = await import("../heavy.mjs");
const serveUrl = await cachedBundle("src/index.ts");
const c = await selectComposition({ serveUrl, id: process.argv[2], chromiumOptions: { gl: process.env.RENDER_GL || "vulkan" },
  chromeMode: process.env.RENDER_CHROME_MODE || "headless-shell" });
console.log(c.durationInFrames);
