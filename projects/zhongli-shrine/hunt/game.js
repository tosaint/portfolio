// 神社尋寶：嵌在神社說明頁（../index.html）最前面的小遊戲
//
// 在 3D 神社裡用第一人稱走動，找出十件寶物。說明頁一開就載入，收合時只慢慢環視，按「展開」才接手操作。
// 神社模型、座標直接 import 導覽的模組（../app/），不複製、不修改；導覽的 main.js 沒有引用。
// 黑松、輪廓線、銅馬與狛犬掃描的載入方式抄自導覽 main.js（那裡沒有匯出），改動時兩邊各改各的。
//
// 座標：q = 公尺平面座標（q.y 沿中軸朝本殿）；three.js 世界座標 = (q.x, 高度, -q.y)。高度 0 = 外參道地面。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
// ?v= 與導覽 main.js 相同，兩頁共用同一份快取
import { buildShrine, LV, GATE_Y, TORII2_Y, WAIST, KOMA_POS, KOMA_PED, HORSE, setOnAsset, treeOK, approachPts } from '../app/shrine-proc.js?v=20261104t';
import { ITEMS, CHAPTER } from './items.js?v=2';

const SHRINE = new URL('../app/', import.meta.url).href;   // 導覽資料夾（掃描檔）
const $ = id => document.getElementById(id);
const host = $('stage'), root = $('game');
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 900;

/* ---------- 進度：只存在這台裝置的瀏覽器，不送出任何資料 ---------- */
const store = {
  read() { try { return JSON.parse(localStorage.getItem(CHAPTER.storeKey)) || {}; } catch (e) { return {}; } },
  write(v) { try { localStorage.setItem(CHAPTER.storeKey, JSON.stringify(v)); } catch (e) {} }
};
const saved = store.read();
const got = new Set((saved.got || []).filter(id => ITEMS.some(it => it.id === id)));
let helped = !!saved.helped, finished = !!saved.finished;
const save = () => store.write({ got: [...got], helped, finished });

/* ---------- 場景 ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
const maxDPR = Math.min(devicePixelRatio, phone ? 1.75 : 1.25), minDPR = Math.min(maxDPR, 1);
renderer.setPixelRatio(maxDPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;            // 場景是靜態的：陰影只在載入後算一次
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.localClippingEnabled = true;         // 銅馬掃描：切掉今日的台座
host.append(renderer.domElement);

const HORIZON = 0xe9ede6;
const scene = new THREE.Scene();
scene.background = new THREE.Color(HORIZON);
scene.fog = new THREE.Fog(HORIZON, 140, 520);
scene.add(new THREE.HemisphereLight(0xf4f7ff, 0x8a7d62, 1.3));
const sun = new THREE.DirectionalLight(0xffe9c8, 2.9);
sun.position.set(-55, 70, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
sun.target.position.set(0, 0, 25);
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(68, 1, 0.15, 1600);
camera.rotation.order = 'YXZ';

// 天空：地平線與霧同色，往上漸藍（一顆球、一次繪製）
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: new THREE.Color(HORIZON) }, b: { value: new THREE.Color(0x9fc1dc) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 a; uniform vec3 b; varying float h; void main(){ gl_FragColor = vec4(mix(a, b, smoothstep(0.02, 0.55, h)), 1.0); }'
  }));
  sky.renderOrder = -10; scene.add(sky);
}
// 地面：草地色的大平面（導覽用的今日航照從人的高度看只剩色塊，這裡不鋪）
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#98a174'; x.fillRect(0, 0, 256, 256);
  let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { x.fillStyle = ['#8c9668', '#a4ab80', '#909a6c', '#aab088'][i & 3]; x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140, 140); t.anisotropy = 4;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: t }));
  g.position.set(-60, -0.06, 20); g.receiveShadow = true; scene.add(g);
}

/* ---------- 地面高度：依 shrine-proc.js 的各層平台（公尺）---------- */
const IN = GATE_Y + 28.2;      // 與 shrine-proc.js 相同：內苑各構件的位移
function groundAt(x, z) {
  const y = -z, ax = Math.abs(x);
  let h = 0;
  if ((ax < WAIST && y > TORII2_Y - 0.4 && y < GATE_Y - 10.5) || (ax < 16 && y > GATE_Y - 11 && y < 30)) h = LV.T1;   // 前庭
  if (ax < 13.1 && y > GATE_Y && y < -1.0 + IN) h = LV.T2;                 // 內苑
  if (ax < 6.1 && y > -3.7 + IN && y < 14.0 + IN) h = LV.T3;              // 本殿區
  if (ax < 7.0 && Math.abs(y - (-6.7 + IN)) < 3.3) h = LV.T2 + 1.0;       // 拜殿地板
  if (ax < 2.3 && Math.abs(y - (-0.8 + IN)) < 2.9) h = LV.T2 + 1.0;       // 幣殿地板
  if (ax < 2.7 && Math.abs(y - (6.65 + IN)) < 2.5) h = LV.T3 + 1.9;       // 本殿濡緣
  return h;
}

/* ---------- 黑松（抄自導覽 main.js 的 buildPines）---------- */
function buildPines() {
  let r = 20261104; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const trunk = new THREE.CylinderGeometry(0.016, 0.03, 0.66, 5, 1, true); trunk.translate(0, 0.33, 0);
  const crown = variant => {
    const parts = [];
    const tiers = variant ? [[0.5, 0.28, 0.1, 0.05], [0.66, 0.22, -0.08, 0.02], [0.8, 0.17, 0.06, -0.04], [0.93, 0.11, 0, 0]]
                          : [[0.58, 0.24, -0.12, 0.04], [0.74, 0.2, 0.1, -0.05], [0.9, 0.13, -0.02, 0.03]];
    tiers.forEach(([y, w, dx, dz]) => { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(w, w * 0.38, w * 0.85); g.translate(dx, y, dz); parts.push(g); });
    return mergeGeometries(parts);
  };
  const crowns = [crown(0), crown(1)];
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5b4a3b }), leafMat = new THREE.MeshLambertMaterial({ color: 0x34492f, flatShading: true });
  const trees = [];
  const add = (x, y, h) => { if (treeOK(x, y)) trees.push([x, y, h]); };
  const P = approachPts(), seg = [0]; for (let i = 1; i < P.length; i++) seg.push(seg[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const Ltot = seg[seg.length - 1];
  for (const sd of [-1, 1]) for (let d = 6 + rnd() * 4; d < Ltot; d += 8 + rnd() * 4) {
    const f = d / Ltot; if (f > 0.55 && rnd() < (f - 0.55) / 0.33) continue;
    let i = seg.findIndex(v => v >= d); i = Math.max(1, i);
    const [ax, ay] = P[i - 1], [bx, by] = P[i], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l, ny = (bx - ax) / l, o = 8 + rnd() * 2.2;
    add(ax + nx * o * sd, ay + ny * o * sd, 10 + rnd() * 4);
  }
  const ring = (x0, x1, y0, y1, n) => { for (let k = 0; k < n; k++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), dist = Math.min(Math.abs(Math.abs(x) - 16), Math.abs(y - 30));
    add(x, y, dist < 5 && rnd() < 0.5 ? 2.5 + rnd() * 2.5 : 8 + rnd() * 6);
  } };
  ring(-34, 34, 31.5, 50, 70); ring(-32, -17.5, -12, 31, 26); ring(17.5, 32, 2, 31, 20);
  [[56, -46, 9], [57, -55, 12], [55, -60, 4], [-11, -33, 11], [-12, -40, 3.5], [-23, -77, 9], [23.5, -79, 4], [-22, -60, 11]]
    .forEach(([x, y, h]) => add(x, y, h * (0.9 + rnd() * 0.2)));
  const groups = [[], []]; trees.forEach((t, i) => groups[i % 2].push(t));
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler();
  const trunkIM = new THREE.InstancedMesh(trunk, trunkMat, trees.length);
  let n = 0;
  groups.forEach((g, gi) => {
    const im = new THREE.InstancedMesh(crowns[gi], leafMat, g.length);
    g.forEach(([x, y, h], k) => {
      e.set((rnd() - 0.5) * 0.18, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.18); q4.setFromEuler(e);
      const sxz = h * (0.75 + rnd() * 0.35);
      m4.compose(new THREE.Vector3(x, -0.05, -y), q4, new THREE.Vector3(sxz, h, sxz));
      im.setMatrixAt(k, m4); trunkIM.setMatrixAt(n++, m4);
    });
    im.castShadow = true; im.frustumCulled = false; scene.add(im);
  });
  trunkIM.castShadow = true; trunkIM.frustumCulled = false; scene.add(trunkIM);
  renderer.shadowMap.needsUpdate = true;
}
/* ---------- 細輪廓線（抄自導覽 main.js 的 buildEdges）---------- */
function buildEdges() {
  const edges = [];
  shrine.group.children.forEach(m => { if (!/gravel|path/.test(m.name)) edges.push(new THREE.EdgesGeometry(m.geometry, 28)); });
  const n = edges.reduce((s, g) => s + g.attributes.position.array.length, 0), pos = new Float32Array(n);
  let o = 0; edges.forEach(g => { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; g.dispose(); });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2b2118, transparent: true, opacity: 0.4 })));
}
/* ---------- 銅馬、狛犬掃描（抄自導覽 main.js；檔案直接讀導覽資料夾的）---------- */
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const flat = color => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
const fixNormals = m => { if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); };
function loadHorse() {
  gltf.load(SHRINE + 'assets/horse-scan-2.glb', g => {
    const scan = g.scene, HOOF = 1.0, base = LV.T1 + HORSE.ped;
    scan.rotation.y = -Math.PI / 2;
    scan.position.set(HORSE.q[0], base - HOOF, -HORSE.q[1]);
    const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(base - 0.03))];
    scan.traverse(m => { if (m.isMesh) { fixNormals(m); m.material = flat(0x6f5a3c); m.material.clippingPlanes = clip; m.castShadow = true; } });
    scene.add(scan); renderer.shadowMap.needsUpdate = true;
  }, undefined, e => console.warn('銅馬掃描載入失敗', e));
}
function loadKomainu() {
  gltf.load(SHRINE + 'assets/komainu-scan-2.glb', g => {
    g.scene.traverse(m => { if (m.isMesh) { fixNormals(m); m.material = flat(0xd3cfc4); m.castShadow = true; } });
    KOMA_POS.forEach(([x, y], i) => {
      const k = i ? g.scene : g.scene.clone();
      k.position.set(x, LV.T1 + KOMA_PED, -y);
      if (!i) k.scale.x = -1;
      k.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
      scene.add(k);
    });
    renderer.shadowMap.needsUpdate = true;
  }, undefined, e => console.warn('狛犬掃描載入失敗', e));
}

/* ---------- 寶物標記：發光的菱形＋一道光柱，遠遠就看得到 ---------- */
const GOLD = 0xffc23a;
const gemGeo = new THREE.OctahedronGeometry(0.42, 0), haloGeo = new THREE.OctahedronGeometry(0.62, 0);
const beamGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 10, 1, true); beamGeo.translate(0, 0.5, 0);
const gemMat = new THREE.MeshBasicMaterial({ color: GOLD, fog: false });
const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.38, depthWrite: false, fog: false });
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.42, depthWrite: false, fog: false, side: THREE.DoubleSide });
const markers = [];      // { it, pos: Vector3, pts: [[x,z]…], group, gem }
function buildMarkers() {
  const c = new THREE.Vector3();
  ITEMS.forEach((it, i) => {
    const box = shrine.boxes.get(it.box);
    let pos;
    if (Array.isArray(it.at)) { const [qx, qy, h] = it.at; pos = new THREE.Vector3(qx, groundAt(qx, -qy) + h, -qy); }
    else { box.getCenter(c); pos = new THREE.Vector3(c.x, it.at === 'under' ? box.min.y + 2.7 : box.max.y + 1.0, c.z); }
    // 走到標記旁，或走到任何一個同類構件旁，都能收集
    const pts = [[pos.x, pos.z]];
    (it.also || []).forEach(id => { const b = shrine.boxes.get(id); if (b) { b.getCenter(c); pts.push([c.x, c.z]); } });
    const group = new THREE.Group(); group.position.copy(pos);
    const gem = new THREE.Mesh(gemGeo, gemMat), halo = new THREE.Mesh(haloGeo, haloMat);
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.scale.y = 46; beam.position.y = 0.6;
    gem.scale.y = halo.scale.y = 1.35;
    group.add(gem, halo, beam); group.userData.phase = i * 1.7;
    group.visible = !got.has(it.id);
    scene.add(group);
    markers.push({ it, pos, pts, group, gem, halo });
  });
}

/* ---------- 玩家 ---------- */
const EYE = 1.62, WALK = 3.6, RUN = 8.5, REACH = 5.5;
const player = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0 };
let bounds = { x0: -260, x1: 80, z0: -60, z1: 120 };
function placeAtStart() {
  // 第一鳥居外 14 公尺，面向參道
  const P = approachPts(), [ax, ay] = P[0], [bx, by] = P[4], l = Math.hypot(bx - ax, by - ay) || 1, tx = (bx - ax) / l, ty = (by - ay) / l;
  player.x = ax - tx * 14; player.z = -(ay - ty * 14);
  player.yaw = Math.atan2(-tx, ty); player.pitch = 0.06;
  player.y = groundAt(player.x, player.z);
}
function setBounds() {
  const P = approachPts(), xs = P.map(p => p[0]), zs = P.map(p => -p[1]);
  bounds = { x0: Math.min(...xs) - 35, x1: 78, z0: Math.min(-58, ...zs) - 4, z1: Math.max(100, ...zs) + 30 };
}

/* ---------- 操作：左下搖桿走路、其餘地方拖曳轉頭；桌機 WASD＋滑鼠拖曳 ---------- */
const pad = $('pad'), stick = $('stick'), knob = $('knob');
const input = { mx: 0, my: 0, run: false, keys: new Set() };
let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
const STICK_R = 46;
function stickHome() { stick.style.left = ''; stick.style.top = ''; stick.classList.remove('live'); knob.style.transform = ''; input.mx = input.my = 0; }
pad.addEventListener('pointerdown', e => {
  if (!playing) return;
  const r = pad.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  const touch = e.pointerType !== 'mouse';
  if (touch && stickId === null && px < r.width * 0.5 && py > r.height * 0.4) {
    stickId = e.pointerId; sx = px; sy = py;
    stick.style.left = px + 'px'; stick.style.top = py + 'px'; stick.classList.add('live');
  } else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
  else return;
  pad.setPointerCapture(e.pointerId); e.preventDefault();
});
pad.addEventListener('pointermove', e => {
  if (e.pointerId === stickId) {
    const r = pad.getBoundingClientRect();
    let dx = e.clientX - r.left - sx, dy = e.clientY - r.top - sy; const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.mx = dx / STICK_R; input.my = -dy / STICK_R;
  } else if (e.pointerId === lookId) {
    const k = e.pointerType === 'mouse' ? 0.0032 : 0.0052;
    player.yaw -= (e.clientX - lx) * k; player.pitch = THREE.MathUtils.clamp(player.pitch - (e.clientY - ly) * k * 0.8, -1.1, 1.2);
    lx = e.clientX; ly = e.clientY;
  }
});
const padUp = e => { if (e.pointerId === stickId) { stickId = null; stickHome(); } if (e.pointerId === lookId) lookId = null; };
pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
pad.addEventListener('contextmenu', e => e.preventDefault());
const KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr', ShiftLeft: 'run', ShiftRight: 'run' };
addEventListener('keydown', e => {
  if (!playing || document.querySelector('dialog[open]')) return;
  if (KEYS[e.code]) { input.keys.add(KEYS[e.code]); e.preventDefault(); }
  else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { if (near) { take(near); e.preventDefault(); } }
});
addEventListener('keyup', e => { if (KEYS[e.code]) input.keys.delete(KEYS[e.code]); });
addEventListener('blur', () => { input.keys.clear(); });
$('runBtn').onclick = () => { input.run = !input.run; $('runBtn').setAttribute('aria-pressed', input.run); };

function move(dt) {
  const K = input.keys;
  let mx = input.mx + (K.has('r') ? 1 : 0) - (K.has('l') ? 1 : 0), my = input.my + (K.has('f') ? 1 : 0) - (K.has('b') ? 1 : 0);
  if (K.has('tl')) player.yaw += 1.9 * dt; if (K.has('tr')) player.yaw -= 1.9 * dt;
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  if (m > 0.05) {
    const v = (input.run || K.has('run') ? RUN : WALK) * dt, s = Math.sin(player.yaw), c = Math.cos(player.yaw);
    player.x += (-s * my + c * mx) * v; player.z += (-c * my - s * mx) * v;
    player.x = THREE.MathUtils.clamp(player.x, bounds.x0, bounds.x1); player.z = THREE.MathUtils.clamp(player.z, bounds.z0, bounds.z1);
  }
  // 上下台階：高度平滑追上，不會一格一格跳
  player.y += (groundAt(player.x, player.z) - player.y) * Math.min(1, dt * 9);
  camera.position.set(player.x, player.y + EYE, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

/* ---------- 收集、圖鑑、完成 ---------- */
let near = null, playing = false, ready = false;
const takeBtn = $('takeBtn'), hint = $('hintTxt'), arrow = $('hintArrow');
function updateNear() {
  let best = null, bd = 1e9, nm = null, nd = 1e9;
  for (const m of markers) {
    if (got.has(m.it.id)) continue;
    for (const [x, z] of m.pts) { const d = Math.hypot(x - player.x, z - player.z); if (d < bd) { bd = d; best = m; } }
    const d = Math.hypot(m.pos.x - player.x, m.pos.z - player.z); if (d < nd) { nd = d; nm = m; }
  }
  const n = best && bd < REACH ? best : null;
  if (n !== near) { near = n; takeBtn.hidden = !n; if (n) takeBtn.querySelector('b').textContent = n.it.name; }
  // 最近一件還沒找到的寶物：方向（相對於目前面向）與距離
  if (!nm) { $('hintBox').hidden = true; return; }
  $('hintBox').hidden = false;
  const ang = Math.atan2(nm.pos.x - player.x, -(nm.pos.z - player.z)) + player.yaw;   // 0 = 正前方，順時針為正
  arrow.style.transform = `rotate(${ang}rad)`;
  hint.textContent = nd < REACH ? '就在這裡' : `最近的寶物 ${Math.round(nd)} 公尺`;
}
function setProgress() {
  $('progNum').textContent = `${got.size}/${ITEMS.length}`;
  document.querySelectorAll('[data-prog]').forEach(e => { e.textContent = `${got.size}/${ITEMS.length}`; });
}
function take(m) {
  if (got.has(m.it.id)) return;
  got.add(m.it.id); save(); m.group.visible = false; near = null; takeBtn.hidden = true;
  setProgress(); showCard(m.it, true);
}
takeBtn.onclick = () => { if (near) take(near); };

const card = $('card'), book = $('book'), done = $('done');
function showCard(it, fresh) {
  input.keys.clear(); stickHome();
  $('cardNo').textContent = `${fresh ? '找到了' : '圖鑑'} · ${String(ITEMS.indexOf(it) + 1).padStart(2, '0')}/${ITEMS.length}`;
  $('cardName').textContent = it.name;
  $('cardText').textContent = it.text;
  $('cardNow').textContent = it.now;
  $('cardCap').textContent = it.cap;
  const im = $('cardImg'); im.removeAttribute('src'); im.alt = it.cap; im.src = it.photo;
  $('cardOk').textContent = got.size === ITEMS.length && !finished ? '全部找到了 →' : fresh ? '繼續尋寶' : '關閉';
  if (book.open) book.close();
  card.showModal();
}
card.addEventListener('close', () => { if (got.size === ITEMS.length && !finished) { finished = true; save(); done.showModal(); } });
$('cardOk').onclick = () => card.close();
function renderBook() {
  $('bookList').innerHTML = ITEMS.map((it, i) => {
    const ok = got.has(it.id), no = String(i + 1).padStart(2, '0');
    return ok ? `<li><button type="button" data-item="${it.id}"><span class="no">${no}</span><b>${it.name}</b><i>看卡片 →</i></button></li>`
              : `<li class="todo"><div><span class="no">${no}</span><b>？？？</b><i>${it.hint}</i></div></li>`;
  }).join('');
  $('bookDone').hidden = got.size !== ITEMS.length;
}
$('bookList').addEventListener('click', e => { const b = e.target.closest('[data-item]'); if (b) showCard(ITEMS.find(it => it.id === b.dataset.item), false); });
$('progBtn').onclick = () => { input.keys.clear(); stickHome(); renderBook(); book.showModal(); };
$('bookClose').onclick = () => book.close();
$('bookDone').onclick = () => { book.close(); done.showModal(); };
$('doneClose').onclick = () => done.close();
$('resetBtn').onclick = () => {
  if (!$('resetBtn').dataset.sure) { $('resetBtn').dataset.sure = 1; $('resetBtn').textContent = '確定要清除？再按一次'; return; }
  delete $('resetBtn').dataset.sure; $('resetBtn').textContent = '重新開始';
  got.clear(); finished = false; save(); markers.forEach(m => { m.group.visible = true; }); setProgress(); placeAtStart(); book.close();
};
book.addEventListener('close', () => { delete $('resetBtn').dataset.sure; $('resetBtn').textContent = '重新開始'; });
// 點對話框外面的暗處也能關
[card, book, done].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
$('helpOk').onclick = () => { $('help').hidden = true; helped = true; save(); };
$('helpBtn').onclick = () => { $('help').hidden = false; };

/* ---------- 版面：嵌在頁面裡（flow）只自動環視；展開（full）才接手操作 ---------- */
let W = 1, H = 1;
function resize() {
  W = host.clientWidth || 1; H = host.clientHeight || 1;
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.fov = W < H ? 72 : 62; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
function setPlay(on) {
  playing = on; root.classList.toggle('playing', on);
  input.keys.clear(); stickId = lookId = null; stickHome();
  if (on) { if (!helped) $('help').hidden = false; lastNear = 0; }
  else document.querySelectorAll('#game dialog[open]').forEach(d => d.close());
  resize();
}
let onScreen = true;
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(host);

/* ---------- 主迴圈 ---------- */
let last = performance.now(), lastNear = 0, slow = 0, orbitT = 0, skip = false;
function frame(now) {
  const dt = Math.min(0.12, (now - last) / 1000), tick = now - last; last = now;
  if (!ready || document.hidden || (!playing && !onScreen)) return;
  if (playing) {
    if (!document.querySelector('dialog[open]') && $('help').hidden) move(dt);
    if (now - lastNear > 120) { lastNear = now; updateNear(); }
    // 手機太慢就降解析度（只降不升，避免來回跳）
    slow = tick > 34 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 40 && renderer.getPixelRatio() > minDPR) { renderer.setPixelRatio(Math.max(minDPR, renderer.getPixelRatio() - 0.25)); slow = 0; }
  } else {
    // 還沒展開：慢慢繞著神門前環視，每兩格畫一次，省電
    if ((skip = !skip)) return;
    orbitT += dt * 2;
    const a = 2.3 + Math.sin(orbitT * 0.05) * 0.7, R = 62;
    camera.position.set(Math.sin(a) * R, 15, 46 + Math.cos(a) * R * 0.75);
    camera.lookAt(0, 3.5, 22);
  }
  const t = now / 1000;
  for (const m of markers) if (m.group.visible) {
    const p = m.group.userData.phase;
    m.gem.rotation.y = m.halo.rotation.y = t * 1.6 + p;
    m.gem.position.y = m.halo.position.y = Math.sin(t * 2 + p) * 0.16;
    // 走到旁邊時縮小，不要整顆擋住畫面
    const k = playing ? THREE.MathUtils.clamp(Math.hypot(m.pos.x - player.x, m.pos.z - player.z) / 5, 0.4, 1) : 1;
    m.gem.scale.set(k, k * 1.35, k);
    m.halo.scale.setScalar(k * (1 + Math.sin(t * 3 + p) * 0.08)); m.halo.scale.y *= 1.35;
  }
  renderer.render(scene, camera);
}

/* ---------- 載入 ---------- */
let shrine;
const later = f => (window.requestIdleCallback || (g => setTimeout(g, 60)))(f);
try {
  setOnAsset(() => {});
  shrine = buildShrine();
  shrine.group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(shrine.group);
  setBounds(); placeAtStart(); buildMarkers(); setProgress(); resize();
  renderer.shadowMap.needsUpdate = true;
  ready = true;
  renderer.setAnimationLoop(frame);
  requestAnimationFrame(() => requestAnimationFrame(() => { later(buildEdges); later(buildPines); later(loadHorse); later(loadKomainu); }));
  $('gload').remove();
  root.classList.add('ready');
} catch (e) {
  console.error(e);
  $('gload').textContent = '載入失敗，請重新整理';
}

window.GAME = { setPlay, resize, get playing() { return playing; } };
// 測試用（Playwright）：移動玩家、讀狀態
window.__game = { player, markers, got, take, groundAt, camera, renderer, scene, placeAtStart };
