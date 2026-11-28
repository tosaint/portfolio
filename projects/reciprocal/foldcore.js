// ===== 摺紙皮層：Miura-ori（剛性摺疊，封閉公式解）=====
// 單元：平行四邊形，邊長 a（縱向）、b（鋸齒向）、銳角 γ；θ = 面板與基準面的夾角（0 攤平 → 90° 收攏）
const FC = {};
FC.miura = function (P, thetaDeg) {
  const g = P.gamma * Math.PI / 180, th = thetaDeg * Math.PI / 180, a = P.a, b = P.b;
  const k = Math.sqrt(1 + Math.cos(th) ** 2 * Math.tan(g) ** 2);
  return { H: a * Math.sin(th) * Math.sin(g), S: b * Math.cos(th) * Math.tan(g) / k, L: a * Math.sqrt(1 - Math.sin(th) ** 2 * Math.sin(g) ** 2), V: b / k };
};
// 頂點（摺疊後）：x 鋸齒向（收合方向）、y 縱向、z 出平面
FC.verts = function (P, thetaDeg) {
  const m = FC.miura(P, thetaDeg), out = [];
  for (let j = 0; j <= P.ny; j++) for (let i = 0; i <= P.nx; i++) out.push([i * m.S, j * m.L + (i % 2 ? m.V : 0), (j % 2 ? m.H : 0)]);
  return { pts: out, m, W: P.nx * m.S, Ht: P.ny * m.L + m.V, idx: (i, j) => j * (P.nx + 1) + i };
};
// 摺痕（攤平座標）：type = cut / mountain / valley
FC.creases = function (P) {
  const F = FC.verts(P, 0), p = F.pts, id = F.idx, L = [];
  const seg = (u, v, type) => L.push({ x1: p[u][0], y1: p[u][1], x2: p[v][0], y2: p[v][1], type });
  for (let j = 0; j <= P.ny; j++) for (let i = 0; i < P.nx; i++) seg(id(i, j), id(i + 1, j), (j === 0 || j === P.ny) ? 'cut' : (j % 2 ? 'mountain' : 'valley'));
  for (let i = 0; i <= P.nx; i++) for (let j = 0; j < P.ny; j++) seg(id(i, j), id(i, j + 1), (i === 0 || i === P.nx) ? 'cut' : ((i + j) % 2 ? 'valley' : 'mountain'));
  return { lines: L, W: F.W, H: F.Ht };
};
FC.outlineOf = function (P) {
  const F = FC.verts(P, 0), id = F.idx, p = F.pts, o = [];
  for (let i = 0; i <= P.nx; i++) o.push(p[id(i, 0)]); for (let j = 1; j <= P.ny; j++) o.push(p[id(P.nx, j)]); for (let i = P.nx - 1; i >= 0; i--) o.push(p[id(i, P.ny)]); for (let j = P.ny - 1; j >= 1; j--) o.push(p[id(0, j)]);
  return o.map(q => [q[0], q[1]]);
};
FC.svgFrom = function (C) {
  const f = v => v.toFixed(2), col = { cut: '#ff0000', mountain: '#0000ff', valley: '#00a000' };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(C.W + 10)}mm" height="${f(C.H + 22)}mm" viewBox="-5 -5 ${f(C.W + 10)} ${f(C.H + 22)}">` +
    C.lines.map(l => `<line x1="${f(l.x1)}" y1="${f(C.H - l.y1)}" x2="${f(l.x2)}" y2="${f(C.H - l.y2)}" stroke="${col[l.type]}" stroke-width="0.15"${l.type === 'valley' ? ' stroke-dasharray="1.5,1"' : ''}/>`).join('') +
    `<line x1="0" y1="${f(C.H + 8)}" x2="50" y2="${f(C.H + 8)}" stroke="#000" stroke-width="0.2"/><text x="0" y="${f(C.H + 14)}" font-size="3.5">校正尺 50 mm · 紅＝切割 · 藍實線＝山摺 · 綠虛線＝谷摺（從室外側看；雷切請用低功率淺刻）</text></svg>`;
};
FC.svg = P => FC.svgFrom(FC.creases(P));
// 3D 列印：平放的薄片，摺痕處做薄化的活鉸鏈槽（谷摺槽在上、山摺槽在下）
FC.hingeFrom = function (W, C, outline, tp, gw) {
  const M = W.Manifold, sheet = new W.CrossSection([outline], 'Positive').extrude(tp);
  const cuts = C.lines.filter(l => l.type !== 'cut').map(l => { const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy), d = tp - 0.35;
    return M.cube([len + 0.02, gw, d + 0.01], false).translate([-0.01, -gw / 2, l.type === 'valley' ? tp - d : -0.01]).rotate([0, 0, Math.atan2(dy, dx) * 180 / Math.PI]).translate([l.x1, l.y1, 0]); });
  return sheet.subtract(M.union(cuts));
};
FC.hingeSheet = (W, P, tp, gw) => FC.hingeFrom(W, FC.creases(P), FC.outlineOf(P), tp, gw);

// ===== 單元式開合：正 n 邊形的傘狀摺（2n 片三角板繞中心，對稱摺疊，單一自由度）=====
// 中心 O、角點 A（半徑 R）、邊中點 M（半徑 R·cosβ，β = π/n）。
// φM = 「中心→邊中點」摺線相對牆面的傾角（0 攤平 → 90° 立起）；φA 由面板不變形的條件解出：
//   cosφA·cosφM·cosβ + sinφA·sinφM = cosβ
FC.unit = function (n, R, phiMdeg) {
  const be = Math.PI / n, pm = phiMdeg * Math.PI / 180, cb = Math.cos(be);
  const Pk = Math.sqrt(cb * cb * Math.cos(pm) ** 2 + Math.sin(pm) ** 2), de = Math.atan2(Math.sin(pm), cb * Math.cos(pm));
  const pa = de - Math.acos(Math.min(1, cb / Pk));
  return { phiA: pa, rA: R * Math.cos(pa), zO: R * Math.sin(pa), rM: R * cb * Math.cos(pm), zM: R * Math.sin(pa) - R * cb * Math.sin(pm), beta: be };
};
// 單元的點（局部座標，角點所在平面 z = 0，中心往外）：回傳 O、A[]、M[]
FC.unitPts = function (n, R, phiMdeg, cx, cy, rot) {
  const u = FC.unit(n, R, phiMdeg), A = [], M = [];
  for (let k = 0; k < n; k++) { const t = rot + 2 * Math.PI * k / n; A.push([cx + u.rA * Math.cos(t), cy + u.rA * Math.sin(t), 0]); M.push([cx + u.rM * Math.cos(t + u.beta), cy + u.rM * Math.sin(t + u.beta), u.zM]); }
  return { O: [cx, cy, u.zO], A, M, u };
};
// 鋪排：三角（正反交錯）、四方、六角；回傳每個單元的中心、轉角與外接半徑
FC.unitLayout = function (P) {
  const s = P.us, out = [];
  if (P.unit === 'sq') { const R = s / Math.SQRT2; for (let j = 0; j < P.uy; j++) for (let i = 0; i < P.ux; i++) out.push({ x: (i + 0.5) * s, y: (j + 0.5) * s, rot: Math.PI / 4, R, n: 4 }); }
  else if (P.unit === 'hex') { const R = s / Math.sqrt(3), dx = s, dy = 1.5 * R; for (let j = 0; j < P.uy; j++) for (let i = 0; i < P.ux; i++) out.push({ x: (i + 0.5) * dx + (j % 2 ? dx / 2 : 0), y: R + j * dy, rot: Math.PI / 2, R, n: 6 }); }
  else { const R = s / Math.sqrt(3), h = s * Math.sqrt(3) / 2; for (let j = 0; j < P.uy; j++) for (let i = 0; i < P.ux; i++) { const up = (i + j) % 2 === 0; out.push({ x: (i + 1) * s / 2, y: j * h + (up ? h / 3 : 2 * h / 3), rot: up ? Math.PI / 2 : -Math.PI / 2, R, n: 3 }); } }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  out.forEach(c => { for (let k = 0; k < c.n; k++) { const t = c.rot + 2 * Math.PI * k / c.n, x = c.x + c.R * Math.cos(t), y = c.y + c.R * Math.sin(t); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  out.forEach(c => { c.x -= x0; c.y -= y0; });
  return { cells: out, W: x1 - x0, H: y1 - y0 };
};
// 單一單元的摺痕圖（攤平）：中心→角點＝山摺，中心→邊中點＝谷摺（從室外側看）
FC.unitCreases = function (P) {
  const c = FC.unitLayout({ ...P, ux: 1, uy: 1 }).cells[0], q = FC.unitPts(c.n, c.R, 0, c.R, c.R, c.rot), L = [], n = c.n;
  for (let k = 0; k < n; k++) { const a = q.A[k], b = q.A[(k + 1) % n];
    L.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], type: 'cut' }, { x1: q.O[0], y1: q.O[1], x2: a[0], y2: a[1], type: 'mountain' }, { x1: q.O[0], y1: q.O[1], x2: q.M[k][0], y2: q.M[k][1], type: 'valley' }); }
  return { lines: L, W: 2 * c.R, H: 2 * c.R, outline: q.A.map(a => [a[0], a[1]]) };
};
// 太陽位置（太陽時）：緯度、一年中的第幾天、時刻 → 高度角與方位角（由正南起算、偏西為正），單位度
FC.sun = function (latDeg, day, hour) {
  const r = Math.PI / 180, la = latDeg * r, de = 23.44 * r * Math.sin(2 * Math.PI * (284 + day) / 365), H = 15 * (hour - 12) * r;
  const sinAlt = Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(H);
  return { alt: Math.asin(sinAlt) / r, az: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(la) - Math.tan(de) * Math.cos(la)) / r };
};
if (typeof module !== 'undefined') module.exports = FC;
