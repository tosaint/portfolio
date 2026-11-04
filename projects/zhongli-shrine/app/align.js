import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadShrine } from './scene-model.js';
import { solveCamera } from './camsolve.js';

/* 預設照片（可再上傳其他照片）。對位結果會存在這支手機的瀏覽器裡。 */
const PRESETS = [
  { id: 'torii2',  label: '第二鳥居看拜殿', src: './align-photos/torii2.jpg' },
  { id: 'haiden',  label: '拜殿正面',       src: './align-photos/haiden.jpg' },
  { id: 'lantern', label: '石燈籠與手水舍', src: './align-photos/lantern.jpg' },
  { id: 'gate',    label: '樓門與拜殿（已用於導覽）', src: './align-photos/gate.jpg' }
];

// 你在 2026-11-02 點的對應點（以「構件＋構件內座標」記錄，模型修正後會跟著移動）
const SEED = {"torii2": [{"uv": [360.9, 58.7], "id": "B2", "local": [-35.705, 59.8088, 1.6076]}, {"uv": [1598.4, 64.6], "id": "B2", "local": [35.705, 59.8907, 1.6076]}, {"uv": [615.4, 1045.8], "id": "B2", "local": [-18.1239, 10.5262, 1.8329]}, {"uv": [1347.8, 1082.4], "id": "B2", "local": [18.12, 10.53, 1.83]}, {"uv": [654.6, 312.5], "id": "B2", "local": [-17.2433, 48.1255, 1.8329]}, {"uv": [1317.7, 319.1], "id": "B2", "local": [17.1204, 48.2484, 1.7817]}, {"uv": [1005, 983.1], "id": "O", "local": [-2.15, 0.346, 0.2]}, {"uv": [804.7, 696.4], "id": "P", "local": [-3.869, 6.227, -0.38]}, {"uv": [1108.3, 821.9], "id": "P", "local": [0.757, 4.055, 3.425]}, {"uv": [1515.2, 746.1], "id": "P", "local": [5.72, 3.83, -0.312]}], "haiden": [{"uv": [707.8, 96], "id": "P", "local": [-3.8566, 6.28, -0.347]}, {"uv": [1762.5, 86.6], "id": "P", "local": [3.7326, 6.267, -0.363]}, {"uv": [314.1, 264.7], "id": "P", "local": [-5.374, 4.236, 3.375]}, {"uv": [2160.9, 274.1], "id": "P", "local": [5.292, 4.26, 3.425]}, {"uv": [820.3, 883.5], "id": "P", "local": [-1.8, 0.34, 3.967]}, {"uv": [1678.1, 860], "id": "P", "local": [1.835, 0.232, 3.538]}, {"uv": [1062.4, 849.3], "id": "P", "local": [-1.295, 0.85, 2.082]}, {"uv": [1429.2, 829.1], "id": "P", "local": [1.099, 1.144, 2.353]}, {"uv": [1244.3, 437], "id": "P", "local": [0.155, 3.87, 2.563]}, {"uv": [1299.3, 1287.3], "xyz": [9.36, 4.09, -3.609]}], "lantern": [{"uv": [984.4, 138.1], "id": "D5", "local": [-2.6328, 127.2943, 0.4597]}, {"uv": [595.3, 301], "id": "D5", "local": [-21.4386, 108.196, -18.8058]}, {"uv": [1148.4, 263.5], "id": "D5", "local": [-21.4804, 108.4467, 21.4804]}, {"uv": [371.7, 1393.9], "id": "D5", "local": [-34.937, 34.0176, -34.937]}, {"uv": [1247.4, 1432.1], "id": "D5", "local": [-34.937, 34.0176, 34.937]}, {"uv": [548.4, 878.7], "id": "E", "local": [-21.9757, 48.7332, -1.2281]}, {"uv": [1504.7, 915], "id": "G", "local": [-0.1136, 64.0025, 3.0099]}, {"uv": [1917.2, 882.2], "id": "D6", "local": [-2.8418, 126.2495, 1.6298]}, {"uv": [440.6, 343.1], "id": "B2", "local": [-1.5359, 54.177, 0.9216]}, {"uv": [65.6, 244.7], "id": "B2", "local": [-30.6365, 48.7706, 1.1468]}], "gate": [{"uv": [63.3, 730.1], "id": "M", "local": [-2.1485, 1.939, 0.2]}, {"uv": [499.2, 792.5], "id": "M", "local": [2.4635, 2.131, 0.2]}, {"uv": [327, 426.9], "id": "N", "local": [-3.368, 4.467, -0.163]}, {"uv": [769.9, 430.4], "id": "N", "local": [3.05, 4.325, -0.008]}, {"uv": [1037.1, 282.7], "id": "P", "local": [-3.8442, 6.333, -0.38]}, {"uv": [1469.5, 279.2], "id": "P", "local": [3.7326, 6.18, -0.312]}, {"uv": [1596.1, 919], "id": "R", "local": [8.68, 0.24, 6.186]}, {"uv": [1255.1, 588.6], "id": "O", "local": [2.65, 2.146, 0.35]}, {"uv": [777, 803], "id": "R", "local": [3.119, -0.251, 6.785]}, {"uv": [218, 820.6], "xyz": [7.924, 2.876, 1.744]}]};

const $ = s => document.querySelector(s);
const toast = (t, ms = 2400) => { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', ms); };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('align2:' + k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('align2:' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ================= 狀態 ================= */
let photo = null;          // { id, img, w, h }
let pairs = [];            // [{ uv:[u,v]|null, xyz:[x,y,z]|null }]
let sel = 0;
let solved = null;
let snap = true;

/* ================= 照片窗格 ================= */
const pane = $('#photoPane'), pc = $('#photoCanvas'), pctx = pc.getContext('2d');
let view = { s: 1, tx: 0, ty: 0 };
function fitPhoto() {
  const r = pane.getBoundingClientRect();
  const s = Math.min(r.width / photo.w, r.height / photo.h);
  view = { s, tx: (r.width - photo.w * s) / 2, ty: (r.height - photo.h * s) / 2 };
}
function drawPhoto() {
  const r = pane.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (pc.width !== Math.round(r.width * dpr)) { pc.width = Math.round(r.width * dpr); pc.height = Math.round(r.height * dpr); }
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pctx.clearRect(0, 0, r.width, r.height);
  if (!photo) return;
  pctx.drawImage(photo.img, view.tx, view.ty, photo.w * view.s, photo.h * view.s);
  // 計算結果：模型上的點投影回照片（十字），連到你點的位置
  if (solved) solved.errors.forEach((e, i) => {
    const p = pairs.filter(q => q.uv && hasXYZ(q))[i]; if (!p) return;
    const [a, b] = toScreen(p.uv), [c, d] = toScreen(e.uv);
    pctx.strokeStyle = e.e < 8 ? '#3fd17a' : e.e < 25 ? '#ffc23d' : '#ff5a4a'; pctx.lineWidth = 2;
    pctx.beginPath(); pctx.moveTo(a, b); pctx.lineTo(c, d); pctx.stroke();
    pctx.beginPath(); pctx.moveTo(c - 6, d); pctx.lineTo(c + 6, d); pctx.moveTo(c, d - 6); pctx.lineTo(c, d + 6); pctx.stroke();
  });
  pairs.forEach((p, i) => {
    if (!p.uv) return;
    const [x, y] = toScreen(p.uv);
    pctx.fillStyle = i === sel ? '#1a73e8' : '#b23a2a';
    pctx.strokeStyle = '#fff'; pctx.lineWidth = 2;
    pctx.beginPath(); pctx.arc(x, y, 9, 0, Math.PI * 2); pctx.fill(); pctx.stroke();
    pctx.fillStyle = '#fff'; pctx.font = 'bold 11px sans-serif'; pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
    pctx.fillText(String(i + 1), x, y + 0.5);
  });
  placeOverlay();
}
const toScreen = ([u, v]) => [view.tx + u * view.s, view.ty + v * view.s];
const toImage = (x, y) => [(x - view.tx) / view.s, (y - view.ty) / view.s];

// 手勢：點一下＝放點；拖曳點＝移動；拖曳空白＝平移；雙指／滾輪＝縮放
const ptrs = new Map();
let gesture = null;
pane.addEventListener('pointerdown', e => {
  pane.setPointerCapture(e.pointerId);
  const r = pane.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  ptrs.set(e.pointerId, { x, y });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, v: { ...view } }; return; }
  const hit = pairs.findIndex(p => p.uv && Math.hypot(...toScreen(p.uv).map((v, k) => v - [x, y][k])) < 18);
  gesture = hit >= 0 ? { type: 'drag', i: hit, x0: x, y0: y, moved: false } : { type: 'pan', x0: x, y0: y, v: { ...view }, moved: false };
  if (hit >= 0) { sel = hit; renderPairs(); }
});
pane.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId) || !gesture) return;
  const r = pane.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  ptrs.set(e.pointerId, { x, y });
  if (gesture.type === 'pinch' && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), k = d / gesture.d;
    const s = Math.max(0.05, Math.min(20, gesture.v.s * k));
    view = { s, tx: gesture.cx - (gesture.cx - gesture.v.tx) * s / gesture.v.s, ty: gesture.cy - (gesture.cy - gesture.v.ty) * s / gesture.v.s };
    drawPhoto(); return;
  }
  if (Math.hypot(x - gesture.x0, y - gesture.y0) > 6) gesture.moved = true;
  if (gesture.type === 'pan' && gesture.moved) { view = { ...gesture.v, tx: gesture.v.tx + x - gesture.x0, ty: gesture.v.ty + y - gesture.y0 }; drawPhoto(); }
  if (gesture.type === 'drag' && gesture.moved) { pairs[gesture.i].uv = toImage(x, y); showLoupe(x, y); drawPhoto(); }
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  const r = pane.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  ptrs.delete(e.pointerId);
  if (!gesture) return;
  if (gesture.type === 'pinch') { if (ptrs.size === 0) gesture = null; return; }
  if (!gesture.moved && gesture.type === 'pan') {          // 點一下：放點
    const [u, v] = toImage(x, y);
    if (u >= 0 && v >= 0 && u <= photo.w && v <= photo.h) { ensurePair(); pairs[sel].uv = [u, v]; changed(); }
  } else if (gesture.type === 'drag' && gesture.moved) changed();
  $('#loupe').style.display = 'none';
  gesture = null;
}
pane.addEventListener('pointerup', endPtr);
pane.addEventListener('pointercancel', endPtr);
pane.addEventListener('wheel', e => {
  e.preventDefault();
  const r = pane.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const s = Math.max(0.05, Math.min(20, view.s * Math.exp(-e.deltaY * 0.0015)));
  view = { s, tx: x - (x - view.tx) * s / view.s, ty: y - (y - view.ty) * s / view.s };
  drawPhoto();
}, { passive: false });
// 拖曳時的放大鏡（手指會擋住點）
function showLoupe(x, y) {
  const l = $('#loupe'), c = l.getContext('2d'), [u, v] = toImage(x, y), z = 70;
  l.style.display = 'block';
  c.clearRect(0, 0, 240, 240);
  c.drawImage(photo.img, u - z / 2, v - z / 2, z, z, 0, 0, 240, 240);
  c.strokeStyle = '#ff3b30'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(120, 100); c.lineTo(120, 140); c.moveTo(100, 120); c.lineTo(140, 120); c.stroke();
}

/* ================= 3D 窗格 ================= */
const mpane = $('#modelPane');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0xe9e6dc);
mpane.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff9eb, 0x7c826e, 2.2));
const sun = new THREE.DirectionalLight(0xfff4dd, 1.6); sun.position.set(-40, 80, 50); scene.add(sun);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
camera.position.set(40, 30, 25); controls.target.set(9.5, 4, -8);
const pickables = [];
let shrine = null;
// 點的世界座標：有構件的話，跟著構件（模型修正後自動更新）
function xyzOf(p) {
  if (p.id && shrine?.objects.get(p.id)) return shrine.objects.get(p.id).root.localToWorld(new THREE.Vector3(...p.local)).toArray();
  return p.xyz || null;
}
const hasXYZ = p => !!(p.local || p.xyz);
const markers = new THREE.Group(); scene.add(markers);

async function loadModel() {
  const config = await (await fetch('./buildings.json')).json();
  shrine = await loadShrine(config);
  shrine.integrated.updateMatrixWorld(true);
  // 和主畫面一樣，把每個構件合併成單一網格，才轉得順
  shrine.objects.forEach((o, id) => {
    const pos = [], nor = [], col = [], n3 = new THREE.Matrix3(), v = new THREE.Vector3(), nn = new THREE.Vector3();
    o.root.traverse(m => {
      if (!m.isMesh || !m.geometry.attributes.position) return;
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      if (!g.attributes.normal) { g = g.clone(); g.computeVertexNormals(); }
      const P = g.attributes.position, N = g.attributes.normal, mats = Array.isArray(m.material) ? m.material : [m.material];
      const groups = g.groups.length ? g.groups : [{ start: 0, count: P.count, materialIndex: 0 }];
      n3.getNormalMatrix(m.matrixWorld);
      for (const gr of groups) {
        const c = (mats[gr.materialIndex] || mats[0]).color || new THREE.Color(0x888888);
        for (let i = gr.start; i < Math.min(gr.start + gr.count, P.count); i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); pos.push(v.x, v.y, v.z);
          nn.fromBufferAttribute(N, i).applyMatrix3(n3).normalize(); nor.push(nn.x, nn.y, nn.z);
          col.push(c.r, c.g, c.b);
        }
      }
    });
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.userData.id = id;
    scene.add(mesh); pickables.push(mesh);
    overlayScene.add(new THREE.Mesh(g, overlayMat));
  });
}

// 點一下模型：放點（可吸附到最近的頂點，角落比較準）
const ray = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', e => down = { x: e.clientX, y: e.clientY, t: performance.now() });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 450;
  down = null;
  if (moved > 6 || !quick) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (!hit) return;
  let p = hit.point.clone();
  if (snap && hit.face) {
    const P = hit.object.geometry.attributes.position;
    let best = null, bd = 16;                          // 16 像素內才吸附
    for (const k of [hit.face.a, hit.face.b, hit.face.c]) {
      const w = new THREE.Vector3().fromBufferAttribute(P, k).applyMatrix4(hit.object.matrixWorld);
      const s = w.clone().project(camera), sx = (s.x + 1) / 2 * r.width, sy = (1 - s.y) / 2 * r.height;
      const d = Math.hypot(sx - (e.clientX - r.left), sy - (e.clientY - r.top));
      if (d < bd) { bd = d; best = w; }
    }
    if (best) p = best;
  }
  ensurePair();
  const id = hit.object.userData.id, root = shrine.objects.get(id)?.root;
  if (root) { pairs[sel].id = id; pairs[sel].local = root.worldToLocal(p.clone()).toArray(); delete pairs[sel].xyz; }
  else { pairs[sel].xyz = [p.x, p.y, p.z]; delete pairs[sel].id; delete pairs[sel].local; }
  changed();
});

const labels = $('#labels3d');
function drawMarkers() {
  markers.clear(); labels.innerHTML = '';
  pairs.forEach((p, i) => {
    if (!hasXYZ(p)) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: i === sel ? 0x1a73e8 : 0xb23a2a, depthTest: false }));
    m.renderOrder = 10; m.position.set(...xyzOf(p)); markers.add(m);
    const s = document.createElement('span'); s.textContent = i + 1; if (i === sel) s.className = 'sel';
    s.dataset.i = i; labels.append(s);
  });
}
function placeLabels() {
  const r = renderer.domElement.getBoundingClientRect(), t = new THREE.Vector3();
  [...labels.children].forEach(s => {
    const p = pairs[+s.dataset.i]; if (!p || !hasXYZ(p)) return;
    t.set(...xyzOf(p)).project(camera);
    s.style.display = t.z < 1 ? '' : 'none';
    s.style.left = (t.x + 1) / 2 * r.width + 'px'; s.style.top = (1 - t.y) / 2 * r.height + 'px';
  });
}

/* ================= 疊合檢視（解出相機後）================= */
const ov = $('#overlay3d');
const overlayRenderer = new THREE.WebGLRenderer({ canvas: ov, antialias: true, alpha: true });
overlayRenderer.setClearColor(0x000000, 0);
const overlayScene = new THREE.Scene();
overlayScene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2.4));
const overlayMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const ovSun = new THREE.DirectionalLight(0xffffff, 1.2); ovSun.position.set(-40, 80, 50); overlayScene.add(ovSun);
const ovCam = new THREE.PerspectiveCamera(40, 1.5, 0.1, 2000);
function renderOverlay() {
  if (!solved || !photo) { ov.style.opacity = 0; $('#fadeRow').classList.remove('show'); return; }
  const W = 1200, H = Math.round(W * photo.h / photo.w);
  if (ov.width !== W || ov.height !== H) overlayRenderer.setSize(W, H, false);
  ovCam.fov = solved.fovV; ovCam.aspect = photo.w / photo.h;
  ovCam.position.set(...solved.position);
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...solved.axes.x), new THREE.Vector3(...solved.axes.y), new THREE.Vector3(...solved.axes.z));
  ovCam.quaternion.setFromRotationMatrix(m);
  ovCam.updateProjectionMatrix();
  overlayRenderer.render(overlayScene, ovCam);
  $('#fadeRow').classList.add('show');
  ov.style.opacity = $('#fade').value / 100;
  placeOverlay();
}
function placeOverlay() {
  if (!photo) return;
  ov.style.width = photo.w * view.s + 'px'; ov.style.height = photo.h * view.s + 'px';
  ov.style.transform = `translate(${view.tx}px, ${view.ty}px)`;
}
$('#fade').oninput = () => ov.style.opacity = $('#fade').value / 100;

/* ================= 點組與計算 ================= */
function ensurePair() { if (!pairs[sel]) { pairs[sel] = { uv: null, xyz: null }; } }
function renderPairs() {
  const box = $('#pairs'); box.innerHTML = '';
  pairs.forEach((p, i) => {
    const b = document.createElement('button');
    const err = solved && p.uv && hasXYZ(p) ? solved.errors[pairs.slice(0, i).filter(q => q.uv && hasXYZ(q)).length] : null;
    b.innerHTML = `${i + 1}${p.uv ? '📷' : ''}${hasXYZ(p) ? '🧊' : ''}${err ? `<small>${err.e.toFixed(0)}px</small>` : ''}`;
    b.className = (i === sel ? 'sel ' : '') + (p.uv && hasXYZ(p) ? 'done' : '');
    b.onclick = () => { sel = i; renderPairs(); drawPhoto(); drawMarkers(); };
    box.append(b);
  });
  drawMarkers();
}
// 點的立體分布：最薄方向 ÷ 最厚方向。接近 0 = 全部在同一個平面上
function flatness(ps) {
  const n = ps.length, c = [0, 1, 2].map(k => ps.reduce((s, p) => s + p.xyz[k], 0) / n);
  const C = [0, 1, 2].map(i => [0, 1, 2].map(j => ps.reduce((s, p) => s + (p.xyz[i] - c[i]) * (p.xyz[j] - c[j]), 0) / n));
  // 3×3 對稱矩陣特徵值（解析解）
  const p1 = C[0][1] ** 2 + C[0][2] ** 2 + C[1][2] ** 2, q = (C[0][0] + C[1][1] + C[2][2]) / 3;
  const p2 = (C[0][0] - q) ** 2 + (C[1][1] - q) ** 2 + (C[2][2] - q) ** 2 + 2 * p1, pp = Math.sqrt(p2 / 6) || 1e-9;
  const B = C.map((r, i) => r.map((v, j) => (v - (i === j ? q : 0)) / pp));
  const detB = B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) - B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0]) + B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0]);
  const phi = Math.acos(Math.max(-1, Math.min(1, detB / 2))) / 3;
  const e1 = q + 2 * pp * Math.cos(phi), e3 = q + 2 * pp * Math.cos(phi + 2 * Math.PI / 3);
  return Math.sqrt(Math.max(0, e3) / Math.max(e1, 1e-9));
}
function changed() {
  const full = pairs.filter(p => p.uv && hasXYZ(p)).map(p => ({ uv: p.uv, xyz: xyzOf(p), ref: p }));
  solved = full.length >= 6 ? solveCamera(full, photo.w, photo.h) : null;
  const st = $('#status');
  if (full.length < 6) st.innerHTML = `已完成 <b>${full.length}</b> 組，還差 ${6 - full.length} 組。${pairs[sel] && pairs[sel].uv && !hasXYZ(pairs[sel]) ? '現在到模型上點同一個位置。' : pairs[sel] && hasXYZ(pairs[sel]) && !pairs[sel].uv ? '現在到照片上點同一個位置。' : ''}`;
  else if (!solved) st.innerHTML = '<b class="bad">算不出來</b>：請檢查有沒有點錯對應，或把點分散開一點。';
  else {
    const q = solved.rms < 8 ? '很準' : solved.rms < 20 ? '大致對齊' : '誤差偏大';
    const worst = solved.errors.reduce((m, e, i) => e.e > solved.errors[m].e ? i : m, 0);
    const worstNo = pairs.indexOf(full[worst].ref) + 1;
    let tip = solved.rms >= 20 ? `第 ${worstNo} 組誤差最大，先檢查它；若確定點對了，可能是模型那裡的比例不準。` : '';
    if (flatness(full) < 0.03) tip = '⚠ 點幾乎都在同一個平面上（例如全在鳥居上），深度算不準。請加幾個前後不同深度的點，例如後方建築的屋簷、台階。';
    else if (full.length < 8) tip += ' 再加到 8 組以上會更穩。';
    st.innerHTML = `${full.length} 組，平均誤差 <b class="${solved.rms < 20 ? 'ok' : 'bad'}">${solved.rms.toFixed(1)} 像素</b>（${q}）・視角 ${solved.fovV.toFixed(1)}°<br>${tip}`;
  }
  store.set(photo.id, pairs);
  renderPairs(); drawPhoto(); renderOverlay();
}
$('#addPair').onclick = () => {
  const empty = pairs.findIndex(p => !p.uv || !hasXYZ(p));
  sel = empty >= 0 ? empty : pairs.length; ensurePair(); renderPairs(); drawPhoto();
};
$('#delPair').onclick = () => { if (!pairs[sel]) return; pairs.splice(sel, 1); sel = Math.max(0, sel - 1); changed(); };
$('#snapBtn').onclick = () => { snap = !snap; $('#snapBtn').textContent = '吸附頂點：' + (snap ? '開' : '關'); };
$('#copyBtn').onclick = async () => {
  if (!solved) return toast('至少完成 6 組並算出結果，才能複製');
  const out = {
    photo: photo.id, size: [photo.w, photo.h],
    position: solved.position.map(v => +v.toFixed(3)),
    axes: Object.fromEntries(Object.entries(solved.axes).map(([k, v]) => [k, v.map(x => +x.toFixed(5))])),
    fovV: +solved.fovV.toFixed(3), rms: +solved.rms.toFixed(2),
    pairs: pairs.filter(p => p.uv && hasXYZ(p)).map(p => ({ uv: p.uv.map(v => +v.toFixed(1)), ...(p.id ? { id: p.id, local: p.local.map(v => +v.toFixed(4)) } : {}), xyz: xyzOf(p).map(v => +v.toFixed(3)) }))
  };
  const text = JSON.stringify(out);
  try { await navigator.clipboard.writeText(text); toast('已複製，貼給 Claude 就好'); }
  catch (e) { prompt('請複製這段文字：', text); }
};

/* ================= 照片載入 ================= */
PRESETS.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; $('#photoSel').append(o); });
function loadPhoto(id, src) {
  const img = new Image();
  img.onload = () => {
    photo = { id, img, w: img.naturalWidth, h: img.naturalHeight };
    pairs = store.get(id) || structuredClone(SEED[id] || []); sel = 0; solved = null;
    fitPhoto(); changed();
  };
  img.src = src;
}
$('#photoSel').onchange = e => { const p = PRESETS.find(x => x.id === e.target.value); loadPhoto(p.id, p.src); };
$('#file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const id = 'upload:' + f.name;
  const o = document.createElement('option'); o.value = id; o.textContent = f.name; $('#photoSel').append(o); $('#photoSel').value = id;
  loadPhoto(id, URL.createObjectURL(f));
};

/* ================= 版面與迴圈 ================= */
function resize() {
  const r = mpane.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  if (photo) { fitPhoto(); drawPhoto(); }
}
new ResizeObserver(resize).observe(mpane);
new ResizeObserver(() => photo && (fitPhoto(), drawPhoto())).observe(pane);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); placeLabels(); });

await loadModel();
resize();
loadPhoto(PRESETS[0].id, PRESETS[0].src);
window.__align = { get pairs() { return pairs; }, set pairs(v) { pairs = v; changed(); }, get solved() { return solved; }, camera, controls };
