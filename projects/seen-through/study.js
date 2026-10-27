/* 受試者模式 study.js  v0.8
 * 載入：在透明廁所 HTML 最後加上 <script src="study.js"></script>
 * 啟用：網址加 ?study=1（可另加 &cfg=其他設定.json），或頁面先設 window.STUDY_AUTO = true
 * 流程：同意 → 自由觀看外觀 → 選隔間 → 隨機白天／晚上 → 使用流程（進入前、坐下時作答）→ 加測另一時段（三停點、作答一次）→ 背景題 → 送出
 * 依賴主程式 window.__tt：setExpMode setWinter setNight setSimOcc setMode setPinned setNoClip setHfov setEye
 *                       booths look camera controls labels ACTS
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (!params.has('study') && !window.STUDY_AUTO) return;

  const T = window.__tt;
  const cfgUrl = params.get('cfg') || 'study.json';

  /* ---------- 樣式 ---------- */
  const style = document.createElement('style');
  style.textContent = `
  body.study #bar, body.study #info, body.study #hint, body.study #act,
  body.study #joy, body.study #exitvr, body.study .ret { display:none!important }
  #sx-top{position:fixed;left:0;right:0;top:0;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 0 max(10px,env(safe-area-inset-left,0px));display:flex;justify-content:flex-start;pointer-events:none;z-index:20}
  #sx-top span{background:var(--glass,#f4f9fadd);border:1px solid var(--glass-line,#0002);border-radius:999px;padding:4px 12px;font:500 12px/1.4 var(--font-data,monospace);color:var(--ink,#16222a)}
  #sx-cover{position:fixed;inset:0;background:#cfe0e8;z-index:25;display:grid;place-items:center;font:500 14px var(--font-ui,sans-serif);color:var(--ink,#16222a)}
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
  #sx .q{margin:10px 0 6px;font-size:14.5px;font-weight:700;line-height:1.5}
  #sx .opts{display:grid;gap:6px}
  #sx .opts.icons{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
  #sx label.opt{display:flex;gap:10px;align-items:center;padding:9px 11px;border-radius:10px;background:var(--chip,#e3ecee);font-size:14px;cursor:pointer;min-height:24px}
  #sx label.opt input{width:18px;height:18px;margin:0;accent-color:var(--accent,#0f8f86);flex:none}
  #sx label.opt:has(input:checked){background:#16222a;color:#fff}
  #sx label.opt svg{width:34px;height:34px;flex:none;border-radius:7px}
  #sx label.opt small{display:block;font-size:11px;opacity:.75}
  #sx .row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap}
  #sx button.go{font:600 15px var(--font-ui,sans-serif);border:0;border-radius:10px;padding:11px 18px;min-height:44px;background:var(--chip-on,#16222a);color:#fff;cursor:pointer}
  #sx button.go.ghost{background:var(--chip,#e3ecee);color:var(--ink,#16222a)}
  #sx button.go:disabled{opacity:.4;cursor:default}
  #sx button:focus-visible{outline:2px solid var(--accent,#0f8f86);outline-offset:2px}
  #sx .err{color:#b3261e;font-size:13px;min-height:1em}
  #sx .meta{font:11px var(--font-data,monospace);color:var(--ink-soft,#4b5b64)}
  #sx ul{margin:0 0 8px;padding-left:20px;font-size:13px;line-height:1.6}
  `;
  document.head.appendChild(style);

  const root = mk('div', { id: 'sx' });
  const top = mk('div', { id: 'sx-top' });
  const cover = mk('div', { id: 'sx-cover' }, '載入中…');
  document.body.append(root, top, cover);
  document.body.classList.add('study');

  if (!T || !T.setNoClip) { fatal(['找不到 3D 主程式（window.__tt）或版本太舊。請確認 study.js 放在主程式之後載入，且主程式是對應版本。']); return; }

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
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pid() { const a = new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }
  const deg = r => r * 180 / Math.PI;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  }
  function fatal(lines) { cover.hidden = true; card({ title: '設定檔有問題', full: true, expand: true }, mk('ul', {}, lines.map(l => mk('li', {}, l))), mk('p', { class: 'meta' }, '設定檔：' + cfgUrl)); }

  /* 現場式圖示（與 3D 模型上的標示一致） */
  function icon(kind) {
    const s = {
      m: '<circle cx="24" cy="10" r="4.5"/><rect x="18" y="16" width="12" height="15" rx="1.5"/><rect x="14" y="17" width="3.2" height="12" rx="1.5"/><rect x="30.8" y="17" width="3.2" height="12" rx="1.5"/><rect x="18.5" y="30" width="4.5" height="14" rx="1.5"/><rect x="25" y="30" width="4.5" height="14" rx="1.5"/>',
      f: '<circle cx="24" cy="10" r="4.5"/><path d="M20 16h8l6 17H14z"/><rect x="13.5" y="17" width="3.2" height="11" rx="1.5"/><rect x="31.3" y="17" width="3.2" height="11" rx="1.5"/><rect x="20" y="32" width="3.2" height="12" rx="1.5"/><rect x="24.8" y="32" width="3.2" height="12" rx="1.5"/>',
      a: '<circle cx="19" cy="8" r="4"/><path d="M19 14l1 13h10l3.5 11" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 19h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M28 30a10 10 0 1 1-15-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
    }[kind] || '';
    const span = document.createElement('span');
    span.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="8" fill="#24313a"/><g fill="#fff">${s}</g></svg>`;
    return span.firstChild;
  }

  /* ---------- 設定檔檢查 ---------- */
  const ACTIONS = ['open', 'close', 'lock', 'unlock', 'flush', 'wash'];
  const num3 = a => Array.isArray(a) && a.length === 3 && a.every(x => typeof x === 'number' && isFinite(x));
  const isPose = p => !!p && num3(p.pos) && num3(p.look);

  function validate(c) {
    const e = [];
    if (!c || typeof c !== 'object') return ['不是有效的 JSON 物件'];
    if (!c.id) e.push('缺少 id');
    if (c.endpoint && !/^https:\/\//.test(c.endpoint)) e.push('endpoint 必須是 https 網址（或留空）');
    if (!Array.isArray(c.times) || !c.times.length) e.push('times 至少要有一個時段');
    else c.times.forEach((t, i) => { if (!t.id || !t.label) e.push(`times[${i}] 缺少 id 或 label`); });

    const steps = c.steps;
    if (!Array.isArray(steps) || !steps.length) e.push('steps 必須是非空陣列');
    else steps.forEach((st, j) => {
      const m = `steps[${j}]`;
      if (!st.id) e.push(m + ' 缺少 id');
      if (st.action && !ACTIONS.includes(st.action)) e.push(`${m}.action 只能是 ${ACTIONS.join('、')}`);
      if (!st.checkpoint && !st.label) e.push(m + ' 缺少按鈕文字 label');
    });
    const poseNames = Array.isArray(steps) ? [...new Set(steps.filter(s => s.pose).map(s => s.pose))] : [];

    const opts = c.boothQuestion && c.boothQuestion.options;
    if (!Array.isArray(opts) || !opts.length) e.push('boothQuestion.options 至少要有一間廁所');
    else opts.forEach((o, i) => {
      const w = c.walkthroughs && c.walkthroughs[o.walk];
      const m = `boothQuestion.options[${i}]`;
      if (!o.value || !o.label) e.push(m + ' 缺少 value 或 label');
      if (!w) { e.push(`${m}.walk 找不到 walkthroughs["${o.walk}"]`); return; }
      if (!(Number.isInteger(w.booth) && w.booth >= 0 && w.booth < T.booths.length)) e.push(`walkthroughs.${o.walk}.booth 必須是 0–${T.booths.length - 1}`);
      const P = w.poses || {};
      ['start', ...poseNames].forEach(n => { if (!isPose(P[n])) e.push(`walkthroughs.${o.walk}.poses.${n} 缺少或格式錯誤（pos 與 look 各需 3 個數字）`); });
    });

    const r = c.replay;
    if (r && r.enabled) {
      if (!Array.isArray(r.stops) || !r.stops.length) e.push('replay.stops 必須是非空陣列');
      else {
        r.stops.forEach((sp, j) => {
          if (!sp.pose) e.push(`replay.stops[${j}] 缺少 pose`);
          if (sp.action && !ACTIONS.includes(sp.action)) e.push(`replay.stops[${j}].action 只能是 ${ACTIONS.join('、')}`);
          (opts || []).forEach(o => { const w = c.walkthroughs && c.walkthroughs[o.walk]; if (w && !isPose((w.poses || {})[sp.pose])) e.push(`walkthroughs.${o.walk}.poses.${sp.pose} 缺少（replay.stops[${j}] 用到）`); });
        });
        if (!r.stops[r.stops.length - 1].ask) e.push('replay.stops 最後一站要設 "ask": true');
        if (r.stops[0].pose !== 'start') e.push('replay.stops 第一站的 pose 必須是 start');
      }
    }
    ['sceneQuestions', 'finalQuestions'].forEach(k => {
      if (!Array.isArray(c[k])) { e.push(k + ' 必須是陣列'); return; }
      c[k].forEach((q, i) => {
        if (!q.id) e.push(`${k}[${i}] 缺少 id`);
        if (!['single', 'multi'].includes(q.type)) e.push(`${k}[${i}].type 只能是 single 或 multi`);
        if (!Array.isArray(q.options) || q.options.length < 2) e.push(`${k}[${i}] 至少要 2 個選項`);
      });
    });
    return e;
  }

  /* ---------- 問卷元件 ---------- */
  function question(q, name) {
    const box = mk('div', { 'data-q': q.id });
    box.append(mk('div', { class: 'q' }, q.text));
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
    return box;
  }
  function read(q, name) {
    const checked = Array.from(root.querySelectorAll(`input[name="${name}"]:checked`));
    const back = v => { const o = q.options.find(o => String(o.value) === v); return o ? o.value : v; };
    if (q.type === 'single') return checked.length ? back(checked[0].value) : null;
    return checked.map(x => back(x.value));
  }
  const answered = (q, v) => q.type === 'single' ? v != null : v.length > 0;

  /* ---------- 視角追蹤 ---------- */
  let track = null, tickLast = performance.now();
  (function tick() {
    const now = performance.now(), dt = now - tickLast; tickLast = now;
    if (track && gyro.on) track.gyroMs = (track.gyroMs || 0) + dt;
    if (track) {
      const y = deg(T.look.yaw), p = deg(T.look.pitch);
      if (track.py != null) track.path += Math.abs(y - track.py);
      track.py = y;
      track.yMin = Math.min(track.yMin, y); track.yMax = Math.max(track.yMax, y);
      track.pMin = Math.min(track.pMin, p); track.pMax = Math.max(track.pMax, p);
    }
    requestAnimationFrame(tick);
  })();

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
  /* 減輕暈眩：先原地轉向前進方向 → 平移（步行速度）→ 原地轉向最終視線；不同時轉向和平移 */
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  let moving = 0;   // 腳本移動中時，陀螺儀暫停接管視線
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
      const ms = Math.min(3200, Math.max(700, dist / 0.8 * 1000));   // 約 0.8 m/s
      await anim(ms, e => { c.x = f.x + dx * e; c.z = f.z + dz * e; T.setEye(f.y + (p.pos[1] - f.y) * e); });
    } else if (Math.abs(p.pos[1] - c.y) > 0.02) {
      const y0 = c.y; await anim(900, e => { T.setEye(y0 + (p.pos[1] - y0) * e); });
    }
    await turnTo(a.yaw, a.pitch);
  }

  /* 淡出 → 換位置 → 淡入（加測的停點切換用） */
  const fader = mk('div', { id: 'sx-fade', style: 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:24;transition:opacity .35s ease' });
  document.body.append(fader);
  async function cutTo(p, before) {
    const slow = !reduceMotion();
    fader.style.opacity = '1'; if (slow) await sleep(380);
    if (before) before();
    setPose(p);
    await sleep(120);
    fader.style.opacity = '0'; if (slow) await sleep(380);
  }

  /* ---------- 聲音（沖水、洗手） ---------- */
  let audio = null;
  function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; } }
  function sound(kind) {
    if (!audio) return;
    try {
      const dur = kind === 'flush' ? 2.6 : 1.8, n = Math.floor(audio.sampleRate * dur);
      const buf = audio.createBuffer(1, n, audio.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
      const src = audio.createBufferSource(); src.buffer = buf;
      const f = audio.createBiquadFilter(), g = audio.createGain(), now = audio.currentTime;
      if (kind === 'flush') {
        f.type = 'lowpass'; f.frequency.setValueAtTime(1800, now); f.frequency.exponentialRampToValueAtTime(300, now + dur);
        g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.35, now + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      } else {
        f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 0.7;
        g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.12, now + 0.1);
        g.gain.setValueAtTime(0.12, now + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      }
      src.connect(f).connect(g).connect(audio.destination); src.start();
    } catch (e) { /* 沒有聲音也能繼續 */ }
  }
  /* 動作做完才往下走：以門與玻璃的實際狀態為準，不靠固定秒數（低階手機畫面慢時也不會漏掉上鎖） */
  function until(cond, max) {
    return new Promise(res => { const t0 = performance.now(); (function chk() { if (cond() || performance.now() - t0 > max) res(); else requestAnimationFrame(chk); })(); });
  }
  async function doAction(b, a) {
    const A = T.ACTS, bt = T.booths[b];
    if (a === 'open') { A.open(b); await until(() => bt.st.open > 0.97, 8000); }
    else if (a === 'close') { A.close(b); await until(() => bt.st.open < 0.02, 8000); }
    else if (a === 'lock') {
      await until(() => bt.st.open < 0.02, 8000);
      A.lock(b);
      await until(() => bt.haze > 0.95, 10000);
    }
    else if (a === 'unlock') { A.unlock(b); await until(() => bt.haze < 0.05, 10000); }
    else if (a === 'flush' || a === 'wash') sound(a);
  }

  /* ---------- 場景狀態 ---------- */
  function resetBooths() {
    T.booths.forEach((bt, i) => { if (bt.simOcc) T.setSimOcc(i, false); bt.st.open = 0; bt.st.target = 0; bt.st.locked = false; });
    T.setExpMode(false); T.setWinter(false);   // 實際運作：玻璃跟著門鎖變化
  }

  /* ---------- 主流程 ---------- */
  let cfg, data, booth, time, other;

  fetch(cfgUrl, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(c => {
      const errs = validate(c);
      if (errs.length) { fatal(errs); return; }
      cfg = c;
      (T.labels || []).forEach(l => { l.visible = false; });   // 改用門旁圖示，隱藏數字標籤
      resetBooths(); T.setNight(false); T.setMode('orbit');
      cover.hidden = true;
      intro();
    })
    .catch(err => fatal([
      '無法讀取設定檔：' + err.message,
      '用電腦直接雙擊開啟（file://）時瀏覽器會擋住讀檔，請改用本機伺服器或 GitHub Pages 的網址。'
    ]));

  function intro() {
    const i = cfg.intro || {};
    const ok = mk('input', { type: 'checkbox', id: 'sx-consent' });
    const go = mk('button', { class: 'go', disabled: true }, i.start || '開始');
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    go.addEventListener('click', () => {
      unlockAudio();
      data = {
        pid: pid(), studyId: cfg.id, version: cfg.version || '',
        consentAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: null,
        ua: navigator.userAgent, screenW: screen.width, screenH: screen.height,
        priorRuns: getRuns(),
        scenes: [], final: {}
      };
      explore();
    });
    card({ title: i.title || cfg.id, full: true, expand: true },
      (i.body || []).map(t => mk('p', {}, t)),
      mk('div', { class: 'opts' }, mk('label', { class: 'opt', for: 'sx-consent' }, ok, mk('span', {}, i.consent || '我同意參加'))),
      mk('div', { class: 'row' }, mk('span', { class: 'meta' }, `v${cfg.version || '?'}`), go));
  }

  function explore() {
    const x = cfg.explore || {};
    resetBooths(); T.setNight(false); T.setNoClip(false); T.setEye(1.55);
    T.setVfovCap(85); T.setMode('orbit');
    const minD = T.controls.minDistance; T.controls.minDistance = 3.6;   // 只能繞外觀，不能鑽進去
    const t0 = performance.now();
    // 記錄告示牌「在視野中央附近、距離 6 m 內」的累計秒數，作為是否可能讀到說明的客觀指標
    let signMs = 0, last = t0, watching = true;
    const sp = new THREE.Vector3(), fw = new THREE.Vector3(), to = new THREE.Vector3();
    (function watch() {
      if (!watching) return;
      const now = performance.now(), dt = now - last; last = now;
      if (T.infoSign) {
        T.infoSign.getWorldPosition(sp); sp.y += 1.0;
        to.copy(sp).sub(T.camera.position); const d = to.length();
        T.camera.getWorldDirection(fw);
        if (d < 6 && fw.angleTo(to) < 0.42) signMs += dt;   // 約 ±24°
      }
      requestAnimationFrame(watch);
    })();
    const go = mk('button', { class: 'go' }, x.button || '開始作答');
    go.addEventListener('click', () => {
      watching = false;
      data.signSeenSec = +(signMs / 1000).toFixed(1);
      data.exploreSec = Math.round((performance.now() - t0) / 1000);
      T.controls.minDistance = minD;
      chooseBooth();
    });
    card({ title: x.title || '自由觀看', expand: true }, mk('p', {}, x.say || ''), mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), go));
  }

  function chooseBooth() {
    const bq = cfg.boothQuestion;
    const err = mk('div', { class: 'err' });
    const opts = mk('div', { class: 'opts icons', role: 'radiogroup' });
    bq.options.forEach((o, j) => {
      const inp = mk('input', { type: 'radio', name: 'sx-booth', value: o.value, id: 'sx-booth-' + j });
      opts.append(mk('label', { class: 'opt', for: 'sx-booth-' + j }, inp, icon(o.icon), mk('span', {}, o.label, o.ja ? mk('small', {}, o.ja) : null)));
    });
    const go = mk('button', { class: 'go' }, '確定');
    go.addEventListener('click', () => {
      const v = (root.querySelector('input[name="sx-booth"]:checked') || {}).value;
      if (!v) { err.textContent = '請選一間'; return; }
      booth = bq.options.find(o => o.value === v);
      const ts = shuffle(cfg.times);
      time = ts[0]; other = ts[1] || null;          // 隨機分配時段
      data.booth = booth.value; data.time = time.id; data.replay = 0;
      walk({ extra: 0, t: time }).then(replayAsk);
    });
    card({ title: bq.title || '選擇廁所', expand: true }, mk('div', { class: 'q' }, bq.text), opts, err, mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), go));
  }

  /* ---------- 視角：直拿為主，固定水平視角，垂直隨手機比例 ---------- */
  function viewCfg() {
    const v = cfg.view || {}, q = parseFloat(params.get('fov'));
    return { hfov: (q >= 40 && q <= 110) ? q : (v.hfov || 65), maxV: v.maxVfov || 125 };
  }
  function applyView() { const v = viewCfg(); T.setVfovCap(v.maxV); T.setHfov(v.hfov); }
  function viewInfo() {
    const c = T.camera, a = c.aspect || 1;
    const h = 2 * Math.atan(Math.tan(c.fov * Math.PI / 360) * a) * 180 / Math.PI;
    return { hfovSet: viewCfg().hfov, hfovActual: +h.toFixed(1), vfov: +c.fov.toFixed(1), orientation: a < 1 ? 'portrait' : 'landscape' };
  }

  /* ---------- 可選：轉動手機來看（陀螺儀） ----------
   * 只在可能運作的瀏覽器顯示；失敗時按鈕縮成小字「無法使用 ⓘ」，說明預設收起、點了才展開，不打斷流程。
   * gyroStatus：unused（沒按過）／ok（有收到資料）／denied（iPhone 不允許）／nodata（允許了但收不到，常見於內嵌頁面）／unsupported（瀏覽器不支援或為 App 內建瀏覽器）
   */
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
  #sx-gyro button:focus-visible{outline:2px solid var(--accent,#0f8f86);outline-offset:2px}
  #sx-gyro .tip{font:12px/1.55 var(--font-ui,sans-serif);color:var(--ink,#16222a);background:var(--glass,#f4f9faee);border:1px solid var(--glass-line,#0002);border-radius:10px;padding:8px 10px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}`;
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
    gyroBtn.textContent = '轉動手機：無法使用 ⓘ';
    gyroBtn.classList.add('off');
    gyroBtn.setAttribute('aria-expanded', 'false');
    gyroBtn.setAttribute('aria-controls', 'sx-gyro-tip');
    gyroTip.textContent = GYRO_MSG[kind] || GYRO_MSG.nodata;
    gyroTip.hidden = true;                      // 說明預設收起
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
    const t0 = performance.now();
    gyroSet(true);
    setTimeout(() => {                          // 1.5 秒內沒有新資料就判定無法使用
      if (!gyro.on) return;
      if (gyro.evAt > t0 - 200 && gyro.ev) gyro.status = 'ok';
      else gyroFail('nodata');
    }, 1500);
  }
  gyroBtn.addEventListener('click', () => {
    if (gyro.status === 'denied' || gyro.status === 'nodata') {   // 失敗後點按鈕只是展開／收起說明
      gyroTip.hidden = !gyroTip.hidden;
      gyroBtn.setAttribute('aria-expanded', String(!gyroTip.hidden));
      return;
    }
    if (gyro.on) { gyroSet(false); return; }
    try {
      if (DeviceOrientationEvent.requestPermission) {
        DeviceOrientationEvent.requestPermission()
          .then(r => { if (r === 'granted') gyroStart(); else gyroFail('denied'); })
          .catch(() => gyroFail('nodata'));
      } else gyroStart();
    } catch (e) { gyroFail('nodata'); }
  });
  // 手機姿態 → 視線（同 three.js DeviceOrientationControls 的換算，直拿時不會卡死）
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
      // 若手指拖曳或腳本改了視線，重新對準基準，不跳動
      if (gyro.lastY == null || Math.abs(wrap(T.look.yaw - gyro.lastY)) > 1e-4 || Math.abs(T.look.pitch - gyro.lastP) > 1e-4) {
        gyro.offY = wrap(T.look.yaw - d.y); gyro.offP = T.look.pitch - d.p;
      }
      T.look.yaw = wrap(d.y + gyro.offY);
      T.look.pitch = Math.max(-1.3, Math.min(1.3, d.p + gyro.offP));
      gyro.lastY = T.look.yaw; gyro.lastP = T.look.pitch;
    } else if (gyro.on) { gyro.lastY = null; }
    requestAnimationFrame(gyroLoop);
  })();

  /* 觀看 → 作答 → 回傳一筆紀錄 */
  function lookAndAsk(text, extra) {
    return new Promise(resolve => {
      const t0 = performance.now();
      collapseCount = 0;
      track = { py: null, path: 0, yMin: Infinity, yMax: -Infinity, pMin: Infinity, pMax: -Infinity };
      const min = (cfg.minViewSeconds || 0) * 1000;
      const meta = mk('span', { class: 'meta' }, '');
      const go = mk('button', { class: 'go', disabled: min > 0 }, '開始作答');
      go.addEventListener('click', () => ask(t0, extra, resolve));
      card({ title: extra.title }, mk('p', {}, text), mk('div', { class: 'row' }, meta, go));
      if (min > 0) {
        const iv = setInterval(() => {
          const left = Math.ceil((min - (performance.now() - t0)) / 1000);
          if (left <= 0) { clearInterval(iv); go.disabled = false; meta.textContent = ''; }
          else meta.textContent = `請先觀看 ${left} 秒`;
        }, 200);
      }
    });
  }

  function ask(t0, extra, resolve) {
    const tAsk = performance.now();
    const err = mk('div', { class: 'err' });
    const qs = cfg.sceneQuestions;
    const tag = `${extra.time}_${extra.checkpoint}`;
    const next = mk('button', { class: 'go' }, '繼續');
    next.addEventListener('click', () => {
      const ans = {}; let missing = 0;
      qs.forEach((q, i) => { ans[q.id] = read(q, `${tag}q${i}`); if (!answered(q, ans[q.id])) missing++; });
      if (missing) { err.textContent = '還有題目沒有作答'; return; }
      const tr = track; track = null;
      const rec = Object.assign({
        sceneId: `${extra.booth}-${extra.time}`, booth: extra.booth, time: extra.time,
        extra: extra.extra, checkpoint: extra.checkpoint,
        viewMs: Math.round(tAsk - t0), answerMs: Math.round(performance.now() - tAsk),
        yawRangeDeg: +(tr.yMax - tr.yMin).toFixed(1), pitchRangeDeg: +(tr.pMax - tr.pMin).toFixed(1), yawPathDeg: +tr.path.toFixed(1),
        collapseCount, gyroViewSec: +((tr.gyroMs || 0) / 1000).toFixed(1)
      }, viewInfo());
      qs.forEach(q => {
        if (q.type === 'single') rec[q.id] = ans[q.id];
        else q.options.forEach(o => { rec[`${q.id}_${o.value}`] = ans[q.id].includes(o.value) ? 1 : 0; });
      });
      data.scenes.push(rec);
      resolve(rec);
    });
    card({ title: extra.title, expand: true }, qs.map((q, i) => question(q, `${tag}q${i}`)), err, mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), next));
  }

  /* 使用流程。extra=0：正式（按鈕帶動移動、兩個作答點）；extra=1：加測（三個停點淡出淡入、作答一次） */
  function walk({ extra, t }) {
    return new Promise(async done => {
      const w = cfg.walkthroughs[booth.walk], b = w.booth, P = w.poses;
      const vars = { time: time.label, other: other ? other.label : '' };
      const title = `${booth.label}・${t.label}`;
      cover.hidden = false; cover.textContent = extra ? fill(cfg.replay.playing, vars) : title;
      root.replaceChildren();
      resetBooths(); T.setNight(!!t.night);
      T.setMode('walk'); T.setPinned(true); T.setNoClip(true); applyView(); gyroShow(true);
      setPose(P.start);
      await sleep(700);
      cover.hidden = true;
      top.replaceChildren(mk('span', {}, extra ? fill(cfg.replay.playing, vars) : title));
      const tStart = performance.now(), recs = [];
      const base = { booth: booth.value, time: t.id, extra, title };

      if (!extra) {
        for (const st of cfg.steps) {
          if (st.checkpoint) {
            recs.push(await lookAndAsk(st.say || '請轉頭看看四周，看完後按「開始作答」。', Object.assign({ checkpoint: st.id }, base)));
            continue;
          }
          await new Promise(go => {
            const btn = mk('button', { class: 'go' }, st.label);
            btn.addEventListener('click', () => { btn.disabled = true; go(); }, { once: true });
            card({ title }, st.say ? mk('p', {}, st.say) : null, mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), btn));
          });
          if (st.pose) await tweenPose(P[st.pose]);
          if (st.action) await doAction(b, st.action);
          if (st.wait) await sleep(st.wait);
        }
      } else {
        // 加測：三個停點，淡出淡入切換，正常速度，最後一站作答一次
        const stops = cfg.replay.stops, ttl = fill(cfg.replay.playing, vars);
        for (let j = 0; j < stops.length; j++) {
          const sp = stops[j];
          if (j > 0) await cutTo(P[sp.pose], () => { if (sp.doorClosed) T.booths[b].st.open = T.booths[b].st.target = 0; });
          if (sp.ask) { recs.push(await lookAndAsk(fill(sp.say, vars), Object.assign({ checkpoint: 'replay' }, base, { title: ttl }))); break; }
          const btn = mk('button', { class: 'go', disabled: !!sp.action }, '下一個');
          card({ title: ttl }, mk('p', {}, fill(sp.say, vars)), mk('div', { class: 'row' }, mk('span', { class: 'meta' }, `${j + 1} / ${stops.length}`), btn));
          if (sp.action) { await sleep(sp.delay || 0); await doAction(b, sp.action); await sleep(sp.wait || 0); btn.disabled = false; }
          await new Promise(go => btn.addEventListener('click', go, { once: true }));
        }
      }
      const flowSec = Math.round((performance.now() - tStart) / 1000);
      recs.forEach(r => { r.flowSec = flowSec; });
      T.setNoClip(false);
      top.replaceChildren();
      done();
    });
  }

  function replayAsk() {
    const r = cfg.replay;
    if (!r || !r.enabled || !other) { final(); return; }
    const vars = { time: time.label, other: other.label };
    const yes = mk('button', { class: 'go' }, fill(r.yes, vars));
    const no = mk('button', { class: 'go ghost' }, fill(r.no, vars));
    yes.addEventListener('click', () => { data.replay = 1; walk({ extra: 1, t: other }).then(final); });
    no.addEventListener('click', final);
    card({ title: fill(r.title, vars), expand: true }, mk('p', {}, fill(r.ask, vars)), mk('div', { class: 'row' }, no, yes));
  }

  function final() {
    top.replaceChildren();
    data.gyroUsed = gyro.used ? 1 : 0;
    data.gyroStatus = gyro.status;
    gyroSet(false); gyroShow(false);
    const qs = cfg.finalQuestions;
    const err = mk('div', { class: 'err' });
    const send = mk('button', { class: 'go' }, '送出');
    send.addEventListener('click', async () => {
      let missing = 0;
      qs.forEach((q, i) => { const v = read(q, `f${i}`); data.final[q.id] = q.type === 'multi' ? v.join('|') : v; if (!answered(q, v)) missing++; });
      if (missing) { err.textContent = '還有題目沒有作答'; return; }
      qs.forEach(q => { if (q.correct != null) data.final[q.id + '_ok'] = data.final[q.id] === q.correct ? 1 : 0; });
      data.finishedAt = new Date().toISOString();
      send.disabled = true; send.textContent = '送出中…';
      ending(await submit(data));
    });
    card({ title: cfg.finalIntro || '最後幾題', full: true, expand: true }, qs.map((q, i) => question(q, `f${i}`)), err, mk('div', { class: 'row' }, mk('span', { class: 'meta' }, ''), send));
  }

  async function submit(d) {
    try { localStorage.setItem('study-' + d.pid, JSON.stringify(d)); } catch (e) { /* 無法存就略過 */ }
    if (!cfg.endpoint) return { ok: false, reason: '未設定 endpoint' };
    const body = JSON.stringify(d);
    try {
      const r = await fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      const j = await r.json().catch(() => null);
      if (j && j.ok) return { ok: true };
      return { ok: false, reason: (j && j.error) || ('HTTP ' + r.status) };
    } catch (e) {
      try { await fetch(cfg.endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }); return { ok: true, unverified: true }; }
      catch (e2) { return { ok: false, reason: '網路錯誤' }; }
    }
  }

  /* ---------- 片尾：送出之後才播，不影響任何作答 ---------- */
  const runsKey = () => 'study-runs-' + (cfg && cfg.id);
  function getRuns() { try { return parseInt(localStorage.getItem(runsKey()) || '0', 10) || 0; } catch (e) { return 0; } }
  function addRun() { try { localStorage.setItem(runsKey(), String(getRuns() + 1)); } catch (e) { /* 略過 */ } }

  function ending(res) {
    addRun();
    const E = cfg.ending || {};
    const w = cfg.walkthroughs[booth.walk], bi = w.booth, bt = T.booths[bi];
    const fromNight = !!time.night;
    const vars = { booth: booth.label };

    // 字幕、上下黑邊、略過鈕
    const css = document.createElement('style');
    css.textContent = `
    .sx-bar{position:fixed;left:0;right:0;height:0;background:#000;z-index:26;transition:height 1.2s ease}
    .sx-bar.t{top:0}.sx-bar.b{bottom:0}.sx-bar.on{height:9vh}
    #sx-cap{position:fixed;left:0;right:0;bottom:calc(13vh + env(safe-area-inset-bottom,0px));z-index:27;text-align:center;padding:0 max(24px,env(safe-area-inset-left,0px));
      font:500 clamp(16px,4.4vw,22px)/1.7 var(--font-ui,sans-serif);letter-spacing:.06em;color:#fff;text-shadow:0 1px 6px #000a,0 0 2px #000;opacity:0;transition:opacity 1.1s ease;pointer-events:none;text-wrap:balance}
    #sx-cap.on{opacity:1}
    #sx-title{position:fixed;inset:0;z-index:27;display:grid;place-content:center;gap:10px;text-align:center;color:#fff;opacity:0;transition:opacity 1.6s ease;pointer-events:none;
      text-shadow:0 1px 8px #000b;padding:0 24px}
    #sx-title.on{opacity:1}
    #sx-title .t1{font:600 clamp(18px,5vw,26px)/1.4 var(--font-ui,sans-serif);letter-spacing:.08em}
    #sx-title .t2{font:400 12px/1.6 var(--font-data,monospace);letter-spacing:.14em;opacity:.85}
    #sx-title .t3{font:400 14px/1.6 var(--font-ui,sans-serif);letter-spacing:.2em;margin-top:14px}
    #sx-skip{position:fixed;top:calc(9vh + 10px + env(safe-area-inset-top,0px));right:calc(12px + env(safe-area-inset-right,0px));z-index:28;font:500 12px var(--font-ui,sans-serif);
      border:1px solid #fff6;border-radius:999px;padding:6px 12px;background:#0006;color:#fff;cursor:pointer}
    @media (prefers-reduced-motion:reduce){.sx-bar,#sx-cap,#sx-title{transition:none}}`;
    document.head.appendChild(css);
    const barT = mk('div', { class: 'sx-bar t' }), barB = mk('div', { class: 'sx-bar b' });
    const cap = mk('div', { id: 'sx-cap', 'aria-live': 'polite' });
    const ttl = mk('div', { id: 'sx-title' },
      mk('div', { class: 't1' }, E.title || ''), mk('div', { class: 't2' }, E.subtitle || ''), mk('div', { class: 't3' }, E.thanks || cfg.thanks || ''));
    let skipped = false;
    const skip = mk('button', { id: 'sx-skip', type: 'button' }, E.skip || '略過');
    skip.addEventListener('click', () => { skipped = true; skip.remove(); });
    document.body.append(barT, barB, cap, ttl, skip);

    const wait = ms => new Promise(r => { if (skipped) return r(); const t0 = performance.now(); (function chk() { if (skipped || performance.now() - t0 >= ms) r(); else setTimeout(chk, 50); })(); });
    const say = async (text, ms) => { if (skipped) return; cap.textContent = fill(text, vars); cap.classList.add('on'); await wait(ms); cap.classList.remove('on'); await wait(1100); };

    // 鏡頭：從隔間正前方慢慢退後、往旁邊繞，最後看向整棟
    const cx = bt.cx, ZF = 1.193;
    const path = u => {
      const r = 5 + 9 * u, th = 0.95 * u * (cx < 0 ? -1 : 1), cy = 1.55 + 3.2 * u;
      const ox = cx * (1 - u * 0.8);
      const tx = cx * (1 - u), ty = 1.25, tz = ZF * (1 - u) * 0.6;
      return { pos: [ox + Math.sin(th) * r, cy, ZF * 0.3 + Math.cos(th) * r], look: [tx, ty, tz] };
    };
    const camAt = u => setPose(path(u));
    function camRun(ms) {
      return new Promise(res => {
        const t0 = performance.now(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        (function step() {
          const t = (skipped || reduce) ? 1 : Math.min(1, (performance.now() - t0) / ms);
          camAt(t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
          if (t < 1) requestAnimationFrame(step); else res();
        })();
      });
    }
    function skyRun(ms) {
      return new Promise(res => {
        const t0 = performance.now();
        (function step() {
          const t = skipped ? 1 : Math.min(1, (performance.now() - t0) / ms);
          T.setDayMix(fromNight ? 1 - t : t);
          if (t < 1) requestAnimationFrame(step); else res();
        })();
      });
    }

    (async () => {
      root.replaceChildren(); top.replaceChildren();
      fader.style.opacity = '1'; await sleep(450);
      resetBooths(); T.setNight(fromNight); T.setDayMix(fromNight ? 1 : 0);
      T.setMode('walk'); T.setPinned(true); T.setNoClip(true); applyView(); gyroShow(false); gyroSet(false);
      camAt(0);                              // 先把鏡頭移到室外，才能讓別人「進去」
      T.setSimOcc(bi, true);                 // 你選的那間：有人在用，玻璃已霧
      await sleep(400);
      fader.style.opacity = '0';
      barT.classList.add('on'); barB.classList.add('on');
      await wait(1200);

      const caps = E.captions || [];
      const cam = camRun(E.cameraMs || 20000);
      await say(caps[0] || '', 3800);
      await say(caps[1] || '', 3800);
      const sky = skyRun(E.skyMs || 7000);
      await say((fromNight ? E.toDay : E.toNight) || '', 4200);
      await sky;
      T.setSimOcc(bi, false);                // 使用者離開，玻璃回到透明
      await say(caps[2] || '', 3800);
      await cam;

      cap.classList.remove('on'); skip.remove();
      ttl.classList.add('on');
      await wait(3600);
      skipped = true;                         // 之後都不等
      ttl.classList.remove('on');
      await sleep(600);
      debrief(res);
    })();
  }

  function debrief(res) {
    const D = (cfg.ending && cfg.ending.debrief) || {};
    const kids = (D.body || []).map(t => mk('p', {}, t));
    if (D.contact) {
      const addr = mk('span', { style: 'user-select:all;font:500 14px var(--font-data,monospace)' }, D.contact);
      const cp = mk('button', { class: 'go ghost', type: 'button', style: 'min-height:36px;padding:6px 12px;font-size:13px' }, '複製');
      cp.addEventListener('click', () => {
        if (navigator.clipboard) navigator.clipboard.writeText(D.contact).then(() => { cp.textContent = '已複製'; }, () => {});
      });
      kids.push(mk('div', { class: 'row', style: 'margin-top:4px' }, mk('span', {}, (D.contactLabel || '聯絡') + '：', addr), cp));
    }
    if (!res.ok) {
      kids.push(mk('p', { style: 'margin-top:12px' }, `資料沒有成功送出（${res.reason}）。請把下面的資料全選複製，寄給研究者。`));
      const ta = mk('textarea', { id: 'sx-raw', readonly: true, rows: 6, style: 'width:100%;box-sizing:border-box;font:11px var(--font-data,monospace)' });
      ta.value = JSON.stringify(data, null, 2);
      kids.push(ta);
    }
    const again = mk('button', { class: 'go', type: 'button' }, D.again || '重新再測一次');
    again.addEventListener('click', () => location.reload());
    kids.push(mk('div', { class: 'row' }, mk('span', { class: 'meta' }, '受試者代碼 ' + data.pid + (res.unverified ? '（未取得伺服器確認）' : '')), again));
    card({ title: D.title || '關於這個研究', expand: true }, ...kids);
  }
})();
