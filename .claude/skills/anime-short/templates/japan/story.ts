// Timeline of "稲むらの火" (01_inamura): shots timed to the voice words (episodes/<名前>/voice/
// words.json, 文節 units), story state (fires, flood, tsunami, embankment) and the camera grammar of the bridge template:
// smootherstep glides, every hold creeps, cuts on big jumps, crossfades at place/time changes, impact kicks.
// World layout (metres, y up): sea to the south (z < -56), ishigaki sea wall at z = -52, the 1855-58 embankment
// centred on z = -46, the street along x at z = -28 with houses on both sides, harvested paddies to the north
// (z -14 .. 90) with a line of rice-straw stacks leading NE to the shrine hill (centre 62, 70; torii at its foot).
export const FPS = 30;
export const TOTAL = 1932;
export const D0 = 0; // ground level (build.ts house() default)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ---------------- places ----------------
export const STREET_Z = -28;
export const WALL_Z = -52;
export const DIKE_Z = -46, DIKE_H = 5;
export const HILL: V3 = [62, 9, 70];
export const STEPS_A: V3 = [43.6, 0, 51.6], STEPS_B: V3 = [55.6, 9, 63.6];
export const TORII: V3 = [42.2, 0, 50.2];
export const SHOP: V3 = [4, 0, -18];       // Goryo's soy shop (north row, front faces the street at z = -22)
/** the line of straw stacks Goryo lights, from the village edge to the torii */
const PA: V3 = [-16, 0, -10], PB: V3 = [38.5, 0, 45.5];
export const STACKS: V3[] = Array.from({ length: 14 }, (_, k) => {
  const u = k / 13, side = (k % 2 ? 1 : -1) * 0.9;
  return [lerp(PA[0], PB[0], u) + side * 0.7, 0, lerp(PA[2], PB[2], u) - side * 0.7] as V3;
});
export const IGNITE = (k: number) => 2.2 * k + 0.4; // fire story time when stack k catches
/** Goryo along the stack line at fire time tau: stands at each stack while lighting it, walks quickly between */
export const goryoAt = (tau: number): { p: V3; walking: boolean; dir: [number, number] } => {
  const k = Math.max(0, Math.min(13, Math.floor((tau + 0.6) / 2.2)));
  const t0 = IGNITE(k) - 0.6, u = clamp01((tau - t0 - 0.9) / 1.3);
  const a = STACKS[k], b = STACKS[Math.min(13, k + 1)];
  const off: V3 = [1.3, 0, 0.3]; // stands beside the stack he lights (screen-left of it in shots 1/10), torch reaching right
  const dx = b[0] - a[0], dz = b[2] - a[2], n = Math.hypot(dx, dz) || 1;
  return { p: [lerp(a[0], b[0], smooth(u)) + off[0], 0, lerp(a[2], b[2], smooth(u)) + off[2]], walking: u > 0.02 && u < 0.98, dir: [dx / n, dz / n] };
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; fire?: (t: number) => number | null; sunAz?: number; sunEl?: number };
const T0 = (f: number) => f / FPS;
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 112, light: "night", fire: (t) => t - 1.6 },                       // その夜、男は…火をつけて回った
  { id: 2, a: 112, b: 183, light: "night", fire: (t) => t - 1.6 },                     // 稲むらは…積み上げた山 (insert)
  { id: 3, a: 183, b: 264, light: "night", fire: (t) => t - 1.6 },                     // その大事な稲を…燃やしていく
  { id: 4, a: 264, b: 338, light: "night", fire: (t) => t - 1.6 },                     // 男の名は浜口梧陵、三十五歳
  { id: 5, a: 338, b: 404, light: "day", sunAz: 150, sunEl: 38 },                                       // 紀州広村生まれの醤油屋の主人だ
  { id: 6, a: 404, b: 499, light: "golden" },                                    // というのも、その日の夕方、村を大地震が
  { id: 7, a: 499, b: 537, light: "golden" },                                    // 安政南海地震だ
  { id: 8, a: 537, b: 626, light: "night" },                                     // そして高さ五メートルの津波が村をのみこんだ
  { id: 9, a: 626, b: 730, light: "night" },                                     // 真っ暗な中…分からない
  { id: 10, a: 730, b: 772, light: "night", fire: (t) => t - T0(752) + IGNITE(0) }, // だから梧陵は火をつけた
  { id: 11, a: 772, b: 874, light: "night", fire: (t) => 10 + (t - T0(772)) * 6 },  // 燃える稲むらは…目印になった
  { id: 12, a: 874, b: 983, light: "night", fire: () => 60 },                     // 村人1323人のうち…36人
  { id: 13, a: 983, b: 1073, light: "night", fire: () => 62 },                    // たくさんの人が…たどり着いた
  { id: 14, a: 1073, b: 1161, light: "golden", sunAz: 40, sunEl: 14 },           // でも実は…ここからだ (next morning)
  { id: 15, a: 1161, b: 1245, light: "day" },                                    // 家も仕事も失った村人は…
  { id: 16, a: 1245, b: 1322, light: "day" },                                    // そこで梧陵は…雇った
  { id: 17, a: 1322, b: 1381, light: "day" },                                    // 仕事は、海に壁をつくること
  { id: 18, a: 1381, b: 1481, light: "day" },                                    // 四年かけて…堤防
  { id: 19, a: 1481, b: 1526, light: "day" },                                    // 海側には松を植えた
  { id: 20, a: 1526, b: 1655, light: "night" },                                  // 次の大津波が来たのは…夜明け前だった
  { id: 21, a: 1655, b: 1756, light: "night" },                                  // 波は堤防にぶつかり…守られた
  { id: 22, a: 1756, b: 1822, light: "night", fire: () => 400 },                 // 梧陵が燃やした稲は、一晩で灰になった
  { id: 23, a: 1822, b: TOTAL, light: "golden", sunAz: 160, sunEl: 20 },          // でも、彼が積んだ土は…村を守ったんだ
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 5: 8, 6: 8, 8: 8, 14: 10, 20: 10, 22: 8, 23: 10 };
export const FLASH_AT = 112;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state ----------------
/** earthquake shake 0..1 (village shots 6-7): hits on 「大地震」, rattles ~2.4 s, dies away */
export const quakeAt = (t: number) => { const t0 = 15.49; return t < t0 ? 0 : Math.max(0, 1 - (t - t0) / 3.2) * (0.75 + 0.25 * Math.sin((t - t0) * 37)); };
/** flood water level over the village (y), -1 = no flood */
export const floodAt = (id: number, t: number) => id === 8 ? (t < 19.6 ? -1 : lerp(-0.5, 1.1, smooth((t - 19.6) / 1.2))) : id === 9 ? 1.1 + 0.05 * Math.sin(t * 1.3) : -1;
/** tsunami wall: z of its front, height; show = false outside its shots */
export const waveAt = (id: number, t: number): { show: boolean; z: number; h: number; crashed: number } => {
  if (id === 8) { const u = clamp01((t - 17.9) / (19.95 - 17.9)); return { show: true, z: lerp(-230, -50, u ** 1.15), h: lerp(4, 7.5, u), crashed: clamp01((t - 19.95) / 0.8) }; }
  if (id === 20) { const u = clamp01((t - 52.4) / (55.05 - 52.4)); return { show: t > 52.4, z: lerp(-260, -95, u), h: lerp(2.5, 6.5, u), crashed: 0 }; }
  if (id === 21) { const u = clamp01((t - 54.6) / 0.6); return { show: true, z: lerp(-62, -53.5, u), h: 6.5, crashed: clamp01((t - 55.18) / 1.8) }; }
  return { show: false, z: -400, h: 0, crashed: 0 };
};
/** embankment: built fraction (height) and pine growth */
export const dikeAt = (id: number, t: number): { built: number; pines: number; workers: boolean } => {
  if (id < 17) return { built: 0, pines: 0, workers: false };
  if (id === 17) return { built: 0, pines: 0, workers: false };
  if (id === 18) return { built: lerp(0.45, 0.97, smooth((t - T0(1381)) / (T0(1481) - T0(1381)))), pines: 0, workers: true };
  if (id === 19) return { built: 1, pines: lerp(0.25, 0.3, (t - T0(1481)) / 1.5), workers: true };
  return { built: 1, pines: 1, workers: false };
};
/** the village after the wave: debris and mud (shots 9, 14-16) */
export const ruinedAt = (id: number) => id === 9 || (id >= 14 && id <= 17);
/** land-side / sea-side slope height of the embankment at z for its current top height h */
export const dikeY = (z: number, h: number) => h * clamp01(z > DIKE_Z ? (DIKE_Z + 5.5 - z) / 3.7 : (z - (DIKE_Z - 5.5)) / 3.7);
/** the work crews of shot 18 (mirrored in the episode audio script for the mallet thuds):
 *  [x, z (0 = on top), period s, phase offset] */
export const TAMPERS: [number, number, number, number][] = [[3.4, 0.25, 0.92, 0.0], [0.9, -0.35, 0.92, 0.45], [-3.2, 0.2, 0.98, 0.2], [-7.5, -0.3, 0.98, 0.7],
  [-12, 0.2, 1.0, 0.35], [-17, -0.2, 1.0, 0.85], [9, 0.1, 0.95, 0.6], [14, -0.2, 0.95, 0.1], [20, 0.2, 1.0, 0.5]];
/** a strike lands at this fraction of the work cycle (cast.ts workCycle) */
export const STRIKE_AT = 0.82;

// ---------------- camera (bridge template grammar) ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** climax-playbook "寄る": dolly factor from k0 at f0, ACCELERATING (ease-in) to k1 landing on fLand (put the word's frame
 *  here, or 1-2 f before), then a slow creep so the landed frame never freezes. k1 0.45 = 2.2x closer. */
const landPush = (f: number, f0: number, fLand: number, k1: number, creep = 0.002, k0 = 1) =>
  f <= f0 ? k0 : f < fLand ? k0 + (k1 - k0) * ((f - f0) / (fLand - f0)) ** 2.2 : k1 * Math.exp(-creep * (f - fLand));
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fireOf = (id: number, f: number) => SHOTS[id - 1].fire?.(f / FPS) ?? 0;
const G = (id: number, f: number) => goryoAt(fireOf(id, f)).p;

// ---- framings ----
const S0: V3 = STACKS[0];
// 1: hook. Low front MS of Goryo putting the torch to the first stack, push in on 「火を」
const S1a = (f: number) => dolly([S0[0] + 2.4, 1.0, S0[2] - 5.4], [S0[0] + 0.7, 1.2, S0[2] + 0.1], pushK(f, 0, 0.003), { fov: 42 });
const S1b = (f: number) => dolly([S0[0] + 1.8, 1.1, S0[2] - 4.0], [S0[0] + 0.7, 1.3, S0[2] + 0.1], pushK(f, 62, 0.0025, 0.006, 30), { fov: 38, roll: 0.035 });
// 2: insert: the straw stack catching
const S2a = (f: number) => dolly([S0[0] + 2.8, 1.2, S0[2] - 4.4], [S0[0], 1.7, S0[2]], pushK(f, 112, 0.003), { fov: 38 });
// 3: wide along the line of stacks, riding with Goryo
const S3a = (f: number) => { const g = G(3, f); return dolly(add(g, [5.1, 1.8, 2.0]), add(g, [-0.6, 1.1, -0.9]), pushK(f, 183, 0.002), { fov: 44 }); };
// 4: Goryo MS, fire behind him
const S4a = (f: number) => { const g = G(4, 264); return dolly(add(g, [1.2, 0.9, -3.6]), add(g, [0, 1.62, 0]), landPush(f, 268, 283, 0.6), { fov: 38 }); }; // B 名乗り: from below, lands on 「浜口梧陵」
const S4b = (f: number) => { const g = G(4, 264); return dolly(add(g, [0.6, 1.6, -2.2]), add(g, [0, 1.55, 0]), pushK(f, 315, 0.002, 0.006, 25), { fov: 36 }); };
// 5: day, the soy shop front
const S5a = (f: number) => dolly([6.0, 1.15, -31.6], [4.5, 1.5, -25.0], f < 377 ? pushK(f, 338, 0.0025) : pushK(377, 338, 0.0025) * landPush(f, 377, 388, 0.55), { fov: 46 }); // B: lands on 「主人だ」
// 6: dusk street, then the quake (low, closer on 「大地震」)
const S6a = (f: number) => dolly([-15, 1.7, -27.2], [0, 1.4, -28.2], pushK(f, 404, 0.002), { fov: 42 });
const S6b = (f: number) => dolly([-9.5, 1.0, -26.6], [-2, 1.6, -28.4], pushK(f, 452, 0.003, 0.012, 10), { fov: 40, roll: -0.13 }); // E: low, 7.5 deg dutch, snap on 「大地震」
// 7: high wide, the whole village shaking
const S7a = (f: number) => zoom([-34, 24, -2], [2, 0, -32], 44, pushK(f, 499, 0.003));
// 8: from the shore west of the village: the sea, the wall of water, the wall it jumps
const S8a = (f: number) => dolly([30, 24, -2], [6, -14, -50], pushK(f, 537, 0.002), { fov: 46 });
const S8b = (f: number) => dolly([-4, 1.7, -26], [-2, 7, -70], pushK(f, 578, 0.002), { fov: 50, roll: 0.04 });
// 9: low over the flood in the street, people clinging to wreckage
const S9a = (f: number) => dolly([-7.5, 2.0, -27.0], [4, 1.2, -28.6], pushK(f, 626, 0.002), { fov: 42 });
const S9b = (f: number) => dolly([-3.2, 1.75, -26.4], [3.5, 1.35, -28.6], pushK(f, 681, 0.0025), { fov: 38, roll: -0.03 });
// 10: Goryo at the field edge, the torch to the stack on 「火をつけた」
const S10a = (f: number) => dolly([S0[0] + 2.9, 0.55, S0[2] - 4.6], [S0[0] + 1.15, 1.3, S0[2] + 0.25], landPush(f, 731, 748, 0.42, 0.0015), { fov: 40, roll: 0.03 }); // C 決意: low, accelerating into his face, lands on 「火を」
// 11: crane up over the paddies to the line of fires and the torii
const S11a = (f: number) => dolly([-30, 12, -24], [6, 0, 12], pushK(f, 772, 0.0015), { fov: 46 });
const S11b = (f: number) => dolly([-18, 24, -22], [34, 2, 44], pushK(f, 813, 0.0015), { fov: 44 });
// 12: side view of the stone steps: people climbing to the shrine
const S12a = (f: number) => dolly([57.5, 4.6, 49.5], [49.5, 4.2, 57.5], pushK(f, 874, 0.002), { fov: 44 });
// 13: on the hilltop, people turn to look back at the fires below
const S13a = (f: number) => dolly([60.2, 10.7, 68.2], [55.2, 10.0, 62.6], pushK(f, 983, 0.0025), { fov: 40 });
// 14: next morning, the ruined street; push in on 「本当にすごいのは」
const S14a = (f: number) => dolly([-7.5, 1.7, -29.8], [0, 1.45, -28], pushK(f, 1073, 0.002), { fov: 42 });
const S14b = (f: number) => dolly([-4.6, 1.0, -29.4], [0, 1.45, -28], landPush(f, 1092, 1106, 0.36), { fov: 38 }); // C: from below, lands on 「本当にすごいのは」
// 15: people leaving with bundles
const S15a = (f: number) => dolly([2.5, 1.6, -33.0], [-2.5, 1.4, -28.2], pushK(f, 1161, 0.002), { fov: 42 });
// 16: Goryo stops them (over the villagers' shoulders)
const S16a = (f: number) => dolly([-9.0, 1.75, -29.6], [-1.5, 1.5, -28.0], pushK(f, 1245, 0.0025), { fov: 40 });
const S16b = (f: number) => dolly([-1.6, 1.3, -33.4], [-2.6, 1.45, -28.4], pushK(f, 1296, 0.002, 0.008, 12), { fov: 46 }); // I: the villagers cheer, Goryo at the edge
// 17: on the old sea wall, Goryo points out to sea
const S17a = (f: number) => dolly([5.5, 2.2, -45.5], [1.2, 2.9, -51.5], pushK(f, 1322, 0.0025), { fov: 44 });
// 18a: on top of the rising embankment: mallets pounding the fresh earth in front, carriers with shoulder poles coming
//      up the land-side slope toward us (the camera rides up with the earth)
const H18 = (f: number) => DIKE_H * dikeAt(18, f / FPS).built;
const S18a = (f: number) => { const h = H18(f); return dolly([9, h + 1.7, DIKE_Z - 1.2], [-8, h - 0.6, -40.5], pushK(f, 1381, 0.0022), { fov: 46 }); };
// 18b: 「高さ五メートルの堤防」: wide from the village side, the whole embankment with its crews
const S18b = (f: number) => dolly([18, 7, -30], [-2, 2.5, -46], pushK(f, 1431, 0.0018), { fov: 46, roll: 0.02 });
// 19: planting pines on the sea side
const S19a = (f: number) => dolly([7, 5.0, -60], [0, 3.0, -48], pushK(f, 1481, 0.003), { fov: 42 });
// 20: 92 years later, before dawn: from the dike top out to sea; the wave forms far out
const S20a = (f: number) => dolly([-6, 8.6, -41.5], [4, 0, -100], pushK(f, 1526, 0.0018), { fov: 44 });
const S20b = (f: number) => dolly([-3, 8.2, -42.5], [2, 4.2, -100], pushK(f, 1594, 0.002, 0.005, 30), { fov: 40 });
// 21: from the village side: the wave breaks on the dike, the houses behind it stay dry
const S21a = (f: number) => dolly([30, 9, -28], [0, 4, -50], pushK(f, 1655, 0.0025), { fov: 46, roll: 0.03 });
// 22: callback: the stack Goryo lit first, now ash
const S22a = (f: number) => dolly([S0[0] + 1.9, 0.75, S0[2] - 4.6], [S0[0] - 0.2, 0.7, S0[2] - 0.2], pushK(f, 1756, 0.003), { fov: 40 });
// 23: morning on the dike, a child on top; crane out
const S23a = (f: number) => dolly([3.2, 6.7, -40.6], [0, 6.2, -46], pushK(f, 1822, 0.0025), { fov: 40 });
const CRANE: V3[] = [[18, 16, -30], [34, 26, -6], [0, 3, -54]];
const S23c = (f: number): Shot => {
  const a = S23a(1869), s = glide((f - 1869) / 60), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (46 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 62, dur: 30, s: S1b }],
  2: [{ f: 112, s: S2a }],
  3: [{ f: 183, s: S3a }],
  4: [{ f: 264, s: S4a }, { f: 315, dur: 22, s: S4b }],
  5: [{ f: 338, s: S5a }],
  6: [{ f: 404, s: S6a }, { f: 452, cut: true, s: S6b }],
  7: [{ f: 499, s: S7a }],
  8: [{ f: 537, s: S8a }, { f: 578, cut: true, s: S8b }],
  9: [{ f: 626, s: S9a }, { f: 681, dur: 28, s: S9b }],
  10: [{ f: 730, s: S10a }],
  11: [{ f: 772, s: S11a }, { f: 805, dur: 40, s: S11b }],
  12: [{ f: 874, s: S12a }],
  13: [{ f: 983, s: S13a }],
  14: [{ f: 1073, s: S14a }, { f: 1088, dur: 8, s: S14b }],
  15: [{ f: 1161, s: S15a }],
  16: [{ f: 1245, s: S16a }, { f: 1290, dur: 22, s: S16b }],
  17: [{ f: 1322, s: S17a }],
  18: [{ f: 1381, s: S18a }, { f: 1431, cut: true, s: S18b }],
  19: [{ f: 1481, s: S19a }],
  20: [{ f: 1526, s: S20a }, { f: 1590, dur: 30, s: S20b }],
  21: [{ f: 1655, s: S21a }],
  22: [{ f: 1756, s: S22a }],
  23: [{ f: 1822, s: S23a }, { f: 1869, cut: true, s: S23c }],
};

// impact kicks: the quake (a rattle of kicks), the 1854 wave breaking in, the 1946 wave on the dike
const KICKS: [number, number][] = [
  ...Array.from({ length: 16 }, (_, i) => [15.49 + i * 0.15, 0.9 * (1 - i / 18)] as [number, number]),
  [19.93, 1.4], [55.18, 1.2],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 12 },                                 // hook MS
  { f: 112, cInf: 14 },                               // stack insert
  { f: 183, cInf: 0 },                                // wide line of fires
  { f: 264, cInf: 12 },                               // Goryo MS
  { f: 338, cInf: 8 },                                // shop
  { f: 404, cInf: 0 },                                // street, aerial, shore
  { f: 626, cInf: 8 },                                // flood
  { f: 730, cInf: 12 },                               // torch CU
  { f: 772, cInf: 0 },                                // aerial, steps
  { f: 983, cInf: 8 },                                // hilltop
  { f: 1073, cInf: 6 },                               // ruined street
  { f: 1322, cInf: 0 },                               // shore, dike, planting, 1946
  { f: 1756, cInf: 12 },                              // ash callback
  { f: 1822, cInf: 6 },                               // child on the dike
  { f: 1869, cInf: 0 },                               // crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => { const d = dofAt(f); return d.focus ? d.focus(f) : camAt(id, f).look; };
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
