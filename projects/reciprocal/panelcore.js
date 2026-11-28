// ===== 拓樸互鎖面板：剛性外框＋乾式堆疊塊（Truchet 弧邊、交替斜面）=====
// 平面座標 x（寬）、y（高）；厚度方向 z；單位 mm
const PC = {};
PC.rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// 邊：直向邊 v[i][j]（i = 0..N，左右兩塊之間），橫向邊 h[i][j]（j = 0..M，上下兩塊之間）
// 每條邊兩個屬性：b 弧的鼓出方向（+1 往 +x／+y，-1 反向，0 直邊）；t 斜面方向（+1：越往上越往 +x／+y 偏）
PC.edges = function (P) {
  const N = P.N, M = P.M, rnd = PC.rng(P.seed || 3), v = [], h = [];
  const par = (i, j) => ((i + j) % 2 + 2) % 2;
  for (let i = 0; i <= N; i++) { v.push([]); for (let j = 0; j < M; j++) {
    const t = par(i + 1, j) === 0 ? 1 : -1;      // 棋盤：偶數塊的左右邊上寬
    let b = t;
    if (P.pattern === 'truchet') b = rnd() < 0.5 ? 1 : -1;
    v[i].push({ b: P.edgeType === 'straight' ? 0 : b, t: P.randomTilt ? (rnd() < 0.5 ? 1 : -1) : t });
  } }
  for (let i = 0; i < N; i++) { h.push([]); for (let j = 0; j <= M; j++) {
    const t = par(i + j + 1, 0) === 1 ? 1 : -1;
    let b = t;
    if (P.pattern === 'truchet') b = rnd() < 0.5 ? 1 : -1;
    h[i].push({ b: P.edgeType === 'straight' ? 0 : b, t: P.randomTilt ? (rnd() < 0.5 ? 1 : -1) : t });
  } }
  // 使用者點選翻轉：該塊四條邊的弧（凸↔凹）
  (P.flips || []).forEach(k => { const i = k % N, j = Math.floor(k / N); if (j >= M) return; [v[i][j], v[i + 1][j], h[i][j], h[i][j + 1]].forEach(e => { e.b = -e.b; }); });   // 只翻弧的方向；斜面維持棋盤交替，否則角落會互相干涉
  // 可滑入組裝：左右側面（直向邊）不做弧，貼外框的左右兩面也不做斜面，塊才能沿高度方向一排一排推入
  if (P.assemble) { v.forEach((col, i) => col.forEach(e => { e.b = 0; if (i === 0 || i === N) e.t = 0; })); }
  return { v, h };
};

// 某塊在 z 高度的外輪廓（逆時針：下、右、上、左，各 K 點）
// 每條邊是一條「絕對座標」的曲線（弧＋斜面位移），相鄰兩塊取樣同一條曲線，只差間隙，因此不會互相干涉
PC.outline = function (P, E, i, j, z, K) {
  const w = P.W / P.N, hh = P.H / P.M, x0 = -P.W / 2 + i * w, y0 = -P.H / 2 + j * hh, ta = Math.tan(P.alpha * Math.PI / 180), g = P.gap / 2, bul = P.bulge;
  const L = E.v[i][j], R = E.v[i + 1][j], B = E.h[i][j], T = E.h[i][j + 1];
  const S = u => Math.sin(Math.PI * Math.min(1.25, Math.max(-0.25, u)));   // 不截斷：端點外平滑延伸，避免折點
  const XL = y => x0 + L.t * z * ta + g + L.b * bul * hh * S((y - y0) / hh), XR = y => x0 + w + R.t * z * ta - g + R.b * bul * hh * S((y - y0) / hh);
  const YB = x => y0 + B.t * z * ta + g + B.b * bul * w * S((x - x0) / w), YT = x => y0 + hh + T.t * z * ta - g + T.b * bul * w * S((x - x0) / w);
  const corner = (Xf, Yf, x, y) => { for (let k = 0; k < 12; k++) { x = Xf(y); y = Yf(x); } return [Xf(y), y]; };
  const BL = corner(XL, YB, x0, y0), BR = corner(XR, YB, x0 + w, y0), TR = corner(XR, YT, x0 + w, y0 + hh), TL = corner(XL, YT, x0, y0 + hh), pts = [];
  // 取樣：中段用「名義位置」（不隨 z、不隨鄰塊改變），所以側壁是精確的平移曲面，鄰塊與外框共用同一組母線；
  // 兩端到角點之間各補 2 點。每邊固定 K 點（含起點角、不含終點角）
  const n = K - 5, mOf = len => Math.min(0.3, Math.max(0.06, (P.t / 2 * ta + P.gap + 1.5) / len + 0.04));
  const side = (s0, s1, o, len, rev, f) => {
    const m = mOf(len), c = []; for (let q = 0; q < n; q++) c.push(o + len * (m + (1 - 2 * m) * q / (n - 1))); if (rev) c.reverse();
    const out = [s0, s0 + (c[0] - s0) / 3, s0 + (c[0] - s0) * 2 / 3, ...c, c[n - 1] + (s1 - c[n - 1]) / 3, c[n - 1] + (s1 - c[n - 1]) * 2 / 3];
    out.forEach((v, k) => pts.push(k ? f(v) : null));
  };
  let at = pts.length; side(BL[0], BR[0], x0, w, false, x => [x, YB(x)]); pts[at] = BL;
  at = pts.length; side(BR[1], TR[1], y0, hh, false, y => [XR(y), y]); pts[at] = BR;
  at = pts.length; side(TR[0], TL[0], x0, w, true, x => [x, YT(x)]); pts[at] = TR;
  at = pts.length; side(TL[1], BL[1], y0, hh, true, y => [XL(y), y]); pts[at] = TL;
  return pts;
};

// 互鎖檢查：塊要有一條邊「上寬」（擋住往下掉）和一條邊「上窄」（擋住往上推）
PC.lock = function (P, E, i, j) {
  const sides = [-E.v[i][j].t, E.v[i + 1][j].t, -E.h[i][j].t, E.h[i][j + 1].t]; // +1 = 該邊上寬
  return { down: sides.some(s => s > 0), up: sides.some(s => s < 0), sides };
};

// 塊的種類簽名：四邊（凸凹、上寬窄）＋孔級；正方格允許 90° 旋轉同型
PC.signature = function (P, E, i, j, holeLv) {
  const ed = [[E.h[i][j], -1], [E.v[i + 1][j], 1], [E.h[i][j + 1], 1], [E.v[i][j], -1]];
  const code = ed.map(([e, s]) => `${e.b * s}${e.t * s}`);
  const sq = Math.abs(P.W / P.N - P.H / P.M) < 1e-6;
  let best = code.join('|');
  if (sq) for (let r = 1; r < 4; r++) { const c = code.slice(r).concat(code.slice(0, r)).join('|'); if (c < best) best = c; }
  return best + '#' + holeLv;
};

// 開孔半徑場
PC.holeR = function (P, i, j) {
  if (P.hole === 'none') return 0;
  const w = P.W / P.N, hh = P.H / P.M, x = -P.W / 2 + (i + 0.5) * w, y = -P.H / 2 + (j + 0.5) * hh;
  let f;
  if (P.hole === 'grad') { const a = P.hdir * Math.PI / 180, pr = x * Math.cos(a) + y * Math.sin(a), half = (Math.abs(P.W * Math.cos(a)) + Math.abs(P.H * Math.sin(a))) / 2; f = (pr / half + 1) / 2; }
  else if (P.hole === 'wave') { const a = P.hdir * Math.PI / 180, pr = x * Math.cos(a) + y * Math.sin(a); f = 0.5 + 0.5 * Math.sin(2 * Math.PI * pr / P.hwl); }
  else { const d = Math.hypot(x - P.ax, y - P.ay); f = Math.max(0, 1 - d / P.ar); }
  if (P.hflip) f = 1 - f;
  f = Math.round(Math.min(1, Math.max(0, f)) * (P.hlv - 1)) / (P.hlv - 1);
  const rmax = Math.min(w, hh) / 2 - Math.max(P.bulge * Math.max(w, hh), 0) - P.t * Math.tan(P.alpha * Math.PI / 180) - 2.5;
  return f * Math.min(P.hmax, Math.max(0, rmax));
};

// 由上下兩層輪廓（＋可選圓孔）建立封閉三角網格
PC.loftMesh = function (bot, top, zb, zt, hole, cx, cy, triangulate) {
  const n = bot.length, V = [], T = [];
  bot.forEach(p => V.push(p[0], p[1], zb)); top.forEach(p => V.push(p[0], p[1], zt));
  let hk = 0;
  const holePts = [];
  if (hole > 0) { hk = 32; for (let k = 0; k < hk; k++) { const a = -2 * Math.PI * k / hk; holePts.push([cx + hole * Math.cos(a), cy + hole * Math.sin(a)]); } holePts.forEach(p => V.push(p[0], p[1], zb)); holePts.forEach(p => V.push(p[0], p[1], zt)); }
  const capB = triangulate(bot, hole > 0 ? [holePts] : []), capT = triangulate(top, hole > 0 ? [holePts] : []);
  const idxB = k => k < n ? k : 2 * n + (k - n), idxT = k => k < n ? n + k : 2 * n + hk + (k - n);
  capB.forEach(f => T.push(idxB(f[0]), idxB(f[2]), idxB(f[1])));
  capT.forEach(f => T.push(idxT(f[0]), idxT(f[1]), idxT(f[2])));
  for (let k = 0; k < n; k++) { const a = k, b = (k + 1) % n; T.push(a, b, n + b, a, n + b, n + a); }
  for (let k = 0; k < hk; k++) { const a = 2 * n + k, b = 2 * n + (k + 1) % hk; T.push(a, b, hk + b, a, hk + b, hk + a); }
  return { V: new Float32Array(V), T: new Uint32Array(T) };
};

// 整片面板的外框輪廓：取邊界塊的外側邊（不含間隙），每段含兩端角點，台階處與塊完全吻合
PC.boundary = function (P, E, z, K) {
  const N = P.N, M = P.M, Q = { ...P, gap: 0 }, pts = [];
  const side = (i, j, k) => { const o = PC.outline(Q, E, i, j, z, K); for (let q = 0; q <= K; q++) pts.push(o[(k * K + q) % (4 * K)]); };
  for (let i = 0; i < N; i++) side(i, 0, 0);
  for (let j = 0; j < M; j++) side(N - 1, j, 1);
  for (let i = N - 1; i >= 0; i--) side(i, M - 1, 2);
  for (let j = M - 1; j >= 0; j--) side(0, j, 3);
  // 去掉重複點
  return pts.filter((p, k) => { const q = pts[(k + 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
};

// 外框實體：內孔 = 所有塊（間隙取 -0.02，略為重疊以利聯集）的聯集，再沿厚度略為延伸。
// 這樣外框內壁與邊界塊的斜面、台階完全是同一組曲面
PC.frameSolid = function (W, P, E, K, triangulate) {
  const z = P.t / 2, Q = { ...P, gap: -Math.max(P.gap, 0.02) }, parts = [];   // 外框與塊的間隙 = 塊與塊的間隙
  for (let j = 0; j < P.M; j++) for (let i = 0; i < P.N; i++) parts.push(PC.toManifold(W, PC.loftMesh(PC.outline(Q, E, i, j, -z, K), PC.outline(Q, E, i, j, z, K), -z, z, 0, 0, 0, triangulate)));
  const hole = W.Manifold.union(parts).scale([1, 1, (P.t + 1) / P.t]);
  const M = W.Manifold, biggest = m => m.decompose().reduce((a, b) => (b.volume() > a.volume() ? b : a));
  const X = P.W / 2 + P.frame, Y = P.H / 2 + P.frame, box = (y0, y1) => M.cube([2 * X, y1 - y0, P.t], false).translate([-X, y0, -P.t / 2]);
  if (!P.assemble) return { A: biggest(box(-Y, Y).subtract(hole)), B: null };
  // 拆成兩件：A = ㄇ形（下邊＋左右兩邊），B = 上邊（鎖），用兩支圓榫沿滑入方向插進 A
  const ta = Math.tan(P.alpha * Math.PI / 180), yc = P.H / 2 - (P.t / 2 * ta + (P.edgeType === 'straight' ? 0 : P.bulge * P.W / P.N) + P.gap + 0.3);
  const pr = Math.max(0.8, Math.min(2, P.t / 2 - 1.2, P.frame / 2 - 1.2)), px = P.W / 2 + P.frame / 2;
  const peg = (r, y0, len) => [1, -1].map(sg => M.cylinder(len, r, r, 24, false).rotate([90, 0, 0]).translate([sg * px, y0, 0]));
  const A = biggest(box(-Y, yc).subtract(M.union([hole, ...peg(pr + 0.2, yc + 0.1, 7.2)])));
  const B = biggest(M.union([box(yc + 0.15, Y).subtract(hole), ...peg(pr, yc + 1.15, 7)]));
  return { A, B, yc, pr };
};
// 組裝檢查：每一塊沿 +y 退出時不碰到同排鄰塊、前一排與 A；B 沿 +y 退出時不碰到任何塊與 A
PC.slideCheck = function (W, P, blocks, F) {
  let worst = 0; const M = W.Manifold;
  for (const b of blocks) { const env = M.union([F.A, ...blocks.filter(o => o !== b && o.j <= b.j && b.j - o.j <= 1 && Math.abs(o.i - b.i) <= 1).map(o => o.solid)]);
    for (const d of [0.6, 3, 12, P.H]) worst = Math.max(worst, b.solid.translate([0, d, 0]).intersect(env).volume()); }
  const all = M.union([F.A, ...blocks.map(b => b.solid)]);
  for (const d of [0.6, 3, 10]) worst = Math.max(worst, F.B.translate([0, d, 0]).intersect(all).volume());
  return worst;
};
PC.toManifold = function (W, mesh) { return new W.Manifold(new W.Mesh({ numProp: 3, vertProperties: mesh.V, triVerts: mesh.T })); };

if (typeof module !== 'undefined') module.exports = PC;
