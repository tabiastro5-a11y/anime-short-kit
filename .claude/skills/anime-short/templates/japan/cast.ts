// 01_inamura cast (studio adaptation of the bridge template cast.ts). Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { getInputProps } from "remotion";
import { Pen, bodyFront, bodySide, fxRing, fxShadow, fxContact, fxSplash, Outfit, Expr, FrontOpts, SideOpts, GORYO, villager, villageKid, laborer, WorkKind, Sym } from "./toon";
import { FPS, V3, SHOTS, STACKS, IGNITE, STEPS_A, STEPS_B, WALL_Z, DIKE_Z, DIKE_H, goryoAt, quakeAt, floodAt, waveAt, dikeAt, dikeY, TAMPERS, STRIKE_AT, clamp01 } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
/** one canvas per distinct drawing. Drawings stay cached after their frame (least recently used are dropped past a
 *  memory budget), so a crowd cycling through the same rounded poses is drawn once, not every frame. */
export class Pool {
  private live = new Map<string, Entry & { used: number }>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  private frame = 0;
  private bytes = 0;
  static BUDGET = 200 * 1024 * 1024; // canvas pixels kept (bytes, RGBA); the GPU keeps a copy of each
  static drawn = 0; static reused = 0; static ms = 0;
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  private evict(want: Map<string, Req[]>) {
    if (this.bytes <= Pool.BUDGET) return;
    const old = [...this.live.entries()].filter(([k]) => !want.has(k)).sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of old) {
      if (this.bytes <= Pool.BUDGET * 0.85) break;
      this.live.delete(k); this.bytes -= e.w * e.h * 4;
      if (this.free.length < 24) this.free.push(e); else e.tex.dispose();
    }
  }
  flush() {
    this.frame++;
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (e) Pool.reused++;
      else {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        const base = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        e = { ...base, used: 0 };
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        const t0 = performance.now();
        r.draw(new Pen(g));
        Pool.ms += performance.now() - t0;
        e.tex.needsUpdate = true;
        this.live.set(key, e); this.bytes += e.w * e.h * 4; Pool.drawn++;
      }
      e.used = this.frame;
      for (const r of rs) r.tex = e.tex;
    }
    this.evict(want);
    this.reqs = [];
    if (this.frame % 25 === 0 && (getInputProps() as { stats?: boolean }).stats) console.log(`[pool] frames ${this.frame} drawn ${Pool.drawn} reused ${Pool.reused} drawMs ${Pool.ms.toFixed(0)} keptMB ${(this.bytes / 1048576).toFixed(0)}`);
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "night" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
/** people at least this far (m) use rounded poses (close-ups keep every in-between) */
export const FAR = 6.5;
/** people at least this far (m) are drawn per type (their drawing is the 240 x 400 tier) */
export const CROWD = 16;
const typeSeed = (okey: string) => { let h = 7; for (const c of okey) h = (h * 31 + c.charCodeAt(0)) % 9973; return (h % 7) + 1; };
const snap = (ph: number, n: number) => (((Math.round(ph * n) / n) % 1) + 1) % 1;
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  let f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  if (d >= CROWD) { // crowd distance: one drawing per TYPE (outfit), shared by everyone of that type: the type's own
    // head shape, eyes open (a blink is under 2 px here), light on 3 directions, side-walk stride in quarter steps
    const L = Math.max(-3, Math.min(-1, Math.round(light / (Math.PI / 4)))) * (Math.PI / 4), sd = typeSeed(who.okey);
    f2 = { ...f2, blink: 0, seed: sd, light: L };
    s2 = { ...s2, blink: 0, seed: sd, light: L, ...(s2.stride !== undefined ? { stride: Math.round(s2.stride * 4) / 4 } : {}) };
  }
  if (d >= FAR) { // past FAR: poses on a fixed set of frames (walk 8 per step cycle, work 10 steps) so they are shared
    f2 = { ...f2, ...(f2.phase !== undefined ? { phase: snap(f2.phase, 8) } : {}), ...(f2.act ? { act: { ...f2.act, k: Math.round(f2.act.k * 10) / 10 } } : {}) };
    s2 = { ...s2, ...(s2.phase !== undefined ? { phase: snap(s2.phase, 8) } : {}) };
  }
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.22, 0.22, 0.4] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

export type Stage = { places: Place[]; fx: FxPlace[] };

// ================= 01_inamura: who is where, shot by shot =================
const GOR: Who = { i: 100, o: GORYO, okey: "goryo" };
const VIL = Array.from({ length: 12 }, (_, v) => villager(v));
const KIDS = [0, 1, 2].map((v) => villageKid(v));
const who = (i: number): Who => ({ i, o: VIL[i % VIL.length], okey: `v${i % VIL.length}` });
const kid = (i: number): Who => ({ i: 50 + i, o: KIDS[i % 3], okey: `k${i % 3}` });
const front = (cam: CamInfo, w: Who, x: number, y: number, z: number, fo: FrontOpts, sc = 1) => person(cam, w, x, y, z, { side: false, mirror: false }, fo, {}, sc);
/** someone walking along (dx, dz) at speed v m/s: side view when seen from the side, stroll gait */
const walker = (cam: CamInfo, w: Who, x: number, y: number, z: number, dx: number, dz: number, t: number, expr: Expr, extra: Partial<FrontOpts> = {}, sideExpr?: Expr) => {
  const view = viewOf(cam, x, z, dx, dz), ph = (t * 1.6 + hh(w.i, 4)) % 1;
  return person(cam, w, x, y, z, view, { phase: ph, mode: "stroll", expr, blink: lidAt(t, w.i), ...extra }, { phase: ph, mode: "march", expr: sideExpr ?? expr, blink: lidAt(t, w.i), stomp: 0.6, stride: 0.55 * view.fs });
};

// ---------------- fire ----------------
/** cartoon flame tongues on a 300 x 420 canvas; v = flicker variant 0..5 */
const flameDraw = (p: Pen, v: number) => {
  const g = p.g;
  const tongue = (cx: number, w: number, h: number, sway: number, col: string, ink: boolean) => {
    g.beginPath(); g.moveTo(cx - w, 400);
    g.bezierCurveTo(cx - w * 1.1, 400 - h * 0.45, cx - w * 0.3 + sway, 400 - h * 0.7, cx + sway * 1.6, 400 - h);
    g.bezierCurveTo(cx + w * 0.4 + sway, 400 - h * 0.62, cx + w * 1.1, 400 - h * 0.4, cx + w, 400);
    g.closePath(); g.fillStyle = col; g.fill();
    if (ink) { g.lineWidth = 9; g.strokeStyle = "#5a1e10"; g.stroke(); }
  };
  const s = (k: number) => Math.sin(v * 1.9 + k * 2.3);
  tongue(150, 120, 330 + 30 * s(0), 30 * s(1), "#e8562a", true);
  tongue(95, 60, 230 + 30 * s(2), 24 * s(3), "#f07a2c", true);
  tongue(205, 62, 250 + 30 * s(4), 24 * s(5), "#f07a2c", true);
  tongue(150, 80, 230 + 25 * s(6), 18 * s(7), "#ffb43a", false);
  tongue(150, 42, 140 + 20 * s(8), 12 * s(9), "#fff0a8", false);
};
/** a burning stack: flame card on top + a few embers; k = 0..1 growth, size = metres */
const fireFx = (out: Stage, x: number, y: number, z: number, t: number, k: number, seed: number, size = 2.2) => {
  if (k <= 0.02) return;
  const v = Math.floor(t * 12 + seed * 3) % 6, s = size * (0.45 + 0.55 * k);
  out.fx.push({ key: `flame${v}`, cw: 300, ch: 420, draw: (p) => flameDraw(p, v), x, y: y + s * 0.62, z, w: s * 0.72, h: s });
  for (let e = 0; e < 3; e++) {
    const u = (t * 0.55 + hh(seed, e)) % 1;
    out.fx.push({ key: "ember", cw: 64, ch: 64, draw: (p) => p.ell(32, 32, 20, 20, "#ffcf5a", 6), x: x + (hh(seed, e + 5) - 0.5) * 1.2 + 0.3 * Math.sin(u * 7 + e), y: y + s * (0.9 + u * 1.4), z, w: 0.09 * (1 - u), h: 0.09 * (1 - u) });
  }
};
/** fire size of stack k at fire time tau (grows 1.2 s after catching; after the long night it is ash) */
export const burnOf = (k: number, tau: number) => (tau > 300 ? -1 : clamp01((tau - IGNITE(k)) / 1.2));

// ---------------- crowds by shot ----------------
const streetFolk = (cam: CamInfo, t: number, out: Stage, q: number) => {
  // dusk street life, then everyone jolts on 「大地震」 and stays frightened
  const hit = t > 15.49 - 2 / FPS;
  const spots: [number, number, number, number][] = [[-8.5, -27.0, 1, 0], [-5.5, -29.2, -1, 1], [-2.6, -27.6, 1, 2], [-0.4, -29.0, 1, 3], [-6.6, -26.6, 0, 4]];
  spots.forEach(([x0, z0, dir, i]) => {
    const w = who(i), ex: Expr = hit ? (i % 2 ? "shock" : "nervous") : (["smile", "grin", "neutral", "smile_closed", "laugh"][i] as Expr);
    if (!hit && dir !== 0) out.places.push(walker(cam, w, x0 + dir * (t - 13.5) * 0.9, 0, z0, dir, 0, t, ex));
    else {
      const x = x0 + (dir !== 0 ? dir * (15.49 - 13.5) * 0.9 : 0), sway = q * 9 * Math.sin(t * 23 + i);
      const sy: Sym[] = hit ? (i % 2 ? ["exclaim", "sweat"] : ["sweat"]) : [];
      out.places.push(front(cam, w, x, 0, z0, { mode: "stand", expr: hit && i % 2 === 0 ? "scared" : ex, tilt: sway, wave: hit && i === 2 ? 0.8 : undefined, sym: sy, symT: ((t - 15.49) * 1.5) % 1, blink: lidAt(t, i) }));
    }
    blob(out, x0, 0, z0);
  });
  const kx = -4.0, kz = -27.4;
  out.places.push(front(cam, kid(0), kx, 0, kz, { mode: "stand", expr: hit ? "shock" : "laugh", tilt: q * 10 * Math.sin(t * 19), sym: hit ? ["exclaim"] : [], blink: lidAt(t, 60) }));
  blob(out, kx, 0, kz, 0.8);
};
const floodFolk = (cam: CamInfo, t: number, out: Stage, level: number) => {
  const spots: [number, number][] = [[-1.0, -28.6], [1.6, -27.4], [3.6, -29.0], [5.8, -27.8], [8.6, -28.8], [0.4, -30.2], [11, -27.6]];
  const ex: Expr[] = ["shock", "nervous", "shock", "pained", "nervous", "shock", "nervous"];
  spots.forEach(([x, z], i) => {
    const bob = 0.05 * Math.sin(t * 2.1 + i), look = Math.sin(t * 0.9 + i * 1.7); // looking around in the dark
    const lost = t > 681 / FPS - LEAD && i % 2 === 0;   // 「どっちが陸かも分からない」
    out.places.push(front(cam, who(i + 3), x, level - 0.95 + bob, z, { mode: "sit", expr: lost ? "scared" : ex[i], look: look > 0.3 ? 1 : look < -0.3 ? -1 : 0, sym: lost ? ["question", "sweat"] : [], symT: (t * 0.8 + i * 0.3) % 1, blink: lidAt(t, i + 3) }));
    const u = ((t + hh(i, 7) * 2) % 2.2) / 2.2;
    out.fx.push({ key: `ring${q(u, 30)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, q(u, 30)), x, y: level + 0.03, z, w: 1.8, h: 1.8, flat: true });
  });
};
/** shot 11: the whole village running for the shrine along the line of burning stacks (a stream, 70 people) */
const evacuees = (cam: CamInfo, t: number, out: Stage, n = 70) => {
  for (let i = 0; i < n; i++) {
    const u = (t * 0.034 + i / n + 0.37 * hh(i, 5)) % 1, side = (hh(i, 3) - 0.5) * 10;
    const x = -22 + 64 * u + side * 0.71, z = -16 + 66 * u - side * 0.7;
    const w = i % 6 === 5 ? kid(i) : who(i), ex: Expr = (["nervous", "shock", "pained", "nervous"] as Expr[])[i % 4];
    out.places.push(walker(cam, w, x, 0, z, 0.7, 0.71, t * 1.45 + hh(i, 7), ex, i % 5 === 1 ? { prop: "bundle" } : {}, "nervous"));
    blob(out, x, 0, z, i % 6 === 5 ? 0.8 : 1);
  }
};
const climbers = (cam: CamInfo, t: number, out: Stage) => {
  const [ax, ay, az] = STEPS_A, [bx, by, bz] = STEPS_B, n = 22;
  for (let i = 0; i < n; i++) {
    const u = ((t - 29.1) * 0.055 + i / n) % 1, lane = [-0.9, 0.9, 0][i % 3];
    const x = ax + (bx - ax) * u + lane * 0.71, y = ay + (by - ay) * u, z = az + (bz - az) * u - lane * 0.71;
    const w = i % 4 === 3 ? kid(i) : who(i);
    out.places.push(walker(cam, w, x, y, z, bx - ax, bz - az, t, i % 3 ? "nervous" : "pained", {}, "nervous"));
  }
};
const hilltop = (cam: CamInfo, t: number, out: Stage) => {
  // they reach the top, turn and look down at the fires: relief
  const spots: [number, number, number][] = [[55.6, 9, 63.2], [56.8, 9, 62.4], [54.6, 9, 61.9], [57.6, 9, 63.8], [55.9, 9, 61.0], [58.2, 9, 62.0]];
  for (let i = 0; i < 16; i++) { // the rest of the village, already up, standing around the top of the steps
    const a = Math.atan2(STEPS_B[2] - 70, STEPS_B[0] - 62) + (hh(i, 11) - 0.5) * 1.3, r = 4.8 + 3.6 * hh(i, 12);
    const x = 62 + Math.cos(a) * r, z = 70 + Math.sin(a) * r;
    if (Math.hypot(x - 60.2, z - 68.2) < 2.2) continue; // not on the lens
    out.places.push(front(cam, i % 5 === 4 ? kid(i) : who(i + 7), x, 9, z, { mode: "stand", expr: (["relief", "nervous", "pained", "relief_open", "neutral"] as Expr[])[i % 5], blink: lidAt(t, 60 + i) }));
    blob(out, x, 9, z, i % 5 === 4 ? 0.8 : 1);
  }
  spots.forEach(([x, y, z], i) => {
    const late = t < 33.67 + i * 0.25;
    out.places.push(front(cam, i === 4 ? kid(1) : who(i + 1), x, y, z, { mode: "stand", expr: late ? "nervous" : (["relief", "relief_open", "smile_closed", "relief", "smile", "relief_open"][i] as Expr), blink: lidAt(t, i + 20) }));
    blob(out, x, y, z, i === 4 ? 0.8 : 1);
  });
};
const morning = (cam: CamInfo, t: number, out: Stage) => {
  const tCross = 1092 / FPS - LEAD, tHere = 1136 / FPS - LEAD;   // 「梧陵が」 arms cross, 「ここからだ」 smirk
  out.places.push(front(cam, GOR, 0, 0, -28, { mode: "stand", expr: t < tCross ? "stern" : t < tHere ? "determined" : "smirk",
    act: { kind: "armsCrossed", k: clamp01((t - tCross) / 0.3) }, blink: lidAt(t, 100) }));
  blob(out, 0, 0, -28);
};
const leaving = (cam: CamInfo, t: number, out: Stage) => {
  for (let i = 0; i < 5; i++) {
    const x = 7 - (t - 38.6) * 1.0 - i * 1.6, z = -28 + (i % 2 ? 0.9 : -0.7);
    out.places.push(walker(cam, i === 2 ? kid(2) : who(i + 6), x, 0, z, -1, 0, t, i % 2 ? "pained" : "empty", { prop: "bundle", sym: i % 2 ? ["sweat"] : [], symT: (t * 0.7 + i * 0.2) % 1 }));
    blob(out, x, 0, z, i === 2 ? 0.8 : 1);
  }
};
const hiring = (cam: CamInfo, t: number, out: Stage) => {
  // I 逆転: on 「自分の財産で」 he presents (offers) his hand; 「村人を雇った」 the villagers cheer
  const tOffer = 1272 / FPS - LEAD, tHire = 1296 / FPS - LEAD;
  out.places.push(front(cam, GOR, -0.6, 0, -28, { mode: "stand", expr: t < tOffer ? "determined" : "smile", act: { kind: "present", k: clamp01((t - tOffer) / 0.25) }, blink: lidAt(t, 100) }));
  blob(out, -0.6, 0, -28);
  const spots: [number, number][] = [[-3.0, -27.6], [-4.2, -28.8], [-2.2, -29.4], [-4.6, -27.4]];
  spots.forEach(([x, z], i) => {
    const ex: Expr = t < tOffer ? (i % 2 ? "pained" : "nervous") : t < tHire ? "shock" : (["relief_open", "laugh", "grin", "relief_open"][i] as Expr);
    const cheer = t > tHire && i % 2 === 0;
    out.places.push(front(cam, who(i + 6), x, 0, z, { mode: "stand", expr: ex, ...(cheer ? { act: { kind: "cheer" as const, k: clamp01((t - tHire - i * 0.05) / 0.2) } } : { prop: "bundle" as const }),
      sym: t > tOffer && t < tHire ? ["question"] : [], symT: (t * 2 + i * 0.3) % 1, blink: lidAt(t, i + 6) }));
    blob(out, x, 0, z);
  });
};
const pointing = (cam: CamInfo, t: number, out: Stage) => {
  const top = 2.0;
  out.places.push(front(cam, GOR, 0.8, top, -51.0, { mode: "stand", expr: "stern", wave: 1, blink: lidAt(t, 100) }));
  blob(out, 0.8, top, -51.0);
  for (const [x, i] of [[3.2, 0], [4.4, 1], [2.0, 2]] as const) { out.places.push(front(cam, who(i + 2), x, 0, -49.2 + i * 0.4, { mode: "stand", expr: "neutral", blink: lidAt(t, i + 2) })); blob(out, x, 0, -49.2 + i * 0.4); }
};
// ---------------- work actions (reusable): timing for toon.ts WORK poses ----------------
const sm = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
/** k for a work pose at time t; period in s, off = phase offset 0..1.
 *  mallet / hoe: lift back up (0-.55), hold raised (.55-.7), strike accelerating (.7-.82, lands at STRIKE_AT), rest
 *  shovel: push in, lift and throw, return; rope: haul up and down; tenbin: walk phase; sapling: lower once and hold */
export const workCycle = (kind: WorkKind, t: number, period: number, off = 0) => {
  const c = (((t / period + off) % 1) + 1) % 1;
  switch (kind) {
    case "mallet": case "hoe":
      return c < 0.55 ? 1 - sm(c / 0.55) : c < 0.7 ? 0 : c < STRIKE_AT ? ((c - 0.7) / (STRIKE_AT - 0.7)) ** 2 : 1;
    case "shovel": return c < 0.35 ? 0 : c < 0.7 ? sm((c - 0.35) / 0.35) : c < 0.8 ? 1 : 1 - sm((c - 0.8) / 0.2);
    case "rope": return 0.5 - 0.5 * Math.cos(c * Math.PI * 2);
    case "sapling": return sm(t / period + off);
    default: return c;
  }
};
/** a dust puff where a mallet / hoe lands (life 0..1 after the strike) */
const dustDraw = (p: Pen, v: number) => {
  for (let i = 0; i < 5; i++) { const a = -Math.PI * (0.1 + 0.2 * i), r = 60 + 40 * v; p.ell(128 + Math.cos(a) * r, 150 + Math.sin(a) * r * 0.6, 34 - 4 * i + 10 * v, 26 - 3 * i + 8 * v, "#c9ad84", 4); }
};
const dustAt = (out: Stage, x: number, y: number, z: number, t: number, period: number, off: number) => {
  const c = (((t / period + off) % 1) + 1) % 1, life = (c - STRIKE_AT) / 0.16;
  if (life < 0 || life > 1) return;
  const v = Math.min(3, Math.floor(life * 4));
  out.fx.push({ key: `dust${v}`, cw: 256, ch: 256, draw: (p) => dustDraw(p, v / 3), x, y: y + 0.35 + 0.25 * life, z, w: 1.5 + life, h: 1.5 + life, soft: true });
};
const LAB = (i: number): Who => ({ i: 200 + i, o: laborer(i), okey: `lab${i % 5}` });
/** shot 18: the embankment crews. Tampers pound the top, carriers bring earth up the land-side slope on shoulder poles,
 *  diggers fill the baskets at the borrow pit */
const dikeWorks = (cam: CamInfo, t: number, out: Stage, h: number) => {
  TAMPERS.forEach(([x, dz, per, off], i) => {
    const z = DIKE_Z + dz;
    out.places.push(front(cam, LAB(i), x, h, z, { mode: "stand", expr: i % 3 ? "grin" : "stern", blink: lidAt(t, 200 + i), act: { kind: "mallet", k: workCycle("mallet", t, per, off) } }));
    blob(out, x, h, z);
    dustAt(out, x + 0.55, h, z + 0.25, t, per, off);
  });
  for (let i = 0; i < 11; i++) {   // carriers: from the pit (z -29) up the slope to the top, walking toward the camera
    const u = (t * 0.16 + i / 11) % 1, x = -10 + ((i * 7.3) % 18) + 0.6 * Math.sin(i), z = -29 - u * 14.6;
    const y = Math.max(0, dikeY(z, h)), ph = (t * 1.7 + i * 0.37) % 1;
    out.places.push(front(cam, LAB(i + 3), x, y, z, { mode: "stroll", phase: ph, expr: i % 4 ? "neutral" : "grin", blink: lidAt(t, 220 + i), act: { kind: "tenbin", k: ph, load: 1 } }));
    blob(out, x, y, z);
  }
  for (let i = 0; i < 5; i++) {   // diggers at the borrow pit
    const x = -9 + i * 3.4, z = -29.5 + (i % 2) * 1.2;
    out.places.push(front(cam, LAB(i + 1), x, 0, z, { mode: "stand", expr: "neutral", blink: lidAt(t, 240 + i), act: { kind: "shovel", k: workCycle("shovel", t, 1.4, i * 0.27) } }));
    blob(out, x, 0, z);
  }
};
const builders = (cam: CamInfo, t: number, out: Stage, h: number) => {
  for (let i = 0; i < 7; i++) {
    const x = ((t * 1.2 + i * 6.5) % 46) - 23, z = DIKE_Z + (i % 2 ? 0.7 : -0.7);
    out.places.push(walker(cam, who(i), x, h, z, 1, 0, t, i % 3 ? "neutral" : "grin", { prop: "basket" }));
  }
};
const planters = (cam: CamInfo, t: number, out: Stage) => {   // shot 19: saplings set into the sea-side slope
  const t0 = 1481 / FPS;
  for (const [x, i, z] of [[-2.6, 0, DIKE_Z - 3.0], [1.2, 1, DIKE_Z - 3.6], [4.8, 2, DIKE_Z - 2.6]] as const) {
    const y = dikeY(z, DIKE_H);
    out.places.push(front(cam, LAB(i + 6), x, y, z, { mode: "stand", expr: i === 1 ? "grin" : "smile", blink: lidAt(t, i + 4), act: { kind: "sapling", k: workCycle("sapling", t - t0, 1.1, -0.15 * i) } }));
    blob(out, x, y, z);
  }
  const z = DIKE_Z - 2.2, y = dikeY(z, DIKE_H);
  out.places.push(front(cam, LAB(9), -6.2, y, z, { mode: "stand", expr: "neutral", blink: lidAt(t, 9), act: { kind: "hoe", k: workCycle("hoe", t, 1.0, 0.3) } }));
  blob(out, -6.2, y, z);
  dustAt(out, -5.6, y, z, t, 1.0, 0.3);
};
const childOnDike = (cam: CamInfo, t: number, out: Stage) => {
  const tWin = 1893 / FPS - LEAD;
  out.places.push(front(cam, kid(1), 0.4, DIKE_H, DIKE_Z, { mode: "stand", expr: t > tWin ? "relief_open" : t > 61.2 ? "grin" : "smile", act: { kind: "cheer", k: clamp01((t - tWin) / 0.2) }, blink: lidAt(t, 61) }, 1));
  blob(out, 0.4, DIKE_H, DIKE_Z, 0.8);
};

/** test only: inputProps { crowd: N } adds N evacuees running from the village to the shrine along the stack line
 *  (to measure what a big crowd costs; never set in a real render) */
const BENCH = Number((getInputProps() as { crowd?: number }).crowd ?? 0);
const benchCrowd = (cam: CamInfo, t: number, out: Stage) => {
  for (let i = 0; i < BENCH; i++) {
    const u = (t * 0.035 + i / BENCH) % 1, side = (hh(i, 3) - 0.5) * 9;
    const x = -16 + 54.5 * u + side * 0.7, z = -10 + 55.5 * u - side * 0.7;
    out.places.push(walker(cam, who(i), x, 0, z, 0.7, 0.71, t * 1.4, i % 3 ? "nervous" : "shock"));
    blob(out, x, 0, z);
  }
};
/** everything with a face (and the flames) in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  const tau = s.fire?.(t);
  if (tau !== undefined && tau !== null) {
    STACKS.forEach(([x, y, z], k) => { const b2 = burnOf(k, tau); if (b2 > 0) fireFx(out, x, y + 1.25, z, t, b2, k + 1, k === 0 && id <= 2 ? 2.4 : 2.2); });
    if (tau > 300) STACKS.forEach(([x, y, z], k) => { // the morning after: a few last embers in the ash
      const u = (t * 0.4 + hh(k, 2)) % 1;
      out.fx.push({ key: "ember", cw: 64, ch: 64, draw: (p) => p.ell(32, 32, 20, 20, "#ff8a3a", 6), x: x + (hh(k, 3) - 0.5) * 0.8, y: y + 0.4 + u * 0.8, z, w: 0.07 * (1 - u), h: 0.07 * (1 - u) });
    });
  }
  // Goryo with the torch (shots 1-4 walk the line; 10 at the first stack)
  if (id <= 4 || id === 10) {
    const ft = id === 4 ? SHOTS[3].fire!(264 / 30)! : tau ?? 0, g = goryoAt(ft), v = Math.floor(t * 12) % 6;
    // reach out with the torch while standing at a stack: out 0.5 s before it catches, back 0.35 s after
    const kk = Math.max(0, Math.min(13, Math.floor((ft + 0.6) / 2.2))), ig = IGNITE(kk);
    const reach = id === 4 ? 0 : ft < ig + 0.15 ? clamp01((ft - (ig - 0.55)) / 0.5) : 1 - clamp01((ft - ig - 0.15) / 0.35);
    const torch = reach > 0.01 ? { act: { kind: "ignite" as const, k: reach, v } } : { prop: ["torch", v] as ["torch", number] };
    const ex: Expr = id === 4 ? (t > 10.52 ? "smirk" : "determined") : "determined";
    const sym: Sym[] = (id === 10 && t > 748 / FPS - LEAD && t < 760 / FPS) ? ["sparkle"] : [];
    if (g.walking && id === 3) out.places.push(walker(cam, GOR, g.p[0], 0, g.p[2], g.dir[0], g.dir[1], t, ex, { prop: ["torch", v] }));
    else out.places.push(front(cam, GOR, g.p[0], 0, g.p[2], { mode: "stand", expr: ex, ...torch, sym, symT: (t * 2) % 1, blink: lidAt(t, 100) }));
    blob(out, g.p[0], 0, g.p[2]);
  }
  benchCrowd(cam, t, out);
  if (id === 5) {
    const tPres = 375 / FPS - LEAD, tKime = 389 / FPS - LEAD;
    const act = t < tKime ? { kind: "present" as const, k: clamp01((t - tPres) / 0.25) } : { kind: "kime" as const, k: clamp01((t - tKime) / 0.2) };
    out.places.push(front(cam, GOR, 4.6, 0, -25.2, { mode: "stand", expr: t < tKime ? "smile" : "proud", act, blink: lidAt(t, 100) }));
    blob(out, 4.6, 0, -25.2);
  }
  if (id === 6 || id === 7) streetFolk(cam, t, out, quakeAt(t));
  if (id === 9) floodFolk(cam, t, out, floodAt(id, t));
  if (id === 11) evacuees(cam, t, out);
  if (id === 12) climbers(cam, t, out);
  if (id === 13) hilltop(cam, t, out);
  if (id === 14) morning(cam, t, out);
  if (id === 15) leaving(cam, t, out);
  if (id === 16) hiring(cam, t, out);
  if (id === 17) pointing(cam, t, out);
  if (id === 18) dikeWorks(cam, t, out, DIKE_H * dikeAt(id, t).built);
  if (id === 19) planters(cam, t, out);
  if (id === 23) childOnDike(cam, t, out);
  // waves breaking: splash crowns along the wall / dike
  const w = waveAt(id, t);
  if (w.show && w.crashed > 0 && w.crashed < 1) {
    const zc = id === 8 ? WALL_Z + 1 : DIKE_Z - 4.5, yc = id === 8 ? 1.6 : 4.5, sc = id === 8 ? 1.4 : 1.8;
    for (const x of [-30, -18, -6, 6, 18, 30]) out.fx.push({ key: `splash${q(w.crashed, 30)}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, q(w.crashed, 30)), x: x + (hh(x, 1) - 0.5) * 4, y: yc + 3.2 * sc, z: zc, w: 9 * sc, h: 9 * sc });
  }
  return out;
};
export { FPS };
