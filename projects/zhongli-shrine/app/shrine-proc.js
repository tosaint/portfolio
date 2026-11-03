// 中壢神社 1939：依老照片反推、以 three.js 程式建構的整座神社（單位：公尺）
//
// 為什麼重做：原本的 Tinkercad 模型每個構件各自縮放，彼此尺寸互相牽扯，圍牆接不起來。
// 這裡改成「一套尺寸、一個座標」：所有構件都從同一個配置（羅偉源先生考證的相對位置，
// 以 1.55 公尺／單位換算）出發，尺寸則各自從老照片量出來，見 DIMS 的說明。
//
// 座標：q = 公尺平面座標（q.y 沿中軸朝本殿，原點在拜殿與本殿之間 ↔ 今陶然亭）；
// three.js 世界座標 = (q.x, 高度, -q.y)。高度 0 = 外參道地面。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { warpH, llToQ } from './site.js';

// ---- 地坪高度（公尺，外參道 = 0）----
export const LV = {
  T1: 0.5,    // 第二鳥居後的前庭：鳥居照片中鳥居後有三級台階
  T2: 0.9,    // 玉垣內的內苑：神門照片中神門前有兩級台階
  T3: 1.25,   // 透塀內的本殿區
};

// ---- 尺寸依據（顯示在地點卡片上）----
// ---- 配置（公尺，q 座標）：依 1947 年航照 ----
// 航照可辨認：參道帶狀亮區沿中軸從第二鳥居延伸到一道暗帶（神門與屋根付玉垣）＝ q.y 約 −15；
// 暗帶後方的亮方塊是內苑（砂利）；第二鳥居在帶狀區前端 q.y 約 −62～−68。
// 神門到拜殿的距離（21 公尺）則用神門照片反求的結果。
export const GATE_Y = -15.0;          // 神門（內苑前緣）
export const KOMA_POS = [[-3.2, GATE_Y - 4.3], [3.2, GATE_Y - 4.3]];   // 狛犬（神門照片反求）
const IN = GATE_Y + 28.2;             // 內苑各構件相對於舊配置的位移（神門照片反求時神門在 −28.2）
export const TORII2_Y = -64.0;        // 第二鳥居
const OUT = TORII2_Y + 56.6;          // 第二鳥居一帶（燈籠、社號標等）相對舊配置的位移

export const DIMS = {
  B1: '形式依簡報照片（鋼筋水泥、洗石子）；尺寸參考第二鳥居放大推估，待查',
  B2: '依鎮座祭鳥居照片：以台階與人身高為比例，柱距約 4 公尺',
  N: '依神門與狛犬照片反求（以拜殿尺寸為比例尺，同時解出拍攝位置）；神門到拜殿約 21 公尺',
  P: '依拜殿正面照（自神門往拜殿）：以參拜道實測寬 3.01 公尺為比例，相機與尺寸聯合反求，誤差約 5 像素；深度依神門照片',
  Q: '依本殿歷史照片：流造檜皮葺、前簷延伸為向拜、千木與鰹木 6 根、高床與三面高欄；以巫女身高約 1.5 公尺為比例',
  D6: '依石燈籠照片：三層台座、竿、中台、火袋、笠、寶珠',
  H: '位置依 1947 航照；外觀依校史館照片（唐破風玄關、黑瓦寄棟），以合影人身高推估',
  G: '依石燈籠照片背景',
  L: '3D 掃描＋現場實測',
};

const COLORS = {
  wood: 0xcdb48d,      // 白木（檜）
  dark: 0x6d5a45,      // 格子、門板、木構陰影
  roof: 0x5e5044,      // 檜皮葺
  stone: 0xd4cdbd,     // 花崗岩、洗石子
  grey: 0xb9b4a8,      // 第一鳥居（洗石子）
  gravel: 0xdcd5c3,    // 砂利
  white: 0xf3efe4,     // 紙垂
  bronze: 0x4c4a40,    // 千木、鰹木的金屬包覆
  plaster: 0xebe5d8,   // 社務所白漆喰牆（與神社建築統一的和風配色）
  brown: 0x5f4b3b,     // 社務所腰板（深色木）
  tile: 0x5d5b58,      // 日式黑瓦
  copper: 0x6f7a72,    // 社務所唐破風屋頂（銅板葺、帶綠青的灰綠）
  sash: 0x7c6650,      // 窗框、雨庇（木色）
};

/* =========================================================
   幾何收集器：同材質的幾何最後合併成一個網格（手機上只要十來次繪製）
   ========================================================= */
class Builder {
  constructor() { this.bins = {}; this.M = new THREE.Matrix4(); this.boxes = new Map(); this.cur = null; }
  /** 設定接下來構件的位置：q 座標、旋轉（沿 u 軸朝向的角度，弧度）、基準高度 */
  at(qx, qy, ang = 0, base = 0) {
    // 局部 (x, u, y)：x 橫向、u 沿構件前後、y 向上 → 世界 (x, y, -u) 經旋轉平移
    this.M.makeRotationY(-ang).setPosition(qx, base, -qy);   // 局部 u 軸 → q 方向 (sin ang, cos ang)
    return this;
  }
  begin(id) { this.cur = id; if (!this.boxes.has(id)) this.boxes.set(id, new THREE.Box3()); return this; }
  end() { this.cur = null; return this; }
  add(mat, g) {
    g.applyMatrix4(this.M);
    if (this.cur) { g.computeBoundingBox(); this.boxes.get(this.cur).union(g.boundingBox); }
    (this.bins[mat] ||= []).push(clean(g));
  }
  /** 長方塊：中心 (x,u)，寬 w（x 向）、深 d（u 向），高度 y0→y1 */
  box(mat, x, u, w, d, y0, y1) {
    const g = new THREE.BoxGeometry(w, y1 - y0, d);
    g.translate(x, (y0 + y1) / 2, -u);
    this.add(mat, g);
  }
  /** 旋轉的長方塊（繞 u 軸傾斜，做千木用） */
  boxRot(mat, x, u, w, d, h, y, rz) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateZ(rz); g.translate(x, y, -u); this.add(mat, g);
  }
  cyl(mat, x, u, r, y0, y1, seg = 10, r2 = r) {
    const g = new THREE.CylinderGeometry(r2, r, y1 - y0, seg);
    g.translate(x, (y0 + y1) / 2, -u); this.add(mat, g);
  }
  /** 水平圓柱（沿 x 或 u） */
  rod(mat, x, u, y, r, len, alongX = true, seg = 8) {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    if (alongX) g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
    g.translate(x, y, -u); this.add(mat, g);
  }
  /** 任意三角面：pts 為 [x,u,y]，tris 為索引 */
  mesh(mat, pts, tris) {
    const pos = [];
    tris.forEach(t => t.forEach(i => { const [x, u, y] = pts[i]; pos.push(x, y, -u); }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
    this.add(mat, g);
  }
  quad(mat, a, b, c, d) { this.mesh(mat, [a, b, c, d], [[0, 1, 2], [0, 2, 3]]); }
  build(mats) {
    const group = new THREE.Group();
    for (const [k, list] of Object.entries(this.bins)) {
      const m = new THREE.Mesh(mergeGeometries(list), mats[k]);
      m.name = 'shrine-' + k; group.add(m);
    }
    return group;
  }
}
function clean(g) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 2).fill(0), 2));
  g.groups = [];
  return g;
}

/* =========================================================
   屋頂
   ========================================================= */
// 入母屋造（歇山）：下段四坡，上段兩坡＋山牆。cx,cu 為中心；W×D 為簷口範圍；
// he 簷高、hm 轉折高、hr 屋脊高；屋脊沿 x。lift = 簷角起翹。
function irimoya(B, cx, cu, W, D, he, hm, hr, lift = 0.3) {
  const run = (hr - he) / (D / 2);              // 坡度（每公尺水平升高）
  const inset = (hm - he) / run;                // 下段水平退縮
  const w2 = W / 2 - inset, d2 = D / 2 - inset, w = W / 2, d = D / 2;
  const E = [[cx - w, cu - d, he + lift], [cx + w, cu - d, he + lift], [cx + w, cu + d, he + lift], [cx - w, cu + d, he + lift]];
  const Em = [[cx, cu - d, he], [cx + w, cu, he + lift * 0.4], [cx, cu + d, he], [cx - w, cu, he + lift * 0.4]];
  const T = [[cx - w2, cu - d2, hm], [cx + w2, cu - d2, hm], [cx + w2, cu + d2, hm], [cx - w2, cu + d2, hm]];
  // 下段：每邊兩個三角形＋中間點，讓簷口中間略低（反り）
  const sides = [[0, 1, 0], [1, 2, 1], [2, 3, 2], [3, 0, 3]];
  sides.forEach(([a, b, m]) => {
    B.mesh('roof', [E[a], Em[m], E[b], T[b], T[a]], [[0, 1, 4], [1, 3, 4], [1, 2, 3]]);
    // 簷口厚度（鼻隠）
    B.mesh('dark', [E[a], Em[m], E[b], [E[b][0], E[b][1], E[b][2] - 0.28], [Em[m][0], Em[m][1], Em[m][2] - 0.28], [E[a][0], E[a][1], E[a][2] - 0.28]],
      [[0, 5, 4], [0, 4, 1], [1, 4, 3], [1, 3, 2]]);
  });
  // 上段：兩坡屋面＋山牆三角
  const R0 = [cx - w2, cu, hr], R1 = [cx + w2, cu, hr];
  B.quad('roof', T[0], T[1], R1, R0);
  B.quad('roof', T[2], T[3], R0, R1);
  B.mesh('dark', [T[0], T[3], R0], [[0, 1, 2]]);
  B.mesh('dark', [T[1], R1, T[2]], [[0, 1, 2]]);
  // 屋脊（棟）＋鬼板
  B.box('roof', cx, cu, 2 * w2 + 0.3, 0.45, hr - 0.05, hr + 0.35);
  B.box('dark', cx - w2 - 0.1, cu, 0.25, 0.5, hr - 0.1, hr + 0.55);
  B.box('dark', cx + w2 + 0.1, cu, 0.25, 0.5, hr - 0.1, hr + 0.55);
}
// 切妻造（兩坡）：屋脊沿 x（alongX）或沿 u。前後簷深可不同（流造）。
function kirizuma(B, cx, cu, W, Df, Db, he, hr, alongX = true, lift = 0.2, heB = he) {
  if (alongX) {
    const w = W / 2, f = [cx - w, cu - Df, he], f2 = [cx + w, cu - Df, he], b = [cx - w, cu + Db, heB], b2 = [cx + w, cu + Db, heB];
    const r0 = [cx - w, cu, hr], r1 = [cx + w, cu, hr];
    // 中間略低的簷口
    const fm = [cx, cu - Df, he - lift], bm = [cx, cu + Db, heB - lift];
    B.mesh('roof', [f, fm, f2, r1, r0], [[0, 1, 4], [1, 3, 4], [1, 2, 3]]);
    B.mesh('roof', [b2, bm, b, r0, r1], [[0, 1, 4], [1, 3, 4], [1, 2, 3]]);
    [[f, fm, f2], [b2, bm, b]].forEach(([a, m, c]) => B.mesh('dark', [a, m, c, [c[0], c[1], c[2] - 0.22], [m[0], m[1], m[2] - 0.22], [a[0], a[1], a[2] - 0.22]], [[0, 5, 4], [0, 4, 1], [1, 4, 3], [1, 3, 2]]));
    // 破風板（山牆封簷）
    [-w, w].forEach(x => {
      B.mesh('dark', [[cx + x, cu - Df, he], [cx + x, cu, hr], [cx + x, cu, hr + 0.3], [cx + x, cu - Df, he + 0.3]], [[0, 1, 2], [0, 2, 3]]);
      B.mesh('dark', [[cx + x, cu + Db, heB], [cx + x, cu, hr], [cx + x, cu, hr + 0.3], [cx + x, cu + Db, heB + 0.3]], [[0, 2, 1], [0, 3, 2]]);
    });
    B.box('roof', cx, cu, W + 0.2, 0.4, hr - 0.05, hr + 0.3);
  } else {
    const d = W / 2;   // 此時 W 為沿 u 的長度，Df 為左右各伸出寬
    const l = [cx - Df, cu - d, he], l2 = [cx - Df, cu + d, he], r = [cx + Db, cu - d, heB], r2 = [cx + Db, cu + d, heB];
    const t0 = [cx, cu - d, hr], t1 = [cx, cu + d, hr];
    B.quad('roof', l, t0, t1, l2);
    B.quad('roof', r2, t1, t0, r);
    B.box('roof', cx, cu, 0.4, W + 0.2, hr - 0.05, hr + 0.3);
    [-d, d].forEach(u => B.mesh('dark', [[cx - Df, cu + u, he], [cx, cu + u, hr], [cx + Db, cu + u, heB]], [[0, 1, 2]]));
  }
}
// 寄棟（四坡），屋脊沿 x
function yosemune(B, cx, cu, W, D, he, hr, mat = 'roof') {
  const w = W / 2, d = D / 2, rl = Math.max(0.2, w - d);
  const E = [[cx - w, cu - d, he], [cx + w, cu - d, he], [cx + w, cu + d, he], [cx - w, cu + d, he]];
  const R0 = [cx - rl, cu, hr], R1 = [cx + rl, cu, hr];
  B.quad(mat, E[0], E[1], R1, R0); B.quad(mat, E[2], E[3], R0, R1);
  B.mesh(mat, [E[1], E[2], R1], [[0, 1, 2]]); B.mesh(mat, [E[3], E[0], R0], [[0, 1, 2]]);
}

/* =========================================================
   各構件
   ========================================================= */
// 明神鳥居：span 柱心距、H 笠木頂高
function torii(B, mat, span, H, r) {
  const k = H / 6;                                      // 以第二鳥居（高 6 公尺）為基準等比例
  [-span / 2, span / 2].forEach(x => {
    B.cyl(mat, x, 0, r, 0, H - 0.55 * k, 14, r * 0.92);
    B.cyl('stone', x, 0, r * 1.45, 0, 0.35 * k, 14, r * 1.25);      // 亀腹
  });
  const L = span + 3.4 * k, Ln = span + 2.6 * k;
  B.box(mat, 0, 0, Ln, 0.24 * k, H - 1.45 * k, H - 1.15 * k);         // 貫（第二鳥居照片：貫位置較高，約 0.76 H）
  B.box(mat, 0, 0, 0.35 * k, 0.2 * k, H - 1.15 * k, H - 0.55 * k);    // 額束
  B.box(mat, 0, 0, L - 0.4 * k, 0.32 * k, H - 0.55 * k, H - 0.3 * k); // 島木
  // 笠木：兩端起翹，分段組成
  const n = 16, y0 = H - 0.3 * k, t = 0.3 * k;
  for (let i = 0; i < n; i++) {
    const a = -L / 2 + L * i / n, b = a + L / n, m = (a + b) / 2;
    const s = Math.pow(Math.abs(m) / (L / 2), 3) * 0.32 * k;
    B.box(mat, m, 0, L / n + 0.02, 0.42 * k, y0 + s, y0 + s + t);
  }
}
function shimenawa(B, span, y) {
  // 注連繩（下垂）＋四條紙垂
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = -span / 2 + span * i / n, b = a + span / n, m = (a + b) / 2;
    const sag = 0.45 * (1 - Math.pow(m / (span / 2), 2));
    B.rod('dark', m, 0, y - sag, 0.07, span / n + 0.05);
  }
  [-0.6, -0.2, 0.2, 0.6].forEach(f => B.box('white', f * span / 2, 0, 0.12, 0.03, y - 0.45 - 0.5, y - 0.4));
}
// 石燈籠（石燈籠照片）：總高約 3.6 公尺
// 石燈籠：依第二鳥居旁石燈籠的老照片（三層基壇、鼓形腰竿、斗栱中台、刻五三桐紋的火袋、反翹笠、寶珠），總高約 3.6 公尺
const sq = (B, y0, y1, w0, w1) => {                   // 方形斷面的錐台（底寬 w0、頂寬 w1）
  const g = new THREE.CylinderGeometry(w1 / Math.SQRT2, w0 / Math.SQRT2, y1 - y0, 4, 1);
  g.rotateY(Math.PI / 4); g.translate(0, (y0 + y1) / 2, 0); B.add('stone', g);
};
function lantern(B, s = 1) {
  sq(B, 0, 0.32 * s, 2.3 * s, 2.2 * s);               // 基壇三層
  sq(B, 0.32 * s, 0.58 * s, 1.75 * s, 1.68 * s);
  sq(B, 0.58 * s, 0.88 * s, 1.4 * s, 1.34 * s);
  sq(B, 0.88 * s, 1.15 * s, 1.25 * s, 0.82 * s);       // 腰竿：下寬、中細、上略寬（鼓形）
  sq(B, 1.15 * s, 1.62 * s, 0.82 * s, 0.66 * s);
  sq(B, 1.62 * s, 1.95 * s, 0.66 * s, 0.78 * s);
  sq(B, 1.95 * s, 2.06 * s, 0.95 * s, 1.1 * s);        // 斗栱
  sq(B, 2.06 * s, 2.3 * s, 1.28 * s, 1.24 * s);        // 中台
  sq(B, 2.3 * s, 2.78 * s, 0.76 * s, 0.76 * s);        // 火袋
  B.box('dark', 0, 0, 0.5 * s, 0.78 * s, 2.4 * s, 2.68 * s);   // 火口／桐紋（示意）
  B.box('dark', 0, 0, 0.78 * s, 0.5 * s, 2.4 * s, 2.68 * s);
  sq(B, 2.78 * s, 2.86 * s, 1.95 * s, 1.95 * s);       // 笠：薄簷＋反翹
  sq(B, 2.86 * s, 3.12 * s, 1.85 * s, 0.55 * s);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => B.box('stone', a * 0.92 * s, c * 0.92 * s, 0.18 * s, 0.18 * s, 2.8 * s, 2.98 * s));   // 蕨手般的翹角
  sq(B, 3.12 * s, 3.24 * s, 0.4 * s, 0.32 * s);        // 請花
  B.cyl('stone', 0, 0, 0.17 * s, 3.24 * s, 3.56 * s, 10, 0.1 * s);   // 寶珠
  B.cyl('stone', 0, 0, 0.04 * s, 3.56 * s, 3.62 * s, 6, 0.02 * s);
}
function kasugaLantern(B) {
  B.box('stone', 0, 0, 0.6, 0.6, 0, 0.2);
  B.cyl('stone', 0, 0, 0.1, 0.2, 1.1, 8);
  B.box('stone', 0, 0, 0.45, 0.45, 1.1, 1.2);
  B.box('wood', 0, 0, 0.32, 0.32, 1.2, 1.55);
  B.cyl('stone', 0, 0, 0.42, 1.55, 1.8, 6, 0.08);
  B.cyl('stone', 0, 0, 0.06, 1.8, 1.95, 6);
}
// 狛犬台座：神門照片中為素面方台，連石獅約 1.8 公尺
export const KOMA_PED = 1.0;   // 銅馬合影照：台座頂約在人的肩部，約 1 公尺
function komainu(B, flip) {
  // 只建台座；石獅本身用忠義祠現存狛犬的 3D 掃描（main.js 載入 komainu-scan.glb）
  B.box('stone', 0, 0, 0.9, 1.1, 0, 0.18);
  B.box('stone', 0, 0, 0.72, 0.92, 0.18, 0.72);
  B.box('stone', 0, 0, 0.8, 1.0, 0.72, KOMA_PED);
}
// 圍牆一段：從 a 到 b（q 座標），type = 'tama'（屋根付玉垣）| 'sukibei'（透塀）| 'low'（低玉垣）
function fence(B, a, b, base, type) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ang = Math.atan2(dx, dy);
  // 局部：u 沿牆走向，x 為牆厚方向
  B.at(a[0], a[1], ang, base);
  if (type === 'low') {
    for (let u = 0; u <= L + 1e-6; u += 1.8) B.box('wood', 0, Math.min(u, L), 0.16, 0.16, 0, 1.05);
    B.box('wood', 0, L / 2, 0.08, L, 0.85, 0.95);
    B.box('wood', 0, L / 2, 0.08, L, 0.35, 0.43);
    return;
  }
  const tall = type === 'tama';
  const top = tall ? 1.3 : 1.75, sill = tall ? 0.3 : 0.4;   // 屋根付玉垣：神門照片反求，頂高約 1.7 公尺
  B.box('stone', 0, L / 2, 0.45, L + 0.45, 0, sill);
  for (let u = 0; u <= L + 1e-6; u += 1.8) B.box('wood', 0, Math.min(u, L), 0.2, 0.2, sill, top + 0.15);
  if (tall) for (let u = 0.12; u < L; u += 0.17) B.box('wood', 0, u, 0.05, 0.09, sill + 0.05, top);
  else B.box('dark', 0, L / 2, 0.06, L, sill + 0.3, top - 0.15);       // 透塀的格子面
  B.box('wood', 0, L / 2, 0.14, L + 0.1, top, top + 0.15);
  B.box('wood', 0, L / 2, 0.12, L, sill + 0.05, sill + 0.15);
  // 頂部小屋簷（兩坡）
  const w = tall ? 0.45 : 0.42, e = top + 0.15, r = top + (tall ? 0.42 : 0.45);
  B.quad(tall ? 'wood' : 'roof', [-w, -0.2, e], [-w, L + 0.2, e], [0, L + 0.2, r], [0, -0.2, r]);
  B.quad(tall ? 'wood' : 'roof', [w, L + 0.2, e], [w, -0.2, e], [0, -0.2, r], [0, L + 0.2, r]);
}
function steps(B, x, uFront, w, rise, n, tread = 0.32) {
  // 從 uFront 往 +u 升高
  for (let i = 0; i < n; i++) {
    const a = uFront + tread * i, b = uFront + tread * n;
    B.box('stone', x, (a + b) / 2, w, b - a, rise * i / n, rise * (i + 1) / n);
  }
}

/* =========================================================
   主程式
   ========================================================= */
export function buildShrine() {
  const B = new Builder();
  const P = p => warpH(p);                         // 配置圖座標 → q
  const AX = 0;                                    // 中軸 q.x

  /* ---- 地坪 ---- */
  B.at(0, 0);
  // 前庭（第二鳥居後到本殿區）：配置圖中的大平台（含社務所）
  // 前庭：1947 航照中為第二鳥居到內苑之間的帶狀空地，兩側是松林，故只鋪中軸兩側約 16 公尺
  const T1 = { x0: -16, x1: 16, y0: TORII2_Y - 0.4, y1: 30 };
  plat(B, T1, 0, LV.T1);
  // 內苑：屋根付玉垣以內
  const T2 = { x0: -13.1, x1: 13.1, y0: GATE_Y, y1: -1.0 + IN };   // 神門照片反求：轉角距中軸 13 公尺
  plat(B, T2, LV.T1, LV.T2);
  // 本殿區：透塀以內
  const T3 = { x0: -6.1, x1: 6.1, y0: -3.7 + IN, y1: 14.0 + IN };
  plat(B, T3, LV.T2, LV.T3);

  // 外參道（第一鳥居 → 第二鳥居）：依 1947 年航照描出的參拜道走向（見 APPROACH）
  const curve = approachCurve();
  const L = curve.getLength(), n = Math.ceil(L / 3);
  const pts = curve.getSpacedPoints(n).map(v => [v.x, v.z]);
  for (let i = 0; i < pts.length - 1; i++) strip(B, pts[i], pts[i + 1], 8, 0.02, 'gravel');
  B.at(0, 0); B.box('gravel', -2, TORII2_Y - 8.5, 30, 15, -0.03, 0.02);              // 第二鳥居前廣場
  // 石板參拜道（實測寬 3.01 公尺）
  strip(B, [AX, -71], [AX, TORII2_Y - 1.7], 3.01, 0.04, 'path');
  strip(B, [AX, TORII2_Y - 0.4], [AX, GATE_Y - 2.5], 3.01, LV.T1 + 0.03, 'path');
  strip(B, [AX, TORII2_Y - 0.4], [AX, GATE_Y - 2.5], 9, LV.T1 + 0.015, 'gravel');   // 航照中的帶狀亮區
  strip(B, [AX, GATE_Y + 1.5], [AX, -11.7 + IN], 3.01, LV.T2 + 0.03, 'path');

  /* ---- 第二鳥居（木造明神鳥居，高約 6 公尺，柱距 4 公尺）---- */
  B.begin('B2').at(AX, TORII2_Y, 0, LV.T1); torii(B, 'wood', 4.0, 6.0, 0.21); shimenawa(B, 4.0, 4.05); B.end();
  B.at(AX, TORII2_Y - 1.7, 0, 0); steps(B, 0, 0, 4.7, LV.T1, 3, 0.43);
  // 前庭外緣的低玉垣（鳥居照片中台階兩側）
  fence(B, [T1.x0, T1.y0], [-2.6, T1.y0], LV.T1, 'low');
  fence(B, [2.6, T1.y0], [T1.x1, T1.y0], LV.T1, 'low');

  /* ---- 第一鳥居（鋼筋水泥、洗石子）---- */
  {
    const b1 = APPROACH[0], t = curve.getTangentAt(0);
    B.begin('B1').at(b1[0], b1[1], Math.atan2(t.x, t.z), 0); torii(B, 'grey', 4.8, 7.0, 0.3); B.end();
  }

  /* ---- 石燈籠三對＋社號標、制札、下乘札、手水舍 ---- */
  // 石燈籠三對（「兩座鳥居前各一對」＋參道中途一對）：第一鳥居與中途的兩對沿 1947 航照參道對稱排列；
  // 第二鳥居前一對依羅偉源配置。
  const lanternPair = (ids, tt, off) => {
    const c = curve.getPointAt(tt), t = curve.getTangentAt(tt);
    ids.forEach((id, i) => { const s = i ? 1 : -1; B.begin(id).at(c.x - t.z * off * s, c.z + t.x * off * s, 0, 0); lantern(B); B.end(); });
  };
  lanternPair(['D3', 'D4'], 6 / L, 5.5);
  { const k = closestT(curve, P([-40.25, -6.3])); lanternPair(['D1', 'D2'], k, 5.5); }
  // 第二鳥居前一對：石燈籠照片中燈籠緊鄰鳥居外側、分立參道兩旁
  [['D5', -5.2], ['D6', 5.2]].forEach(([id, x]) => { B.begin(id).at(x, TORII2_Y - 5.5, 0, 0); lantern(B); B.end(); });
  { const q = [9.5, TORII2_Y - 9.5]; B.begin('G').at(q[0], q[1], 0, 0);   // 社號標：石燈籠照片中在東側燈籠前方
    B.box('stone', 0, 0, 1.15, 1.15, 0, 0.3); B.box('stone', 0, 0, 0.85, 0.85, 0.3, 0.6); B.box('stone', 0, 0, 0.46, 0.46, 0.6, 3.8); B.end(); }
  { const q = P([4.2, -20.9]); B.begin('E').at(q[0], q[1] + OUT, 0, 0);
    B.box('wood', -1.0, 0, 0.14, 0.14, 0, 2.1); B.box('wood', 1.0, 0, 0.14, 0.14, 0, 2.1);
    B.box('dark', 0, 0, 2.2, 0.06, 0.9, 1.9); kirizuma(B, 0, 0, 2.7, 0.45, 0.45, 2.05, 2.45); B.end(); }
  { const q = P([6.43, -20.79]); B.begin('F').at(q[0], q[1] + OUT, 0, 0);
    B.box('wood', 0, 0, 0.14, 0.14, 0, 1.8); B.box('white', 0, -0.1, 0.4, 0.04, 0.9, 1.75); B.end(); }
  // 手水舍（位置推估：石燈籠照片中在鳥居內側）
  B.begin('W').at(-8.0, TORII2_Y + 5.6, Math.PI / 2, LV.T1);
  [[-1.1, -0.75], [1.1, -0.75], [1.1, 0.75], [-1.1, 0.75]].forEach(([x, u]) => B.box('wood', x, u, 0.18, 0.18, 0, 2.3));
  B.box('stone', 0, 0, 1.4, 0.7, 0, 0.75);
  irimoya(B, 0, 0, 3.4, 2.7, 2.3, 2.75, 3.4, 0.15);
  B.end();

  /* ---- 社務所 ---- */
  // 社務所：位置依 1947 航照；外觀依校史館照片（民國 61 年合影、畢業紀念冊彩色照，民國 69 年拆除）
  // 平房、寄棟黑瓦，外牆淡色、壁面有規則分格、深色腰牆；鐵窗外有小雨庇；
  // 入口為唐破風玄關。尺寸以合影人身高約 1.65 公尺推估。
  // 照片為戰後修復上色，顏色改以和風神社配色統一：白漆喰牆、白木柱、深色腰板、黑瓦、銅板葺玄關。
  // 長邊沿中軸方向、玄關朝參道（西側）。
  { const q = [37.8, -51.4]; B.begin('H').at(q[0], q[1], Math.PI / 2, 0); office(B); B.end(); }
  // 宿舍（1947 航照簡報標示位置；外觀推估）
  B.begin('H2').at(57.1, -50.3, 0, 0);
  B.box('stone', 0, 0, 10.4, 7.4, 0, 0.45); B.box('wood', 0, 0, 10, 7, 0.45, 3.0);
  yosemune(B, 0, 0, 11.4, 8.4, 2.9, 5.0); B.end();

  /* ---- 神門（四脚門、切妻造）＋狛犬 ---- */
  // 神門照片反求（以拜殿正面照定出的拜殿尺寸為比例尺）：屋頂寬約 7.1、簷高 2.75、屋脊 4.4 公尺
  B.begin('N').at(AX, GATE_Y, 0, LV.T2);
  B.box('stone', 0, 0, 6.0, 3.0, -0.4, 0);                // 門下石敷
  B.box('stone', 0, -2.0, 4.6, 1.0, -0.4, -0.2);          // 前台階
  [-1.55, 1.55].forEach(x => {
    B.cyl('wood', x, 0, 0.18, 0, 2.55, 12);                // 本柱
    [-0.95, 0.95].forEach(u => B.box('wood', x, u, 0.18, 0.18, 0, 2.35));   // 控柱
    B.box('dark', x + Math.sign(x) * 0.75, 0, 1.35, 0.08, 0.1, 2.25);      // 兩側門扉／板壁
  });
  B.box('wood', 0, 0, 6.0, 0.24, 2.25, 2.55);  // 冠木
  B.box('white', 0, -0.15, 3.0, 0.03, 1.7, 2.22);  // 神紋幕（銅馬合影照：神門下掛有桐紋幕）
  B.box('dark', 0, 0, 5.4, 2.4, 2.55, 2.8);    // 斗栱帶
  kirizuma(B, 0, 0, 7.1, 3.0, 3.0, 2.75, 4.3, true, 0.15);
  B.end();
  KOMA_POS.forEach(([x, y], i) => { B.begin('K').at(x, y, 0, LV.T1); komainu(B, i ? 1 : -1); B.end(); });

  /* ---- 屋根付玉垣（內苑四周）＋透塀（本殿四周）---- */
  fence(B, [T2.x0, T2.y0], [-2.4, T2.y0], LV.T2, 'tama');
  fence(B, [2.4, T2.y0], [T2.x1, T2.y0], LV.T2, 'tama');
  fence(B, [T2.x1, T2.y0], [T2.x1, T2.y1], LV.T2, 'tama');
  fence(B, [T2.x0, T2.y1], [T2.x0, T2.y0], LV.T2, 'tama');
  fence(B, [T2.x1, T2.y1], [T3.x1, T2.y1], LV.T2, 'tama');
  fence(B, [T3.x0, T2.y1], [T2.x0, T2.y1], LV.T2, 'tama');
  fence(B, [T3.x1, T3.y0], [T3.x1, T3.y1], LV.T3, 'sukibei');
  fence(B, [T3.x1, T3.y1], [T3.x0, T3.y1], LV.T3, 'sukibei');
  fence(B, [T3.x0, T3.y1], [T3.x0, T3.y0], LV.T3, 'sukibei');

  /* ---- 拜殿（入母屋造、檜皮葺，左右附翼）---- */
  B.begin('P').at(AX, -6.7 + IN, 0, LV.T2);
  const F = 1.0;                                            // 地板高（拜殿正面照：台階約 1 公尺）
  B.box('stone', 0, 0, 14.6, 7.2, 0, 0.75);                 // 基壇
  B.box('wood', 0, 0, 14.0, 6.6, 0.75, F);                  // 木地板
  steps(B, 0, -4.93, 6.0, F, 5, 0.33);                      // 正面石階（正面照反求）
  // 正面照（自神門往拜殿，鎮座祭；參拜道 3.01 公尺為比例尺）以相機＋尺寸聯合反求，22 個對應點誤差約 5 像素：
  // 中央間 2.76、柱列 ±1.38／±3.03／±4.2、柱高 2.66、主屋頂簷寬 12.4、連兩翼簷寬 15.9、
  // 主簷角 4.5、翼簷角 3.7、屋脊頂 7.2 公尺（自內苑地面）
  const CH = 2.66;
  const colX = [-4.2, -3.03, -1.38, 1.38, 3.03, 4.2], rowU = [-3.0, 0, 3.0];
  colX.forEach(x => rowU.forEach(u => B.cyl('wood', x, u, 0.16, F, F + CH, 10)));
  [-6.8, 6.8].forEach(x => rowU.forEach(u => B.box('wood', x, u, 0.22, 0.22, F, F + 2.2)));
  // 兩翼：格子壁
  [-1, 1].forEach(s => {
    B.box('dark', s * 5.5, -3.0, 2.6, 0.08, F + 0.1, F + 2.1);
    B.box('dark', s * 6.8, 0, 0.08, 6.0, F + 0.1, F + 2.1);
    B.box('dark', s * 5.5, 3.0, 2.6, 0.08, F + 0.1, F + 2.1);
    B.box('dark', s * 2.8, 3.0, 2.8, 0.08, F + 0.1, F + 2.5);
    B.box('wood', s * 5.5, -3.0, 2.6, 0.1, F + 1.25, F + 1.35);      // 翼部長押   // 主體背面板壁（中間開口通幣殿）
  });
  B.box('wood', 0, -3.0, 13.8, 0.24, F + CH - 0.4, F + CH - 0.15);   // 正面虹梁（頭貫）
  B.box('wood', 0, -3.05, 8.6, 0.12, F + 1.95, F + 2.05);             // 內法長押（幕串）
  B.box('white', 0, -3.1, 8.3, 0.03, F + 1.45, F + 1.95);             // 神紋幕（鎮座祭）
  B.box('dark', 0, 0, 8.8, 6.4, F + CH, F + CH + 0.4);                // 斗栱帶
  [-4.2, -2.1, 0, 2.1, 4.2].forEach(x => B.box('wood', x, -3.15, 0.3, 0.3, F + CH, F + CH + 0.35));   // 斗栱（正面可見）
  irimoya(B, 0, 0, 12.4, 9.0, 4.04, 5.1, 6.9, 0.55);
  // 兩翼屋頂：屋脊沿 x、外端小山牆（正面照可見翼端鬼瓦），內側收在主屋頂下
  [-1, 1].forEach(s => {
    const xi = s * 3.9, xg = s * 7.5, xo = s * 7.95, ue = 4.4, he = 3.36, hm = 4.15, hr = 4.7, ug = ue * (1 - (hm - he) / (hr - he));
    B.mesh('roof', [[xi, -ue, he], [xo, -ue, he + 0.3], [xg, -ug, hm], [xg, 0, hr], [xi, 0, hr]], [[0, 1, 2], [0, 2, 4], [2, 3, 4]]);
    B.mesh('roof', [[xi, ue, he], [xo, ue, he + 0.3], [xg, ug, hm], [xg, 0, hr], [xi, 0, hr]], [[0, 2, 1], [0, 4, 2], [2, 4, 3]]);
    B.quad('roof', [xo, -ue, he + 0.3], [xo, ue, he + 0.3], [xg, ug, hm], [xg, -ug, hm]);
    B.mesh('dark', [[xg, -ug, hm], [xg, ug, hm], [xg, 0, hr]], [[0, 1, 2]]);
    B.box('roof', (xi + xg) / 2, 0, Math.abs(xg - xi), 0.35, hr - 0.05, hr + 0.25);
    B.box('dark', xg + s * 0.1, 0, 0.2, 0.45, hr - 0.1, hr + 0.45);
    B.box('dark', (xi + xo) / 2, -ue, Math.abs(xo - xi), 0.1, he - 0.25, he);
    B.box('dark', (xi + xo) / 2, ue, Math.abs(xo - xi), 0.1, he - 0.25, he);
  });
  B.end();
  // 春日燈籠（神門照片：拜殿台階旁）
  [-2.6, 2.6].forEach(x => { B.at(x, -12.2 + IN, 0, LV.T2); kasugaLantern(B); });   // 神門照片反求

  /* ---- 幣殿（連接拜殿與本殿，內部照片中可見）---- */
  B.begin('Pd').at(AX, -0.8 + IN, 0, LV.T3);
  const Fd = LV.T2 + F - LV.T3;                             // 與拜殿同高的地板
  B.box('stone', 0, 0, 4.8, 5.8, 0, Fd - 0.2);
  B.box('wood', 0, 0, 4.6, 5.8, Fd - 0.2, Fd);
  [-2.0, 2.0].forEach(x => [-2.9, 0, 2.9].forEach(u => B.cyl('wood', x, u, 0.14, Fd, Fd + 2.6, 10)));
  [-2.0, 2.0].forEach(x => B.box('dark', x, 0, 0.06, 5.8, Fd + 0.1, Fd + 0.8));    // 低欄
  B.box('dark', 0, 0, 4.4, 6.0, Fd + 2.6, Fd + 2.85);
  kirizuma(B, 0, 0, 6.6, 3.0, 3.0, Fd + 2.85, Fd + 4.3, false);
  B.end();

  /* ---- 本殿（流造、千木・鰹木，高床）---- */
  B.begin('Q').at(AX, 6.65 + IN, 0, LV.T3);
  const Fh = 1.9;                                            // 本殿側面照：巫女站立的濡緣高
  B.box('stone', 0, 0, 5.8, 5.4, 0, 0.5);                   // 石基壇
  for (const x of [-2.55, -1.3, 0, 1.3, 2.55]) for (const u of [-2.35, 2.35]) B.box('wood', x, u, 0.2, 0.2, 0.5, Fh);
  for (const u of [-1.2, 0, 1.2]) for (const x of [-2.55, 2.55]) B.box('wood', x, u, 0.2, 0.2, 0.5, Fh);
  B.box('wood', 0, 0, 5.4, 5.0, Fh - 0.15, Fh);             // 濡緣
  B.box('wood', 0, 0, 3.6, 3.0, Fh, Fh + 2.3);              // 身舍
  B.box('dark', 0, -1.52, 1.4, 0.05, Fh + 0.1, Fh + 2.0);  // 正面門扉
  // ---- 以下依本殿歷史照片（巫女立於濡緣，身高約 1.5 公尺為比例）----
  // 高欄：濡緣三面，親柱＋上下橫木＋擬寶珠
  const rail = (x0, u0, x1, u1) => {
    const L = Math.hypot(x1 - x0, u1 - u0), n = Math.max(1, Math.round(L / 0.9));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, u = u0 + (u1 - u0) * i / n; B.box('wood', x, u, 0.1, 0.1, Fh, Fh + 0.85); }
    const cx = (x0 + x1) / 2, cu = (u0 + u1) / 2, w = Math.abs(x1 - x0) + 0.08, d = Math.abs(u1 - u0) + 0.08;
    B.box('wood', cx, cu, w, d, Fh + 0.78, Fh + 0.88);          // 架木
    B.box('wood', cx, cu, w, d, Fh + 0.42, Fh + 0.5);           // 平桁
    B.box('wood', cx, cu, w, d, Fh + 0.05, Fh + 0.13);          // 地覆
  };
  rail(-2.65, -2.45, -0.9, -2.45); rail(0.9, -2.45, 2.65, -2.45);
  rail(-2.65, -2.45, -2.65, 2.45); rail(2.65, -2.45, 2.65, 2.45);
  [[-0.9, -2.45], [0.9, -2.45]].forEach(([x, u]) => B.cyl('bronze', x, u, 0.07, Fh + 0.88, Fh + 1.05, 8, 0.03));   // 擬寶珠
  // 身舍：板壁、柱、長押
  [[-1.8, -1.5], [1.8, -1.5], [-1.8, 1.5], [1.8, 1.5], [0, -1.5]].forEach(([x, u]) => B.cyl('wood', x, u, 0.13, Fh, Fh + 2.35, 10));
  B.box('wood', 0, -1.52, 3.7, 0.12, Fh + 1.75, Fh + 1.88);    // 長押
  B.box('wood', 0, -1.52, 3.7, 0.12, Fh + 2.2, Fh + 2.35);     // 頭貫
  // 正面木階＋登高欄（從幣殿地板升到濡緣）
  for (let i = 0; i < 7; i++) {
    const y0 = Fd + (Fh - Fd) * i / 7, y1 = Fd + (Fh - Fd) * (i + 1) / 7;
    B.box('wood', 0, -2.5 - 0.27 * (7 - i) + 0.135, 1.6, 0.27, y0, y1);
  }
  [-0.85, 0.85].forEach(x => {
    const g = new THREE.BoxGeometry(0.08, 0.08, 2.1); g.rotateX(-Math.atan2(Fh - Fd, 1.9)); g.translate(x, (Fd + Fh) / 2 + 0.85, 3.45); B.add('wood', g);
    B.box('wood', x, -4.4, 0.12, 0.12, Fd, Fd + 0.95);
  });
  // 向拜柱：流造前簷延伸蓋過木階，由兩根角柱支撐
  const ue = -4.75, heF = Fh + 1.55;
  [-1.35, 1.35].forEach(x => { B.box('wood', x, ue + 0.35, 0.22, 0.22, Fd - 0.2, heF - 0.15); B.box('wood', x, ue + 0.35, 0.3, 0.3, Fd - 0.3, Fd - 0.1); });
  B.box('wood', 0, ue + 0.35, 3.1, 0.24, heF - 0.45, heF - 0.15);     // 向拜虹梁
  [-1.35, 1.35].forEach(x => B.box('wood', x, (ue + 0.35 - 1.5) / 2, 0.16, Math.abs(ue + 0.35 + 1.5), heF - 0.35, heF - 0.15));   // 手挾（海老虹梁）
  // 屋頂：流造。前坡長而反曲（凹弧）、延伸到向拜；後坡短。檜皮葺，簷口厚約 0.35 公尺
  const W = 3.15, ur = 0.3, hr = Fh + 4.3, ub = 2.75, heB = Fh + 2.3, T = 0.35, N = 10;
  const prof = (u0, h0, n) => Array.from({ length: n + 1 }, (_, i) => { const s = i / n; return [ur + (u0 - ur) * s, hr - (hr - h0) * Math.pow(s, 0.72)]; });
  const front = prof(ue, heF, N), back = prof(ub, heB, 6);
  for (const P of [front, back]) {
    for (let i = 0; i < P.length - 1; i++) {
      const [ua, ya] = P[i], [ub2, yb] = P[i + 1];
      const lift = i === P.length - 2 ? 0.12 : 0;       // 簷端微反
      B.quad('roof', [-W, ua, ya], [W, ua, ya], [W, ub2, yb + lift], [-W, ub2, yb + lift]);
      B.quad('dark', [-W + 0.2, ua, ya - T], [W - 0.2, ua, ya - T], [W - 0.2, ub2, yb - T + lift], [-W + 0.2, ub2, yb - T + lift]);   // 軒裏
      [-W, W].forEach(x => B.quad('wood', [x, ua, ya + 0.05], [x, ub2, yb + 0.05 + lift], [x, ub2, yb - T - 0.05 + lift], [x, ua, ya - T - 0.05]));   // 破風板
    }
    const [ul, yl] = P[P.length - 1];
    B.quad('wood', [-W, ul, yl + 0.12], [W, ul, yl + 0.12], [W, ul, yl - T + 0.12], [-W, ul, yl - T + 0.12]);   // 簷口（淡色檜皮斷面）
    // 垂木（軒裏的白色木口列）
    for (let x = -W + 0.25; x < W; x += 0.32) B.box('white', x, ul + (ul < 0 ? 0.25 : -0.25), 0.1, 0.1, yl - T - 0.02, yl - T + 0.08);
  }
  // 山牆（妻）：板壁三角
  [-1.85, 1.85].forEach(x => B.mesh('wood', [[x, -1.5, Fh + 2.35], [x, ur, hr - 0.4], [x, 1.5, Fh + 2.35]], [[0, 1, 2]]));
  B.box('roof', 0, ur, 2 * W + 0.3, 0.55, hr - 0.1, hr + 0.3);           // 箱棟
  // 千木（兩端交叉，外削）與鰹木 6 根（歷史照片可數）
  [-W, W].forEach(x => {
    const g1 = new THREE.BoxGeometry(0.12, 2.0, 0.24); g1.rotateX(0.62); g1.translate(x, hr + 0.55, ur + 0.42); B.add('wood', g1);
    const g2 = new THREE.BoxGeometry(0.12, 2.0, 0.24); g2.rotateX(-0.62); g2.translate(x, hr + 0.55, ur - 0.42); B.add('wood', g2);
  });
  [-2.25, -1.35, -0.45, 0.45, 1.35, 2.25].forEach(x => { B.rod('wood', x, ur, hr + 0.48, 0.17, 1.1, false, 10); B.box('dark', x, ur, 0.12, 0.3, hr + 0.25, hr + 0.35); });
  B.end();

  /* ---- 材質 ---- */
  const mats = {};
  for (const [k, c] of Object.entries(COLORS)) mats[k] = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
  mats.path = new THREE.MeshLambertMaterial({ map: slabTexture(), side: THREE.DoubleSide });
  const group = B.build(mats);
  return { group, boxes: B.boxes, mats: Object.values(mats) };
}

// 1947 年航照（簡報《壢中簡史與中壢神社》中的航照，比例尺 50 公尺）描出的參拜道中心線。
// 航照以兩點對位：陶然亭 ↔ 拜殿位置、南大門舊址 ↔ 第一鳥居（約 0.31 公尺／像素，
// 檢查點「熱食部門口」對位誤差約 1 公尺）。參道從中正路的第一鳥居向東北，
// 中段略向東弧出，約在拜殿前 70 公尺處接上神社中軸，再直行到第二鳥居。
const NANDAMEN = [24.961157, 121.208661];
const AIR_PX = [[850, 1195], [835, 1150], [830, 1000], [850, 900], [885, 800], [897, 700], [885, 620], [860, 590]];
let APPROACH = null;
function approachCurve() {
  const a = [650, 600], qb = llToQ(...NANDAMEN);
  const za = { re: 850 - a[0], im: -(1195 - a[1]) };
  const d2 = za.re * za.re + za.im * za.im;
  const k = { re: (qb[0] * za.re + qb[1] * za.im) / d2, im: (qb[1] * za.re - qb[0] * za.im) / d2 };
  const toQ = ([x, y]) => { const re = x - a[0], im = -(y - a[1]); return [k.re * re - k.im * im, k.re * im + k.im * re]; };
  APPROACH = AIR_PX.map(toQ);
  APPROACH.push([-1.5, -69.5], [0, -69.5]);           // 接上中軸（第二鳥居前廣場）
  return new THREE.CatmullRomCurve3(APPROACH.map(([x, y]) => new THREE.Vector3(x, 0, y)), false, 'centripetal');
}
function closestT(curve, [x, y]) {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 400; i++) { const p = curve.getPointAt(i / 400), d = (p.x - x) ** 2 + (p.z - y) ** 2; if (d < bd) { bd = d; best = i / 400; } }
  return best;
}

// 社務所（局部座標：x 沿長邊 15 公尺，u 為進深 9 公尺，-u 為正面／玄關側）
function office(B) {
  const L = 15, D = 9, F = 0.55, E = 3.35;               // 長、深、地板高、簷高
  B.box('brown', 0, 0, L, D, 0, F + 0.35);                 // 基礎＋腰牆（深色）
  B.box('plaster', 0, 0, L - 0.04, D - 0.04, F + 0.35, E);  // 外牆
  // 壁面分格：直向壁柱＋一道橫帶
  for (let x = -L / 2; x <= L / 2 + 1e-6; x += 1.25) { B.box('wood', x, -D / 2, 0.12, 0.08, F + 0.35, E); B.box('wood', x, D / 2, 0.12, 0.08, F + 0.35, E); }
  for (let u = -D / 2; u <= D / 2 + 1e-6; u += 1.25) { B.box('wood', -L / 2, u, 0.08, 0.12, F + 0.35, E); B.box('wood', L / 2, u, 0.08, 0.12, F + 0.35, E); }
  [-D / 2, D / 2].forEach(u => B.box('brown', 0, u, L + 0.05, 0.1, F + 0.3, F + 0.4));
  // 鐵窗（灰藍窗格）＋小雨庇
  const win = (x, u, alongX) => {
    const w = 1.8, y0 = F + 0.95, y1 = F + 2.35;
    if (alongX) {
      B.box('sash', x, u, w, 0.1, y0, y1);
      for (let k = -2; k <= 2; k++) B.box('dark', x + k * w / 5, u + Math.sign(u) * 0.06, 0.04, 0.04, y0, y1);
      B.box('sash', x, u + Math.sign(u) * 0.3, w + 0.3, 0.6, y1 + 0.15, y1 + 0.2);    // 雨庇
    } else {
      B.box('sash', x, u, 0.1, w, y0, y1);
      for (let k = -2; k <= 2; k++) B.box('dark', x + Math.sign(x) * 0.06, u + k * w / 5, 0.04, 0.04, y0, y1);
      B.box('sash', x + Math.sign(x) * 0.3, u, 0.6, w + 0.3, y1 + 0.15, y1 + 0.2);
    }
  };
  [-5.5, -2.8, 4.8].forEach(x => win(x, -D / 2 - 0.03, true));
  [-5, -1.5, 2, 5].forEach(x => win(x, D / 2 + 0.03, true));
  [-2, 2].forEach(u => { win(-L / 2 - 0.03, u, false); win(L / 2 + 0.03, u, false); });
  // 寄棟黑瓦屋頂（出簷 0.8）
  yosemune(B, 0, 0, L + 1.6, D + 1.6, E - 0.05, E + 2.7, 'tile');
  B.box('tile', 0, 0, L + 1.6 - D - 1.6 + 0.3, 0.3, E + 2.6, E + 2.85);
  // 唐破風玄關：寬 4.2、出 2.6 公尺，白色雙柱
  const px = 1.6, pw = 4.2, pd = 2.6, pu0 = -D / 2 - pd;
  B.box('stone', px, pu0 + pd / 2, pw + 0.4, pd + 0.2, 0, F - 0.15);          // 玄關土間
  B.box('stone', px, pu0 - 0.3, pw - 0.6, 0.6, 0, (F - 0.15) / 2);           // 台階
  [-1, 1].forEach(sx => { B.cyl('wood', px + sx * (pw / 2 - 0.25), pu0 + 0.25, 0.16, F - 0.15, 3.05, 12); B.box('wood', px + sx * (pw / 2 - 0.25), pu0 + 0.25, 0.42, 0.42, 2.95, 3.15); });
  B.box('wood', px, pu0 + 0.25, pw - 0.3, 0.22, 2.75, 2.95);                 // 虹梁
  B.box('dark', px, -D / 2 - 0.05, 1.8, 0.1, F, F + 2.3);                    // 入口門
  // 唐破風屋頂：橫向斷面中央隆起、兩端反翹，沿進深拉出
  const n = 16, W = pw + 1.0, he = 3.15, rise = 1.1;
  const hAt = t => he + rise * Math.pow(Math.cos(t * Math.PI / 2), 2) - 0.25 * t * t + 0.35 * Math.pow(t, 6);
  const uf = pu0 - 0.4, ub = -D / 2 + 0.6;
  for (let i = 0; i < n; i++) {
    const t0 = -1 + 2 * i / n, t1 = -1 + 2 * (i + 1) / n, x0 = px + t0 * W / 2, x1 = px + t1 * W / 2;
    const y0 = hAt(Math.abs(t0)), y1 = hAt(Math.abs(t1));
    B.quad('copper', [x0, uf, y0 + 0.25], [x1, uf, y1 + 0.25], [x1, ub, y1 + 0.25], [x0, ub, y0 + 0.25]);   // 屋面
    B.quad('wood', [x0, uf, y0], [x1, uf, y1], [x1, uf, y1 + 0.25], [x0, uf, y0 + 0.25]);                  // 唐破風板（白木）
    B.quad('dark', [x0, uf + 0.05, he - 0.15], [x1, uf + 0.05, he - 0.15], [x1, uf + 0.05, y1], [x0, uf + 0.05, y0]);   // 破風內側
  }
}

// 平台：外圍石砌擋土＋頂面砂利
function plat(B, r, y0, y1) {
  B.at(0, 0);
  const w = r.x1 - r.x0, d = r.y1 - r.y0, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  B.box('stone', cx, cy, w, d, y0 - 0.05, y1 - 0.03);
  B.box('gravel', cx, cy, w - 0.1, d - 0.1, y1 - 0.03, y1);
}
// 帶狀鋪面（石板道或砂利道）：a→b，寬 w，頂高 y
function strip(B, a, b, w, y, mat) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  B.at(a[0], a[1], Math.atan2(dx, dy), 0);
  if (mat === 'path') {
    // 石板 38×78 公分：UV 以公尺計，貼圖一格 = 0.76 × 0.78 公尺（兩塊並排）
    const g = new THREE.BoxGeometry(w, 0.06, L);
    g.translate(0, y - 0.03, -L / 2);
    const uv = g.attributes.uv, P = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) / 0.76, P.getZ(i) / 0.78);
    B.add('path', g);
  } else B.box(mat, 0, L / 2, w, L + w * 0.3, y - 0.05, y);
}
function slabTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#cdc7b6'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#9d9684'; x.lineWidth = 2;
  x.strokeRect(1, 1, 31, 62); x.strokeRect(33, 1, 30, 62);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
