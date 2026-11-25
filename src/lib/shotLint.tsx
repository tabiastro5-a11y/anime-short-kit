// Shot lint: checks every cut of a video BEFORE any still is rendered (no WebGL: only the scene graph is posed).
// Made after an episode where four mistakes reached the user (2026-11-25): an invisible ceiling, the room sticking out of
// its house in the aerial, a rider facing backwards on a bicycle and a motorbike "sliding sideways".
// Three checks, on a few frames of every shot:
//   1 facing  : a camera-facing (front) character card that moves ACROSS the frame; a vehicle / prop tagged with
//               `userData.forward` (its local forward axis) that moves another way than it points.
//   2 stray   : something of a set the shot does not use is in view (first thing a camera ray hits).
//   3 holes   : in an interior shot a camera ray leaves the room without passing through a declared opening
//               (missing ceiling, a wall built inside out, an open corner).
// How a video opts in: a `<Composition id="<Name>Lint" component={() => <ShotLint cfg={...} />}>` and tags in its world:
//   group.userData.set = "room" | "ski" | ...  (untagged = "world");  object.userData.forward = [x, y, z].
// Run:  node scripts/shot_lint.mjs <Name>Lint [out/<name>/check/lint.md]
import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender } from "remotion";

export type LintPlace = { who?: string; key: string; x: number; y: number; z: number };
export type LintWorld = { root: THREE.Object3D; update: (id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) => unknown; lastPlaces?: LintPlace[] };
export type LintShot = { id: number; a: number; b: number };
export type LintCfg = {
  name: string;
  load: () => Promise<unknown>;
  makeWorld: (kit: never) => LintWorld;
  shots: LintShot[];
  /** sets that may be seen in this shot (untagged objects are "world") */
  allowed: (shot: LintShot) => string[];
  /** interior shots: the set that must enclose the camera, and the openings (world boxes) a ray may leave through */
  interior?: (shot: LintShot) => { set: string; openings: THREE.Box3[] } | null;
  /** frames to skip (e.g. a planned hard cut inside a shot is fine; rarely needed) */
  aspect?: number;
};
export type Issue = { shot: number; frame: number; kind: "facing" | "vehicle" | "stray" | "hole"; text: string };

const setOf = (o: THREE.Object3D | null): string => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.set) return p.userData.set as string; return "world"; };
const shown = (o: THREE.Object3D | null) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const BIG = 60000;   // triangles: heavier meshes are tested by their box only (no BVH here)
type Target = { mesh: THREE.Mesh; set: string; box: THREE.Box3 | null };
const targets = (root: THREE.Object3D) => {
  const out: Target[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.layers.test(L0) || !shown(m)) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || (mat as THREE.Material).transparent) return;
    const pos = m.geometry.attributes.position; if (!pos) return;
    const tris = (m.geometry.index ? m.geometry.index.count : pos.count) / 3;
    out.push({ mesh: m, set: setOf(m), box: tris > BIG ? new THREE.Box3().setFromObject(m) : null });
  });
  return out;
};
const L0 = new THREE.Layers();
const tmpV = new THREE.Vector3();
/** nearest thing a ray hits: [distance, set] or null */
const cast = (rc: THREE.Raycaster, ts: Target[]): [number, string] | null => {
  let best: [number, string] | null = null;
  const hits: THREE.Intersection[] = [];
  for (const t of ts) {
    if (t.box) { const p = rc.ray.intersectBox(t.box, tmpV); if (p) { const d = p.distanceTo(rc.ray.origin); if (!best || d < best[0]) best = [d, t.set]; } continue; }
    hits.length = 0; t.mesh.raycast(rc, hits);
    for (const h of hits) if (h.distance > rc.near && (!best || h.distance < best[0])) best = [h.distance, t.set];
  }
  return best;
};
const where = (u: number, v: number) => `${v < 0.33 ? "上" : v > 0.66 ? "下" : "中"}${u < 0.33 ? "左" : u > 0.66 ? "右" : "央"}`;

export const lintVideo = (cfg: LintCfg, world: LintWorld): Issue[] => {
  const issues: Issue[] = [], cam = new THREE.PerspectiveCamera(40, cfg.aspect ?? 1080 / 1920, 0.1, 4000), scene = new THREE.Scene();
  scene.add(world.root);
  const rc = new THREE.Raycaster(); rc.near = 0.05;
  const NX = 7, NY = 12, D = 3;
  for (const s of cfg.shots) {
    const len = s.b - s.a, frames = [...new Set([s.a + Math.min(4, len - 1), s.a + Math.floor(len / 2), s.b - Math.min(5, len)])].filter((f) => f >= s.a + D && f < s.b - D);
    const seen = new Set<string>();
    const add = (frame: number, kind: Issue["kind"], text: string) => { const k = kind + text; if (!seen.has(k)) { seen.add(k); issues.push({ shot: s.id, frame, kind, text }); } };
    for (const f of frames) {
      // ---- motion: positions D frames before and after
      const snap = (ff: number) => {
        world.update(s.id, ff, cam, scene); scene.updateMatrixWorld(true);
        const cards = new Map<string, THREE.Vector3>(); for (const p of world.lastPlaces ?? []) if (p.who) cards.set(p.who, new THREE.Vector3(p.x, p.y, p.z));
        const props = new Map<THREE.Object3D, THREE.Vector3>();
        world.root.traverse((o) => { if (o.userData && o.userData.forward && shown(o)) props.set(o, o.getWorldPosition(new THREE.Vector3())); });
        return { cards, props };
      };
      const A = snap(f - D), B = snap(f + D);
      world.update(s.id, f, cam, scene); scene.updateMatrixWorld(true); cam.updateMatrixWorld(true);
      const camP = cam.getWorldPosition(new THREE.Vector3());
      for (const p of world.lastPlaces ?? []) {
        if (!p.who || !p.key.startsWith("F|")) continue;
        const a = A.cards.get(p.who), b = B.cards.get(p.who); if (!a || !b) continue;
        const v = b.clone().sub(a).setY(0), sp = (v.length() / (2 * D)) * 30;
        if (sp < 0.7) continue;                                   // slower than a slow walk: standing, shuffling
        const toCam = camP.clone().sub(tmpV.set(p.x, p.y, p.z)).setY(0).normalize(), c = v.normalize().dot(toCam), back = p.key.includes('"back":true');
        if (Math.abs(c) < 0.5) add(f, "facing", `${p.who}：正面の絵のまま画面を横切っている（速さ ${sp.toFixed(1)} m/秒）。カメラに向かって来る撮り方にするか、横向きの絵にする`);
        else if (c < 0 && !back) add(f, "facing", `${p.who}：カメラから遠ざかっているのに正面の絵（後ろ姿にする）`);
        else if (c > 0 && back) add(f, "facing", `${p.who}：カメラに近づいているのに後ろ姿の絵`);
      }
      for (const [o, a] of A.props) {
        const b = B.props.get(o); if (!b) continue;
        const v = b.clone().sub(a).setY(0), sp = (v.length() / (2 * D)) * 30;
        if (sp < 0.5) continue;
        const fw = new THREE.Vector3(...(o.userData.forward as [number, number, number])).transformDirection(o.matrixWorld).setY(0).normalize();
        const deg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(fw.dot(v.normalize()), -1, 1)));
        if (deg > 30) add(f, "vehicle", `${o.name || "乗り物"}：前の向きと進む向きが ${deg.toFixed(0)}° ずれている（${deg > 150 ? "前後が逆" : deg > 60 && deg < 120 ? "横向きに滑っている" : "斜め"}）`);
      }
      // ---- rays: stray sets and holes
      const ts = targets(world.root), allowed = new Set(cfg.allowed(s)), inside = cfg.interior ? cfg.interior(s) : null;
      const stray = new Map<string, string[]>(), holes: string[] = [];
      for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
        const u = (ix + 0.5) / NX, v = (iy + 0.5) / NY;
        rc.setFromCamera(new THREE.Vector2(u * 2 - 1, 1 - v * 2), cam);
        const h = cast(rc, ts);
        if (h && !allowed.has(h[1]) && h[0] < 1200) { const l = stray.get(h[1]) ?? []; l.push(where(u, v)); stray.set(h[1], l); }
        if (inside && (!h || h[1] !== inside.set) && !inside.openings.some((b) => rc.ray.intersectsBox(b))) holes.push(where(u, v));
      }
      for (const [set, l] of stray) add(f, "stray", `このカットで使わない場所「${set}」の物が映っている（画面の ${[...new Set(l)].join("・")}、${l.length}/${NX * NY} 点）`);
      if (holes.length > 1) add(f, "hole", `室内なのに、壁・天井・床が抜けて外が見える（画面の ${[...new Set(holes)].join("・")}、${holes.length}/${NX * NY} 点）`);
    }
  }
  return issues;
};

/** the lint as a 1-frame composition: runs once, prints `[lint] <json>` to the browser console and shows the report */
export const ShotLint: React.FC<{ cfg: LintCfg }> = ({ cfg }) => {
  const [rep, setRep] = useState<Issue[] | null>(null);
  const [h] = useState(() => delayRender("shot lint", { timeoutInMilliseconds: 600000 }));
  useEffect(() => {
    cfg.load().then((kit) => {
      let out: Issue[];
      try { out = lintVideo(cfg, cfg.makeWorld(kit as never)); } catch (e) { out = [{ shot: 0, frame: 0, kind: "hole", text: "lint crashed: " + String((e as Error).stack ?? e).slice(0, 400) }]; }
      console.log("[lint] " + JSON.stringify({ name: cfg.name, shots: cfg.shots.length, issues: out }));
      setRep(out); continueRender(h);
    });
  }, [cfg, h]);
  return (
    <AbsoluteFill style={{ background: "#fff", color: "#111", fontSize: 26, padding: 40, fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 40, fontWeight: 700 }}>{cfg.name} lint: {rep ? `${rep.length} 件` : "..."}</div>
      {(rep ?? []).map((i, k) => <div key={k} style={{ marginTop: 12 }}>カット {i.shot}（f{i.frame}） [{i.kind}] {i.text}</div>)}
    </AbsoluteFill>
  );
};
