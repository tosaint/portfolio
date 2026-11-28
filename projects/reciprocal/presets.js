// 共用範例列：每個範例是一串「對控制項的操作」，套用在預設值之上。
// 用法：window.RF_PRESETS = { key: 'localStorage 鍵', list: [{ g, id, name, note, do: [[種類, 目標, 值], ...] }] }
// 種類：range（滑桿 id）、seg（按鈕群的選擇器，值＝按鈕的 data-* 值）、check（核取方塊 id）、select（下拉 id）、click（選擇器）
(function () {
  var cfg = window.RF_PRESETS; if (!cfg) return;
  var css = document.createElement('style');
  css.textContent = '.pbar{padding:10px max(2vw,14px) 8px;border-bottom:1px solid var(--rule,#dcdcd5);background:var(--panel,#fff)}' +
    '.pchips{display:flex;flex-direction:column;gap:6px}.prow{display:flex;gap:6px;align-items:center;overflow-x:auto;padding-bottom:2px}' +
    '.prow .plab{flex:none;width:2.4em;font-size:13px;color:var(--quiet,#5d625b)}' +
    '.prow button{flex:none;white-space:nowrap;font:inherit;font-size:14px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--rule,#dcdcd5);background:var(--bg,#f6f6f3);color:var(--ink,#1d1f1c);cursor:pointer}' +
    '.prow button[aria-pressed=true]{background:var(--ink,#1d1f1c);color:var(--bg,#f6f6f3);border-color:var(--ink,#1d1f1c)}.prow button:focus-visible{outline:2px solid #2f6fd0;outline-offset:2px}' +
    '#pnote{margin:8px 0 0;font-size:14px;max-width:90ch}#pnote b{font-weight:700}.pdiff{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    '.pdiff span{font-size:13px;border:1px solid rgba(47,111,208,.45);background:rgba(47,111,208,.1);border-radius:6px;padding:2px 8px;font-variant-numeric:tabular-nums}' +
    '.chg{background:rgba(47,111,208,.12);border-radius:6px;box-shadow:0 0 0 3px rgba(47,111,208,.12)}.chg>label{color:#2f6fd0!important;font-weight:700}';
  document.head.appendChild(css);
  var bar = document.createElement('div'); bar.className = 'pbar';
  var groups = []; cfg.list.forEach(function (p) { if (groups.indexOf(p.g || '範例') < 0) groups.push(p.g || '範例'); });
  bar.innerHTML = '<div class="pchips" role="group" aria-label="範例">' + groups.map(function (g) {
    return '<div class="prow"><span class="plab">' + g + '</span>' + cfg.list.filter(function (p) { return (p.g || '範例') === g; }).map(function (p) { return '<button data-p="' + p.id + '" aria-pressed="false">' + p.name + '</button>'; }).join('') + '</div>';
  }).join('') + '</div><div id="pnote" aria-live="polite">按一個範例，看它改了哪些參數、造型怎麼跟著變。被改動的參數會標出來。</div>';
  var fig = document.querySelector('.fig'); if (!fig) return; fig.parentNode.insertBefore(bar, fig);
  var dev = /dev/.test(location.hash);
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-p]'); if (!b) return;
    try { localStorage.removeItem(cfg.key); } catch (err) {}
    location.hash = (dev ? 'dev&' : '') + 'p=' + b.dataset.p; location.reload();
  });
  var m = /p=([\w-]+)/.exec(location.hash), pr = m && cfg.list.filter(function (p) { return p.id === m[1]; })[0];
  if (!pr) return;
  try { localStorage.removeItem(cfg.key); } catch (err) {}
  var fire = function (el, types) { types.forEach(function (t) { el.dispatchEvent(new Event(t, { bubbles: true })); }); };
  var rowOf = function (el) { return el.closest('.row') || el.closest('label') || el; };
  var labelOf = function (el) { var r = el.closest('.row'), l = r && r.querySelector('label'); return l ? l.textContent.trim() : (el.getAttribute('aria-label') || el.id); };
  var outOf = function (el) { var o = document.getElementById(el.id + '_o'); return o && o.textContent ? o.textContent : el.value; };
  function run() {
    var diffs = [];
    (pr.do || []).forEach(function (a) {
      var kind = a[0], tgt = a[1], val = a[2], el;
      if (kind === 'range') { el = document.getElementById(tgt); if (!el) return; var b0 = outOf(el), v0 = el.value; el.value = val; fire(el, ['input', 'change']); if (el.value === v0) return; rowOf(el).classList.add('chg'); diffs.push((a[3] || labelOf(el)) + ' ' + (outOf(el) !== b0 ? b0 + ' → ' + outOf(el) : v0 + ' → ' + el.value)); }
      else if (kind === 'seg') { el = document.querySelector(tgt); if (!el) return; var cur = el.querySelector('[aria-pressed=true]'), btn = [].filter.call(el.querySelectorAll('button'), function (x) { return Object.keys(x.dataset).some(function (k) { return x.dataset[k] === String(val); }); })[0]; if (!btn || btn === cur) return; btn.click(); el.classList.add('chg'); diffs.push((el.getAttribute('aria-label') || '') + ' ' + (cur ? cur.textContent.trim() : '') + ' → ' + btn.textContent.trim()); }
      else if (kind === 'check') { el = document.getElementById(tgt); if (!el || el.checked === val) return; el.checked = val; fire(el, ['input', 'change']); rowOf(el).classList.add('chg'); diffs.push(rowOf(el).textContent.trim().slice(0, 14) + ' ' + (val ? '開' : '關')); }
      else if (kind === 'select') { el = document.getElementById(tgt); if (!el) return; var t0 = el.selectedOptions[0] ? el.selectedOptions[0].textContent : ''; el.value = val; fire(el, ['input', 'change']); rowOf(el).classList.add('chg'); diffs.push(labelOf(el) + ' ' + t0 + ' → ' + (el.selectedOptions[0] ? el.selectedOptions[0].textContent : val)); }
      else if (kind === 'click') { el = document.querySelector(tgt); if (el) el.click(); }
    });
    [].forEach.call(bar.querySelectorAll('button[data-p]'), function (b) { b.setAttribute('aria-pressed', b.dataset.p === pr.id); });
    document.getElementById('pnote').innerHTML = '<b>' + pr.name + '</b>　' + pr.note + (diffs.length ? '<div class="pdiff">' + diffs.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' : '');
  }
  // 等頁面自己的程式跑完第一次再套用
  window.addEventListener('load', function () { setTimeout(run, 500); });
})();
