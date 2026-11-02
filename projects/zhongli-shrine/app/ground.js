// 把今日航照（或電子地圖）鋪在 3D 神社底下，旋轉時看得出與今天校園的相對位置。
// 對位沿用古今地圖的 map-data.json 校準點：模型平面座標 ↔ 經緯度。
import * as THREE from 'three';

const NLSC = id => (z, x, y) => `https://wmts.nlsc.gov.tw/wmts/${id}/default/GoogleMapsCompatible/${z}/${y}/${x}`;
export const GROUND_LAYERS = {
  photo: { label: '航照', url: NLSC('PHOTO2') },
  emap:  { label: '地圖', url: NLSC('EMAP') }
};

/* ---- 座標轉換 ---- */
const lat0 = 24.962, lng0 = 121.2095;
const mx = 111320 * Math.cos(lat0 * Math.PI / 180), my = 110574;
const toENU = (lat, lng) => [(lng - lng0) * mx, (lat - lat0) * my];
const toLL = ([e, n]) => [lat0 + n / my, lng0 + e / mx];             // [lat, lng]

// 最小平方相似轉換：plan → ENU，以及反向 ENU → plan
function fit(cps) {
  const n = cps.length, m = cps.map(c => c.plan), w = cps.map(c => toENU(c.lat, c.lng));
  const avg = (arr, k) => arr.reduce((s, p) => s + p[k], 0) / n;
  const mc = [avg(m, 0), avg(m, 1)], wc = [avg(w, 0), avg(w, 1)];
  let re = 0, im = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const p = [m[i][0] - mc[0], m[i][1] - mc[1]], q = [w[i][0] - wc[0], w[i][1] - wc[1]];
    re += q[0] * p[0] + q[1] * p[1]; im += q[1] * p[0] - q[0] * p[1]; den += p[0] * p[0] + p[1] * p[1];
  }
  const a = [re / den, im / den];
  const b = [wc[0] - (a[0] * mc[0] - a[1] * mc[1]), wc[1] - (a[0] * mc[1] + a[1] * mc[0])];
  const s2 = a[0] * a[0] + a[1] * a[1];
  return {
    planToLL: ([x, y]) => toLL([a[0] * x - a[1] * y + b[0], a[0] * y + a[1] * x + b[1]]),
    llToPlan: (lat, lng) => {
      const [e, nn] = toENU(lat, lng), u = e - b[0], v = nn - b[1];
      return [(a[0] * u + a[1] * v) / s2, (a[0] * v - a[1] * u) / s2];   // 乘上 a 的共軛 / |a|²
    }
  };
}

/* ---- Web Mercator 圖磚 ---- */
const lng2x = (lng, z) => (lng + 180) / 360 * 2 ** z;
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const x2lng = (x, z) => x / 2 ** z * 360 - 180;
const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };

function loadImg(src) {
  return new Promise(res => {
    const im = new Image();
    im.crossOrigin = 'anonymous';          // 要當 WebGL 貼圖，圖磚伺服器必須允許跨網域
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

/**
 * 建立地面。回傳 { mesh, setLayer(id), ok }。
 * bounds：要鋪多大（模型平面座標），zoom：圖磚層級（18 約 0.5 公尺／像素）
 */
export async function createGround(scene, control, { bounds, height = 0, zoom = 18, layer = 'photo' } = {}) {
  const { planToLL, llToPlan } = fit(control);

  // 模型範圍四角 → 經緯度 → 圖磚範圍
  const corners = [[bounds.x0, bounds.y0], [bounds.x1, bounds.y0], [bounds.x1, bounds.y1], [bounds.x0, bounds.y1]].map(planToLL);
  const lats = corners.map(c => c[0]), lngs = corners.map(c => c[1]);
  const tx0 = Math.floor(lng2x(Math.min(...lngs), zoom)), tx1 = Math.floor(lng2x(Math.max(...lngs), zoom));
  const ty0 = Math.floor(lat2y(Math.max(...lats), zoom)), ty1 = Math.floor(lat2y(Math.min(...lats), zoom));
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;

  const canvas = document.createElement('canvas');
  canvas.width = nx * 256; canvas.height = ny * 256;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // 地面平面：四角就是圖磚拼圖的四角（換算回模型座標），UV 直接對應整張拼圖
  const tl = llToPlan(y2lat(ty0, zoom), x2lng(tx0, zoom));
  const tr = llToPlan(y2lat(ty0, zoom), x2lng(tx1 + 1, zoom));
  const br = llToPlan(y2lat(ty1 + 1, zoom), x2lng(tx1 + 1, zoom));
  const bl = llToPlan(y2lat(ty1 + 1, zoom), x2lng(tx0, zoom));
  const P = ([x, y]) => [x, height, -y];         // 模型平面 → three.js 世界座標
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...P(tl), ...P(tr), ...P(br), ...P(bl)], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geo.setIndex([0, 3, 1, 1, 3, 2]);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.name = 'today-ground';
  scene.add(mesh);

  let loadedOk = false;
  async function setLayer(id) {
    if (id === 'off') { mesh.visible = false; return true; }
    mesh.visible = true;
    const L = GROUND_LAYERS[id];
    const jobs = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      jobs.push(loadImg(L.url(zoom, tx, ty)).then(im => { if (im) ctx.drawImage(im, (tx - tx0) * 256, (ty - ty0) * 256); return !!im; }));
    }
    const results = await Promise.all(jobs);
    loadedOk = results.some(Boolean);
    try {
      tex.needsUpdate = true;
      mat.opacity = loadedOk ? 1 : 0;
    } catch (e) { loadedOk = false; }
    return loadedOk;
  }
  const ok = await setLayer(layer);
  return { mesh, setLayer, ok, llToPlan, planToLL };
}
