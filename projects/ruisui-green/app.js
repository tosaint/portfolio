// Ruisui fire station — green retrofit study. Scroll story + slide mode driving one three.js scene.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildModel, zoneAt, textSprite, LEVELS } from './model.js';

// ---------------------------------------------------------------- site & sun
const LAT = 23.5, LON = 121.38, TZ = 8, BEARING_X = 344.4;   // bearing of model +x (X1 → X6)
const RAD = Math.PI / 180;
export function solar(doy, hour) {
  const g = 2 * Math.PI / 365 * (doy - 1 + (hour - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const d = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqt + 4 * LON - 60 * TZ, ha = (tst / 4 - 180) * RAD, la = LAT * RAD;
  const cz = Math.min(1, Math.max(-1, Math.sin(la) * Math.sin(d) + Math.cos(la) * Math.cos(d) * Math.cos(ha))), z = Math.acos(cz);
  const alt = Math.PI / 2 - z; if (Math.sin(z) < 1e-6) return { alt, az: 0 };
  const c = Math.min(1, Math.max(-1, (Math.sin(la) * Math.cos(z) - Math.sin(d)) / (Math.cos(la) * Math.sin(z))));
  const th = Math.acos(c) / RAD; return { alt, az: (ha > 0 ? (th + 180) % 360 : (540 - th) % 360) * RAD };
}
const sunVec = ({ alt, az }) => { const a = az - BEARING_X * RAD; return new THREE.Vector3(Math.cos(alt) * Math.cos(a), Math.sin(alt), Math.cos(alt) * Math.sin(a)); };
const FACES = [['front', '前立面（東北東 74°）', [0, 0, 1]], ['back', '背立面（西南西 254°）', [0, 0, -1]], ['south', '南端（南南東 164°）', [-1, 0, 0]], ['north', '北端（北北西 344°）', [1, 0, 0]], ['roof', '屋頂（水平）', [0, 1, 0]]];
export function dayInsolation(doy) {   // clear-sky direct beam, kWh/m²·day
  const tot = Object.fromEntries(FACES.map(f => [f[0], 0]));
  for (let i = 0; i < 288; i++) {
    const s = solar(doy, i / 12); if (s.alt <= 0) continue;
    const hd = s.alt / RAD, am = 1 / (Math.sin(s.alt) + .50572 * Math.pow(6.07995 + hd, -1.6364)), dni = 1353 * Math.pow(.7, Math.pow(am, .678));
    const v = sunVec(s); for (const [k, , n] of FACES) tot[k] += Math.max(0, v.x * n[0] + v.y * n[1] + v.z * n[2]) * dni / 12 / 1000;
  }
  return tot;
}

// ---------------------------------------------------------------- renderer
const stage = document.getElementById('stage');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
catch (e) { document.getElementById('nogl').hidden = false; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const BG = { day: new THREE.Color('#ebe8e1'), night: new THREE.Color('#0e1317') };
scene.background = BG.day.clone(); scene.fog = new THREE.Fog(BG.day, 150, 320);
const persp = new THREE.PerspectiveCamera(34, 1, .1, 800);
const ortho = new THREE.OrthographicCamera(-30, 30, 20, -20, -500, 1000);
let camera = persp;
const controls = new OrbitControls(persp, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08; controls.maxPolarAngle = Math.PI * .495; controls.minDistance = 12; controls.maxDistance = 220;

const hemi = new THREE.HemisphereLight(0xeaf2fb, 0x8f8a76, 2.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 3.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .05;
sun.target.position.set(20, 0, -8); scene.add(sun, sun.target);
const garageLamp = new THREE.PointLight(0xffd59a, 0, 40, 1.6); garageLamp.position.set(28, 6.5, -6); scene.add(garageLamp);
const doorLamp = new THREE.PointLight(0xffd59a, 0, 18, 1.8); doorLamp.position.set(12, 4.2, 4); scene.add(doorLamp);

const model = buildModel(); scene.add(model.root);
const { M, G, helpers: H } = model;
const CENTER = new THREE.Vector3(20, 4.5, -8);

// ---------------------------------------------------------------- layers
// Every overlay is a group tagged with a layer key and a phase (before / after / both).
const layers = [];
function layer(key, phase) { const g = new THREE.Group(); g.userData = { key, phase }; g.visible = false; scene.add(g); layers.push(g); return g; }
const flows = [];
function flow(group, paths, { color = '#2f8f9d', count = 6, speed = 4, size = .38, shape = 'cone' } = {}) {
  const geo = shape === 'cone' ? new THREE.ConeGeometry(size, size * 2.6, 10) : new THREE.SphereGeometry(size, 10, 8);
  const mat = new THREE.MeshBasicMaterial({ color });
  for (const pts of paths) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', .1);
    const len = curve.getLength();
    const tubeM = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, size * .18, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .45 }));
    group.add(tubeM);
    for (let i = 0; i < count; i++) { const m = new THREE.Mesh(geo, mat); group.add(m); flows.push({ m, curve, len, off: i / count, speed, group }); }
  }
}
const shadeMat = new THREE.MeshStandardMaterial({ color: '#a59c8b', roughness: .7 });
const greenMat = new THREE.MeshStandardMaterial({ color: '#5f8a4f', roughness: .95 });
const planterMat = new THREE.MeshStandardMaterial({ color: '#8d877b', roughness: .9 });
const pvMat = new THREE.MeshStandardMaterial({ color: '#1f3550', roughness: .25, metalness: .4 });
const unitMat = new THREE.MeshStandardMaterial({ color: '#dcdad3', roughness: .6 });
const heat = (c, o = .38) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
const HOT = heat('#d8573a'), COOL = heat('#2f8f9d', .3);
const B = (g, x, y, z, w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const tags = [];
const tag = (g, text, x, y, z, color = '#2b2a27') => { const s = textSprite(text, { size: 64, height: 1.55, color, bg: 'rgba(250,249,245,.9)' }); s.position.set(x, y, z); g.add(s); tags.push(s); return s; };

// Sun path for the active day
const sunLayer = layer('sun', 'both');
const sunArc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#c08a2c', dashSize: 1.2, gapSize: .8 }));
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: '#f2b13a' }));
sunLayer.add(sunArc, sunBall);
const R_SUN = 62;
function updateSunArc(doy) {
  const pts = []; for (let i = 0; i <= 288; i++) { const s = solar(doy, i / 12); if (s.alt > -.02) pts.push(sunVec(s).multiplyScalar(R_SUN).add(CENTER)); }
  sunArc.geometry.dispose(); sunArc.geometry = new THREE.BufferGeometry().setFromPoints(pts); sunArc.computeLineDistances();
}

// 3-3 Greening: roof garden on the rear wing, vertical green on the WSW wall
const greenAfter = layer('green', 'after');
for (const [x0, x1] of [[.8, 7.4], [16.8, 31.8]]) {
  B(greenAfter, (x0 + x1) / 2, 9.0, -15.2, x1 - x0, .42, 5.6, planterMat);
  for (let x = x0 + .6; x < x1; x += 1.1) for (const z of [-17.4, -15.2, -13]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.55 + ((x * 7 + z) % 1 + 1) % 1 * .25, 0), greenMat); b.position.set(x, 9.55, z + ((x * 3) % .6)); b.castShadow = true; greenAfter.add(b);
  }
}
for (let i = 0; i < 8; i++) { const x = 1 + i * 4 + 3.05; B(greenAfter, x, 5.1, -18.82, 1.45, 7.0, .28, greenMat); }
tag(greenAfter, '屋頂花園', 24, 11.4, -15); tag(greenAfter, '垂直綠化', 16, 9.8, -21);

// 3-4 Daylight bands on the 2F plan (≈ 2 × window head height)
const dayBefore = layer('daylight', 'before'), dayAfter = layer('daylight', 'after');
const band = (g, x0, x1, z0, z1, y, c, o) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, Math.abs(z1 - z0)), heat(c, o)); p.rotation.x = -Math.PI / 2; p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); p.renderOrder = 6; g.add(p); };
band(dayBefore, .3, 32.5, -18.3, -14.3, 5.42, '#f2c14e', .55); band(dayBefore, .3, 32.5, -14.3, -13.3, 5.42, '#5f5b54', .35);
band(dayAfter, .3, 32.5, -18.3, -13.3, 5.42, '#f2c14e', .55); band(dayAfter, .3, 32.5, -13.2, -11.6, 5.42, '#f6dc94', .5);
for (let i = 0; i < 8; i++) B(dayAfter, 2.1 + i * 4, 7.45, -18.15, 2.6, .06, .9, unitMat);   // interior light shelves
tag(dayBefore, '有效採光深度約 4 m', 16, 6.2, -16); tag(dayBefore, '內側偏暗', 16, 6.2, -13.6, '#5f5b54');
tag(dayAfter, '光棚＋高窗：採光深度約 5 m', 16, 6.2, -16); tag(dayAfter, '走道氣窗引入二次光', 16, 6.2, -12.4);

// 3-5 Natural ventilation
const windBefore = layer('wind', 'before'), windAfter = layer('wind', 'after');
flow(windBefore, [[[3, 7, -28], [3, 7, -19.3]], [[11, 3.4, -28], [11, 3.4, -19.3]], [[19, 7, -28], [19, 7, -19.3]], [[27, 3.4, -28], [27, 3.4, -19.3]]], { color: '#8b877e', count: 3, speed: 3 });
tag(windBefore, '單側開窗＋冷氣：外氣進不來', 16, 11, -24, '#5f5b54');
const cross = [3, 11, 19, 27].flatMap(x => [[[x, 7, -28], [x, 7, -18.6], [x, 7, -12.4], [x, 7.6, -11.4], [x, 7.2, -4], [x, 6.5, 6]], [[x + 1.5, 3.4, -28], [x + 1.5, 3.4, -18.6], [x + 1.5, 3.6, -11.4], [x + 1.5, 4, -4], [x + 1.5, 3.6, 7]]]);
flow(windAfter, cross, { color: '#2f8f9d', count: 5, speed: 4.5 });
flow(windAfter, [[[33.5, 3, -9], [36.5, 3, -14.5], [36.5, 8, -15], [36.5, 13, -15], [36.5, 16, -15]], [[30, 7, -12.4], [34, 7.2, -14], [36.5, 9, -15], [36.5, 15.5, -15]]], { color: '#c8553d', count: 6, speed: 3.2 });
B(windAfter, 36.5, 12.85, -15, 2.4, .9, 2.4, unitMat);
tag(windAfter, '兩側開口：穿堂對流', 12, 11, -24); tag(windAfter, '樓梯塔：浮力（煙囪）通風', 36.5, 17.4, -15);

// 3-6 External shading
const shadeAfter = layer('shade', 'after');
for (const w of model.backWins) { for (const s of [-1, 1]) B(shadeAfter, w.x + s * (w.w / 2 + .08), w.y, -18.95, .08, w.h + .7, .75, shadeMat); B(shadeAfter, w.x, w.y + w.h / 2 + .32, -18.95, w.w + .3, .08, .75, shadeMat); }
B(shadeAfter, 4, 3.95, -4.4, 7.6, .1, 1.1, shadeMat); B(shadeAfter, 12, 11.45, 2.7, 7.6, .1, 1.2, shadeMat);
B(shadeAfter, 4, 7.25, -4.4, 7.6, .1, .9, shadeMat);
tag(shadeAfter, '西南西：垂直＋水平格柵', 16, 10.6, -21.5); tag(shadeAfter, '東北東：水平遮簷', 4, 10.6, -2);

// 4-1 Walls and windows: heat-gain wash on opaque walls, glazing swap
const wallBefore = layer('envelope', 'before'), wallAfter = layer('envelope', 'after');
for (const [g, m] of [[wallBefore, HOT], [wallAfter, COOL]]) {
  const P = (x, y, z, w, h, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry; p.renderOrder = 4; g.add(p); };
  P(16.4, 5.1, -18.9, 32.8, 7.2, 0); P(36.55, 6.8, -18.95, 7.5, 10.6, 0); P(-.6, 4.75, -12.5, 14.5, 7.6, Math.PI / 2); P(40.6, 6.8, -15, 7.5, 10.6, Math.PI / 2);
}
tag(wallBefore, '外牆未做外隔熱', 16, 10, -21, '#a3361f'); tag(wallAfter, '外牆外隔熱＋Low-E 複層玻璃', 16, 10, -21, '#1f6d78');

// 4-2 Roof: insulation + PV on the garage canopy + roof garden
const roofBefore = layer('roof', 'before'), roofAfter = layer('roof', 'after');
for (const [g, m] of [[roofBefore, HOT], [roofAfter, COOL]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(33, 7.4), m); p.rotation.x = -Math.PI / 2; p.position.set(16.4, 8.95, -15); g.add(p); }
for (let x = 17.2; x < 39.2; x += 2.15) for (let z = -10.9; z < -4.4; z += 1.25) {
  const y = 9.05 - (x - 16) * .039 + .45; const p = B(roofAfter, x, y, z, 2.0, .06, 1.12, pvMat); p.rotation.x = -.18;
}
tag(roofBefore, '屋頂 Uar 0.72', 16, 11, -15, '#a3361f'); tag(roofAfter, '屋頂 Uar → 0.45＋高反射', 6, 11.2, -15, '#1f6d78'); tag(roofAfter, '車庫屋頂太陽光電', 28, 11.6, -7.5, '#1f6d78');

// 4-4 Air conditioning
const acBefore = layer('ac', 'before'), acAfter = layer('ac', 'after');
for (let i = 0; i < 8; i++) { B(acBefore, 2.2 + i * 4, .45, -19.4, .9, .7, .35, unitMat); B(acBefore, 2.2 + i * 4 + 1.2, 5.65, -19.4, .8, .6, .32, unitMat); }
for (const z of [-7, -9]) B(acBefore, -.5, .45, z, .35, .7, .9, unitMat);
tag(acBefore, '分離式冷氣 × 約 20 台（無節能標章）', 16, 3, -23, '#a3361f');
for (const x of [20.5, 23.5]) B(acAfter, x, 9.7, -15.2, 2.4, 1.6, 1.0, unitMat);
tag(acAfter, '一級能效變頻多聯（VRF）', 22, 12, -15.2, '#1f6d78'); tag(acAfter, '車庫：不空調、自然通風', 28, 4, 2, '#1f6d78');

// 4-5 Rainwater
const waterBoth = layer('water', 'both'), waterBefore = layer('water', 'before'), waterAfter = layer('water', 'after');
const tankMat = new THREE.MeshStandardMaterial({ color: '#3f86b8', transparent: true, opacity: .55, roughness: .3 });
B(waterBoth, 5, -1.35, -15, 7.6, 1.8, 5.2, tankMat); tag(waterBoth, '筏基雨水貯集槽 20.31 m³', 5, 1.2, -22);
const down = [2, 10, 18, 26].map(x => [[x, 8.9, -18.75], [x, .3, -18.75], [x, -.6, -18.75], [Math.min(x, 8.5), -.6, -16.5]]);
flow(waterBoth, down.concat([[[38, 7.8, -3.6], [38, .2, -3.6], [38, -.6, -3.6], [9, -.6, -12.8]]]), { color: '#3f86b8', count: 4, speed: 3, shape: 'ball', size: .32 });
flow(waterBefore, [[[1.2, -.6, -14], [-6, -.4, -14], [-9, .3, -14]], [[6, -.6, -17.6], [6, -.4, -24.5], [16, .3, -24.5]]], { color: '#5b9b4a', count: 4, speed: 3, shape: 'ball', size: .32 });
flow(waterAfter, [[[1.2, -.6, -14], [-6, -.4, -14], [-9, .3, -14]], [[6, -.6, -17.6], [6, -.4, -24.5], [16, .3, -24.5]]], { color: '#5b9b4a', count: 4, speed: 3, shape: 'ball', size: .32 });
flow(waterAfter, [[[8.8, -.6, -12], [24, -.6, -6], [28, .2, -1.2], [28, 1.6, -1.2]], [[8.8, -.6, -14], [38.5, -.6, -14], [39.2, .4, -12.6], [39.2, 1.6, -12.6]]], { color: '#c8553d', count: 5, speed: 3.4, shape: 'ball', size: .32 });
tag(waterBefore, '用途：植栽澆灌', -8, 3, -16, '#3d6f33'); tag(waterAfter, '用途：澆灌', -8, 3, -16, '#3d6f33');
tag(waterAfter, '＋消防車清洗', 28, 4.6, 2.2, '#a3361f'); tag(waterAfter, '＋演練補水', 41.5, 4.2, -13, '#a3361f');

// ---------------------------------------------------------------- modes
const state = { mode: 'color', phase: 'before', s: null, doy: 172, hour: 15, floor: 1, elev: 'front', xray: false };
const GX = new THREE.MeshBasicMaterial({ color: '#56747c', transparent: true, opacity: .12, depthWrite: false });
const glassInfo = model.glass.map(g => { const p = new THREE.Vector3(); g.getWorldPosition(p); return { g, zone: zoneAt(p.x, p.y, p.z) }; });

function applyMaterials() {
  const plain = state.mode === 'plain', night = state.mode === 'night', xr = state.xray;
  for (const m of model.mats) {
    const u = m.userData; m.color.copy(plain ? u.plain : u.color); m.roughness = plain ? 1 : u.rough; m.metalness = plain ? 0 : u.metal;
    if (xr) { m.transparent = true; m.opacity = .13; m.depthWrite = false; }
    else if (m === M.paleGlass) { m.transparent = true; m.opacity = .55; m.depthWrite = true; }
    else { m.transparent = false; m.opacity = 1; m.depthWrite = true; }
    m.needsUpdate = true;
  }
  for (const e of model.edgeLines) e.visible = plain && !xr;
  const after = state.phase === 'after' && state.s && state.s.phase !== undefined;
  for (const { g, zone } of glassInfo) {
    if (night) {
      if (!state.s || !state.s.light) g.material = zone === 'garage' ? G.dark : G.lit;
      else if (state.phase === 'before') g.material = G.lit;
      else g.material = zone === 'duty' ? G.lit : zone === 'sleep' ? G.dim : G.dark;
    } else if (xr) g.material = GX;
    else g.material = plain ? G.plain : (after && state.s.layers?.includes('envelope') ? G.lowe : G.day);
  }
  scene.background.copy(night ? BG.night : BG.day); scene.fog.color.copy(night ? BG.night : BG.day);
  hemi.intensity = night ? .18 : plain ? 2.4 : 2.0; hemi.color.set(night ? 0x8fa6c8 : 0xeaf2fb);
  sun.intensity = night ? .18 : 3.2; sun.color.set(night ? 0x9fb4d8 : 0xfff1dc);
  const fewer = night && state.s?.light && state.phase === 'after';
  garageLamp.intensity = night ? (fewer ? 30 : 70) : 0; doorLamp.intensity = night ? 18 : 0;
  model.edgeMat.color.set(night ? 0xdad6cc : 0x2b2a27);
}

function applySun() {
  const s = state.s || {}; const useSun = s.layers?.includes('sun');
  const v = useSun ? sunVec(solar(state.doy, state.hour)) : new THREE.Vector3(-.55, .72, .42).normalize();
  if (useSun && v.y < .02) v.y = .02;
  sun.position.copy(CENTER).addScaledVector(v, 120); sun.target.position.copy(CENTER);
  sunBall.position.copy(CENTER).addScaledVector(v.clone().normalize(), R_SUN);
  const info = solar(state.doy, state.hour);
  const el = document.getElementById('sunread');
  if (el) el.textContent = `太陽高度 ${(info.alt / RAD).toFixed(1)}°　方位 ${(info.az / RAD).toFixed(0)}°`;
}

function applyLayers() {
  const s = state.s || {}; const keys = s.layers || [];
  for (const g of layers) { const { key, phase } = g.userData; g.visible = keys.includes(key) && (phase === 'both' || phase === state.phase || (s.phase === undefined && phase === 'before')); }
  for (const f of [1, 2, 3]) { model.zoneGroups[f].visible = !!s.zones && s.cam === 'top' && state.floor === f; model.labelGroups[f].visible = s.cam === 'top' && !!s.zones && state.floor === f; }
  model.diagram.visible = !!s.diagram; model.building.visible = !s.diagram;
  model.landscape.visible = !s.diagram && s.cam !== 'elev';
  model.dims.front.visible = s.cam === 'elev' && (state.elev === 'front' || state.elev === 'back');
  model.dims.side.visible = s.cam === 'elev' && (state.elev === 'south' || state.elev === 'north');
  model.north.visible = s.cam !== 'elev';
  for (const t of tags) t.visible = !s.notags;
  for (const t of model.trees) t.visible = !(s.layers?.includes('water'));
  // Plan cut
  if (s.cam === 'top' || s.cut) {
    const f = s.cut || state.floor; const y = (f === 1 ? LEVELS.F1 : f === 2 ? LEVELS.F2 : LEVELS.F3) + 1.6;
    renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)];
  } else renderer.clippingPlanes = [];
}

// ---------------------------------------------------------------- cameras
let tween = null;
function fitOrtho(w, h) {
  const a = stage.clientWidth / Math.max(1, stage.clientHeight); let hh = h / 2; if (w / 2 / a > hh) hh = w / 2 / a;
  Object.assign(ortho, { left: -hh * a, right: hh * a, top: hh, bottom: -hh, zoom: 1 }); ortho.updateProjectionMatrix();
}
const ELEV = {
  front: { pos: [20.15, 7, 160], t: [17, 7, 0], w: 54, h: 21 },
  back: { pos: [20.15, 7, -170], t: [20.15, 7, -9], w: 54, h: 21 },
  south: { pos: [-160, 7, -9.25], t: [0, 7, -9.25], w: 44, h: 22 },
  north: { pos: [190, 7, -9.25], t: [40, 7, -9.25], w: 44, h: 22 }
};
function setCamera(s, instant) {
  const isOrtho = s.cam === 'top' || s.cam === 'elev';
  if (isOrtho) {
    camera = ortho; controls.object = ortho; controls.enableRotate = false; tween = null;
    if (s.cam === 'top') { ortho.up.set(0, 0, -1); ortho.position.set(20.15, 200, -8); controls.target.set(20.15, 0, -8); fitOrtho(58, 34); }
    else { const e = ELEV[state.elev]; ortho.up.set(0, 1, 0); ortho.position.set(...e.pos); controls.target.set(...e.t); fitOrtho(e.w, e.h); }
    ortho.lookAt(controls.target); controls.update(); sun.castShadow = false; return;
  }
  camera = persp; controls.object = persp; controls.enableRotate = true; sun.castShadow = true; persp.up.set(0, 1, 0);
  const to = { pos: new THREE.Vector3(...s.pos), target: new THREE.Vector3(...(s.target || CENTER.toArray())) };
  if (instant) { persp.position.copy(to.pos); controls.target.copy(to.target); controls.update(); tween = null; return; }
  tween = { t0: performance.now(), dur: 1100, fromP: persp.position.clone(), fromT: controls.target.clone(), ...to };
}

// ---------------------------------------------------------------- state
const STATES = window.RUISUI_STATES;
const ui = {
  modes: [...document.querySelectorAll('[data-mode]')], phase: document.getElementById('phase'), phases: [...document.querySelectorAll('[data-phase]')],
  sunbox: document.getElementById('sunbox'), days: [...document.querySelectorAll('[data-doy]')], hour: document.getElementById('hour'), hourval: document.getElementById('hourval'),
  floorbox: document.getElementById('floorbox'), floors: [...document.querySelectorAll('[data-floor]')], elevbox: document.getElementById('elevbox'), elevs: [...document.querySelectorAll('[data-elev]')],
  legend: document.getElementById('legend')
};
function syncUI() {
  const s = state.s || {};
  ui.modes.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  ui.phase.hidden = s.phase === undefined; ui.phases.forEach(b => b.setAttribute('aria-pressed', b.dataset.phase === state.phase));
  ui.sunbox.hidden = !s.layers?.includes('sun'); ui.days.forEach(b => b.setAttribute('aria-pressed', +b.dataset.doy === state.doy));
  ui.hour.value = state.hour; ui.hourval.textContent = `${String(Math.floor(state.hour)).padStart(2, '0')}:${String(Math.round(state.hour % 1 * 60)).padStart(2, '0')}`;
  ui.floorbox.hidden = s.cam !== 'top'; ui.floors.forEach(b => b.setAttribute('aria-pressed', +b.dataset.floor === state.floor));
  ui.elevbox.hidden = s.cam !== 'elev'; ui.elevs.forEach(b => b.setAttribute('aria-pressed', b.dataset.elev === state.elev));
  ui.legend.hidden = !(s.zones || s.diagram);
  document.querySelectorAll('.sunrow').forEach(r => r.classList.toggle('on', +r.dataset.doy === state.doy));
}
function refresh() { applyMaterials(); applyLayers(); applySun(); syncUI(); }
let current = null;
export function go(id, instant = false) {
  const s = STATES[id]; if (!s) return; current = id; state.s = s;
  state.mode = s.mode || 'color'; state.phase = s.phase || 'before'; state.xray = !!s.xray;
  if (s.sun) { state.doy = s.sun[0]; state.hour = s.sun[1]; updateSunArc(state.doy); }
  if (s.floor) state.floor = s.floor; if (s.elev) state.elev = s.elev;
  setCamera(s, instant); refresh();
  document.dispatchEvent(new CustomEvent('statechange', { detail: { id, s } }));
}

ui.modes.forEach(b => b.onclick = () => { state.mode = b.dataset.mode; refresh(); });
ui.phases.forEach(b => b.onclick = () => { state.phase = b.dataset.phase; refresh(); document.dispatchEvent(new CustomEvent('phasechange', { detail: state.phase })); });
ui.days.forEach(b => b.onclick = () => { state.doy = +b.dataset.doy; updateSunArc(state.doy); refresh(); });
ui.hour.oninput = () => { state.hour = +ui.hour.value; applySun(); syncUI(); };
ui.floors.forEach(b => b.onclick = () => { state.floor = +b.dataset.floor; applyLayers(); syncUI(); });
ui.elevs.forEach(b => b.onclick = () => { state.elev = b.dataset.elev; setCamera(state.s, true); applyLayers(); syncUI(); });
document.getElementById('resetview').onclick = () => current && go(current);
document.getElementById('shot').onclick = () => { renderer.render(scene, camera); const a = document.createElement('a'); a.download = `ruisui-${current || 'view'}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); };

// Insolation table (computed, not typed in)
(function sunTable() {
  const el = document.getElementById('suntable'); if (!el) return;
  const days = [[172, '夏至'], [79, '春秋分'], [355, '冬至']]; const data = days.map(([d]) => dayInsolation(d));
  const max = Math.max(...data.flatMap(o => Object.values(o)));
  el.innerHTML = `<div class="sunhead"><span></span>${days.map(d => `<span>${d[1]}</span>`).join('')}</div>` + FACES.map(([k, label]) => `<div class="sunface"><span>${label}</span>${data.map((o, i) => `<span class="sunrow" data-doy="${days[i][0]}"><i style="width:${(o[k] / max * 100).toFixed(1)}%"></i><b>${o[k].toFixed(1)}</b></span>`).join('')}</div>`).join('') + '<p class="unit">晴天直射日射量 kWh/m²·日（簡化大氣模型，依本頁太陽位置程式計算）</p>';
})();

// ---------------------------------------------------------------- resize & loop
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false);
  persp.aspect = w / Math.max(1, h); persp.updateProjectionMatrix();
  if (camera === ortho && state.s) setCamera(state.s, true);
}
new ResizeObserver(resize).observe(stage); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05);
  if (tween) {
    const k = Math.min(1, (performance.now() - tween.t0) / tween.dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    persp.position.lerpVectors(tween.fromP, tween.pos, e); controls.target.lerpVectors(tween.fromT, tween.target, e); if (k >= 1) tween = null;
  }
  const t = performance.now() / 1000;
  for (const f of flows) if (f.group.visible) {
    const u = ((t * f.speed / f.len) + f.off) % 1; const p = f.curve.getPointAt(u), tg = f.curve.getTangentAt(u);
    f.m.position.copy(p); f.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tg);
  }
  controls.update(); renderer.render(scene, camera);
});
document.getElementById('loading')?.remove();
window.__ruisui = { scene, model, go, state, solar, dayInsolation, renderer, get camera() { return camera; }, sun, layers };
document.dispatchEvent(new Event('sceneready'));
