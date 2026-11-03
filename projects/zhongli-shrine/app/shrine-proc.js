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
// 銅馬（昭和 14 年合影照）：神門左側玉垣前，低矮方形石座，馬頭朝神門
export const HORSE = { q: [-7.6, GATE_Y - 2.6], ped: 0.9 };
// 第二鳥居前的配置（自參道走向鳥居看，由左而右）：西石燈籠、揭示場、〔參道〕、社號標、東石燈籠
// （自參道正面看第二鳥居的照片＋石燈籠照片）。揭示場與社號標距參道邊約 4 公尺，石燈籠在其外側
export const KEJIBA = [-5.5, -66.6];
export const SHAGO = [5.5, -66.6];
export const GEBA = [-2.9, -66.9];   // 下乘札：揭示場（西）與參道之間
export const KOMA_POS = [[-3.2, GATE_Y - 4.3], [3.2, GATE_Y - 4.3]];   // 狛犬（神門照片反求）
const IN = GATE_Y + 28.2;             // 內苑各構件相對於舊配置的位移（神門照片反求時神門在 −28.2）
export const TORII2_Y = -64.0;        // 第二鳥居
const OUT = TORII2_Y + 56.6;          // 第二鳥居一帶（燈籠、社號標等）相對舊配置的位移

export const DIMS = {
  B1: '形式依簡報照片（鋼筋水泥、洗石子）；尺寸參考第二鳥居放大推估，待查',
  B2: '依鎮座祭鳥居照片：以台階與人身高為比例，柱距約 4 公尺',
  N: '依神門與狛犬照片反求（以拜殿尺寸為比例尺）；格子壁、桐紋幕依戰後神門前合影。鎮座祭（1939）照片中看不到神門，推測為後來增建',
  P: '依拜殿正面照（自神門往拜殿）：以參拜道實測寬 3.01 公尺為比例，相機與尺寸聯合反求，誤差約 5 像素；深度依神門照片',
  Q: '依本殿歷史照片：流造檜皮葺、前簷延伸為向拜、千木與鰹木 6 根、高床與三面高欄；以巫女身高約 1.5 公尺為比例',
  D6: '依石燈籠照片：三層台座、竿、中台、火袋、笠、寶珠',
  H: '位置依 1947 航照；外觀依校史館照片（唐破風玄關、黑瓦寄棟），以合影人身高推估',
  G: '依石燈籠照片背景',
  L: '3D 掃描＋現場實測',
  F: '依 Tinkercad 模型：兩段石台座、方柱、札板「下乘」、小屋蓋，總高約 2.4 公尺',
  E: '依 Tinkercad 模型與石燈籠照片：石基座 2.8×1.5、木柵約 1 公尺、告示板 2×1.1、總高約 3 公尺',
};

// 色調（2026-11 重新設計）：老照片是黑白的，配色依日本神社常見材質推定——
// 白木（素木的檜）偏暖淡金、檜皮葺為深栗褐、花崗岩帶一點冷灰、白砂利、紙垂純白、千木鰹木包銅帶綠青。
const COLORS = {
  wood: 0xe0c497,      // 白木（檜、素木）
  dark: 0x5e4a3a,      // 格子、門板、木構陰影
  panel: 0xc7a77b,     // 板壁、格子壁（白木，受光較少處）
  roof: 0x5c4334,      // 檜皮葺（深栗褐）
  stone: 0xd9d5cb,     // 花崗岩
  grey: 0xc9c5bb,      // 第一鳥居（洗石子）
  gravel: 0xf0ece2,    // 白砂利
  white: 0xfbf9f3,     // 紙垂、幕
  bronze: 0x6e9484,    // 千木、鰹木的銅板（綠青）
  plaster: 0xf3efe6,   // 社務所白漆喰
  brown: 0x5a4636,     // 社務所腰板
  tile: 0x4d5257,      // 日式燻瓦（藍灰）
  copper: 0x7fa595,    // 唐破風銅板葺（綠青）
  sash: 0x8a6c4f,      // 窗框、雨庇
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
  // 下段四坡做成反曲面（上陡下緩、簷角起翹），簷下一排垂木木口；上段兩坡＋山牆（妻）。
  const run = (hr - he) / (D / 2);              // 平均坡度
  const inset = (hm - he) / run * 1.15;         // 下段水平退縮（反曲面需稍深）
  const w2 = W / 2 - inset, d2 = D / 2 - inset, w = W / 2, d = D / 2;
  const E = [[cx - w, cu - d], [cx + w, cu - d], [cx + w, cu + d], [cx - w, cu + d]];
  const T = [[cx - w2, cu - d2], [cx + w2, cu - d2], [cx + w2, cu + d2], [cx - w2, cu + d2]];
  const NT = 10, NS = 5, TH = 0.3;
  const hAt = (s, t) => hm - (hm - he) * (1 - Math.pow(1 - s, 1.45)) + lift * Math.pow(s, 2.5) * Math.pow(Math.abs(t), 5);
  for (let k = 0; k < 4; k++) {
    const a = k, b = (k + 1) % 4, G = [];
    for (let i = 0; i <= NT; i++) {
      const t = -1 + 2 * i / NT, f = i / NT, row = [];
      for (let j = 0; j <= NS; j++) {
        const s = j / NS;
        const ex = E[a][0] + (E[b][0] - E[a][0]) * f, eu = E[a][1] + (E[b][1] - E[a][1]) * f;
        const tx = T[a][0] + (T[b][0] - T[a][0]) * f, tu = T[a][1] + (T[b][1] - T[a][1]) * f;
        row.push([tx + (ex - tx) * s, tu + (eu - tu) * s, hAt(s, t)]);
      }
      G.push(row);
    }
    for (let i = 0; i < NT; i++) for (let j = 0; j < NS; j++)
      B.quad('roof', G[i][j + 1], G[i + 1][j + 1], G[i + 1][j], G[i][j]);
    for (let i = 0; i < NT; i++) {                // 簷口厚度（茅負・淡色檜皮斷面）
      const p = G[i][NS], q = G[i + 1][NS];
      B.quad('wood', p, q, [q[0], q[1], q[2] - TH], [p[0], p[1], p[2] - TH]);
      B.quad('dark', [p[0], p[1], p[2] - TH], [q[0], q[1], q[2] - TH], G[i + 1][NS - 1].map((v, n) => n === 2 ? v - TH - 0.05 : v), G[i][NS - 1].map((v, n) => n === 2 ? v - TH - 0.05 : v));   // 軒裏
    }
    // 垂木：簷下白色木口，間隔約 0.33 公尺
    const L = Math.hypot(E[b][0] - E[a][0], E[b][1] - E[a][1]), n = Math.floor(L / 0.33);
    const nx = -(E[b][1] - E[a][1]) / L, nu = (E[b][0] - E[a][0]) / L;      // 向內法線
    for (let i = 1; i < n; i++) {
      const f = i / n, t = -1 + 2 * f, x = E[a][0] + (E[b][0] - E[a][0]) * f + nx * 0.25, u = E[a][1] + (E[b][1] - E[a][1]) * f + nu * 0.25;
      const y = hAt(0.92, t) - TH - 0.02;
      B.box('white', x, u, 0.1, 0.1, y - 0.1, y);
    }
  }
  // 上段：兩坡屋面＋山牆三角（妻飾）
  const R0 = [cx - w2, cu, hr], R1 = [cx + w2, cu, hr], TT = T.map(([x, u]) => [x, u, hm]);
  B.quad('roof', TT[0], TT[1], R1, R0);
  B.quad('roof', TT[2], TT[3], R0, R1);
  B.mesh('dark', [TT[0], TT[3], R0], [[0, 1, 2]]);
  B.mesh('dark', [TT[1], R1, TT[2]], [[0, 1, 2]]);
  [-1, 1].forEach(sx => {                        // 破風板（妻側封簷，白木）
    const x = cx + sx * (w2 + 0.02);
    B.quad('wood', [x, cu - d2 - 0.15, hm - 0.05], [x, cu, hr + 0.05], [x, cu, hr - 0.3], [x, cu - d2 - 0.15, hm - 0.35]);
    B.quad('wood', [x, cu + d2 + 0.15, hm - 0.05], [x, cu, hr + 0.05], [x, cu, hr - 0.3], [x, cu + d2 + 0.15, hm - 0.35]);
    B.box('wood', x, cu, 0.08, 2 * d2 * 0.5, hm + (hr - hm) * 0.25, hm + (hr - hm) * 0.32);   // 妻の貫
  });
  // 屋脊（箱棟）＋鬼板
  B.box('roof', cx, cu, 2 * w2 + 0.3, 0.5, hr - 0.05, hr + 0.4);
  B.box('white', cx, cu, 2 * w2 + 0.32, 0.52, hr + 0.18, hr + 0.24);      // 棟の飾り帯
  [-1, 1].forEach(sx => { B.box('dark', cx + sx * (w2 + 0.1), cu, 0.25, 0.55, hr - 0.1, hr + 0.7); B.box('dark', cx + sx * (w2 + 0.1), cu, 0.25, 0.85, hr + 0.45, hr + 0.62); });
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
      B.mesh('wood', [[cx + x, cu - Df, he - 0.1], [cx + x, cu, hr - 0.1], [cx + x, cu, hr + 0.25], [cx + x, cu - Df, he + 0.25]], [[0, 1, 2], [0, 2, 3]]);
      B.mesh('wood', [[cx + x, cu + Db, heB - 0.1], [cx + x, cu, hr - 0.1], [cx + x, cu, hr + 0.25], [cx + x, cu + Db, heB + 0.25]], [[0, 2, 1], [0, 3, 2]]);
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
// 懸魚：切妻（懸山）山牆頂端、破風板交會處垂下的裝飾板（神門照片可見）。x 為山牆面位置
function gegyo(B, x, cu, ytop, k = 1) {
  B.box('wood', x, cu, 0.07, 0.3 * k, ytop - 0.42 * k, ytop);
  B.box('wood', x, cu, 0.07, 0.56 * k, ytop - 0.6 * k, ytop - 0.38 * k);
  B.box('wood', x, cu, 0.07, 0.3 * k, ytop - 0.72 * k, ytop - 0.6 * k);
  B.box('dark', x, cu, 0.08, 0.1 * k, ytop - 0.32 * k, ytop - 0.2 * k);   // 六葉
}
// 大提燈（神門、拜殿前，鎮座祭照片）：白紙燈身＋上下黑色口輪、一面桐紋一面「中壢神社」、
// 上有白緣的切妻小屋蓋，背後襯一圈扇形的花瓣形透雕飾框。s 為比例；textFront：字面朝前（否則紋面朝前）
function chochin(B, x, u, y0, s, textFront) {
  const H = 1.15 * s, R = 0.42 * s;
  // 燈身：上下收圓的長圓形（車削曲面），貼竹骨、紋章與文字
  const prof = [[0.34, 0], [0.62, 0.02], [0.84, 0.07], [0.96, 0.16], [1, 0.3], [1, 0.7], [0.96, 0.84], [0.84, 0.93], [0.62, 0.98], [0.34, 1]]
    .map(([r, h]) => new THREE.Vector2(r * R, h * H));
  const body = new THREE.LatheGeometry(prof, 28);
  { const P = body.attributes.position, UV = body.attributes.uv; for (let i = 0; i < UV.count; i++) UV.setY(i, P.getY(i) / H); }   // 依高度重設貼圖座標，文字不變形
  body.rotateY(textFront ? -Math.PI / 2 : Math.PI); body.translate(x, y0, -u); B.add('chochin', body);
  B.cyl('dark', x, u, R * 0.4, y0 - 0.07 * s, y0 + 0.01, 14); B.cyl('dark', x, u, R * 0.4, y0 + H - 0.01, y0 + H + 0.06 * s, 14);   // 上下口輪
  // 吊架：燈頂與屋蓋之間的深色木塊
  const yr = y0 + H + 0.06 * s;
  B.box('dark', x, u, 0.55 * s, 0.3 * s, yr, yr + 0.1 * s);
  // 屋蓋：妻入（山牆朝前）、屋面反り（上陡下緩、簷端微翹），白色破風板
  const w = 0.82 * s, D = 0.5 * s, h = 0.56 * s, yb = yr + 0.1 * s, N = 10, Y = t => yb + h * (1 - Math.pow(t, 0.5)) + 0.05 * s * Math.pow(t, 8);
  for (const sg of [-1, 1]) for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, x0 = x + sg * w * t0, x1 = x + sg * w * t1, y0r = Y(t0), y1r = Y(t1);
    const q = [[x0, u - D, y0r], [x1, u - D, y1r], [x1, u + D, y1r], [x0, u + D, y0r]];
    sg > 0 ? B.quad('roof', q[0], q[1], q[2], q[3]) : B.quad('roof', q[1], q[0], q[3], q[2]);
    for (const uf of [u - D - 0.02, u + D + 0.02])                  // 破風板（前後）
      B.quad('white', [x0, uf, y0r - 0.09 * s], [x1, uf, y1r - 0.09 * s], [x1, uf, y1r + 0.03 * s], [x0, uf, y0r + 0.03 * s]);
    B.quad('white', [x0, u - D + 0.03, yb], [x1, u - D + 0.03, yb], [x1, u - D + 0.03, y1r - 0.09 * s], [x0, u - D + 0.03, y0r - 0.09 * s]);   // 妻板
  }
  B.box('white', x, u - D, 0.2 * s, 0.1 * s, yb + h - 0.02, yb + h + 0.16 * s);   // 棟の飾り（桐）
  // 背後的花瓣形飾框：以屋頂中心為圓心、半圓排列的大花瓣（白框透空）
  const cy = yb + h * 0.35;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (-0.08 + 1.16 * i / 8), g = new THREE.TorusGeometry(0.2 * s, 0.026 * s, 3, 12);
    g.translate(x + Math.cos(a) * 0.72 * s, cy + Math.sin(a) * 0.62 * s, -(u + D + 0.06)); B.add('white', g);
  }
}
// 揭示場（制札）：Tinkercad 模型＋石燈籠照片。石基座 2.8×1.5、木柵高約 1 公尺、告示板 2×1.1、總高約 3 公尺。
// 局部座標：x 沿長邊、-u 為告示板正面。屋頂為反曲兩坡（照り屋根），山牆有懸魚，屋脊兩端起翹。
function kejiba(B) {
  B.box('stone', 0, 0, 2.8, 1.5, 0, 0.22);
  const fx = 1.32, fu = 0.66, top = 0.22 + 0.95;
  const picket = (x, u, i) => B.box('wood', x, u, 0.05, 0.05, 0.22, top - (i % 3 === 1 ? 0.1 : 0));
  let i = 0;
  for (let x = -fx; x <= fx + 1e-6; x += 0.12) { picket(x, -fu, i); picket(x, fu, i++); }
  for (let u = -fu + 0.12; u < fu - 0.05; u += 0.12) { picket(-fx, u, i); picket(fx, u, i++); }
  [0.35, top - 0.2].forEach(y => {
    B.box('wood', 0, -fu, 2 * fx, 0.05, y, y + 0.05); B.box('wood', 0, fu, 2 * fx, 0.05, y, y + 0.05);
    B.box('wood', -fx, 0, 0.05, 2 * fu, y, y + 0.05); B.box('wood', fx, 0, 0.05, 2 * fu, y, y + 0.05);
  });
  [-1.08, 1.08].forEach(x => B.box('wood', x, 0, 0.14, 0.14, 0.22, 2.42));
  B.box('wood', 0, 0, 2.3, 0.1, 2.32, 2.44);
  B.box('wood', 0, 0, 2.12, 0.08, 0.98, 2.2);
  B.box('white', 0, -0.045, 1.98, 0.02, 1.04, 2.14);
  for (let k = 0; k < 7; k++) B.box('grey', -0.72 + k * 0.24, -0.06, 0.025, 0.005, 1.25, 1.95);   // 墨書（示意）
  const W = 1.62, D = 1.05, he = 2.42, hr = 2.92, N = 6, Y = t => hr - (hr - he) * Math.pow(t, 0.62);
  for (const sg of [-1, 1]) for (let k = 0; k < N; k++) {
    const t0 = k / N, t1 = (k + 1) / N, u0 = sg * D * t0, u1 = sg * D * t1, y0 = Y(t0), y1 = Y(t1);
    const q = [[-W, u0, y0], [W, u0, y0], [W, u1, y1], [-W, u1, y1]];
    sg > 0 ? B.quad('roof', q[0], q[1], q[2], q[3]) : B.quad('roof', q[1], q[0], q[3], q[2]);
    B.quad('dark', [-W, u1, y1], [W, u1, y1], [W, u1, y1 - 0.08], [-W, u1, y1 - 0.08]);
    for (const x of [-W - 0.02, W + 0.02]) B.quad('wood', [x, u0, y0 + 0.04], [x, u1, y1 + 0.04], [x, u1, y1 - 0.12], [x, u0, y0 - 0.12]);
  }
  B.box('roof', 0, 0, 2 * W + 0.1, 0.22, hr - 0.02, hr + 0.14);
  [-1, 1].forEach(sx => {
    B.box('dark', sx * (W + 0.02), 0, 0.14, 0.26, hr - 0.05, hr + 0.24);
    const g = new THREE.BoxGeometry(0.1, 0.32, 0.1); g.rotateZ(-sx * 0.6); g.translate(sx * (W + 0.1), hr + 0.26, 0); B.add('roof', g);
    gegyo(B, sx * (W + 0.03), 0, hr - 0.05, 0.42);
  });
}
// 下乘札（Tinkercad 模型，總高 43 單位 → 約 2.4 公尺）：兩段石台座、方柱、白木札板「下乘」、小切妻屋蓋。-u 為札面
function gebafuda(B) {
  B.box('stone', 0, 0, 0.78, 0.78, 0, 0.17); B.box('stone', 0, 0, 0.74, 0.74, 0.17, 0.33);
  B.box('stone', 0, 0, 0.45, 0.45, 0.33, 0.62);
  B.box('wood', 0, 0, 0.11, 0.11, 0.62, 1.4);                       // 柱
  B.box('wood', 0, 0, 0.47, 0.06, 1.12, 2.24);                      // 札板
  { const g = new THREE.PlaneGeometry(0.4, 1.0); g.translate(0, 1.68, 0.032); B.add('geba', g); }      // 正面
  { const g = new THREE.PlaneGeometry(0.4, 1.0); g.rotateY(Math.PI); g.translate(0, 1.68, -0.032); B.add('geba', g); }   // 背面
  // 小屋蓋：兩坡、屋脊沿 u（山牆朝前後）
  const w = 0.29, d = 0.1, y0 = 2.22, h = 0.13;
  B.quad('roof', [-w, -d, y0], [0, -d, y0 + h], [0, d, y0 + h], [-w, d, y0]);
  B.quad('roof', [w, d, y0], [0, d, y0 + h], [0, -d, y0 + h], [w, -d, y0]);
  B.mesh('roof', [[-w, -d, y0], [w, -d, y0], [0, -d, y0 + h]], [[0, 2, 1]]);
  B.mesh('roof', [[-w, d, y0], [w, d, y0], [0, d, y0 + h]], [[0, 1, 2]]);
}
function gebaTexture() {                   // 札面「下乘」：白木底、墨書
  const c = document.createElement('canvas'); c.width = 128; c.height = 320;
  const x = c.getContext('2d'); x.fillStyle = '#e8d6b4'; x.fillRect(0, 0, 128, 320);
  x.fillStyle = '#1d1712'; x.font = '900 86px "Noto Serif TC","PMingLiU",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('下', 64, 92); x.fillText('乘', 64, 222);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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
  // 竿：方形斷面、四面內凹的沙漏形（石燈籠特寫照：下寬、腰細、上略寬）
  const wq = t => t < 0.45 ? 0.56 + 0.8 * Math.pow(1 - t / 0.45, 2) : 0.56 + 0.36 * Math.pow((t - 0.45) / 0.55, 2);
  for (let i = 0; i < 8; i++) { const t0 = i / 8, t1 = (i + 1) / 8; sq(B, (0.88 + 1.07 * t0) * s, (0.88 + 1.07 * t1) * s, wq(t0) * s, wq(t1) * s); }
  sq(B, 1.95 * s, 2.06 * s, 0.95 * s, 1.1 * s);        // 斗栱
  sq(B, 2.06 * s, 2.3 * s, 1.28 * s, 1.24 * s);        // 中台
  sq(B, 2.3 * s, 2.78 * s, 0.76 * s, 0.76 * s);        // 火袋
  for (let k = 0; k < 4; k++) {                          // 火袋四面：菊桔梗社紋浮雕
    const g = new THREE.PlaneGeometry(0.42 * s, 0.42 * s); g.translate(0, 2.54 * s, 0.385 * s); g.rotateY(k * Math.PI / 2); B.add('kamonStone', g);
  }
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
  // 只建台座；石獅本身用忠義祠現存狛犬的 3D 掃描（main.js 載入 komainu-scan-2.glb）
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
  [['D5', -9], ['D6', 9]].forEach(([id, x]) => { B.begin(id).at(x, TORII2_Y - 3.5, 0, 0); lantern(B); B.end(); });
  { const q = [SHAGO[0], SHAGO[1]]; B.begin('G').at(q[0], q[1], 0, 0);   // 社號標：參道東側、東石燈籠內側
    B.box('stone', 0, 0, 1.15, 1.15, 0, 0.3); B.box('stone', 0, 0, 0.85, 0.85, 0.3, 0.6); B.box('stone', 0, 0, 0.46, 0.46, 0.6, 3.8); B.end(); }
  // 參道西側由外往內：石燈籠 → 揭示場 → 下乘札 → 第二鳥居（石燈籠照片、自參道正面看第二鳥居照片）
  B.begin('E').at(KEJIBA[0], KEJIBA[1], 0, 0); kejiba(B); B.end();   // 告示板朝參拜者走來的方向（背對第二鳥居）
  B.begin('F').at(GEBA[0], GEBA[1], 0, 0); gebafuda(B); B.end();   // 下乘札：揭示場與參道之間、與揭示場同排，札面朝參拜者
  // 手水舍（位置推估：石燈籠照片中在鳥居內側）
  B.begin('W').at(-8.0, TORII2_Y + 5.6, Math.PI / 2, LV.T1);
  [[-1.1, -0.75], [1.1, -0.75], [1.1, 0.75], [-1.1, 0.75]].forEach(([x, u]) => B.box('wood', x, u, 0.18, 0.18, 0, 2.3));
  B.box('stone', 0, 0, 1.4, 0.7, 0, 0.75);
  kirizuma(B, 0, 0, 3.4, 1.4, 1.4, 2.3, 3.25, true, 0.08);   // 懸山（切妻造）
  [-1.7, 1.7].forEach(x => gegyo(B, x, 0, 3.15));
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
  // 戰後合影照（神門前）：中央開口兩側是縱格子壁，門上掛桐紋幕與紙垂
  [-1.55, 1.55].forEach(x => {
    B.cyl('wood', x, 0, 0.19, 0, 2.55, 12);                // 本柱
    [-0.95, 0.95].forEach(u => B.box('wood', x, u, 0.18, 0.18, 0, 2.35));   // 控柱
    const sx = Math.sign(x), cx = x + sx * 0.75;
    B.box('wood', cx, 0, 1.3, 0.1, 0.1, 0.25);            // 地覆
    B.box('wood', cx, 0, 1.3, 0.1, 1.95, 2.05);           // 內法長押
    for (let k = -6; k <= 6; k++) B.box('wood', cx + k * 0.1, 0, 0.04, 0.05, 0.25, 1.95);   // 縱格子
    B.box('dark', cx, 0.04, 1.3, 0.02, 0.25, 1.95);       // 格子後的暗部
  });
  B.box('wood', 0, 0, 6.0, 0.24, 2.25, 2.55);  // 冠木
  // 神紋幕：五幅白布，第二、四幅有桐紋（戰後合影照）
  [-1.2, -0.6, 0, 0.6, 1.2].forEach((x, i) => {
    B.box('white', x, -0.15, 0.55, 0.03, 1.72, 2.22);
    if (i === 1 || i === 3) { const g = new THREE.PlaneGeometry(0.4, 0.4); g.rotateY(Math.PI); g.translate(x, 1.97, 0.168); B.add('kamon', g); }   // 社紋（菊＋桔梗）
  });
  B.rod('dark', 0, -0.18, 2.24, 0.04, 3.1);               // 注連繩
  [-1.3, -0.65, 0, 0.65, 1.3].forEach(x => B.box('white', x, -0.2, 0.08, 0.02, 1.95, 2.2));   // 紙垂
  [-2.4, -1.2, 0, 1.2, 2.4].forEach(x => { B.box('wood', x, 0, 0.32, 0.32, 2.55, 2.68); B.box('wood', x, 0, 0.7, 0.18, 2.68, 2.78); });   // 斗栱
  B.box('dark', 0, 0, 5.4, 2.4, 2.55, 2.75);    // 斗栱帶
  kirizuma(B, 0, 0, 7.1, 3.0, 3.0, 2.75, 4.3, true, 0.15);
  [-3.55, 3.55].forEach(x => gegyo(B, x, 0, 4.2));          // 懸魚（神門照片：山牆頂端可見）
  // 鎮座祭裝飾（神門前合影）：簷下深色垂幕（垂弧）、門前左右懸掛大提燈
  for (let i = 0; i < 10; i++) {
    const x0 = -3.2 + 6.4 * i / 10, m = x0 + 0.32, sag = 0.4 * Math.sin(Math.PI * ((m + 3.2) % 3.2) / 3.2);
    B.box('dark', m, -1.25, 0.66, 0.03, 2.55 - sag, 2.85);
  }
  chochin(B, -2.25, -1.55, 0.8, 1, false); chochin(B, 2.25, -1.55, 0.8, 1, true);
  B.end();
  // 銅馬石座：兩段方形花崗岩（合影照中台座頂約在人的腰部，約 0.9 公尺），長邊順著玉垣
  B.begin('Lp').at(HORSE.q[0], HORSE.q[1], 0, LV.T1);
  B.box('stone', 0, 0, 3.1, 1.5, 0, 0.22);
  B.box('stone', 0, 0, 2.7, 1.15, 0.22, HORSE.ped - 0.08);
  B.box('stone', 0, 0, 2.85, 1.3, HORSE.ped - 0.08, HORSE.ped);
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
  B.box('wood', 0, 0, 14.0, 6.6, 0.75, F - 0.02);           // 木地板（底）
  // ---- 拜殿內部（依拜殿內三張照片）----
  // 床板：縱向鋪設、朝本殿方向
  for (let x = -4.35; x < 4.35; x += 0.3) B.box('wood', x + 0.145, 0, 0.29, 6.4, F - 0.02, F);
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
    B.box('panel', s * 5.5, -3.0, 2.6, 0.08, F + 0.1, F + 2.1);
    B.box('panel', s * 6.8, 0, 0.08, 6.0, F + 0.1, F + 2.1);
    B.box('panel', s * 5.5, 3.0, 2.6, 0.08, F + 0.1, F + 2.1);
    B.box('panel', s * 2.8, 3.0, 2.8, 0.08, F + 0.1, F + 2.5);
    B.box('wood', s * 5.5, -3.0, 2.6, 0.1, F + 1.25, F + 1.35);      // 翼部長押
    for (let k = -5; k <= 5; k++) B.box('wood', s * 5.5 + k * 0.22, -3.06, 0.05, 0.05, F + 1.35, F + 2.1);   // 上段縱格子   // 主體背面板壁（中間開口通幣殿）
  });
  B.box('wood', 0, -3.0, 13.8, 0.24, F + CH - 0.4, F + CH - 0.15);   // 正面虹梁（頭貫）
  B.box('wood', 0, -3.05, 8.6, 0.12, F + 1.95, F + 2.05);             // 內法長押（幕串）
  // 御簾：捲起的竹簾（深色帶）＋白色帽額垂布＋黑色總角房，沿正面與兩側一周（內部照片）
  const sudare = (x0, u0, x1, u1) => {
    const L = Math.hypot(x1 - x0, u1 - u0), n = Math.round(L / 0.55);
    const ax = (x1 - x0) / L, au = (u1 - u0) / L, alongX = Math.abs(ax) > 0.5;
    B.box('dark', (x0 + x1) / 2, (u0 + u1) / 2, alongX ? L : 0.1, alongX ? 0.1 : L, F + CH - 0.62, F + CH - 0.42);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, u = u0 + (u1 - u0) * t;
      B.box('white', x, u, alongX ? 0.48 : 0.03, alongX ? 0.03 : 0.48, F + CH - 1.15, F + CH - 0.62);
      if (i % 2 === 0) B.box('dark', x, u, 0.08, 0.08, F + CH - 1.0, F + CH - 0.75);   // 總角房
    }
  };
  sudare(-4.2, -3.08, 4.2, -3.08);
  sudare(-4.28, -3.0, -4.28, 3.0); sudare(4.28, -3.0, 4.28, 3.0);
  // 天井：板天井＋棹縁（照片中可見木板與細桟）
  B.box('ceil', 0, 0, 8.8, 6.4, F + CH + 0.4, F + CH + 0.44);
  for (let x = -4.2; x <= 4.2; x += 0.6) B.box('ceil', x, 0, 0.06, 6.4, F + CH + 0.34, F + CH + 0.4);
  // 釣燈籠（天井中央垂下）
  B.box('dark', -2.6, -1.5, 0.03, 0.03, F + CH - 0.25, F + CH + 0.4);
  B.cyl('dark', -2.6, -1.5, 0.22, F + CH - 0.75, F + CH - 0.3, 6, 0.22);
  B.cyl('roof', -2.6, -1.5, 0.36, F + CH - 0.3, F + CH - 0.14, 6, 0.06);
  // 後壁：幣殿入口上方的水引幕（織紋帶）、內法壁與「中壢神社」扁額（內側朝拜殿）
  B.box('panel', 0, 2.95, 2.8, 0.08, F + 2.5, F + CH + 0.4);
  B.box('brocade', 0, 2.88, 8.4, 0.04, F + 2.12, F + 2.42);
  B.box('dark', 0, 2.86, 0.4, 0.06, F + 2.44, F + CH + 0.32);      // 扁額框（水引幕與天井之間）
  { const g = new THREE.PlaneGeometry(0.27, 0.46); g.translate(0, (F + 2.44 + F + CH + 0.32) / 2 - 0.05, -2.82); B.add('plaque', g); }
  [-1.38, 1.38].forEach(x => B.box('white', x, 2.9, 0.12, 0.06, F + 1.6, F + 2.12));   // 榊（以白紙垂示意）
  // ---- 正面建具（拜殿前婚禮合影照）：中央三間為板扉，向外開啟、貼在柱旁；兩端間為格子戸 ----
  const DH = F + 2.3;
  [[-3.03, -1.38], [-1.38, 1.38], [1.38, 3.03]].forEach(([a, b]) => {
    const half = (b - a) / 2 - 0.12;
    [[a + 0.12, -1], [b - 0.12, 1]].forEach(([x, side]) => {          // 兩片門扉、開成與正面垂直
      B.box('wood', x - side * 0.04, -3.05 - half / 2, 0.06, half, F + 0.05, DH);
      B.box('panel', x - side * 0.04, -3.05 - half / 2, 0.065, half - 0.12, F + 0.25, DH - 0.2);   // 門板鏡板
    });
    B.box('wood', (a + b) / 2, -3.02, b - a, 0.1, DH, DH + 0.1);        // 上框（鴨居）
    B.box('wood', (a + b) / 2, -3.02, b - a, 0.1, F, F + 0.08);         // 敷居
  });
  [[-4.2, -3.03], [3.03, 4.2]].forEach(([a, b]) => {                    // 格子戸
    const cx = (a + b) / 2, w = b - a - 0.16;
    B.box('panel', cx, -2.98, w, 0.03, F + 0.1, DH);
    for (let x = a + 0.15; x < b - 0.1; x += 0.17) B.box('wood', x, -3.03, 0.04, 0.05, F + 0.1, DH);
    for (let y = F + 0.25; y < DH; y += 0.17) B.box('wood', cx, -3.03, w, 0.05, y, y + 0.035);
    B.box('wood', cx, -3.03, b - a, 0.1, DH, DH + 0.1);
  });
  // 鈴緒：中央垂下的粗繩與鈴
  B.cyl('bronze', 0, -3.25, 0.13, F + CH - 0.45, F + CH - 0.2, 10, 0.08);
  B.cyl('white', 0, -3.25, 0.05, F + 0.55, F + CH - 0.45, 8);
  // 蟇股（中央間虹梁上的雕刻）與木鼻（柱頭左右突出）
  B.mesh('wood', [[-0.55, -3.12, F + CH - 0.15], [0.55, -3.12, F + CH - 0.15], [0.25, -3.12, F + CH + 0.35], [-0.25, -3.12, F + CH + 0.35]], [[0, 1, 2], [0, 2, 3]]);
  B.box('wood', 0, -3.12, 0.7, 0.12, F + CH + 0.3, F + CH + 0.4);
  [-4.2, -3.03, -1.38, 1.38, 3.03, 4.2].forEach(x => B.box('wood', x, -3.2, 0.2, 0.42, F + CH - 0.4, F + CH - 0.18));
  // 石階兩側的袖石（耳石）
  [-3.17, 3.17].forEach(x => { B.box('stone', x, -3.95, 0.34, 1.9, 0, F - 0.05); B.box('stone', x, -5.05, 0.34, 0.3, 0, 0.35); });
  // 柱際の結界：中央通路兩側的低矮木柵（照片中柱腳的白木柵）
  [-1.65, 1.65].forEach(x => {
    for (let u = 1.2; u <= 2.9; u += 0.14) B.box('wood', x, u, 0.05, 0.05, F, F + 0.75);
    B.box('wood', x, 2.05, 0.07, 1.8, F + 0.62, F + 0.7); B.box('wood', x, 2.05, 0.07, 1.8, F + 0.08, F + 0.16);
  });
  // 斗栱帶：只做外圍一圈（原本是實心板，會把室內天井整個蓋黑）
  [[0, -3.1, 8.8, 0.2], [0, 3.1, 8.8, 0.2], [-4.3, 0, 0.2, 6.4], [4.3, 0, 0.2, 6.4]].forEach(([x, u, w, d]) => B.box('dark', x, u, w, d, F + CH, F + CH + 0.4));
  [-4.2, -2.1, 0, 2.1, 4.2].forEach(x => B.box('wood', x, -3.15, 0.3, 0.3, F + CH, F + CH + 0.35));   // 斗栱（正面可見）
  // 組物（斗栱）：每根柱頂一組，正面與側面
  [-4.2, -3.03, -1.38, 1.38, 3.03, 4.2].forEach(x => [-3.0, 3.0].forEach(u => {
    B.box('wood', x, u, 0.42, 0.42, F + CH, F + CH + 0.16);            // 大斗
    B.box('wood', x, u, 0.9, 0.22, F + CH + 0.16, F + CH + 0.3);        // 肘木
    [-0.33, 0, 0.33].forEach(o => B.box('wood', x + o, u, 0.2, 0.26, F + CH + 0.3, F + CH + 0.42));   // 巻斗
  }));
  [-4.2, 4.2].forEach(x => [0].forEach(u => B.box('wood', x, u, 0.22, 0.9, F + CH + 0.16, F + CH + 0.3)));
  B.box('wood', 0, -3.05, 8.8, 0.2, F + CH + 0.42, F + CH + 0.56);       // 桁
  irimoya(B, 0, 0, 12.4, 9.0, 4.04, 5.3, 6.9, 0.7);
  // 鎮座祭裝飾（祭典照）：正面簷下垂掛深色幕（兩段垂弧）、紅白繩，兩側懸掛帶桐紋屋蓋的「中壢神社」燈籠
  for (let i = 0; i < 12; i++) {
    const x0 = -4.2 + 8.4 * i / 12, x1 = x0 + 0.7, m = (x0 + x1) / 2, sag = 0.35 * Math.sin(Math.PI * ((m + 4.2) % 4.2) / 4.2);
    B.box('dark', m, -3.2, 0.72, 0.03, F + CH - 0.5 - sag, F + CH - 0.05);
  }
  chochin(B, -2.2, -3.6, F + 1.15, 0.8, false); chochin(B, 2.2, -3.6, F + 1.15, 0.8, true);
  // 兩翼（垛殿）屋頂：懸山（切妻造、平入）。屋脊與主屋脊平行，外端為山牆、屋面伸出牆外；內端收在主屋頂下
  [-1, 1].forEach(s => {
    const xi = 3.9, xo = 7.55, he = 3.36, hr = 4.7, D = 4.4;
    kirizuma(B, s * (xi + xo) / 2, 0, xo - xi, D, D, he, hr, true, 0.12);
    // 山牆（妻壁）：翼外牆上方的三角板壁
    const xw = s * 6.82, yw = F + 2.2, ys = hr - (hr - he) * 3.0 / D;
    B.mesh('panel', [[xw, -3, yw], [xw, -3, ys], [xw, 0, hr - 0.05], [xw, 3, ys], [xw, 3, yw]], [[0, 1, 2], [0, 2, 4], [4, 2, 3]]);
    B.box('wood', xw, 0, 0.1, 6.0, yw - 0.05, yw + 0.08);
    B.box('dark', s * (xo + 0.06), 0, 0.2, 0.45, hr - 0.1, hr + 0.45);   // 鬼板
    gegyo(B, s * (xo + 0.04), 0, hr - 0.12);
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
  // 御帳（白幕）與神饌台：自拜殿內望本殿的照片
  [-0.9, -0.3, 0.3, 0.9].forEach(x => B.box('white', x, -1.6, 0.56, 0.03, Fh + 0.9, Fh + 2.05));
  B.box('wood', 0, -1.85, 1.6, 0.4, Fh + 0.55, Fh + 0.62);
  [-0.5, 0, 0.5].forEach(x => B.box('wood', x, -1.85, 0.26, 0.26, Fh + 0.62, Fh + 0.85));
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
  for (const [k, c] of Object.entries(COLORS)) mats[k] = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
  mats.path = new THREE.MeshLambertMaterial({ map: slabTexture(), side: THREE.DoubleSide });
  mats.plaque = new THREE.MeshLambertMaterial({ map: plaqueTexture(), side: THREE.DoubleSide });
  mats.brocade = new THREE.MeshLambertMaterial({ map: brocadeTexture(), side: THREE.DoubleSide });
  // 天井：朝下的面只受地面反光，略加自發光以免室內一片漆黑
  mats.chochin = new THREE.MeshLambertMaterial({ map: chochinTexture(), emissive: 0x2a2620, side: THREE.DoubleSide });
  mats.kamon = new THREE.MeshLambertMaterial({ map: kamonTexture(), side: THREE.DoubleSide });
  mats.geba = new THREE.MeshLambertMaterial({ map: gebaTexture(), side: THREE.FrontSide });
  mats.kamonStone = new THREE.MeshLambertMaterial({ map: kamonTexture('#d9d5cb', '#8a8478'), side: THREE.DoubleSide });
  mats.ceil = new THREE.MeshLambertMaterial({ color: COLORS.wood, emissive: 0x3e3022, side: THREE.DoubleSide });
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
// 中壢神社社紋：外圈菊花十二瓣、內為桔梗五瓣（尖端朝上），中心小圓帶五枚花蕊。r = 外半徑
function drawKamon(x, r, ink, paper) {
  x.strokeStyle = ink; x.lineJoin = 'round';
  const Rf = r * 0.78, pr = r * 0.235;   // 相鄰花瓣圓略為重疊，交線即瓣間分界
  x.lineWidth = r * 0.045;
  const pc = i => { const a = (i + 0.5) / 12 * Math.PI * 2; return [Math.cos(a) * Rf, Math.sin(a) * Rf]; };
  for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(...pc(i), pr, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = paper;                                     // 塗掉重疊處，只留外緣花瓣輪廓
  for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(...pc(i), pr - x.lineWidth / 2, 0, Math.PI * 2); x.fill(); }
  x.beginPath(); x.arc(0, 0, Rf, 0, Math.PI * 2); x.fill();
  const h = Rf * Math.sin(Math.PI / 12), rx = Rf * Math.cos(Math.PI / 12) + Math.sqrt(Math.max(0, pr * pr - h * h));
  for (let i = 0; i < 12; i++) {                           // 瓣間分界線：自桔梗外緣到花瓣交點
    const a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(Math.cos(a) * r * 0.64, Math.sin(a) * r * 0.64); x.lineTo(Math.cos(a) * rx, Math.sin(a) * rx); x.stroke();
  }
  // 外緣花瓣弧（填白後重描外半圈）
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2, [cx, cy] = pc(i); const d = Math.acos(Math.min(1, (rx * rx - Rf * Rf - pr * pr) / (-2 * Rf * pr)));
    x.beginPath(); x.arc(cx, cy, pr, a - (Math.PI - d), a + (Math.PI - d)); x.stroke(); }
  // 桔梗：五瓣，瓣端略尖，外框粗
  const Rt = r * 0.62, Rn = r * 0.5, tip = i => -Math.PI / 2 + i / 5 * Math.PI * 2, nb = i => tip(i) + Math.PI / 5;
  const P = (a, rr) => [Math.cos(a) * rr, Math.sin(a) * rr];
  x.lineWidth = r * 0.085; x.beginPath();
  for (let i = 0; i < 5; i++) {
    const n0 = P(nb(i - 1), Rn), t = P(tip(i), Rt), n1 = P(nb(i), Rn);
    const mid = (a, b, k) => [(a[0] + b[0]) / 2 * k, (a[1] + b[1]) / 2 * k], c0 = mid(n0, t, 1.12), c1 = mid(t, n1, 1.12);   // 瓣緣微凸、近乎直線，整體呈五角形
    if (!i) x.moveTo(...n0);
    x.quadraticCurveTo(...c0, ...t); x.quadraticCurveTo(...c1, ...n1);
  }
  x.closePath(); x.stroke();
  x.lineWidth = r * 0.05;
  for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(...P(nb(i), r * 0.13)); x.lineTo(...P(nb(i), Rn)); x.stroke(); }   // 瓣間分線
  x.beginPath(); x.arc(0, 0, r * 0.11, 0, Math.PI * 2); x.stroke();                                                          // 花心
  for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(...P(tip(i), r * 0.13)); x.lineTo(...P(tip(i), r * 0.2)); x.stroke(); }   // 花蕊
}
function kamonTexture(paper = '#fbf9f3', ink = '#2a2420') {   // 社紋貼圖（紋幕：白底墨線；石燈籠火袋：石色底、淺刻線）
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = paper; x.fillRect(0, 0, 256, 256);
  if (paper !== '#fbf9f3') { x.strokeStyle = ink; x.lineWidth = 6; x.strokeRect(10, 10, 236, 236); }   // 火袋的方形彫り込み
  x.translate(128, 128); drawKamon(x, 96, ink, paper);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let onAsset = () => {};
export const setOnAsset = f => { onAsset = f; };   // 非同步貼圖載入後通知重畫
function chochinTexture() {             // 提燈：竹骨橫紋、一面紋章、一面「中壢神社」（照片中的紋：外圈花瓣、內五瓣）
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  const x = c.getContext('2d'); x.scale(2, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  x.fillStyle = '#f3efe4'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(120,110,95,.35)'; x.lineWidth = 1;
  for (let y = 8; y < H; y += 7) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  // 社紋（圓周 1/2 處）：菊（外圈十二瓣）與桔梗（內五瓣）——依燈籠老照片描繪
  x.save(); x.translate(W * 0.5, H / 2); x.scale(1, 1.15); drawKamon(x, 56, '#2a2420', '#f3efe4'); x.restore();
  const ink = '#2a2420';
  // 文字（圓周 1/4 處，直書；與紋章相隔 90°）：粗筆
  x.fillStyle = ink; x.font = '900 46px "Noto Serif TC","PMingLiU",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  '中壢神社'.split('').forEach((ch, i) => x.fillText(ch, W * 0.25, 46 + i * 54));
  // 實際字跡：從老照片燈籠描下的「中壢神社」墨跡（assets/chochin-text.png），載入後取代上面的暫用字
  const inkImg = new Image();
  inkImg.onload = () => {
    const tw = 80, th = 214, tx = W * 0.25 - tw / 2, ty = 22;
    x.fillStyle = '#f3efe4'; x.fillRect(tx - 6, 0, tw + 12, H);
    x.strokeStyle = 'rgba(120,110,95,.35)'; x.lineWidth = 1;
    for (let y = 8; y < H; y += 7) { x.beginPath(); x.moveTo(tx - 6, y); x.lineTo(tx + tw + 6, y); x.stroke(); }
    x.drawImage(inkImg, tx, ty, tw, th);
    t.needsUpdate = true; onAsset();
  };
  inkImg.src = './assets/chochin-text.png';
  return t;
}
function plaqueTexture() {              // 扁額「中壢神社」（白底黑字、深色框）
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 128, 256);
  x.fillStyle = '#1d1712'; x.font = 'bold 50px "Noto Serif TC","PMingLiU",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  '中壢神社'.split('').forEach((ch, i) => x.fillText(ch, 64, 36 + i * 61));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function brocadeTexture() {             // 水引幕的花紋帶（照片中的連續菱花紋）
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#8c6f4c'; x.fillRect(0, 0, 256, 32);
  x.strokeStyle = '#e6d6b4'; x.lineWidth = 2;
  for (let i = 0; i < 8; i++) { x.beginPath(); x.ellipse(16 + i * 32, 16, 10, 9, 0, 0, Math.PI * 2); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return t;
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
