// ===== 先有形 → 三角網格 → 互承化（竹籤線架構／紙板面鋪板共用接點）=====
// 座標：x 跨向、y 向上、z 長向；單位 mm
const MC = {};
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
};
MC.v3 = v3;

// 可重現的亂數
MC.rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---- 目標形：雙排 2×n 腳（rows）或環狀 N 腳（ring）----
// P.feet = [[x, z, h], ...]；rows：前 n 個為 z<0 側（由 x 小到大），後 n 個為 z>0 側
const hash2 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const sp = (t, p) => Math.pow(Math.max(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0), p);
function gatherAt(P, p, f) {
  const lowness = Math.max(0, 1 - (p[1] - f[2]) / Math.max(P.gatherH, 1)), k = P.pinch * lowness * lowness;
  if (k <= 0) return p;
  const dx = p[0] - f[0], dz = p[2] - f[1], r = Math.hypot(dx, dz) || 1e-6;
  const tx = f[0] + dx / r * Math.min(r, P.ringR), tz = f[1] + dz / r * Math.min(r, P.ringR);
  return [p[0] + (tx - p[0]) * k, p[1], p[2] + (tz - p[2]) * k];
}
MC.rowsSurface = function (P) {
  const n = P.feet.length / 2, F0 = P.feet.slice(0, n), F1 = P.feet.slice(n);
  const side = (Fs, u) => { const x = u * (n - 1), k = Math.min(n - 2, Math.floor(x)), t = x - k, a = Fs[k], b = Fs[k + 1]; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, h: a[2] + (b[2] - a[2]) * t, t }; };
  const hRaw = (u, v) => {
    const s0 = side(F0, u), s1 = side(F1, u);
    const B0 = s0.h + P.liftL * sp(s0.t, P.edgeShape), B1 = s1.h + P.liftL * sp(s1.t, P.edgeShape);
    const C0 = F0[0][2] * (1 - v) + F1[0][2] * v + P.liftS * sp(v, P.edgeShape), C1 = F0[n - 1][2] * (1 - v) + F1[n - 1][2] * v + P.liftS * sp(v, P.edgeShape);
    const bil = F0[0][2] * (1 - u) * (1 - v) + F0[n - 1][2] * u * (1 - v) + F1[0][2] * (1 - u) * v + F1[n - 1][2] * u * v;
    return (1 - v) * B0 + v * B1 + (1 - u) * C0 + u * C1 - bil;
  };
  const h0 = hRaw(0.5, 0.5), height = (u, v) => hRaw(u, v) + (P.crown - h0) * Math.pow(Math.sin(Math.PI * u) * Math.sin(Math.PI * v), 0.8);
  const footOf = (u, v) => (v < 0.5 ? F0 : F1)[Math.round(u * (n - 1))];
  const at = (u, v) => { const s0 = side(F0, u), s1 = side(F1, u); return gatherAt(P, [s0.x + (s1.x - s0.x) * v, height(u, v), s0.z + (s1.z - s0.z) * v], footOf(u, v)); };
  const arc = (f) => { let L = 0, q = f(0); for (let i = 1; i <= 60; i++) { const r = f(i / 60); L += v3.len(v3.sub(r, q)); q = r; } return L; };
  return { at, arcU: arc(t => at(t, 0.5)), arcV: arc(t => at(0.5, t)), n };
};
MC.ringSurface = function (P) {
  const N = P.feet.length, cx = P.feet.reduce((s, f) => s + f[0], 0) / N, cz = P.feet.reduce((s, f) => s + f[1], 0) / N;
  const ang = P.feet.map(f => Math.atan2(f[1] - cz, f[0] - cx));
  // 依角度排序的柱
  const order = P.feet.map((f, i) => i).sort((a, b) => ang[a] - ang[b]);
  const sector = th => {   // th ∈ [0,1) 繞一圈；回傳所在的兩柱與區段內位置
    const t = th * N, k = Math.floor(t) % N, s = t - Math.floor(t);
    return { a: P.feet[order[k]], b: P.feet[order[(k + 1) % N]], s };
  };
  const rim = th => { const { a, b, s } = sector(th); return [a[0] + (b[0] - a[0]) * s, a[2] + (b[2] - a[2]) * s + P.liftL * sp(s, P.edgeShape), a[1] + (b[1] - a[1]) * s]; };
  const at = (th, r) => {
    const q = rim(th), x = cx + (q[0] - cx) * r, z = cz + (q[2] - cz) * r, y = P.crown + (q[1] - P.crown) * Math.pow(r, P.domeExp || 2);
    const { a, b, s } = sector(th); return gatherAt(P, [x, y, z], s < 0.5 ? a : b);
  };
  // 沿柱子方向（最陡）量弧長，並建立 r ↔ 弧長 對照，讓腳部環距較密
  const prof = [0]; { let q = at(0, 0); for (let i = 1; i <= 120; i++) { const r = at(0, i / 120); prof.push(prof[i - 1] + v3.len(v3.sub(r, q))); q = r; } }
  const rOfS = f => { const t = f * prof[120]; let i = 1; while (i < 120 && prof[i] < t) i++; const a = prof[i - 1], b = prof[i]; return (i - 1 + (t - a) / Math.max(b - a, 1e-9)) / 120; };
  const arcR = () => prof[120];
  const perim = r => { let L = 0, q = at(0, r); for (let i = 1; i <= 120; i++) { const p = at(i / 120, r); L += v3.len(v3.sub(p, q)); q = p; } return L; };
  return { at, arcR: arcR(), perim, N, order, cx, cz, rOfS };
};

function finishMesh(V, F, bnd, UV) {
  const emap = new Map(), E = [];
  F.forEach((f, fi) => { for (let k = 0; k < 3; k++) { const a = f[k], b = f[(k + 1) % 3], key = a < b ? a + '-' + b : b + '-' + a; if (!emap.has(key)) { emap.set(key, E.length); E.push({ a: Math.min(a, b), b: Math.max(a, b), faces: [] }); } E[emap.get(key)].faces.push(fi); } });
  const edgeOf = (a, b) => emap.get(a < b ? a + '-' + b : b + '-' + a);
  // 頂點法線：面法線朝外（遠離中心下方一點）後平均
  let cx = 0, cz = 0, ymin = Infinity, ymax = -Infinity; V.forEach(p => { cx += p[0]; cz += p[2]; ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }); cx /= V.length; cz /= V.length;
  const C = [cx, ymin - (ymax - ymin) * 0.6, cz], N = V.map(() => [0, 0, 0]);
  F.forEach(f => {
    let n = v3.cross(v3.sub(V[f[1]], V[f[0]]), v3.sub(V[f[2]], V[f[0]]));
    const m = v3.mul(v3.add(v3.add(V[f[0]], V[f[1]]), V[f[2]]), 1 / 3); if (v3.dot(n, v3.sub(m, C)) < 0) n = v3.mul(n, -1);
    f.forEach(v => { N[v] = v3.add(N[v], n); });
  });
  return { V, N: N.map(v3.norm), UV, F, E, bnd, edgeOf };
}
function zip(A, B, V, F, closed, KA, KB) {
  if (closed) { A = A.concat([A[0]]); B = B.concat([B[0]]); if (KA) { KA = KA.concat([KA[0] + 1]); KB = KB.concat([KB[0] + 1]); } }
  let a = 0, b = 0;
  while (a < A.length - 1 || b < B.length - 1) {
    const canA = a < A.length - 1, canB = b < B.length - 1; let useA;
    if (canA && canB && KA) { const ka = (KA[a + 1] + KA[a]) / 2, kb = (KB[b + 1] + KB[b]) / 2; useA = Math.abs(ka - kb) < 1e-9 ? (a + b) % 2 === 0 : ka < kb; }
    else if (canA && canB) { const dA = v3.len(v3.sub(V[A[a + 1]], V[B[b]])), dB = v3.len(v3.sub(V[B[b + 1]], V[A[a]])); useA = Math.abs(dA - dB) < 1e-6 ? (a + b) % 2 === 0 : dA < dB; }
    else useA = canA;
    if (useA) { F.push([A[a], A[a + 1], B[b]]); a++; } else { F.push([A[a], B[b + 1], B[b]]); b++; }
  }
}
MC.mesh = function (P) {
  const e = P.edge, sym = P.sym || 'none';
  if (P.layout === 'ring') {
    const G = MC.ringSurface(P), N = G.N, rings = Math.max(2, Math.round(G.arcR / (e * 0.866)));
    const V = [], bnd = [], UV = [], loops = [], keys = [];
    V.push(G.at(0, 0)); bnd.push(false); UV.push([0, 0]); loops.push([0]); keys.push([0]);
    for (let j = 1; j <= rings; j++) {
      const r = G.rOfS(j / rings), per = G.perim(r), cnt = Math.max(N, N * Math.max(1, Math.round(per / (e * N)))), loop = [], key = [];
      const phase = ((rings - j) % 2) * 0.5 / cnt, period = cnt / N;
      for (let i = 0; i < cnt; i++) {
        let th = i / cnt + phase, rr = r;
        if (j < rings) {
          const key = sym === 'rot' ? i % period : i, jx = hash2(j, key) - 0.5, jy = hash2(key + 17, j) - 0.5;
          th += jx * P.jitter / cnt; rr += jy * P.jitter * 0.6 * (G.rOfS(Math.min(1, (j + 1) / rings)) - r);
        }
        key.push(i / cnt + phase);
        th = ((th % 1) + 1) % 1; V.push(G.at(th, rr)); bnd.push(j === rings); UV.push([th, rr]); loop.push(V.length - 1);
      }
      loops.push(loop); keys.push(key);
    }
    const F = [];
    for (let k = 0; k < loops[1].length; k++) F.push([0, loops[1][k], loops[1][(k + 1) % loops[1].length]]);
    for (let j = 1; j < rings; j++) zip(loops[j], loops[j + 1], V, F, true, keys[j], keys[j + 1]);
    const M = finishMesh(V, F, bnd, UV); M.G = G;
    const hs = { crown: G.at(0, 0), edges: [], shapes: [] };
    for (let k = 0; k < N; k++) { hs.edges.push({ kind: 'liftL', p: G.at((k + 0.5) / N, 1) }); hs.shapes.push({ p: G.at((k + 0.15) / N, 1) }); }
    M.hs = hs; return M;
  }
  const G = MC.rowsSurface(P), n = G.n;
  const m = Math.max(2, Math.round(G.arcU / e)), rows = (r => r % 2 ? r : r + 1)(Math.max(3, Math.round(G.arcV / (e * 0.866)) + 1));
  const symX = sym === 'x' || sym === 'xz', symZ = sym === 'z' || sym === 'xz';
  const V = [], UV = [], bnd = [], rowsIdx = [];
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1), us = [];
    if (j % 2 === 0) for (let i = 0; i <= m; i++) us.push(i / m);
    else { us.push(0); for (let i = 0; i < m; i++) us.push((i + 0.5) / m); us.push(1); }
    rowsIdx.push(us.map((u, k) => {
      const eU = k === 0 || k === us.length - 1, eV = j === 0 || j === rows - 1;
      let uu = u, vv = v;
      const cu = symX ? Math.min(u, 1 - u) : u, cv = symZ ? Math.min(v, 1 - v) : v, su = symX && u > 0.5 ? -1 : 1, sv = symZ && v > 0.5 ? -1 : 1;
      if (!eU && !(symX && Math.abs(u - 0.5) < 1e-9)) uu += su * (hash2(cu * 97, cv * 89) - 0.5) * P.jitter / m;
      if (!eV && !(symZ && Math.abs(v - 0.5) < 1e-9)) vv += sv * (hash2(cv * 53 + 7, cu * 61) - 0.5) * P.jitter * 0.6 / (rows - 1);
      uu = Math.min(0.999, Math.max(eU ? u : 0.001, uu)); vv = Math.min(0.999, Math.max(eV ? v : 0.001, vv)); if (eU) uu = u; if (eV) vv = v;
      V.push(G.at(uu, vv)); UV.push([uu, vv]); bnd.push(eU || eV);
      return V.length - 1;
    }));
  }
  const F = [];
  for (let j = 0; j + 1 < rows; j++) zip(rowsIdx[j], rowsIdx[j + 1], V, F, false);
  const M = finishMesh(V, F, bnd, UV); M.G = G;
  const hs = { crown: G.at(0.5, 0.5), edges: [], shapes: [] };
  for (let k = 0; k + 1 < n; k++) { const u = (k + 0.5) / (n - 1); hs.edges.push({ kind: 'liftL', p: G.at(u, 0) }, { kind: 'liftL', p: G.at(u, 1) }); hs.shapes.push({ p: G.at((k + 0.15) / (n - 1), 0) }); }
  hs.edges.push({ kind: 'liftS', p: G.at(0, 0.5) }, { kind: 'liftS', p: G.at(1, 0.5) });
  M.hs = hs; return M;
};

// ---- 柱的配置與對稱 ----
MC.layoutFeet = function (layout, nf, W, L, R, h) {
  if (layout === 'ring') return Array.from({ length: nf }, (_, k) => { const a = -Math.PI / 2 + Math.PI / nf + 2 * Math.PI * k / nf; return [R * Math.cos(a), R * Math.sin(a), h]; });
  const n = nf / 2, out = [];
  for (const z of [-L / 2, L / 2]) for (let k = 0; k < n; k++) out.push([-W / 2 + W * k / (n - 1), z, h]);
  return out;
};
MC.symOps = function (P) {
  const ops = [];
  if (P.layout === 'ring' && P.sym === 'rot') { const N = P.feet.length; for (let k = 1; k < N; k++) { const a = 2 * Math.PI * k / N, c = Math.cos(a), s = Math.sin(a); ops.push(([x, z]) => [c * x - s * z, s * x + c * z]); } }
  if (P.sym === 'x' || P.sym === 'xz') ops.push(([x, z]) => [-x, z]);
  if (P.sym === 'z' || P.sym === 'xz') ops.push(([x, z]) => [x, -z]);
  if (P.sym === 'xz') ops.push(([x, z]) => [-x, -z]);
  return ops;
};
// 拖動第 i 柱時，找出對稱夥伴：[(j, op)]
MC.partners = function (P, i) {
  const out = [], f = P.feet[i];
  MC.symOps(P).forEach(op => { const q = op([f[0], f[1]]); P.feet.forEach((g, j) => { if (j !== i && Math.hypot(g[0] - q[0], g[1] - q[1]) < 2) out.push([j, op]); }); });
  return out;
};

// ---- 互承化：每條邊繞中點的曲面法線旋轉 φ；端點搭在扇中下一根上 ----
MC.reciprocal = function (M, P) {
  const { V, N, E, F, bnd } = M, phi = P.phi * Math.PI / 180;
  const rot = (d, n, a) => { const c = Math.cos(a), s = Math.sin(a); return v3.add(v3.add(v3.mul(d, c), v3.mul(v3.cross(n, d), s)), v3.mul(n, v3.dot(n, d) * (1 - c))); };
  const lines = E.map(ed => {
    const A = V[ed.a], B = V[ed.b], m = v3.mul(v3.add(A, B), 0.5), n = v3.norm(v3.add(N[ed.a], N[ed.b]));
    const d0 = v3.norm(v3.sub(B, A)), d = v3.norm(rot(d0, n, phi));
    return { m, d, n, half: v3.len(v3.sub(B, A)) / 2 };
  });
  // 兩直線最近點
  const closest = (i, j) => {
    const A = lines[i], B = lines[j], w = v3.sub(A.m, B.m), b = v3.dot(A.d, B.d), d = v3.dot(A.d, w), e = v3.dot(B.d, w), den = 1 - b * b;
    if (den < 1e-9) return null;
    const s = (b * e - d) / den, t = (e - b * d) / den;
    const PA = v3.add(A.m, v3.mul(A.d, s)), PB = v3.add(B.m, v3.mul(B.d, t));
    return { s, t, PA, PB };
  };
  // 每個頂點的扇：依法線平面內角度排序
  const inc = V.map(() => []); E.forEach((ed, i) => { inc[ed.a].push(i); inc[ed.b].push(i); });
  const fans = V.map((p, v) => {
    const n = N[v], ref = v3.norm(v3.cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), ref2 = v3.cross(n, ref);
    const ang = i => { const o = E[i].a === v ? E[i].b : E[i].a, d = v3.sub(V[o], p); return Math.atan2(v3.dot(d, ref2), v3.dot(d, ref)); };
    const ring = inc[v].slice().sort((a, b) => ang(a) - ang(b));
    let gap = -1, gmax = 0;
    ring.forEach((q, k) => { let g = ang(ring[(k + 1) % ring.length]) - ang(q); if (g <= 0) g += 2 * Math.PI; if (g > gmax) { gmax = g; gap = k; } });
    return { ring, open: (bnd[v] || gmax > Math.PI * 0.95) ? gap : -1 };
  });
  // 風車方向投票
  const sideSign = (i, v) => E[i].a === v ? -1 : 1;
  let vote = 0;
  fans.forEach((f, v) => {
    if (f.open >= 0 || f.ring.length < 3) return;
    const n = f.ring.length;
    f.ring.forEach((r, k) => {
      const a = closest(r, f.ring[(k + 1) % n]), b = closest(r, f.ring[(k - 1 + n) % n]); if (!a || !b) return;
      vote += (a.s * sideSign(r, v) > b.s * sideSign(r, v)) ? 1 : -1;
    });
  });
  const off = vote >= 0 ? 1 : -1;
  const contacts = [], endU = E.map((ed, i) => [-lines[i].half, lines[i].half]);
  fans.forEach((f, v) => {
    const n = f.ring.length; if (n < 2) return;
    f.ring.forEach((r, k) => {
      const k2 = (k + off + n) % n;
      if (f.open >= 0 && ((off === 1 && k === f.open) || (off === -1 && k2 === f.open))) return;
      const s = f.ring[k2], c = closest(r, s); if (!c) return;
      const sg = sideSign(r, v), along = c.s * sg;
      if (along < 0.3 * lines[r].half || along > 1.8 * lines[r].half) return;
      const sep = v3.sub(c.PA, c.PB), ecc = v3.len(sep), up = v3.dot(sep, N[v]) >= 0;
      const ang = Math.acos(Math.min(1, Math.abs(v3.dot(lines[r].d, lines[s].d)))) * 180 / Math.PI;
      contacts.push({ r, s, v, sr: c.s, ss: c.t, PA: c.PA, PB: c.PB, ecc, up, ang });
      endU[r][sg < 0 ? 0 : 1] = c.s + sg * P.overhang;
    });
  });
  // 面板角點：每個面在每個角，取該角兩條邊線的最近點中點
  const plates = F.map(f => f.map((v, k) => {
    const prev = f[(k + 2) % 3], next = f[(k + 1) % 3];
    const e1 = M.edgeOf(v, prev), e2 = M.edgeOf(v, next), c = closest(e1, e2);
    return c ? v3.mul(v3.add(c.PA, c.PB), 0.5) : V[v];
  }));
  const rods = E.map((ed, i) => { const L = lines[i]; return { p0: v3.add(L.m, v3.mul(L.d, endU[i][0])), p1: v3.add(L.m, v3.mul(L.d, endU[i][1])), len: endU[i][1] - endU[i][0] }; });
  return { lines, contacts, rods, plates, off };
};

// ===================================================================
// 構件＋接點 共用資料模型（v0.8）
//   構件：竹籤（2 個質點＋長度）、板（3 個質點＋三邊長，剛性三角形）
//   接點：X＝桿–桿交叉（偏心 e、夾角、手性）
//         C＝桿–板（板邊中點外推 r0 的點落在桿軸上，可沿桿滑動）
//         H＝板–板（接縫上的點在兩板上重合；折角 fold）
// ===================================================================
MC.BOARD = 2;   // 板厚（紙板或錐體裙邊）
MC.SEAM = 2;    // 板邊到接縫中心線的退縮 = H 夾中脊半寬
MC.clipDims = P => { const tol = P.tol ?? 0.2, wall = P.wall ?? 1.2, g = P.d + tol, gb = MC.BOARD + tol; return { tol, wall, g, gb, r0: g / 2 + wall + 0.4, depth: 4, H: gb + 2 * wall, Lc: 8 }; };
const RAD = Math.PI / 180;
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
function lineX(p, d, q, e) { const den = cross2(d, e); if (Math.abs(den) < 1e-9) return null; const t = cross2([q[0] - p[0], q[1] - p[1]], e) / den; return [p[0] + d[0] * t, p[1] + d[1] * t]; }
function bary2(q, a, b, c) { const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - a[0], c[1] - a[1]], w = [q[0] - a[0], q[1] - a[1]], den = cross2(u, v), w1 = cross2(w, v) / den, w2 = cross2(u, w) / den; return [1 - w1 - w2, w1, w2]; }
MC.inradius = (a, b, c) => { const s = (a + b + c) / 2; return Math.sqrt(Math.max((s - a) * (s - b) * (s - c) / s, 0)); };

MC.build = function (M, R, P, faceType0) {
  const { V, F, E, N } = M, dm = MC.clipDims(P);
  // 太小的格子放不下夾子（退縮後邊長 < 14 mm）：改回竹籤格
  let demoted = 0;
  const faceType = faceType0.map((t, fi) => {
    if (t !== 1) return t;
    const f = F[fi], L = [0, 1, 2].map(k => v3.len(v3.sub(V[f[(k + 1) % 3]], V[f[k]]))), r = MC.inradius(L[0], L[1], L[2]);
    if (r - dm.r0 < 4 || Math.min(...L) * (r - dm.r0) / r < 14) { demoted++; return 0; } return 1;
  });
  const stickOf = new Int32Array(E.length).fill(-1), sticks = [];
  E.forEach((ed, i) => { if (ed.faces.some(f => faceType[f] === 0)) { stickOf[i] = sticks.length; sticks.push({ edge: i, len: R.rods[i].len }); } });
  const ns = sticks.length;
  // ---- 板：每條邊依鄰接情況決定邊線，再求三個角 ----
  const plateOf = new Int32Array(F.length).fill(-1), plates = []; let dropped = 0;
  F.forEach((f, fi) => {
    if (faceType[fi] !== 1) return;
    const A = V[f[0]], B = V[f[1]], C = V[f[2]], ex = v3.norm(v3.sub(B, A)), nr = v3.norm(v3.cross(v3.sub(B, A), v3.sub(C, A))), ey = v3.cross(nr, ex);
    const to2 = p => { const d = v3.sub(p, A); return [v3.dot(d, ex), v3.dot(d, ey)]; }, to3 = q => v3.add(A, v3.add(v3.mul(ex, q[0]), v3.mul(ey, q[1])));
    const p2 = [[0, 0], to2(B), to2(C)], lines = [], edges = [];
    for (let k = 0; k < 3; k++) {
      const a = p2[k], b = p2[(k + 1) % 3], ei = M.edgeOf(f[k], f[(k + 1) % 3]);
      let d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]) || 1; d = [d[0] / l, d[1] / l];
      let p = a, off = 0, kind = 'free';
      if (stickOf[ei] >= 0) {
        kind = 'SP'; const r = R.rods[ei], q0 = to2(r.p0), q1 = to2(r.p1); let dd = [q1[0] - q0[0], q1[1] - q0[1]]; const ll = Math.hypot(dd[0], dd[1]) || 1; dd = [dd[0] / ll, dd[1] / ll];
        if (dd[0] * d[0] + dd[1] * d[1] < 0) dd = [-dd[0], -dd[1]]; p = q0; d = dd; off = dm.r0;
      } else if (E[ei].faces.length === 2) { kind = 'PP'; off = MC.SEAM; }
      lines.push({ p: [p[0] - d[1] * off, p[1] + d[0] * off], d }); edges.push({ kind, ei });
    }
    const c2 = [0, 1, 2].map(k => lineX(lines[(k + 2) % 3].p, lines[(k + 2) % 3].d, lines[k].p, lines[k].d));
    if (c2.some(c => !c)) { dropped++; return; }
    const L = [0, 1, 2].map(k => Math.hypot(c2[(k + 1) % 3][0] - c2[k][0], c2[(k + 1) % 3][1] - c2[k][1]));
    const area = cross2([c2[1][0] - c2[0][0], c2[1][1] - c2[0][1]], [c2[2][0] - c2[0][0], c2[2][1] - c2[0][1]]) / 2;
    if (area <= 0 || MC.inradius(L[0], L[1], L[2]) < 3.5) { dropped++; return; }
    const nAvg = v3.add(v3.add(N[f[0]], N[f[1]]), N[f[2]]);
    plateOf[fi] = plates.length;
    plates.push({ face: fi, L, c2, c3: c2.map(to3), edges, to2, flip: v3.dot(nr, nAvg) >= 0 ? 1 : -1, p: null });
  });
  const np = plates.length, X = new Float64Array((2 * ns + 3 * np) * 3);
  sticks.forEach((s, k) => { const r = R.rods[s.edge]; X.set(r.p0, k * 6); X.set(r.p1, k * 6 + 3); });
  plates.forEach((pl, k) => { const b = 2 * ns + 3 * k; pl.p = [b, b + 1, b + 2]; pl.c3.forEach((c, q) => X.set(c, (b + q) * 3)); });
  // ---- X：桿–桿 ----
  const C = [];
  R.contacts.forEach(c => {
    const r = stickOf[c.r], s = stickOf[c.s]; if (r < 0 || s < 0) return;
    const rr = R.rods[c.r], ss = R.rods[c.s], dr = v3.sub(rr.p1, rr.p0), ds = v3.sub(ss.p1, ss.p0);
    const tr = v3.dot(v3.sub(c.PA, rr.p0), dr) / (rr.len * rr.len), ts = v3.dot(v3.sub(c.PB, ss.p0), ds) / (ss.len * ss.len);
    if (!(ts > 0.01 && ts < 0.99 && tr > -0.05 && tr < 1.05)) return;
    C.push({ r, s, v: c.v, tr, ts, sig: v3.dot(v3.cross(dr, ds), N[c.v]) >= 0 ? 1 : -1, err: 0, ang: c.ang, chi: 1, e: P.d });
  });
  // ---- C：桿–板（每條邊一個，在板邊中點）----
  const K = [];
  plates.forEach((pl, pi) => pl.edges.forEach((ed, k) => {
    if (ed.kind !== 'SP') return;
    const s = stickOf[ed.ei], r = R.rods[ed.ei], m = v3.mul(v3.add(pl.c3[k], pl.c3[(k + 1) % 3]), 0.5), d = v3.sub(r.p1, r.p0);
    const t = Math.min(0.97, Math.max(0.03, v3.dot(v3.sub(m, r.p0), d) / (r.len * r.len))), Q = v3.add(r.p0, v3.mul(d, t));
    ed.clip = K.length; K.push({ kind: 'SP', ia: pl.p, wa: bary2(pl.to2(Q), pl.c2[0], pl.c2[1], pl.c2[2]), s, ib: null, wb: null, plate: pi, k, err: 0, skew: 0 });
  }));
  // ---- H：板–板（接縫上 1–2 個夾點）----
  const seams = [];
  E.forEach((ed, ei) => {
    if (ed.faces.length !== 2) return; const pa = plateOf[ed.faces[0]], pb = plateOf[ed.faces[1]]; if (pa < 0 || pb < 0) return;
    const O = V[ed.a], u = v3.norm(v3.sub(V[ed.b], O)), A = plates[pa], B = plates[pb], kA = A.edges.findIndex(e => e.ei === ei), kB = B.edges.findIndex(e => e.ei === ei);
    const rng = (pl, k) => { const a = v3.dot(v3.sub(pl.c3[k], O), u), b = v3.dot(v3.sub(pl.c3[(k + 1) % 3], O), u); return [Math.min(a, b), Math.max(a, b)]; };
    const ra = rng(A, kA), rb = rng(B, kB), lo = Math.max(ra[0], rb[0]), hi = Math.min(ra[1], rb[1]), len = hi - lo;
    const sm = { A: pa, B: pb, kA, kB, ei, K: [], len, fold: 0 }; seams.push(sm);
    if (len < 3) return;
    sm.nclip = len >= 2 * dm.Lc + 6 ? 2 : 1;   // 短邊只放一個夾，但夾子有長度，仍以兩個點表示它會讓兩條板邊對齊
    const ts = sm.nclip === 2 ? [lo + len * 0.25, lo + len * 0.75] : [lo + len / 2 - Math.min(2.5, len / 4), lo + len / 2 + Math.min(2.5, len / 4)];
    ts.forEach(t => { const S = v3.add(O, v3.mul(u, t)); sm.K.push(K.length); K.push({ kind: 'PP', ia: A.p, wa: bary2(A.to2(S), A.c2[0], A.c2[1], A.c2[2]), s: -1, ib: B.p, wb: bary2(B.to2(S), B.c2[0], B.c2[1], B.c2[2]), seam: seams.length - 1, err: 0 }); });
  });
  plates.forEach(pl => pl.edges.forEach(ed => { if (ed.kind === 'PP' && !seams.some(s => s.ei === ed.ei && s.K.length)) ed.kind = 'free'; }));
  // 每條「桿–板」邊再加一個弱的對齊點：夾子有長度，板邊與板面會大致順著桿；
  // 設成弱約束，求解時竹籤仍可依互承關係自己轉到位，最後再用 trimPlates 把板邊修到完全平行
  plates.forEach((pl, pi) => pl.edges.forEach((ed, k) => {
    if (ed.kind !== 'SP') return;
    const c = K[ed.clip], r = R.rods[ed.ei], d = v3.sub(r.p1, r.p0), m = v3.mul(v3.add(pl.c3[k], pl.c3[(k + 1) % 3]), 0.5), t = v3.dot(v3.sub(m, r.p0), d) / (r.len * r.len);
    const Q2 = v3.add(r.p0, v3.mul(d, t + Math.min(12, pl.L[k] / 3) / r.len));
    K.push({ kind: 'SA', ia: pl.p, wa: bary2(pl.to2(Q2), pl.c2[0], pl.c2[1], pl.c2[2]), s: c.s, ib: null, wb: null, plate: pi, k, err: 0 });
  }));
  // ---- 目標與落柱 ----
  const tS = sticks.map((s, k) => [0, 1, 2].map(q => (X[k * 6 + q] + X[k * 6 + 3 + q]) / 2));
  const tP = plates.map(pl => [0, 1, 2].map(q => (pl.c3[0][q] + pl.c3[1][q] + pl.c3[2][q]) / 3));
  const pins = [], nPart = 2 * ns + 3 * np;
  for (let i = 0; i < nPart; i++) { const p = [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]]; for (const f of P.feet || []) if (Math.hypot(p[0] - f[0], p[2] - f[1]) < P.ringR * 1.6 + P.d && p[1] < f[2] + Math.max(P.gatherH * 0.25, 6)) { pins.push([i, p, f, Math.max(P.ringR, Math.hypot(p[0] - f[0], p[2] - f[1]))]); break; } }
  plates.forEach(pl => { delete pl.to2; });
  return { ft: faceType, demoted, X, sticks, plates, stickOf, plateOf, C, K, seams, pins, tS, tP, ns, np, dims: dm, dropped, res: 0, dev: 0, pinFree: false };
};

MC.solve = function (m, P, iters) {
  const { X, sticks, plates, C, K, seams, tS, tP, ns } = m, e0 = P.d, k = P.pull, emax = P.emax ?? 4;
  const get = i => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]];
  const add = (i, D, w) => { X[i * 3] += D[0] * w; X[i * 3 + 1] += D[1] * w; X[i * 3 + 2] += D[2] * w; };
  let res = 0;
  for (let it = 0; it < iters; it++) {
    const last = it === iters - 1;
    for (let r = 0; r < ns; r++) {
      const o = r * 6, dx = X[o + 3] - X[o], dy = X[o + 4] - X[o + 1], dz = X[o + 5] - X[o + 2];
      const L = Math.hypot(dx, dy, dz) || 1e-9, f = (L - sticks[r].len) / L / 2;
      X[o] += dx * f; X[o + 1] += dy * f; X[o + 2] += dz * f; X[o + 3] -= dx * f; X[o + 4] -= dy * f; X[o + 5] -= dz * f;
      const T = tS[r], gx = (T[0] - (X[o] + X[o + 3]) / 2) * k, gy = (T[1] - (X[o + 1] + X[o + 4]) / 2) * k, gz = (T[2] - (X[o + 2] + X[o + 5]) / 2) * k;
      X[o] += gx; X[o + 3] += gx; X[o + 1] += gy; X[o + 4] += gy; X[o + 2] += gz; X[o + 5] += gz;
    }
    for (let p = 0; p < plates.length; p++) {
      const pl = plates[p];
      for (let q = 0; q < 3; q++) { const i = pl.p[q], j = pl.p[(q + 1) % 3], dx = X[j * 3] - X[i * 3], dy = X[j * 3 + 1] - X[i * 3 + 1], dz = X[j * 3 + 2] - X[i * 3 + 2], L = Math.hypot(dx, dy, dz) || 1e-9, f = (L - pl.L[q]) / L / 2; X[i * 3] += dx * f; X[i * 3 + 1] += dy * f; X[i * 3 + 2] += dz * f; X[j * 3] -= dx * f; X[j * 3 + 1] -= dy * f; X[j * 3 + 2] -= dz * f; }
      const T = tP[p], b = pl.p[0] * 3; for (let q = 0; q < 3; q++) { const g = (T[q] - (X[b + q] + X[b + 3 + q] + X[b + 6 + q]) / 3) * k; X[b + q] += g; X[b + 3 + q] += g; X[b + 6 + q] += g; }
    }
    for (const c of C) {
      const ro = c.r * 6, so = c.s * 6;
      const p0 = [X[ro], X[ro + 1], X[ro + 2]], q0 = [X[so], X[so + 1], X[so + 2]];
      const dr = [X[ro + 3] - X[ro], X[ro + 4] - X[ro + 1], X[ro + 5] - X[ro + 2]], ds = [X[so + 3] - X[so], X[so + 4] - X[so + 1], X[so + 5] - X[so + 2]];
      const a = v3.dot(dr, dr), b = v3.dot(dr, ds), cc = v3.dot(ds, ds), w = v3.sub(p0, q0), d1 = v3.dot(dr, w), e1 = v3.dot(ds, w), den = a * cc - b * b;
      // 接點可沿桿滑動：搭接長度由曲率與偏心決定（曲率大的地方搭接短）。夾子放不放得下，由頁面另外檢查
      if (den > 1e-9) { c.tr = Math.min(1, Math.max(0, (b * e1 - cc * d1) / den)); c.ts = Math.min(0.98, Math.max(0.02, (a * e1 - b * d1) / den)); }
      const A = v3.add(p0, v3.mul(dr, c.tr)), B = v3.add(q0, v3.mul(ds, c.ts)), sn = Math.sqrt(Math.max(den, 0));
      const ax = sn > 1e-9 ? v3.mul(v3.cross(dr, ds), 1 / sn) : [0, 1, 0], nn = v3.mul(ax, c.sig);
      const sep = v3.dot(v3.sub(A, B), nn);
      const tgt = (c.special || P.custom) ? Math.min(Math.max(sep, e0), e0 + emax) : e0;   // 訂製或特製：e ≤ 偏心 ≤ e + 上限
      const D = [A[0] - B[0] - tgt * nn[0], A[1] - B[1] - tgt * nn[1], A[2] - B[2] - tgt * nn[2]];
      const aNow = Math.atan2(sn, b);
      if (last) { c.err = Math.hypot(D[0], D[1], D[2]); c.sep = sep; c.n = nn; c.e = tgt; c.chi = c.sig * (b >= 0 ? 1 : -1); c.ang = Math.min(aNow, Math.PI - aNow) / RAD; if (c.err > res) res = c.err; }
      const wA = (1 - c.tr) ** 2 + c.tr ** 2, wB = (1 - c.ts) ** 2 + c.ts ** 2, lam = 1 / (wA + wB);
      add(c.r * 2, D, -lam * (1 - c.tr)); add(c.r * 2 + 1, D, -lam * c.tr); add(c.s * 2, D, lam * (1 - c.ts)); add(c.s * 2 + 1, D, lam * c.ts);
    }
    for (const c of K) {
      const A = [0, 0, 0]; for (let q = 0; q < 3; q++) { const w = c.wa[q], i = c.ia[q] * 3; A[0] += X[i] * w; A[1] += X[i + 1] * w; A[2] += X[i + 2] * w; }
      let ib, wb, B;
      if (c.s >= 0) {
        const o = c.s * 6, d = [X[o + 3] - X[o], X[o + 4] - X[o + 1], X[o + 5] - X[o + 2]], tt = ((A[0] - X[o]) * d[0] + (A[1] - X[o + 1]) * d[1] + (A[2] - X[o + 2]) * d[2]) / (v3.dot(d, d) || 1), t = c.kind === 'SA' ? tt : Math.min(0.98, Math.max(0.02, tt));
        c.t = t; B = [X[o] + d[0] * t, X[o + 1] + d[1] * t, X[o + 2] + d[2] * t]; ib = [c.s * 2, c.s * 2 + 1]; wb = [1 - t, t];
        if (last && c.kind === 'SP') {   // tilt：桿相對板面的傾角（帶手性）；skew：板面內板邊與桿的夾角（修邊後為 0）
          const pl = plates[c.plate], a0 = get(pl.p[c.k]), a1 = get(pl.p[(c.k + 1) % 3]), a2 = get(pl.p[(c.k + 2) % 3]), e = v3.norm(v3.sub(a1, a0)), n = v3.norm(v3.cross(v3.sub(a1, a0), v3.sub(a2, a0)));
          let u = v3.norm(d); if (v3.dot(u, e) < 0) u = v3.mul(u, -1);
          const un = v3.dot(u, n), up = v3.norm(v3.sub(u, v3.mul(n, un)));
          c.tilt = Math.asin(Math.max(-1, Math.min(1, un))) / RAD; c.skew = Math.acos(Math.min(1, Math.abs(v3.dot(up, e)))) / RAD;
        }
      } else { ib = c.ib; wb = c.wb; B = [0, 0, 0]; for (let q = 0; q < 3; q++) { const w = wb[q], i = ib[q] * 3; B[0] += X[i] * w; B[1] += X[i + 1] * w; B[2] += X[i + 2] * w; } }
      const D = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
      if (last && c.kind !== 'SA') { c.err = Math.hypot(D[0], D[1], D[2]); c.pos = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]; if (c.err > res) res = c.err; }
      let sw = 0; for (let q = 0; q < 3; q++) sw += c.wa[q] ** 2; for (let q = 0; q < wb.length; q++) sw += wb[q] ** 2;
      const lam = (c.kind === 'SA' ? 0.1 : 0.9) / sw;
      for (let q = 0; q < 3; q++) add(c.ia[q], D, -lam * c.wa[q]); for (let q = 0; q < wb.length; q++) add(ib[q], D, lam * wb[q]);
    }
    if (last) for (const sm of seams) {
      if (!sm.K.length) continue;
      const PA = plates[sm.A], PB = plates[sm.B];
      const a1 = get(PA.p[sm.kA]), a2 = get(PA.p[(sm.kA + 1) % 3]), a3 = get(PA.p[(sm.kA + 2) % 3]), b1 = get(PB.p[sm.kB]), b2 = get(PB.p[(sm.kB + 1) % 3]), b3 = get(PB.p[(sm.kB + 2) % 3]);
      const u = v3.norm(v3.sub(a2, a1)), nA = v3.mul(v3.norm(v3.cross(v3.sub(a2, a1), v3.sub(a3, a1))), PA.flip), nB = v3.mul(v3.norm(v3.cross(v3.sub(b2, b1), v3.sub(b3, b1))), PB.flip);
      const f = Math.atan2(v3.dot(v3.cross(nA, nB), u), v3.dot(nA, nB));
      sm.fold = f / RAD;
    }
    const np3 = X.length / 3; for (let p = 0; p < np3; p++) if (X[p * 3 + 1] < P.d / 2) X[p * 3 + 1] = P.d / 2;
    for (const [p, q, f, rm] of m.pins) {
      X[p * 3 + 1] = q[1];
      if (!m.pinFree) { X[p * 3] = q[0]; X[p * 3 + 2] = q[2]; continue; }
      // 腳環放寬：桿端高度不變，可在腳環圓盤內移位（柱頂插孔的位置由求解決定）
      const dx = X[p * 3] - f[0], dz = X[p * 3 + 2] - f[1], r = Math.hypot(dx, dz); if (r > rm) { X[p * 3] = f[0] + dx * rm / r; X[p * 3 + 2] = f[1] + dz * rm / r; }
    }
  }
  let dev = 0;
  for (let r = 0; r < ns; r++) { const o = r * 6; dev = Math.max(dev, Math.hypot((X[o] + X[o + 3]) / 2 - tS[r][0], (X[o + 1] + X[o + 4]) / 2 - tS[r][1], (X[o + 2] + X[o + 5]) / 2 - tS[r][2])); }
  plates.forEach((pl, p) => { const b = pl.p[0] * 3; dev = Math.max(dev, Math.hypot((X[b] + X[b + 3] + X[b + 6]) / 3 - tP[p][0], (X[b + 1] + X[b + 4] + X[b + 7]) / 3 - tP[p][1], (X[b + 2] + X[b + 5] + X[b + 8]) / 3 - tP[p][2])); });
  m.res = res; m.dev = dev; return res;
};
MC.plateCorners = m => m.plates.map(pl => pl.p.map(i => [m.X[i * 3], m.X[i * 3 + 1], m.X[i * 3 + 2]]));

// ---- 逆向：接點 → 接頭種類 ----
// 夾子的槽有間隙，可吸收一點角度差：play = 兩條槽各 atan(公差 / 槽長)
MC.play = function (P) { const dm = MC.clipDims(P), L = P.clipL ?? Math.max(8, 3 * P.d + 4); return { X: 2 * Math.atan(dm.tol / L) / RAD, H: 2 * Math.atan(dm.tol / dm.depth) / RAD, C: 2 * Math.atan(dm.tol / dm.Lc) / RAD }; };
// N = 0：自動（用最少種類讓每個接點都落在間隙內）；N > 0：至多 N 種，超出間隙的接點標記 over（要硬壓，形狀會跟著變）
MC.assignTypes = function (m, P, N) {
  const pl = MC.play(P), items = [];
  if (!P.noX) m.C.forEach(c => { const e = Math.max(P.d, Math.round((c.e ?? P.d) * 2) / 2); items.push({ ref: c, g: 'X|' + (c.ang > 89 ? 1 : c.chi > 0 ? 1 : -1) + '|' + e, v: c.ang, play: pl.X }); });
  m.seams.forEach(s => { if (s.K.length) items.push({ ref: s, g: 'H', v: Math.abs(s.fold), play: pl.H }); });
  m.K.forEach(c => { if (c.kind === 'SP') items.push({ ref: c, g: 'C', v: c.tilt || 0, play: pl.C }); });
  const by = new Map(); items.forEach(it => { if (!by.has(it.g)) by.set(it.g, []); by.get(it.g).push(it); });
  const groups = [...by.values()].map(a => a.sort((x, y) => x.v - y.v)), nC = 0, rg = c => c[c.length - 1].v - c[0].v;
  let cl = [];
  groups.forEach(g => { let cur = null; g.forEach(it => { if (!cur || it.v - cur[0].v > 2 * it.play) { cur = []; cl.push(cur); } cur.push(it); }); });
  const auto = cl.length + (nC ? 1 : 0), minN = groups.length + (nC ? 1 : 0);
  if (N > 0 && N < auto) {
    cl = groups.map(g => g.slice());
    while (cl.length + (nC ? 1 : 0) < N) {
      let bi = -1, br = 0.5; cl.forEach((c, i) => { if (rg(c) > br) { br = rg(c); bi = i; } }); if (bi < 0) break;
      const c = cl[bi], mid = (c[0].v + c[c.length - 1].v) / 2, lo = c.filter(x => x.v < mid), hi = c.filter(x => x.v >= mid); if (!lo.length || !hi.length) break; cl.splice(bi, 1, lo, hi);
    }
  }
  let over = 0, worst = 0;
  const types = cl.map(c => {
    const g = c[0].g.split('|'), lo = c[0].v, hi = c[c.length - 1].v, a = Math.round((lo + hi)) / 2, t = { kind: g[0], a, chi: +g[1] || 0, e: +g[2] || 0, n: c.length, spread: 0, over: 0, items: c };
    c.forEach(it => { const dv = Math.abs(it.v - a); t.spread = Math.max(t.spread, dv); it.ref.over = dv > it.play + 0.3; if (it.ref.over) { t.over++; over++; } worst = Math.max(worst, dv - it.play); });
    return t;
  }).sort((x, y) => (x.kind < y.kind ? 1 : x.kind > y.kind ? -1 : 0) || x.a - y.a || x.e - y.e || y.chi - x.chi);
  types.forEach((t, i) => { t.items.forEach(it => { it.ref.type = i; it.ref.aT = t.a; }); delete t.items; });
  return { types, auto, minN, play: pl, over, worst: Math.max(0, worst) };
};
// 接不上的桿–桿接點：改成可墊高的特製件（偏心在 d ～ d＋上限 之間自由）；上下明顯疊反的翻過來
MC.relieve = function (m, P, tol) {
  let n = 0; m.C.forEach(c => { if (!c.special && c.err > tol) { c.special = true; if (c.sep < -P.d / 2) c.sig = -c.sig; n++; } }); return n;
};
// ③ 衝突處理：分幾輪放寬，每輪重解；變差就退回上一輪
MC.resolve = function (m, P, rounds = 3, n = 120) {
  const o = { ...P, pull: 0.0003 }, score = () => { const s = MC.summary(m); return s.bad * 100 + s.mid + s.max; };
  let best = score(), tot = 0;
  for (let r = 0; r < rounds + 1 && best >= 0.3; r++) {
    const snap = { X: m.X.slice(), C: m.C.map(c => ({ ...c })), K: m.K.map(c => ({ ...c, wa: c.wa.slice() })), pinFree: m.pinFree };
    let add = 1; if (r === 0) m.pinFree = true; else add = MC.relieve(m, P, 0.3); if (!add) break;
    for (let i = 0; i < n; i++) MC.solve(m, o, 12);
    const sc = score();
    if (sc > best + 1e-6) { m.X.set(snap.X); snap.C.forEach((c, i) => Object.assign(m.C[i], c)); snap.K.forEach((c, i) => Object.assign(m.K[i], c)); m.pinFree = snap.pinFree; MC.solve(m, o, 2); break; }
    best = sc; tot += add;
  }
  return m.C.filter(c => c.special).length;
};
// 修邊：求解完成後，把每條「桿–板」邊修成與解出的竹籤平行、相距 r0（板是照解出來的形狀裁的）。
// 板仍在原平面內，夾點在空間中的位置不變，所以接點誤差不受影響。
MC.trimPlates = function (m) {
  const X = m.X, r0 = m.dims.r0, get = i => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]]; let shift = 0, bad = 0, off = 0;
  m.plates.forEach((pl, pi) => {
    if (!pl.edges.some(e => e.kind === 'SP')) return;
    const c3 = pl.p.map(get), A = c3[0], ex = v3.norm(v3.sub(c3[1], A)), nr = v3.norm(v3.cross(v3.sub(c3[1], A), v3.sub(c3[2], A))), ey = v3.cross(nr, ex);
    const to2 = p => { const d = v3.sub(p, A); return [v3.dot(d, ex), v3.dot(d, ey)]; }, c2 = c3.map(to2), lines = [];
    for (let k = 0; k < 3; k++) {
      const a = c2[k], b = c2[(k + 1) % 3]; let d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]) || 1; d = [d[0] / l, d[1] / l]; let p = a;
      if (pl.edges[k].kind === 'SP') { const s = m.stickOf[pl.edges[k].ei], q0 = to2(get(s * 2)), q1 = to2(get(s * 2 + 1)); let dd = [q1[0] - q0[0], q1[1] - q0[1]]; const ll = Math.hypot(dd[0], dd[1]) || 1; dd = [dd[0] / ll, dd[1] / ll]; if (dd[0] * d[0] + dd[1] * d[1] < 0) dd = [-dd[0], -dd[1]]; d = dd; p = [q0[0] - d[1] * r0, q0[1] + d[0] * r0]; }
      lines.push({ p, d });
    }
    const n2 = [0, 1, 2].map(k => lineX(lines[(k + 2) % 3].p, lines[(k + 2) % 3].d, lines[k].p, lines[k].d));
    const ok = n2.every(c => c) && cross2([n2[1][0] - n2[0][0], n2[1][1] - n2[0][1]], [n2[2][0] - n2[0][0], n2[2][1] - n2[0][1]]) > 0;
    const L = ok ? [0, 1, 2].map(k => Math.hypot(n2[(k + 1) % 3][0] - n2[k][0], n2[(k + 1) % 3][1] - n2[k][1])) : null;
    if (!ok || MC.inradius(L[0], L[1], L[2]) < 3.5 || n2.some((c, k) => Math.hypot(c[0] - c2[k][0], c[1] - c2[k][1]) > 0.35 * Math.min(...pl.L))) { bad++; pl.bad = true; return; }
    n2.forEach((c, k) => { shift = Math.max(shift, Math.hypot(c[0] - c2[k][0], c[1] - c2[k][1])); });
    m.K.forEach(c => {
      for (const [ia, w] of [[c.ia, 'wa'], [c.ib, 'wb']]) {
        if (ia !== pl.p) continue;
        const q = [0, 1].map(a => c[w][0] * c2[0][a] + c[w][1] * c2[1][a] + c[w][2] * c2[2][a]); c[w] = bary2(q, n2[0], n2[1], n2[2]);
        if (c.kind === 'PP') { const k = c.seam != null ? (m.seams[c.seam].A === pi ? m.seams[c.seam].kA : m.seams[c.seam].kB) : 0; if (c[w][k] < 0.03 || c[w][(k + 1) % 3] < 0.03) { off++; c.off = true; } }
      }
    });
    n2.forEach((c, k) => { const p3 = v3.add(A, v3.add(v3.mul(ex, c[0]), v3.mul(ey, c[1]))); X.set(p3, pl.p[k] * 3); }); pl.L = L;
  });
  return { shift, bad, off };
};
// 同一根竹籤上相鄰兩個夾子（桿–桿、桿–板）的間距；小於桿夾長度的會互頂
MC.spacing = function (m, L) {
  let tight = 0, min = Infinity; const gaps = [];
  m.sticks.forEach((s, k) => {
    const ps = []; m.C.forEach(c => { if (c.r === k) ps.push([c.tr * s.len, c]); if (c.s === k) ps.push([c.ts * s.len, c]); }); m.K.forEach(c => { if (c.kind === 'SP' && c.s === k) ps.push([(c.t || 0) * s.len, c]); });
    ps.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ps.length; i++) { const g = ps[i][0] - ps[i - 1][0]; gaps.push(g); min = Math.min(min, g); if (g < L) { tight++; ps[i][1].tight = ps[i - 1][1].tight = true; } }
  });
  return { tight, min, n: gaps.length, joints: m.C.filter(c => c.tight).length + m.K.filter(c => c.tight).length };
};
MC.summary = function (m) {
  const errs = m.C.map(c => c.err).concat(m.K.filter(c => c.kind !== 'SA').map(c => c.err));
  return { max: Math.max(0, ...errs), bad: errs.filter(e => e >= 1).length, mid: errs.filter(e => e >= 0.3 && e < 1).length, n: errs.length, dev: m.dev,
    maxX: Math.max(0, ...m.C.map(c => c.err)), maxC: Math.max(0, ...m.K.filter(c => c.kind === 'SP').map(c => c.err)), loose: m.plates.filter(pl => pl.edges.filter(e => e.kind !== 'free').length < 2).length, maxH: Math.max(0, ...m.K.filter(c => c.kind === 'PP').map(c => c.err)),
    special: m.C.filter(c => c.special).length, skew: Math.max(0, ...m.K.filter(c => c.kind === 'SP').map(c => c.skew)), tilt: Math.max(0, ...m.K.filter(c => c.kind === 'SP').map(c => Math.abs(c.tilt || 0))), fold: Math.max(0, ...m.seams.filter(s => s.K.length).map(s => Math.abs(s.fold))) };
};

// ---- 接頭實體（全部是沿一個方向拉伸的柱體，平放列印不需支撐）----
// X：U 形槽雙夾。兩條槽夾角 θ、沿法向相距 e
MC.uClip = function (M, P, theta, e) {
  const g = P.d + P.tol, W = g + 2 * P.wall, L = P.clipL ?? Math.max(8, 3 * P.d + 4);
  const box = () => M.cube([L, W, W], true), slot = side => M.cube([L + 2, g, W], true).translate([0, 0, side * W / 2]);
  const place = m => m.rotate([0, theta, 0]).translate([0, e, 0]);
  return M.union([box(), place(box())]).subtract(M.union([slot(1), place(slot(-1))]));
};
// H：板–板折角夾。兩個板槽背對背，中脊半寬 SEAM，折角 fold（0 = 平）
MC.hClip = function (M, P, fold) {
  const dm = MC.clipDims(P), a = MC.SEAM + dm.depth, Lc = dm.Lc;
  const arm = () => M.cube([a, dm.H, Lc]).translate([0, -dm.H / 2, 0]), slot = () => M.cube([dm.depth + 1, dm.gb, Lc + 2]).translate([MC.SEAM, -dm.gb / 2, -1]);
  const other = m => m.mirror([1, 0, 0]).rotate([0, 0, fold]);
  return M.union([arm(), other(arm()), M.cylinder(Lc, dm.H / 2, dm.H / 2, 32)]).subtract(M.union([slot(), other(slot())]));
};
// C：桿–板扣。C 形環扣住竹籤（開口在板的反側），板槽沿徑向；tilt = 板面相對桿軸的傾角
MC.cClip = function (M, P, tilt = 0) {
  const dm = MC.clipDims(P), ri = dm.g / 2, ro = ri + dm.wall, Lc = dm.Lc, Ha = dm.H + Lc * Math.tan(Math.abs(tilt) * RAD);
  const body = M.union([M.cylinder(Lc, ro, ro, 40), M.cube([dm.r0 + dm.depth, Ha, Lc]).translate([0, -Ha / 2, 0])]);
  const slot = M.cube([dm.depth + 1, dm.gb, Lc * 2 + 4], true).rotate([tilt, 0, 0]).translate([dm.r0 + (dm.depth + 1) / 2, 0, Lc / 2]);
  return body.subtract(M.union([M.cylinder(Lc + 2, ri, ri, 40).translate([0, 0, -1]), slot, M.cube([ro + 1, P.d * 0.8, Lc + 2]).translate([-ro - 1, -P.d * 0.4, -1])]));
};
// 三角錐：薄殼＋2 mm 裙邊（裙邊當成板插進同樣的槽）。L = 三邊長，h = 錐高
MC.pyrSkirt = dm => dm.depth + 1.5;
MC.pyramid = function (M, P, L, h) {
  const dm = MC.clipDims(P), [a, b, c] = L, x = (a * a + c * c - b * b) / (2 * a), y = Math.sqrt(Math.max(c * c - x * x, 0)), pts = [[0, 0], [a, 0], [x, y]];
  const per = a + b + c, I = [(pts[0][0] * b + pts[1][0] * c + pts[2][0] * a) / per, (pts[0][1] * b + pts[1][1] * c + pts[2][1] * a) / per], r = MC.inradius(a, b, c), G = [(a + x) / 3, y / 3];
  const ins = s => pts.map(p => [I[0] + (p[0] - I[0]) * (r - s) / r, I[1] + (p[1] - I[1]) * (r - s) / r]), sw = MC.pyrSkirt(dm), T = MC.BOARD, wp = 1;
  const prism = (pp, z0, z1) => M.hull(pp.flatMap(p => [[p[0], p[1], z0], [p[0], p[1], z1]])), cone = (pp, z0, zt) => M.hull(pp.map(p => [p[0], p[1], z0]).concat([[G[0], G[1], zt]]));
  let s = M.union([prism(pts, 0, T).subtract(prism(ins(sw), -1, T + 1)), cone(ins(sw - wp), 0, T + h)]);
  if (h > 2.5 * wp) s = s.subtract(cone(ins(sw), -0.01, T + h - 1.6 * wp));
  return s;
};

// ===== 節點件：每個節點一個列印件，照解出的位置開斜孔，竹籤沿軸向插入 =====
// o = { grow, thick, grad: 'none'|'A'|'B', flip, capR }；回傳每個節點的中心、法向、半徑、厚度、所含竹籤
MC.nodes = function (m, P, o = {}) {
  const X = m.X, d = P.d, wall = m.dims.wall, by = new Map(), pt = i => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]];
  m.C.forEach(c => { if (!by.has(c.v)) by.set(c.v, []); by.get(c.v).push(c); });
  const out = [];
  by.forEach((cs, v) => {
    const pts = cs.map(c => { const a = pt(c.s * 2), b = pt(c.s * 2 + 1), n = c.n || [0, 1, 0], e = c.e || d; return [0, 1, 2].map(q => a[q] + (b[q] - a[q]) * c.ts + n[q] * e / 2); });
    const ctr = [0, 1, 2].map(q => pts.reduce((s, p) => s + p[q], 0) / pts.length), n = v3.norm(cs.reduce((s, c) => v3.add(s, c.n || [0, 1, 0]), [0, 0, 0]));
    const rho = pts.map(p => { const r = v3.sub(p, ctr), h = v3.dot(r, n); return v3.len(v3.sub(r, v3.mul(n, h))); });
    const sticks = [...new Set(cs.flatMap(c => [c.r, c.s]))], Rmin = Math.max(...rho) + d / 2 + wall + 1;
    let h0 = Infinity, h1 = -Infinity;
    sticks.forEach(k => { const a = pt(k * 2), b = pt(k * 2 + 1); for (let t = 0; t <= 1.0001; t += 1 / 24) { const r = v3.sub(v3.add(a, v3.mul(v3.sub(b, a), t)), ctr), h = v3.dot(r, n); if (v3.len(v3.sub(r, v3.mul(n, h))) <= Rmin) { h0 = Math.min(h0, h); h1 = Math.max(h1, h); } } });
    if (!isFinite(h0)) { h0 = -d / 2; h1 = d / 2; }
    out.push({ v, c: ctr, n, Rmin, Tmin: h1 - h0 + d + 2 * wall, zc: (h0 + h1) / 2, rin: Math.max(0, Math.min(...rho) - d / 2 - wall - 0.5), sticks, nX: cs.length, bad: Math.max(...cs.map(c => c.err || 0)) });
  });
  // 漸變：依高度（A）或沿長度（B），0 → 1
  const key = o.grad === 'B' ? 2 : 1, vals = out.map(nd => nd.c[key]), lo = Math.min(...vals), hi = Math.max(...vals);
  out.forEach(nd => { let s = o.grad && o.grad !== 'none' ? (nd.c[key] - lo) / (hi - lo + 1e-9) : 1; if (o.flip && o.grad && o.grad !== 'none') s = 1 - s; nd.s = s; nd.R = nd.Rmin + (o.grow || 0) * s; nd.T = nd.Tmin + (o.thick || 0) * s; });
  // 落在柱頂件範圍內的節點交給柱頂件
  const caps = o.caps || [];
  const keep = out.filter(nd => !caps.some(cp => Math.hypot(nd.c[0] - cp.f[0], nd.c[2] - cp.f[1]) < cp.R + nd.R * 0.5 && nd.c[1] < cp.top + nd.T / 2));
  keep.forEach((nd, i) => { nd.id = i; nd.hit = false; });
  let hits = 0; for (let i = 0; i < keep.length; i++) for (let j = i + 1; j < keep.length; j++) if (v3.len(v3.sub(keep[i].c, keep[j].c)) < keep[i].R + keep[j].R) { hits++; keep[i].hit = keep[j].hit = true; }
  return { nodes: keep, hits, skipped: out.length - keep.length };
};
// 柱頂件：把落在腳環上的桿端收在一起（柱高 > 0 時連柱身一起印）
MC.caps = function (m, P) {
  const X = m.X, d = P.d, wall = m.dims.wall;
  return (P.feet || []).map((f, fi) => {
    const ends = m.pins.filter(p => p[2] === f).map(([i]) => ({ i, k: i >> 1, p: [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]], q: [X[(i ^ 1) * 3], X[(i ^ 1) * 3 + 1], X[(i ^ 1) * 3 + 2]] })).filter(e => e.i < m.ns * 2);
    if (!ends.length) return null;
    const R = Math.max(...ends.map(e => Math.hypot(e.p[0] - f[0], e.p[2] - f[1]))) + d / 2 + wall + 1, top = Math.max(...ends.map(e => e.p[1])) + Math.max(4, 2 * d);
    return { fi, f, R, top, ends };
  }).filter(Boolean);
};
const stickHole = (M, a, b, r, ext) => {   // 沿 a→b 的圓柱孔（兩端各延伸 ext）
  const dir = v3.norm(v3.sub(b, a)), L = v3.len(v3.sub(b, a)) + 2 * ext, u = v3.norm(v3.cross(dir, Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = v3.cross(dir, u), o = v3.sub(a, v3.mul(dir, ext));
  return M.cylinder(L, r, r, 20).transform([u[0], u[1], u[2], 0, w[0], w[1], w[2], 0, dir[0], dir[1], dir[2], 0, o[0], o[1], o[2], 1]);
};
MC.nodeSolid = function (M, m, P, nd, shape) {
  const X = m.X, pt = i => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]], n = nd.n, u = v3.norm(v3.cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), w = v3.cross(n, u), O = v3.add(nd.c, v3.mul(n, nd.zc));
  const loc = p => { const r = v3.sub(p, O); return [v3.dot(r, u), v3.dot(r, w), v3.dot(r, n)]; }, T = nd.T, R = nd.R;
  let body;
  if (shape === 'dou') { const a = R, b = R * 0.7; body = M.hull([[-a, -a, T / 2], [a, -a, T / 2], [a, a, T / 2], [-a, a, T / 2], [-a, -a, -T * 0.1], [a, -a, -T * 0.1], [a, a, -T * 0.1], [-a, a, -T * 0.1], [-b, -b, -T / 2], [b, -b, -T / 2], [b, b, -T / 2], [-b, b, -T / 2]]); }
  else { body = M.cylinder(T, R, R, 48).translate([0, 0, -T / 2]); if (shape === 'ring' && nd.rin > 1.5) body = body.subtract(M.cylinder(T + 2, nd.rin, nd.rin, 32).translate([0, 0, -T / 2 - 1])); }
  const holes = nd.sticks.map(k => stickHole(M, loc(pt(k * 2)), loc(pt(k * 2 + 1)), m.dims.g / 2, 3));
  return body.subtract(M.union(holes));
};
MC.capSolid = function (M, m, P, cp) {
  const f = cp.f, loc = p => [p[0] - f[0], -(p[2] - f[1]), p[1]], base = Math.max(0, f[2] - 1);
  let body = M.cylinder(cp.top - base, cp.R, cp.R, 48).translate([0, 0, base]);
  if (f[2] > 1) body = M.union([body, M.cylinder(f[2], Math.min(cp.R, P.ringR * 0.9), Math.min(cp.R, P.ringR * 0.9), 40)]);
  return body.subtract(M.union(cp.ends.map(e => stickHole(M, loc(e.p), loc(e.q), m.dims.g / 2, 0))));
};

if (typeof module !== 'undefined') module.exports = MC;
