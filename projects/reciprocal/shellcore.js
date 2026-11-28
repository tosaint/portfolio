// ===== 拓樸互鎖殼（筒形拱）：在「攤平」座標建立互鎖塊，再彎到圓筒上 =====
// 攤平座標：x = 弧長 s、y = 長向 v、z = 徑向 ζ；彎曲後：X 跨向、Y 向上、Z 長向（= -v）
// 需要 panelcore.js（PC）與 manifold（W）
const SC = {};
SC.derive = function (P) {
  const S = P.span, h = Math.min(P.rise, S / 2 - 1), R = (S * S / 4 + h * h) / (2 * h), beta = Math.asin(Math.min(1, S / (2 * R)));
  const W = 2 * R * beta, fw = Math.min(P.frame, (Math.PI / 2 - beta) * R - 0.5), betaE = beta + fw / R;
  const c = (R - P.t / 2) * Math.cos(betaE) - P.footH;                 // 圓心在 Y = -c
  const a = P.t / 2 * Math.tan(P.alpha * Math.PI / 180), vc = P.length / 2 - (a + P.gap + 0.05);   // A／B 兩件的分界
  const xin = (R - P.t / 2) * Math.sin(beta) - 1.5, xo = (R + P.t / 2) * Math.sin(betaE) + 3, ytop = R * Math.cos(beta + 0.5 * fw / R) - c;
  return { R, beta, betaE, W, fw, c, a, vc, xin, xo, ytop, h };
};
SC.flatP = (P, D) => ({ W: D.W, H: P.length, N: P.N, M: P.M, t: P.t, alpha: P.alpha, bulge: 0, gap: P.gap, pattern: 'checker', edgeType: 'straight', seed: 1, randomTilt: false, flips: [], hole: 'none', frame: D.fw });
SC.bend = (D) => v => { const th = v[0] / D.R, r = D.R + v[2], y = v[1]; v[0] = r * Math.sin(th); v[1] = r * Math.cos(th) - D.c; v[2] = -y; };
SC.flatBlock = (W, Q, E, i, j, K, tri, gap) => { const z = Q.t / 2, G = gap === undefined ? Q : { ...Q, gap }; return PC.toManifold(W, PC.loftMesh(PC.outline(G, E, i, j, -z, K), PC.outline(G, E, i, j, z, K), -z, z, 0, 0, 0, tri)); };

// 全部實體：blocks[]（彎曲後）、A（底座＋拱腳＋固定端拱）、B（可拆端拱＝鎖）、C（胎架）
SC.build = function (W, P, tri) {
  const D = SC.derive(P), Q = SC.flatP(P, D), E = PC.edges(Q), K = 12,
    _ = E.v[0].forEach((e, j) => { e.t = 0; E.v[Q.N][j].t = 0; }),   // 貼拱腳的側面不做斜面：邊排的塊才能沿長向滑入
    bend = SC.bend(D), M = W.Manifold, rl = P.refine || 1.5;
  const warp = m => m.refineToLength(rl).warp(bend);
  const blocks = [];
  for (let j = 0; j < Q.M; j++) for (let i = 0; i < Q.N; i++) {
    const L = PC.lock(Q, E, i, j), code = L.sides.join(',');
    const rot = [L.sides[1], L.sides[0], L.sides[3], L.sides[2]].join(',');
    blocks.push({ i, j, lock: L, sig: code < rot ? code : rot, solid: warp(SC.flatBlock(W, Q, E, i, j, K, tri)) });
  }
  const hp = []; for (let j = 0; j < Q.M; j++) for (let i = 0; i < Q.N; i++) hp.push(SC.flatBlock(W, Q, E, i, j, K, tri, -Math.max(P.gap, 0.02)));
  const hole = warp(M.union(hp).scale([1, 1, (Q.t + 1) / Q.t]));
  const H = P.length, fw = D.fw, box = (x0, x1, y0, y1, z0, z1) => M.cube([x1 - x0, y1 - y0, z1 - z0], false).translate([x0, y0, z0]);
  const ringA = warp(M.cube([D.W + 2 * fw, D.vc + H / 2 + fw, Q.t], true).translate([0, (D.vc - H / 2 - fw) / 2, 0]));
  const ringB = warp(M.cube([D.W + 2 * fw, H / 2 + fw - D.vc, Q.t], true).translate([0, (D.vc + H / 2 + fw) / 2, 0]));
  const zA1 = H / 2 + fw, zc = -D.vc, zB0 = -(H / 2 + fw), pr = Math.min(2, D.ytop / 2 - 1.2), px = (D.xin + D.xo) / 2, py = D.ytop / 2;
  const both = f => [f(1), f(-1)];
  const plate = box(-D.xo, D.xo, -P.plate, 0, zB0, zA1);
  const abut = both(s => box(Math.min(s * D.xin, s * D.xo), Math.max(s * D.xin, s * D.xo), 0, D.ytop, zc, zA1));
  const foot = both(s => box(Math.min(s * D.xin, s * D.xo), Math.max(s * D.xin, s * D.xo), 0.2, D.ytop, zB0, zc - 0.15));
  const pegs = both(s => M.cylinder(7, pr, pr, 24, false).translate([s * px, py, zc - 1]));
  const holes = both(s => M.cylinder(7.2, pr + 0.2, pr + 0.2, 24, false).translate([s * px, py, zc - 0.1]));
  const biggest = m => m.decompose().reduce((a, b) => (b.volume() > a.volume() ? b : a));
  const A = biggest(M.union([ringA, plate, ...abut]).subtract(M.union([hole, ...holes])));
  const B = biggest(M.union([M.union([ringB, ...foot]).subtract(hole), ...pegs]));
  // 胎架：貼著拱腹的薄拱殼＋兩腳，可沿長向抽出
  const Rc = D.R - Q.t / 2 - 0.4, len = H / 2 - zc, xl = D.xin - 0.4, cyl = r => M.cylinder(len, r, r, 96, false).translate([0, -D.c, zc]);
  const legs = both(s => box(Math.min(s * xl, s * (xl - 2.4)), Math.max(s * xl, s * (xl - 2.4)), 0.2, D.c + Rc, zc, H / 2));
  const C = M.union([cyl(Rc).subtract(cyl(Rc - 2.4)), ...legs]).intersect(cyl(Rc)).intersect(box(-xl, xl, 0.2, 999, zc - 1, H / 2 + 1));
  return { D, Q, E, blocks, A, B, C };
};
if (typeof module !== 'undefined') module.exports = SC;
