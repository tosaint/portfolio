import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildShrine, LV, DIMS } from './shrine-proc.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGround, GROUND_LAYERS } from './ground.js';
import { S_IN, LEVEL, warpH, warpY, modelToWorld, qToLL, llToQ, NORTH_Q } from './site.js';

/* =========================================================
   中壢神社 古今對照：3D 神社立在今日航照上
   座標系：x = 平面 X，y = 高度，z = -(平面 Y)，與 buildings.json 相同
   導覽站點的文字與視角在 STOPS；地點卡片與校準點在 map-data.json
   ========================================================= */
const HIST_PHOTO = {                 // 神門照片的拍攝視角（2026-11-03 以照片程式模型重新反求，公尺）
  src: './assets/photo-study/historical.jpg',
  eye: [20.972, 5.836, 54.194], target: [10.646, 4.548, 37.114], fov: 24.6, aspect: 1.5,
  axes: {"x": [0.8558, -0.00099, -0.5173], "y": [-0.03247, 0.99792, -0.05561], "z": [0.51628, 0.06439, 0.854]},
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
    text: '第一鳥居後來成了學校的校門，1951 年掛上校名與校訓。當年報紙特別提到中壢神社「沒有燈籠」（除了必要的之外），石燈籠只有三對。',
    now: '1965 年中央西路開通，正門遷走，這座鳥居改稱南大門，約 1988–89 年拆除。',
    eye: [-122, 10, 4], target: [-62, 3, -6],
    pins: [['B1', '第一鳥居'], ['D3', '石燈籠'], ['D1', '石燈籠']]
  },
  {
    title: '老照片的那一刻',
    text: '你現在站在當年攝影師的位置。拖曳滑桿讓老照片和 3D 模型疊合：前方是神門與狛犬，後方是拜殿。當年報紙說，中壢神社的檜皮葺屋頂是「臺灣唯一」。',
    now: '神門大約在今天熱食部門口附近；狛犬 1950 年移到了忠義祠。',
    eye: HIST_PHOTO.eye, target: HIST_PHOTO.target,
    photo: true
  },
  {
    title: '神門、拜殿、本殿',
    text: '神門、拜殿、本殿沿著中軸線排列，外圍有玉垣圍起。本殿供奉北白川宮能久親王與豐受大神。',
    now: '拜殿基座上曾蓋校舍，本殿基座上蓋了困學亭；1991 年興建陶然亭時，剩下的遺構全部拆除。親師樓後方還留有一段參拜道和圍牆基座。',
    eye: [42, 26, -2], target: [9.5, 4, -13],
    pins: [['N', '神門'], ['P', '拜殿'], ['Q', '本殿'], ['L', '神馬']]
  },
  {
    title: '神馬：從古留到今',
    text: '銅製神馬原本立在神門前。神社其他建築都不在了，神馬是少數留下來的文物。',
    now: '神馬在壢中遷入後被搬過好幾次，現在立在中央西路的正門。虛線是它從原位置到現在正門的距離。',
    eye: [17, 7, 12], target: [4.86, 3.6, 3.99],
    pins: [['L', '神馬（原位置）'], ['N', '神門']],
    thumb: './assets/models/horse/current.jpg'
  }
];

// 以上座標都是原配置模型的單位；轉成公尺世界座標（見 site.js）
STOPS.forEach(s => { if (!s.photo) { s.eye = modelToWorld(s.eye); s.target = modelToWorld(s.target); } else { s.eye = HIST_PHOTO.eye; s.target = HIST_PHOTO.target; } });
// 「今」模式下仍保持實心的構件（其餘變半透明）
const KIND_COLOR = { gone: '#b23a2a', moved: '#c48a1c', remain: '#2f6f4f' };
const KIND_TEXT = { gone: '已消失', moved: '被搬走', remain: '還找得到' };
const GROUND_ORDER = ['photo', 'emap', 'jm25k', 'am50k', 'off'];

const $ = s => document.querySelector(s);
const host = $('#view');
const toast = (t, ms = 2600) => { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', ms); };

/* ---------- 場景 ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0xe9e6dc);
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9e6dc, 450, 1300);
scene.add(new THREE.HemisphereLight(0xfff9eb, 0x7c826e, 2.2));
const sun = new THREE.DirectionalLight(0xfff4dd, 1.8);
sun.position.set(-40, 80, 50);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 3;
controls.maxDistance = 650;
controls.minDistance = 4;
controls.addEventListener('change', () => { dirty = true; });

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
  dirty = true;
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
  const tex = new THREE.TextureLoader().load(HIST_PHOTO.src, () => { dirty = true; });
  tex.colorSpace = THREE.SRGBColorSpace;
  const dist = 7 * S_IN, hgt = 2 * dist * Math.tan(THREE.MathUtils.degToRad(HIST_PHOTO.fov / 2)), wid = hgt * HIST_PHOTO.aspect;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  card.position.copy(eye).addScaledVector(tgt.clone().sub(eye).normalize(), dist);
  card.lookAt(eye); card.updateMatrixWorld();
  photoMarker.add(card);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => card.localToWorld(new THREE.Vector3(a * wid / 2, b * hgt / 2, 0)));
  const pts = [];
  corners.forEach(c => pts.push(eye, c));
  photoMarker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xb23a2a })));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb23a2a }));
  dot.position.copy(eye); photoMarker.add(dot);
  scene.add(photoMarker);
}

let shrine, ground, places = [], groundH = 0, histData = null, horseScan = null;

/* ---------- 古 ↔ 今：神社模型的透明度 ---------- */
// 神社模型由 shrine-proc.js 依老照片程式建構：同材質合併成一個網格，全部只要十來次繪製呼叫
const fadeMats = [];
let eraT = 0;                                       // 0 = 古，1 = 今
function applyEra() {
  eraT = $('#era').value / 100;
  const op = 1 - 0.93 * eraT, tr = op < 0.999;
  fadeMats.forEach(x => {
    if (x.transparent !== tr) { x.transparent = tr; x.needsUpdate = true; }
    x.opacity = op; x.depthWrite = op > 0.6;
  });
  dirty = true;
  horseLine && (horseLine.material.opacity = 0.35 + 0.65 * eraT);
  if (!$('#tour').hidden) renderStopText();
}
$('#era').oninput = applyEra;

/* ---------- 銅馬掃描（真實尺寸）---------- */
// 2026 年的 3D 掃描，依現場實測（台座 102×249 公分、連台座自路面高 310 公分）校正成公尺。
// 台座是今天的樣式，1939 年的台座形式不同。
function loadHorseScan() {
  new GLTFLoader().load('./assets/horse-scan.glb', g => {
    const scan = g.scene;
    // 位置：配置圖的神馬（神門前左側），朝向沿用先前與原模型馬頭對齊的結果
    const q = warpH([4.86, -3.9885]);
    scan.rotation.y = -2.2768;
    scan.position.set(q[0], LV.T1, -q[1]);
    scan.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = false; fadeMats.push(m.material); } });
    horseScan = scan; scene.add(scan); applyEra(); dirty = true;
  }, undefined, e => console.warn('銅馬掃描載入失敗', e));
}

/* ---------- 比例尺：10 公尺格線＋1.7 公尺人形 ---------- */
let scaleOn = false; const scaleAids = new THREE.Group(); scaleAids.visible = false;
function buildScaleAids() {
  const grid = new THREE.GridHelper(500, 50, 0x8a6b45, 0x8a6b45);
  grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = groundH + 0.05;
  scaleAids.add(grid);
  const person = () => {
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x2b2a27 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.45, 10), mat); body.position.y = 0.725;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), mat); head.position.y = 1.58;
    g.add(body, head); return g;
  };
  // 放在神門前、第二鳥居旁、拜殿台階前（q 座標＋地坪高）
  [[1.2, -33, LV.T1], [3.2, -55.5, LV.T1], [2.4, -13.5, LV.T2]].forEach(([x, y, h]) => {
    const p = person(); p.position.set(x, h, -y); scaleAids.add(p);
  });
  scene.add(scaleAids);
}
function setScale(on) {
  scaleOn = on; scaleAids.visible = on; $('#scaleBtn').classList.toggle('on', on);
  if (on) toast('格線每格 10 公尺，黑色人形高 1.7 公尺', 3000);
  dirty = true;
}

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
  dirty = true;
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
function worldOf(p) { return new THREE.Vector3(p.pos[0], groundH + 4, -p.pos[1]); }
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
  pinBox.append(cam); pins.push({ el: cam, pos: new THREE.Vector3(...HIST_PHOTO.eye).add(new THREE.Vector3(0, 1.8, 0)) });
  addMePin();
}
function showStopPins(s) {
  pinBox.innerHTML = ''; pins = [];
  (s.pins || []).forEach(([id, label]) => {
    let pos;
    if (id === '@photo') pos = new THREE.Vector3(...HIST_PHOTO.eye).add(new THREE.Vector3(0, 1.8, 0));
    else {
      const b = boxOf(id); if (!b) return;
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
    .concat((p.photos || []).map(s => `<img src="photos/${s}.jpg" alt="老照片：${p.title}">`))
    .concat(p.slides.map(s => `<img src="slides/${s}.jpg" alt="簡報：${p.title}">`)).join('')
    + (p.photos ? '<small class="pcredit">老照片：三森久子捐贈，壢中校史館藏</small>' : '');
  $('#cardBody').innerHTML = `
    <span class="tag" style="background:${KIND_COLOR[p.kind]}">${KIND_TEXT[p.kind]}</span>
    <h2>${p.title}</h2>
    ${dimsOf(p)}
    <div class="tl">
      <div><b>1939 當年</b>${p.past}</div>
      <div><b>之後</b>${p.change}</div>
      <div class="now"><b>今天</b>${p.now}</div>
    </div>
    <div class="row">
      <button id="flyBtn">移到這裡</button>
      ${p.stop ? `<button class="main" id="stopBtn">導覽這一站 ›</button>` : ''}
    </div>
    <div class="imgs">${imgs}</div>
    ${srcList(p.src)}`;
  $('#flyBtn').onclick = () => { closeCard(); const w = worldOf(p); w.y = groundH + 2; flyTo(w.clone().add(new THREE.Vector3(20, 22, 26)), w, baseFov); };
  if (p.stop) $('#stopBtn').onclick = () => { closeCard(); startTour(p.stop - 1); };
  $('#cardBody').querySelectorAll('.imgs img').forEach(im => im.onclick = () => { $('#lightImg').src = im.src; $('#lightbox').classList.add('show'); });
  $('#card').scrollTop = 0;
  $('#card').classList.add('open');
}
// 構件尺寸（公尺）：依老照片、銅馬掃描與參拜道實測推估
const PLACE_OBJ = { torii1: 'B1', torii2: 'B2', lantern: 'D6', office: 'H', gate: 'N', 'horse-old': 'L', 'horse-now': 'L', haiden: 'P', honden: 'Q' };
function boxOf(id) {
  if (id === 'L') return horseScan ? new THREE.Box3().setFromObject(horseScan) : null;
  return shrine?.boxes.get(id) || null;
}
function dimsOf(p) {
  const id = PLACE_OBJ[p.id], b = id && boxOf(id); if (!b) return '';
  const s = b.getSize(new THREE.Vector3());
  const f = v => v < 10 ? v.toFixed(1) : v.toFixed(0);
  // 寬、深以構件自身方向為準（第一鳥居斜放，取較寬的一邊當寬）
  const w = Math.max(s.x, s.z), d = Math.min(s.x, s.z);
  const h = id === 'L' ? s.y : b.max.y;     // 高度自外參道地面起算
  return `<div class="dims">約 寬 ${f(w)} × 深 ${f(d)} × 高 ${f(h)} 公尺<small>${DIMS[id] || ''}</small></div>`;
}
// 出處清單（對應 history.json 的 sources）
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function srcList(ids) {
  if (!ids || !histData) return '';
  const items = ids.map(id => histData.sources.find(s => s.id === id)).filter(Boolean)
    .map(s => `<li>${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</li>`).join('');
  return items ? `<div class="srcs"><b>出處</b><ul>${items}</ul></div>` : '';
}
function openHistory() {
  if (!histData) return;
  const tl = histData.timeline.map(t => `<div class="ev"><time>${esc(t.date)}</time><p>${esc(t.text)}</p>${srcTags(t.src)}</div>`).join('');
  const ppl = histData.people.map(p => `<div class="ev"><time>${esc(p.name)}</time><p><b>${esc(p.role)}</b>　${esc(p.text)}</p>${srcTags(p.src)}</div>`).join('');
  const all = histData.sources.map((s, i) => `<li id="src-${s.id}">${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</li>`).join('');
  $('#cardBody').innerHTML = `<span class="tag" style="background:#8a6b45">史料</span><h2>中壢神社年表</h2>
    <div class="timeline">${tl}</div><h3>相關人物</h3><div class="timeline">${ppl}</div>
    <h3>參考資料</h3><ol class="srcAll">${all}</ol>
    <p class="caveat">年表依現有史料整理，部分日期與說法仍待考證；如有更正請告知。</p>`;
  $('#card').scrollTop = 0;
  $('#card').classList.add('open');
}
function srcTags(ids) {
  if (!ids || !histData) return '';
  return `<div class="stag">${ids.map(id => { const k = histData.sources.findIndex(s => s.id === id); return k < 0 ? '' : `<span>[${k + 1}]</span>`; }).join('')}</div>`;
}
function closeCard() { $('#card').classList.remove('open'); }
$('#cardX').onclick = closeCard;
$('#lightbox').onclick = () => $('#lightbox').classList.remove('show');
renderer.domElement.addEventListener('pointerdown', closeCard);

/* ---------- 視角 ---------- */
const HOME = { eye: [-210, 150, 150], target: [-40, 0, 30] };   // 公尺
function topView() {
  // 從正上方往下看，讓北方朝上（相機稍微偏南，OrbitControls 才轉得動）
  const t = new THREE.Vector3(-40, groundH, 40), n = NORTH_Q;
  flyTo(t.clone().add(new THREE.Vector3(-n[0] * 3, 460, n[1] * 3)), t, baseFov);
}
$('#viewTop').onclick = topView;
$('#histBtn').onclick = () => { closeCard(); openHistory(); };
$('#scaleBtn').onclick = () => setScale(!scaleOn);
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
  window.history.replaceState(null, '', location.pathname);
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
    if (s.photo) {
      // 用反求出的相機軸向（含些微傾斜），而不是單純 lookAt
      const A = HIST_PHOTO.axes;
      if (A) camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...A.x), new THREE.Vector3(...A.y), new THREE.Vector3(...A.z)));
      camera.fov = photoFov(); camera.updateProjectionMatrix();   // 面板高度可能在飛行途中改變，最後再算一次
      dirty = true; $('#fade').value = 0; showPhoto(true); applyFade(); }
  });
  showStopPins(s);
  window.history.replaceState(null, '', '#stop-' + (stopIndex + 1));
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
const meDot = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0x1a73e8 }));
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
    me = llToQ(pos.coords.latitude, pos.coords.longitude);
    meDot.position.set(me[0], groundH + 0.2, -me[1]); meDot.visible = true; dirty = true;
    if (first) { $('#tour').hidden ? showPlacePins() : showStopPins(STOPS[stopIndex]); flyMe(); }
    nearest();
  }, () => { watching = null; toast('無法取得位置（請允許定位）'); }, { enableHighAccuracy: true });
};
function flyMe() {
  const w = new THREE.Vector3(me[0], groundH, -me[1]);
  if (Math.hypot(me[0], me[1]) > 400) toast('你目前不在中壢高中附近');
  flyTo(w.clone().add(new THREE.Vector3(0, 90, 60)), w, baseFov);
}
function nearest() {
  let best = null, bd = 1e9;
  places.forEach(p => { const d = Math.hypot(p.pos[0] - me[0], p.pos[1] - me[1]); if (d < bd) { bd = d; best = p; } });   // 公尺
  if (best && bd < 25 && best.id !== lastNear) { lastNear = best.id; toast(`你正站在：${best.title}`); }
}

/* ---------- 相機飛行與主迴圈 ---------- */
let fly = null, dirty = true;
function flyTo(eye, target, fov, done) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov, p1: eye, t1: target, f1: fov, start: performance.now(), ms: 1300, done };
}
/* ---------- 載入 ---------- */
try {
  const [md, hist] = await Promise.all([fetch('./map-data.json').then(r => r.json()), fetch('./history.json').then(r => r.json()).catch(() => null)]);
  histData = hist;
  shrine = buildShrine();
  scene.add(shrine.group);
  fadeMats.push(...shrine.mats);
  groundH = -0.05;      // 公尺：今日地面（外參道高度）
  ground = createGround(scene, { bounds: { x0: -280, x1: 220, y0: -300, y1: 200 }, height: groundH, qToLL, llToQ, north: NORTH_Q });
  places = md.places.map(p => ({ ...p, pos: p.plan ? warpH(p.plan) : llToQ(p.lat, p.lng) }));
  loadHorseScan();
  buildScaleAids();
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
    dirty = true;
  } else if (controls.enabled && controls.update()) dirty = true;
  if (!dirty) return;                  // 畫面沒變就不重畫：省電、不發燙
  dirty = false;
  renderer.render(scene, camera);
  updatePins();
});

window.__app = { renderer, scene, startTour, endTour, go, setGround, camera, controls, get shrine() { return shrine; }, get ground() { return ground; } };
