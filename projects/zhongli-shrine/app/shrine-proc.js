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
const IN = GATE_Y + 28.2;             // 內苑各構件相對於舊配置的位移（神門照片反求時神門在 −28.2）
export const TORII2_Y = -64.0;        // 第二鳥居
const OUT = TORII2_Y + 56.6;          // 第二鳥居一帶（燈籠、社號標等）相對舊配置的位移

export const DIMS = {
  B1: '形式依簡報照片（鋼筋水泥、洗石子）；尺寸參考第二鳥居放大推估，待查',
  B2: '依鎮座祭鳥居照片：以台階與人身高為比例，柱距約 4 公尺',
  N: '依神門與狛犬照片反求（以拜殿尺寸為比例尺，同時解出拍攝位置）；神門到拜殿約 21 公尺',
  P: '依拜殿正面照：以參拜道實測寬 3.01 公尺（約 8 塊石板）為比例；深度依神門照片',
  Q: '依本殿側面照：以巫女身高約 1.5 公尺為比例',
  D6: '依石燈籠照片：三層台座、竿、中台、火袋、笠、寶珠',
  H: '位置依配置圖（為讓出神門照片的拍攝點略後移）；外觀依石燈籠照片背景',
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
  B.box(mat, 0, 0, Ln, 0.24 * k, H - 1.8 * k, H - 1.45 * k);          // 貫
  B.box(mat, 0, 0, 0.35 * k, 0.2 * k, H - 1.45 * k, H - 0.55 * k);    // 額束
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
function lantern(B, s = 1) {
  B.box('stone', 0, 0, 1.6 * s, 1.6 * s, 0, 0.35 * s);
  B.box('stone', 0, 0, 1.25 * s, 1.25 * s, 0.35 * s, 0.65 * s);
  B.box('stone', 0, 0, 0.95 * s, 0.95 * s, 0.65 * s, 0.95 * s);
  B.cyl('stone', 0, 0, 0.36 * s, 0.95 * s, 1.55 * s, 10, 0.24 * s);
  B.cyl('stone', 0, 0, 0.24 * s, 1.55 * s, 2.15 * s, 10, 0.36 * s);
  B.box('stone', 0, 0, 0.9 * s, 0.9 * s, 2.15 * s, 2.4 * s);
  B.box('stone', 0, 0, 0.62 * s, 0.62 * s, 2.4 * s, 2.95 * s);
  B.cyl('stone', 0, 0, 0.95 * s, 2.95 * s, 3.3 * s, 4, 0.25 * s);   // 笠（四角錐）
  B.cyl('stone', 0, 0, 0.13 * s, 3.3 * s, 3.62 * s, 8, 0.06 * s);
}
function kasugaLantern(B) {
  B.box('stone', 0, 0, 0.6, 0.6, 0, 0.2);
  B.cyl('stone', 0, 0, 0.1, 0.2, 1.1, 8);
  B.box('stone', 0, 0, 0.45, 0.45, 1.1, 1.2);
  B.box('wood', 0, 0, 0.32, 0.32, 1.2, 1.55);
  B.cyl('stone', 0, 0, 0.42, 1.55, 1.8, 6, 0.08);
  B.cyl('stone', 0, 0, 0.06, 1.8, 1.95, 6);
}
// 狛犬（簡化造形）：神門照片反求，連台座約 1.7 公尺
function komainu(B, flip) {
  B.box('stone', 0, 0, 0.85, 0.85, 0, 0.2);
  B.box('stone', 0, 0, 0.68, 0.68, 0.2, 0.92);
  B.box('stone', 0, 0, 0.76, 0.76, 0.92, 1.0);
  B.box('stone', 0, 0.1, 0.36, 0.46, 1.0, 1.26);            // 後腿坐姿
  B.box('stone', 0, -0.1, 0.3, 0.26, 1.0, 1.52);            // 胸與前腳
  B.box('stone', 0, -0.15, 0.32, 0.3, 1.44, 1.68);          // 頭
  B.box('stone', flip * 0.04, 0.3, 0.12, 0.12, 1.24, 1.52); // 尾
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
  const T1 = { x0: -18.6, x1: 50, y0: TORII2_Y - 0.4, y1: 36 };
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
  for (const [id, p] of Object.entries({ D5: [1.22, -22.52], D6: [15.62, -22.32] })) { const q = P(p); B.begin(id).at(q[0], q[1] + OUT, 0, 0); lantern(B); B.end(); }
  { const q = P([13.2, -20.7]); B.begin('G').at(q[0], q[1] + OUT, 0, 0);
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
  // 社務所：1947 航照（簡報標示位置）
  { const q = [37.8, -51.4]; B.begin('H').at(q[0], q[1], 0, LV.T1);
    B.box('stone', 0, 0, 13.4, 9.4, 0, 0.45);
    B.box('wood', 0, 0, 13, 9, 0.45, 3.1);
    B.box('dark', 0, -4.52, 11, 0.06, 1.0, 2.6);
    yosemune(B, 0, 0, 14.6, 10.6, 3.0, 5.6); B.end(); }
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
  B.box('dark', 0, 0, 5.4, 2.4, 2.55, 2.8);    // 斗栱帶
  kirizuma(B, 0, 0, 7.1, 3.0, 3.0, 2.75, 4.3, true, 0.15);
  B.end();
  [-3.2, 3.2].forEach((x, i) => { B.begin('K').at(x, GATE_Y - 4.3, 0, LV.T1); komainu(B, i ? 1 : -1); B.end(); });

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
  steps(B, 0, -5.2, 5.9, F, 5, 0.36);                       // 正面石階
  // 正面照（參拜道 3.01 公尺＝約 8 塊石板；推得相機距台階約 22 公尺）：
  // 中央間 2.8、主體 8.2、主屋頂簷寬 12.0、連兩翼簷寬 15.3、柱高 2.4、主簷 4.0、翼簷 3.4、屋脊 7.3 公尺
  const colX = [-4.1, -2.95, -1.4, 1.4, 2.95, 4.1], rowU = [-3.0, 0, 3.0];
  colX.forEach(x => rowU.forEach(u => B.cyl('wood', x, u, 0.15, F, F + 2.4, 10)));
  [-6.6, 6.6].forEach(x => rowU.forEach(u => B.box('wood', x, u, 0.22, 0.22, F, F + 2.1)));
  // 兩翼：格子壁
  [-1, 1].forEach(s => {
    B.box('dark', s * 5.35, -3.0, 2.5, 0.08, F + 0.1, F + 2.0);
    B.box('dark', s * 6.6, 0, 0.08, 6.0, F + 0.1, F + 2.0);
    B.box('dark', s * 5.35, 3.0, 2.5, 0.08, F + 0.1, F + 2.0);
    B.box('dark', s * 2.75, 3.0, 2.7, 0.08, F + 0.1, F + 2.3);   // 主體背面板壁（中間開口通幣殿）
  });
  B.box('wood', 0, -3.0, 13.4, 0.24, F + 2.05, F + 2.3);   // 正面虹梁
  B.box('dark', 0, 0, 8.6, 6.4, F + 2.4, F + 2.8);          // 斗栱帶
  B.box('wood', 0, -1.4, 2.2, 0.06, F + 2.5, F + 2.75);     // 扁額位置
  irimoya(B, 0, 0, 12.0, 9.0, 4.0, 5.25, 7.3, 0.5);
  // 兩翼屋頂：屋脊沿 x、外端小山牆（正面照可見翼端鬼瓦），內側收在主屋頂下
  [-1, 1].forEach(s => {
    const xi = s * 3.9, xg = s * 7.2, xo = s * 7.65, ue = 4.4, he = 3.4, hm = 4.2, hr = 4.75, ug = ue * (1 - (hm - he) / (hr - he));
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
  // 高欄
  [[0, -2.45, 5.4, 0.08], [0, 2.45, 5.4, 0.08], [-2.65, 0, 0.08, 5.0], [2.65, 0, 0.08, 5.0]].forEach(([x, u, w, d]) => {
    if (u === -2.45) { B.box('wood', -1.75, u, 1.9, d, Fh + 0.7, Fh + 0.8); B.box('wood', 1.75, u, 1.9, d, Fh + 0.7, Fh + 0.8); }
    else B.box('wood', x, u, w, d, Fh + 0.7, Fh + 0.8);
  });
  // 正面木階：從幣殿地板升到濡緣
  for (let i = 0; i < 7; i++) {
    const y0 = Fd + (Fh - Fd) * i / 7, y1 = Fd + (Fh - Fd) * (i + 1) / 7;
    B.box('wood', 0, -2.5 - 0.27 * (7 - i) + 0.135, 1.6, 0.27, y0, y1);
  }
  [-0.85, 0.85].forEach(x => B.box('wood', x, -3.45, 0.08, 2.0, Fd + 0.5, Fh + 0.75));
  // 屋頂：前簷較深（流造），屋脊沿 x
  kirizuma(B, 0, 0, 6.0, 3.5, 2.4, Fh + 2.15, Fh + 4.15, true, 0.22, Fh + 2.25);
  // 千木（山牆兩端交叉）與鰹木
  const hr = Fh + 4.15;
  [-3.0, 3.0].forEach(x => {
    const g1 = new THREE.BoxGeometry(0.1, 1.7, 0.2); g1.rotateX(0.65); g1.translate(x, hr + 0.4, 0.35); B.add('bronze', g1);
    const g2 = new THREE.BoxGeometry(0.1, 1.7, 0.2); g2.rotateX(-0.65); g2.translate(x, hr + 0.4, -0.35); B.add('bronze', g2);
  });
  [-2.0, -1.0, 0, 1.0, 2.0].forEach(x => B.rod('bronze', x, 0, hr + 0.45, 0.13, 1.0, false));
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
