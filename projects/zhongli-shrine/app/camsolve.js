// 老照片相機反求：照片上的點 ↔ 3D 模型上的點，算出當年相機的位置、方向與焦距。
// 先用 DLT（直接線性轉換）求初值，再用 Levenberg–Marquardt 只調 7 個參數
// （相機位置 3、旋轉 3、焦距 1），主點固定在照片中心。
// 影像座標：u 向右、v 向下，單位是照片原始像素。

/* ---------- 小型線性代數 ---------- */
function jacobiEigen(S) {                 // 對稱矩陣特徵分解，回傳 { values, vectors(欄) }
  const n = S.length, A = S.map(r => r.slice()), V = A.map((_, i) => A.map((_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: A.map((r, i) => r[i]), vectors: V };
}
function solveLinear(M, b) {              // 高斯消去（小矩陣）
  const n = b.length, A = M.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
    [A[i], A[p]] = [A[p], A[i]];
    if (Math.abs(A[i][i]) < 1e-15) return null;
    for (let k = i + 1; k < n; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = A[i][n]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
  return x;
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const nrm = a => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* ---------- 旋轉向量 ↔ 旋轉矩陣（列為相機的 x 右、y 下、z 前）---------- */
function rodrigues(r) {
  const th = nrm(r); if (th < 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const k = scl(r, 1 / th), c = Math.cos(th), s = Math.sin(th), v = 1 - c;
  return [
    [c + k[0] * k[0] * v, k[0] * k[1] * v - k[2] * s, k[0] * k[2] * v + k[1] * s],
    [k[1] * k[0] * v + k[2] * s, c + k[1] * k[1] * v, k[1] * k[2] * v - k[0] * s],
    [k[2] * k[0] * v - k[1] * s, k[2] * k[1] * v + k[0] * s, c + k[2] * k[2] * v]
  ];
}
function invRodrigues(R) {
  const tr = R[0][0] + R[1][1] + R[2][2], c = Math.max(-1, Math.min(1, (tr - 1) / 2)), th = Math.acos(c);
  if (th < 1e-9) return [0, 0, 0];
  if (Math.PI - th < 1e-6) {               // 接近 180°
    const i = [0, 1, 2].reduce((m, k) => R[k][k] > R[m][m] ? k : m, 0);
    const v = [0, 0, 0]; v[i] = Math.sqrt((R[i][i] + 1) / 2);
    for (let k = 0; k < 3; k++) if (k !== i) v[k] = R[i][k] / (2 * v[i]);
    return scl(v, th);
  }
  const k = [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]];
  return scl(k, th / (2 * Math.sin(th)));
}

/* ---------- 投影 ---------- */
function project(par, X, cx, cy) {         // par = [Cx,Cy,Cz, rx,ry,rz, logf]
  const R = rodrigues(par.slice(3, 6)), d = sub(X, par.slice(0, 3)), f = Math.exp(par[6]);
  const x = dot(R[0], d), y = dot(R[1], d), z = dot(R[2], d);
  return [cx + f * x / z, cy + f * y / z, z];
}

/* ---------- DLT 初值 ---------- */
function dlt(pairs, cx, cy) {
  // 正規化（Hartley），讓數值穩定
  const n = pairs.length;
  const mu = [0, 0], m3 = [0, 0, 0];
  pairs.forEach(p => { mu[0] += p.uv[0] / n; mu[1] += p.uv[1] / n; m3[0] += p.xyz[0] / n; m3[1] += p.xyz[1] / n; m3[2] += p.xyz[2] / n; });
  let s2 = 0, s3 = 0;
  pairs.forEach(p => { s2 += Math.hypot(p.uv[0] - mu[0], p.uv[1] - mu[1]) / n; s3 += nrm(sub(p.xyz, m3)) / n; });
  s2 = Math.SQRT2 / s2; s3 = Math.sqrt(3) / s3;
  const A = [];
  pairs.forEach(p => {
    const u = (p.uv[0] - mu[0]) * s2, v = (p.uv[1] - mu[1]) * s2;
    const X = (p.xyz[0] - m3[0]) * s3, Y = (p.xyz[1] - m3[1]) * s3, Z = (p.xyz[2] - m3[2]) * s3;
    A.push([X, Y, Z, 1, 0, 0, 0, 0, -u * X, -u * Y, -u * Z, -u]);
    A.push([0, 0, 0, 0, X, Y, Z, 1, -v * X, -v * Y, -v * Z, -v]);
  });
  const AtA = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => A.reduce((s, r) => s + r[i] * r[j], 0)));
  const { values, vectors } = jacobiEigen(AtA);
  const k = values.indexOf(Math.min(...values));
  const h = vectors.map(r => r[k]);
  let Pn = [h.slice(0, 4), h.slice(4, 8), h.slice(8, 12)];
  // 反正規化：P = T2⁻¹ · Pn · T3
  const T3 = [[s3, 0, 0, -s3 * m3[0]], [0, s3, 0, -s3 * m3[1]], [0, 0, s3, -s3 * m3[2]], [0, 0, 0, 1]];
  const T2i = [[1 / s2, 0, mu[0]], [0, 1 / s2, mu[1]], [0, 0, 1]];
  const mul = (X, Y) => X.map(r => Y[0].map((_, j) => r.reduce((s, v, i) => s + v * Y[i][j], 0)));
  let P = mul(mul(T2i, Pn), T3);
  // 讓點在相機前方（深度為正）
  const depth = p => P[2][0] * p.xyz[0] + P[2][1] * p.xyz[1] + P[2][2] * p.xyz[2] + P[2][3];
  if (depth(pairs[0]) < 0) P = P.map(r => r.map(v => -v));
  const M = P.map(r => r.slice(0, 3)), p4 = P.map(r => r[3]);
  const Minv = (() => { const c = [0, 1, 2].map(j => solveLinear(M, [0, 1, 2].map(i => (i === j ? 1 : 0)))); return [0, 1, 2].map(i => c.map(col => col[i])); })();
  const C = [0, 1, 2].map(i => -(Minv[i][0] * p4[0] + Minv[i][1] * p4[1] + Minv[i][2] * p4[2]));
  // 由 M 的列拆出 K 與 R（主點用照片中心）
  const lam = 1 / nrm(M[2]);
  const r3 = scl(M[2], lam);
  const a1 = sub(scl(M[0], lam), scl(r3, cx)), a2 = sub(scl(M[1], lam), scl(r3, cy));
  const fx = nrm(a1), fy = nrm(a2);
  let r1 = scl(a1, 1 / fx), r2 = scl(a2, 1 / fy);
  r2 = sub(r2, scl(r1, dot(r1, r2))); r2 = scl(r2, 1 / nrm(r2));        // 正交化
  let r3o = cross(r1, r2);
  if (dot(r3o, r3) < 0) r3o = scl(r3o, -1);
  return [...C, ...invRodrigues([r1, r2, r3o]), Math.log((fx + fy) / 2)];
}

/* ---------- Levenberg–Marquardt 微調 ---------- */
function refine(par, pairs, cx, cy, iters = 200, prior = null) {
  const resid = q => {
    const r = pairs.flatMap(p => { const [u, v, z] = project(q, p.xyz, cx, cy); return z <= 0 ? [1e4, 1e4] : [u - p.uv[0], v - p.uv[1]]; });
    return prior ? r.concat(prior(q)) : r;
  };
  const cost = r => r.reduce((s, x) => s + x * x, 0);
  let r = resid(par), c = cost(r), lam = 1e-3;
  for (let it = 0; it < iters; it++) {
    const J = [];
    for (let j = 0; j < 7; j++) {
      const h = j < 3 ? 1e-4 * Math.max(1, Math.abs(par[j])) : 1e-6;
      const q = par.slice(); q[j] += h;
      const rj = resid(q);
      J.push(rj.map((x, i) => (x - r[i]) / h));
    }
    const JtJ = J.map(a => J.map(b => a.reduce((s, x, i) => s + x * b[i], 0)));
    const Jtr = J.map(a => a.reduce((s, x, i) => s + x * r[i], 0));
    let improved = false;
    for (let t = 0; t < 10; t++) {
      const H = JtJ.map((row, i) => row.map((v, j) => v + (i === j ? lam * (v || 1) : 0)));
      const d = solveLinear(H, Jtr.map(x => -x));
      if (!d) { lam *= 10; continue; }
      const q = par.map((v, i) => v + d[i]);
      const rq = resid(q), cq = cost(rq);
      if (cq < c) { par = q; r = rq; lam = Math.max(lam / 10, 1e-9); improved = Math.abs(c - cq) > 1e-10 * c; c = cq; break; }
      lam *= 10;
    }
    if (!improved) break;
  }
  return par;
}

/**
 * pairs: [{ uv:[u,v] 照片像素, xyz:[x,y,z] 世界座標 }]，至少 6 組
 * 回傳 { position, quaternionBasis:{x,y,z}（three.js 相機軸）, fovV, f, errors[], rms }
 */
/* 由「相機位置＋看向哪裡＋焦距」組出參數（相機保持水平，不歪頭）*/
function lookAtPar(C, T, f) {
  const fwd = sub(T, C), r3 = scl(fwd, 1 / nrm(fwd));
  let r1 = cross(r3, [0, -1, 0]);                    // 影像 y 朝下，所以世界的「下」是 -y
  if (nrm(r1) < 1e-6) r1 = [1, 0, 0];
  r1 = scl(r1, 1 / nrm(r1));
  const r2 = cross(r3, r1);
  return [...C, ...invRodrigues([r1, r2, r3]), Math.log(f)];
}

/* 先驗：真實照片的相機幾乎是水平的（不歪頭），視角也在合理範圍。
   點很少、或點都在同一個平面上時（例如全點在鳥居上），靠這些先驗才不會解出怪答案。 */
function makePrior(width, height, n) {
  const w = Math.max(1, 6 / n) * 40;                 // 點越少，先驗越重要
  return q => {
    const R = rodrigues(q.slice(3, 6)), f = Math.exp(q[6]);
    const roll = R[0][1];                            // 相機 x 軸的垂直分量：0 = 水平
    const fov = 2 * Math.atan(height / 2 / f) * 180 / Math.PI;
    const fovPen = fov < 20 ? 20 - fov : fov > 80 ? fov - 80 : 0;
    return [roll * w * 10, fovPen * w];
  };
}

export function solveCamera(pairs, width, height) {
  if (pairs.length < 4) return null;
  const cx = width / 2, cy = height / 2;
  const prior = makePrior(width, height, pairs.length);
  const cost = q => {
    let c = 0;
    for (const p of pairs) { const [u, v, z] = project(q, p.xyz, cx, cy); if (z <= 0) return Infinity; c += (u - p.uv[0]) ** 2 + (v - p.uv[1]) ** 2; }
    return c + prior(q).reduce((s, x) => s + x * x, 0);
  };
  // 多個起點一起試，取最好的：DLT（點夠多、不共面時最好）＋ 圍繞目標一圈的猜測位置
  const cen = [0, 1, 2].map(k => pairs.reduce((s, p) => s + p.xyz[k], 0) / pairs.length);
  const span = Math.max(...pairs.map(p => nrm(sub(p.xyz, cen)))) || 5;
  const starts = [];
  if (pairs.length >= 6) { try { const d = dlt(pairs, cx, cy); if (d.every(isFinite)) starts.push(d); } catch (e) {} }
  for (let a = 0; a < 360; a += 30) for (const dk of [2, 4, 8]) for (const fovG of [35, 55]) {
    const rad = a * Math.PI / 180, dist = span * dk;
    const C = [cen[0] + Math.sin(rad) * dist, cen[1] + Math.max(1.5, span * 0.3), cen[2] + Math.cos(rad) * dist];
    starts.push(lookAtPar(C, cen, height / 2 / Math.tan(fovG * Math.PI / 360)));
  }
  let par = null, best = Infinity;
  for (const s0 of starts) {
    if (cost(s0) === Infinity) continue;
    const q = refine(s0, pairs, cx, cy, 60, prior), c = cost(q);
    if (c < best) { best = c; par = q; }
  }
  if (!par) return null;
  par = refine(par, pairs, cx, cy, 300, prior);
  const R = rodrigues(par.slice(3, 6)), f = Math.exp(par[6]);
  const errors = pairs.map(p => { const [u, v] = project(par, p.xyz, cx, cy); return { du: u - p.uv[0], dv: v - p.uv[1], e: Math.hypot(u - p.uv[0], v - p.uv[1]), uv: [u, v] }; });
  const rms = Math.sqrt(errors.reduce((s, e) => s + e.e * e.e, 0) / errors.length);
  return {
    position: par.slice(0, 3),
    // three.js 相機：x = 右、y = 上、z = 往後
    axes: { x: R[0], y: scl(R[1], -1), z: scl(R[2], -1) },
    fovV: 2 * Math.atan(height / 2 / f) * 180 / Math.PI,
    f, errors, rms,
    project: xyz => project(par, xyz, cx, cy)
  };
}
