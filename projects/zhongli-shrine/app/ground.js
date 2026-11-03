// 把今日航照（或電子地圖）鋪在 3D 神社底下，旋轉時看得出與今天校園的相對位置。
// 對位沿用古今地圖的 map-data.json 校準點：模型平面座標 ↔ 經緯度。
import * as THREE from 'three';

const NLSC = id => (z, x, y) => `https://wmts.nlsc.gov.tw/wmts/${id}/default/GoogleMapsCompatible/${z}/${y}/${x}`;
// 中研院百年歷史地圖：WMTS 說明（gis.sinica.edu.tw/tainan/wmts）列出的圖磚是 png，
// 網址 file-exists.php?img=圖層-png-z-x-y。依序嘗試 tainan、tileserver 兩個服務與 png／jpg。
const SINICA = id => ['tainan', 'tileserver'].flatMap(svc => ['png', 'jpg'].map(ext =>
  (z, x, y) => `https://gis.sinica.edu.tw/${svc}/file-exists.php?img=${id}-${ext}-${z}-${x}-${y}`));
// zoom：用哪一層圖磚（18 約 0.5 公尺／像素）。舊地圖解析度較低，用 16（失敗再試 15）。
export const GROUND_LAYERS = {
  photo: { label: '今日航照', url: NLSC('PHOTO2'), zoom: 18 },
  emap:  { label: '今日地圖', url: NLSC('EMAP'),   zoom: 18 },
  // local：先用存在作品裡的拼接圖（z16、自圖磚 x54832 y28072 起、3×2 張），沒有才連線抓
  jm25k: { label: '1921 日治地形圖', url: SINICA('JM25K_1921'), zoom: 16, local: { src: './oldmaps/JM25K_1921_z16_x54832_y28072.png', z: 16, x0: 54832, y0: 28072 } },
  // 1947-09-05 航照：臺灣早期舊航照影像查詢系統，任務編號 47M7045、照片編號 022（中壢市區），
  // 原圖由中研院 GIS 中心提供；標註（本殿、拜殿、神門、鳥居、社務所等）由羅偉源先生考證標示：以南大門舊址與陶然亭兩點對位
  aer1947: { label: '1947 航照', image: { src: './oldmaps/aerial_1947_luo.jpg', a: [325, 300], b: [425, 597.5], la: [24.96265, 121.209686], lb: [24.961157, 121.208661] } },
  am50k: { label: '1944 美軍地圖',   url: SINICA('AM50K_1944'), zoom: 16, local: { src: './oldmaps/AM50K_1944_z16_x54832_y28072.png', z: 16, x0: 54832, y0: 28072 } }
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
 * 建立地面。回傳 { mesh, setLayer(id), planToLL, llToPlan, north }。
 * bounds：要鋪多大（模型平面座標）。每個圖層用自己的 zoom 重新拼圖。
 */
export function createGround(scene, { bounds, height = 0, qToLL, llToQ, north, order = -1 }) {
  // bounds 為 q 座標（公尺）；四角換成經緯度，決定要抓哪些圖磚
  const corners = [[bounds.x0, bounds.y0], [bounds.x1, bounds.y0], [bounds.x1, bounds.y1], [bounds.x0, bounds.y1]].map(qToLL);
  const lats = corners.map(c => c[0]), lngs = corners.map(c => c[1]);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geo.setIndex([0, 3, 1, 1, 3, 2]);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = order;
  let alpha = 1;                                 // 疊圖用：外部控制的不透明度
  mesh.name = 'ground';
  mesh.visible = false;
  scene.add(mesh);
  const P = ([x, y]) => [x, height, -y];         // q → three.js 世界座標

  let token = 0;
  async function setLayer(id) {
    const my = ++token;
    if (id === 'off') { mesh.visible = false; return true; }
    const L = GROUND_LAYERS[id];
    // 依序嘗試：各個網址格式 × 原 zoom、低一級 zoom（舊地圖不一定有高 zoom 圖磚）
    if (L.image) {                    // 單張已對位的影像（兩點相似轉換）
      const I = L.image, im = await loadImg(I.src);
      if (my !== token) return !!im;
      if (!im) return false;
      const qa = llToQ(...I.la), qb = llToQ(...I.lb);
      const za = [I.b[0] - I.a[0], -(I.b[1] - I.a[1])], zq = [qb[0] - qa[0], qb[1] - qa[1]], d = za[0] ** 2 + za[1] ** 2;
      const k = [(zq[0] * za[0] + zq[1] * za[1]) / d, (zq[1] * za[0] - zq[0] * za[1]) / d];
      const toQ = ([x, y]) => { const re = x - I.a[0], imv = -(y - I.a[1]); return [qa[0] + k[0] * re - k[1] * imv, qa[1] + k[0] * imv + k[1] * re]; };
      canvas.width = im.width; canvas.height = im.height; ctx.drawImage(im, 0, 0);
      const W = im.width, H = im.height;
      geo.attributes.position.array.set([...P(toQ([0, 0])), ...P(toQ([W, 0])), ...P(toQ([W, H])), ...P(toQ([0, H]))]);
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
      tex.dispose(); tex.needsUpdate = true; mat.opacity = alpha; mesh.visible = alpha > 0.01;
      return true;
    }
    const urls = Array.isArray(L.url) ? L.url : [L.url];
    let ok = false, z = L.zoom, tx0, tx1, ty0, ty1, off;
    if (L.local) {
      const im = await loadImg(L.local.src);
      if (my !== token) return !!im;
      if (im) {
        z = L.local.z; tx0 = L.local.x0; ty0 = L.local.y0;
        tx1 = tx0 + Math.round(im.width / 256) - 1; ty1 = ty0 + Math.round(im.height / 256) - 1;
        off = document.createElement('canvas'); off.width = (tx1 - tx0 + 1) * 256; off.height = (ty1 - ty0 + 1) * 256;
        off.getContext('2d').drawImage(im, 0, 0, off.width, off.height);
        ok = true;
      }
    }
    if (!ok) outer: for (const zz of [L.zoom, L.zoom - 1]) for (const url of urls) {
      z = zz;
      tx0 = Math.floor(lng2x(Math.min(...lngs), z)); tx1 = Math.floor(lng2x(Math.max(...lngs), z));
      ty0 = Math.floor(lat2y(Math.max(...lats), z)); ty1 = Math.floor(lat2y(Math.min(...lats), z));
      off = document.createElement('canvas');
      off.width = (tx1 - tx0 + 1) * 256; off.height = (ty1 - ty0 + 1) * 256;
      // 先用中間一張圖磚探路，失敗就換下一個網址，不必整批等逾時
      const probe = await loadImg(url(z, (tx0 + tx1) >> 1, (ty0 + ty1) >> 1));
      if (my !== token) return false;
      if (!probe) continue;
      const octx = off.getContext('2d'), jobs = [];
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
        jobs.push(loadImg(url(z, tx, ty)).then(im => { if (im) octx.drawImage(im, (tx - tx0) * 256, (ty - ty0) * 256); return !!im; }));
      ok = (await Promise.all(jobs)).some(Boolean);
      if (my !== token) return ok;
      if (ok) break outer;
    }
    if (my !== token) return ok;
    if (!ok) return false;
    canvas.width = off.width; canvas.height = off.height;
    ctx.drawImage(off, 0, 0);
    const tl = llToQ(y2lat(ty0, z), x2lng(tx0, z)), tr = llToQ(y2lat(ty0, z), x2lng(tx1 + 1, z));
    const br = llToQ(y2lat(ty1 + 1, z), x2lng(tx1 + 1, z)), bl = llToQ(y2lat(ty1 + 1, z), x2lng(tx0, z));
    geo.attributes.position.array.set([...P(tl), ...P(tr), ...P(br), ...P(bl)]);
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
    tex.dispose(); tex.needsUpdate = true;
    mat.opacity = alpha; mesh.visible = alpha > 0.01;
    return true;
  }
  function setOpacity(a) { alpha = a; mat.opacity = a; mat.depthWrite = a > 0.99; if (mat.map && canvas.width > 1) mesh.visible = a > 0.01 && mesh.userData.on !== false; }
  function clear() { token++; mesh.visible = false; mesh.userData.on = false; }
  const _set = setLayer;
  async function setLayerOn(id) { mesh.userData.on = true; return _set(id); }
  return { mesh, setLayer: setLayerOn, setOpacity, clear, north, height };
}
