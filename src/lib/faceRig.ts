// Face rig for the image characters: the head (hair / hat, no features) and the body are pictures; eyes, brows and mouth
// are drawn here and ANIMATED the way the reference shorts do it (frame-by-frame study, 2026-11-24,
// .claude/skills/anime-short/references/face-rig.md):
//   - EYES switch kind in one cut, always through a blink: 1 f squashed, 2 f closed dashes, 1 f squashed, then the new eye
//     (a little big for 2 f). Ordinary blinks use the same 4 f.
//   - BROWS are separate strokes that slide, turn and bend over ~5 f (with a small overshoot); some eye kinds have none.
//   - The MOUTH is one shape whose width / opening / curve / tilt / place are tweened; while a line is spoken its opening
//     follows the loudness of the voice (closed line -> bar with a teeth strip -> open with tongue), 1-3 f per step.
// Everything is in u = 1 % of the face width W, origin = the point between the eyes, +y down.
export type EyeKind = "lid" | "low" | "dot" | "small" | "ring" | "ringS" | "closed" | "arc" | "arcD" | "squint" | "spiral" | "coin";
export type Brow = { y: number; rot: number; bend: number; a: number };   // y: + = up, rot: + = inner end down (angry), a: 0..1 visible
export type Mouth = { w: number; h: number; c: number; tilt: number; x: number; y: number; box: number; teeth: number; tongue: number; wav: number };
export type Mark = "sweat" | "tears" | "stream" | "vein" | "gloom" | "drool";
export type Pose = { eye: EyeKind | [EyeKind, EyeKind]; look?: [number, number]; brow: [Brow, Brow] | null; mouth: Partial<Mouth>; marks?: Mark[]; big?: number };

const B = (y: number, rot: number, bend = 0): Brow => ({ y, rot, bend, a: 1 });
const NOB: Brow = { y: 0, rot: 0, bend: 0, a: 0 };
const M0: Mouth = { w: 12, h: 0, c: 0, tilt: 0, x: 0, y: 0, box: 0, teeth: 0, tongue: 0, wav: 0 };

/** the expression library: one entry per feeling, usable by any character in any video */
export const POSES: Record<string, Pose> = {
  // --- calm ---
  neutral: { eye: "lid", brow: null, mouth: { w: 7, h: 2.6, box: 1, tilt: -8, x: 3 } },
  deadpan: { eye: "lid", brow: [B(0, 0), B(0, 0)], mouth: { w: 16 } },
  bored: { eye: "low", brow: [B(-3, -4), B(-3, -4)], mouth: { w: 10, c: -1.5 } },
  sleepy: { eye: "closed", brow: [B(-4, -8), B(-4, -8)], mouth: { w: 7, h: 4, box: 1 } },
  blank: { eye: "dot", brow: null, mouth: { w: 8 } },
  // --- happy ---
  smile: { eye: "lid", brow: [B(2, -6, 2), B(2, -6, 2)], mouth: { w: 18, c: 5 } },
  happy: { eye: "arc", brow: [B(4, -8, 3), B(4, -8, 3)], mouth: { w: 20, c: 7 } },
  grin: { eye: "arc", brow: [B(5, -8, 3), B(5, -8, 3)], mouth: { w: 46, h: 5.5, c: 9, teeth: 2 } },
  laugh: { eye: "arc", brow: [B(7, -10, 3), B(7, -10, 3)], mouth: { w: 36, h: 17, c: 7, teeth: 1, tongue: 1 }, big: 1.04 },
  excited: { eye: "ring", brow: [B(8, -6, 3), B(8, -6, 3)], mouth: { w: 50, h: 6.5, c: 10, teeth: 2 }, big: 1.05 },
  greedy: { eye: "coin", brow: [B(8, -4, 3), B(8, -4, 3)], mouth: { w: 44, h: 5.5, c: 9, teeth: 2 }, marks: ["drool"] },
  dreamy: { eye: "low", brow: [B(3, -10, 3), B(3, -10, 3)], mouth: { w: 16, c: 6, x: 2 } },
  relieved: { eye: "arcD", brow: [B(-2, -14, 2), B(-2, -14, 2)], mouth: { w: 9, h: 5, box: 1 }, marks: ["sweat"] },
  moved: { eye: "arc", brow: [B(0, -18, 2), B(0, -18, 2)], mouth: { w: 14, c: 3, wav: 1 }, marks: ["tears"] },
  // --- sly ---
  smug: { eye: "lid", brow: null, mouth: { w: 15, c: 3, tilt: -20, x: 11, y: 3 } },
  smirk: { eye: "lid", brow: [B(0, 6), B(7, -4, 2)], mouth: { w: 15, c: 3, tilt: -20, x: 11, y: 3 } },
  gloat: { eye: ["closed", "lid"], brow: [NOB, B(9, -6, 3)], mouth: { w: 36, h: 5, c: 7, tilt: -4, y: 5, teeth: 2 } },
  sly: { eye: "lid", look: [5, 0], brow: [B(-2, 10), B(4, -2)], mouth: { w: 14, c: 3, tilt: -16, x: 9 } },
  innocent: { eye: "dot", look: [4, -5], brow: [B(7, -4, 3), B(8, -4, 3)], mouth: { w: 5, h: 5, box: 1 } },
  // --- thinking ---
  think: { eye: "dot", look: [3, -5], brow: [B(1, 4), B(8, -8, 2)], mouth: { w: 9, c: -2, x: 5 } },
  suspicious: { eye: ["low", "lid"], look: [5, 0], brow: [B(-3, 12), B(4, 0)], mouth: { w: 12, c: -2 } },
  puzzled: { eye: "dot", brow: [B(1, 2), B(7, -8, 2)], mouth: { w: 6, h: 3, box: 1 } },
  idea: { eye: "ring", brow: [B(9, -4, 3), B(9, -4, 3)], mouth: { w: 10, h: 9, box: 1 } },
  // --- startled / afraid ---
  shock: { eye: "ring", brow: null, mouth: { w: 12, h: 14, box: 1, tongue: 1 }, big: 1.05 },
  caught: { eye: ["ring", "lid"], brow: [B(9, -4, 3), B(-1, 6)], mouth: { w: 18, c: 2, tilt: 8, teeth: 2, h: 6 }, marks: ["sweat"] },
  nervous: { eye: "small", brow: [B(3, -16, 2), B(3, -16, 2)], mouth: { w: 18, wav: 1 }, marks: ["sweat"] },
  panic: { eye: ["ring", "ringS"], brow: [B(8, -14, 2), B(8, -14, 2)], mouth: { w: 18, h: 16, box: 1, wav: 1 }, marks: ["sweat"], big: 1.05 },
  scared: { eye: "ringS", brow: [B(6, -18, 2), B(6, -18, 2)], mouth: { w: 16, wav: 1 }, marks: ["gloom"] },
  frozen: { eye: "ringS", look: [0, 0], brow: null, mouth: { w: 9 }, marks: ["gloom"] },
  // --- angry ---
  annoyed: { eye: "low", brow: [B(-3, 10), B(-3, 10)], mouth: { w: 12, c: -3 } },
  angry: { eye: "lid", brow: [B(-4, 18), B(-4, 18)], mouth: { w: 16, c: -5 } },
  rage: { eye: "low", brow: [B(-7, 28), B(-7, 28)], mouth: { w: 26, h: 12, c: -3, teeth: 2 }, marks: ["vein"], big: 1.04 },
  determined: { eye: "lid", brow: [B(-4, 10), B(-4, 10)], mouth: { w: 14 } },
  // --- sad ---
  sad: { eye: "low", brow: [B(1, -20, 2), B(1, -20, 2)], mouth: { w: 13, c: -5 } },
  tearup: { eye: "low", brow: [B(2, -22, 2), B(2, -22, 2)], mouth: { w: 14, wav: 1, c: -2 }, marks: ["tears"] },
  cry: { eye: "arcD", brow: [B(2, -24, 2), B(2, -24, 2)], mouth: { w: 16, h: 8, c: -5 }, marks: ["stream"] },
  bawl: { eye: "squint", brow: [B(4, -26, 2), B(4, -26, 2)], mouth: { w: 26, h: 24, c: -6, teeth: 1, tongue: 1 }, marks: ["stream"], big: 1.04 },
  despair: { eye: "small", brow: [B(0, -18, 2), B(0, -18, 2)], mouth: { w: 8, c: -2 }, marks: ["gloom"] },
  // --- body ---
  pain: { eye: ["squint", "low"], brow: [B(-2, 14), B(1, -12)], mouth: { w: 22, h: 9, teeth: 2 } },
  dazed: { eye: "spiral", brow: [B(2, -12), B(2, -12)], mouth: { w: 14, wav: 1 } },
};

export type Key = { f: number; pose: string };
export type Talk = [number, number];   // frames [from, to) of a spoken line

// ---------------- animation ----------------
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** ease with a small overshoot (brows and mouth land a little past the pose, then settle): measured ~5 f to land */
const pop = (t: number) => { const s = 1.9; t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export type Face = { eye: [EyeKind, EyeKind]; sq: number; look: [number, number]; brow: [Brow, Brow]; mouth: Mouth; marks: { k: Mark; t: number }[]; big: number };
const eyes = (p: Pose): [EyeKind, EyeKind] => (Array.isArray(p.eye) ? p.eye : [p.eye, p.eye]);
const brows = (p: Pose): [Brow, Brow] => p.brow ?? [NOB, NOB];
const mouthOf = (p: Pose): Mouth => ({ ...M0, ...p.mouth });
const mixBrow = (a: Brow, b: Brow, t: number): Brow => ({ y: lerp(a.y, b.y, t), rot: lerp(a.rot, b.rot, t), bend: lerp(a.bend, b.bend, t), a: clamp(lerp(a.a, b.a, t * 1.6)) });
const mixMouth = (a: Mouth, b: Mouth, t: number): Mouth => {
  const o = {} as Mouth;
  for (const k of Object.keys(M0) as (keyof Mouth)[]) o[k] = lerp(a[k], b[k], t);
  return o;
};

/** the face at frame f. keys: expression changes (sorted); talks: spoken lines; amp: loudness of the voice per frame (0..1);
 *  seed: per character, so two people never blink together */
export const faceAt = (keys: Key[], f: number, opt: { talks?: Talk[]; amp?: number[]; seed?: number; blink?: boolean } = {}): Face => {
  const { talks = [], amp, seed = 1, blink = true } = opt;
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].f - 2 <= f) i++;
  const cur = POSES[keys[i].pose] ?? POSES.neutral, prev = POSES[keys[Math.max(0, i - 1)].pose] ?? cur;
  const kf = keys[i].f, p = i === 0 ? 99 : f - kf;          // frames since the change (the eyes start closing 2 f early)
  // brows + mouth: 5 f with overshoot, starting with the eyes' reopening
  const t = i === 0 ? 1 : pop((p + 1) / 5);
  const bw: [Brow, Brow] = [mixBrow(brows(prev)[0], brows(cur)[0], t), mixBrow(brows(prev)[1], brows(cur)[1], t)];
  let m = mixMouth(mouthOf(prev), mouthOf(cur), t);
  // eyes: old (squashed) -> closed x2 -> new (squashed) -> new (a little big) -> new
  const changed = i > 0 && String(eyes(prev)) !== String(eyes(cur));
  let eye = p < 0 ? eyes(prev) : eyes(cur), sq = 1;
  if (changed) {
    if (p === -2) sq = 0.45;
    else if (p === -1 || p === 0) eye = ["closed", "closed"];
    else if (p === 1) sq = 0.5;
    else if (p === 2 || p === 3) sq = 1.1;
  }
  // ordinary blinks: every 1.5 - 4 s, never inside a change; closed-type eyes do not blink
  if (blink && (!changed || p > 8) && !["closed", "arc", "arcD", "squint", "spiral"].includes(eye[0])) {
    for (let n = Math.floor((f - 4) / 20); n <= Math.floor(f / 20); n++) {
      if (rnd(n * 3.1 + seed * 17) > 0.32) continue;
      const b0 = n * 20 + Math.floor(rnd(n + seed) * 14), d = f - b0;
      if (d === 0 || d === 3) sq = 0.45;
      else if (d === 1 || d === 2) eye = ["closed", "closed"];
    }
  }
  // lip-sync: while a line is spoken the opening follows the voice; the pose's own mouth is the rest shape
  const talking = talks.some(([a, b]) => f >= a && f < b);
  if (talking) {
    const a = amp ? clamp((amp[f] ?? 0) * 0.55 + (amp[f - 1] ?? 0) * 0.25 + (amp[f + 1] ?? 0) * 0.2) : 0.5 + 0.5 * Math.sin(f * 1.9) * Math.sin(f * 0.7 + seed);
    const open = clamp((a - 0.06) / 0.5);
    if (open > 0.02) {
      const w = lerp(24, 29, clamp(open * 2.5)) - 5 * clamp((open - 0.55) / 0.45);
      m = { ...m, w: lerp(m.w, w, 0.9), h: lerp(3.5, 21, open), c: m.c * 0.25, tilt: m.tilt * 0.3, x: m.x * 0.4, box: 1, teeth: 1, tongue: open > 0.4 ? 1 : 0, wav: 0 };
    } else m = { ...m, w: lerp(m.w, 22, 0.6), h: 0, c: m.c * 0.4, box: 0 };
  }
  // tiny life: the mouth drifts, the brows breathe
  m.x += 0.5 * Math.sin(f * 0.11 + seed); bw[0].y += 0.4 * Math.sin(f * 0.07 + seed); bw[1].y += 0.4 * Math.sin(f * 0.07 + seed + 1.3);
  const look: [number, number] = cur.look ? [cur.look[0], cur.look[1]] : [0, 0];
  const marks = (p < 0 ? prev.marks ?? [] : cur.marks ?? []).map((k) => ({ k, t: Math.max(0, f - kf) }));
  const big = lerp(prev.big ?? 1, cur.big ?? 1, t) * (changed && (p === 2 || p === 3) ? 1.03 : 1);
  return { eye, sq, look, brow: bw, mouth: m, marks, big };
};

// ---------------- drawing ----------------
export const INK = "#3b3238", INK2 = "#5a4f55", MOUTH_IN = "#54212a", TONGUE = "#e8707c", TEETH = "#fbf7f2";
type G = CanvasRenderingContext2D;
const bar = (g: G, x0: number, y0: number, x1: number, y1: number, w: number, col = INK) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };

const drawEye = (g: G, kind: EyeKind, x: number, y: number, u: number, sq: number, look: [number, number], side: number, skin: string) => {
  const lw = 3.3 * u;
  g.save(); g.translate(x, y);
  switch (kind) {
    case "closed": bar(g, -8.5 * u, 0, 8.5 * u, 0, 3 * u); break;
    case "lid": case "low": {
      const ry = (kind === "lid" ? 10 : 5.5) * u * sq, rx = 6.6 * u;
      const gr = g.createLinearGradient(0, 0, 0, ry); gr.addColorStop(0, INK); gr.addColorStop(1, INK2);
      g.fillStyle = gr; g.beginPath(); g.ellipse(look[0] * 0.4 * u, -0.5 * u, rx, ry, 0, 0, Math.PI); g.fill();   // the half disc under the lid
      bar(g, -10 * u, -1 * u, 10 * u, -1 * u, 3.9 * u);
      break;
    }
    case "dot": case "small": {
      const k = kind === "dot" ? 1 : 0.62;
      g.fillStyle = INK; g.beginPath(); g.ellipse(look[0] * u, look[1] * u, 4.6 * u * k, 6.8 * u * k * sq, 0, 0, 7); g.fill();
      break;
    }
    case "ring": case "ringS": {
      const r = (kind === "ring" ? 13 : 9.5) * u;
      g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 3.8 * u; g.beginPath(); g.ellipse(0, 0, r, r * sq, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.ellipse(look[0] * 0.6 * u, look[1] * 0.6 * u * sq, 3.1 * u, 3.1 * u * sq, 0, 0, 7); g.fill();
      break;
    }
    case "coin": {
      const r = 13.5 * u;
      g.fillStyle = "#f4c230"; g.strokeStyle = INK; g.lineWidth = lw; g.beginPath(); g.ellipse(0, 0, r, r * sq, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = "#a8780c"; g.lineWidth = 1.6 * u; g.beginPath(); g.ellipse(0, 0, r * 0.68, r * 0.68 * sq, 0, 0, 7); g.stroke();
      g.fillStyle = "#a8780c"; g.fillRect(-1 * u, -5 * u * sq, 2 * u, 10 * u * sq);
      break;
    }
    case "arc": case "arcD": {   // closed happy eye (an arch) / closed sad eye (a bowl)
      const up = kind === "arc" ? -1 : 1;
      g.strokeStyle = INK; g.lineWidth = lw; g.lineCap = "round"; g.beginPath();
      g.moveTo(-8 * u, -up * 3 * u * sq); g.quadraticCurveTo(0, up * 9 * u * sq, 8 * u, -up * 3 * u * sq); g.stroke();
      break;
    }
    case "squint": {   // squeezed shut: two lines meeting toward the nose
      g.scale(-side, 1);
      bar(g, -8 * u, -4.5 * u * sq, 7 * u, 0, 3.4 * u); bar(g, -8 * u, 4.5 * u * sq, 7 * u, 0, 3.4 * u);
      break;
    }
    case "spiral": {
      g.strokeStyle = INK; g.lineWidth = 2.4 * u; g.beginPath();
      for (let a = 0; a < 15; a += 0.25) { const r = a * 0.72 * u; const px = r * Math.cos(a), py = r * Math.sin(a) * sq; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
      break;
    }
  }
  g.restore();
};

const drawBrow = (g: G, b: Brow, x: number, y: number, u: number, side: number) => {
  if (b.a < 0.03) return;
  g.save(); g.globalAlpha *= b.a; g.translate(x, y - (13.5 + b.y) * u); g.scale(side, 1); g.rotate((-b.rot * Math.PI) / 180);
  // inner end at +x (toward the nose after the mirror), tapered: thick inside, thin outside
  const L = 9 * u, bend = -b.bend * u;
  g.fillStyle = INK; g.beginPath();
  g.moveTo(-L, -1.3 * u); g.quadraticCurveTo(0, bend - 2.9 * u, L, -2.7 * u);
  g.quadraticCurveTo(L + 2.6 * u, 0, L, 2.7 * u); g.quadraticCurveTo(0, bend + 2.3 * u, -L, 1.3 * u); g.quadraticCurveTo(-L - 1.4 * u, 0, -L, -1.3 * u);
  g.fill(); g.restore();
};

const drawMouth = (g: G, m: Mouth, x: number, y: number, u: number, f: number) => {
  g.save(); g.translate(x + m.x * u, y + (19 + m.y) * u); g.rotate((m.tilt * Math.PI) / 180);
  const w = Math.max(2, m.w) * u, h = m.h * u, c = m.c * u, lw = 3.2 * u;
  const wob = (px: number) => (m.wav > 0.05 ? m.wav * 1.6 * u * Math.sin((px / w) * 15 + f * 0.9) : 0);
  if (m.h < 1.2) {   // a line: straight, curved (smile / frown) or trembling
    g.strokeStyle = INK; g.lineWidth = lw; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
    for (let k = 0; k <= 16; k++) { const s = k / 16, px = (s - 0.5) * w, py = -c + 4 * c * s * (1 - s) + wob(px); if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
  } else {
    // the opening: a rounded box (talking) or a crescent (grin / frown), morphing between the two with m.box
    const path = () => {
      g.beginPath();
      if (m.box > 0.5) { const r = Math.min(h / 2, w / 2.4, 6 * u); g.roundRect(-w / 2, -h * 0.25, w, h, r); }
      else {
        if (c >= 0) { g.moveTo(-w / 2, -c); g.quadraticCurveTo(0, c, w / 2, -c); g.quadraticCurveTo(0, c + 2.1 * h, -w / 2, -c); }   // a crescent h thick in the middle
        else {   // an open frown (wail): narrow arch on top, wide sagging bottom
          const d = -c;
          g.moveTo(-w / 2, h * 0.75 + d * 0.4); g.quadraticCurveTo(-w * 0.46, -h * 0.5, 0, -h * 0.45);
          g.quadraticCurveTo(w * 0.46, -h * 0.5, w / 2, h * 0.75 + d * 0.4); g.quadraticCurveTo(0, h * 0.55, -w / 2, h * 0.75 + d * 0.4);
        }
      }
      g.closePath();
    };
    path(); g.fillStyle = m.teeth >= 1.5 ? TEETH : MOUTH_IN; g.fill();
    g.save(); path(); g.clip();
    if (m.teeth >= 1.5) {          // a full grid of teeth
      g.strokeStyle = INK; g.lineWidth = 1.5 * u;
      const n = Math.max(3, Math.round(m.w / 7));
      for (let k = 1; k < n; k++) { const px = -w / 2 + (w * k) / n; g.beginPath(); g.moveTo(px, -h * 2); g.lineTo(px, h * 3); g.stroke(); }
    } else {
      const top = m.box > 0.5 ? -h * 0.25 : c >= 0 ? 0 : -h * 0.47, bot = m.box > 0.5 ? h * 0.75 : c >= 0 ? h * 1.02 : h * 0.66;
      if (m.tongue > 0.3) { g.fillStyle = TONGUE; g.beginPath(); g.ellipse(0, bot, w * 0.36, (bot - top) * 0.38, 0, 0, 7); g.fill(); }
      if (m.teeth > 0.3) { g.fillStyle = TEETH; g.fillRect(-w, top - h, 2 * w, h + Math.min((bot - top) * 0.3, 4.2 * u)); }
    }
    g.restore();
    path(); g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = "round"; g.stroke();
  }
  g.restore();
};

const drawMarks = (g: G, marks: Face["marks"], cx: number, cy: number, u: number, ex: number, m: Mouth) => {
  for (const { k, t } of marks) {
    if (k === "sweat") {   // one drop that slides down the temple over ~1 s, then is gone
      const s = clamp(t / 30); if (s >= 1) continue;
      const x = cx + 36 * u, y = cy - 26 * u + 26 * u * s;
      g.fillStyle = "#8fc4ee"; g.strokeStyle = INK; g.lineWidth = 1.6 * u; g.beginPath();
      g.moveTo(x, y - 7 * u); g.quadraticCurveTo(x + 5.5 * u, y + 1 * u, x, y + 4.5 * u); g.quadraticCurveTo(x - 5.5 * u, y + 1 * u, x, y - 7 * u); g.fill(); g.stroke();
    } else if (k === "tears" || k === "stream") {
      for (const sd of [-1, 1]) {
        const x = cx + sd * ex;
        g.fillStyle = "#9fd0f4"; g.strokeStyle = "#5d9fd0"; g.lineWidth = 1.2 * u;
        if (k === "tears") { g.beginPath(); g.ellipse(x + sd * 2 * u, cy + 8 * u + 1.2 * u * Math.sin(t * 0.5), 4.5 * u, 3.2 * u, 0, 0, 7); g.fill(); g.stroke(); }
        else { const wv = 1.2 * u * Math.sin(t * 0.8 + sd); g.beginPath(); g.roundRect(x - 4 * u + wv, cy + 4 * u, 8 * u, 40 * u, 4 * u); g.fill(); g.stroke(); }
      }
    } else if (k === "vein") {
      const x = cx + 34 * u, y = cy - 30 * u, r = 5 * u * (1 + 0.12 * Math.sin(t * 0.9));
      g.strokeStyle = "#d8322c"; g.lineWidth = 2.6 * u; g.lineCap = "round";
      for (let q = 0; q < 4; q++) { const a = (q * Math.PI) / 2 + 0.4; g.beginPath(); g.arc(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5, r, a + 2.2, a + 4.1); g.stroke(); }
    } else if (k === "gloom") {
      const a = clamp(t / 6);
      g.strokeStyle = `rgba(74,98,160,${0.75 * a})`; g.lineWidth = 1.8 * u; g.lineCap = "round";
      for (let q = -4; q <= 4; q++) { g.beginPath(); g.moveTo(cx + q * 5.5 * u, cy - 40 * u); g.lineTo(cx + q * 5.5 * u, cy - (20 - Math.abs(q) * 1.5) * u); g.stroke(); }
    } else if (k === "drool") {
      const x = cx + (m.x + m.w * 0.3) * u, y = cy + (19 + m.y + m.h * 0.6 + m.c) * u, L = (5 + 3 * Math.sin(t * 0.25)) * u;
      g.fillStyle = "#bfe0f6"; g.strokeStyle = "#7fb2d8"; g.lineWidth = 1.1 * u; g.beginPath(); g.roundRect(x - 1.8 * u, y, 3.6 * u, L, 1.8 * u); g.fill(); g.stroke();
    }
  }
};

/** draw the features on a head whose face centre (between the eyes) is (cx, cy) and whose face is W wide.
 *  facing: -1..1 turns the features toward that side (the reference shifts eyes and mouth ~8 % of W) */
export type Fixtures = { moustache?: string; glasses?: string; brow?: string };
/** profile (the head faces right): one eye, one brow and a narrower mouth pushed to the front of the face */
export const drawFaceSide = (g: G, face: Face, cx: number, cy: number, W: number, opt: { f?: number; fix?: Fixtures } = {}) => {
  const { f = 0, fix = {} } = opt, u = (W / 100) * face.big, ex = cx + 17 * u;
  g.save();
  drawEye(g, face.eye[1], ex, cy, u * 0.92, face.sq, face.look, 1, "#fff");
  drawBrow(g, face.brow[1], ex, cy, u * 0.92, -1);
  const m = { ...face.mouth, w: face.mouth.w * 0.55, x: face.mouth.x * 0.3 };
  drawMouth(g, m, cx + 27 * u, cy, u, f);
  if (fix.moustache) {
    const open = Math.min(m.h, 16) / 16, mx = cx + 26 * u, my = cy + (19 + m.y) * u - (6 + 3 * open) * u;
    g.fillStyle = fix.moustache; g.strokeStyle = INK; g.lineWidth = 2 * u; g.lineJoin = "round"; g.beginPath();
    g.moveTo(mx - 15 * u, my + (8 + 4 * open) * u); g.quadraticCurveTo(mx - 12 * u, my - 7 * u, mx + 6 * u, my - 5 * u);
    g.quadraticCurveTo(mx + 12 * u, my - 2 * u, mx + 9 * u, my + 3 * u); g.quadraticCurveTo(mx - 6 * u, my + 2 * u, mx - 15 * u, my + (8 + 4 * open) * u);
    g.fill(); g.stroke();
  }
  if (fix.glasses) { g.strokeStyle = fix.glasses; g.lineWidth = 2.6 * u; g.beginPath(); g.ellipse(ex, cy, 11 * u, 14 * u, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(ex - 11 * u, cy - 2 * u); g.lineTo(ex - 40 * u, cy - 5 * u); g.stroke(); }
  drawMarks(g, face.marks.filter((k) => k.k === "sweat"), cx - 10 * u, cy, u, 0, m);
  g.restore();
};
export const drawFace = (g: G, face: Face, cx: number, cy: number, W: number, opt: { facing?: number; skin?: string; f?: number; fix?: Fixtures } = {}) => {
  const { facing = 0, skin = "#fff", f = 0, fix = {} } = opt, u = (W / 100) * face.big, ox = cx + 7 * u * facing, ex = 16.5 * u;
  g.save();
  drawMarks(g, face.marks.filter((m) => m.k === "gloom"), ox, cy, u, ex, face.mouth);
  for (const sd of [-1, 1] as const) {
    const k = face.eye[sd < 0 ? 0 : 1];
    drawEye(g, k, ox + sd * ex, cy, u, face.sq, face.look, sd, skin);
    drawBrow(g, face.brow[sd < 0 ? 0 : 1], ox + sd * ex, cy, u, -sd);
  }
  drawMouth(g, face.mouth, ox + 1 * u * facing, cy, u, f);
  if (fix.moustache) {   // a wide thick arch on the upper lip with drooping ends; it lifts and spreads as the mouth opens (reference f186-255)
    const m = face.mouth, open = Math.min(m.h, 16) / 16, mx = ox + 1 * u * facing + m.x * 0.5 * u;
    const my = cy + (19 + m.y) * u - (6 + 3 * open) * u, hw = (21 + 3 * open) * u, drop = (7 + 5 * open) * u, th = 7.5 * u;
    g.fillStyle = fix.moustache; g.strokeStyle = INK; g.lineWidth = 2 * u; g.lineJoin = "round"; g.beginPath();
    g.moveTo(mx - hw, my + drop); g.quadraticCurveTo(mx - hw * 0.95, my - th * 0.9, mx, my - th * 0.75);
    g.quadraticCurveTo(mx + hw * 0.95, my - th * 0.9, mx + hw, my + drop);
    g.quadraticCurveTo(mx + hw * 0.72, my + th * 0.25, mx, my + th * 0.3); g.quadraticCurveTo(mx - hw * 0.72, my + th * 0.25, mx - hw, my + drop);
    g.fill(); g.stroke();
  }
  if (fix.glasses) {
    g.strokeStyle = fix.glasses; g.lineWidth = 2.6 * u;
    for (const sd of [-1, 1]) { g.beginPath(); g.arc(ox + sd * ex, cy, 14.5 * u, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(ox - ex + 14.5 * u, cy - 2 * u); g.quadraticCurveTo(ox, cy - 5 * u, ox + ex - 14.5 * u, cy - 2 * u); g.stroke();
    g.beginPath(); g.moveTo(ox - ex - 14.5 * u, cy - 1 * u); g.lineTo(ox - ex - 26 * u, cy - 4 * u); g.moveTo(ox + ex + 14.5 * u, cy - 1 * u); g.lineTo(ox + ex + 26 * u, cy - 4 * u); g.stroke();
  }
  drawMarks(g, face.marks.filter((m) => m.k !== "gloom"), ox, cy, u, ex, face.mouth);
  g.restore();
};
