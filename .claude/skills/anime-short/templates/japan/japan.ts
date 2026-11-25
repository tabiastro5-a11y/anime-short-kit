// Edo-period Japanese village, built the same way as the bridge town (build.ts / paint.ts): HD Canvas2D painted
// textures with dark seams painted in, two-tone Lambert materials via lam(), merged static batches, real 3D relief
// (posts, beams, eaves, ridge caps) so the world ink finds edges, and sight-line culling so no house blocks a lens.
// Buildings: minka (thatched farmhouse), machiya (tiled town house, optional soy-shop dressing), kura (white storehouse),
// torii, small shrine hall, stone steps, ishigaki sea wall, earth embankment (built progressively), Japanese black
// pines, inamura (rice-straw stacks), soy barrels, flood debris.
import * as THREE from "three";
import { Batch, V, lam, quad, tri, boxGeo, inTheWay } from "./build";
import { ctex, rng, jit } from "./paint";

// ---------------- painted textures ----------------
/** thatch: horizontal courses of combed straw, each course edge a dark trimmed line */
export const thatchHD = () => ctex("thatchHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#9c7a46"; g.fillRect(0, 0, 1024, 1024);
  const rows = 9, rh = 1024 / rows;
  for (let k = 0; k < rows; k++) {
    const y0 = k * rh;
    for (let i = 0; i < 1400; i++) {
      const x = r() * 1024, y = y0 + r() * rh * 0.92, h = 18 + r() * 40;
      g.strokeStyle = jit(r, ["#b8925a", "#a8844c", "#c9a468", "#8e6d3e"][Math.floor(r() * 4)], 0.08, 4, 0.1);
      g.lineWidth = 1.6 + r() * 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, Math.min(y0 + rh - 4, y + h)); g.stroke();
    }
    g.fillStyle = "rgba(48,30,14,0.55)"; g.fillRect(0, y0 + rh - 9, 1024, 9);
    g.fillStyle = "rgba(255,236,190,0.16)"; g.fillRect(0, y0, 1024, 6);
  }
});
/** kawara: rounded tile rows; dark gaps between the rows and the columns */
export const kawaraHD = (col = "#5d6676") => ctex("kawaraHD" + col, 1024, 1024, (g, r) => {
  g.fillStyle = "#2c3038"; g.fillRect(0, 0, 1024, 1024);
  const cols = 14, cw = 1024 / cols, rows = 10, rh = 1024 / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * cw, y = j * rh;
    g.fillStyle = jit(r, col, 0.06, 3, 0.08); g.fillRect(x + 5, y + 4, cw - 10, rh - 8);
    const gr = g.createLinearGradient(x + 5, 0, x + cw - 5, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.20)"); gr.addColorStop(0.45, "rgba(255,255,255,0.0)"); gr.addColorStop(1, "rgba(0,0,0,0.28)");
    g.fillStyle = gr; g.fillRect(x + 5, y + 4, cw - 10, rh - 8);
  }
  for (let j = 0; j < rows; j++) { g.fillStyle = "rgba(20,22,28,0.85)"; g.fillRect(0, j * rh + rh - 6, 1024, 6); }
});
/** shikkui: lime plaster, warm white with faint trowel mottling */
export const plasterHD = (col = "#ece4d2", key = "plasterHD") => ctex(key + col, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "120,100,80" : "255,250,240"},${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 70, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
});
/** dark vertical boards (lower walls, kura base): grain + near-black seams */
export const boardsHD = (col = "#4e3626") => ctex("boardsHD" + col, 1024, 1024, (g, r) => {
  const n = 12, w = 1024 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = jit(r, col, 0.1, 4, 0.12); g.fillRect(i * w, 0, w, 1024);
    for (let k = 0; k < 10; k++) { g.strokeStyle = `rgba(20,10,4,${0.15 + r() * 0.2})`; g.lineWidth = 1 + r() * 2; const x = i * w + r() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, 340, x - 6, 680, x, 1024); g.stroke(); }
    g.fillStyle = "#170e09"; g.fillRect(i * w, 0, 5, 1024);
  }
});
/** shoji paper door: off-white paper in a dark wooden grid */
export const shojiHD = () => ctex("shojiHD", 512, 512, (g) => {
  g.fillStyle = "#f1e9d6"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#5a4030";
  for (let x = 0; x <= 512; x += 128) g.fillRect(x - 7, 0, 14, 512);
  for (let y = 0; y <= 512; y += 85) g.fillRect(0, y - 5, 512, 10);
  g.fillRect(0, 0, 512, 18); g.fillRect(0, 494, 512, 18);
});
/** koshi: the vertical wooden lattice of a machiya front */
export const latticeHD = () => ctex("latticeHD", 512, 512, (g) => {
  g.fillStyle = "#1e130c"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 24) { g.fillStyle = "#6b4a32"; g.fillRect(x + 4, 0, 13, 512); g.fillStyle = "rgba(255,225,180,0.15)"; g.fillRect(x + 5, 0, 3, 512); }
  g.fillStyle = "#5a3e2a"; g.fillRect(0, 0, 512, 22); g.fillRect(0, 490, 512, 22);
});
/** noren: indigo shop curtain, three panels, a white circle crest (no lettering: the film has no text) */
export const norenHD = () => ctex("norenHD", 512, 256, (g) => {
  g.fillStyle = "#243c6e"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#14233f"; for (const x of [168, 340]) g.fillRect(x, 30, 6, 226);
  g.strokeStyle = "#f2eee4"; g.lineWidth = 12; g.beginPath(); g.arc(256, 120, 52, 0, 7); g.stroke();
  g.fillStyle = "#f2eee4"; g.beginPath(); g.arc(256, 120, 18, 0, 7); g.fill();
});
/** harvested paddy in December: drained mud with rows of stubble tufts */
export const paddyHD = () => ctex("paddyHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#8c7048"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { g.fillStyle = r() > 0.5 ? "rgba(70,52,30,0.22)" : "rgba(170,140,95,0.2)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 30 + r() * 90, 14 + r() * 40, r() * 3, 0, 7); g.fill(); }
  for (let y = 24; y < 1024; y += 48) {
    g.fillStyle = "rgba(60,42,24,0.3)"; g.fillRect(0, y + 14, 1024, 4);
    for (let x = 16; x < 1024; x += 34) {
      const jx = x + (r() - 0.5) * 8, jy = y + (r() - 0.5) * 6;
      for (let k = 0; k < 6; k++) { g.strokeStyle = ["#c9a96a", "#b08e52", "#d8bd80"][k % 3]; g.lineWidth = 2.2; g.beginPath(); g.moveTo(jx, jy + 8); g.lineTo(jx + (r() - 0.5) * 12, jy - 6 - r() * 8); g.stroke(); }
    }
  }
});
/** packed-earth street */
export const dirtHD = () => ctex("dirtHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#b39068"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 90; i++) { g.fillStyle = r() > 0.5 ? "rgba(110,80,50,0.18)" : "rgba(220,195,150,0.18)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 30 + r() * 100, 12 + r() * 40, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 700; i++) { g.fillStyle = r() > 0.5 ? "#8c6a46" : "#d6bc90"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 2 + r() * 6, 1.5 + r() * 4, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 8; i++) { g.strokeStyle = "rgba(80,56,34,0.25)"; g.lineWidth = 8; const y = r() * 1024; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(340, y + 30, 680, y - 30, 1024, y + 6); g.stroke(); }
});
export const sandHD = () => ctex("sandHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#e0c896"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 1200; i++) { g.fillStyle = r() > 0.5 ? "rgba(170,140,95,0.35)" : "rgba(255,245,215,0.4)"; g.fillRect(r() * 1024, r() * 1024, 3, 3); }
  for (let i = 0; i < 10; i++) { g.strokeStyle = "rgba(150,120,80,0.25)"; g.lineWidth = 5; const y = r() * 1024; g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(512, y + 26, 1024, y); g.stroke(); }
});
/** ishigaki: irregular dressed stones with dark joints */
export const ishigakiHD = () => ctex("ishigakiHD", 1024, 512, (g, r) => {
  g.fillStyle = "#3e3a36"; g.fillRect(0, 0, 1024, 512);
  for (let y = 0; y < 512; y += 64) {
    let x = (y / 64) % 2 ? -40 : 0;
    while (x < 1024) {
      const w = 70 + r() * 70;
      g.fillStyle = jit(r, "#9e978c", 0.12, 6, 0.15);
      g.beginPath(); g.moveTo(x + 6 + r() * 6, y + 6); g.lineTo(x + w - 6, y + 5 + r() * 6); g.lineTo(x + w - 4 - r() * 6, y + 58); g.lineTo(x + 5, y + 58 - r() * 6); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x + 10, y + 8, w - 22, 6);
      x += w;
    }
  }
});
export const strawHD = () => ctex("strawHD", 512, 512, (g, r) => {
  g.fillStyle = "#c9a45c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const x = r() * 512, y = r() * 512, h = 10 + r() * 34;
    g.strokeStyle = ["#e2c27e", "#a8823f", "#d6b46a", "#8e6a34"][Math.floor(r() * 4)]; g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + h); g.stroke();
  }
  g.fillStyle = "rgba(90,60,20,0.55)"; for (const y of [150, 330]) g.fillRect(0, y, 512, 9); // straw ties
});
export const embankHD = () => ctex("embankHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#7a9a4e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 80; i++) { g.fillStyle = r() > 0.5 ? "rgba(60,90,40,0.25)" : "rgba(160,170,90,0.25)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 30 + r() * 80, 14 + r() * 30, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 3000; i++) { const x = r() * 1024, y = r() * 1024; g.strokeStyle = r() > 0.5 ? "#9ab862" : "#5a7c3a"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y - 8 - r() * 8); g.stroke(); }
});

/** freshly heaped and tamped earth (the embankment while it is being built): brown with pounded layers */
export const freshEarthHD = () => ctex("freshEarthHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#9a7650"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 90; i++) { g.fillStyle = r() > 0.5 ? "rgba(90,62,36,0.28)" : "rgba(190,160,110,0.25)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 40 + r() * 90, 10 + r() * 22, 0, 0, 7); g.fill(); }
  for (let y = 40; y < 1024; y += 110) { g.strokeStyle = "rgba(70,48,28,0.45)"; g.lineWidth = 5; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + 6 * Math.sin(x * 0.02 + y)); g.stroke(); }
  for (let i = 0; i < 1500; i++) { g.fillStyle = r() > 0.5 ? "#7a5a38" : "#b8956a"; g.fillRect(r() * 1024, r() * 1024, 3 + r() * 4, 3 + r() * 3); }
});
export const freshEarthMat = () => lam("freshEarth", () => ({ map: freshEarthHD() }));
/** construction site props for the embankment: survey stakes with a rope along both base edges, the borrow pit and
 *  heaps of earth (returns its own group so the world can show it only while building) */
export const dikeSite = (x0: number, x1: number, zc: number, bw: number) => {
  const grp = new THREE.Group(), b = new Batch();
  for (const side of [-1, 1]) {
    const z = zc + side * (bw + 0.4);
    for (let x = x0; x <= x1; x += 4) b.add(new THREE.BoxGeometry(0.12, 1.3, 0.12).translate(x, 0.65, z), M.plank());
    b.add(new THREE.BoxGeometry(x1 - x0, 0.03, 0.03).translate((x0 + x1) / 2, 1.1, z), lam("rope", () => ({ color: "#d8c49a" })));
  }
  const pitZ = zc + bw + 11;
  b.add(new THREE.CircleGeometry(1, 28).scale(9, 1, 3.2).rotateX(-Math.PI / 2).translate(-3, 0.03, pitZ), lam("pit", () => ({ color: "#5e4430" })));
  for (const [x, z, r, h] of [[-15, pitZ - 1, 2.2, 1.3], [8, pitZ + 0.5, 2.6, 1.5], [12, pitZ - 2, 1.6, 0.9], [-20, pitZ + 2, 1.8, 1.0]] as const)
    b.add(new THREE.ConeGeometry(r, h, 14).translate(x, h / 2, z), freshEarthMat());
  b.build(grp);
  return grp;
};

/** downloaded textures (world.ts loadKit fills these before the world is built; code-painted fallbacks otherwise)
 *  grass: "Hand painted grass" (OpenGameArt, CC0) */
export const EXT: { grass?: THREE.Texture } = {};

// ---------------- materials ----------------
const M = {
  thatch: () => lam("thatch", () => ({ map: thatchHD() })),
  kawara: () => lam("kawara", () => ({ map: kawaraHD(), side: THREE.DoubleSide })),
  plaster: () => lam("plaster", () => ({ map: plasterHD() })),
  kuraWall: () => lam("kuraWall", () => ({ map: plasterHD("#f4efe4", "kuraHD") })),
  boards: () => lam("boards", () => ({ map: boardsHD() })),
  post: () => lam("post", () => ({ color: "#4a3022" })),
  beam: () => lam("beamJp", () => ({ color: "#5a3a28" })),
  shoji: () => lam("shoji", () => ({ map: shojiHD() })),
  lattice: () => lam("lattice", () => ({ map: latticeHD() })),
  noren: () => lam("noren", () => ({ map: norenHD(), side: THREE.DoubleSide })),
  stoneBase: () => lam("stoneBase", () => ({ color: "#8e8a82" })),
  ridge: () => lam("ridgeJp", () => ({ color: "#3a3e48" })),
  thatchRidge: () => lam("thatchRidge", () => ({ color: "#5a4630" })),
  red: () => lam("shuRed", () => ({ color: "#d2412c" })),
  black: () => lam("toriiBlack", () => ({ color: "#2a2428" })),
  stone: () => lam("ishigaki", () => ({ map: ishigakiHD() })),
  steps: () => lam("steps", () => ({ color: "#a39c90" })),
  barrel: () => lam("barrel", () => ({ color: "#b07a48" })),
  hoop: () => lam("hoop", () => ({ color: "#3e2c20" })),
  pineBark: () => lam("pineBark", () => ({ color: "#6a4a36" })),
  pineLeaf: () => lam("pineLeaf", () => ({ color: "#3f6e3a" })),
  pineLeaf2: () => lam("pineLeaf2", () => ({ color: "#4c7e40" })),
  straw: () => lam("straw", () => ({ map: strawHD() })),
  earth: () => lam("embank", () => (EXT.grass ? { map: EXT.grass, color: "#b8c79c" } : { map: embankHD() })),
  plank: () => lam("plank", () => ({ color: "#8a6a4a" })),
};

/** an axis-aligned box in a local frame m (matrix), x0..x1 etc. in local coordinates */
const UB = new THREE.BoxGeometry(1, 1, 1);
const lb = (b: Batch, mat: THREE.Material, m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(UB, mat, m.clone().multiply(new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0))));
const frameOf = (x: number, y: number, z: number, yaw: number) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
const blocks = (x: number, z: number, yaw: number, w: number, d: number, h: number, y = 0) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 1.2, hz = (across ? w : d) / 2 + 1.2;
  return inTheWay(x - hx, x + hx, y, y + h, z - hz, z + hz);
};

/** hipped roof: eaves rectangle (2hw x 2hd at height y0) up to a ridge of half-length rl at height y1; thick eaves fascia */
const hipRoof = (b: Batch, m: THREE.Matrix4, mat: THREE.Material, hw: number, hd: number, y0: number, y1: number, rl: number, u = 4) => {
  const A = V(-hw, y0, hd), B = V(hw, y0, hd), C = V(hw, y0, -hd), D = V(-hw, y0, -hd), R0 = V(-rl, y1, 0), R1 = V(rl, y1, 0);
  const g1 = quad(A, B, R1, R0, (2 * hw) / u, Math.hypot(hd, y1 - y0) / u), g2 = quad(C, D, R0, R1, (2 * hw) / u, Math.hypot(hd, y1 - y0) / u);
  b.add(g1, mat, m); b.add(g2, mat, m);
  const t1 = tri(B, C, R1), t2 = tri(D, A, R0);
  for (const t of [t1, t2]) { const uv = new Float32Array([0, 0, 1.6, 0, 0.8, 1.2]); t.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); b.add(t, mat, m); }
};

// ---------------- buildings ----------------
/** minka: thatched farmhouse. Front (local +z) has sliding shoji doors under a deep eave; stone plinth; board lower walls. */
export const minka = (b: Batch, x: number, z: number, yaw: number, w = 9, d = 6.5, opts: { lit?: boolean } = {}) => {
  const h = 2.5, roofTop = h + 4.3;
  if (blocks(x, z, yaw, w + 2.4, d + 2.4, roofTop)) return false;
  const m = frameOf(x, 0, z, yaw), hw = w / 2, hd = d / 2;
  lb(b, M.stoneBase(), m, -hw - 0.15, hw + 0.15, 0, 0.35, -hd - 0.15, hd + 0.15);
  lb(b, M.plaster(), m, -hw, hw, 0.35, h, -hd, hd);
  lb(b, M.boards(), m, -hw - 0.02, hw + 0.02, 0.35, 1.25, -hd - 0.02, hd + 0.02);
  // posts + beams (relief for the ink)
  for (let i = 0; i <= 4; i++) { const px = -hw + (i * w) / 4; for (const pz of [-hd - 0.06, hd + 0.06]) lb(b, M.post(), m, px - 0.12, px + 0.12, 0.3, h, pz - 0.1, pz + 0.1); }
  for (const pz of [-hd - 0.08, hd + 0.08]) lb(b, M.beam(), m, -hw - 0.1, hw + 0.1, h - 0.22, h, pz - 0.1, pz + 0.1);
  // front: shoji doors + an engawa step
  b.add(quad(V(-hw * 0.7, 0.4, hd + 0.04), V(hw * 0.25, 0.4, hd + 0.04), V(hw * 0.25, 2.25, hd + 0.04), V(-hw * 0.7, 2.25, hd + 0.04), 2, 1), M.shoji(), m);
  lb(b, M.beam(), m, -hw + 0.2, hw - 0.2, 0.3, 0.5, hd + 0.1, hd + 0.8);
  b.add(quad(V(hw * 0.4, 1.3, hd + 0.04), V(hw * 0.85, 1.3, hd + 0.04), V(hw * 0.85, 2.0, hd + 0.04), V(hw * 0.4, 2.0, hd + 0.04), 1, 1), M.shoji(), m);
  // deep thatched hip roof (yosemune) + ridge cap
  hipRoof(b, m, M.thatch(), hw + 1.2, hd + 1.3, h - 0.1, roofTop, hw * 0.45, 3);
  lb(b, M.thatch(), m, -hw - 1.25, hw + 1.25, h - 0.42, h - 0.08, -hd - 1.35, hd + 1.35); // thick eave edge
  lb(b, M.thatchRidge(), m, -hw * 0.5, hw * 0.5, roofTop - 0.25, roofTop + 0.25, -0.45, 0.45);
  if (opts.lit) b.add(quad(V(-hw * 0.7, 0.4, hd + 0.05), V(hw * 0.25, 0.4, hd + 0.05), V(hw * 0.25, 2.25, hd + 0.05), V(-hw * 0.7, 2.25, hd + 0.05)), litPaper(), m);
  return true;
};
/** warm paper glow for night windows (HDR emissive: picked up by the bloom) */
const litPaper = () => {
  const k = "litPaper";
  return lam(k, () => ({ map: shojiHD(), emissive: new THREE.Color(1.6, 1.05, 0.5), emissiveMap: shojiHD(), transparent: true, opacity: 0.9 }));
};

/** machiya: tiled two-storey town house, narrow, front (local +z) with lattice below, mushiko plaster above, a
 *  half-roof between the floors; shop dressing (noren + soy barrels) optional */
export const machiya = (b: Batch, x: number, z: number, yaw: number, w = 6, d = 8, opts: { shop?: boolean; lit?: boolean } = {}) => {
  const h1 = 2.7, h2 = 4.8, top = h2 + 1.6;
  if (blocks(x, z, yaw, w + 1.6, d + 1.6, top)) return false;
  const m = frameOf(x, 0, z, yaw), hw = w / 2, hd = d / 2;
  lb(b, M.stoneBase(), m, -hw, hw, 0, 0.25, -hd, hd);
  lb(b, M.boards(), m, -hw, hw, 0.25, h1, -hd, hd);
  lb(b, M.plaster(), m, -hw, hw, h1, h2, -hd + 0.4, hd - 0.4);
  b.add(quad(V(-hw * 0.92, 0.3, hd + 0.05), V(hw * 0.92, 0.3, hd + 0.05), V(hw * 0.92, h1 - 0.15, hd + 0.05), V(-hw * 0.92, h1 - 0.15, hd + 0.05), 3, 1), M.lattice(), m);
  // mushiko window upstairs (lattice band) + posts
  b.add(quad(V(-hw * 0.6, h1 + 0.6, hd - 0.35), V(hw * 0.6, h1 + 0.6, hd - 0.35), V(hw * 0.6, h1 + 1.4, hd - 0.35), V(-hw * 0.6, h1 + 1.4, hd - 0.35), 2, 0.5), M.lattice(), m);
  for (const px of [-hw, hw]) lb(b, M.post(), m, px - 0.13, px + 0.13, 0.25, h2, hd - 0.1, hd + 0.12);
  // half roof (hisashi) between the floors
  const eave = (y: number, z0: number, z1: number, y1: number) => {
    b.add(quad(V(-hw - 0.3, y, z1), V(hw + 0.3, y, z1), V(hw + 0.3, y1, z0), V(-hw - 0.3, y1, z0), w / 2, 0.5), M.kawara(), m);
    lb(b, M.ridge(), m, -hw - 0.32, hw + 0.32, y - 0.08, y + 0.06, z1 - 0.12, z1 + 0.04);
  };
  eave(h1 - 0.05, hd - 0.05, hd + 1.05, h1 + 0.55);
  // gabled main roof, ridge along x, eaves over front and back
  const ry = top, o = 0.9;
  b.add(quad(V(-hw - 0.4, h2, hd + o), V(hw + 0.4, h2, hd + o), V(hw + 0.4, ry, 0), V(-hw - 0.4, ry, 0), w / 2, 2), M.kawara(), m);
  b.add(quad(V(hw + 0.4, h2, -hd - o), V(-hw - 0.4, h2, -hd - o), V(-hw - 0.4, ry, 0), V(hw + 0.4, ry, 0), w / 2, 2), M.kawara(), m);
  for (const s of [-1, 1]) b.add(tri(V(s * hw, h2, s * (hd - 0.4)), V(s * hw, h2, -s * (hd - 0.4)), V(s * hw, ry - 0.1, 0)), M.plaster(), m);
  lb(b, M.ridge(), m, -hw - 0.45, hw + 0.45, ry - 0.12, ry + 0.22, -0.22, 0.22);
  for (const s of [-1, 1]) lb(b, M.ridge(), m, s * hw - 0.2, s * hw + 0.2, ry - 0.1, ry + 0.45, -0.25, 0.25); // onigawara stubs
  if (opts.shop) {
    b.add(quad(V(-hw * 0.5, h1 - 1.15, hd + 0.75), V(hw * 0.5, h1 - 1.15, hd + 0.75), V(hw * 0.5, h1 - 0.05, hd + 0.75), V(-hw * 0.5, h1 - 0.05, hd + 0.75)), M.noren(), m);
    for (const [bx, bz, s] of [[-hw + 0.8, hd + 1.4, 1], [-hw + 1.75, hd + 1.55, 0.9], [hw - 0.9, hd + 1.45, 1.05], [hw - 0.9, hd + 1.45, 0.75]] as const)
      barrel(b, m, bx, bz, s, s < 0.8 ? 1.05 : 0);
  }
  if (opts.lit) b.add(quad(V(-hw * 0.6, h1 + 0.6, hd - 0.33), V(hw * 0.6, h1 + 0.6, hd - 0.33), V(hw * 0.6, h1 + 1.4, hd - 0.33), V(-hw * 0.6, h1 + 1.4, hd - 0.33)), litPaper(), m);
  return true;
};
/** soy barrel (taru): staved cylinder with two dark hoops, local frame m */
const barrel = (b: Batch, m: THREE.Matrix4, x: number, z: number, s: number, y = 0) => {
  const g = new THREE.CylinderGeometry(0.42 * s, 0.38 * s, 1.0 * s, 14).translate(x, y + 0.5 * s, z);
  b.add(g, M.barrel(), m);
  for (const hy of [0.22, 0.78]) b.add(new THREE.TorusGeometry(0.41 * s, 0.035 * s, 6, 18).rotateX(Math.PI / 2).translate(x, y + hy * s, z), M.hoop(), m);
  b.add(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.04, 14).translate(x, y + 1.0 * s, z), M.hoop(), m);
};
/** kura: white storehouse, black board skirt, heavy tiled roof */
export const kura = (b: Batch, x: number, z: number, yaw: number, w = 5, d = 4.5) => {
  const h = 4.4, top = h + 1.6;
  if (blocks(x, z, yaw, w + 1.4, d + 1.4, top)) return false;
  const m = frameOf(x, 0, z, yaw), hw = w / 2, hd = d / 2;
  lb(b, M.stoneBase(), m, -hw - 0.1, hw + 0.1, 0, 0.5, -hd - 0.1, hd + 0.1);
  lb(b, M.kuraWall(), m, -hw, hw, 0.5, h, -hd, hd);
  lb(b, M.boards(), m, -hw - 0.04, hw + 0.04, 0.5, 1.6, -hd - 0.04, hd + 0.04);
  lb(b, M.post(), m, -0.7, 0.7, 0.5, 2.6, hd, hd + 0.12); // door
  lb(b, M.kuraWall(), m, -0.42, 0.42, 3.2, 3.8, hd, hd + 0.1); // small window
  const o = 0.6;
  b.add(quad(V(-hw - o, h, hd + o), V(hw + o, h, hd + o), V(hw + o, top, 0), V(-hw - o, top, 0), w / 2, 1.5), M.kawara(), m);
  b.add(quad(V(hw + o, h, -hd - o), V(-hw - o, h, -hd - o), V(-hw - o, top, 0), V(hw + o, top, 0), w / 2, 1.5), M.kawara(), m);
  for (const s of [-1, 1]) b.add(tri(V(s * hw, h, s * hd), V(s * hw, h, -s * hd), V(s * hw, top - 0.1, 0)), M.kuraWall(), m);
  lb(b, M.ridge(), m, -hw - 0.6, hw + 0.6, top - 0.1, top + 0.3, -0.24, 0.24);
  return true;
};
/** torii: vermilion pillars and nuki, black kasagi with upturned ends */
export const torii = (b: Batch, x: number, z: number, yaw: number, s = 1) => {
  const m = frameOf(x, 0, z, yaw).multiply(new THREE.Matrix4().makeScale(s, s, s));
  for (const px of [-1.9, 1.9]) { b.add(new THREE.CylinderGeometry(0.2, 0.24, 4.4, 14).translate(px, 2.2, 0), M.red(), m); lb(b, M.black(), m, px - 0.3, px + 0.3, 0, 0.35, -0.3, 0.3); }
  lb(b, M.red(), m, -2.5, 2.5, 3.35, 3.65, -0.16, 0.16); // nuki
  lb(b, M.red(), m, -0.15, 0.15, 3.65, 4.3, -0.14, 0.14); // gakuzuka
  lb(b, M.red(), m, -2.85, 2.85, 4.3, 4.6, -0.22, 0.22); // shimaki
  // kasagi: three boxes rising toward the ends
  lb(b, M.black(), m, -1.6, 1.6, 4.6, 4.95, -0.3, 0.3);
  for (const sgn of [-1, 1]) b.add(UB, M.black(), m.clone().multiply(new THREE.Matrix4().compose(V(sgn * 2.55, 4.86, 0), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), sgn * 0.12), V(2.1, 0.35, 0.6))));
};
/** small shrine hall on a raised floor, cypress-coloured posts, tiled roof with a front porch roof */
export const shrineHall = (b: Batch, x: number, y: number, z: number, yaw: number) => {
  const m = frameOf(x, y, z, yaw), w = 5, d = 5, hw = w / 2, hd = d / 2, fl = 0.9, h = fl + 2.6, top = h + 2.2;
  lb(b, M.stoneBase(), m, -hw - 0.6, hw + 0.6, 0, 0.3, -hd - 0.6, hd + 0.6);
  for (const px of [-hw, 0, hw]) for (const pz of [-hd, hd]) lb(b, M.post(), m, px - 0.15, px + 0.15, 0.3, h, pz - 0.15, pz + 0.15);
  lb(b, M.beam(), m, -hw - 0.4, hw + 0.4, fl - 0.12, fl, -hd - 0.4, hd + 0.4); // floor + veranda
  lb(b, M.plaster(), m, -hw + 0.1, hw - 0.1, fl, h - 0.3, -hd + 0.1, hd - 0.1);
  b.add(quad(V(-hw * 0.6, fl, hd - 0.05), V(hw * 0.6, fl, hd - 0.05), V(hw * 0.6, h - 0.4, hd - 0.05), V(-hw * 0.6, h - 0.4, hd - 0.05), 2, 1), M.lattice(), m);
  lb(b, M.beam(), m, -hw - 0.2, hw + 0.2, h - 0.3, h, -hd - 0.2, hd + 0.2);
  b.add(quad(V(-hw - 1, h, hd + 1.6), V(hw + 1, h, hd + 1.6), V(hw + 1, top, 0), V(-hw - 1, top, 0), 2, 1.5), M.kawara(), m);
  b.add(quad(V(hw + 1, h, -hd - 1), V(-hw - 1, h, -hd - 1), V(-hw - 1, top, 0), V(hw + 1, top, 0), 2, 1.5), M.kawara(), m);
  for (const s of [-1, 1]) b.add(tri(V(s * (hw + 0.2), h, s * (hd + 0.2)), V(s * (hw + 0.2), h, -s * (hd + 0.2)), V(s * (hw + 0.2), top - 0.1, 0)), M.beam(), m);
  lb(b, M.ridge(), m, -hw - 1.1, hw + 1.1, top - 0.12, top + 0.25, -0.25, 0.25);
  // steps up to the veranda
  for (let i = 0; i < 3; i++) lb(b, M.beam(), m, -0.9, 0.9, 0.3 * i, 0.3 * i + 0.3, hd + 0.4 + (2 - i) * 0.35, hd + 0.75 + (2 - i) * 0.35);
};
/** straight flight of stone steps from (x0,y0,z0) to (x1,y1,z1), width w */
export const stoneSteps = (b: Batch, a: THREE.Vector3, c: THREE.Vector3, w = 3, n = 24) => {
  const dir = c.clone().sub(a), yaw = Math.atan2(dir.x, dir.z), run = Math.hypot(dir.x, dir.z), rise = dir.y;
  const m = frameOf(a.x, a.y, a.z, yaw);
  for (let i = 0; i < n; i++) {
    const z0 = (i * run) / n, z1 = ((i + 1) * run) / n, y1 = ((i + 1) * rise) / n;
    lb(b, M.steps(), m, -w / 2, w / 2, y1 - (rise / n) * 1.0 - 0.6, y1, z0, z1 + 0.05);
  }
  for (let i = 0; i < n; i++) { // low curbs that follow the slope, one block per step
    const z0 = (i * run) / n, z1 = ((i + 1) * run) / n, y1 = ((i + 1) * rise) / n;
    for (const s of [-1, 1]) lb(b, M.stoneBase(), m, s * (w / 2 + 0.2) - 0.2, s * (w / 2 + 0.2) + 0.2, y1 - (rise / n) - 0.6, y1 + 0.35, z0, z1 + 0.05);
  }
};
/** ishigaki sea wall along x at z, height h, its sea face toward -z */
export const seaWall = (b: Batch, z: number, x0: number, x1: number, h = 1.8, gaps: [number, number][] = []) => {
  const segs: [number, number][] = [];
  let x = x0;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > x) segs.push([x, g0]); x = Math.max(x, g1); }
  if (x < x1) segs.push([x, x1]);
  for (const [a0, a1] of segs) {
    b.add(quad(V(a1, -0.8, z), V(a0, -0.8, z), V(a0, h, z), V(a1, h, z), (a1 - a0) / 6, (h + 0.8) / 3), M.stone()); // sea face
    b.add(boxGeo(V(a0, h - 0.05, z), V(a1, h + 0.2, z + 1.6), 0), M.steps());
    b.add(quad(V(a0, 0, z + 1.6), V(a1, 0, z + 1.6), V(a1, h, z + 1.6), V(a0, h, z + 1.6), (a1 - a0) / 6, h / 3), M.stone());
  }
};

/** Japanese black pine: a leaning, kinked trunk and flat cloud pads (rounded, so the ink draws clean outlines) */
export const pine = (b: Batch, x: number, y: number, z: number, h: number, seed: number) => {
  const r = rng(seed), lean = (r() - 0.5) * 0.5, dir = r() * Math.PI * 2;
  let p = V(x, y, z);
  const segs = 4, pts: THREE.Vector3[] = [p.clone()];
  for (let i = 1; i <= segs; i++) {
    const k = i / segs;
    p = V(x + Math.cos(dir) * lean * h * k + (r() - 0.5) * 0.35 * h * 0.2, y + h * 0.72 * k, z + Math.sin(dir) * lean * h * k + (r() - 0.5) * 0.35 * h * 0.2);
    pts.push(p.clone());
  }
  for (let i = 0; i < segs; i++) {
    const a = pts[i], c = pts[i + 1], len = a.distanceTo(c), rad = 0.11 * h * 0.18 * (1 - i * 0.18);
    const g = new THREE.CylinderGeometry(rad * 0.85, rad, len, 7).translate(0, len / 2, 0);
    g.applyMatrix4(new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()), V(1, 1, 1)));
    b.add(g, M.pineBark());
  }
  const pads = 4 + Math.floor(r() * 3);
  for (let i = 0; i < pads; i++) {
    const k = 0.45 + (i / pads) * 0.6, base = pts[Math.min(segs, Math.round(k * segs))];
    const ang = r() * Math.PI * 2, out = (0.15 + r() * 0.25) * h;
    const c = V(base.x + Math.cos(ang) * out, base.y + (r() - 0.2) * 0.12 * h, base.z + Math.sin(ang) * out);
    const s = (0.22 + r() * 0.12) * h;
    const g = new THREE.SphereGeometry(1, 14, 8);
    g.applyMatrix4(new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), r() * 3), V(s, s * 0.34, s * 0.8)));
    b.add(g, i % 2 ? M.pineLeaf() : M.pineLeaf2());
  }
};

// ---------------- rice straw stacks ----------------
const stackProfile = [[0, 0], [0.62, 0], [0.68, 0.2], [0.64, 1.05], [0.74, 1.16], [0.52, 1.42], [0.24, 1.72], [0.05, 1.86], [0, 1.87]] as const;
export const stackGeo = () => new THREE.LatheGeometry(stackProfile.map(([a, c]) => new THREE.Vector2(a, c)), 18);
/** an unlit-by-fire static stack into the batch */
export const inamura = (b: Batch, x: number, z: number, s = 1) => {
  if (inTheWay(x - 0.8 * s, x + 0.8 * s, 0, 1.9 * s, z - 0.8 * s, z + 0.8 * s, true)) return;
  b.add(stackGeo().scale(s, s, s).translate(x, 0, z), M.straw());
};
/** a stack that can burn: its own mesh + material (charring darkens it) */
export const burnStack = (s = 1) => {
  const mat = (M.straw() as THREE.MeshLambertMaterial).clone();
  const mesh = new THREE.Mesh(stackGeo().scale(s, s, s), mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, mat };
};

// ---------------- embankment (built progressively) ----------------
/** trapezoid earth dike along x at z centre zc; base half-width bw, top half-width tw, height h; its geometry is unit
 *  height so the world can scale y with the construction progress */
export const embankment = (x0: number, x1: number, zc: number, bw = 5.5, tw = 1.8) => {
  const g = new THREE.BufferGeometry();
  const P: number[] = [], U: number[] = [];
  const faces: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
    [V(x0, 0, zc - bw), V(x1, 0, zc - bw), V(x1, 1, zc - tw), V(x0, 1, zc - tw)], // sea slope (faces -z)
    [V(x0, 1, zc - tw), V(x1, 1, zc - tw), V(x1, 1, zc + tw), V(x0, 1, zc + tw)], // top
    [V(x1, 0, zc + bw), V(x0, 0, zc + bw), V(x0, 1, zc + tw), V(x1, 1, zc + tw)], // land slope
  ];
  for (const [a, b2, c, d] of faces) {
    for (const v of [a, c, b2, a, d, c]) P.push(v.x, v.y, v.z);   // outward normals (was inside-out: the top read as shade)
    const L = (x1 - x0) / 6;
    U.push(0, 0, L, 1, L, 0, 0, 0, 0, 1, L, 1);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, M.earth());
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
};

// ---------------- flood debris ----------------
export const debrisPieces = (seed: number, n: number) => {
  const r = rng(seed), out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  for (let i = 0; i < n; i++) {
    const k = r();
    if (k < 0.5) out.push({ geo: new THREE.BoxGeometry(1.6 + r() * 1.6, 0.12, 0.3 + r() * 0.2), mat: M.plank() });
    else if (k < 0.75) out.push({ geo: new THREE.BoxGeometry(1.4, 0.08, 1.0), mat: M.kawara() });
    else out.push({ geo: new THREE.CylinderGeometry(0.38, 0.34, 0.9, 12), mat: M.barrel() });
  }
  return out;
};
