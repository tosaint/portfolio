import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadShrine } from './scene-model.js';
import { createGround, GROUND_LAYERS } from './ground.js';

/* =========================================================
   導覽站點設定（文字、視角都在這裡改）
   座標系：x = 平面 X，y = 高度，z = -(平面 Y)，與 buildings.json 相同
   eye = 相機位置，target = 看向哪裡
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
    now: '神馬在壢中遷入後被搬過好幾次，現在立在中央西路的正門。打開古今地圖，可以看到它從哪裡搬到哪裡。',
    eye: [17, 7, 12], target: [4.86, 3.6, 3.99],
    pins: [['L', '神馬（原位置）'], ['N', '樓門']],
    thumb: './assets/models/horse/current.jpg'
  }
];

// 「今」模式下仍保持實心的構件（其餘變半透明）
const STILL_HERE = new Set(['A']);   // 神馬已被搬走，所以「今」模式也變半透明

/* ========================================================= */

const $ = s => document.querySelector(s);
const host = $('#view');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xe9e6dc);
host.append(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9e6dc, 260, 720);
scene.add(new THREE.HemisphereLight(0xfff9eb, 0x7c826e, 2.2));
const sun = new THREE.DirectionalLight(0xfff4dd, 1.8);
sun.position.set(-40, 80, 50);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 3;
controls.maxDistance = 260;

let shrine = null;
let stopIndex = 0;
let era = 'past';
let fly = null;
let baseFov = 45;

/* ---------- 版面：老照片框的位置與 FOV 對位 ---------- */
let viewH = innerHeight;            // 3D 畫面高度 = 螢幕高度 − 底部故事卡
function photoRect() {
  const w = innerWidth, h = w / HIST_PHOTO.aspect;
  const top = Math.max(0, (viewH - h) / 2);
  return { w, h, top };
}
// 讓「螢幕中央那塊 3:2 區域」的視角剛好等於照片的 FOV
function photoFov() {
  const { h } = photoRect();
  const half = THREE.MathUtils.degToRad(HIST_PHOTO.fov / 2);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * viewH / h));
}

function resize() {
  viewH = innerHeight - document.getElementById('sheet').offsetHeight + 16;
  host.style.height = viewH + 'px';
  renderer.setSize(innerWidth, viewH);
  camera.aspect = innerWidth / viewH;
  baseFov = innerWidth < innerHeight ? 55 : 42;
  if (STOPS[stopIndex]?.photo && !fly) camera.fov = photoFov();
  camera.updateProjectionMatrix();
  const { h, top } = photoRect();
  Object.assign($('#shadeTop').style, { top: 0, height: top + 'px' });
  Object.assign($('#shadeBot').style, { top: (top + h) + 'px', height: Math.max(0, viewH - top - h) + 'px' });
  $('#photoLayer').style.top = top + 'px';
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.getElementById('sheet'));
resize();

/* ---------- 老照片在 3D 空間裡的「拍攝位置」標記 ---------- */
const photoMarker = new THREE.Group();
{
  const eye = new THREE.Vector3(...HIST_PHOTO.eye), tgt = new THREE.Vector3(...HIST_PHOTO.target);
  const tex = new THREE.TextureLoader().load(HIST_PHOTO.src);
  tex.colorSpace = THREE.SRGBColorSpace;
  // 照片「浮」在拍攝點前方，像一張相片立在空中
  const dist = 7, hgt = 2 * dist * Math.tan(THREE.MathUtils.degToRad(HIST_PHOTO.fov / 2)), wid = hgt * HIST_PHOTO.aspect;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
  const dir = tgt.clone().sub(eye).normalize();
  card.position.copy(eye).addScaledVector(dir, dist);
  card.lookAt(eye);
  photoMarker.add(card);
  // 視錐線：從拍攝點連到照片四角，再延伸到被拍的建築
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
    card.localToWorld(new THREE.Vector3(a * wid / 2, b * hgt / 2, 0)));
  const pts = [];
  corners.forEach(c => pts.push(eye, c));
  corners.forEach(c => pts.push(c, eye.clone().add(c.clone().sub(eye).multiplyScalar(4))));
  photoMarker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xb23a2a, transparent: true, opacity: 0.55 })));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb23a2a }));
  dot.position.copy(eye);
  photoMarker.add(dot);
  card.updateMatrixWorld();
  scene.add(photoMarker);
}

/* ---------- 載入神社模型（沿用原專案 scene-model.js） ---------- */
try {
  const config = await (await fetch('./buildings.json')).json();
  shrine = await loadShrine(config);
  scene.add(shrine.integrated);
  prepareGhost();
  setupGround();     // 不等待：航照慢慢載入，不擋住畫面
  $('#loading').style.opacity = 0;
  setTimeout(() => $('#loading').remove(), 500);
} catch (e) {
  console.error(e);
  $('#loadMsg').textContent = '模型載入失敗，請用 http(s) 開啟';
}

/* ---------- 古／今切換：消失的建築變成半透明 ---------- */
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9a8f78, transparent: true, opacity: 0.12, depthWrite: false });
const ghostEdge = new THREE.LineBasicMaterial({ color: 0x6d6555, transparent: true, opacity: 0.25 });
function prepareGhost() {
  shrine.objects.forEach((o, id) => {
    if (STILL_HERE.has(id)) return;
    o.root.traverse(m => {
      if (!m.isMesh) return;
      m.userData.pastMat = m.material;
    });
  });
}
function setEra(next) {
  era = next;
  $('#eraPast').classList.toggle('on', era === 'past');
  $('#eraNow').classList.toggle('on', era === 'now');
  if (!shrine) return;
  shrine.objects.forEach((o, id) => {
    if (STILL_HERE.has(id)) return;
    o.root.traverse(m => {
      if (!m.isMesh || !m.userData.pastMat) return;
      m.material = era === 'now' ? ghostMat : m.userData.pastMat;
      m.castShadow = era !== 'now';
    });
  });
  renderStopText();
}
$('#eraPast').onclick = () => setEra('past');
$('#eraNow').onclick = () => setEra('now');

/* ---------- 站點切換 ---------- */
const dots = $('#dots');
STOPS.forEach((_, i) => { const d = document.createElement('i'); d.onclick = () => go(i); dots.append(d); });

function renderStopText() {
  const s = STOPS[stopIndex];
  $('#stopText').textContent = era === 'now' && s.now ? s.now : s.text;
}

function go(i) {
  stopIndex = Math.max(0, Math.min(STOPS.length - 1, i));
  const s = STOPS[stopIndex];
  [...dots.children].forEach((d, k) => d.classList.toggle('on', k === stopIndex));
  $('#stopNo').textContent = `第 ${stopIndex + 1} 站 / 共 ${STOPS.length} 站`;
  $('#stopTitle').textContent = s.title;
  renderStopText();
  $('#prev').disabled = stopIndex === 0;
  $('#prev').style.opacity = stopIndex === 0 ? .4 : 1;
  $('#next').textContent = stopIndex === STOPS.length - 1 ? '回到起點' : '下一站';

  $('#slider').classList.toggle('show', !!s.photo);
  $('#thumb').classList.toggle('show', !!s.thumb);
  if (s.thumb) $('#thumbImg').src = s.thumb;

  // 進照片站：先不顯示照片，相機飛到位後照片再浮現
  showPhoto(false);
  photoMarker.visible = !s.photo;
  controls.enabled = !s.photo;
  flyTo(new THREE.Vector3(...s.eye), new THREE.Vector3(...s.target), s.photo ? photoFov() : baseFov, () => {
    if (s.photo) { $('#fade').value = 0; showPhoto(true); applyFade(); }
  });
  buildPins(s);
}
$('#prev').onclick = () => go(stopIndex - 1);
$('#next').onclick = () => go(stopIndex === STOPS.length - 1 ? 0 : stopIndex + 1);

function showPhoto(on) {
  ['#photoLayer', '#shadeTop', '#shadeBot'].forEach(q => $(q).classList.toggle('show', on));
}
function applyFade() {
  $('#photoImg').style.opacity = 1 - $('#fade').value / 100;
}
$('#fade').oninput = applyFade;

$('#thumb').onclick = () => { $('#lightImg').src = $('#thumbImg').src; $('#lightbox').classList.add('show'); };
$('#lightbox').onclick = () => $('#lightbox').classList.remove('show');

// 在照片站拖曳畫面 → 也能直接調整疊合（不必只靠滑桿）
let dragX = null;
host.addEventListener('pointerdown', e => { if (STOPS[stopIndex].photo) dragX = e.clientX; });
addEventListener('pointerup', () => dragX = null);
host.addEventListener('pointermove', e => {
  if (dragX === null) return;
  const v = Math.max(0, Math.min(100, Number($('#fade').value) + (e.clientX - dragX) / innerWidth * 150));
  $('#fade').value = v; dragX = e.clientX; applyFade();
});

/* ---------- 相機飛行 ---------- */
function flyTo(eye, target, fov, done) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov,
          p1: eye, t1: target, f1: fov, start: performance.now(), ms: 1400, done };
}

/* ---------- 標籤 ---------- */
const pinBox = $('#pins');
let pins = [];
function buildPins(s) {
  pinBox.innerHTML = '';
  pins = [];
  (s.pins || []).forEach(([id, label]) => {
    let pos;
    if (id === '@photo') pos = new THREE.Vector3(...HIST_PHOTO.eye).add(new THREE.Vector3(0, 1.5, 0));
    else {
      const o = shrine?.objects.get(id);
      if (!o) return;
      const b = new THREE.Box3().setFromObject(o.root);
      pos = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.3, (b.min.z + b.max.z) / 2);
    }
    const el = document.createElement('div');
    el.className = 'pin' + (id === '@photo' ? ' cam' : '');
    el.textContent = label;
    if (id === '@photo') el.onclick = () => go(STOPS.findIndex(x => x.photo));
    pinBox.append(el);
    pins.push({ el, pos });
  });
}
const tmp = new THREE.Vector3();
function updatePins() {
  pins.forEach(({ el, pos }) => {
    tmp.copy(pos).project(camera);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && !fly;
    el.style.display = vis ? '' : 'none';
    if (vis) { el.style.left = (tmp.x + 1) / 2 * innerWidth + 'px'; el.style.top = (1 - tmp.y) / 2 * viewH + 'px'; }
  });
}

/* ---------- 主迴圈 ---------- */
camera.position.set(-60, 160, 180);
controls.target.set(-5, 0, -5);
// 從地圖點進來時，網址會帶 #stop-3 之類的站號
const hashStop = Number((location.hash.match(/stop-(\d)/) || [])[1]);
go(hashStop ? hashStop - 1 : 0);

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

/* ---------- 今日航照地面 ---------- */
let ground = null;
const GROUND_ORDER = ['photo', 'emap', 'off'];
let groundIdx = 0;
async function setupGround() {
  try {
    const md = await (await fetch('./map-data.json')).json();
    // 地面高度：放在參道（C）底面下方一點
    const path = shrine.objects.get('C');
    let top = path ? new THREE.Box3().setFromObject(path.root).min.y - 0.03 : 1.5;
    if (!isFinite(top)) top = 1.5;
    ground = await createGround(scene, md.control, {
      bounds: { x0: -190, x1: 140, y0: -140, y1: 130 }, height: top + 0.02, zoom: 18, layer: 'photo'
    });
    if (ground.ok) {
      $('#groundBtn').hidden = false;
    } else ground.mesh.visible = false;                      // 圖磚載不到就維持原樣
    window.__tour.ground = ground;
  } catch (e) { console.warn('航照地面載入失敗', e); }
}
$('#groundBtn').onclick = async () => {
  groundIdx = (groundIdx + 1) % GROUND_ORDER.length;
  const id = GROUND_ORDER[groundIdx];
  $('#groundBtn').textContent = '地面：' + (id === 'off' ? '關' : GROUND_LAYERS[id].label);
  await ground.setLayer(id);
};

window.__tour = { go, setEra, camera, controls, photoMarker, get shrine() { return shrine; } };
