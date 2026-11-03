// 中壢神社的「真實尺度」：把配置模型的單位換成公尺，並放到今天的經緯度上。
//
// 依據（2026-11-03）：
//  1. 內苑尺度 1 模型單位 ≈ 1.55 公尺：
//     ・銅馬掃描＋現場實測（含台座自路面起算 3.10 公尺）→ 約 1.45 公尺／單位
//     ・拜殿前參拜道實測寬 3.01 公尺，在老照片中反求 → 約 1.61 公尺／單位
//  2. 神社中軸：殘存參拜道實測朝本殿方位 308°（西北）。
//  3. 本殿與拜殿基座 ↔ 今陶然亭（1991 年在基座上改建）。
//  4. 第一鳥居 ↔ 南大門舊址（中正路 740 巷口）：長參道依此拉長到真實距離。
//  5. 高程：陶然亭 136 m、銅馬路面 133 m、殘存參拜道 134 m（手機量測，約 ±3 m），
//     內苑地面暫定比外參道高約 1 公尺；原配置模型的平台厚度過大，垂直方向壓縮。
//
// 座標說明：q = 公尺、與配置模型同方向的平面座標（q.y 朝本殿）；three.js 世界座標 = (q.x, 高度, -q.y)。

export const S_IN = 1.55;          // 內苑：公尺／模型單位（建物大小與彼此距離）
export const LEVEL = 0.255;        // 原配置平台高度 → 公尺（3.85 單位的內苑 ≈ 1 公尺）
export const BEARING = 308;        // 神社中軸方位（q.y 方向），度，北起順時針
const P0 = [9.5, 17.4];            // 模型中拜殿與本殿之間 ↔ 陶然亭
const TORAN = [24.96265, 121.209686];
const NANDAMEN = [24.961157, 121.208661];
const B1 = [-80.05, 5.94];         // 模型中的第一鳥居
const R1 = 42;                     // 內苑範圍（模型單位）：以內等比例，以外拉長參道

const lat0 = 24.962, lng0 = 121.2095;
const mx = 111320 * Math.cos(lat0 * Math.PI / 180), my = 110574;
const toENU = (lat, lng) => [(lng - lng0) * mx, (lat - lat0) * my];
const fromENU = ([e, n]) => [lat0 + n / my, lng0 + e / mx];
const rad = d => d * Math.PI / 180;
const U = [Math.sin(rad(BEARING + 90)), Math.cos(rad(BEARING + 90))];   // q.x 方向（東、北分量）
const V = [Math.sin(rad(BEARING)), Math.cos(rad(BEARING))];             // q.y 方向
const T_ENU = toENU(...TORAN);

// 參道外段的拉長比例：讓第一鳥居剛好落在南大門舊址
const dB1 = Math.hypot(B1[0] - P0[0], B1[1] - P0[1]);
const realB1 = Math.hypot(...toENU(...NANDAMEN).map((v, i) => v - T_ENU[i]));
export const S_OUT = (realB1 - R1 * S_IN) / (dB1 - R1);

/** 模型平面座標 [x, y] → q（公尺） */
export function warpH([x, y]) {
  const dx = x - P0[0], dy = y - P0[1], d = Math.hypot(dx, dy);
  if (d < 1e-9) return [0, 0];
  const D = d <= R1 ? d * S_IN : R1 * S_IN + (d - R1) * S_OUT;
  return [dx / d * D, dy / d * D];
}
/** 模型高度 → 公尺：base 為構件底部的原高度 */
export const warpY = (y, base) => base * LEVEL + (y - base) * S_IN;

/** 模型世界座標 [x, y, z]（three.js）→ 公尺世界座標；base 為參考底高（預設內苑 3.85） */
export function modelToWorld([x, y, z], base = 3.85) {
  const q = warpH([x, -z]);
  return [q[0], warpY(y, base), -q[1]];
}

export function qToLL([qx, qy]) {
  return fromENU([T_ENU[0] + qx * U[0] + qy * V[0], T_ENU[1] + qx * U[1] + qy * V[1]]);
}
export function llToQ(lat, lng) {
  const [e, n] = toENU(lat, lng), d = [e - T_ENU[0], n - T_ENU[1]];
  return [d[0] * U[0] + d[1] * U[1], d[0] * V[0] + d[1] * V[1]];
}
// 正北在 q 座標中的方向（俯視時讓北方朝上）
export const NORTH_Q = [U[1], V[1]];
