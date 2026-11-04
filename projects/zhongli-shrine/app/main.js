import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildShrine, LV, DIMS, GATE_Y, KOMA_POS, KOMA_PED, HORSE, setOnAsset, treeOK, approachPts } from './shrine-proc.js?v=20261104t';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LANTERN_API } from './lantern-config.js?v=1';
// 掃描檔已用 meshopt 壓縮、只留顏色貼圖；材質改成 Lambert，手機算得比較輕
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// 掃描物不用照片貼圖（顏色偏暗、與周圍風格不一），改成與建築一致的單色材質，只保留造形
const flat = color => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
// 壓縮後的掃描檔沒有法線（normal），不補算的話很多手機／顯示卡會畫成全黑
const fixNormals = m => { if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); };
const BRONZE = 0x6f5a3c, GRANITE = 0xd3cfc4;   // 銅馬（咖啡金黃的古銅，與白木、檜皮同一暖色系）、狛犬（花崗岩）
import { createGround, GROUND_LAYERS } from './ground.js';
import { S_IN, LEVEL, warpH, warpY, modelToWorld, qToLL, llToQ, NORTH_Q } from './site.js';

/* =========================================================
   中壢神社 古今對照：3D 神社立在今日航照上
   座標系：x = 平面 X，y = 高度，z = -(平面 Y)，與 buildings.json 相同
   導覽站點的文字與視角在 STOPS；地點卡片與校準點在 map-data.json
   ========================================================= */
const HIST_PHOTO = {                 // 神門照片的拍攝視角（2026-11-03 以照片程式模型重新反求，公尺）
  src: './assets/photo-study/historical.jpg',
  eye: [20.972, 5.836, 54.194 - 13.2], target: [10.646, 4.548, 37.114 - 13.2], fov: 24.6, aspect: 1.5,   // 內苑依 1947 航照前移 13.2 公尺，相機一起移
  axes: {"x": [0.8558, -0.00099, -0.5173], "y": [-0.03247, 0.99792, -0.05561], "z": [0.51628, 0.06439, 0.854]},
};

// 拜殿正面照（自神門往拜殿，鎮座祭）：以參拜道 3.01 公尺為比例尺，相機與拜殿尺寸聯合反求（22 點、誤差約 5 像素）。
// 反求的拍攝位置在模型神門前約 13 公尺：照片中看不到神門，故此站把 17 公尺內的物件裁掉（near），
// 神門實際位置與這張照片的關係待查。
const HAIDEN_PHOTO = {
  src: './assets/photo-study/haiden-front.jpg', aspect: 1.7938, near: 17,
  eye: [-0.2316, 2.5923, 28.136], target: [-0.2973, 3.1092, 8.1428], fov: 18.72,
  axes: {"x": [1.0, -0.002, -0.0033], "y": [0.0021, 0.9997, 0.0258], "z": [0.0033, -0.0258, 0.9997]},
};

// 六站導覽：照走進神社的順序。有反求相機的站（photo）可拖滑桿與老照片疊合；
// 其他站以接近照片的角度、人眼高度觀看，老照片以縮圖呈現（點開放大）。座標為公尺世界座標。
const CR = '三森久子捐贈，壢中校史館藏';
const STOPS = [
  {
    title: '第一鳥居：從中正路進來',
    text: '參拜道從中正路的第一鳥居進入。鳥居是鋼筋水泥造、外覆洗石子，兩旁各立一座石燈籠。照片是 1950 年代它當中壢中學校門時拍的，柱上已掛上校名與標語。',
    now: '1965 年正門遷到中央西路，這座鳥居改稱南大門，約 1988–89 年拆除。位置在今天中正路 740 巷口。',
    eye: [-216, 1.6, 22.5], target: [-182, 4.5, 18.8],
    pins: [['B1', '第一鳥居'], ['D3', '石燈籠'], ['D4', '石燈籠']],
    thumbs: [['photos/torii1-school.jpg', '當校門時的第一鳥居（藍清水校長提供：劉金鐘家族、吳慕舉校長相片）']]
  },
  {
    title: '第二鳥居：鎮座祭行列',
    text: '1939 年 10 月 15 日鎮座祭，祭典行列穿過木造的第二鳥居走向拜殿。當年報紙特別提到中壢神社「沒有燈籠」（除了必要的之外），石燈籠只有三對。',
    now: '第二鳥居大約在今天莊敬樓川堂附近，興建老樓時拆除。',
    eye: [1.5, 1.7, 96], target: [0, 4.5, 40], fov: 58,   // 退後、廣角：鳥居、兩側燈籠與長旗一起入鏡
    pins: [['B2', '第二鳥居'], ['P', '拜殿']],
    thumbs: [['photos/torii2-festival.jpg', '鎮座祭行列穿過第二鳥居（' + CR + '）'], ['photos/torii2-side.jpg', '第二鳥居側面']]
  },
  {
    title: '石燈籠與社務所',
    text: '第二鳥居前的花崗岩石燈籠，火袋上刻著桐紋。後方是社號標與社務所，首任社掌三森淳男與夫人三森久子就住在這裡。',
    now: '社務所戰後當過童軍團部、校史室，1980 年拆除改建自強館。木鳥居右前的一座石燈籠，今天仍在老樓轉角。',
    eye: [-15, 1.6, 84], target: [12, 2.8, 58],
    pins: [['D5', '石燈籠'], ['G', '社號標'], ['H', '社務所']],
    thumbs: [['photos/lantern-torii2.jpg', '石燈籠，背景為社務所（' + CR + '）']]
  },
  {
    title: '拜殿：「臺灣唯一」的檜皮葺',
    text: '鎮座祭當天的拜殿：石板參拜道直通石階，兩旁搭起帳篷、坐滿來賓，簷下掛著神紋幕與「中壢神社」燈籠。《臺灣日日新報》稱它的檜皮葺屋頂是「臺灣唯一」。點下方照片可放大，和 3D 對照。',
    now: '這裡就是今天的陶然亭一帶。拜殿基座上曾蓋校舍，1991 年興建陶然亭時遺構全部拆除。',
    eye: [0, 1.9, 14.4], target: [0, 5.2, -6],    // 進神門後望拜殿（照片放在縮圖）
    thumbs: [['assets/photo-study/haiden-front.jpg', '鎮座祭當天的拜殿正面（' + CR + '）'], ['photos/haiden-priests.jpg', '鎮座祭神職合影（' + CR + '）'], ['photos/haiden-in-guests.jpg', '拜殿內：來賓列座，四周掛御簾、垂釣燈籠'], ['photos/haiden-in-miko.jpg', '拜殿內：神職與巫女'], ['photos/haiden-wedding.jpg', '拜殿前婚禮合影：板扉開啟、兩側格子戸、中央鈴緒']]
  },
  {
    title: '本殿：最深處',
    text: '從拜殿內往裡看：頭上是「中壢神社」扁額與織紋的水引幕，穿過幣殿，盡頭是本殿的木階與白色御帳，祭主正在階前奉仕。本殿是流造，供奉豐受大神與北白川宮能久親王。',
    now: '本殿基座上後來蓋了困學亭（壢中亭），1991 年改建陶然亭時拆除。',
    eye: [0.3, 3.4, -4.2], target: [0, 3.5, -19.8],    // 拜殿內、站在御簾後，朝本殿看（拜殿內部照片）
    pins: [['Q', '本殿']],
    thumbs: [['photos/haiden-in-honden.jpg', '自拜殿內望本殿：扁額「中壢神社」、水引幕、幣殿與本殿木階（' + CR + '）'], ['photos/honden.jpg', '本殿側面（' + CR + '）']]
  },
  {
    title: '神門、狛犬與銅馬',
    text: '你站在當年攝影師的位置附近：神門前一對狛犬，門左側是銅馬。比對照片發現，鎮座祭當天的照片都看不到這座神門，它很可能是之後才增建的。',
    now: '狛犬 1950 年移到中壢後火車站附近的義民廟（忠義祠），至今仍在；銅馬搬過好幾次，現在立在中央西路正門。虛線是它從原位置到今天正門的距離。',
    eye: [13.5, 1.8, 31], target: [-2, 3.2, 15],   // 接近神門照的拍攝角度，稍退稍廣
    thumbs: [['assets/photo-study/historical.jpg', '神門、狛犬與銅馬（' + CR + '）'], ['photos/horse-komainu-gate.jpg', '銅馬、狛犬與神門'], ['photos/gate-postwar.jpg', '神門前合影（1940 年代）'], ['assets/models/horse/current.jpg', '今天的銅馬（中央西路正門）']]
  }
];

// 以上座標都是原配置模型的單位；轉成公尺世界座標（見 site.js）
STOPS.forEach(s => { if (s.photo) { s.eye = s.photo.eye; s.target = s.photo.target; } });
// 拍攝點清單在場景建好後建立（見 buildSpots）
// 「今」模式下仍保持實心的構件（其餘變半透明）
const KIND_COLOR = { gone: '#b23a2a', moved: '#c48a1c', remain: '#2f6f4f' };
const KIND_TEXT = { gone: '已消失', moved: '被搬走', remain: '還找得到' };
const GROUND_ORDER = ['photo', 'aer1947', 'am50k', 'jm25k', 'emap'];

const $ = s => document.querySelector(s);
const host = $('#view');
const toast = (t, ms = 2600) => { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', ms); };

/* ---------- 場景 ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
// 解析度：大螢幕（桌機）畫素多，上限放低；之後依實際畫格時間自動再調（見主迴圈）
let maxDPR = Math.min(devicePixelRatio, innerWidth > 900 ? 1.25 : 1.5);
renderer.setPixelRatio(maxDPR);
renderer.setClearColor(0xeef0ec);
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // 色彩對比更自然鮮明
renderer.toneMappingExposure = 1.15;
// 陰影：場景是靜態的，只在載入後算一次，之後不再更新，幾乎不增加每格的負擔
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.localClippingEnabled = true;   // 銅馬掃描：切掉今日的台座
host.append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xeef0ec, 450, 1300);
const hemi = new THREE.HemisphereLight(0xf4f7ff, 0x8a7d62, 1.3);   // 天光微冷、地面反光微暖
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe9c8, 2.9);             // 午後斜陽
sun.position.set(-55, 70, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(innerWidth > 900 ? 2048 : 1024, innerWidth > 900 ? 2048 : 1024);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
sun.target.position.set(0, 0, 25); scene.add(sun.target);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 3000);   // near 0.5：遠看時深度較精準
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.zoomToCursor = true;          // 滾輪／雙指往游標處縮放，才能拉近到各棟建築旁
controls.screenSpacePanning = false;   // 平移沿地面
controls.zoomSpeed = 1.2;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 2;
controls.maxDistance = 650;
controls.addEventListener('change', () => { dirty = true; });

/* ---------- 版面：3D 高度 = 螢幕 − 目前的底部面板 ---------- */
let viewH = innerHeight, baseFov = 50;
const bottomSheet = () => $('#tour').hidden ? $('#explore') : $('#tour');
let curPhoto = HIST_PHOTO;
function photoRect() { const w = innerWidth, h = w / curPhoto.aspect; return { w, h, top: Math.max(0, (viewH - h) / 2) }; }
function photoFov() {
  const half = THREE.MathUtils.degToRad(curPhoto.fov / 2);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * viewH / photoRect().h));
}
function resize() {
  const wide = innerWidth >= 900;      // 桌機面板浮在畫面上，不壓縮 3D 高度
  viewH = wide ? innerHeight : innerHeight - bottomSheet().offsetHeight + 16;
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
  $('#credit').style.bottom = (wide ? 6 : innerHeight - viewH + 4) + 'px';
}
addEventListener('resize', resize);
const ro = new ResizeObserver(resize);
ro.observe($('#explore')); ro.observe($('#tour'));

/* ---------- 老照片拍攝點（預設關閉，按「📷 拍攝點」開啟）---------- */
// 精確反求的照片：紅色視錐＋小照片（拉近到約 40 公尺內才淡入）；推估位置的照片：只有相機圖示與方向箭頭
const photoMarker = new THREE.Group();   // 所有拍攝點的 3D 物件
photoMarker.visible = false;
const spotCards = [];                    // 需依距離淡入的照片
const SPOTS = [], lazySpotTex = [];                        // { label, eye, stop, precise }
function addPreciseSpot(P, small, label, stop) {
  const eye = new THREE.Vector3(...P.eye), tgt = new THREE.Vector3(...P.target);
  const tex = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace;   // 拍攝點打開時才下載照片（見 setSpots）
  lazySpotTex.push([tex, small]);
  const dist = 6, hgt = 2 * dist * Math.tan(THREE.MathUtils.degToRad(P.fov / 2)), wid = hgt * P.aspect;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), mat);
  card.position.copy(eye).addScaledVector(tgt.clone().sub(eye).normalize(), dist);
  card.lookAt(eye); card.updateMatrixWorld();
  photoMarker.add(card); spotCards.push(card);
  const pts = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => card.localToWorld(new THREE.Vector3(a * wid / 2, b * hgt / 2, 0))).forEach((c, i, C) => pts.push(eye, c, c, C[(i + 1) % 4]));
  photoMarker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xb23a2a, transparent: true })));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb23a2a }));
  dot.position.copy(eye); photoMarker.add(dot);
  SPOTS.push({ label, eye: eye.toArray(), stop, precise: true });
}
function addApproxSpot(eye, target, label, stop) {
  const e = new THREE.Vector3(...eye), d = new THREE.Vector3(...target).sub(e); d.y = 0; d.setLength(4);
  const tip = e.clone().add(d), side = new THREE.Vector3(-d.z, 0, d.x).setLength(0.9), back = d.clone().setLength(1.3);
  const pts = [e, tip, tip, tip.clone().sub(back).add(side), tip, tip.clone().sub(back).sub(side)];
  photoMarker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a6b45, transparent: true })));
  SPOTS.push({ label, eye, stop, precise: false });
}
scene.add(photoMarker);
let spotsOn = false;
function setSpots(on) {
  spotsOn = on; photoMarker.visible = on && !inPhoto;
  if (on) lazySpotTex.splice(0).forEach(([t, src]) => new THREE.ImageLoader().load(src, im => { t.image = im; t.needsUpdate = true; dirty = true; }));
  const b = document.querySelector('#spotBtn'); if (b) b.classList.toggle('on', on);
  if (!$('#tour').hidden) return;
  showPlacePins(); dirty = true;
  if (on) toast('紅色：可與 3D 疊合的照片；褐色箭頭：推估的拍攝方向。點相機進入導覽', 3600);
}
function fadeSpotCards() {           // 拉近才顯示照片
  if (!photoMarker.visible) return;
  spotCards.forEach(c => { const d = camera.position.distanceTo(c.position); c.material.opacity = THREE.MathUtils.clamp((45 - d) / 20, 0, 1) * (1 - 0.9 * eraT); });
}

let edgeMat = null, shadowPlane = null;
/* ---------- 黑松：大小錯落，實例化繪製（樹幹一次、兩種樹冠各一次） ---------- */
function buildPines() {
  let r = 20261104; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  // 單位樹：樹幹 0→0.62（微彎由實例傾斜表現），樹冠為數層扁平雲團（黑松的層狀輪廓）
  const trunk = new THREE.CylinderGeometry(0.016, 0.03, 0.66, 5, 1, true); trunk.translate(0, 0.33, 0);
  const crown = variant => {
    const parts = [];
    const tiers = variant ? [[0.5, 0.28, 0.1, 0.05], [0.66, 0.22, -0.08, 0.02], [0.8, 0.17, 0.06, -0.04], [0.93, 0.11, 0, 0]]
                          : [[0.58, 0.24, -0.12, 0.04], [0.74, 0.2, 0.1, -0.05], [0.9, 0.13, -0.02, 0.03]];
    tiers.forEach(([y, w, dx, dz]) => { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(w, w * 0.38, w * 0.85); g.translate(dx, y, dz); parts.push(g.toNonIndexed()); });
    return mergeGeometries(parts);
  };
  const crowns = [crown(0), crown(1)];
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5b4a3b }), leafMat = new THREE.MeshLambertMaterial({ color: 0x34492f, flatShading: true });
  const trees = [];
  const add = (x, y, h) => { if (treeOK(x, y)) trees.push([x, y, h]); };
  // 外參道：兩側各一排高聳黑松（每 8–12 公尺一棵），越接近第二鳥居越稀，避免擋住視線
  const P = approachPts(), seg = [0]; for (let i = 1; i < P.length; i++) seg.push(seg[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const Ltot = seg[seg.length - 1];
  for (const sd of [-1, 1]) for (let d = 6 + rnd() * 4; d < Ltot; d += 8 + rnd() * 4) {
    const f = d / Ltot; if (f > 0.55 && rnd() < (f - 0.55) / 0.33) continue;
    let i = seg.findIndex(v => v >= d); i = Math.max(1, i);
    const [ax, ay] = P[i - 1], [bx, by] = P[i], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l, ny = (bx - ax) / l, o = 8 + rnd() * 2.2;
    add(ax + nx * o * sd, ay + ny * o * sd, 10 + rnd() * 4);
  }
  // 拜殿、本殿周圍：背面最密、兩側稍疏；靠近玉垣多小松、外圍高松
  const ring = (x0, x1, y0, y1, n) => { for (let k = 0; k < n; k++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), dist = Math.min(Math.abs(Math.abs(x) - 16), Math.abs(y - 30));
    add(x, y, dist < 5 && rnd() < 0.5 ? 2.5 + rnd() * 2.5 : 8 + rnd() * 6);
  } };
  ring(-34, 34, 31.5, 50, 70);          // 本殿背面
  ring(-32, -17.5, -12, 31, 26);        // 西側
  ring(17.5, 32, 2, 31, 20);           // 東側
  // 零星點綴：社務所背後、腰身兩側近神門、鳥居前廣場角落
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
      m4.compose(new THREE.Vector3(x, groundH, -y), q4, new THREE.Vector3(sxz, h, sxz));
      im.setMatrixAt(k, m4); trunkIM.setMatrixAt(n++, m4);
    });
    im.castShadow = true; scene.add(im);
  });
  trunkIM.castShadow = true; scene.add(trunkIM);
  fadeMats.push(trunkMat, leafMat); applyEra(); renderer.shadowMap.needsUpdate = true; dirty = true; later(warmNight);
}
function buildEdges() {   // 細輪廓線：讓屋簷、柱列、格子的層次更清楚（一次繪製）；首畫之後才算，不拖慢載入
    const edges = [];
    shrine.group.children.forEach(m => { if (!/gravel|path/.test(m.name)) edges.push(new THREE.EdgesGeometry(m.geometry, 28)); });
    const n = edges.reduce((s, g) => s + g.attributes.position.array.length, 0), pos = new Float32Array(n);
    let o = 0; edges.forEach(g => { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; g.dispose(); });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lm = new THREE.LineBasicMaterial({ color: 0x2b2118, transparent: true, opacity: 0.4 });
    scene.add(new THREE.LineSegments(lg, lm)); edgeMat = lm; applyEra(); dirty = true;
}

function buildSpots() {
  addPreciseSpot(HIST_PHOTO, './assets/photo-study/historical-s.jpg', '神門照', 5);
  addPreciseSpot(HAIDEN_PHOTO, './assets/photo-study/haiden-front-s.jpg', '拜殿正面照', 3);
  [[0, '南大門'], [1, '鎮座祭行列'], [2, '石燈籠'], [4, '拜殿內望本殿']].forEach(([i, l]) => addApproxSpot(STOPS[i].eye, STOPS[i].target, l, i));
  // 第 5 站已改為拜殿內望本殿
  addApproxSpot([-15, 1.6, 84], [2, 3, 55], '第二鳥居側面', 1);
  addApproxSpot([-6.4, 1.6, 28.5], [-5.2, 2.2, 17.2], '銅馬合影', 5);
}
let shrine, ground, overlay, places = [], groundH = 0, histData = null, horseScan = null;

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
  if (edgeMat) edgeMat.opacity = 0.4 * op;
  if (shadowPlane) shadowPlane.material.opacity = 0.34 * Math.max(0, 1 - eraT * 1.6);
  overlay && overlay.setOpacity(overlayOn ? 1 - 0.9 * eraT : 0);
  if (!$('#tour').hidden) renderStopText();
}
$('#era').oninput = applyEra;

/* ---------- 銅馬掃描（真實尺寸）---------- */
// 2026 年的 3D 掃描，依現場實測（台座 102×249 公分、連台座自路面高 310 公分）校正成公尺。
// 台座是今天的樣式，1939 年的台座形式不同。
function loadHorseScan() {
  gltf.load('./assets/horse-scan-2.glb', g => {
    const scan = g.scene;
    // 銅馬老照片：馬身與玉垣平行、馬頭朝神門（中軸），站在神門左前方的玉垣外
    // 銅馬合影照（昭和14年）：馬在神門左側、背靠玉垣，馬頭朝神門與狛犬。
    // 掃描檔含今日台座（馬蹄在掃描高度約 1.0 公尺處），切掉台座、放到程式建的 1939 年方形石座上
    const HOOF = 1.0, base = LV.T1 + HORSE.ped;
    scan.rotation.y = -Math.PI / 2;      // 掃描檔馬頭朝 -z → 轉成朝 +x（神門方向）
    scan.position.set(HORSE.q[0], base - HOOF, -HORSE.q[1]);
    const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(base - 0.03))];
    scan.traverse(m => { if (m.isMesh) { fixNormals(m); m.material = flat(BRONZE); m.material.clippingPlanes = clip; m.castShadow = true; fadeMats.push(m.material); } });
    horseScan = scan; scene.add(scan); applyEra(); renderer.shadowMap.needsUpdate = true; dirty = true; later(warmNight);
  }, undefined, e => console.warn('銅馬掃描載入失敗', e));
}

/* ---------- 狛犬掃描 ---------- */
// 現存於中壢忠義祠的狛犬（台座刻「昭和十四年十月」）3D 掃描，裁切、減面後約 0.3 MB。
// 掃描只有一尊，另一尊以鏡像代替（原為阿吽一對，造形不同）。
function loadKomainu() {
  gltf.load('./assets/komainu-scan-2.glb', g => {
    g.scene.traverse(m => { if (m.isMesh) { fixNormals(m); m.material = flat(GRANITE); m.castShadow = true; fadeMats.push(m.material); } });
    KOMA_POS.forEach(([x, y], i) => {
      const k = i ? g.scene : g.scene.clone();
      k.position.set(x, LV.T1 + KOMA_PED, -y);
      if (!i) k.scale.x = -1;                 // 左側鏡像
      k.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;   // 神門與狛犬照片：兩尊面向參道、隔著參道相對而視
      scene.add(k);
    });
    applyEra(); renderer.shadowMap.needsUpdate = true; dirty = true; later(warmNight);
  }, undefined, e => console.warn('狛犬掃描載入失敗', e));
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
  [[1.2, GATE_Y - 5, LV.T1], [3.2, -62.5, LV.T1], [2.4, -0.3, LV.T2]].forEach(([x, y, h]) => {
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
// 底圖分兩層：下層永遠是今天（航照或電子地圖），上層疊舊地圖。
// 「古 ↔ 今」滑桿同時淡出神社模型與舊地圖：拉到「古」看到舊圖，拉到「今」露出今日航照。
const OLD = new Set(['aer1947', 'am50k', 'jm25k']);
let groundId = 'photo', baseId = 'photo', overlayOn = false;
function buildChips() {
  GROUND_ORDER.forEach(id => {
    const b = document.createElement('button');
    b.dataset.id = id;
    b.textContent = GROUND_LAYERS[id].label;
    b.onclick = () => setGround(id);
    $('#groundChips').append(b);
  });
}
const CREDIT = {
  aer1947: '1947.09.05 舊航照（47M7045／022）· 中研院 GIS 中心提供',
  am50k: '中央研究院 臺灣百年歷史地圖', jm25k: '中央研究院 臺灣百年歷史地圖',
};
async function setGround(id) {
  groundId = id;
  [...$('#groundChips').children].forEach(b => b.classList.toggle('on', b.dataset.id === id));
  const isOld = OLD.has(id), want = isOld ? 'photo' : id;
  if (want !== baseId || !ground.mesh.visible) { baseId = want; ground.setLayer(want).then(() => { dirty = true; }); }
  let ok = true;
  if (isOld) { ok = await overlay.setLayer(id); overlayOn = ok; }
  else { overlay.clear(); overlayOn = false; }
  if (groundId !== id) return;
  if (!ok) { $(`#groundChips [data-id="${id}"]`).classList.add('fail'); toast('這個底圖目前載不到'); }
  applyEra();
  if (isOld && ok && eraT < 0.05) toast('拖曳「古 ↔ 今」滑桿，舊圖會淡出、露出今日航照', 3200);
  $('#credit').textContent = (isOld ? CREDIT[id] + '／' : '') + '© 內政部國土測繪中心';
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
  if (spotsOn) SPOTS.forEach(sp => {
    const cam = document.createElement('div');
    cam.className = 'pin cam' + (sp.precise ? '' : ' approx'); cam.innerHTML = `<span>📷 ${sp.label}</span>`;
    cam.onclick = e => { e.stopPropagation(); startTour(sp.stop); };
    pinBox.append(cam); pins.push({ el: cam, pos: new THREE.Vector3(...sp.eye).add(new THREE.Vector3(0, 1.2, 0)) });
  });
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
    // 用 transform 移動標籤（只需合成、不觸發版面重排），比改 left/top 省很多
    if (vis) el.style.transform = `translate3d(${((tmp.x + 1) / 2 * innerWidth).toFixed(1)}px,${((1 - tmp.y) / 2 * viewH).toFixed(1)}px,0) translate(-50%,-100%)`;
  });
}

/* ---------- 地點卡片 ---------- */
function openCard(p) {
  const imgs = (p.photo ? [`<img src="${p.photo}" alt="今日照片">`] : [])
    .concat((p.photos || []).map(s => `<img src="photos/${s}.jpg" alt="老照片：${p.title}">`))
    .concat(p.slides.map(s => `<img src="slides/${s}.jpg" alt="簡報：${p.title}">`)).join('')
    + (p.photos ? `<small class="pcredit">${p.id === 'torii1' ? '照片：藍清水校長提供（劉金鐘家族、吳慕舉校長相片）' : '老照片：三森久子捐贈，壢中校史館藏（部分翻拍自校內展示）'}</small>` : '');
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
const PLACE_OBJ = { temizuya: 'W', komainu: 'K', shago: 'G', gebafuda: 'F', kejiba: 'E', torii1: 'B1', torii2: 'B2', lantern: 'D6', office: 'H', gate: 'N', 'horse-old': 'L', 'horse-now': 'L', haiden: 'P', honden: 'Q' };
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
// 移到各建築旁：以建築外框為準，從斜前方、約人眼到二樓高度看過去
const VIEWS = [
  ['B1', '第一鳥居', [-0.2, 0.25, 1]], ['B2', '第二鳥居', [0.35, 0.25, 1]], ['N', '神門', [0.5, 0.3, 1]],
  ['P', '拜殿', [0.25, 0.25, 1]], ['Q', '本殿', [-1, 0.35, 0.25]], ['H', '社務所', [-1, 0.3, 0.6]], ['L', '神馬', [0.8, 0.3, 0.6]],
];
function flyToObj(id, dir) {
  const b = boxOf(id); if (!b) return;
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const d = Math.max(s.x, s.y, s.z) * 1.5 + 5, v = new THREE.Vector3(...dir).normalize();
  c.y = Math.min(c.y, b.min.y + s.y * 0.45);
  flyTo(c.clone().addScaledVector(v, d), c, baseFov);
}
function buildViewChips() {
  const box = $('#viewChips');
  const sb = document.createElement('button'); sb.id = 'spotBtn'; sb.textContent = '📷 拍攝點'; sb.onclick = () => setSpots(!spotsOn); box.append(sb);
  const top = document.createElement('button'); top.textContent = '全景'; top.onclick = () => flyTo(new THREE.Vector3(...HOME.eye), new THREE.Vector3(...HOME.target), baseFov); box.append(top);
  { const b = document.createElement('button'); b.textContent = '拜殿內部'; b.onclick = () => { closeCard(); flyTo(new THREE.Vector3(0.3, 3.4, -4.2), new THREE.Vector3(0, 3.5, -19.8), baseFov); }; box.append(b); }
  VIEWS.forEach(([id, label, dir]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { closeCard(); flyToObj(id, dir); }; box.append(b); });
}
// 雙擊（或雙點）畫面上的地點：飛過去，以該點為旋轉中心
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('dblclick', e => {
  if (inPhoto) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
  const hit = ray.intersectObjects(scene.children, true).find(h => h.object.visible && h.object.type === 'Mesh');
  if (!hit) return;
  const p = hit.point, off = camera.position.clone().sub(controls.target);
  off.setLength(Math.max(12, Math.min(off.length() * 0.45, 60)));
  flyTo(p.clone().add(off), p, camera.fov);
});
const HOME = { eye: innerWidth >= 900 ? [-46, 46, 100] : [-12, 48, 82], target: innerWidth >= 900 ? [10, 0, 30] : [3, 0, 16] };   // 公尺：斜前方望第二鳥居、神門、拜殿與社務所
function topView() {
  // 從正上方往下看，讓北方朝上（相機稍微偏南，OrbitControls 才轉得動）
  const t = new THREE.Vector3(-40, groundH, 40), n = NORTH_Q;
  flyTo(t.clone().add(new THREE.Vector3(-n[0] * 3, 460, n[1] * 3)), t, baseFov);
}
$('#viewTop').onclick = topView;
$('#histBtn').onclick = () => { closeCard(); openHistory(); };
/* ---------- 環繞：鏡頭繞目前中心慢慢轉（約 60 秒一圈），一碰畫面就停 ---------- */
function setOrbit(on) {
  controls.autoRotate = on; controls.autoRotateSpeed = 1.0;
  $('#orbitBtn').classList.toggle('on', on); dirty = true;
}
$('#orbitBtn').onclick = () => setOrbit(!controls.autoRotate);
controls.addEventListener('start', () => { if (controls.autoRotate) setOrbit(false); });

/* ---------- 夜間：深藍天色、月光、提燈與石燈籠火袋透出暖光，星空與提燈微閃 ---------- */
let nightTick = false, night = false, stars = null, glows = [];
const DAY = { clear: 0xeef0ec, hemiSky: 0xf4f7ff, hemiGround: 0x8a7d62, hemiI: 1.3, sunC: 0xffe9c8, sunI: 2.9, sunP: [-55, 70, 40], exp: 1.15 };
const NIGHT = { clear: 0x0d1526, hemiSky: 0x5d6f9c, hemiGround: 0x1d1a16, hemiI: 0.36, sunC: 0xa9bde6, sunI: 0.55, sunP: [-55, 70, 40], exp: 1.05 };   // 月光方向同日光，切換時陰影不跳
function buildNight() {
  // 星星：遠方天球上的點
  const n = 700, pos = new Float32Array(n * 3);
  let r = 99; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, e = Math.asin(0.08 + rnd() * 0.92), R = 1200;
    pos.set([Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  stars.visible = false; scene.add(stars);
  // 三處暖光：第二鳥居、神門、拜殿內（只在夜間開）
  // [x, y, z, 距離, 強度, 所屬導覽站]：最後兩盞是拜殿、神門正面的淡淡補光（像被燈籠照亮）
  [[0, LV.T1 + 1.6, 63.4, 18, 1, [1]], [0, LV.T2 + 2.2, -GATE_Y + 1.5, 18, 1, [5]], [0, LV.T2 + 2.3, -6.5, 12, 1, [3, 4]], [30.2, 1.9, 48.7, 12, 1, [2]], [30.2, 1.9, 54.1, 12, 1, [2]],
   [0, 4.2, 5.5, 17, 0.45, [3]], [0, 3.4, 21, 13, 0.4, [5]]].forEach(([x, y, z, d, k, st]) => {
    const L = new THREE.PointLight(0xffb867, 0, d, 1.6); L.position.set(x, y, z); L.visible = false; L.userData = { k, st, f: 1 }; scene.add(L); glows.push(L);
  });
  // 燈籠下的地面光暈：一張徑向漸層貼圖、一次繪製（InstancedMesh），加法混色
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,196,120,1)'); gr.addColorStop(0.35, 'rgba(255,170,90,.55)'); gr.addColorStop(1, 'rgba(255,150,70,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false });
  // [x, 地面高, z, 半徑, 所屬導覽站]
  POOLS = [[-197.2, 0, 26, 3.2, [0]], [-198.3, 0, 15.1, 3.2, [0]], [-96.3, 0, 51.7, 3, []], [-90.1, 0, 42.7, 3, []],
    [-2.9, LV.T1, 63.4, 2.6, [1]], [2.9, LV.T1, 63.4, 2.6, [1]], [-12, 0, 68.3, 3.4, [1, 2]], [12, 0, 68.3, 3.4, [1, 2]],
    [30.2, 0.5, 48.7, 2.6, [2]], [30.2, 0.5, 54.1, 2.6, [2]],
    [-2.25, LV.T1, 16.6, 3.4, [5]], [2.25, LV.T1, 16.6, 3.4, [5]], [0, LV.T1, 19.5, 5.5, [5]],
    [0, LV.T1, 0.8, 6.5, [3]], [0, LV.T2, -6.2, 4.5, [3, 4]]];
  pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), pm, POOLS.length);
  const m4 = new THREE.Matrix4();
  POOLS.forEach(([px, py, pz, r], i) => { m4.makeScale(r, 1, r).setPosition(px, py + 0.04, pz); pools.setMatrixAt(i, m4); pools.setColorAt(i, new THREE.Color(1, 1, 1)); });
  pools.renderOrder = 2; pools.visible = false; pools.frustumCulled = false; scene.add(pools);
  // 跟著視線的淡淡暖光：只有拉近時才慢慢浮現，像被燈籠映亮的一層暖意（不另畫地面光暈）
  spot = new THREE.SpotLight(0xffc48a, 0, 0, 0.6, 1, 1.2); spot.visible = false; scene.add(spot, spot.target);
}
let spot = null; const focusP = new THREE.Vector3();
const groundAt = (x, z) => treeOK(x, -z, 0) ? 0.03 : LV.T1 + 0.04;   // 平台（神社範圍）上 0.5 公尺，外面貼地
function updateFocus(snap) {
  if (!spot) return;
  const t = controls.target, d = camera.position.distanceTo(t);
  if (snap) focusP.copy(t); else focusP.lerp(t, 0.07);            // 慢慢跟上，看不出在追鏡頭
  const near = 1 - THREE.MathUtils.smoothstep(d, 28, 70);         // 距離 28 公尺內全強度、70 公尺外為 0
  const y = groundAt(focusP.x, focusP.z), h = THREE.MathUtils.clamp(d * 0.7, 26, 60), r = THREE.MathUtils.clamp(d * 0.5, 13, 30);
  const dir = camera.position.clone().sub(t).setY(0).normalize().multiplyScalar(h * 0.35);
  spot.target.position.set(focusP.x, y, focusP.z);
  spot.position.set(focusP.x + dir.x, y + h, focusP.z + dir.z);
  spot.angle = Math.atan(r / h); spot.distance = h * 2.2;
  spot.intensity = nightK * near * (16 + d * 1.0);              // 約為上一版的三分之一
}
let POOLS = [], pools = null;
// 夜間焦點：導覽中，當站的燈較亮、其他較暗；不在導覽時全部中等亮度
function nightFocus() {
  const touring = !$('#tour').hidden, cur = stopIndex;
  const lvl = st => !touring ? 0.85 : st.includes(cur) ? 1.6 : 0.3;
  glows.forEach(L => { L.userData.ft = lvl(L.userData.st); });
  POOLS.forEach(p => p.ft = lvl(p[4]));
  dirty = true;
}
// 日夜切換：0.45 秒漸變（nightK 0→1），燈與光暈在白天關掉；夜間著色程式事先在閒置時編好（warmNight），切換不卡
let nightK = 0, nightAnim = null;
const later = f => (window.requestIdleCallback || (g => setTimeout(g, 120)))(f);
const _ca = new THREE.Color(), _cb = new THREE.Color();
const mix = (a, b, k) => _ca.set(a).lerp(_cb.set(b), k);
function applyNightK(k) {
  nightK = k; const D = DAY, N = NIGHT, L = (a, b) => a + (b - a) * k;
  renderer.setClearColor(mix(D.clear, N.clear, k)); scene.fog.color.copy(_ca); renderer.toneMappingExposure = L(D.exp, N.exp);
  hemi.color.copy(mix(D.hemiSky, N.hemiSky, k)); hemi.groundColor.copy(mix(D.hemiGround, N.hemiGround, k)); hemi.intensity = L(D.hemiI, N.hemiI);
  sun.color.copy(mix(D.sunC, N.sunC, k)); sun.intensity = L(D.sunI, N.sunI);
  const M = shrine?.matsByName || {};
  if (M.chochin) M.chochin.emissive.copy(mix(0x2a2620, 0xffc27a, k));
  if (M.kamonStone) M.kamonStone.emissive.copy(mix(0x000000, 0xffa24a, k));
  // 夜裡碎石、石板地面壓暗一點，讓燈籠光暈成為焦點
  ['gravel', 'path', 'slab'].forEach(n => { const m = M[n]; if (!m) return; m.userData.day ??= m.color.clone(); m.color.copy(m.userData.day).multiplyScalar(L(1, 0.38)); });
  [ground, overlay].forEach(gd => gd && gd.mesh.material.color.copy(mix(0xffffff, 0x3a4458, k)));
  if (edgeMat) edgeMat.color.copy(mix(0x2b2118, 0x05070c, k));
  if (lanMat) { lanMat.emissive.copy(mix(0x3a3328, 0xffc27a, k)); lanMat.emissiveIntensity = 1; }
  if (stars) stars.material.opacity = 0.8 * k;
  flicker(performance.now()); updateFocus(true);
  dirty = true;
}
function setLightsVisible(on) {
  glows.forEach(L => L.visible = on); if (pools) pools.visible = on; if (spot) spot.visible = on; if (stars) stars.visible = on;
}
function warmNight() {                 // 閒置時先編好夜間（燈開著）的著色程式
  if (!glows.length || nightK > 0) return;
  setLightsVisible(true); try { renderer.compile(scene, camera); } catch (e) {} setLightsVisible(false);
}
function setNight(on) {
  night = on; nightFocus();
  if (on) setLightsVisible(true);
  nightAnim = { from: nightK, to: on ? 1 : 0, start: performance.now(), ms: 450 };
  $('#vignette')?.classList.toggle('show', on);
  ['#nightBtn', '#nightBtn2'].forEach(q => $(q)?.classList.toggle('on', on));
}
function stepNight() {
  const A = nightAnim, k = Math.min((performance.now() - A.start) / A.ms, 1), e = k * k * (3 - 2 * k);
  applyNightK(A.from + (A.to - A.from) * e);
  if (k === 1) {
    nightAnim = null;
    sun.position.set(...(A.to ? NIGHT : DAY).sunP); renderer.shadowMap.needsUpdate = true;   // 陰影只在結束時重算一次
    if (!A.to) setLightsVisible(false);
    dirty = true;
  }
}
$('#nightBtn').onclick = () => setNight(!night);
$('#nightBtn2').onclick = () => setNight(!night);
/* ---------- 心願燈籠：完成三處實地踏查、審核通過者，點在外參道兩側 ----------
   資料來自 Apps Script（?type=lantern）；全部燈籠只算 3 次繪製（柱、燈身、上下口），夜間燈身發光。
   點一下燈籠（找螢幕上最近的一盞）看暱稱與祈願；網址 #lantern-0012 會直接飛到那一盞。 */
let lanMat = null, lanSlots = [], lanGlow = null;
async function loadLanterns() {
  const api = new URLSearchParams(location.search).get('lanapi') || LANTERN_API;
  if (!api) return;
  let items = [];
  try { const r = await fetch(api + (/[?&]type=/.test(api) || api.endsWith('.json') ? '' : (api.includes('?') ? '&' : '?') + 'type=lantern')); items = (await r.json()).items || []; } catch (e) { return; }
  if (!items.length) return;
  buildLanterns(items);
  const m = location.hash.match(/lantern-(\d+)/); if (m) focusLantern(m[1]);
}
function buildLanterns(items) {
  const P = approachPts().map(([x, y]) => new THREE.Vector2(x, -y)), seg = [0];
  for (let i = 1; i < P.length; i++) seg.push(seg[i - 1] + P[i].distanceTo(P[i - 1]));
  const L = seg[seg.length - 1], at = d => { let i = Math.max(1, seg.findIndex(v => v >= d)); const t = (d - seg[i - 1]) / (seg[i] - seg[i - 1] || 1);
    return { p: P[i - 1].clone().lerp(P[i], t), dir: P[i].clone().sub(P[i - 1]).normalize() }; };
  const avoid = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'B1'].map(id => shrine.boxes.get(id)).filter(Boolean).map(b => { const c = b.getCenter(new THREE.Vector3()); return new THREE.Vector2(c.x, c.z); });
  const slots = [];
  for (let d = 14; d < L - 14 && slots.length < items.length; d += 1.7) {      // 左右交錯，同側約 3.4 公尺一盞
    const side = slots.length % 2 ? 1 : -1, { p, dir } = at(d), n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(side);
    const q = p.clone().addScaledVector(n, 5.0);
    if (avoid.some(a => a.distanceTo(q) < 2.2)) continue;
    slots.push({ x: q.x, z: q.y, face: Math.atan2(-n.x, -n.y) });
  }
  const N = Math.min(slots.length, items.length); if (!N) return;
  // 一盞：木柱 1.9 公尺＋朝參道的橫木，下掛圓燈籠
  const post = mergeGeometries([new THREE.BoxGeometry(0.08, 1.9, 0.08).translate(0, 0.95, 0), new THREE.BoxGeometry(0.06, 0.06, 0.5).translate(0, 1.86, 0.22)]);
  const prof = [[0.08, 0], [0.15, 0.05], [0.17, 0.14], [0.17, 0.28], [0.15, 0.37], [0.08, 0.42]].map(([r, h]) => new THREE.Vector2(r, h));
  const body = new THREE.LatheGeometry(prof, 10).translate(0, 1.3, 0.42);
  const caps = mergeGeometries([new THREE.CylinderGeometry(0.085, 0.085, 0.05, 10).translate(0, 1.3, 0.42), new THREE.CylinderGeometry(0.085, 0.085, 0.05, 10).translate(0, 1.72, 0.42),
                                new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4).translate(0, 1.79, 0.42)]);
  lanMat = new THREE.MeshLambertMaterial({ color: 0xf5e6c4, emissive: 0x3a3328 });
  const meshes = [[post, new THREE.MeshLambertMaterial({ color: 0x6b4a2f })], [body, lanMat], [caps, new THREE.MeshLambertMaterial({ color: 0x1d1814 })]]
    .map(([g, m]) => new THREE.InstancedMesh(g, m, N));
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  lanSlots = [];
  for (let i = 0; i < N; i++) {
    const s = slots[i], y = groundH; qt.setFromAxisAngle(up, s.face); m4.compose(new THREE.Vector3(s.x, y, s.z), qt, one);
    meshes.forEach(me => me.setMatrixAt(i, m4));
    const lp = new THREE.Vector3(0, 1.51, 0.42).applyQuaternion(qt).add(new THREE.Vector3(s.x, y, s.z));
    lanSlots.push({ ...items[i], pos: lp });
  }
  meshes.forEach(me => { me.instanceMatrix.needsUpdate = true; me.computeBoundingSphere(); scene.add(me); fadeMats.push(me.material); });
  applyNightK(nightK); applyEra(); dirty = true;
  addLanternChip();
}
function addLanternChip() {
  const box = $('#viewChips'); if (!box || $('#lanChip')) return;
  const b = document.createElement('button'); b.id = 'lanChip'; b.textContent = '心願燈籠';
  b.onclick = () => { closeCard(); if (!night) setNight(true); const a = lanSlots[0].pos, z = lanSlots[lanSlots.length - 1].pos;
    flyTo(a.clone().lerp(z, 0.5).add(new THREE.Vector3(-30, 26, 28)), a.clone().lerp(z, 0.55), baseFov); };
  box.append(b);
}
function openLantern(L) {
  $('#cardBody').innerHTML = `<span class="tag" style="background:#8f2a2a">心願燈籠</span><h2>No.${esc(L.no)}　${esc(L.n || '')}</h2>` +
    (L.w ? `<p class="lead">「${esc(L.w)}」</p>` : '') +
    `<p>完成銅馬、拜殿前地磚遺跡、義民廟狛犬三處實地踏查，點亮於 ${esc(L.d || '')}。</p>` +
    `<p class="caveat">心願燈籠為當代教育活動的參與創作，並非中壢神社原有的設施。</p>`;
  $('#card').scrollTop = 0; $('#card').classList.add('open');
}
function focusLantern(no) {
  const L = lanSlots.find(l => l.no === no || l.no === ('000' + no).slice(-4)); if (!L) return;
  if (!night) setNight(true);
  if (!lanGlow) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,210,140,1)'); g.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    lanGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    lanGlow.material.opacity = 0.75; lanGlow.scale.set(0.95, 0.95, 1); scene.add(lanGlow);
  }
  lanGlow.position.copy(L.pos);
  const back = new THREE.Vector3(0, 0, 0); { const i = lanSlots.indexOf(L), o = lanSlots[Math.min(lanSlots.length - 1, i + 2)] || L; back.copy(L.pos).sub(o.pos).setY(0).normalize(); }
  const eye = L.pos.clone().addScaledVector(back.lengthSq() ? back : new THREE.Vector3(1, 0, 0), 7).add(new THREE.Vector3(0, 1.2, 0));
  flyTo(eye, L.pos.clone(), baseFov, () => openLantern(L));
}
renderer.domElement.addEventListener('click', e => {
  if (!lanSlots.length || inPhoto) return;
  const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3();
  let best = null, bd = 30 * 30;
  for (const L of lanSlots) {
    v.copy(L.pos).project(camera); if (v.z > 1) continue;
    const sx = (v.x + 1) / 2 * r.width, sy = (1 - v.y) / 2 * r.height, dd = (sx - (e.clientX - r.left)) ** 2 + (sy - (e.clientY - r.top)) ** 2;
    if (dd < bd && camera.position.distanceTo(L.pos) < 80) { bd = dd; best = L; }
  }
  if (best) openLantern(best);
});
function flicker(t) {                 // 提燈微閃：燭火般的不規則亮度
  const M = shrine?.matsByName; if (!M) return;
  // 焦點亮度慢慢靠向目標（約 0.5 秒），換站時不會一下子跳亮
  glows.forEach(L => { if (L.userData.ft !== undefined) L.userData.f += (L.userData.ft - L.userData.f) * 0.12; });
  if (pools) { let ch = false; POOLS.forEach((p, i) => { p.f ??= 0.85; if (p.ft !== undefined && Math.abs(p.ft - p.f) > 0.002) { p.f += (p.ft - p.f) * 0.12; pools.setColorAt(i, _cb.setScalar(p.f)); ch = true; } }); if (ch) pools.instanceColor.needsUpdate = true; }
  const f = 0.88 + 0.08 * Math.sin(t * 0.0071) + 0.05 * Math.sin(t * 0.0193 + 1.3) + 0.03 * Math.sin(t * 0.047);
  M.chochin.emissiveIntensity = 1 + (f - 1) * nightK; glows.forEach((L, i) => L.intensity = nightK * 9 * L.userData.k * L.userData.f * (f + 0.04 * Math.sin(t * 0.011 + i)));
  if (pools) pools.material.opacity = nightK * 0.5 * (0.9 + 0.1 * f);
  updateFocus(false);
  if (stars) stars.material.opacity = nightK * (0.75 + 0.1 * Math.sin(t * 0.002));
}

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
  inPhoto = false; showPhoto(false); camera.near = 0.5; camera.updateProjectionMatrix();
  photoMarker.visible = spotsOn; controls.enabled = true;
  $('#tour').hidden = true; $('#explore').hidden = false;
  showPlacePins(); nightFocus();
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
  const th = $('#thumbs'); th.innerHTML = '';
  (s.thumbs || []).forEach(([src, cap]) => {
    const f = document.createElement('figure');
    f.innerHTML = `<img src="${src}" alt="${esc(cap)}"><figcaption>${esc(cap)}</figcaption>`;
    f.onclick = () => { $('#lightImg').src = src; $('#lightbox').classList.add('show'); };
    th.append(f);
  });
  th.classList.toggle('show', !!(s.thumbs && s.thumbs.length));
  inPhoto = !!s.photo;
  showPhoto(false);
  curPhoto = s.photo || HIST_PHOTO;
  if (s.photo) { $('#photoImg').src = curPhoto.src; $('#photoLayer .frame').style.aspectRatio = String(curPhoto.aspect); resize(); }
  camera.near = 0.5; camera.updateProjectionMatrix();
  photoMarker.visible = false;
  controls.enabled = !s.photo;
  flyTo(new THREE.Vector3(...s.eye), new THREE.Vector3(...s.target), s.photo ? photoFov() : (s.fov ? Math.max(s.fov, baseFov) : baseFov), () => {
    if (s.photo) {
      // 用反求出的相機軸向（含些微傾斜），而不是單純 lookAt
      const A = curPhoto.axes;
      if (A) camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...A.x), new THREE.Vector3(...A.y), new THREE.Vector3(...A.z)));
      camera.fov = photoFov(); camera.near = curPhoto.near || 0.5; camera.updateProjectionMatrix();   // 面板高度可能在飛行途中改變，最後再算一次
      dirty = true; $('#fade').value = 0; showPhoto(true); applyFade(); }
  });
  showStopPins(s); nightFocus();
  window.history.replaceState(null, '', '#stop-' + (stopIndex + 1));
}
$('#prev').onclick = () => go(stopIndex - 1);
$('#next').onclick = () => stopIndex === STOPS.length - 1 ? endTour() : go(stopIndex + 1);
function showPhoto(on) { ['#photoLayer', '#shadeTop', '#shadeBot'].forEach(q => $(q).classList.toggle('show', on)); }
function applyFade() { $('#photoImg').style.opacity = 1 - $('#fade').value / 100; }
$('#fade').oninput = applyFade;
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
let fly = null, dirty = true, slow = 0, fast = 0, lastTick = 0, renderedPrev = false, dprChanges = 0;
function flyTo(eye, target, fov, done) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov, p1: eye, t1: target, f1: fov, start: performance.now(), ms: 1300, done };
}
/* ---------- 載入 ---------- */
try {
  const [md, hist] = await Promise.all([fetch('./map-data.json').then(r => r.json()), fetch('./history.json').then(r => r.json()).catch(() => null)]);
  histData = hist;
  setOnAsset(() => { dirty = true; });
  shrine = buildShrine();
  scene.add(shrine.group);
  fadeMats.push(...shrine.mats);
  shrine.group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // 陰影承接面：只顯示陰影、不遮住底圖
  shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.34, transparent: true, depthWrite: false }));
  shadowPlane.position.set(0, groundH + 0.02, 20); shadowPlane.receiveShadow = true; shadowPlane.renderOrder = 0; scene.add(shadowPlane);
  groundH = -0.05;      // 公尺：今日地面（外參道高度）
  ground = createGround(scene, { bounds: { x0: -280, x1: 220, y0: -300, y1: 200 }, height: groundH - 0.3, qToLL, llToQ, north: NORTH_Q, order: -2 });   // 兩層地面隔開，遠看才不會互相穿插
  overlay = createGround(scene, { bounds: { x0: -280, x1: 220, y0: -300, y1: 200 }, height: groundH - 0.12, qToLL, llToQ, north: NORTH_Q, order: -1 });
  places = md.places.map(p => ({ ...p, pos: p.q || (p.plan ? warpH(p.plan) : llToQ(p.lat, p.lng)) }));
  // 先畫出神社，再於空檔載入掃描模型與輪廓線，避免一開頁卡住
  requestAnimationFrame(() => requestAnimationFrame(() => { later(buildEdges); later(buildPines); later(loadHorseScan); later(loadKomainu); later(loadLanterns); later(warmNight); }));
  buildScaleAids();
  buildHorseLine();
  buildChips();
  buildViewChips();
  // 桌機：滑鼠滾輪轉成左右捲動、可拖曳捲動（手機原本就能用手指滑）
  document.querySelectorAll('.chips').forEach(row => {
    row.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && row.scrollWidth > row.clientWidth) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    let sx = 0, sl = 0, down = false, moved = false;
    row.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = row.scrollLeft; });
    addEventListener('pointermove', e => { if (!down) return; const d = e.clientX - sx; if (Math.abs(d) > 4) { moved = true; row.classList.add('drag'); } row.scrollLeft = sl - d; });
    addEventListener('pointerup', () => { if (!down) return; down = false; row.classList.remove('drag'); });
    row.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  });
  buildNight();
  buildSpots();
  setGround('photo');
  renderer.shadowMap.needsUpdate = true;
  $('#loading').style.opacity = 0;
  setTimeout(() => $('#loading').remove(), 500);
} catch (e) {
  console.error(e);
  $('#loadMsg').textContent = '載入失敗，請重新整理';
}

resize();
camera.position.set(-90, 120, 190); controls.target.set(6, 2, 22);
camera.fov = baseFov; camera.updateProjectionMatrix();
const hashStop = Number((location.hash.match(/stop-(\d)/) || [])[1]);
if (hashStop) startTour(hashStop - 1);
else { showPlacePins(); flyTo(new THREE.Vector3(...HOME.eye), new THREE.Vector3(...HOME.target), baseFov); }

renderer.setAnimationLoop(() => {
  // 依「連續兩格都有重畫」時的畫格間隔調解析度（夜間每兩格才重畫一次，不能拿重畫間隔來判斷）。
  // 解析度要在重畫「之前」改，否則畫布被清空會閃一下；升降有次數上限，避免來回跳。
  const now = performance.now(), tick = now - lastTick; lastTick = now;
  if (renderedPrev && tick < 200) {
    const pr = renderer.getPixelRatio();
    slow = tick > 28 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 12 && pr > 0.75 && dprChanges < 6) { renderer.setPixelRatio(Math.max(0.75, pr - 0.25)); slow = 0; fast = 0; dprChanges++; dirty = true; }
    else if (tick < 18 && pr < maxDPR && ++fast > 360 && dprChanges < 6) { renderer.setPixelRatio(Math.min(maxDPR, pr + 0.25)); fast = 0; dprChanges++; dirty = true; }
  }
  renderedPrev = false;
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
  if (nightAnim) stepNight();
  else if (night && (nightTick = !nightTick)) { flicker(performance.now()); dirty = true; }   // 夜間閃爍每兩格更新一次（約 30 fps），省電
  if (dirty) fadeSpotCards();
  if (!dirty) return;                  // 畫面沒變就不重畫：省電、不發燙
  dirty = false;
  renderer.render(scene, camera); renderedPrev = true;
  updatePins();
});

window.__app = { renderer, scene, startTour, endTour, go, setGround, setNight: v => setNight(v), camera, controls, get shrine() { return shrine; }, get ground() { return ground; } };
