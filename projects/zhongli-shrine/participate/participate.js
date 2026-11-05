// 作品說明頁「參與：領取紀念」：三份網頁版表單（自填 Email），送到各自的 Apps Script（doPost）。
// 資料寫進原本的回應試算表，寄信、評分、上牆、點燈照原本流程。
import { EMA_QS } from './questions.js?v=1';
import { OMAMORI_API } from '../gifts/config.js?v=1';
import { EMA_API } from '../ema/config.js?v=2';
import { LANTERN_API } from '../app/lantern-config.js?v=2';
import { drawFront, drawBack } from '../ema/ema.js?v=3';

const STOPS = ['第一鳥居：從中正路進來', '第二鳥居：鎮座祭行列', '石燈籠與社務所', '拜殿：「臺灣唯一」的檜皮葺', '本殿：最深處', '神門、狛犬與銅馬'];
const $ = (s, r = document) => r.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let uid = 0;
const radios = (name, opts, req = true) => `<div class="p-opts">${opts.map(o => { const id = 'p' + (++uid);
  return `<label for="${id}"><input type="radio" id="${id}" name="${name}" value="${esc(o)}"${req ? ' required' : ''}><span>${esc(o)}</span></label>`; }).join('')}</div>`;
const scale = name => `<div class="p-scale"><span>非常不同意</span>${[1, 2, 3, 4, 5].map(v => { const id = 'p' + (++uid);
  return `<label for="${id}"><input type="radio" id="${id}" name="${name}" value="${v}" required><span>${v}</span></label>`; }).join('')}<span>非常同意</span></div>`;
const field = (label, inner, hint = '') => `<fieldset class="p-q"><legend>${label}</legend>${hint ? `<p class="p-hint">${hint}</p>` : ''}${inner}</fieldset>`;
const text = (name, label, max, hint, ph = '') => { const id = 'p' + (++uid);
  return `<div class="p-q"><label class="p-lab" for="${id}">${label}</label>${hint ? `<p class="p-hint">${hint}</p>` : ''}<input id="${id}" name="${name}" maxlength="${max}" required placeholder="${esc(ph)}" autocomplete="off"></div>`; };
const head = () => { const id = 'p' + (++uid);
  return `<div class="p-q"><label class="p-lab" for="${id}">你的 Email</label><p class="p-hint">紀念會寄到這個信箱，不會公開。</p>
  <input id="${id}" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="學號@student.clhs.tyc.edu.tw">
  <input class="p-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"></div>`; };

const FORMS = {
  omamori: {
    title: '導覽紀念御守', api: OMAMORI_API,
    body: () => head() +
      field('導覽之前，你對中壢神社了解多少？', radios('know', ['完全不知道', '聽過名字', '知道一些歷史', '曾主動查資料或參訪'])) +
      field('六站導覽中，哪一站最讓你印象深刻？', radios('stop', STOPS)) +
      field('老照片和 3D 模型的對照，幫助我理解當年的樣貌。', scale('photo')) +
      field('我能分辨導覽中哪些內容有史料依據、哪些是推測或示意。', scale('evidence')) +
      (() => { const id = 'p' + (++uid); return `<div class="p-q"><label class="p-lab" for="${id}">如果要向沒看過導覽的同學介紹這個地方，你最想告訴他什麼？</label><textarea id="${id}" name="tell" maxlength="500" rows="3" required></textarea></div>`; })() +
      text('wish', '想為這個地方留下的一句話', 20, '20 字以內，會印在你的御守上', '走過鳥居，記得這片土地') +
      text('name', '御守上的暱稱', 8, '8 字以內，建議用暱稱或「陳○安」這樣的寫法') +
      field('是否同意把暱稱和這句話公開在心願牆上？', radios('publish', ['不公開', '只公開暱稱', '暱稱與這句話都公開'])),
    payload: f => { const v = n => f.elements[n].value; return { know: v('know'), stop: v('stop'), photo: v('photo'), evidence: v('evidence'), tell: v('tell') }; },
    done: () => '<h3>已送出！</h3><p>幾分鐘內請到信箱收信，領取你的御守桌布。</p>',
  },
  ema: {
    title: '心願繪馬・考證測驗', api: EMA_API,
    body: () => head() +
      `<p class="p-hint p-intro">共 ${EMA_QS.length} 題，答對 6 題就能領取心願繪馬。題目都出自六站導覽。</p>` +
      EMA_QS.map((q, i) => field(`${i + 1}. ${esc(q.q)}`, radios('q' + q.id, q.o))).join('') +
      text('wish', '寫在繪馬背面的祈願', 20, '20 字以內', '原來拜殿就在陶然亭這裡') +
      text('name', '繪馬上的暱稱', 8, '8 字以內，建議用暱稱或「陳○安」這樣的寫法') +
      field('是否同意把繪馬掛上公開的繪馬牆？', radios('publish', ['不公開，只要我自己的繪馬', '只公開暱稱', '暱稱與祈願都公開'])),
    payload: f => ({ answers: Object.fromEntries(EMA_QS.map(q => [q.id, (f.elements['q' + q.id] || {}).value || ''])) }),
    done: r => r.passed
      ? `<h3>考證合格！答對 ${r.got} / ${r.total} 題</h3><p>你的心願繪馬已經寄到信箱。選擇公開的話，幾分鐘內會掛上<a href="#ema-wall" data-wall>繪馬牆</a>。</p>`
      : `<h3>差一點！答對 ${r.got} / ${r.total} 題</h3><p>答對 ${r.pass || 6} 題就能領取繪馬。題目都在<a href="app/">六站導覽</a>裡，找到答案後再試一次（同一個 Email 一小時後可以再送）。</p>`,
  },
  lantern: {
    title: '心願燈籠・實地踏查', api: LANTERN_API,
    body: () => head() +
      `<p class="p-hint p-intro">請親自到三個地方拍照。直接從相簿選原始照片；iPhone 請在「設定 → 相機 → 格式」選「最相容」。義民廟請在白天結伴前往，拍照時保持安靜與禮貌。</p>` +
      [['horse', '照片 1：銅馬（中央西路正門）'], ['tile', '照片 2：拜殿前的地磚遺跡'], ['koma', '照片 3：義民廟（忠義祠）的狛犬']].map(([k, t]) => { const id = 'p' + (++uid);
        return `<div class="p-q"><label class="p-lab" for="${id}">${t}</label><input id="${id}" name="ph_${k}" type="file" accept="image/*" required><p class="p-hint p-ph" data-k="${k}"></p></div>`; }).join('') +
      (() => { const a = 'p' + (++uid), b = 'p' + (++uid); return `<fieldset class="p-q"><legend>地磚遺跡：量到的一塊地磚大小（公分）</legend><div class="p-two">
        <label for="${a}">長<input id="${a}" name="tileL" type="number" min="1" max="500" step="0.1" inputmode="decimal" required></label>
        <label for="${b}">寬<input id="${b}" name="tileW" type="number" min="1" max="500" step="0.1" inputmode="decimal" required></label></div></fieldset>`; })() +
      text('wish', '燈籠上的祈願', 20, '20 字以內') +
      text('name', '燈籠上的暱稱', 8, '8 字以內，會直書印在燈籠上') +
      field('是否同意把燈籠點在公開的 3D 神社裡？', radios('publish', ['不公開', '只公開暱稱', '暱稱與祈願都公開'])),
    payload: async f => {
      const photos = {};
      for (const k of ['horse', 'tile', 'koma']) photos[k] = await shrinkKeepExif(f.elements['ph_' + k].files[0]);
      return { photos, tileL: f.elements.tileL.value, tileW: f.elements.tileW.value };
    },
    done: () => '<h3>已收到你的踏查紀錄！</h3><p>老師確認後，你的燈籠就會點亮在 3D 神社的外參道，到時候會寄信通知你。</p>',
  },
};

// ---- 照片：縮到長邊 1600 像素再上傳，並把原檔的 EXIF（含 GPS、拍攝時間）接回去 ----
async function shrinkKeepExif(file) {
  if (!file) throw new Error('請上傳三張照片');
  const buf = new Uint8Array(await file.arrayBuffer());
  let exif = null;
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let p = 2;
    while (p < buf.length - 4 && buf[p] === 0xff) {
      const mk = buf[p + 1], len = (buf[p + 2] << 8) | buf[p + 3];
      if (mk === 0xe1 && buf[p + 4] === 0x45 && buf[p + 5] === 0x78) { exif = buf.slice(p, p + 2 + len); break; }
      if (mk === 0xda) break; p += 2 + len;
    }
  }
  if (exif) fixOrientation(exif);
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { throw new Error('這張照片的格式讀不了，iPhone 請在「設定 → 相機 → 格式」選「最相容」再拍'); }
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const small = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))).arrayBuffer());
  const out = exif ? concat([small.slice(0, 2), exif, small.slice(2)]) : small;
  let s = ''; for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
  return btoa(s);
}
function concat(parts) { const n = parts.reduce((a, b) => a + b.length, 0), o = new Uint8Array(n); let i = 0; parts.forEach(p => { o.set(p, i); i += p.length; }); return o; }
// 縮圖時已依方向轉正，EXIF 裡的方向要改成 1，免得看圖軟體再轉一次
function fixOrientation(seg) {
  const t = 10, le = seg[t] === 0x49, r16 = o => le ? seg[t + o] | (seg[t + o + 1] << 8) : (seg[t + o] << 8) | seg[t + o + 1];
  const r32 = o => le ? (seg[t + o] | (seg[t + o + 1] << 8) | (seg[t + o + 2] << 16)) + seg[t + o + 3] * 16777216 : seg[t + o] * 16777216 + ((seg[t + o + 1] << 16) | (seg[t + o + 2] << 8) | seg[t + o + 3]);
  try { const ifd = r32(4), n = r16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (r16(e) === 0x0112) { const v = t + e + 8; if (le) { seg[v] = 1; seg[v + 1] = 0; } else { seg[v] = 0; seg[v + 1] = 1; } } } } catch (e) {}
}

// ---- 對話框 ----
const dlg = $('#pDlg'), box = $('#pBody');
function open(kind) {
  const F = FORMS[kind]; uid = 0;
  $('#pTitle').textContent = F.title;
  box.innerHTML = `<form novalidate>${F.body()}<p class="p-err" role="alert"></p><button class="p-send" type="submit">送出</button></form>`;
  const form = box.querySelector('form'), err = box.querySelector('.p-err'), btn = box.querySelector('.p-send');
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    if (!form.checkValidity()) { const bad = form.querySelector(':invalid'); err.textContent = '還有題目沒填完'; bad?.focus(); bad?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    btn.disabled = true; btn.textContent = kind === 'lantern' ? '照片上傳中…' : '送出中…';
    try {
      const v = n => form.elements[n].value, base = { email: v('email'), website: v('website'), wish: v('wish'), name: v('name'), publish: v('publish') };
      const body = JSON.stringify({ ...base, ...(await F.payload(form)) });
      const r = await (await fetch(F.api, { method: 'POST', body })).json();
      if (!r.ok) throw new Error(r.msg || '送出失敗');
      box.innerHTML = `<div class="p-done">${F.done(r)}<button type="button" class="p-send" id="pClose2">關閉</button></div>`;
      $('#pClose2').onclick = () => dlg.close();
      refreshCounts();
    } catch (x) { err.textContent = x.message || '送出失敗，請稍後再試'; btn.disabled = false; btn.textContent = '送出'; }
  });
  dlg.showModal(); box.scrollTop = 0;
}
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => open(b.dataset.open)));
$('#pClose').onclick = () => dlg.close();
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
if (location.hash === '#participate-omamori' || location.hash === '#participate-ema' || location.hash === '#participate-lantern') open(location.hash.split('-')[1]);

// ---- 繪馬牆（在說明頁內打開）：#ema-wall 或 #ema-wall-0128（自己那片排第一、亮紅框）----
const wDlg = $('#wDlg'), wall = $('#wWall'), wList = $('#wList'), wOne = $('#wOne'), big = $('#wBig');
let wAll = [], wMine = '', wCur = null, wFront = false, wLoaded = false, wFetch = null;
const loadWall = () => wFetch || (wFetch = fetch(EMA_API).then(r => r.json()).then(j => j.items || []));
const perRow = () => wall.clientWidth >= 900 ? 6 : wall.clientWidth >= 520 ? 4 : 3;
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); drawBack(e.target, e.target._d, 0.9, true); } }), { rootMargin: '200px' });
function wRender(list, host = wall, max = Infinity) {
  host.innerHTML = ''; const n = host === wall ? perRow() : (host.clientWidth >= 700 ? 6 : 3);
  list = list.slice(0, max === Infinity ? list.length : Math.max(n, Math.floor(max / n) * n));
  for (let i = 0; i < list.length; i += n) {
    const rack = document.createElement('div'); rack.className = 'w-rack';
    const row = document.createElement('div'); row.className = 'w-row'; row.style.setProperty('--n', n);
    list.slice(i, i + n).forEach(d => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'w-ema' + (d.no === wMine ? ' me' : '');
      b.setAttribute('aria-label', `No.${d.no} ${d.n || ''} ${d.w || ''}`);
      const c = document.createElement('canvas'); c.dataset.base = 'ema/'; c._d = d; b.append(c); io.observe(c);
      b.onclick = () => { if (host !== wall) { openWall(); setTimeout(() => wShow(d), 50); } else wShow(d); }; row.append(b);
    });
    rack.append(row); host.append(rack);
  }
  if (!list.length) host.innerHTML = `<p class="p-hint">${wAll.length ? '找不到符合的繪馬。' : (wLoaded ? '繪馬牆還沒有繪馬，通過考證測驗就能掛上第一片。' : '讀取中…')}</p>`;
}
function wShow(d) { wCur = d; wFront = false; big.dataset.base = 'ema/'; drawBack(big, d, 2); $('#wFlip').textContent = '翻到正面'; wList.hidden = true; wOne.hidden = false; }
$('#wFlip').onclick = () => { wFront = !wFront; (wFront ? drawFront : drawBack)(big, wCur, 2); $('#wFlip').textContent = wFront ? '翻到背面' : '翻到正面'; };
$('#wBack').onclick = () => { wOne.hidden = true; wList.hidden = false; };
$('#wClose').onclick = () => wDlg.close();
wDlg.addEventListener('click', e => { if (e.target === wDlg) wDlg.close(); });
wDlg.addEventListener('close', () => { if (/^#ema-wall/.test(location.hash)) history.replaceState(null, '', location.pathname + '#participate'); });
$('#wQ').oninput = e => { const q = e.target.value.trim(); wRender(q ? wAll.filter(d => (d.no || '').includes(q) || (d.n || '').includes(q)) : wAll); };
async function openWall(no = '') {
  wMine = no; wOne.hidden = true; wList.hidden = false; $('#wQ').value = '';
  wDlg.showModal(); wRender([]);
  try { wAll = (await loadWall()).slice(); } catch (e) { wAll = []; wFetch = null; wall.innerHTML = '<p class="p-hint">繪馬牆暫時讀不到資料，請稍後再試。</p>'; return; }
  wLoaded = true;
  $('#wCount').textContent = wAll.length ? `共 ${wAll.length} 片` : '';
  if (wMine) { const i = wAll.findIndex(d => d.no === wMine); if (i > 0) wAll.unshift(...wAll.splice(i, 1)); }
  wRender(wAll);
}
document.addEventListener('click', e => { const a = e.target.closest('[data-wall]'); if (!a) return; e.preventDefault(); if (dlg.open) dlg.close(); openWall(); });
const fromHash = () => { const m = location.hash.match(/^#ema-wall(?:-(\d+))?$/); if (m) openWall(m[1] || ''); };
addEventListener('hashchange', fromHash); fromHash();

// ---- 即時人數（讀不到或 0 就不顯示）----
const get = async (u, f) => { try { const r = await fetch(u); return f(await r.json()); } catch (e) { return null; } };
function refreshCounts() {
  get(OMAMORI_API, j => j.count).then(n => { if (n) $('#cOmamori').textContent = `已有 ${n} 人領取御守`; });
  get(EMA_API, j => (j.items || []).length).then(n => { if (n) $('#cEma').textContent = `繪馬牆上已有 ${n} 片繪馬`; });
  get(LANTERN_API + '?type=lantern', j => (j.items || []).length).then(n => { if (n) $('#cLan').textContent = `外參道已點亮 ${n} 盞燈籠`; });
}
refreshCounts();

// 說明頁上直接展示最新幾片繪馬（點一片會打開繪馬牆並放大）
const prev = $('#wPrevWall');
loadWall().then(items => { wLoaded = true; wAll = items.slice(); wRender(items, prev, 6); })
  .catch(() => { wFetch = null; prev.innerHTML = '<p class="p-hint">繪馬牆暫時讀不到資料，請稍後再試。</p>'; });

// 從導覽第六站跳過來（#participate）時，圖片載入後版面會變高，等載完再對齊一次
if (location.hash === '#participate') {
  const align = () => $('#participate').scrollIntoView({ block: 'start' });
  addEventListener('load', () => { align(); setTimeout(align, 400); });
}
