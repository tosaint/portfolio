// 心願繪馬：正面（彩繪）與背面（祈願＋考證合格章）以 canvas 繪製。
// 單位為設計稿的 560×480，S 倍輸出。資料 { n 暱稱, w 祈願, no 編號, d 日期, s 分數(如 "8/10") }
export const EMA_W = 560, EMA_H = 480;
const FIXED_TEXT = '心願繪馬中壢神社考證合格題No.0123456789 /';
// 網路字型依字元分段載入：畫之前先指定要用到的字，否則 canvas 會先用系統字
const fontsFor = d => Promise.all([document.fonts.load('400 22px "LXGW WenKai TC"', (d.w || '') + (d.n || '') + '　').catch(() => {}),
  document.fonts.load('400 12px "Noto Serif TC"', FIXED_TEXT + (d.d || '')).catch(() => {}), document.fonts.load('900 22px "Noto Serif TC"', '考證合格').catch(() => {})]);
const PL = { x: 50, y: 75, w: 460, h: 360 };          // 木牌外框
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
let assets = null;
export async function loadAssets(base = './') {
  if (!assets) assets = Promise.all([loadImg(base + 'callig-ink.png'), loadImg(base + '../img/axon-core.png'), loadImg(base + 'kamon-ink.png'),
    document.fonts.load('600 30px "Noto Serif TC"', FIXED_TEXT)])
    .then(([callig, axon, kamon]) => ({ callig, axon, kamon }));
  return assets;
}
function pent(x, X, Y, w, h) {
  x.beginPath(); x.moveTo(X + w / 2, Y); x.lineTo(X + w, Y + h * 0.24); x.lineTo(X + w, Y + h); x.lineTo(X, Y + h); x.lineTo(X, Y + h * 0.24); x.closePath();
}
function board(x, outer, inner, bg, shadow) {
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, EMA_W, EMA_H); }
  x.save(); x.shadowColor = shadow; x.shadowBlur = 18; x.shadowOffsetY = 10; pent(x, PL.x, PL.y, PL.w, PL.h); x.fillStyle = outer; x.fill(); x.restore();
  pent(x, PL.x + 8, PL.y + 8, PL.w - 16, PL.h - 16); x.fillStyle = inner; x.fill();
  // 木紋：幾道很淡的橫線
  x.save(); pent(x, PL.x + 8, PL.y + 8, PL.w - 16, PL.h - 16); x.clip(); x.strokeStyle = 'rgba(90,60,30,0.08)'; x.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) { const y = PL.y + 20 + i * 13.5; x.beginPath(); x.moveTo(PL.x, y); x.bezierCurveTo(PL.x + 150, y + 4 * Math.sin(i), PL.x + 300, y - 4 * Math.cos(i), PL.x + PL.w, y + 2); x.stroke(); }
  x.restore();
  // 掛孔與紅繩
  x.fillStyle = '#5a4128'; x.beginPath(); x.arc(280, PL.y + 49, 7, 0, Math.PI * 2); x.fill();
  x.save(); x.translate(235, 45); x.strokeStyle = '#a8322c'; x.lineWidth = 4; x.beginPath(); x.moveTo(45, 52); x.bezierCurveTo(20, 40, 22, 6, 45, 6); x.bezierCurveTo(68, 6, 70, 40, 45, 52); x.stroke(); x.restore();
}
const hand = (size, w = 400) => `${w} ${size}px "LXGW WenKai TC", "Noto Serif TC", serif`;
const serif = (size, w = 400) => `${w} ${size}px "Noto Serif TC", serif`;

export async function drawFront(canvas, d, S = 2.5, clear = false) {
  const A = await loadAssets(canvas.dataset.base || './'); await fontsFor(d);
  canvas.width = EMA_W * S; canvas.height = EMA_H * S; const x = canvas.getContext('2d'); x.setTransform(S, 0, 0, S, 0, 0);
  board(x, '#9c7445', '#dcc093', clear ? null : '#efeadf', 'rgba(70,50,25,0.25)');
  const cw = 50; x.drawImage(A.callig, 84, 171, cw, cw * A.callig.height / A.callig.width);
  // 彩繪：中軸線稿，裁成 326×200（object-position: center 45%）
  const bw = 326, bh = 200, sr = A.axon.width / A.axon.height, br = bw / bh;
  let sw = A.axon.width, sh = A.axon.height, sx = 0, sy = 0;
  if (sr > br) { sw = sh * br; sx = (A.axon.width - sw) / 2; } else { sh = sw / br; sy = (A.axon.height - sh) * 0.45; }
  x.save(); x.globalCompositeOperation = 'multiply'; x.drawImage(A.axon, sx, sy, sw, sh, 150, 171, bw, bh); x.restore();
  x.fillStyle = '#5a4128'; x.font = serif(13); x.letterSpacing = '3.9px'; x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillText('心願繪馬', 150, 396);
  x.letterSpacing = '0.9px'; x.font = serif(11); x.fillStyle = '#5a4a35'; x.textAlign = 'right'; x.fillText('1939　中壢神社', 476, 396);
  x.letterSpacing = '2.4px'; x.textAlign = 'center'; x.fillStyle = '#5f5a52'; x.font = serif(12); x.fillText(`No.${d.no || '----'}　${d.d || ''}　心願繪馬`, 280, 467);
  return canvas;
}
function vcol(x, s, cx, y0, size, step, font, color) {
  x.font = font; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '0px';
  [...s].forEach((ch, i) => { const y = y0 + step * i + step / 2; if ('，。、！？'.includes(ch)) x.fillText(ch, cx + size * 0.3, y - size * 0.25); else x.fillText(ch, cx, y); });
}
export async function drawBack(canvas, d, S = 2.5, clear = false) {
  const A = await loadAssets(canvas.dataset.base || './'); await fontsFor(d);
  canvas.width = EMA_W * S; canvas.height = EMA_H * S; const x = canvas.getContext('2d'); x.setTransform(S, 0, 0, S, 0, 0);
  board(x, '#8a6438', '#e3c99c', clear ? null : '#efeadf', 'rgba(70,50,25,0.25)');
  // 社紋（右上）
  x.save(); x.globalCompositeOperation = 'multiply'; x.beginPath(); x.arc(449, 190, 27, 0, Math.PI * 2); x.clip(); x.drawImage(A.kamon, 422, 163, 54, 54); x.restore();
  // 祈願：直書，每欄最多 8 字，由右往左；暱稱在最左一欄、靠下
  const w = [...(d.w || '')], cols = []; for (let i = 0; i < w.length; i += 8) cols.push(w.slice(i, i + 8).join(''));
  let cx = 400 - 18;
  cols.forEach(c => { vcol(x, c, cx, 163, 22, 24.5, hand(22), '#2b241c'); cx -= 38; });
  const name = [...(d.n || '')];
  vcol(x, name.join(''), cx - 4, 163 + 230 - name.length * 19.5, 17, 19.5, hand(17), '#2b241c');
  // 考證合格章
  x.save(); x.translate(84 + 38, 330); x.rotate(-6 * Math.PI / 180);
  x.strokeStyle = '#b3322b'; x.lineWidth = 3; x.beginPath(); x.roundRect(-38, -38, 76, 76, 6); x.stroke();
  x.fillStyle = '#b3322b'; x.font = serif(22, 900); x.textAlign = 'center'; x.textBaseline = 'middle';
  [['考', -15, -15], ['證', 15, -15], ['合', -15, 15], ['格', 15, 15]].forEach(([c, a, b]) => x.fillText(c, a, b));
  x.restore();
  if (d.s) { x.fillStyle = '#4a3b29'; x.font = serif(11); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.letterSpacing = '0.6px'; x.fillText(String(d.s).replace('/', ' / ') + ' 題', 122, 392); }
  x.letterSpacing = '2.4px'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#5f5a52'; x.font = serif(12); x.fillText(`No.${d.no || '----'}　${d.d || ''}　心願繪馬`, 280, 467);
  return canvas;
}
// 網址 # 後的資料：base64url 的 JSON
export function readHash() {
  try {
    let s = location.hash.slice(1).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))));
    const cut = (v, n) => [...String(v || '')].slice(0, n).join('');
    return { n: cut(o.n, 8), w: cut(o.w, 20), no: cut(o.no, 6), d: cut(o.d, 10), s: cut(o.s, 6) };
  } catch (e) { return null; }
}
