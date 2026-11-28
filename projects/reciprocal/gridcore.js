// ===== 互承網格（nexorade）：鑲嵌 → 互承扇 → PBD 約束求解 =====
// 求解座標：x, y 為平面，z 向上；單位 mm
const G = {};

// ---- 鑲嵌 ----
G.tiling = function (type, cell, W, H) {
  const V = [], key = new Map(), E = new Set();
  const add = (x, y) => { const k = Math.round(x * 100) + ',' + Math.round(y * 100); if (!key.has(k)) { key.set(k, V.length); V.push([x, y]); } return key.get(k); };
  const edge = (a, b) => { if (a === b) return; E.add(a < b ? a + '-' + b : b + '-' + a); };
  const R = Math.max(W, H);
  if (type === 'square') {
    const n = Math.ceil(R / cell) + 1;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const a = add(i * cell, j * cell); edge(a, add((i + 1) * cell, j * cell)); edge(a, add(i * cell, (j + 1) * cell)); }
  } else if (type === 'tri') {
    const h = cell * Math.sqrt(3) / 2, n = Math.ceil(R / h) + 2;
    const P = (i, j) => [(i + j / 2) * cell, j * h];
    for (let i = -2 * n; i <= 2 * n; i++) for (let j = -n; j <= n; j++) {
      const p = P(i, j); if (Math.abs(p[0]) > R || Math.abs(p[1]) > R) continue;
      const a = add(...p); edge(a, add(...P(i + 1, j))); edge(a, add(...P(i, j + 1))); edge(a, add(...P(i - 1, j + 1)));
    }
  } else if (type === 'hex') {
    const s = cell, dx = Math.sqrt(3) * s, dy = 1.5 * s, n = Math.ceil(R / s) + 2;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const cx = i * dx + (j & 1 ? dx / 2 : 0), cy = j * dy;
      if (Math.abs(cx) > R + s || Math.abs(cy) > R + s) continue;
      const ids = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ids.push(add(cx + s * Math.cos(a), cy + s * Math.sin(a))); }
      for (let k = 0; k < 6; k++) edge(ids[k], ids[(k + 1) % 6]);
    }
  } else { // cairo 五角
    const a = cell * 1.6, c = 0.55 * a, n = Math.ceil(R / a) + 1;
    for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) {
      const x0 = i * a, y0 = j * a, mx = x0 + a / 2, my = y0 + a / 2;
      const C = [add(x0, y0), add(x0 + a, y0), add(x0 + a, y0 + a), add(x0, y0 + a)];
      if (((i + j) & 1) === 0) { const p = add(mx - c / 2, my), q = add(mx + c / 2, my); edge(p, q); edge(p, C[0]); edge(p, C[3]); edge(q, C[1]); edge(q, C[2]); }
      else { const p = add(mx, my - c / 2), q = add(mx, my + c / 2); edge(p, q); edge(p, C[0]); edge(p, C[1]); edge(q, C[3]); edge(q, C[2]); }
    }
  }
  // 裁切到範圍
  const inside = v => Math.abs(V[v][0]) <= W / 2 + 1e-6 && Math.abs(V[v][1]) <= H / 2 + 1e-6;
  const edges = [...E].map(s => s.split('-').map(Number)).filter(([a, b]) => inside(a) && inside(b));
  // 只保留最大連通部分
  const adj = new Map(); edges.forEach(([a, b]) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); });
  const seen = new Set(); let best = [];
  for (const s of adj.keys()) { if (seen.has(s)) continue; const comp = [s]; seen.add(s); for (let q = 0; q < comp.length; q++) for (const t of adj.get(comp[q])) if (!seen.has(t)) { seen.add(t); comp.push(t); } if (comp.length > best.length) best = comp; }
  const keep = new Set(best);
  return { V, E: edges.filter(([a]) => keep.has(a)) };
};

// ---- 互承化：每條邊繞中點旋轉 φ，端點停在第一根碰到的鄰桿上 ----
G.reciprocal = function (T, phiDeg, overhang) {
  const { V, E } = T, phi = phiDeg * Math.PI / 180;
  const inc = new Map(); E.forEach((e, i) => e.forEach(v => (inc.get(v) || inc.set(v, []).get(v)).push(i)));
  const lines = E.map(([a, b]) => {
    const m = [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2];
    let d = [V[b][0] - V[a][0], V[b][1] - V[a][1]]; const L = Math.hypot(...d); d = [d[0] / L, d[1] / L];
    const c = Math.cos(phi), s = Math.sin(phi);
    return { m, d: [c * d[0] - s * d[1], s * d[0] + c * d[1]], half: L / 2, a, b };
  });
  const ends = E.map(() => [null, null]);         // u 值（沿 d 由中點起算）
  const contacts = [];
  const cross2 = (p, q) => p[0] * q[1] - p[1] * q[0];
  const ang = (q, v) => { const o = E[q][0] === v ? E[q][1] : E[q][0]; return Math.atan2(V[o][1] - V[v][1], V[o][0] - V[v][0]); };
  const rings = new Map();
  inc.forEach((list, v) => {
    const ring = list.slice().sort((p, q) => ang(p, v) - ang(q, v));
    let gapAt = -1, gmax = 0;
    ring.forEach((q, k) => { let g = ang(ring[(k + 1) % ring.length], v) - ang(q, v); if (g <= 0) g += 2 * Math.PI; if (g > gmax) { gmax = g; gapAt = k; } });
    rings.set(v, { ring, open: gmax >= Math.PI - 1e-3 ? gapAt : -1 });
  });
  const hit = (r, s, sg) => {
    const A = lines[r], B = lines[s], den = cross2(A.d, B.d);
    if (Math.abs(den) < 1e-9) return null;
    const w = [B.m[0] - A.m[0], B.m[1] - A.m[1]];
    const u = cross2(w, B.d) / den;
    return { s, u, us: cross2(w, A.d) / den, along: u * sg };
  };
  // 決定風車方向：在完整扇上，桿端停在 +1 或 -1 相鄰桿（取較遠交點者）
  let vote = 0;
  E.forEach((e, r) => [0, 1].forEach(side => {
    const v = e[side], R = rings.get(v); if (R.ring.length < 3 || R.open >= 0) return;
    const sg = side === 0 ? -1 : 1, k = R.ring.indexOf(r), n = R.ring.length;
    const hp = hit(r, R.ring[(k + 1) % n], sg), hm = hit(r, R.ring[(k - 1 + n) % n], sg);
    if (hp && hm) vote += hp.along > hm.along ? 1 : -1;
  }));
  const off = vote >= 0 ? 1 : -1;
  E.forEach((e, r) => {
    [0, 1].forEach(side => {
      const v = e[side], sg = side === 0 ? -1 : 1, R = rings.get(v), n = R.ring.length;
      ends[r][side] = sg * lines[r].half;
      if (n < 3) return;
      const k = R.ring.indexOf(r), k2 = (k + off + n) % n;
      if (R.open >= 0 && ((off === 1 && k === R.open) || (off === -1 && k2 === R.open))) return;  // 跨過開口：自由端
      const best = hit(r, R.ring[k2], sg);
      if (!best || best.along < 0.3 * lines[r].half || best.along > 1.6 * lines[r].half) return;
      ends[r][side] = best.u + sg * overhang;
      contacts.push({ r, ur: best.u, s: best.s, us: best.us, v });
    });
  });
  const rods = lines.map((l, i) => {
    const u0 = ends[i][0], u1 = ends[i][1];
    return { p0: [l.m[0] + l.d[0] * u0, l.m[1] + l.d[1] * u0], p1: [l.m[0] + l.d[0] * u1, l.m[1] + l.d[1] * u1], u0, u1, len: u1 - u0, free: [!contacts.some(c => c.r === i && c.v === l.a), !contacts.some(c => c.r === i && c.v === l.b)] };
  });
  contacts.forEach(c => { const R = rods[c.r], S = rods[c.s]; c.tr = (c.ur - R.u0) / R.len; c.ts = (c.us - S.u0) / S.len; });
  // 被壓在下面的桿件，接觸點必須落在桿身內；只接一點的懸空桿件逐步剔除
  let ok = contacts.filter(c => c.ts > 0.02 && c.ts < 0.98), alive = rods.map(() => true), changed = true;
  while (changed) {
    changed = false;
    const cnt = rods.map(() => 0); ok.forEach(c => { cnt[c.r]++; cnt[c.s]++; });
    rods.forEach((_, i) => { if (alive[i] && cnt[i] < 2) { alive[i] = false; changed = true; } });
    ok = ok.filter(c => alive[c.r] && alive[c.s]);
  }
  const map = []; const out = [];
  rods.forEach((r, i) => { if (alive[i]) { map[i] = out.length; out.push(r); } });
  ok.forEach(c => { c.r = map[c.r]; c.s = map[c.s]; });
  out.forEach((r, i) => { r.free = [!ok.some(c => c.r === i && c.tr < 0.5), !ok.some(c => c.r === i && c.tr >= 0.5)]; });
  return { rods: out, contacts: ok, dropped: rods.length - out.length };
};

// ---- 求解器 ----
G.makeSim = function (net, opt) {
  const n = net.rods.length, X = new Float64Array(n * 6), Xp = new Float64Array(n * 6);
  const W = opt.W, H = opt.H, R0 = Math.hypot(W, H) / 2, H0 = opt.dome;
  net.rods.forEach((r, i) => {
    [r.p0, r.p1].forEach((p, k) => {
      const q = 1 - (p[0] * p[0] + p[1] * p[1]) / (R0 * R0);
      X[i * 6 + k * 3] = p[0]; X[i * 6 + k * 3 + 1] = p[1]; X[i * 6 + k * 3 + 2] = H0 * Math.max(q, 0);
    });
  });
  Xp.set(X);
  const len = net.rods.map(r => r.len);
  // σ：讓 r 在 s 之上（初始 +z）
  net.contacts.forEach(c => { const dr = sub(net.rods[c.r].p1, net.rods[c.r].p0), ds = sub(net.rods[c.s].p1, net.rods[c.s].p0); c.sig = (dr[0] * ds[1] - dr[1] * ds[0]) >= 0 ? 1 : -1; });
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  return { X, Xp, len, net, n, supports: [], residual: 0 };
};

G.pt = function (X, r, t, out) { const o = r * 6; for (let k = 0; k < 3; k++) out[k] = X[o + k] * (1 - t) + X[o + 3 + k] * t; return out; };

G.step = function (sim, opt) {
  const { X, Xp, len, net, n } = sim, e = opt.e;
  const damp = 0.92, g = opt.gravity;
  // 支點點位
  const pinned = new Uint8Array(n * 2); sim.supports.forEach(s => pinned[s.pi] = 1);
  for (let p = 0; p < n * 2; p++) {
    const o = p * 3;
    for (let k = 0; k < 3; k++) { const v = (X[o + k] - Xp[o + k]) * damp; Xp[o + k] = X[o + k]; X[o + k] += v; }
    X[o + 2] -= g;
  }
  const A = [0, 0, 0], B = [0, 0, 0];
  let res = 0;
  for (let it = 0; it < opt.iters; it++) {
    const last = it === opt.iters - 1;
    // 桿長
    for (let r = 0; r < n; r++) {
      const o = r * 6, dx = X[o + 3] - X[o], dy = X[o + 4] - X[o + 1], dz = X[o + 5] - X[o + 2];
      const L = Math.hypot(dx, dy, dz) || 1e-9, f = (L - len[r]) / L / 2;
      X[o] += dx * f; X[o + 1] += dy * f; X[o + 2] += dz * f; X[o + 3] -= dx * f; X[o + 4] -= dy * f; X[o + 5] -= dz * f;
    }
    // 接觸：A - B = e·n
    for (const c of net.contacts) {
      const ro = c.r * 6, so = c.s * 6;
      const dr = [X[ro + 3] - X[ro], X[ro + 4] - X[ro + 1], X[ro + 5] - X[ro + 2]];
      const ds = [X[so + 3] - X[so], X[so + 4] - X[so + 1], X[so + 5] - X[so + 2]];
      // 與互承亭相同：接點可沿桿滑動，每次取兩桿的最近點（搭接長度由形決定，不再固定在起始位置）
      if (opt.slide !== false) {
        const wx = X[ro] - X[so], wy = X[ro + 1] - X[so + 1], wz = X[ro + 2] - X[so + 2];
        const a = dr[0] * dr[0] + dr[1] * dr[1] + dr[2] * dr[2], b = dr[0] * ds[0] + dr[1] * ds[1] + dr[2] * ds[2], cc = ds[0] * ds[0] + ds[1] * ds[1] + ds[2] * ds[2];
        const d1 = dr[0] * wx + dr[1] * wy + dr[2] * wz, e1 = ds[0] * wx + ds[1] * wy + ds[2] * wz, den = a * cc - b * b;
        if (den > 1e-9) { c.tr = Math.min(1, Math.max(0, (b * e1 - cc * d1) / den)); c.ts = Math.min(0.98, Math.max(0.02, (a * e1 - b * d1) / den)); }
      }
      G.pt(X, c.r, c.tr, A); G.pt(X, c.s, c.ts, B);
      let nx = dr[1] * ds[2] - dr[2] * ds[1], ny = dr[2] * ds[0] - dr[0] * ds[2], nz = dr[0] * ds[1] - dr[1] * ds[0];
      const nl = Math.hypot(nx, ny, nz) || 1e-9; nx *= c.sig / nl; ny *= c.sig / nl; nz *= c.sig / nl;
      const C = [A[0] - B[0] - e * nx, A[1] - B[1] - e * ny, A[2] - B[2] - e * nz];
      if (last) { const m = Math.hypot(...C); c.err = m; if (m > res) res = m; c.n = [nx, ny, nz]; }
      const wA = (1 - c.tr) ** 2 + c.tr ** 2, wB = (1 - c.ts) ** 2 + c.ts ** 2, lam = 1 / (wA + wB);
      move(c.r, c.tr, C, -lam); move(c.s, c.ts, C, lam);
    }
    // 桌面：不得穿過 z = 半徑
    for (let p = 0; p < n * 2; p++) if (X[p * 3 + 2] < opt.floor) X[p * 3 + 2] = opt.floor;
    // 支點：投影到滑軌
    for (const s of sim.supports) {
      const o = s.pi * 3;
      if (s.locked) { for (let k = 0; k < 3; k++) X[o + k] = s.c[k] + s.dir[k] * s.t * s.half; }
      else {
        let t = ((X[o] - s.c[0]) * s.dir[0] + (X[o + 1] - s.c[1]) * s.dir[1]) / Math.max(s.half, 1e-6);
        t = Math.max(-1, Math.min(1, t)); s.t = t;
        for (let k = 0; k < 3; k++) X[o + k] = s.c[k] + s.dir[k] * t * s.half;
      }
    }
  }
  function move(r, t, C, w) {
    const k = 1, o = r * 6;
    for (let q = 0; q < 3; q++) { X[o + q] += C[q] * w * (1 - t) * k; X[o + 3 + q] += C[q] * w * t * k; }
  }
  sim.residual = res;
  return res;
};

// 接頭手性：兩根錯開的桿有左右兩種交叉方式，互為鏡像（+1／-1）
G.jointChi = function (sim) {
  const { X, net } = sim;
  return net.contacts.map(c => {
    const ro = c.r * 6, so = c.s * 6;
    const dot = (X[ro + 3] - X[ro]) * (X[so + 3] - X[so]) + (X[ro + 4] - X[ro + 1]) * (X[so + 4] - X[so + 1]) + (X[ro + 5] - X[ro + 2]) * (X[so + 5] - X[so + 2]);
    return c.sig * (dot >= 0 ? 1 : -1);
  });
};
// 接頭角度（兩桿夾角，0–90°）
G.jointAngles = function (sim) {
  const { X, net } = sim;
  return net.contacts.map(c => {
    const ro = c.r * 6, so = c.s * 6;
    const dr = [X[ro + 3] - X[ro], X[ro + 4] - X[ro + 1], X[ro + 5] - X[ro + 2]];
    const ds = [X[so + 3] - X[so], X[so + 4] - X[so + 1], X[so + 5] - X[so + 2]];
    const cos = Math.abs(dr[0] * ds[0] + dr[1] * ds[1] + dr[2] * ds[2]) / (Math.hypot(...dr) * Math.hypot(...ds));
    return Math.acos(Math.min(1, cos)) * 180 / Math.PI;
  });
};

// X 形接頭：s 桿沿 z 軸，r 桿在 y = e，與 z 軸夾 θ
G.xClip = function (M, P, theta, famDots) {
  const rh = P.d / 2 + P.tol / 2, ro = rh + P.wall, Lr = Math.max(7, 2.2 * P.d + 3), seg = 32;
  const cyl = (L, r) => M.cylinder(L, r, r, seg, true);
  const sA = cyl(2 * Lr, ro), hA = cyl(2 * Lr + 2, rh);
  const rot = m => m.rotate([0, theta, 0]).translate([0, P.e, 0]);
  const sB = rot(cyl(2 * Lr, ro)), hB = rot(cyl(2 * Lr + 2, rh));
  const bridge = M.hull([M.sphere(ro, seg), M.sphere(ro, seg).translate([0, P.e, 0])]);
  let solid = M.union([sA, sB, bridge]).subtract(M.union([hA, hB]));
  const dots = [];
  for (let k = 0; k < famDots; k++) dots.push(M.sphere(0.6, 12).translate([(k - (famDots - 1) / 2) * 1.6, -(rh + P.wall * 0.55), Lr]));
  if (dots.length) solid = solid.subtract(M.union(dots));
  return solid;
};

// 落柱：在邊界角度 α 處找最近的桿端，建立滑軌（方向 = 徑向旋轉 trackAng）
G.supports = function (sim, specs, W, H) {
  const used = new Set();
  if (!sim.net.rods.length) { sim.supports = []; return; }
  sim.supports = specs.map(sp => {
    const a = sp.alpha * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const k = Math.min(Math.abs(ca) > 1e-9 ? (W / 2) / Math.abs(ca) : Infinity, Math.abs(sa) > 1e-9 ? (H / 2) / Math.abs(sa) : Infinity);
    const tx = ca * k, ty = sa * k;
    let best = -1, bd = Infinity;
    sim.net.rods.forEach((r, i) => [r.p0, r.p1].forEach((p, j) => {
      const pi = i * 2 + j; if (used.has(pi)) return;
      const d = Math.hypot(p[0] - tx, p[1] - ty) - (r.free[j] ? 6 : 0);
      if (d < bd) { bd = d; best = pi; }
    }));
    if (best < 0) best = 0;   // 換格型的瞬間可能找不到桿端，先落在第一根
    used.add(best);
    const rp = sim.net.rods[best >> 1][(best & 1) ? 'p1' : 'p0'];
    const ta = a + sp.trackAng * Math.PI / 180;
    return { pi: best, c: [rp[0], rp[1], sp.h], dir: [Math.cos(ta), Math.sin(ta), 0], half: sp.len / 2, t: sp.t, locked: sp.locked, spec: sp };
  });
};

if (typeof module !== 'undefined') module.exports = G;
