// ===== 編木互承：幾何求解與接頭生成（純函式，可在 node 測試）=====
// 單位 mm。立面座標 (x, y)，z 為寬度方向。
const deg = r => r * 180 / Math.PI;
const rad = d => d * Math.PI / 180;

// 依節點位置分配可調線（接頭家族）：k 條線，由中央向兩端分區
function familyOf(i, N, k) {
  const c = (N - 1) / 2, half = Math.max(c, 1);
  const t = Math.abs(i - c) / half;            // 0 中央 → 1 端部
  return Math.min(k - 1, Math.floor(t * k * 0.9999));
}

// 由偏心距建立剛性鏈（局部座標，起點在原點、起始方向水平向右、順時針轉 = 往上拱）
function buildChain(N, s, e) {
  const alpha = new Array(N).fill(0);
  for (let i = 1; i < N - 1; i++) {
    const h = e[i] + (e[i - 1] + e[i + 1]) / 2;  // 中間交點相對弦線的矢高
    alpha[i] = 2 * Math.atan(h / s);
  }
  const Q = [[0, 0]];
  let th = 0;
  for (let i = 1; i < N; i++) {
    if (i > 1) th -= alpha[i - 1];
    Q.push([Q[i - 1][0] + s * Math.cos(th), Q[i - 1][1] + s * Math.sin(th)]);
  }
  const turn = alpha.reduce((a, b) => a + b, 0);
  const c = [Q[N - 1][0], Q[N - 1][1]];
  return { Q, alpha, turn, chord: Math.hypot(c[0], c[1]), chordAng: Math.atan2(c[1], c[0]) };
}

function eArray(P) {
  return Array.from({ length: P.N }, (_, i) => P.d + P.lines[familyOf(i, P.N, P.k)].delta);
}

// 主求解：回傳放置後的節點、狀態、訊息
function solve(P) {
  const L = P.left, R = P.right;
  const sx = tr => tr.x0 + tr.t * tr.len;
  const freeSup = [!L.locked, !R.locked];
  const freeLines = P.lines.slice(0, P.k).map((l, i) => l.locked ? -1 : i).filter(i => i >= 0);
  const out = { status: 'green', msg: '', gap: 0, tL: L.t, tR: R.t, deltas: P.lines.map(l => l.delta) };
  const withDeltas = ds => eArray({ ...P, lines: P.lines.map((l, i) => ({ ...l, delta: ds[i] })) });

  let SL, SR;
  if (!freeSup[0] && !freeSup[1]) {
    SL = [sx(L), L.y]; SR = [sx(R), R.y];
    const D = Math.hypot(SR[0] - SL[0], SR[1] - SL[1]);
    if (freeLines.length) {
      const f = x => { const ds = out.deltas.slice(); freeLines.forEach(i => ds[i] = x); return buildChain(P.N, P.s, withDeltas(ds)).chord - D; };
      const max = P.deltaMax, n = 80;
      let lo = null, best = { x: 0, v: Infinity };
      let prevX = 0, prevV = f(0);
      for (let j = 0; j <= n; j++) {
        const x = max * j / n, v = f(x);
        if (Math.abs(v) < Math.abs(best.v)) best = { x, v };
        if (j > 0 && prevV * v <= 0) { lo = [prevX, x]; break; }
        prevX = x; prevV = v;
      }
      let x = best.x;
      if (lo) {
        let [a, b] = lo;
        for (let it = 0; it < 50; it++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; }
        x = (a + b) / 2;
        out.msg = `反推成功：自由可調線 ${freeLines.map(i => 'ABC'[i]).join('、')} 墊高 ${x.toFixed(2)} mm`;
      } else {
        out.status = 'red'; out.gap = Math.abs(best.v);
        out.msg = `兩端落柱都鎖定，自由可調線在 0–${max} mm 墊高範圍內都接不上，最接近仍差 ${out.gap.toFixed(1)} mm`;
      }
      freeLines.forEach(i => out.deltas[i] = x);
    } else {
      const g = buildChain(P.N, P.s, eArray(P)).chord - D;
      out.gap = Math.abs(g);
      if (out.gap > 0.5) { out.status = 'red'; out.msg = `過度約束：落柱與可調線全部鎖定，鏈長與兩柱距離差 ${out.gap.toFixed(1)} mm（${g > 0 ? '拱太平、太長' : '拱太彎、太短'}）`; }
      else out.msg = '全部鎖定且剛好吻合';
    }
  } else {
    const ch = buildChain(P.N, P.s, eArray(P));
    const fixedIsL = !freeSup[0];          // 兩者皆自由時，以左柱滑桿位置為準
    const F = fixedIsL ? L : R, M = fixedIsL ? R : L;
    const Fp = [sx(F), F.y];
    const dy = M.y - Fp[1];
    if (dy * dy > ch.chord * ch.chord) {
      out.status = 'red'; out.gap = Math.abs(dy) - ch.chord;
      out.msg = `兩柱高差 ${Math.abs(dy).toFixed(0)} mm 大於拱的弦長，無法落柱`;
      SL = fixedIsL ? Fp : [Fp[0] - ch.chord, Fp[1]]; SR = fixedIsL ? [Fp[0] + ch.chord, Fp[1]] : Fp;
    } else {
      const dx = Math.sqrt(ch.chord * ch.chord - dy * dy);
      const x = fixedIsL ? Fp[0] + dx : Fp[0] - dx;
      const t = (x - M.x0) / M.len;
      const tc = Math.min(1, Math.max(0, t));
      if (fixedIsL) out.tR = tc; else out.tL = tc;
      const Mp = [M.x0 + tc * M.len, M.y];
      SL = fixedIsL ? Fp : Mp; SR = fixedIsL ? Mp : Fp;
      if (t < -1e-6 || t > 1 + 1e-6) {
        out.status = 'red'; out.gap = Math.abs(x - Mp[0]);
        out.msg = `${fixedIsL ? '右' : '左'}柱需滑到軌道外 ${out.gap.toFixed(1)} mm 才接得上：請加長滑動軌或改變偏心距`;
        if (fixedIsL) SR = [x, M.y]; else SL = [x, M.y];
        out.target = fixedIsL ? Mp : Mp;
      } else {
        const both = freeSup[0] && freeSup[1];
        if (both || freeLines.length) {
          out.status = 'blue';
          out.msg = both ? '約束不足：兩柱都自由，暫以左柱滑桿位置求右柱' : `約束不足：仍有自由可調線（${freeLines.map(i => 'ABC'[i]).join('、')}），暫用目前墊高值`;
        } else out.msg = `${fixedIsL ? '右' : '左'}柱自動滑到軌道 ${(tc * 100).toFixed(0)}% 處`;
      }
    }
  }
  // 放置
  const ch = buildChain(P.N, P.s, withDeltas(out.deltas));
  let phi = Math.atan2(SR[1] - SL[1], SR[0] - SL[0]) - ch.chordAng;
  const cs = Math.cos(phi), sn = Math.sin(phi);
  const pts = ch.Q.map(([x, y]) => [SL[0] + cs * x - sn * y, SL[1] + sn * x + cs * y]);
  if (out.status === 'red' && !out.target) out.target = SR;
  out.pts = pts; out.chain = ch; out.e = withDeltas(out.deltas);
  if (deg(ch.turn) > 200) { out.status = 'red'; out.msg = `拱轉角 ${deg(ch.turn).toFixed(0)}° 超過半圓太多，請加大交點間距或減少節點`; }
  return out;
}

// 由放置後節點產生桿件、接頭清單
function assemble(P, S) {
  const { pts, e } = S, N = P.N;
  const tan = i => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  };
  const nrm = i => { const t = tan(i); return [-t[1], t[0]]; };   // 左法向 = 朝上（拱外側）
  const over = i => { const n = nrm(i); return [pts[i][0] + e[i] * n[0], pts[i][1] + e[i] * n[1]]; };
  const under = i => { const n = nrm(i); return [pts[i][0] - e[i] * n[0], pts[i][1] - e[i] * n[1]]; };
  const ext = (a, b, o) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [b[0] + (b[0] - a[0]) / L * o, b[1] + (b[1] - a[1]) / L * o]; };
  const laneZ = j => (j - (P.lanes - 1) / 2) * P.laneGap;
  const rods = [], clips = [];
  for (let j = 0; j < P.lanes; j++) {
    const p = j % 2, z = laneZ(j);
    const ends = []; for (let i = p; i < N; i += 2) ends.push(i);
    const laneRods = [];
    if (p === 1) laneRods.push({ a: ext(over(1), under(0), P.overhang), b: over(1), stub: true, ia: 0, ib: 1 });
    for (let k = 0; k + 1 < ends.length; k++) laneRods.push({ a: over(ends[k]), b: over(ends[k + 1]), ia: ends[k], ib: ends[k + 1] });
    if ((N - 1) % 2 !== p) laneRods.push({ a: over(N - 2), b: ext(over(N - 2), under(N - 1), P.overhang), stub: true, ia: N - 2, ib: N - 1 });
    laneRods.forEach(r => { r.z = z; r.len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) - (r.stub ? 0.5 : 1); rods.push(r); });
    for (let i = 0; i < N; i++) {
      const fam = familyOf(i, N, P.k);
      let kind, kink = 0;
      if (i % 2 === p) {
        const inR = laneRods.find(r => r.ib === i), outR = laneRods.find(r => r.ia === i);
        if (inR && outR) {
          kind = 'E2';
          const d1 = Math.atan2(inR.b[1] - inR.a[1], inR.b[0] - inR.a[0]), d2 = Math.atan2(outR.b[1] - outR.a[1], outR.b[0] - outR.a[0]);
          kink = Math.abs(deg(d1 - d2));
          kink = Math.round(kink * 2) / 2;
        } else kind = 'E1';
      } else kind = 'M';
      const n = nrm(i);
      clips.push({ i, lane: j, z, fam, kind, kink, e: Math.round(e[i] * 100) / 100, x: pts[i][0], y: pts[i][1], rot: Math.atan2(n[1], n[0]) - Math.PI / 2, side: inOut(i, laneRods) });
    }
  }
  function inOut(i, lr) { const a = lr.find(r => r.ib === i), b = lr.find(r => r.ia === i); return a && !b ? 'in' : (!a && b ? 'out' : ''); }
  // 接頭類型
  const types = new Map();
  clips.forEach(c => {
    const key = `${'ABC'[c.fam]}-${c.kind}${c.kind === 'E2' ? '-' + c.kink.toFixed(1) : ''}-e${c.e.toFixed(2)}`;
    c.key = key;
    if (!types.has(key)) types.set(key, { key, fam: c.fam, kind: c.kind, kink: c.kink, e: c.e, count: 0 });
    types.get(key).count++;
  });
  // 裁切清單
  const W = (P.lanes - 1) * P.laneGap + 2 * P.overhang + 2 * P.d;
  const cut = new Map();
  rods.forEach(r => { const L = Math.round(r.len * 2) / 2; cut.set(L, (cut.get(L) || 0) + 1); });
  return { rods, clips, types: [...types.values()].sort((a, b) => a.key.localeCompare(b.key)), cut: [...cut.entries()].sort((a, b) => b[0] - a[0]), barLen: W, laneZ, tan, nrm };
}

// 接頭實體（manifold-3d）。局部座標：z = 橫木軸；桿件軸在 y = ±e（M 在下、E 在上）
function clipSolid(M, P, t) {
  const rh = P.d / 2 + P.tol / 2, ro = rh + P.wall, Lr = Math.max(7, 2.2 * P.d + 3), Lb = 2 * ro + 2, seg = 32;
  const cyl = (L, r, centered) => M.cylinder(L, r, r, seg, centered);
  const alongDir = (m, a) => m.rotate([0, 90, 0]).rotate([0, 0, a]);   // z 軸轉到 xy 平面角度 a
  const bar = cyl(Lb, ro, true);
  const barHole = cyl(Lb + 2, rh, true);
  const yv = t.kind === 'M' ? -t.e : t.e;
  let sleeves = [], holes = [];
  if (t.kind === 'M') {
    sleeves.push(alongDir(cyl(2 * Lr, ro, true), 0).translate([0, yv, 0]));
    holes.push(alongDir(cyl(2 * Lr + 2, rh, true), 0).translate([0, yv, 0]));
  } else {
    const h = t.kind === 'E2' ? t.kink / 2 : 0;
    const dirs = t.kind === 'E2' ? [180 + h, -h] : [0];
    dirs.forEach(a => {
      sleeves.push(alongDir(cyl(Lr, ro, false), a).translate([0, yv, 0]));
      holes.push(alongDir(cyl(Lr + 1, rh, false), a).translate([0, yv, 0]));
    });
    sleeves.push(M.sphere(ro, seg).translate([0, yv, 0]));
  }
  const bridge = M.hull([bar, M.sphere(ro, seg).translate([0, yv, 0])]);
  let solid = M.union([bar, bridge, ...sleeves]);
  solid = solid.subtract(M.union([barHole, ...holes]));
  // 家族記號：橫木套筒端面的小圓點，A=1 B=2 C=3
  const dots = [];
  for (let k = 0; k <= t.fam; k++) dots.push(M.sphere(0.7, 12).translate([(k - t.fam / 2) * 1.8, t.kind === 'M' ? rh + P.wall * 0.55 : -(rh + P.wall * 0.55), Lb / 2]));
  if (dots.length && P.wall >= 1.2) solid = solid.subtract(M.union(dots));
  return solid;
}

// 公差測試片：5 個孔，孔徑 d+0.1 … d+0.5
function tolTest(M, P) {
  const seg = 32, n = 5, pitch = P.d + 6;
  let block = M.cube([n * pitch + 4, P.d + 8, 8], false).translate([-2, -(P.d + 8) / 2, 0]);
  for (let k = 0; k < n; k++) block = block.subtract(M.cylinder(20, (P.d + 0.1 * (k + 1)) / 2, (P.d + 0.1 * (k + 1)) / 2, seg, false).translate([k * pitch + pitch / 2, 0, -5]));
  // 記號凹點：孔旁 1..5 點
  for (let k = 0; k < n; k++) for (let q = 0; q <= k; q++) block = block.subtract(M.sphere(0.6, 12).translate([k * pitch + pitch / 2 - 2 + q * 1.2, (P.d + 8) / 2, 4]));
  return block;
}

function toSTL(mesh, name) {
  const np = mesh.numProp, v = mesh.vertProperties, t = mesh.triVerts, n = t.length / 3;
  const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  const head = (name || 'solid').slice(0, 79);
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 127);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let f = 0; f < n; f++) {
    const a = t[3 * f] * np, b = t[3 * f + 1] * np, c = t[3 * f + 2] * np;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
    for (const p of [a, b, c]) { dv.setFloat32(o, v[p], true); dv.setFloat32(o + 4, v[p + 1], true); dv.setFloat32(o + 8, v[p + 2], true); o += 12; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return buf;
}

if (typeof module !== 'undefined') module.exports = { familyOf, buildChain, solve, assemble, clipSolid, tolTest, toSTL, eArray };
