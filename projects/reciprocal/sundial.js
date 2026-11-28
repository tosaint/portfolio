// ===== 日晷：中壢的太陽位置、光孔投影與底板刻度 =====
// 座標同 meshcore：x 向右、y 向上、z 向前（平面圖的下方）；單位 mm。
// 「北方」= 真北在底板上的方向，從底板上緣（-z）順時針量的角度。
const SD = (() => {
  const LAT = 24.96, LON = 121.22, TZ = 8, rad = Math.PI / 180;
  // 二十四節氣（平年的日序，誤差 ±1 天，日晷刻度夠用）
  const TERMS = [['小寒', 5], ['大寒', 20], ['立春', 35], ['雨水', 50], ['驚蟄', 64], ['春分', 79], ['清明', 95], ['穀雨', 110], ['立夏', 125], ['小滿', 141], ['芒種', 156], ['夏至', 172],
    ['小暑', 188], ['大暑', 203], ['立秋', 219], ['處暑', 235], ['白露', 250], ['秋分', 266], ['寒露', 281], ['霜降', 296], ['立冬', 311], ['小雪', 326], ['大雪', 341], ['冬至', 355]];
  // 日期線：太陽赤緯相近的兩個節氣共用一條（上半年 ↔ 下半年）
  const DATE_LINES = [[355, '冬至', 3], [5, '小寒 大雪', 1], [20, '大寒 小雪', 1], [35, '立春 立冬', 1], [50, '雨水 霜降', 1], [64, '驚蟄 寒露', 1], [79, '春分 秋分', 2],
    [95, '清明 白露', 1], [110, '穀雨 處暑', 1], [125, '立夏 立秋', 1], [141, '小滿 大暑', 1], [156, '芒種 小暑', 1], [172, '夏至', 3]];
  const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const dateOf = N => { let m = 0; N = Math.round(N); while (m < 11 && N > MD[m]) { N -= MD[m]; m++; } return [m + 1, N]; };
  const doy = d => { const [m, day] = [d.getMonth(), d.getDate()]; let n = day; for (let i = 0; i < m; i++) n += MD[i]; return Math.min(365, n); };
  const termOf = N => { for (const [t, n] of TERMS) if (Math.abs(n - N) <= 1) return t; return ''; };
  const hhmm = t => { t = Math.round(t); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  // NOAA 近似式：N＝日序，t＝台灣時間（分鐘）。回傳 [東, 北, 上] 的單位向量與均時差、赤緯
  function enu(N, t) {
    const g = 2 * Math.PI / 365 * (N - 1 + (t / 60 - 12) / 24);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = ((t + eq + 4 * LON - 60 * TZ) / 4 - 180) * rad, f = LAT * rad;
    return { v: [-Math.cos(dec) * Math.sin(ha), Math.sin(dec) * Math.cos(f) - Math.cos(dec) * Math.sin(f) * Math.cos(ha), Math.sin(dec) * Math.sin(f) + Math.cos(dec) * Math.cos(f) * Math.cos(ha)], eq, dec: dec / rad };
  }
  // 太陽方向（指向太陽）轉到底板座標
  function sun(N, t, north) {
    const [E, No, U] = enu(N, t).v, a = (north || 0) * rad;
    const n = [Math.sin(a), 0, -Math.cos(a)], e = [Math.cos(a), 0, Math.sin(a)];
    return [E * e[0] + No * n[0], U, E * e[2] + No * n[2]];
  }
  const alt = v => Math.asin(Math.max(-1, Math.min(1, v[1]))) / rad;
  // 光孔 h 投到 y=0 的點；太陽太低（< 3°）視為無效
  const spot = (h, v) => v[1] < 0.05 ? null : [h[0] - v[0] * h[1] / v[1], h[2] - v[2] * h[1] / v[1]];
  // 沿參數取點，跑出底板或太陽下山就斷開，回傳多條折線 [[x,z],...]
  function trace(f, a, b, step, bx, bz) {
    const out = []; let cur = [];
    for (let s = a; s <= b + 1e-9; s += step) { const p = f(s); if (p && Math.abs(p[0]) <= bx && Math.abs(p[1]) <= bz) cur.push(p); else { if (cur.length > 1) out.push(cur); cur = []; } }
    if (cur.length > 1) out.push(cur); return out;
  }
  // 整座日晷盤：日期線（節氣）、整點的 8 字線（含均時差，對手錶時間）、當天的光點軌跡
  function dial(h, north, bx, bz, N) {
    const dates = DATE_LINES.map(([n, name, w]) => ({ n, name, w, segs: trace(t => spot(h, sun(n, t, north)), 300, 1140, 4, bx, bz) }));
    const hours = []; for (let hr = 6; hr <= 18; hr++) hours.push({ hr, segs: trace(n => spot(h, sun(((n - 1) % 365) + 1, hr * 60, north)), 1, 366, 3, bx, bz) });
    const today = trace(t => spot(h, sun(N, t, north)), 300, 1140, 3, bx, bz);
    return { dates, hours, today };
  }
  // 某一天光點落在底板上的時段
  function span(h, north, bx, bz, N) {
    let a = null, b = null;
    for (let t = 300; t <= 1140; t += 2) { const p = spot(h, sun(N, t, north)); if (p && Math.abs(p[0]) <= bx && Math.abs(p[1]) <= bz) { if (a === null) a = t; b = t; } }
    return a === null ? null : [a, b];
  }
  // 選光孔用的取樣：二分二至 × 8–16 點
  const SAMPLE_DAYS = [355, 79, 172, 266];
  function score(h, north, bx, bz) {
    let n = 0; for (const d of SAMPLE_DAYS) for (let hr = 8; hr <= 16; hr++) { const p = spot(h, sun(d, hr * 60, north)); if (p && Math.abs(p[0]) <= bx && Math.abs(p[1]) <= bz) n++; }
    return n;
  }
  return { LAT, LON, TERMS, DATE_LINES, dateOf, doy, termOf, hhmm, enu, sun, alt, spot, trace, dial, span, score, SAMPLES: SAMPLE_DAYS.length * 9 };
})();
