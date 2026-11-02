import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadShrine } from './scene-model.js';
import { createGround, GROUND_LAYERS } from './ground.js';

/* =========================================================
   中壢神社 古今對照：3D 神社立在今日航照上
   座標系：x = 平面 X，y = 高度，z = -(平面 Y)，與 buildings.json 相同
   導覽站點的文字與視角在 STOPS；地點卡片與校準點在 map-data.json
   ========================================================= */
const HIST_PHOTO = {                 // 老照片的拍攝視角（沿用 photo-study 的對位參數）
  src: './assets/photo-study/historical.jpg',
  eye: [26.45, 9, 10.14], target: [9.6, 6.92, -4], fov: 40, aspect: 1.5   // 已用疊圖重新對位
};

const STOPS = [
  {
    title: '從中正路走進神社',
    text: '中壢神社 1939 年 10 月 15 日鎮座，面朝中壢市區。參拜道從中正路的第一鳥居進入，中途轉向，一路通往深處的社殿。',
    now: '半透明的是已經消失的神社。1947 年這裡撥給中壢中學，神社建築陸續被拆除，今天是中壢高中的校園。',
    eye: [-150, 95, 40], target: [-10, 0, -8],
    pins: [['B1', '第一鳥居'], ['L', '神馬'], ['P', '拜殿'], ['@photo', '📷 老照片拍攝點']]
  },
  {
    title: '鳥居與參道',
    text: '第一鳥居後來成了學校的校門，1951 年掛上校名與校訓。中壢神社的特色之一是燈籠很少：石燈籠只有三對。',
    now: '1965 年中央西路開通，正門遷走，這座鳥居改稱南大門，約 1988–89 年拆除。',
    eye: [-122, 10, 4], target: [-62, 3, -6],
    pins: [['B1', '第一鳥居'], ['D3', '石燈籠'], ['D1', '石燈籠']]
  },
  {
    title: '老照片的那一刻',
    text: '你現在站在當年攝影師的位置。拖曳滑桿讓老照片和 3D 模型疊合：前方是樓門與狛犬，後方是拜殿。中壢神社是第一座採用檜皮葺屋頂的神社。',
    now: '樓門大約在今天熱食部門口附近；狛犬 1950 年移到了忠義祠。',
    eye: HIST_PHOTO.eye, target: HIST_PHOTO.target,
    photo: true
  },
  {
    title: '樓門、拜殿、本殿',
    text: '樓門、拜殿、本殿沿著中軸線排列，外圍有玉垣圍起。本殿供奉北白川宮能久親王與豐受大神。',
    now: '拜殿基座上曾蓋校舍，本殿基座上蓋了困學亭；1991 年興建陶然亭時，剩下的遺構全部拆除。親師樓後方還留有一段參拜道和圍牆基座。',
    eye: [42, 26, -2], target: [9.5, 4, -13],
    pins: [['N', '樓門'], ['P', '拜殿'], ['Q', '本殿'], ['L', '神馬']]
  },
  {
    title: '神馬：從古留到今',
    text: '銅製神馬原本立在樓門前。神社其他建築都不在了，神馬是少數留下來的文物。',
    now: '神馬在壢中遷入後被搬過好幾次，現在立在中央西路的正門。虛線是它從原位置到現在正門的距離。',
    eye: [17, 7, 12], target: [4.86, 3.6, 3.99],
    pins: [['L', '神馬（原位置）'], ['N', '樓門']],
    thumb: './assets/models/horse/current.jpg'
  }
];

const HIDE_WHEN_GROUND = new Set(['A']);   // 中正路模型：航照上已經有真的路，鋪了航照就隱藏
const KIND_COLOR = { gone: '#b23a2a', moved: '#c48a1c', remain: '#2f6f4f' };
const KIND_TEXT = { gone: '已消失', moved: '被搬走', remain: '還找得到' };
const GROUND_ORDER = ['photo', 'emap', 'jm25k', 'am50k', 'off'];

const $ = s => document.querySelector(s);
const host = $('#view');
const toast = (t, ms = 2600) => { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', ms); };

/* ---------- 場景 ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xe9e6dc);
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9e6dc, 300, 800);
scene.add(new THREE.HemisphereLight(0xfff9eb, 0x7c826e, 2.2));
const sun = new THREE.DirectionalLight(0xfff4dd, 1.8);
sun.position.set(-40, 80, 50);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 3;
controls.maxDistance = 420;

/* ---------- 版面：3D 高度 = 螢幕 − 目前的底部面板 ---------- */
let viewH = innerHeight, baseFov = 50;
const bottomSheet = () => $('#tour').hidden ? $('#explore') : $('#tour');
function photoRect() { const w = innerWidth, h = w / HIST_PHOTO.aspect; return { w, h, top: Math.max(0, (viewH - h) / 2) }; }
function photoFov() {
  const half = THREE.MathUtils.degToRad(HIST_PHOTO.fov / 2);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * viewH / photoRect().h));
}
function resize() {
  viewH = innerHeight - bottomSheet().offsetHeight + 16;
  host.style.height = viewH + 'px';
  renderer.setSize(innerWidth, viewH);
  camera.aspect = innerWidth / viewH;
  baseFov = innerWidth < viewH ? 55 : 42;
  if (inPhoto && !fly) camera.fov = photoFov();
  camera.updateProjectionMatrix();
  const { h, top } = photoRect();
  Object.assign($('#shadeTop').style, { top: 0, height: top + 'px' });
  Object.assign($('#shadeBot').style, { top: (top + h) + 'px', height: Math.max(0, viewH - top - h) + 'px' });
  $('#photoLayer').style.top = top + 'px';
  $('#credit').style.bottom = (innerHeight - viewH + 4) + 'px';
}
addEventListener('resize', resize);
const ro = new ResizeObserver(resize);
ro.observe($('#explore')); ro.observe($('#tour'));

/* ---------- 老照片拍攝點（紅色視錐）---------- */
const photoMarker = new THREE.Group();
{
  const eye = new THREE.Vector3(...HIST_PHOTO.eye), tgt = new THREE.Vector3(...HIST_PHOTO.target);
  const tex = new THREE.TextureLoader().load(HIST_PHOTO.src);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dist = 7, hgt = 2 * dist * Math.tan(THREE.MathUtils.degToRad(HIST_PHOTO.fov / 2)), wid = hgt * HIST_PHOTO.aspect;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  card.position.copy(eye).addScaledVector(tgt.clone().sub(eye).normalize(), dist);
  card.lookAt(eye); card.updateMatrixWorld();
  photoMarker.add(card);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => card.localToWorld(new THREE.Vector3(a * wid / 2, b * hgt / 2, 0)));
  const pts = [];
  corners.forEach(c => pts.push(eye, c));
  photoMarker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xb23a2a })));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb23a2a }));
  dot.position.copy(eye); photoMarker.add(dot);
  scene.add(photoMarker);
}

let shrine, ground, places = [], groundH = 0;
const fadeMeshes = [];

/* ---------- 古 ↔ 今：神社模型的透明度 ---------- */
function prepareFade() {
  shrine.objects.forEach((o, id) => {
    o.root.userData.id = id;
    o.root.traverse(m => {
      if (!m.isMesh) return;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(x => { const c = x.clone(); c.transparent = true; return c; });
      m.material = Array.isArray(m.material) ? mats : mats[0];
      fadeMeshes.push({ m, mats });
    });
  });
}
let eraT = 0;                                       // 0 = 古，1 = 今
function applyEra() {
  eraT = $('#era').value / 100;
  const op = 1 - 0.93 * eraT;
  fadeMeshes.forEach(({ m, mats }) => {
    mats.forEach(x => { x.opacity = op; x.depthWrite = op > 0.6; });
    m.castShadow = op > 0.6;
  });
  horseLine && (horseLine.material.opacity = 0.35 + 0.65 * eraT);
  if (!$('#tour').hidden) renderStopText();
}
$('#era').oninput = applyEra;

/* ---------- 地面圖層 ---------- */
let groundId = 'photo';
function buildChips() {
  GROUND_ORDER.forEach(id => {
    const b = document.createElement('button');
    b.dataset.id = id;
    b.textContent = id === 'off' ? '無底圖' : GROUND_LAYERS[id].label;
    b.onclick = () => setGround(id);
    $('#groundChips').append(b);
  });
}
async function setGround(id) {
  groundId = id;
  [...$('#groundChips').children].forEach(b => b.classList.toggle('on', b.dataset.id === id));
  const ok = await ground.setLayer(id);
  if (groundId !== id) return;
  const btn = $(`#groundChips [data-id="${id}"]`);
  if (!ok) { btn.classList.add('fail'); toast('這個底圖目前載不到'); }
  const on = ok && id !== 'off';
  HIDE_WHEN_GROUND.forEach(k => { const o = shrine.objects.get(k); if (o) o.root.visible = !on; });
  $('#credit').textContent = !on ? '' : id.startsWith('jm') || id.startsWith('am') ? '中央研究院 臺灣百年歷史地圖' : '© 內政部國土測繪中心';
}

/* ---------- 神馬遷移虛線 ---------- */
let horseLine = null;
function buildHorseLine() {
  const a = places.find(p => p.id === 'horse-old').pos, b = places.find(p => p.id === 'horse-now').pos;
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], groundH + 0.3, -a[1]), new THREE.Vector3(b[0], groundH + 0.3, -b[1])]);
  horseLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xc48a1c, dashSize: 2, gapSize: 1.2, transparent: true, opacity: 0.35 }));
  horseLine.computeLineDistances();
  scene.add(horseLine);
  // 今日神馬位置立一根小柱，3D 裡也看得到
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 12), new THREE.MeshLambertMaterial({ color: 0xc48a1c }));
  post.position.set(b[0], groundH + 2, -b[1]);
  scene.add(post);
}

/* ---------- 標籤：探索模式顯示所有地點；導覽模式顯示該站重點 ---------- */
const pinBox = $('#pins');
let pins = [];
function worldOf(p) { return new THREE.Vector3(p.pos[0], groundH + 3, -p.pos[1]); }
function showPlacePins() {
  pinBox.innerHTML = ''; pins = [];
  places.forEach(p => {
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = `<span>${p.short}</span><i style="background:${KIND_COLOR[p.kind]}"></i>`;
    el.onclick = e => { e.stopPropagation(); openCard(p); };
    pinBox.append(el); pins.push({ el, pos: worldOf(p) });
  });
  const cam = document.createElement('div');
  cam.className = 'pin cam'; cam.innerHTML = '<span>📷 老照片</span>';
  cam.onclick = () => startTour(STOPS.findIndex(s => s.photo));
  pinBox.append(cam); pins.push({ el: cam, pos: new THREE.Vector3(...HIST_PHOTO.eye).add(new THREE.Vector3(0, 1.2, 0)) });
  addMePin();
}
function showStopPins(s) {
  pinBox.innerHTML = ''; pins = [];
  (s.pins || []).forEach(([id, label]) => {
    let pos;
    if (id === '@photo') pos = new THREE.Vector3(...HIST_PHOTO.eye).add(new THREE.Vector3(0, 1.2, 0));
    else {
      const o = shrine?.objects.get(id); if (!o) return;
      const b = new THREE.Box3().setFromObject(o.root);
      pos = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.3, (b.min.z + b.max.z) / 2);
    }
    const el = document.createElement('div');
    el.className = 'pin' + (id === '@photo' ? ' cam' : '');
    el.innerHTML = `<span>${label}</span>`;
    pinBox.append(el); pins.push({ el, pos });
  });
  addMePin();
}
const tmp = new THREE.Vector3();
function updatePins() {
  document.body.classList.toggle('far', camera.position.distanceTo(controls.target) > 120);
  pins.forEach(({ el, pos }) => {
    if (!pos) { el.style.display = 'none'; return; }
    tmp.copy(pos).project(camera);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 && !fly && !inPhoto;
    el.style.display = vis ? '' : 'none';
    if (vis) { el.style.left = (tmp.x + 1) / 2 * innerWidth + 'px'; el.style.top = (1 - tmp.y) / 2 * viewH + 'px'; }
  });
}

/* ---------- 地點卡片 ---------- */
function openCard(p) {
  const imgs = (p.photo ? [`<img src="${p.photo}" alt="今日照片">`] : [])
    .concat(p.slides.map(s => `<img src="slides/${s}.jpg" alt="簡報：${p.title}">`)).join('');
  $('#cardBody').innerHTML = `
    <span class="tag" style="background:${KIND_COLOR[p.kind]}">${KIND_TEXT[p.kind]}</span>
    <h2>${p.title}</h2>
    <div class="tl">
      <div><b>1939 當年</b>${p.past}</div>
      <div><b>之後</b>${p.change}</div>
      <div class="now"><b>今天</b>${p.now}</div>
    </div>
    <div class="row">
      <button id="flyBtn">移到這裡</button>
      ${p.stop ? `<button class="main" id="stopBtn">導覽這一站 ›</button>` : ''}
    </div>
    <div class="imgs">${imgs}</div>`;
  $('#flyBtn').onclick = () => { closeCard(); const w = worldOf(p); w.y = groundH + 2; flyTo(w.clone().add(new THREE.Vector3(14, 16, 18)), w, baseFov); };
  if (p.stop) $('#stopBtn').onclick = () => { closeCard(); startTour(p.stop - 1); };
  $('#cardBody').querySelectorAll('.imgs img').forEach(im => im.onclick = () => { $('#lightImg').src = im.src; $('#lightbox').classList.add('show'); });
  $('#card').scrollTop = 0;
  $('#card').classList.add('open');
}
function closeCard() { $('#card').classList.remove('open'); }
$('#cardX').onclick = closeCard;
$('#lightbox').onclick = () => $('#lightbox').classList.remove('show');
renderer.domElement.addEventListener('pointerdown', closeCard);

/* ---------- 視角 ---------- */
const HOME = { eye: [-150, 95, 40], target: [-10, 0, -8] };
function topView() {
  // 從正上方往下看，讓北方朝上（相機稍微偏南，OrbitControls 才轉得動）
  const t = new THREE.Vector3(-20, groundH, -5), n = ground.north;
  flyTo(t.clone().add(new THREE.Vector3(-n[0] * 2, 300, n[1] * 2)), t, baseFov);
}
$('#viewTop').onclick = topView;
$('#view3d').onclick = () => flyTo(new THREE.Vector3(...HOME.eye), new THREE.Vector3(...HOME.target), baseFov);

/* ---------- 導覽模式 ---------- */
let stopIndex = 0, inPhoto = false;
const dots = $('#dots');
STOPS.forEach((_, i) => { const d = document.createElement('i'); d.onclick = () => go(i); dots.append(d); });
function startTour(i = 0) {
  closeCard();
  $('#explore').hidden = true; $('#tour').hidden = false;
  go(i);
}
function endTour() {
  inPhoto = false; showPhoto(false);
  photoMarker.visible = true; controls.enabled = true;
  $('#tour').hidden = true; $('#explore').hidden = false;
  showPlacePins();
  flyTo(new THREE.Vector3(...HOME.eye), new THREE.Vector3(...HOME.target), baseFov);
  history.replaceState(null, '', location.pathname);
}
$('#startTour').onclick = () => startTour(0);
$('#endTour').onclick = endTour;
function renderStopText() {
  const s = STOPS[stopIndex];
  $('#stopText').textContent = eraT > 0.5 && s.now ? s.now : s.text;
}
function go(i) {
  stopIndex = Math.max(0, Math.min(STOPS.length - 1, i));
  const s = STOPS[stopIndex];
  [...dots.children].forEach((d, k) => d.classList.toggle('on', k === stopIndex));
  $('#stopNo').textContent = `第 ${stopIndex + 1} 站 / 共 ${STOPS.length} 站`;
  $('#stopTitle').textContent = s.title;
  renderStopText();
  $('#prev').disabled = stopIndex === 0; $('#prev').style.opacity = stopIndex === 0 ? .4 : 1;
  $('#next').textContent = stopIndex === STOPS.length - 1 ? '結束導覽' : '下一站';
  $('#slider2').classList.toggle('show', !!s.photo);
  $('#thumb').classList.toggle('show', !!s.thumb);
  if (s.thumb) $('#thumbImg').src = s.thumb;
  inPhoto = !!s.photo;
  showPhoto(false);
  photoMarker.visible = !s.photo;
  controls.enabled = !s.photo;
  flyTo(new THREE.Vector3(...s.eye), new THREE.Vector3(...s.target), s.photo ? photoFov() : baseFov, () => {
    if (s.photo) { $('#fade').value = 0; showPhoto(true); applyFade(); }
  });
  showStopPins(s);
  history.replaceState(null, '', '#stop-' + (stopIndex + 1));
}
$('#prev').onclick = () => go(stopIndex - 1);
$('#next').onclick = () => stopIndex === STOPS.length - 1 ? endTour() : go(stopIndex + 1);
function showPhoto(on) { ['#photoLayer', '#shadeTop', '#shadeBot'].forEach(q => $(q).classList.toggle('show', on)); }
function applyFade() { $('#photoImg').style.opacity = 1 - $('#fade').value / 100; }
$('#fade').oninput = applyFade;
$('#thumb').onclick = () => { $('#lightImg').src = $('#thumbImg').src; $('#lightbox').classList.add('show'); };
// 照片站：左右拖曳畫面也能調整疊合
let dragX = null;
host.addEventListener('pointerdown', e => { if (inPhoto) dragX = e.clientX; });
addEventListener('pointerup', () => dragX = null);
host.addEventListener('pointermove', e => {
  if (dragX === null) return;
  $('#fade').value = Math.max(0, Math.min(100, Number($('#fade').value) + (e.clientX - dragX) / innerWidth * 150));
  dragX = e.clientX; applyFade();
});

/* ---------- 我在哪（GPS，需要 https）---------- */
let me = null, watching = null, lastNear = null;
const meDot = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0x1a73e8 }));
meDot.visible = false; scene.add(meDot);
function addMePin() {
  if (!me) return;
  const el = document.createElement('div'); el.className = 'pin me'; el.innerHTML = '<span>你在這裡</span><i></i>';
  pinBox.append(el); pins.push({ el, get pos() { return me ? new THREE.Vector3(me[0], groundH + 1, -me[1]) : null; } });
}
$('#locBtn').onclick = () => {
  if (!navigator.geolocation) return toast('這個瀏覽器無法定位');
  if (me) return flyMe();
  toast('定位中…');
  if (watching !== null) return;
  watching = navigator.geolocation.watchPosition(pos => {
    const first = !me;
    me = ground.llToPlan(pos.coords.latitude, pos.coords.longitude);
    meDot.position.set(me[0], groundH + 0.2, -me[1]); meDot.visible = true;
    if (first) { $('#tour').hidden ? showPlacePins() : showStopPins(STOPS[stopIndex]); flyMe(); }
    nearest();
  }, () => { watching = null; toast('無法取得位置（請允許定位）'); }, { enableHighAccuracy: true });
};
function flyMe() {
  const w = new THREE.Vector3(me[0], groundH, -me[1]);
  if (Math.hypot(me[0] + 20, me[1]) > 250) toast('你目前不在中壢高中附近');
  flyTo(w.clone().add(new THREE.Vector3(0, 60, 40)), w, baseFov);
}
function nearest() {
  let best = null, bd = 1e9;
  places.forEach(p => { const d = Math.hypot(p.pos[0] - me[0], p.pos[1] - me[1]) * 2.24; if (d < bd) { bd = d; best = p; } });   // 模型單位約 2.24 公尺
  if (best && bd < 25 && best.id !== lastNear) { lastNear = best.id; toast(`你正站在：${best.title}`); }
}

/* ---------- 相機飛行與主迴圈 ---------- */
let fly = null;
function flyTo(eye, target, fov, done) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov, p1: eye, t1: target, f1: fov, start: performance.now(), ms: 1300, done };
}
/* ---------- 載入 ---------- */
try {
  const [config, md] = await Promise.all([fetch('./buildings.json').then(r => r.json()), fetch('./map-data.json').then(r => r.json())]);
  shrine = await loadShrine(config);
  scene.add(shrine.integrated);
  prepareFade();
  const path = shrine.objects.get('C');
  groundH = path ? new THREE.Box3().setFromObject(path.root).min.y - 0.03 : 0;
  if (!isFinite(groundH)) groundH = 0;
  ground = createGround(scene, md.control, { bounds: { x0: -200, x1: 150, y0: -150, y1: 140 }, height: groundH });
  places = md.places.map(p => ({ ...p, pos: p.plan ? p.plan : ground.llToPlan(p.lat, p.lng) }));
  buildHorseLine();
  buildChips();
  setGround('photo');
  $('#loading').style.opacity = 0;
  setTimeout(() => $('#loading').remove(), 500);
} catch (e) {
  console.error(e);
  $('#loadMsg').textContent = '載入失敗，請重新整理';
}

resize();
camera.position.set(-160, 200, 160); controls.target.set(-10, 0, -8);
camera.fov = baseFov; camera.updateProjectionMatrix();
const hashStop = Number((location.hash.match(/stop-(\d)/) || [])[1]);
if (hashStop) startTour(hashStop - 1);
else { showPlacePins(); flyTo(new THREE.Vector3(...HOME.eye), new THREE.Vector3(...HOME.target), baseFov); }

renderer.setAnimationLoop(() => {
  if (fly) {
    const k = Math.min((performance.now() - fly.start) / fly.ms, 1);
    const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    camera.fov = fly.f0 + (fly.f1 - fly.f0) * e;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    if (k === 1) { const d = fly.done; fly = null; d && d(); }
  } else if (controls.enabled) controls.update();
  renderer.render(scene, camera);
  updatePins();
});

window.__app = { startTour, endTour, go, setGround, camera, controls, get shrine() { return shrine; }, get ground() { return ground; } };
