/* 受試者模式 study.js  v2.0（視覺邊界四方案：不透明 O、永遠霧面 F、上鎖變霧 A、永遠透明 D）
 * 啟用：網址加 ?study=1（或頁面先設 window.STUDY_AUTO = true）。?sandbox=1 強制自由觀看。
 * 其他參數：&g=1..4 研究者指定順序組（否則隨機）；&cfg=其他設定.json；&reset=1 清除本機未完成進度；&fov=60 臨時改水平視角。
 * 流程：參與說明 → 練習與門鎖說明 → 受試者自選廁間（通用／女廁／男廁）
 *       → 四方案（Williams 順序；白天；廁所外有固定腳本的路人，只路過、不看廁所）
 *          每方案：外部觀察 → O1–O4（預期）、O5（此刻）→ 進入、關門、上鎖、固定等待 → 坐下觀察（不作答）
 *                  → 在解鎖前淡出到中性畫面 → R1–R7（回想剛才坐在裡面的那段時間）→（前測 T1、T2）→ M1、M2
 *       → 事後題 P1–P4、門鎖信任 L1–L2 →（前測 T3、T4）→ 背景題（熟悉度、電影放最後，避免先破梗）→ 保存 → 片尾與研究說明
 * 依賴主程式 window.__tt：setSkin setExpHaze setHazeNow startWalkers clearWalkers walkerInfo setSignNeutral setExpMode setNight
 *                       setSimOcc setMode setPinned setNoClip setHfov setVfovCap setEye setDayMix booths look camera ACTS version
 * 資料：participant（一人一筆）、ratings（一題一筆）、marks（一輪一筆）、events（一事件一筆）、pretestChecks（前測加問，不計入 48）
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.has('sandbox')) return;
  if (!params.has('study') && !window.STUDY_AUTO) return;

  const T = window.__tt;
  const cfgUrl = params.get('cfg') || 'study.json';
  const STUDY_JS_VERSION = '2.0.0';
  let boothIdx = 0, boothKey = null;   // 受試者自選的廁間（booths[0] ① 通用、[1] ② 女廁、[2] ③④ 男廁）

  /* ---------- 樣式 ---------- */
  const style = document.createElement('style');
  style.textContent = `
  body.study #bar, body.study #info, body.study #hint, body.study #act,
  body.study #joy, body.study #exitvr, body.study .ret { display:none!important }
  #sx-top{position:fixed;left:0;right:0;top:0;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 0 max(10px,env(safe-area-inset-left,0px));display:flex;justify-content:flex-start;pointer-events:none;z-index:20}
  #sx-top span{background:var(--glass,#f4f9fadd);border:1px solid var(--glass-line,#0002);border-radius:999px;padding:4px 12px;font:500 12px/1.4 var(--font-data,monospace);color:var(--ink,#16222a)}
  #sx-cover{position:fixed;inset:0;background:#cfe0e8;z-index:25;display:grid;place-items:center;font:500 15px var(--font-ui,sans-serif);color:var(--ink,#16222a);text-align:center;padding:24px}
  #sx{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;justify-content:center;padding:0 max(10px,env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px));pointer-events:none}
  #sx .card{pointer-events:auto;width:min(560px,100%);background:var(--glass,#f4f9faee);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    border:1px solid var(--glass-line,#0002);border-radius:16px;font-family:var(--font-ui,sans-serif);color:var(--ink,#16222a);box-sizing:border-box;display:flex;flex-direction:column;max-height:68vh}
  #sx .card.full{max-height:calc(100vh - 40px)}
  #sx .hd{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px;border-bottom:1px solid var(--glass-line,#0002)}
  #sx .card.min .hd{border-bottom:0}
  #sx .hd b{flex:1;font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #sx .tog{font:500 12px var(--font-ui,sans-serif);border:0;border-radius:8px;padding:6px 10px;min-height:32px;background:var(--chip,#e3ecee);color:var(--ink,#16222a);cursor:pointer;flex:none}
  #sx .bd{overflow:auto;padding:10px 14px 12px}
  #sx .card.min .bd{display:none}
  #sx h2{margin:0 0 8px;font-size:17px;text-wrap:balance}
  #sx p{margin:0 0 8px;font-size:14px;line-height:1.65}
  #sx p.lead{font-size:13px;color:var(--ink-soft,#4b5b64);background:var(--chip,#e3ecee);border-radius:10px;padding:8px 10px}
  #sx .q{margin:14px 0 6px;font-size:14.5px;font-weight:700;line-height:1.5}
  #sx .q small{font-weight:400;color:var(--ink-soft,#4b5b64)}
  #sx .opts{display:grid;gap:6px}
  #sx label.opt{display:flex;gap:10px;align-items:center;padding:9px 11px;border-radius:10px;background:var(--chip,#e3ecee);font-size:14px;cursor:pointer;min-height:24px}
  #sx label.opt input{width:18px;height:18px;margin:0;accent-color:var(--accent,#0f8f86);flex:none}
  #sx label.opt:has(input:checked){background:#16222a;color:#fff}
  #sx .scale{display:grid;gap:4px}
  #sx .scale label{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px 6px;border-radius:9px;background:var(--chip,#e3ecee);cursor:pointer;text-align:center;min-width:0}
  #sx .scale label input{position:absolute;opacity:0;pointer-events:none}
  #sx .scale label b{font:600 15px var(--font-data,monospace)}
  #sx .scale label span{font-size:10.5px;line-height:1.25;word-break:keep-all;overflow-wrap:anywhere}
  #sx .scale label:has(input:checked){background:#16222a;color:#fff}
  #sx .scale label:has(input:focus-visible){outline:2px solid var(--accent,#0f8f86);outline-offset:1px}
  #sx label.na{display:inline-flex;gap:6px;align-items:center;margin-top:6px;font-size:12px;color:var(--ink-soft,#4b5b64);padding:5px 9px;border-radius:999px;background:transparent;border:1px solid var(--glass-line,#0002);cursor:pointer}
  #sx label.na input{margin:0;accent-color:var(--accent,#0f8f86)}
  #sx label.na:has(input:checked){background:#16222a;color:#fff;border-color:#16222a}
  #sx textarea,#sx input[type=text]{width:100%;box-sizing:border-box;font:14px/1.5 var(--font-ui,sans-serif);padding:8px 10px;border-radius:10px;border:1px solid var(--glass-line,#0003);background:#fff;color:#16222a}
  #sx .row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap}
  #sx button.go{font:600 15px var(--font-ui,sans-serif);border:0;border-radius:10px;padding:11px 18px;min-height:44px;background:var(--chip-on,#16222a);color:#fff;cursor:pointer}
  #sx button.go.ghost{background:var(--chip,#e3ecee);color:var(--ink,#16222a)}
  #sx button.go:disabled{opacity:.4;cursor:default}
  #sx button:focus-visible{outline:2px solid var(--accent,#0f8f86);outline-offset:2px}
  #sx .err{color:#b3261e;font-size:13px;min-height:1em}
  #sx .meta{font:11px var(--font-data,monospace);color:var(--ink-soft,#4b5b64)}
  #sx ul{margin:0 0 8px;padding-left:20px;font-size:13px;line-height:1.6}
  #sx .map{margin:8px 0 2px;border-radius:12px;background:#fff;border:1px solid var(--glass-line,#0002);touch-action:none}
  #sx .map svg{display:block;width:100%;height:auto}
  #sx .mapread{font-size:13px;font-weight:600;min-height:1.4em}
  #sx .sub{margin:4px 0 0 28px}
  `;
  document.head.appendChild(style);

  const root = mk('div', { id: 'sx' });
  const top = mk('div', { id: 'sx-top' });
  const cover = mk('div', { id: 'sx-cover' }, '載入中…');
  document.body.append(root, top, cover);
  document.body.classList.add('study');

  if (!T || !T.setSkin || !T.startWalkers) { fatal(['找不到 3D 主程式（window.__tt）或版本太舊（需要 setSkin、startWalkers）。請確認 index.html 與 study.js 是同一套檔案。']); return; }

  /* ---------- 小工具 ---------- */
  function mk(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(k => k != null && e.append(k));
    return e;
  }
  const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m);
  function rid(n) { const a = new Uint8Array(n || 6); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }
  const deg = r => r * 180 / Math.PI;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const now = () => new Date().toISOString();
  const r2 = v => Math.round(v * 100) / 100;

  /* ---------- 可收合的卡片 ---------- */
  let collapsed = false, collapseCount = 0;
  function card({ title, full, expand }, ...kids) {
    if (expand) collapsed = false;
    const c = mk('div', { class: 'card' + (full ? ' full' : '') + (collapsed ? ' min' : '') });
    const tog = mk('button', { class: 'tog', type: 'button', 'aria-expanded': String(!collapsed) }, collapsed ? '▲ 展開' : '▼ 收起');
    tog.addEventListener('click', () => {
      collapsed = !collapsed; collapseCount++;
      c.classList.toggle('min', collapsed);
      tog.textContent = collapsed ? '▲ 展開' : '▼ 收起';
      tog.setAttribute('aria-expanded', String(!collapsed));
    });
    const bd = mk('div', { class: 'bd' }, ...kids);
    c.append(mk('div', { class: 'hd' }, mk('b', {}, title || ''), tog), bd);
    root.replaceChildren(c);
    bd.scrollTop = 0;
    return bd;
  }
  function fatal(lines) { cover.hidden = true; card({ title: '設定檔有問題', full: true, expand: true }, mk('ul', {}, lines.map(l => mk('li', {}, l))), mk('p', { class: 'meta' }, '設定檔：' + cfgUrl)); }
  const waitClick = btn => new Promise(go => btn.addEventListener('click', () => { btn.disabled = true; go(); }, { once: true }));

  /* ---------- 現場式廁所圖示（與模型標示一致） ---------- */
  function icon(kind) {
    const sh = {
      m: '<circle cx="24" cy="10" r="4.5"/><rect x="18" y="16" width="12" height="15" rx="1.5"/><rect x="14" y="17" width="3.2" height="12" rx="1.5"/><rect x="30.8" y="17" width="3.2" height="12" rx="1.5"/><rect x="18.5" y="30" width="4.5" height="14" rx="1.5"/><rect x="25" y="30" width="4.5" height="14" rx="1.5"/>',
      f: '<circle cx="24" cy="10" r="4.5"/><path d="M20 16h8l6 17H14z"/><rect x="13.5" y="17" width="3.2" height="11" rx="1.5"/><rect x="31.3" y="17" width="3.2" height="11" rx="1.5"/><rect x="20" y="32" width="3.2" height="12" rx="1.5"/><rect x="24.8" y="32" width="3.2" height="12" rx="1.5"/>',
      a: '<circle cx="19" cy="8" r="4"/><path d="M19 14l1 13h10l3.5 11" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 19h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M28 30a10 10 0 1 1-15-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
    }[kind] || '';
    const span = document.createElement('span');
    span.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width:34px;height:34px;flex:none;border-radius:7px"><rect width="48" height="48" rx="8" fill="#24313a"/><g fill="#fff">${sh}</g></svg>`;
    return span.firstChild;
  }

  /* ---------- 設定檔檢查 ---------- */
  const SKINS = ['glass', 'opaque', 'wood', 'concrete'];
  const CODES = ['O', 'F', 'A', 'D'];
  const num3 = a => Array.isArray(a) && a.length === 3 && a.every(x => typeof x === 'number' && isFinite(x));
  const isPose = p => !!p && num3(p.pos) && num3(p.look);
  const POSES = ['start', 'door', 'inside', 'closeView', 'seat'];
  const MARK_TYPES = ['location', 'threshold', 'close', 'lock', 'haze', 'other_event', 'start_already', 'none', 'unclear', 'no_answer'];
  const isPath = p => Array.isArray(p) && p.length >= 2 && p.every(q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite));

  function validate(c) {
    const e = [];
    if (!c || typeof c !== 'object') return ['不是有效的 JSON 物件'];
    ['id', 'protocolVersion', 'configVersion'].forEach(k => { if (!c[k]) e.push('缺少 ' + k); });
    if (c.endpoint && !/^https:\/\//.test(c.endpoint)) e.push('endpoint 必須是 https 網址（或留空）');
    const S = c.scenarios || {};
    CODES.forEach(k => { const s = S[k]; if (!s) e.push(`scenarios.${k} 缺少`); else {
      if (!SKINS.includes(s.skin)) e.push(`scenarios.${k}.skin 只能是 ${SKINS.join('、')}`);
      [s.hazeBefore, s.hazeAfterLock].forEach(v => { if (!(v === 0 || v === 1)) e.push(`scenarios.${k} 的 hazeBefore、hazeAfterLock 必須是 0 或 1`); }); } });
    const O = c.orders || {};
    if (!Object.keys(O).length) e.push('orders 至少要有一組');
    Object.entries(O).forEach(([g, s]) => { if (s.length !== 4 || new Set(s).size !== 4 || [...s].some(x => !CODES.includes(x))) e.push(`orders.${g} 必須是 ${CODES.join('、')} 各一次的四個字母`); });
    const B = c.booths || {};
    if (!Array.isArray(c.boothChoice) || !c.boothChoice.length) e.push('boothChoice 至少要有一間廁所');
    else c.boothChoice.forEach((o, i) => {
      const bk = B[o.booth];
      if (!bk) { e.push(`boothChoice[${i}].booth 找不到 booths["${o.booth}"]`); return; }
      if (!(Number.isInteger(bk.index) && bk.index >= 0 && bk.index < T.booths.length)) e.push(`booths.${o.booth}.index 必須是 0–${T.booths.length - 1}`);
      POSES.forEach(n => { if (!isPose((bk.poses || {})[n])) e.push(`booths.${o.booth}.poses.${n} 缺少或格式錯誤（pos 與 look 各需 3 個數字）`); });
      ((bk.passersby || {}).inside || []).forEach((w, j) => { if (!isPath(w.path) || !(w.speed > 0)) e.push(`booths.${o.booth}.passersby.inside[${j}] 需要 path（至少 2 點）與 speed`); });
    });
    ((c.passersby || {}).outside || []).forEach((w, j) => { if (!isPath(w.path) || !(w.speed > 0)) e.push(`passersby.outside[${j}] 需要 path（至少 2 點）與 speed`); });
    const sc = c.scales || {};
    const checkQ = (q, where) => {
      if (!q.id) e.push(`${where} 缺少 id`);
      if (q.type === 'scale') { const s = sc[q.scale]; if (!s || !Array.isArray(s.labels) || s.labels.length !== s.max - s.min + 1) e.push(`${where}（${q.id}）的 scale「${q.scale}」不存在或標籤數不符`); }
      else if (q.type === 'single' || q.type === 'multi') { if (!Array.isArray(q.options) || q.options.length < 2) e.push(`${where}（${q.id}）至少要 2 個選項`); }
      else if (q.type !== 'text') e.push(`${where}（${q.id}）type 只能是 scale、single、multi、text`);
    };
    ['outsideExpect', 'outsideNow', 'recall', 'post', 'background'].forEach(k => {
      if (!Array.isArray(c[k])) { e.push(k + ' 必須是陣列'); return; }
      c[k].forEach((q, i) => checkQ(q, `${k}[${i}]`));
    });
    ['pretestScene', 'pretestEnd'].forEach(k => (c[k] || []).forEach((q, i) => checkQ(q, `${k}[${i}]`)));
    const n = (c.outsideExpect || []).length + (c.outsideNow || []).length + (c.recall || []).length;
    if (n !== (c.expectedRatingsPerTrial || 12)) e.push(`每方案核心評分應為 ${c.expectedRatingsPerTrial || 12} 題，目前 ${n} 題；若刻意增刪，請同步更新研究設計文件與 expectedRatingsPerTrial`);
    const M = c.mark || {};
    if (!Array.isArray(M.options) || !M.options.length) e.push('mark.options 必須是非空陣列');
    else M.options.forEach((o, i) => { if (!MARK_TYPES.includes(o.value)) e.push(`mark.options[${i}].value 只能是 ${MARK_TYPES.join('、')}`); });
    if (!(c.lockWaitMs > 0)) e.push('lockWaitMs 必須是正數（毫秒）');
    if (!(c.insideViewSeconds > 0)) e.push('insideViewSeconds 必須是正數（秒）');
    return e;
  }

  /* ---------- 問卷元件 ---------- */
  // 每題回傳 {value, status}：status = answered | na | skipped（選填未答）| missing（必答未答）
  function questionEl(q, name) {
    const box = mk('div', { 'data-q': q.id });
    box.append(mk('div', { class: 'q' }, q.text, q.optional ? mk('small', {}, '（選填）') : null));
    if (q.type === 'scale') {
      const s = cfg.scales[q.scale], n = s.max - s.min + 1;
      const row = mk('div', { class: 'scale', role: 'radiogroup', style: `grid-template-columns:repeat(${n},minmax(0,1fr))` });
      for (let v = s.min; v <= s.max; v++) {
        const inp = mk('input', { type: 'radio', name, value: String(v), 'aria-label': `${v} ${s.labels[v - s.min]}` });
        row.append(mk('label', {}, inp, mk('b', {}, String(v)), mk('span', {}, s.labels[v - s.min])));
      }
      box.append(row);
    } else if (q.type === 'single' || q.type === 'multi') {
      const opts = mk('div', { class: 'opts', role: q.type === 'single' ? 'radiogroup' : 'group' });
      q.options.forEach((o, j) => {
        const inp = mk('input', { type: q.type === 'single' ? 'radio' : 'checkbox', name, value: String(o.value), id: `${name}_${j}` });
        if (q.type === 'multi' && q.exclusive) inp.addEventListener('change', () => {
          const all = opts.querySelectorAll('input');
          if (inp.checked && String(o.value) === q.exclusive) all.forEach(x => { if (x !== inp) x.checked = false; });
          else if (inp.checked) all.forEach(x => { if (x.value === q.exclusive) x.checked = false; });
        });
        opts.append(mk('label', { class: 'opt', for: `${name}_${j}` }, inp, mk('span', {}, o.label)));
      });
      box.append(opts);
    } else {
      box.append(q.long ? mk('textarea', { name, rows: 3, maxlength: 600 }) : mk('input', { type: 'text', name, maxlength: 300 }));
    }
    if (q.na) {
      const na = mk('input', { type: 'checkbox', name: name + '__na' });
      na.addEventListener('change', () => { if (na.checked) box.querySelectorAll(`input[name="${name}"]`).forEach(x => { x.checked = false; }); });
      box.querySelectorAll(`input[name="${name}"]`).forEach(x => x.addEventListener('change', () => { if (x.checked) na.checked = false; }));
      box.append(mk('label', { class: 'na' }, na, cfg.naLabel || '無法判斷／不願回答'));
    }
    return box;
  }
  function readQ(q, name, scope) {
    const S = scope || root;
    const na = S.querySelector(`input[name="${name}__na"]`);
    if (na && na.checked) return { value: null, status: 'na' };
    let v = null;
    if (q.type === 'text') { const el = S.querySelector(`[name="${name}"]`); v = el && el.value.trim() ? el.value.trim() : null; }
    else if (q.type === 'multi') { const vs = Array.from(S.querySelectorAll(`input[name="${name}"]:checked`)).map(x => x.value); v = vs.length ? vs.join('|') : null; }
    else {
      const el = S.querySelector(`input[name="${name}"]:checked`);
      if (el) { v = el.value; if (q.type === 'scale') v = Number(v); else { const o = q.options.find(o => String(o.value) === v); if (o) v = o.value; } }
    }
    if (v != null) return { value: v, status: 'answered' };
    return { value: null, status: q.optional ? 'skipped' : 'missing' };
  }
  const shown = (q, ans) => {
    if (!q.showIf) return true;
    const a = ans[q.showIf.q]; const v = a ? String(a.value) : '';
    if (q.showIf.in) return q.showIf.in.map(String).some(x => v.split('|').includes(x));
    if (q.showIf.notIn) return a && a.value != null && !q.showIf.notIn.map(String).includes(v);
    return true;
  };
  /* 一張題目卡：回傳 {id:{value,status}}；showIf 依同卡前題即時顯示 */
  function askCard({ title, lead, questions, prefix, full, button }) {
    return new Promise(resolve => {
      const err = mk('div', { class: 'err' });
      const els = questions.map((q, i) => questionEl(q, `${prefix}_${i}`));
      const refresh = () => {
        const ans = {};
        questions.forEach((q, i) => { const vis = shown(q, ans); els[i].hidden = !vis; ans[q.id] = vis ? readQ(q, `${prefix}_${i}`, els[i]) : { value: null, status: 'not_shown' }; });
        return ans;
      };
      els.forEach(el => el.addEventListener('change', refresh));
      const t0 = performance.now();
      const go = mk('button', { class: 'go', type: 'button' }, button || '繼續');
      go.addEventListener('click', () => {
        const ans = refresh();
        const miss = questions.filter(q => ans[q.id].status === 'missing').length;
        if (miss) { err.textContent = `還有 ${miss} 題沒有作答（如果無法判斷，可勾選「${cfg.naLabel || '無法判斷／不願回答'}」）`; return; }
        go.disabled = true;
        resolve({ ans, answerMs: Math.round(performance.now() - t0) });
      });
      const bd = card({ title, full: full !== false, expand: true }, lead ? mk('p', { class: 'lead' }, lead) : null, els, err, mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), go));
      refresh();
      bd.scrollTop = 0;
    });
  }

  /* ---------- 視角追蹤（前景時間只在頁面可見時累計） ---------- */
  let track = null, tickLast = performance.now();
  const _pm = new THREE.Matrix4(), _fr = new THREE.Frustum(), _pv = new THREE.Vector3();
  (function tick() {
    const t = performance.now(), dt = t - tickLast; tickLast = t;
    if (track) {
      if (document.visibilityState === 'visible') track.fgMs += dt;
      if (gyro.on) track.gyroMs += dt;
      const y = deg(T.look.yaw), p = deg(T.look.pitch);
      if (track.py != null) track.path += Math.abs(y - track.py);
      track.py = y;
      track.yMin = Math.min(track.yMin, y); track.yMax = Math.max(track.yMax, y);
      track.pMin = Math.min(track.pMin, p); track.pMax = Math.max(track.pMax, p);
      // 路人是否落在畫面視野內（只記幾何上的「在視野內」；被牆或霧面玻璃遮住時仍算，遮蔽由方案決定）
      const W = T.walkerInfo ? T.walkerInfo() : [];
      if (W.length) {
        T.camera.updateMatrixWorld(); _pm.multiplyMatrices(T.camera.projectionMatrix, T.camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
        W.forEach((w, i) => { if (w.state !== 'walking') return; _pv.set(w.x, 1.2, w.z); if (_fr.containsPoint(_pv)) track.pedMs[i] = (track.pedMs[i] || 0) + dt; });
      }
    }
    requestAnimationFrame(tick);
  })();
  const newTrack = () => ({ t0: performance.now(), fgMs: 0, gyroMs: 0, py: null, path: 0, yMin: Infinity, yMax: -Infinity, pMin: Infinity, pMax: -Infinity, pedMs: {} });
  const trackSummary = tr => tr ? ({
    elapsedMs: Math.round(performance.now() - tr.t0), foregroundMs: Math.round(tr.fgMs),
    yawRangeDeg: isFinite(tr.yMax) ? r2(tr.yMax - tr.yMin) : 0, pitchRangeDeg: isFinite(tr.pMax) ? r2(tr.pMax - tr.pMin) : 0,
    yawPathDeg: r2(tr.path), gyroViewSec: r2(tr.gyroMs / 1000), collapseCount,
    passersbyInViewMs: (T.walkerInfo ? T.walkerInfo() : []).map((w, i) => ({ kind: w.kind, ms: Math.round(tr.pedMs[i] || 0) }))
  }) : null;

  /* ---------- 鏡頭移動 ---------- */
  const lookAngles = p => {
    const dx = p.look[0] - p.pos[0], dy = p.look[1] - p.pos[1], dz = p.look[2] - p.pos[2];
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  };
  function setPose(p) {
    const a = lookAngles(p);
    T.camera.position.x = p.pos[0]; T.camera.position.z = p.pos[2]; T.setEye(p.pos[1]);
    T.look.yaw = a.yaw; T.look.pitch = a.pitch;
  }
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  let moving = 0;
  function anim(ms, fn) {
    moving++;
    return new Promise(res => {
      const dur = reduceMotion() ? 1 : Math.max(1, ms), t0 = performance.now();
      (function step() { const t = Math.min(1, (performance.now() - t0) / dur); fn(ease(t)); if (t < 1) requestAnimationFrame(step); else { moving--; res(); } })();
    });
  }
  function turnTo(yaw, pitch) {
    const y0 = T.look.yaw, p0 = T.look.pitch, dy = wrap(yaw - y0);
    const ms = Math.min(1300, Math.max(300, Math.abs(dy) / (Math.PI / 2) * 800 + Math.abs(pitch - p0) * 400));
    return anim(ms, e => { T.look.yaw = y0 + dy * e; T.look.pitch = p0 + (pitch - p0) * e; });
  }
  async function tweenPose(p) {
    const c = T.camera.position, a = lookAngles(p);
    const dx = p.pos[0] - c.x, dz = p.pos[2] - c.z, dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      await turnTo(Math.atan2(-dx, -dz), -0.08);
      const f = { x: c.x, z: c.z, y: c.y };
      const ms = Math.min(3200, Math.max(700, dist / 0.8 * 1000));
      await anim(ms, e => { c.x = f.x + dx * e; c.z = f.z + dz * e; T.setEye(f.y + (p.pos[1] - f.y) * e); });
    } else if (Math.abs(p.pos[1] - c.y) > 0.02) {
      const y0 = c.y; await anim(900, e => { T.setEye(y0 + (p.pos[1] - y0) * e); });
    }
    await turnTo(a.yaw, a.pitch);
  }
  const fader = mk('div', { id: 'sx-fade', style: 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:24;transition:opacity .35s ease' });
  document.body.append(fader);
  async function fadeOut() { fader.style.opacity = '1'; if (!reduceMotion()) await sleep(380); }
  async function fadeIn() { await sleep(120); fader.style.opacity = '0'; if (!reduceMotion()) await sleep(380); }
  async function cutTo(p, before) { await fadeOut(); if (before) before(); setPose(p); await fadeIn(); }

  /* ---------- 聲音（上鎖、解鎖的機械聲；只作補充線索） ---------- */
  let audio = null;
  function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; } }
  function sound(kind) {
    if (!audio) return;
    try {
      const t0 = audio.currentTime;
      const click = (at, freq, gain) => {
        const n = Math.floor(audio.sampleRate * 0.05), buf = audio.createBuffer(1, n, audio.sampleRate), ch = buf.getChannelData(0);
        for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.12));
        const src = audio.createBufferSource(); src.buffer = buf;
        const f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
        const g = audio.createGain(); g.gain.value = gain;
        src.connect(f).connect(g).connect(audio.destination); src.start(at);
      };
      if (kind === 'lock') { click(t0, 2400, 0.9); click(t0 + 0.07, 1500, 0.7); }
      else if (kind === 'unlock') { click(t0, 1500, 0.7); click(t0 + 0.06, 2400, 0.6); }
    } catch (e) { /* 沒有聲音也能繼續 */ }
  }
  /* 門與鎖：等動畫完成；超時（極慢裝置）時直接設定到目標狀態並記錄，確保四方案的鎖定狀態一致 */
  async function doorTo(b, open, ctx) {
    if (open) T.ACTS.open(boothIdx); else T.ACTS.close(boothIdx);
    await until(() => open ? b.st.open > 0.97 : b.st.open < 0.02, 8000);
    const done = open ? b.st.open > 0.97 : b.st.open < 0.02;
    if (!done) { b.st.open = b.st.target = open ? 1 : 0; logEvent('door_forced', { open }, ctx); }
  }
  function until(cond, max) {
    return new Promise(res => { const t0 = performance.now(); (function chk() { if (cond() || performance.now() - t0 > max) res(); else requestAnimationFrame(chk); })(); });
  }

  /* ---------- 視角：直拿為主，固定水平視角 ---------- */
  function viewCfg() {
    const v = cfg.view || {}, q = parseFloat(params.get('fov'));
    return { hfov: (q >= 40 && q <= 110) ? q : (v.hfov || 65), maxV: v.maxVfov || 125 };
  }
  function applyView() { const v = viewCfg(); T.setVfovCap(v.maxV); T.setHfov(v.hfov); }
  function viewInfo() {
    const c = T.camera, a = c.aspect || 1;
    const h = 2 * Math.atan(Math.tan(c.fov * Math.PI / 360) * a) * 180 / Math.PI;
    return { hfovSet: viewCfg().hfov, hfovActual: r2(h), vfov: r2(c.fov), orientation: a < 1 ? 'portrait' : 'landscape' };
  }

  /* ---------- 可選：轉動手機來看（陀螺儀）—— 沿用 v0.8 ---------- */
  const gyro = { on: false, ev: null, evAt: 0, offY: 0, offP: 0, lastY: null, lastP: null, used: false, status: 'unused' };
  const ua = navigator.userAgent || '';
  const inApp = /Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|; wv\)/i.test(ua);
  const gyroSupported = typeof window.DeviceOrientationEvent !== 'undefined' && window.isSecureContext !== false && !inApp;
  if (!gyroSupported) gyro.status = 'unsupported';
  const gyroCss = document.createElement('style');
  gyroCss.textContent = `
  #sx-gyro{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));z-index:22;display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:min(260px,70vw)}
  #sx-gyro button{font:500 12px var(--font-ui,sans-serif);border:1px solid var(--glass-line,#0002);border-radius:999px;padding:7px 12px;min-height:34px;background:var(--glass,#f4f9fadd);color:var(--ink,#16222a);cursor:pointer}
  #sx-gyro button.off{opacity:.7}
  #sx-gyro .tip{font:12px/1.55 var(--font-ui,sans-serif);color:var(--ink,#16222a);background:var(--glass,#f4f9faee);border:1px solid var(--glass-line,#0002);border-radius:10px;padding:8px 10px}`;
  document.head.appendChild(gyroCss);
  const gyroBtn = mk('button', { type: 'button', 'aria-pressed': 'false' }, '轉動手機來看：關');
  const gyroTip = mk('div', { class: 'tip', hidden: true, id: 'sx-gyro-tip' });
  const gyroBox = mk('div', { id: 'sx-gyro', hidden: true }, gyroBtn, gyroTip);
  document.body.append(gyroBox);
  const GYRO_MSG = {
    denied: '你沒有允許取用動作感測器。要使用的話，請到 iPhone「設定 → Safari → 進階 → 網站資料」刪除本網站後重新整理。不使用也能正常作答，用手指拖曳即可。',
    nodata: '這個瀏覽器收不到手機的動作感測資料，可能是在其他 App 裡開啟的頁面。改用 Safari 或 Chrome 直接開啟網址就能使用。不使用也能正常作答，用手指拖曳即可。'
  };
  function gyroFail(kind) {
    gyro.status = kind; gyroSet(false);
    gyroBtn.textContent = '轉動手機：無法使用 ⓘ'; gyroBtn.classList.add('off');
    gyroBtn.setAttribute('aria-expanded', 'false'); gyroBtn.setAttribute('aria-controls', 'sx-gyro-tip');
    gyroTip.textContent = GYRO_MSG[kind] || GYRO_MSG.nodata; gyroTip.hidden = true;
  }
  function gyroShow(v) {
    gyroBox.hidden = !(v && gyroSupported && (!cfg.view || cfg.view.gyro !== false));
    if (!v) { gyroTip.hidden = true; gyroBtn.setAttribute('aria-expanded', 'false'); }
  }
  function gyroSet(v) {
    gyro.on = v; gyro.lastY = gyro.lastP = null;
    if (v) gyro.used = true;
    gyroBtn.textContent = '轉動手機來看：' + (v ? '開' : '關');
    gyroBtn.setAttribute('aria-pressed', String(v));
  }
  window.addEventListener('deviceorientation', e => { if (e.alpha != null) { gyro.ev = e; gyro.evAt = performance.now(); } }, { passive: true });
  function gyroStart() {
    const t0 = performance.now(); gyroSet(true);
    setTimeout(() => { if (!gyro.on) return; if (gyro.evAt > t0 - 200 && gyro.ev) gyro.status = 'ok'; else gyroFail('nodata'); }, 1500);
  }
  gyroBtn.addEventListener('click', () => {
    if (gyro.status === 'denied' || gyro.status === 'nodata') { gyroTip.hidden = !gyroTip.hidden; gyroBtn.setAttribute('aria-expanded', String(!gyroTip.hidden)); return; }
    if (gyro.on) { gyroSet(false); return; }
    try {
      if (DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') gyroStart(); else gyroFail('denied'); }).catch(() => gyroFail('nodata'));
      else gyroStart();
    } catch (e) { gyroFail('nodata'); }
  });
  const gq = new THREE.Quaternion(), gq1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), gq0 = new THREE.Quaternion(), gz = new THREE.Vector3(0, 0, 1), gE = new THREE.Euler(), gE2 = new THREE.Euler();
  function devAngles(e) {
    const d = Math.PI / 180, o = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * d;
    gE.set(e.beta * d, e.alpha * d, -e.gamma * d, 'YXZ');
    gq.setFromEuler(gE).multiply(gq1).multiply(gq0.setFromAxisAngle(gz, -o));
    gE2.setFromQuaternion(gq, 'YXZ');
    return { y: gE2.y, p: gE2.x };
  }
  (function gyroLoop() {
    if (gyro.on && gyro.ev && !moving) {
      const d = devAngles(gyro.ev);
      if (gyro.lastY == null || Math.abs(wrap(T.look.yaw - gyro.lastY)) > 1e-4 || Math.abs(T.look.pitch - gyro.lastP) > 1e-4) { gyro.offY = wrap(T.look.yaw - d.y); gyro.offP = T.look.pitch - d.p; }
      T.look.yaw = wrap(d.y + gyro.offY);
      T.look.pitch = Math.max(-1.3, Math.min(1.3, d.p + gyro.offP));
      gyro.lastY = T.look.yaw; gyro.lastP = T.look.pitch;
    } else if (gyro.on) { gyro.lastY = null; }
    requestAnimationFrame(gyroLoop);
  })();

  /* ================= 資料、進度保存 ================= */
  let cfg, S;           // S = 本次參與的完整狀態（存入 localStorage，可續跑）
  const sessionId = rid(4);
  const storeKey = () => 'tt-study-' + cfg.id;
  function persist() { try { localStorage.setItem(storeKey(), JSON.stringify(S)); } catch (e) { /* 無法存就略過 */ } }
  function loadSaved() { try { const s = JSON.parse(localStorage.getItem(storeKey()) || 'null'); return s && s.participant && s.participant.studyId === cfg.id ? s : null; } catch (e) { return null; } }

  function logEvent(type, detail, ctx) {
    const c = ctx || {};
    S.eventSeq = (S.eventSeq || 0) + 1;
    S.events.push({
      eventId: `${S.participant.pid}-${sessionId}-${S.eventSeq}`, studyId: cfg.id, pid: S.participant.pid,
      trialId: c.trialId || null, phase: c.phase || null, scenario: c.scenario || null, period: c.period || null,
      sessionId, attemptNo: c.attemptNo || null, eventSeq: S.eventSeq, at: now(), type, detail: detail || {}
    });
  }
  /* 實際呈現快照：預定 vs 實際材質、門、鎖、霧度、相機、視角、照明 */
  function snapshot(kind, ctx, extra) {
    const b = T.booths[boothIdx], c = T.camera, dir = new THREE.Vector3(); c.getWorldDirection(dir);
    const pid = `${ctx.trialId}-${kind}`;
    logEvent('presentation', Object.assign({
      presentationId: pid, kind, boothId: boothKey,
      plannedSkin: ctx.spec.skin, actualSkin: b.skin, plannedHazeBefore: ctx.spec.hazeBefore, plannedHazeAfterLock: ctx.spec.hazeAfterLock,
      passersby: T.walkerInfo ? T.walkerInfo().map(w => ({ kind: w.kind, state: w.state, x: r2(w.x), z: r2(w.z) })) : [],
      doorOpen: r2(b.st.open), locked: !!b.st.locked, haze: r2(b.haze), expMode: T.getExpMode(), night: T.getNight(),
      cameraPos: [r2(c.position.x), r2(c.position.y), r2(c.position.z)], cameraDir: [r2(dir.x), r2(dir.y), r2(dir.z)], eyeHeight: r2(c.position.y),
      interiorLight: r2(b.light.intensity), signNeutral: T.getSignNeutral(),
      glassRenderPath: 'webgl-shader', modelVersion: T.version,
      screenW: screen.width, screenH: screen.height, dpr: window.devicePixelRatio || 1
    }, viewInfo(), extra || {}), ctx);
    return pid;
  }
  function ratingKey(r) { return [r.trialId, r.checkpoint, r.questionId].join('|'); }
  function putRating(row) {
    const k = ratingKey(row), i = S.ratings.findIndex(r => ratingKey(r) === k);
    if (i >= 0) { row.revision = (S.ratings[i].revision || 1) + 1; S.ratings[i] = row; } else { row.revision = 1; S.ratings.push(row); }
  }
  function storeRatings(ctx, checkpoint, questions, res, presentationId) {
    questions.forEach(q => {
      const a = res.ans[q.id], s = q.type === 'scale' ? cfg.scales[q.scale] : null;
      putRating({
        studyId: cfg.id, pid: S.participant.pid, trialId: ctx.trialId, phase: ctx.phase, scenario: ctx.scenario, period: ctx.period,
        checkpoint, questionId: q.id, responseValue: a.value, responseStatus: a.status === 'answered' ? 'answered' : 'na_or_refused',
        scale: q.scale || q.type, scaleMin: s ? s.min : null, scaleMax: s ? s.max : null,
        answeredAt: now(), answerMs: res.answerMs, attemptNo: ctx.attemptNo, presentationId
      });
    });
  }
  const flatAns = (ans, prefix) => { const o = {}; Object.entries(ans).forEach(([k, a]) => { o[(prefix || '') + k] = a.value; o[(prefix || '') + k + '_status'] = a.status; }); return o; };

  /* ---------- 送出：先存本機，再分段傳送（main／night） ---------- */
  function payload(part) {
    const ph = part === 'night' ? 'night' : 'main';
    return {
      kind: 'toilet-study-part', studyId: cfg.id, pid: S.participant.pid, part, sentAt: now(),
      participant: S.participant,
      ratings: S.ratings.filter(r => r.phase === ph),
      marks: S.marks.filter(r => r.phase === ph),
      pretestChecks: S.pretestChecks.filter(r => r.phase === ph),
      events: S.events.filter(e => part === 'night' ? e.phase === 'night' : e.phase !== 'night')
    };
  }
  async function savePart(part) {
    const body = JSON.stringify(payload(part));
    try { localStorage.setItem(`tt-backup-${cfg.id}-${S.participant.pid}-${part}`, body); } catch (e) { /* 略過 */ }
    let res;
    if (!cfg.endpoint) res = { ok: false, status: 'local_only', reason: '未設定 endpoint' };
    else {
      try {
        const r = await fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
        const j = await r.json().catch(() => null);
        res = j && j.ok ? { ok: true, status: 'server_confirmed' } : { ok: false, status: 'pending', reason: (j && j.error) || ('HTTP ' + r.status) };
      } catch (e) {
        try { await fetch(cfg.endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }); res = { ok: true, status: 'sent_unconfirmed', unverified: true }; }
        catch (e2) { res = { ok: false, status: 'pending', reason: '網路錯誤' }; }
      }
    }
    S.participant[part + 'SaveStatus'] = res.status;
    persist();
    return res;
  }

  /* ================= 主流程 ================= */
  fetch(cfgUrl, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(c => {
      const errs = validate(c);
      if (errs.length) { fatal(errs); return; }
      cfg = c;
      (T.labels || []).forEach(l => { l.visible = false; });
      T.setSignNeutral(true);
      endResearchScene(); T.setMode('orbit');
      cover.hidden = true;
      if (params.has('reset')) { try { localStorage.removeItem(storeKey()); } catch (e) { /* 略過 */ } }
      const saved = loadSaved();
      if (saved && saved.participant.mainStatus !== 'completed') resumeAsk(saved); else intro();
    })
    .catch(err => fatal([
      '無法讀取設定檔：' + err.message,
      '用電腦直接雙擊開啟（file://）時瀏覽器會擋住讀檔，請改用本機伺服器或 GitHub Pages 的網址。'
    ]));

  function resumeAsk(saved) {
    const go = mk('button', { class: 'go' }, '繼續作答');
    go.addEventListener('click', () => {
      unlockAudio();
      S = saved; S.sessionStarts = (S.sessionStarts || 1) + 1;
      logEvent('session_resume', { nextPeriod: S.nextPeriod, stage: S.stage });
      persist();
      route();
    });
    card({ title: '繼續上次的作答', full: true, expand: true },
      mk('p', {}, '這台裝置上有一份尚未完成的作答。按「繼續作答」會從還沒完成的方案重新開始該方案，已完成的部分會保留。'),
      mk('p', { class: 'meta' }, '受試者代碼 ' + saved.participant.pid),
      mk('div', { class: 'row' }, mk('span', {}, ''), go));
  }

  function assignOrder() {
    const groups = Object.keys(cfg.orders);
    const g = params.get('g');
    if (g && cfg.orders[g]) return { group: g, source: 'researcher_url' };
    const a = new Uint32Array(1); crypto.getRandomValues(a);
    return { group: groups[a[0] % groups.length], source: 'device_random' };
  }

  function intro() {
    const i = cfg.intro || {};
    const ok = mk('input', { type: 'checkbox', id: 'sx-consent' });
    const go = mk('button', { class: 'go', disabled: true }, i.start || '開始');
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    go.addEventListener('click', () => {
      unlockAudio();
      const og = assignOrder();
      S = {
        participant: {
          studyId: cfg.id, pid: rid(6), protocolVersion: cfg.protocolVersion, configVersion: cfg.configVersion,
          modelVersion: T.version, studyJsVersion: STUDY_JS_VERSION,
          orderGroup: og.group, assignedOrder: cfg.orders[og.group], assignSource: og.source, boothId: null,
          consentAt: now(), startedAt: now(), mainStatus: 'in_progress', mainCompletedAt: null,
          ua: navigator.userAgent, screenW: screen.width, screenH: screen.height, pretest: !!cfg.pretest, priorRuns: getRuns()
        },
        ratings: [], marks: [], events: [], pretestChecks: [], eventSeq: 0, sessionStarts: 1,
        stage: 'practice', nextPeriod: 1, attempts: {}
      };
      logEvent('assigned', { orderGroup: og.group, order: cfg.orders[og.group], source: og.source });
      persist();
      route();
    });
    card({ title: i.title || cfg.id, full: true, expand: true },
      (i.body || []).map(t => mk('p', {}, t)),
      mk('div', { class: 'opts' }, mk('label', { class: 'opt', for: 'sx-consent' }, ok, mk('span', {}, i.consent || '我同意參加'))),
      mk('div', { class: 'row' }, mk('span', { class: 'meta' }, `v${cfg.configVersion}`), go));
  }

  function useBooth(key) {
    boothKey = key; boothIdx = cfg.booths[key].index;
  }

  /* 依進度決定下一步（也用於續跑） */
  async function route() {
    if (S.participant.boothId) useBooth(S.participant.boothId);
    if (S.stage === 'practice') { await practice(); S.stage = 'booth'; persist(); }
    if (S.stage === 'booth') { await chooseBooth(); S.stage = 'main'; persist(); }
    if (S.stage === 'main') {
      const order = S.participant.assignedOrder;
      while (S.nextPeriod <= order.length) {
        const period = S.nextPeriod, scenario = order[period - 1];
        await runTrial({ phase: 'main', scenario, period });
        S.nextPeriod = period + 1; persist();
      }
      S.stage = 'post'; persist();
    }
    if (S.stage === 'post') { await post(); S.stage = 'save'; persist(); }
    if (S.stage === 'save') {
      S.participant.mainStatus = 'completed'; S.participant.mainCompletedAt = now();
      S.participant.gyroUsed = gyro.used ? 1 : 0; S.participant.gyroStatus = gyro.status;
      logEvent('main_completed', {});
      cover.hidden = false; cover.textContent = '儲存中…';
      S.mainSave = await savePart('main');
      cover.hidden = true;
      S.stage = 'done'; persist();
    }
    addRun();
    ending();
  }

  /* ---------- 練習：操作與門鎖說明（中性場景，不在廁所前） ---------- */
  async function practice() {
    const P = cfg.practice;
    endResearchScene();
    T.setMode('walk'); T.setPinned(true); T.setNoClip(true); applyView(); gyroShow(true);
    setPose(P.pose);
    track = newTrack();
    const go = mk('button', { class: 'go', disabled: true }, '下一步');
    const meta = mk('span', { class: 'meta' }, '');
    card({ title: P.title, expand: true }, P.say.map(t => mk('p', {}, t)), mk('div', { class: 'row' }, meta, go));
    const min = (P.minViewSeconds || 4) * 1000;
    const iv = setInterval(() => { const left = Math.ceil((min - track.fgMs) / 1000); if (left <= 0) { clearInterval(iv); go.disabled = false; meta.textContent = ''; } else meta.textContent = `請先轉頭看看 ${left} 秒`; }, 200);
    await waitClick(go);
    const view = trackSummary(track); track = null;
    const sample = await askCard({ title: P.title, lead: P.sampleLead, questions: [P.sampleQuestion], prefix: 'prac', button: '下一步' });
    // 門鎖說明：答錯時以相同文字說明後再確認
    const checks = []; let attempt = 0, ok = false;
    while (!ok) {
      attempt++;
      const r = await askCard({ title: P.lockTitle, lead: cfg.commonInstruction, questions: P.comprehension, prefix: 'pc' + attempt, button: '確認' });
      ok = P.comprehension.every(q => String(r.ans[q.id].value) === String(q.correct));
      checks.push({ attempt, answers: Object.fromEntries(P.comprehension.map(q => [q.id, r.ans[q.id].value])), correct: ok });
      if (!ok) {
        const again = mk('button', { class: 'go' }, '再確認一次');
        card({ title: P.lockTitle, expand: true }, mk('p', {}, P.wrongText), mk('p', { class: 'lead' }, cfg.commonInstruction), mk('div', { class: 'row' }, mk('span', {}, ''), again));
        await waitClick(again);
      }
      if (attempt >= 3 && !ok) break;
    }
    Object.assign(S.participant, { practiceViewSec: r2(view.foregroundMs / 1000), practiceSample: sample.ans[P.sampleQuestion.id].value, lockCheckAttempts: attempt, lockCheckPassed: ok ? 1 : 0 });
    logEvent('practice_done', { view, checks });
    gyroShow(false);
  }

  /* ---------- 受試者自選廁間（之後四個方案都在這一間） ---------- */
  function chooseBooth() {
    return new Promise(resolve => {
      const Q = cfg.boothQuestion || {};
      T.setMode('orbit'); gyroShow(false);
      const err = mk('div', { class: 'err' });
      const opts = mk('div', { class: 'opts', role: 'radiogroup', style: 'grid-template-columns:repeat(auto-fit,minmax(140px,1fr))' });
      cfg.boothChoice.forEach((o, j) => {
        const inp = mk('input', { type: 'radio', name: 'sx-booth', value: o.booth, id: 'sx-booth-' + j });
        opts.append(mk('label', { class: 'opt', for: 'sx-booth-' + j }, inp, icon(o.icon), mk('span', {}, o.label, o.ja ? mk('small', { style: 'display:block;font-size:11px;opacity:.75' }, o.ja) : null)));
      });
      const go = mk('button', { class: 'go' }, '確定');
      const t0 = performance.now();
      go.addEventListener('click', () => {
        const v = (root.querySelector('input[name="sx-booth"]:checked') || {}).value;
        if (!v) { err.textContent = '請選一間'; return; }
        go.disabled = true;
        useBooth(v);
        S.participant.boothId = v; S.participant.boothIndex = boothIdx;
        logEvent('booth_chosen', { boothId: v, answerMs: Math.round(performance.now() - t0) });
        persist();
        resolve(v);
      });
      card({ title: Q.title || '選擇廁所', expand: true }, mk('div', { class: 'q' }, Q.text), Q.note ? mk('p', { class: 'meta' }, Q.note) : null, opts, err, mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), go));
    });
  }

  /* ---------- 研究控制生命週期 ---------- */
  function resetBooths() {
    T.booths.forEach((bt, i) => { if (bt.simOcc) T.setSimOcc(i, false); bt.st.open = 0; bt.st.target = 0; bt.st.locked = false; });
    T.setExpMode(false); T.setWinter(false);
  }
  function beginScenario(spec) {
    resetBooths();                                  // 一般重設保留原語意，再局部啟用研究控制
    T.setExpMode(true);
    T.booths.forEach((b, i) => { T.setHazeNow(i, 0); T.setSkin(i, 'glass'); });
    T.setNight(false);
    T.setSkin(boothIdx, spec.skin);
    T.setHazeNow(boothIdx, spec.skin === 'glass' ? spec.hazeBefore : 0);
    T.setSignNeutral(true);
    T.clearWalkers();
    const li = ((cfg.lighting || {}).dayInterior || {})[spec.lightKey || spec.skin];
    if (typeof li === 'number') T.booths[boothIdx].light.intensity = li;
  }
  function endResearchScene() {
    resetBooths();
    T.clearWalkers && T.clearWalkers();
    T.booths.forEach((b, i) => { T.setHazeNow(i, 0); T.setSkin(i, 'glass'); });
    T.setNight(false);
  }

  /* ---------- 路人：依觀察開始的時點排定，使每人看到的機會相近 ----------
   * 每位路人設定 path、speed 與 crossAt（觀察開始後第幾秒經過「焦點」）。
   * 焦點：外部觀察 = 廁所門前（受試者正前方）；室內觀察 = 坐姿視線與路線的交點。 */
  function crossS(path, px, pz, dx, dz) {
    let acc = 0, best = null;
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1], [bx, bz] = path[i], vx = bx - ax, vz = bz - az, L = Math.hypot(vx, vz);
      if (dx != null) {   // 射線與線段交點
        const den = dx * vz - dz * vx;
        if (Math.abs(den) > 1e-9) {
          const t = ((ax - px) * vz - (az - pz) * vx) / den, u = ((ax - px) * dz - (az - pz) * dx) / den;
          if (t > 0 && u >= 0 && u <= 1) return acc + u * L;
        }
      }
      let u = ((px - ax) * vx + (pz - az) * vz) / (L * L); u = Math.max(0, Math.min(1, u));
      const d = Math.hypot(ax + vx * u - px, az + vz * u - pz);
      if (!best || d < best.d) best = { d, s: acc + u * L };
      acc += L;
    }
    return best.s;
  }
  function scheduleWalkers(list, focus) {
    const out = (list || []).map(w => {
      const sx = crossS(w.path, focus.x, focus.z, focus.dx, focus.dz);
      const s0 = sx - w.speed * (w.crossAt || 3);
      return { kind: w.kind, path: w.path, speed: w.speed, s0: Math.max(0, s0), delay: s0 < 0 ? -s0 / w.speed : 0 };
    });
    T.startWalkers(out);
    return out;
  }

  /* ---------- 觀看（前景至少 N 秒）→ 按鈕 ---------- */
  function lookPhase(title, text, minSec, button) {
    return new Promise(resolve => {
      collapseCount = 0;
      track = newTrack();
      const min = (minSec || 0) * 1000;
      const meta = mk('span', { class: 'meta' }, '');
      const go = mk('button', { class: 'go', disabled: min > 0 }, button || '開始作答');
      go.addEventListener('click', () => { clearInterval(iv); const s = trackSummary(track); track = null; resolve(s); }, { once: true });
      card({ title }, mk('p', {}, text), mk('div', { class: 'row' }, meta, go));
      const iv = setInterval(() => {
        if (!track) return;
        const left = Math.ceil((min - track.fgMs) / 1000);
        if (left <= 0) { go.disabled = false; meta.textContent = ''; } else meta.textContent = `請先觀看 ${left} 秒`;
      }, 200);
    });
  }
  async function stepButton(title, label, say) {
    const btn = mk('button', { class: 'go' }, label);
    card({ title }, say ? mk('p', {}, say) : null, mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), btn));
    await waitClick(btn);
  }

  /* ---------- 一個方案 ---------- */
  async function runTrial({ phase, scenario, period }) {
    const spec = cfg.scenarios[scenario], BK = cfg.booths[boothKey], P = BK.poses, X = cfg.text;
    const trialId = `${S.participant.pid}-${phase}-${period}`;
    const attemptNo = S.attempts[trialId] = (S.attempts[trialId] || 0) + 1;
    if (attemptNo > 1) {   // 續跑：同一輪重新開始，移除該輪先前的部分答案（事件保留）
      S.ratings = S.ratings.filter(r => r.trialId !== trialId); S.marks = S.marks.filter(r => r.trialId !== trialId); S.pretestChecks = S.pretestChecks.filter(r => r.trialId !== trialId);
    }
    const ctx = { trialId, phase, scenario, period, attemptNo, spec };
    if (attemptNo > 1) logEvent('trial_restart', { reason: 'resume_or_retry' }, ctx);
    persist();
    const vars = { n: period, total: S.participant.assignedOrder.length };
    const title = fill(X.trialTitle, vars);
    const b = T.booths[boothIdx];

    cover.hidden = false; cover.textContent = fill(X.trialCover, vars);
    root.replaceChildren(); top.replaceChildren();
    beginScenario(spec);
    T.setMode('walk'); T.setPinned(true); T.setNoClip(true); applyView(); gyroShow(true);
    setPose(P.start);
    await sleep(900);
    cover.hidden = true;
    top.replaceChildren(mk('span', {}, title));
    logEvent('trial_start', { order: S.participant.assignedOrder, boothId: boothKey }, ctx);
    const tStart = performance.now();

    /* 外部：路人依觀察開始排定 */
    const focusOut = { x: (b.b.door[0] + b.b.door[1]) / 2, z: 1.193 };
    const wOut = scheduleWalkers((cfg.passersby || {}).outside, Object.assign({}, focusOut, { dx: 0, dz: 1 }));
    logEvent('passersby_scheduled', { phase: 'outside', walkers: wOut.map(w => ({ kind: w.kind, s0: r2(w.s0), delay: r2(w.delay) })) }, ctx);
    const pOut = snapshot('outside_view', ctx);
    const vOut = await lookPhase(title, X.outsideSay, cfg.minViewSeconds);
    logEvent('view', Object.assign({ checkpoint: 'outside', presentationId: pOut }, vOut), ctx);
    const o1 = await askCard({ title, lead: X.outsideExpectLead, questions: cfg.outsideExpect, prefix: `${trialId}-oe`, full: false });
    storeRatings(ctx, 'outside', cfg.outsideExpect, o1, pOut);
    const o2 = await askCard({ title, lead: X.outsideNowLead, questions: cfg.outsideNow, prefix: `${trialId}-on`, full: false });
    storeRatings(ctx, 'outside', cfg.outsideNow, o2, pOut);
    persist();
    T.clearWalkers();

    /* 進入、上鎖：四方案相同的動作、指示燈、音效與固定等待 */
    await stepButton(title, X.steps.door); await tweenPose(P.door);
    await stepButton(title, X.steps.open); await doorTo(b, true, ctx); logEvent('door_open', {}, ctx);
    await stepButton(title, X.steps.enter); await tweenPose(P.inside);
    await stepButton(title, X.steps.close); await tweenPose(P.closeView); await doorTo(b, false, ctx); logEvent('door_closed', {}, ctx);
    await stepButton(title, X.steps.lock);
    if (b.st.open >= 0.02) await doorTo(b, false, ctx);
    T.ACTS.lock(boothIdx); sound('lock');
    if (!b.st.locked) { b.st.locked = true; logEvent('lock_forced', {}, ctx); }
    const changes = spec.skin === 'glass' && spec.hazeAfterLock !== spec.hazeBefore;
    if (changes) T.setExpHaze(boothIdx, spec.hazeAfterLock, cfg.hazeRate || 2.2);
    const tLock = performance.now();
    logEvent('lock', { hazeChanges: changes }, ctx);
    await sleep(cfg.lockWaitMs);
    const target = spec.skin === 'glass' ? spec.hazeAfterLock : 0;
    const hazeOk = target ? b.haze >= (cfg.hazeOkThreshold || 0.95) : b.haze <= 0.05;
    snapshot('after_lock_wait', ctx, { waitMs: Math.round(performance.now() - tLock), manipulationOk: hazeOk });
    if (!hazeOk) logEvent('manipulation_failure', { haze: r2(b.haze), expected: target ? 'hazed' : 'clear' }, ctx);

    /* 坐下觀察：這段不作答 */
    await stepButton(title, X.steps.sit); await tweenPose(P.seat);
    const seatLook = lookAngles(P.seat);
    const focusIn = { x: P.seat.pos[0], z: P.seat.pos[2], dx: -Math.sin(seatLook.yaw), dz: -Math.cos(seatLook.yaw) };
    const wIn = scheduleWalkers((BK.passersby || {}).inside, focusIn);
    logEvent('passersby_scheduled', { phase: 'inside', walkers: wIn.map(w => ({ kind: w.kind, s0: r2(w.s0), delay: r2(w.delay) })) }, ctx);
    const pIn = snapshot('inside_view', ctx);
    const vIn = await lookPhase(title, X.insideSay, cfg.insideViewSeconds, X.insideDone);
    logEvent('view', Object.assign({ checkpoint: 'inside', presentationId: pIn }, vIn), ctx);
    snapshot('inside_view_end', ctx);

    /* 在解鎖之前淡出到中性畫面，再回想作答（避免 A 解鎖後回到透明影響回想） */
    top.replaceChildren();
    await fadeOut();
    T.clearWalkers();
    cover.hidden = false; cover.textContent = '';
    fader.style.opacity = '0';
    const r1 = await askCard({ title, lead: X.recallLead, questions: cfg.recall, prefix: `${trialId}-rc`, full: true });
    storeRatings(ctx, 'inside_recall', cfg.recall, r1, pIn);
    if (cfg.pretest && (cfg.pretestScene || []).length) {
      const t = await askCard({ title, lead: X.pretestLead, questions: cfg.pretestScene, prefix: `${trialId}-pt`, full: true });
      cfg.pretestScene.forEach(q => S.pretestChecks.push({ studyId: cfg.id, pid: S.participant.pid, trialId, phase, scenario, period, questionId: q.id, responseValue: t.ans[q.id].value, responseStatus: t.ans[q.id].status, answeredAt: now() }));
    }
    persist();
    await markTask(ctx, title);
    logEvent('trial_end', { flowSec: Math.round((performance.now() - tStart) / 1000) }, ctx);
    persist();
    endResearchScene();
    T.setNoClip(false);
  }

  /* ---------- M1／M2：回顧性的私人範圍定位（路線簡圖依所選廁間自動產生） ---------- */
  function routeFor() {
    const P = cfg.booths[boothKey].poses, bb = T.booths[boothIdx].b, ZF = 1.193, ZB = -1.193;
    const dx = (bb.door[0] + bb.door[1]) / 2;
    const pts = [
      { x: P.start.pos[0], z: P.start.pos[2], label: '起點' },
      { x: P.door.pos[0], z: P.door.pos[2], label: '門前' },
      { x: dx, z: ZF, threshold: true, label: '門檻', ly: 34 },
      { x: P.inside.pos[0], z: P.inside.pos[2] },
      { x: P.seat.pos[0], z: P.seat.pos[2], label: '馬桶', ly: 34 }
    ];
    const xs = pts.map(p => p.x).concat([bb.x0, bb.x1]);
    const x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5;
    return {
      version: `route-${boothKey}-v2`, bounds: [x0, ZB - 0.3, x1, Math.max(...pts.map(p => p.z)) + 0.4],
      booth: { x0: bb.x0, z0: ZB, x1: bb.x1, z1: ZF }, door: { x0: bb.door[0], x1: bb.door[1], z: ZF }, points: pts,
      labels: [{ text: '門外（公園步道）', x: x1 - 0.4, z: ZF + 1.9 }, { text: '廁所內', x: (bb.x0 + bb.x1) / 2, z: ZB + 0.35 }]
    };
  }
  function routeMap(onPick) {
    const R = routeFor(), pts = R.points;
    const seg = []; let acc = 0, thrS = 0;
    pts.forEach((p, i) => { if (i) { const a = pts[i - 1], L = Math.hypot(p.x - a.x, p.z - a.z); seg.push({ a, b: p, s0: acc, L }); acc += L; } if (p.threshold) thrS = acc; });
    const [x0, z0, x1, z1] = R.bounds;
    // 畫面橫向 = 模型 z（左邊是公園步道、右邊是廁所深處），縱向 = 模型 x
    const sc = 100, W = (z1 - z0) * sc, H = (x1 - x0) * sc;
    const PX = (x, z) => (z1 - z) * sc, PY = (x, z) => (x - x0) * sc;
    const ns = 'http://www.w3.org/2000/svg';
    const el = (t, a) => { const e = document.createElementNS(ns, t); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '剛才走過的路線簡圖' });
    const rect = (r, a) => { const xs = [PX(r.x0, r.z0), PX(r.x1, r.z1)], ys = [PY(r.x0, r.z0), PY(r.x1, r.z1)];
      svg.append(el('rect', Object.assign({ x: Math.min(...xs), y: Math.min(...ys), width: Math.abs(xs[1] - xs[0]), height: Math.abs(ys[1] - ys[0]) }, a))); };
    rect(R.booth, { fill: '#eef2f3', stroke: '#24313a', 'stroke-width': 4 });
    const D = R.door;
    const dl = { x1: PX(D.x0, D.z), y1: PY(D.x0, D.z), x2: PX(D.x1, D.z), y2: PY(D.x1, D.z) };
    svg.append(el('line', Object.assign({ stroke: '#fff', 'stroke-width': 7 }, dl)));
    svg.append(el('line', Object.assign({ stroke: '#0f8f86', 'stroke-width': 3, 'stroke-dasharray': '8 6' }, dl)));
    const poly = pts.map(p => `${PX(p.x, p.z)},${PY(p.x, p.z)}`).join(' ');
    svg.append(el('polyline', { points: poly, fill: 'none', stroke: '#c9d1d4', 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    svg.append(el('polyline', { points: poly, fill: 'none', stroke: '#24313a', 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' }));
    const txt = (s, x, y, a) => { const t = el('text', Object.assign({ x, y, 'font-size': 22, fill: '#4b5b64', 'font-family': 'sans-serif', 'text-anchor': 'middle' }, a || {})); t.textContent = s; svg.append(t); };
    pts.forEach(p => { if (p.label) txt(p.label, PX(p.x, p.z) + (p.lx || 0), PY(p.x, p.z) + (p.ly || -24)); });
    (R.labels || []).forEach(l => txt(l.text, PX(l.x, l.z), PY(l.x, l.z), { 'font-weight': 600, fill: '#16222a' }));
    const dot = el('circle', { r: 13, fill: '#e0352c', stroke: '#fff', 'stroke-width': 4, visibility: 'hidden' });
    svg.append(dot);
    function project(px, pz) {
      let best = null;
      seg.forEach(sg => { const vx = sg.b.x - sg.a.x, vz = sg.b.z - sg.a.z; let t = ((px - sg.a.x) * vx + (pz - sg.a.z) * vz) / (vx * vx + vz * vz); t = Math.max(0, Math.min(1, t));
        const qx = sg.a.x + vx * t, qz = sg.a.z + vz * t, d = Math.hypot(px - qx, pz - qz); if (!best || d < best.d) best = { d, x: qx, z: qz, s: sg.s0 + sg.L * t }; });
      return best;
    }
    svg.addEventListener('pointerdown', e => {
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      const q = p.matrixTransform(svg.getScreenCTM().inverse());
      const hit = project(q.y / sc + x0, z1 - q.x / sc);
      dot.setAttribute('cx', PX(hit.x, hit.z)); dot.setAttribute('cy', PY(hit.x, hit.z)); dot.setAttribute('visibility', 'visible');
      onPick({ x: r2(hit.x), z: r2(hit.z), distanceM: r2(hit.s - thrS) });
    });
    const reset = () => dot.setAttribute('visibility', 'hidden');
    return { el: mk('div', { class: 'map' }, svg), reset, version: R.version };
  }
  function approxText(d) {
    const a = Math.round(Math.abs(d) * 2) / 2;
    if (a < 0.25) return '門檻附近';
    return (d < 0 ? '門外' : '門內') + `約 ${a.toFixed(1)} 公尺`;
  }
  function markTask(ctx, title) {
    return new Promise(resolve => {
      const M = cfg.mark, spec = ctx.spec;
      const hazeHappens = spec.skin === 'glass' && spec.hazeBefore === 0 && spec.hazeAfterLock === 1;
      const opts = M.options.filter(o => o.value !== 'haze' || hazeHappens);   // 「玻璃變霧之後」只在實際發生霧化的方案提供
      const name = `${ctx.trialId}-m1`;
      let picked = null;
      const read = mk('div', { class: 'mapread' }, M.mapPrompt);
      const map = routeMap(p => { picked = p; read.textContent = '你選的位置：' + approxText(p.distanceM) + '（可再點一次修改）'; });
      const mapBox = mk('div', { class: 'sub', hidden: true }, map.el, read);
      const other = mk('input', { type: 'text', maxlength: 200, placeholder: M.otherPlaceholder || '' });
      const otherBox = mk('div', { class: 'sub', hidden: true }, other);
      const list = mk('div', { class: 'opts', role: 'radiogroup' });
      opts.forEach((o, j) => {
        const inp = mk('input', { type: 'radio', name, value: o.value, id: `${name}_${j}` });
        inp.addEventListener('change', () => { mapBox.hidden = o.value !== 'location'; otherBox.hidden = o.value !== 'other_event'; if (o.value !== 'location') { picked = null; map.reset(); read.textContent = M.mapPrompt; } });
        list.append(mk('label', { class: 'opt', for: `${name}_${j}` }, inp, mk('span', {}, o.label)));
        if (o.value === 'location') list.append(mapBox);
        if (o.value === 'other_event') list.append(otherBox);
      });
      const reason = mk('input', { type: 'text', maxlength: 300 });
      const err = mk('div', { class: 'err' });
      const go = mk('button', { class: 'go' }, '確認');
      const t0 = performance.now();
      go.addEventListener('click', () => {
        const sel = root.querySelector(`input[name="${name}"]:checked`);
        if (!sel) { err.textContent = '請選一個最接近的答案'; return; }
        const type = sel.value;
        if (type === 'location' && !picked) { err.textContent = '請在圖上點選位置'; return; }
        go.disabled = true;
        const row = {
          studyId: cfg.id, pid: S.participant.pid, trialId: ctx.trialId, phase: ctx.phase, scenario: ctx.scenario, period: ctx.period, boothId: boothKey,
          markType: type, markStatus: type === 'no_answer' ? 'no_answer' : 'answered',
          markDistanceM: type === 'location' ? picked.distanceM : type === 'threshold' ? 0 : null,
          markX: type === 'location' ? picked.x : null, markZ: type === 'location' ? picked.z : null,
          otherText: type === 'other_event' ? (other.value.trim() || null) : null,
          reason: reason.value.trim() || null, routeVersion: map.version,
          answeredAt: now(), answerMs: Math.round(performance.now() - t0), attemptNo: ctx.attemptNo, revision: 1
        };
        const k = S.marks.findIndex(m => m.trialId === row.trialId);
        if (k >= 0) { row.revision = S.marks[k].revision + 1; S.marks[k] = row; } else S.marks.push(row);
        resolve(row);
      });
      card({ title, full: true, expand: true }, mk('div', { class: 'q' }, M.text), list,
        mk('div', { class: 'q' }, M.reasonText, mk('small', {}, '（選填）')), reason, err,
        mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), go));
    });
  }

  /* ---------- 四方案結束後：事後題 → 背景題（熟悉度、電影放最後） ---------- */
  async function post() {
    cover.hidden = false; cover.textContent = '';
    T.setMode('orbit'); gyroShow(false);
    const X = cfg.text;
    const p = await askCard({ title: X.postTitle, lead: X.postLead, questions: cfg.post, prefix: 'post' });
    Object.assign(S.participant, flatAns(p.ans));
    if (cfg.pretest && (cfg.pretestEnd || []).length) {
      const t = await askCard({ title: X.postTitle, lead: X.pretestEndLead, questions: cfg.pretestEnd, prefix: 'pte' });
      cfg.pretestEnd.forEach(q => S.pretestChecks.push({ studyId: cfg.id, pid: S.participant.pid, trialId: null, phase: 'main', scenario: null, period: null, questionId: q.id, responseValue: t.ans[q.id].value, responseStatus: t.ans[q.id].status, answeredAt: now() }));
    }
    const bg = await askCard({ title: X.backgroundTitle, lead: X.backgroundLead, questions: cfg.background, prefix: 'bg', button: '送出' });
    Object.assign(S.participant, flatAns(bg.ans));
    S.participant.finishedMainAt = now();
    cover.hidden = true;
    logEvent('post_answered', { answerMs: p.answerMs + bg.answerMs });
  }

  /* ---------- 片尾：主資料已保存之後才播 ---------- */
  const runsKey = () => 'study-runs-' + (cfg && cfg.id);
  function getRuns() { try { return parseInt(localStorage.getItem(runsKey()) || '0', 10) || 0; } catch (e) { return 0; } }
  function addRun() { try { localStorage.setItem(runsKey(), String(getRuns() + 1)); } catch (e) { /* 略過 */ } }

  function ending() {
    const E = cfg.ending || {};
    const bi = boothIdx, bt = T.booths[bi];
    const css = document.createElement('style');
    css.textContent = `
    .sx-bar{position:fixed;left:0;right:0;height:0;background:#000;z-index:26;transition:height 1.2s ease}
    .sx-bar.t{top:0}.sx-bar.b{bottom:0}.sx-bar.on{height:9vh}
    #sx-cap{position:fixed;left:0;right:0;bottom:calc(13vh + env(safe-area-inset-bottom,0px));z-index:27;text-align:center;padding:0 max(24px,env(safe-area-inset-left,0px));
      font:500 clamp(16px,4.4vw,22px)/1.7 var(--font-ui,sans-serif);letter-spacing:.06em;color:#fff;text-shadow:0 1px 6px #000a,0 0 2px #000;opacity:0;transition:opacity 1.1s ease;pointer-events:none;text-wrap:balance}
    #sx-cap.on{opacity:1}
    #sx-title{position:fixed;inset:0;z-index:27;display:grid;place-content:center;gap:10px;text-align:center;color:#fff;opacity:0;transition:opacity 1.6s ease;pointer-events:none;text-shadow:0 1px 8px #000b;padding:0 24px}
    #sx-title.on{opacity:1}
    #sx-title .t1{font:600 clamp(18px,5vw,26px)/1.4 var(--font-ui,sans-serif);letter-spacing:.08em}
    #sx-title .t2{font:400 12px/1.6 var(--font-data,monospace);letter-spacing:.14em;opacity:.85}
    #sx-title .t3{font:400 14px/1.6 var(--font-ui,sans-serif);letter-spacing:.2em;margin-top:14px}
    #sx-skip{position:fixed;top:calc(9vh + 10px + env(safe-area-inset-top,0px));right:calc(12px + env(safe-area-inset-right,0px));z-index:28;font:500 12px var(--font-ui,sans-serif);border:1px solid #fff6;border-radius:999px;padding:6px 12px;background:#0006;color:#fff;cursor:pointer}
    @media (prefers-reduced-motion:reduce){.sx-bar,#sx-cap,#sx-title{transition:none}}`;
    document.head.appendChild(css);
    const barT = mk('div', { class: 'sx-bar t' }), barB = mk('div', { class: 'sx-bar b' });
    const cap = mk('div', { id: 'sx-cap', 'aria-live': 'polite' });
    const ttl = mk('div', { id: 'sx-title' }, mk('div', { class: 't1' }, E.title || ''), mk('div', { class: 't2' }, E.subtitle || ''), mk('div', { class: 't3' }, E.thanks || ''));
    let skipped = false;
    const skip = mk('button', { id: 'sx-skip', type: 'button' }, E.skip || '略過');
    skip.addEventListener('click', () => { skipped = true; skip.remove(); });
    document.body.append(barT, barB, cap, ttl, skip);
    const wait = ms => new Promise(r => { if (skipped) return r(); const t0 = performance.now(); (function chk() { if (skipped || performance.now() - t0 >= ms) r(); else setTimeout(chk, 50); })(); });
    const say = async (text, ms) => { if (skipped) return; cap.textContent = text; cap.classList.add('on'); await wait(ms); cap.classList.remove('on'); await wait(1100); };
    const cx = bt.cx, ZF = 1.193;
    const path = u => { const r = 5 + 9 * u, th = 0.95 * u * (cx < 0 ? -1 : 1), cy = 1.55 + 3.2 * u, ox = cx * (1 - u * 0.8); return { pos: [ox + Math.sin(th) * r, cy, ZF * 0.3 + Math.cos(th) * r], look: [cx * (1 - u), 1.25, ZF * (1 - u) * 0.6] }; };
    const camAt = u => setPose(path(u));
    const camRun = ms => new Promise(res => { const t0 = performance.now(), reduce = reduceMotion(); (function step() { const t = (skipped || reduce) ? 1 : Math.min(1, (performance.now() - t0) / ms); camAt(ease(t)); if (t < 1) requestAnimationFrame(step); else res(); })(); });
    const skyRun = ms => new Promise(res => { const t0 = performance.now(); (function step() { const t = skipped ? 1 : Math.min(1, (performance.now() - t0) / ms); T.setDayMix(t); if (t < 1) requestAnimationFrame(step); else res(); })(); });
    (async () => {
      root.replaceChildren(); top.replaceChildren();
      fader.style.opacity = '1'; await sleep(450);
      endResearchScene(); T.setDayMix(0);
      T.setMode('walk'); T.setPinned(true); T.setNoClip(true); applyView(); gyroShow(false); gyroSet(false);
      camAt(0);
      T.setSimOcc(bi, true);
      await sleep(400);
      fader.style.opacity = '0';
      barT.classList.add('on'); barB.classList.add('on');
      await wait(1200);
      const caps = E.captions || [];
      const cam = camRun(E.cameraMs || 20000);
      await say(caps[0] || '', 3800);
      await say(caps[1] || '', 3800);
      const sky = skyRun(E.skyMs || 7000);
      await say(E.toNight || '', 4200);
      await sky;
      T.setSimOcc(bi, false);
      await say(caps[2] || '', 3800);
      await cam;
      cap.classList.remove('on'); skip.remove();
      ttl.classList.add('on');
      await wait(3600);
      skipped = true;
      ttl.classList.remove('on');
      await sleep(600);
      debrief();
    })();
  }

  function debrief() {
    const D = (cfg.ending && cfg.ending.debrief) || {};
    const kids = (D.body || []).map(t => mk('p', {}, t));
    if (D.contact) {
      const addr = mk('span', { style: 'user-select:all;font:500 14px var(--font-data,monospace)' }, D.contact);
      const cp = mk('button', { class: 'go ghost', type: 'button', style: 'min-height:36px;padding:6px 12px;font-size:13px' }, '複製');
      cp.addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(D.contact).then(() => { cp.textContent = '已複製'; }, () => {}); });
      kids.push(mk('div', { class: 'row', style: 'margin-top:4px' }, mk('span', {}, (D.contactLabel || '聯絡') + '：', addr), cp));
    }
    const res = S.mainSave || {};
    if (!res.ok) {
      kids.push(mk('p', { style: 'margin-top:12px' }, `資料沒有送到伺服器（${res.reason || res.status || '未知'}），已保存在這台裝置。請把下面的資料全選複製，寄給研究者。`));
      const ta = mk('textarea', { readonly: true, rows: 6, style: 'width:100%;box-sizing:border-box;font:11px var(--font-data,monospace)' });
      const all = payload('main'); if (S.participant.nightStatus === 'completed') all.night = payload('night');
      ta.value = JSON.stringify(all, null, 1);
      kids.push(ta);
    }
    const again = mk('button', { class: 'go', type: 'button' }, D.again || '重新再測一次');
    again.addEventListener('click', () => { try { localStorage.removeItem(storeKey()); } catch (e) { /* 略過 */ } location.reload(); });
    kids.push(mk('div', { class: 'row' }, mk('span', { class: 'meta' }, '受試者代碼 ' + S.participant.pid + (res.unverified ? '（未取得伺服器確認）' : '')), again));
    card({ title: D.title || '關於這個研究', expand: true, full: true }, ...kids);
    window.__studyData = S;   // 供研究者在主控台檢查
  }

  window.__studyDebug = { get state() { return S; }, get cfg() { return cfg; }, payload: p => payload(p) };
})();
