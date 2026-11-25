// 01_inamura: the whole place as one three.js scene, posed per frame from the story (story.ts). Sky, light rig, fog,
// clouds, water shader and the card/effect plumbing are the bridge template's (world.ts); the place is ours: an Edo
// fishing-and-farming village (japan.ts buildings), harvested paddies with rice-straw stacks, the shrine hill, the
// ishigaki sea wall, the embankment that rises over shots 18-19, the sea, the 1854 flood and the two tsunami walls.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, V, lam, Kit, Ray, setSight, prop, quad, inTheWay, toLambert } from "./build";
import { rep, ctex, waterNear, waterFar, cloudHD, grassHD } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset, Light } from "./lights";
import { TONE, CHAR, LFB, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, burnOf } from "./cast";
import { FPS, SHOTS, STACKS, STREET_Z, WALL_Z, DIKE_Z, DIKE_H, HILL, STEPS_A, STEPS_B, TORII, SHOP, camAt, floodAt, waveAt, dikeAt, ruinedAt, V3, ShotDef, FOREGROUND } from "./story";
import { minka, machiya, kura, torii, shrineHall, stoneSteps, seaWall, pine, inamura, burnStack, embankment, debrisPieces, paddyHD, dirtHD, sandHD, embankHD, freshEarthMat, dikeSite, EXT } from "./japan";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "plant_bushLarge", "plant_bushDetailed", "plant_bush", "grass_large", "grass"];
const JAPAN = ["stone_lantern_duncansoneill", "well", "boat", "fence_fatfreebeefcake", "house_duperonvincent", "daniel_house", "kolya_minka", "juoda_minka", "mattzch_pine"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    const load = (dir: string, n: string) => loader.loadAsync(staticFile(`${dir}/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const);
    const grass = new THREE.TextureLoader().loadAsync(staticFile("japan/textures/grass_handpainted.png")).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; EXT.grass = t;
    }).catch(() => undefined);
    kitP = Promise.all([...KENNEY.map((n) => load("bridge/kenney", n)), ...JAPAN.map((n) => load("japan/models", n))])
      .then(async (list) => {
        await grass;
        const kit = Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit;
        // downloaded models: textures bigger than they ever appear on screen are scaled down (memory, same look)
        for (const [n, max] of [["juoda_minka", 512], ["mattzch_pine", 1024], ["daniel_house", 1024], ["kolya_minka", 1024]] as const) if (kit[n]) shrinkTextures(kit[n], max);
        return kit;
      });
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** soft round glow for the fires (additive, HDR colour so only it blooms) */
const glowTex = () => ctex("fireGlow", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.35, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
/** the wave face: deep blue at the base to pale at the lip, foam streaks and a white crest, ink contour lines */
const waveTex = () => ctex("waveFace", 1024, 1024, (g, r) => {
  const gr = g.createLinearGradient(0, 1024, 0, 0);
  gr.addColorStop(0, "#123a78"); gr.addColorStop(0.55, "#2f72b8"); gr.addColorStop(0.82, "#6cb2e2"); gr.addColorStop(1, "#e8f6ff");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 120; i++) { const x = r() * 1024, y = 300 + r() * 600; g.strokeStyle = `rgba(230,246,255,${0.15 + r() * 0.25})`; g.lineWidth = 3 + r() * 4; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 10, y - 80, x - 10, y - 160, x + 6, y - 240); g.stroke(); }
  for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(14,20,48,0.55)"; g.lineWidth = 5; const y = 260 + k * 120; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + 14 * Math.sin(x * 0.02 + k)); g.stroke(); }
  g.fillStyle = "#f4fbff"; g.fillRect(0, 0, 1024, 110);
  for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.arc(x + 32, 110, 30, 0, Math.PI); g.fill(); }
});

/** every lens position of the film looking at its subject (houses / trees there are left out), as in the template */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

/** horizontal ground quad at height y (z0 < z1), uv tiles u x v */
const ground = (x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = 0) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
/** shrine hill: a smooth mound (flat top radius 9 at HILL y), lathe around its centre */
const hillGeo = () => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) { const r = 34 - i * (34 / 24); const k = Math.min(1, Math.max(0, (34 - r) / 24)); pts.push(new THREE.Vector2(Math.max(0.01, r), HILL[1] * (k * k * (3 - 2 * k)))); }
  pts.push(new THREE.Vector2(0, HILL[1]));
  const g = new THREE.LatheGeometry(pts, 48);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 6);
  return g.translate(HILL[0], 0, HILL[2]);
};
/** curling wave wall, unit size along x (width scaled), profile in (z, y) */
const waveGeo = () => {
  const prof: [number, number][] = [[-16, 0], [-9, 0.3], [-4.5, 0.66], [-1.6, 0.93], [0, 1.0], [0.9, 0.92], [1.35, 0.72], [1.0, 0.56], [0.4, 0.52], [1.5, 0.22], [2.4, 0]];
  const s = new THREE.Shape(); s.moveTo(prof[0][0], prof[0][1]); prof.slice(1).forEach(([z, y]) => s.lineTo(z, y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 6 });
  g.rotateY(-Math.PI / 2); g.translate(0.5, 0, 0);
  const pos = g.attributes.position as THREE.BufferAttribute, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) * 8; uv[i * 2 + 1] = pos.getY(i); }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
};

/** scale every texture of a model down to at most `max` px on its long side (once per texture) */
const shrunk = new WeakSet<THREE.Texture>();
const shrinkTextures = (o: THREE.Object3D, max: number) => o.traverse((c) => {
  const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
  if (!m) return;
  for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const) {
    const t = m[key] as THREE.Texture | null;
    if (!t || shrunk.has(t) || !t.image) continue;
    shrunk.add(t);
    if (key !== "map") { m[key] = null; continue; } // the two-tone material only uses the colour map
    const img = t.image as CanvasImageSource & { width: number; height: number }, k = max / Math.max(img.width, img.height);
    if (k >= 1) continue;
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    t.image = cv; t.needsUpdate = true;
  }
});
/** model fronts: yaw added so the model's front faces the yaw the layout asks for (checked on stills) */
const TOWN_YAW = 0, KOLYA_YAW = 0, FARM_YAW = 0;
/** a downloaded model with two-tone materials, prepared once; every placement is a clone that SHARES its geometry and
 *  materials (merging copies into the batch multiplied the memory by the number of houses) */
const prepared = new WeakMap<THREE.Object3D, THREE.Object3D>();
const sharedModel = (o: THREE.Object3D) => {
  let p = prepared.get(o);
  if (!p) {
    p = o.clone();
    p.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = true; m.receiveShadow = true; } });
    prepared.set(o, p);
  }
  return p;
};
/** a downloaded model fitted to a footprint: its larger horizontal side = size (by = "w") or its height = size ("h");
 *  with cull = true it is skipped when a camera's sight line runs through it (like the code-built houses) */
const fitModel = (parent: THREE.Object3D, o: THREE.Object3D, x: number, y: number, z: number, yaw: number, size: number, cull: boolean, by: "w" | "h" = "w") => {
  const box = new THREE.Box3().setFromObject(o), sx = box.max.x - box.min.x, sy = box.max.y - box.min.y, sz = box.max.z - box.min.z;
  const s = size / Math.max(0.01, by === "h" ? sy : Math.max(sx, sz)), r = 0.5 * Math.max(sx, sz) * s, h = sy * s;
  if (cull && inTheWay(x - r, x + r, y, y + h, z - r, z + r, true)) return true; // culled on purpose: no fallback either
  const c = box.getCenter(new THREE.Vector3()), q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
  const off = V(-c.x * s, -box.min.y * s, -c.z * s).applyQuaternion(q), inst = sharedModel(o).clone();
  inst.position.set(x + off.x, y + off.y, z + off.z); inst.quaternion.copy(q); inst.scale.setScalar(s);
  parent.add(inst);
  return true;
};
/** a street house: tiled-roof house by DanielStringer (CC BY 4.0), every 4th a group of thatched houses by kolya5561
 *  (CC BY 4.0). Returns false when the models are missing (the code-built houses are used then) */
const townHouse = (b: THREE.Object3D, kit: Kit, k: number, x: number, z: number, yaw: number, w: number) => {
  const big = k % 4 === 2 && kit.kolya_minka, m = big ? kit.kolya_minka : kit.daniel_house;
  if (!m) return false;
  return fitModel(b, m, x, 0, z, yaw + (big ? KOLYA_YAW : TOWN_YAW), big ? Math.max(w, 11) : Math.max(w, 7.5), true);
};
/** the shop model's texture has bright moss on the roof tiles that our saturation turns gold: pull yellow-green
 *  pixels toward the tile grey (once per texture) */
const tamed = new WeakSet<THREE.Texture>();
const tameMoss = (o: THREE.Object3D) => o.traverse((c) => {
  const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
  const t = m?.map;
  if (!t || tamed.has(t) || !t.image) return;
  tamed.add(t);
  const img = t.image as CanvasImageSource & { width: number; height: number };
  const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext("2d")!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], gg = a[i + 1], b = a[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (gg >= r - 12 && gg >= b + 40 && mx - mn > 40) { const y = 0.3 * r + 0.59 * gg + 0.11 * b; a[i] = a[i + 1] = a[i + 2] = y * 0.8; }
  }
  g.putImageData(d, 0, 0);
  t.image = cv; t.needsUpdate = true;
});
/** model's front faces -z after this yaw (checked on the still of shot 5) */
const SHOP_YAW = Math.PI;
/** a downloaded model scaled to height h, base on y, merged into the batch WITHOUT the sight-line test */
const placeModel = (b: Batch, o: THREE.Object3D, x: number, y: number, z: number, h: number, yaw: number) => {
  const box = new THREE.Box3().setFromObject(o), s = h / Math.max(0.01, box.max.y - box.min.y);
  const c = box.getCenter(new THREE.Vector3());
  const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), off = V(-c.x * s, -box.min.y * s, -c.z * s).applyQuaternion(q);
  b.addObject(o, new THREE.Matrix4().compose(V(x + off.x, y + off.y, z + off.z), q, V(s, s, s)));
};
type BurnStack = { mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; glow: THREE.Sprite; base: THREE.Color };

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<Light, THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private stacks: BurnStack[] = [];
  private flood: THREE.Mesh; private wave: THREE.Mesh;
  private dike: THREE.Mesh; private dikePines: THREE.Group[] = []; private dikeBase: [number, number, number][] = [];
  private dikeGrass!: THREE.Material; private dikeEarth!: THREE.Material; private site!: THREE.Group;
  private floatDebris: { m: THREE.Mesh; x: number; z: number; ph: number }[] = [];
  private groundDebris = new THREE.Group();
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light (template) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true, transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    const lights: Light[] = ["day", "golden", "night"];
    this.cloudMaps = Object.fromEntries(lights.map((l) => [l, [0, 1, 2, 3].map((k) => cloudHD(k, LOOK[l].cloud))])) as unknown as Record<Light, THREE.Texture[]>;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 36, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }

    // ---- ground (static batch) ----
    setSight(sightLines());
    const b = new Batch();
    const paddy = lam("paddyHD", () => ({ map: paddyHD() })), dirt = lam("dirtHD", () => ({ map: dirtHD() })), sand = lam("sandHD", () => ({ map: sandHD() }));
    const grass = lam("grassHD", () => ({ map: grassHD() })), aze = lam("aze", () => ({ map: embankHD() }));
    b.add(ground(-900, 900, -14, 900, 180, 180), grass);                // country beyond
    b.add(ground(-110, 110, -14, 95, 22, 11, 0.01), paddy);             // the harvested paddies
    for (let x = -110; x <= 110; x += 14) b.add(new THREE.BoxGeometry(0.7, 0.28, 109).translate(x, 0.12, 40.5), aze);   // ridges (aze)
    for (let z = -14; z <= 95; z += 13) b.add(new THREE.BoxGeometry(220, 0.28, 0.7).translate(0, 0.12, z), aze);
    b.add(ground(-900, 900, -52, -14, 180, 8), dirt);                   // village ground
    b.add(ground(-110, 110, STREET_Z - 3, STREET_Z + 3, 30, 1.6, 0.012), lam("street", () => ({ map: rep(dirtHD(), 1, 1) })));
    b.add(ground(-900, 900, -60, WALL_Z, 180, 2, -0.15), sand);         // beach outside the sea wall
    b.add(hillGeo(), lam("hill", () => ({ map: grassHD() })));
    // far mountains (fog turns them to the horizon colour)
    const mtn = lam("mountain", () => ({ color: "#4f7a52" }));
    for (const [x, z, r, h] of [[-260, 420, 160, 120], [40, 520, 200, 150], [320, 440, 170, 110], [-480, 200, 150, 90], [520, 180, 160, 100]] as const)
      b.add(new THREE.ConeGeometry(r, h, 9).translate(x, h / 2 - 4, z), mtn);
    seaWall(b, WALL_Z, -160, 160, 1.8);
    b.build(R);

    // ---- the sea + the flood (template water shader) ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;").replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", WATER_DECL).replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "sea1";
    const sea = new THREE.Mesh(ground(-1200, 1200, -1200, WALL_Z - 4, 1, 1, -0.6), waterM);
    sea.receiveShadow = true; R.add(sea);
    this.flood = new THREE.Mesh(ground(-120, 120, -60, -8, 1, 1, 0), waterM);
    this.flood.visible = false; R.add(this.flood);
    // ---- tsunami wall ----
    this.wave = new THREE.Mesh(waveGeo(), lam("waveFace", () => ({ map: waveTex(), side: THREE.DoubleSide })));
    this.wave.castShadow = true; this.wave.visible = false; R.add(this.wave);

    // ---- village ----
    const vb = new Batch();
    // Goryo's soy shop: "Low Poly Japenese House" by duperonvincent (CC BY 4.0, CREDITS.md), placed without the
    // sight-line test (it is the subject of shot 5); falls back to the code-built machiya when the model is missing
    if (kit.house_duperonvincent) tameMoss(kit.house_duperonvincent);
    if (kit.house_duperonvincent) placeModel(vb, kit.house_duperonvincent, SHOP[0], 0, SHOP[2] + 1.5, 8.5, SHOP_YAW);
    else machiya(vb, SHOP[0], SHOP[2], Math.PI, 6.5, 8, { shop: true });
    let x = -64;
    let k = 0;
    while (x < 66) {   // north row: fronts face the street (-z)
      const w = [7, 6, 9, 5.5][k % 4];
      if (Math.abs(x + w / 2 - SHOP[0]) > 6) {
        const cz = STREET_Z + 3.2 + 4;
        if (!townHouse(R, kit, k, x + w / 2, cz, Math.PI, w)) { if (k % 4 === 2) minka(vb, x + w / 2, cz + 0.8, Math.PI, w, 6.5); else if (k % 4 === 3) kura(vb, x + w / 2, cz, Math.PI, w, 4.5); else machiya(vb, x + w / 2, cz, Math.PI, w, 8); }
      }
      x += w + 1.2; k++;
    }
    x = -66; k = 1;
    while (x < 64) {   // south row: fronts face the street (+z)
      const w = [9, 6, 7, 5][k % 4], cz = STREET_Z - 3.2 - 3.6;
      if (!townHouse(R, kit, k + 1, x + w / 2, cz, 0, w)) { if (k % 3 === 0) kura(vb, x + w / 2, cz, 0, Math.min(w, 5.5), 4.5); else if (k % 2) minka(vb, x + w / 2, cz - 0.6, 0, w, 6.5); else machiya(vb, x + w / 2, cz, 0, w, 7); }
      x += w + 1.4; k++;
    }
    // farmhouses scattered at the field edge and toward the hill
    for (const [hx, hz, yaw] of [[-40, -6, 0.3], [-62, 8, -0.4], [28, 20, 0.9], [78, 40, 1.4], [-30, 30, 0.2], [10, 62, -0.6]] as const) {
      const m = kit.juoda_minka;   // thatched farmhouse "Minka" by Juoda (CC BY 4.0)
      if (!m || !fitModel(R, m, hx, 0, hz, yaw + FARM_YAW, 14, true)) minka(vb, hx, hz, yaw, 9, 6.5);
    }
    // shrine: steps, torii at the foot, the hall on top, stone lanterns
    stoneSteps(vb, V(...STEPS_A), V(...STEPS_B), 3.2, 28);
    torii(vb, TORII[0], TORII[2], Math.PI / 4, 1.05);
    shrineHall(vb, HILL[0] + 2.5, HILL[1], HILL[2] + 2.5, -3 * Math.PI / 4);
    for (const [lx, lz] of [[41.0, 53.0], [45.4, 48.6]] as const) prop(vb, kit, "stone_lantern_duncansoneill", lx, 0, lz, 1.7, Math.PI / 4);
    // trees: on the hill, along the field edges
    const tr = (n: string, tx: number, ty: number, tz: number, h: number) => prop(vb, kit, n, tx, ty, tz, h, tx * 0.3);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = 12 + (i % 3) * 5, tx = HILL[0] + Math.cos(a) * r, tz = HILL[2] + Math.sin(a) * r;
      if (Math.hypot(tx - (STEPS_A[0] + STEPS_B[0]) / 2, tz - (STEPS_A[2] + STEPS_B[2]) / 2) < 8) continue;
      const k2 = Math.min(1, Math.max(0, (34 - r) / 24)), ty = HILL[1] * k2 * k2 * (3 - 2 * k2);
      tr(["tree_oak", "tree_fat", "tree_default"][i % 3], tx, ty, tz, 7 + (i % 3));
    }
    for (const [tx, tz] of [[-70, -2], [-55, 18], [70, 2], [92, 22], [-88, 40], [20, 92]] as const) tr("tree_fat", tx, 0, tz, 8);
    // old pines along the shore (they were there before the dike) and a few village props
    for (const px of [-140, -118, 104, 126]) { // old shore pines beyond the dike's ends ("Japanese Black Pine" by mattzch, CC BY 4.0)
      if (!kit.mattzch_pine || !fitModel(R, kit.mattzch_pine, px, 0, WALL_Z + 3.2 + (px % 3), px * 0.7, 9, true, "h")) pine(vb, px, 0, WALL_Z + 3.2 + (px % 3), 9, 300 + px);
    }
    prop(vb, kit, "well", -12, 0, STREET_Z + 2.4, 2.2, 0.4);
    prop(vb, kit, "boat", -34, -0.2, -56.5, 1.1, 1.2);
    prop(vb, kit, "boat", 22, -0.2, -57.5, 1.1, -0.5);
    // straw stacks that stay unlit (the rest of the harvest)
    for (let i = 0; i < 60; i++) {
      const sx = -100 + ((i * 37) % 200), sz = -8 + ((i * 53) % 100);
      if (STACKS.some(([ax, , az]) => Math.hypot(ax - sx, az - sz) < 6)) continue;
      if (Math.hypot(sx - HILL[0], sz - HILL[2]) < 36) continue;
      inamura(vb, sx, sz, 0.9 + (i % 3) * 0.1);
    }
    vb.build(R);
    setSight([]);

    // ---- the stacks Goryo burns ----
    const gt = glowTex();
    for (const [sx, sy, sz] of STACKS) {
      const st = burnStack(1.05);
      st.mesh.position.set(sx, sy, sz); R.add(st.mesh);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(2.2, 1.0, 0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      glow.layers.set(NOINK); glow.position.set(sx, sy + 2.0, sz); glow.visible = false; R.add(glow);
      this.stacks.push({ mesh: st.mesh, mat: st.mat, glow, base: st.mat.color.clone() });
    }

    // ---- the embankment (scaled in y with the construction) + its pines ----
    this.dike = embankment(-80, 80, DIKE_Z, 5.5, 1.8);
    this.dike.visible = false; R.add(this.dike);
    this.dikeGrass = this.dike.material as THREE.Material; this.dikeEarth = freshEarthMat();
    this.site = dikeSite(-80, 80, DIKE_Z, 5.5); this.site.visible = false; R.add(this.site);
    // one pine built once; every dike pine is a clone sharing its geometry (a downloaded pine is 158k triangles)
    const pineBase = (() => {
      const pb = new Batch(), grp = new THREE.Group();
      if (kit.mattzch_pine) placeModel(pb, kit.mattzch_pine, 0, 0, 0, 8.5, 0); else pine(pb, 0, 0, 0, 8.5, 700);
      pb.build(grp);
      grp.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = true; } });
      return grp;
    })();
    for (let i = 0; i < 14; i++) {
      const px = -72 + i * 11 + (i % 2) * 3, pz = DIKE_Z - 4.2 + (i % 2) * 0.6, py = DIKE_H * ((pz - (DIKE_Z - 5.5)) / 3.7);
      const grp = pineBase.clone();
      grp.rotation.y = i * 1.9;
      grp.position.set(px, Math.max(0, py), pz); grp.visible = false;
      this.dikePines.push(grp); this.dikeBase.push([px, py, pz]); R.add(grp);
    }

    // ---- debris: floating in the flood (shot 9), lying in the mud next morning (14-17) ----
    debrisPieces(5, 18).forEach(({ geo, mat }, i) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true;
      const dx = -6 + (i * 7.3) % 22, dz = STREET_Z + ((i * 3.1) % 6) - 3;
      this.floatDebris.push({ m, x: dx, z: dz, ph: i * 1.7 }); m.visible = false; R.add(m);
    });
    debrisPieces(9, 26).forEach(({ geo, mat }, i) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
      m.position.set(-14 + ((i * 5.7) % 30), 0.08, STREET_Z + ((i * 2.3) % 5.5) - 2.8); m.rotation.set(0.04 * (i % 3), i * 0.9, 0.06 * (i % 2));
      this.groundDebris.add(m);
    });
    this.groundDebris.visible = false; R.add(this.groundDebris);
    void FOREGROUND;
  }

  /** camera-relative sun, frozen per shot (template) */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig (template) ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;

    // ---- story state ----
    const tau = s.fire?.(t);
    this.stacks.forEach((st, k) => {
      const burn = tau === undefined || tau === null ? 0 : burnOf(k, tau);
      const ash = burn < 0;
      st.mesh.scale.set(1, ash ? 0.32 : 1 - 0.25 * Math.max(0, burn - 0.6), 1);
      const ch = ash ? 0.85 : Math.max(0, burn - 0.35) * 0.9;
      st.mat.color.copy(st.base).multiplyScalar(1 - ch * 0.85);
      st.mat.emissive.setRGB(0.26, 0.1, 0.02).multiplyScalar(ash ? 0 : Math.min(1, burn * 1.4));
      st.glow.visible = burn > 0.05;
      if (st.glow.visible) { const fl = 1 + 0.12 * Math.sin(t * 17 + k) + 0.08 * Math.sin(t * 31 + k * 2); st.glow.scale.setScalar(5.5 * burn * fl); }
    });
    const lv = floodAt(id, t);
    this.flood.visible = lv > -0.9; this.flood.position.y = lv;
    const wv = waveAt(id, t);
    this.wave.visible = wv.show && wv.crashed < 0.7;
    if (this.wave.visible) { this.wave.position.set(0, -0.6, wv.z); this.wave.scale.set(320, wv.h * (1 - 0.6 * wv.crashed), 1.2 * wv.h); }
    const dk = dikeAt(id, t);
    this.dike.visible = dk.built > 0.01;
    this.dike.scale.y = Math.max(0.001, dk.built * DIKE_H);
    this.dike.material = dk.workers && id === 18 ? this.dikeEarth : this.dikeGrass;   // bare tamped earth while it is built
    this.site.visible = id === 18;
    this.dikePines.forEach((g, i) => {
      g.visible = dk.pines > 0 && dk.built > 0.9;
      const [px, py, pz] = this.dikeBase[i];
      g.position.set(px, Math.max(0, py), pz); g.scale.setScalar(Math.max(0.05, dk.pines * (0.85 + 0.25 * ((i * 7) % 3) / 2)));
    });
    for (const d of this.floatDebris) {
      d.m.visible = id === 9;
      if (d.m.visible) { d.m.position.set(d.x + 0.25 * Math.sin(t * 0.7 + d.ph), lv + 0.08 * Math.sin(t * 1.9 + d.ph), d.z); d.m.rotation.set(0.12 * Math.sin(t * 1.3 + d.ph), d.ph, 0.1 * Math.cos(t * 1.1 + d.ph)); }
    }
    this.groundDebris.visible = ruinedAt(id) && id !== 9;

    // ---- cast + effects (template plumbing) ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    void Pen; void quad;
    return focus;
  }
}

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.0, 0.25 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
