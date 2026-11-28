// 共用：頂部選單、下載（Claude 內與一般網站通用）、下載區顯示開關
(function () {
  var items = [['../../', '← tosaint'], ['index.html', '總覽'], ['arch.html', '虹橋拱'], ['grid.html', '互承網格'], ['mesh.html', '互承亭'], ['panel.html', '互鎖面板'], ['shell.html', '互鎖拱殼'], ['fold.html', '摺紙皮層']];
  var here = location.pathname.split('/').pop() || 'index.html'; if (here.indexOf('.html') < 0) here = 'index.html';
  var dev = false;   // 網站版不提供下載
  var css = document.createElement('style');
  css.textContent = '.rfnav{display:flex;gap:4px;align-items:center;padding:8px max(3vw,16px);border-bottom:1px solid var(--rule,#dcdcd5);background:var(--panel,#fff);overflow-x:auto;font:14px/1.3 "Noto Sans TC",system-ui,sans-serif}' +
    '.rfnav a{flex:none;padding:8px 12px;border-radius:8px;color:var(--ink,#1d1f1c);text-decoration:none;white-space:nowrap}.rfnav a[aria-current=page]{background:var(--ink,#1d1f1c);color:var(--bg,#f6f6f3);font-weight:700}' +
    '.rfnav a:focus-visible{outline:2px solid #2f6fd0;outline-offset:2px}.rfnav .soon{flex:none;padding:8px 12px;color:var(--quiet,#5d625b);white-space:nowrap}' + (dev ? '' : '.export{display:none!important}');
  document.head.appendChild(css);
  // ---- 與 tosaint.com 作品集一致：紙色、墨色、細線、等寬小標；主題與作品集共用 ----
  try { var th = localStorage.getItem('theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
  var fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&display=swap'; document.head.appendChild(fl);
  var site = document.createElement('style');
  site.textContent = ':root{--bg:light-dark(#f3f1ec,#141412);--panel:light-dark(#ebe8e1,#1b1a18);--ink:light-dark(#2b2a27,#e8e5de);--quiet:light-dark(#6f6b63,#9a968d);--rule:light-dark(#d9d5cc,#2c2b28)}' +
    ':root[data-theme=light]{color-scheme:light}:root[data-theme=dark]{color-scheme:dark}' +
    'h1{font-weight:600!important;letter-spacing:.04em}h2{font-weight:600!important}' +
    '.rfnav{background:var(--bg);gap:20px;padding:14px max(3vw,16px);align-items:baseline}' +
    '.rfnav a{font:400 12px "IBM Plex Mono","Noto Sans TC",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--quiet);padding:2px 0;border-radius:0}' +
    '.rfnav a:hover{color:var(--ink)}.rfnav a[aria-current=page]{background:none;color:var(--ink);font-weight:400;border-bottom:1px solid var(--ink)}' +
    '.rfnav .wk{margin-left:auto;flex:none;font:400 12px "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;color:var(--quiet);white-space:nowrap}' +
    '.card,a.card,.status,.seg button,.btn,.lock,select,.views button,.tools button,.legend,.hint,.tip,.prow button,.pdiff span,.chg,.tag{border-radius:2px!important}' +
    '.fig{background:var(--panel)!important}.pbar{background:var(--bg)!important}aside{background:var(--bg)}' +
    '.kpi b{font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:400}';
  document.head.appendChild(site);
  var nav = document.createElement('nav'); nav.className = 'rfnav'; nav.setAttribute('aria-label', '模式');
  items.forEach(function (it) { var a = document.createElement('a'); a.href = it[0] + (dev ? '#dev' : ''); a.textContent = it[1]; if (it[0] === here) a.setAttribute('aria-current', 'page'); nav.appendChild(a); });
  var wk = document.createElement('span'); wk.className = 'wk'; wk.textContent = 'WORK 009 · 2026'; nav.appendChild(wk);
  document.body.insertBefore(nav, document.body.firstChild);
  window.RF = {
    dev: dev,
    // Claude 裡用平台的下載功能；自己的網站上用瀏覽器一般下載
    getDownloads: function () {
      if (window.claude && window.claude.use) return window.claude.use('downloads');
      return Promise.resolve({ save: function (o) {
        var blob = o.data instanceof Blob ? o.data : new Blob([o.data]), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = o.filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        return Promise.resolve({ status: 'saved' });
      } });
    }
  };
})();

// ===== 手機版面：模擬器固定在上方，參數分頁放在下方（六個模式共用）=====
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.rftabs{display:none}' +
    // 直拿：模擬器黏在上半部，分頁列黏在它下面，參數在下面捲
    'html.rf-m main{display:flex!important;flex-direction:column;align-items:stretch!important;padding-bottom:40svh}html.rf-m .stage{display:contents}' +
    'html.rf-m .stage>*{order:5}html.rf-m .stage>.fig{order:1;position:sticky;top:0;z-index:20;height:45vh!important;height:max(240px,45svh)!important;min-height:0!important;box-shadow:0 1px 0 var(--rule)}' +
    'html.rf-m aside{position:static!important;max-height:none!important;overflow:visible!important;border-right:0!important;padding-top:0!important}' +
    'html.rf-m .stage>.pbar{order:4}html.rf-m main>.rftabs{order:2;position:sticky;top:45vh;top:max(240px,45svh);z-index:19}html.rf-m aside{order:3}' +
    'html.rf-m .fig .tools,html.rf-m .fig .views,html.rf-l .fig .tools,html.rf-l .fig .views{flex-wrap:nowrap!important;max-width:calc(100% - 16px);overflow-x:auto;scrollbar-width:none}html.rf-m .fig .tools button,html.rf-m .fig .views button,html.rf-l .fig .tools button,html.rf-l .fig .views button{flex:none;min-height:34px;padding:0 9px;font-size:13px}' +
    // 橫拿：左邊模擬器（整個高度），右邊參數自己捲
    'html.rf-l main{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(260px,40%)!important}html.rf-l .stage{order:1}' +
    'html.rf-l .stage>.fig{position:sticky;top:0;height:100vh!important;height:100svh!important;min-height:0!important}' +
    'html.rf-l aside{order:2;position:sticky!important;top:0;max-height:100svh!important;overflow:auto!important;border-right:0!important;border-left:1px solid var(--rule);padding-top:0!important}' +
    'html.rf-l aside>.pbar{margin:0 calc(-1 * max(1.5vw,14px));border:0}html.rf-l aside>.rftabs{position:sticky;top:0;z-index:5;margin:0 calc(-1 * max(1.5vw,14px)) 4px}' +
    'html.rf-m .rftabs,html.rf-l .rftabs{display:flex;gap:4px;overflow-x:auto;padding:6px max(1.5vw,14px);background:var(--bg);border-bottom:1px solid var(--rule);scrollbar-width:none}' +
    '.rftabs button{flex:none;font:inherit;font-size:14px;min-height:38px;padding:0 12px;border:1px solid var(--rule);border-radius:2px;background:var(--panel);color:var(--ink);white-space:nowrap;cursor:pointer}' +
    '.rftabs button[aria-selected=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}.rftabs button:focus-visible{outline:2px solid #2f6fd0;outline-offset:2px}' +
    'html.rf-m aside>fieldset.rfoff,html.rf-l aside>fieldset.rfoff,html.rf-m .pbar.rfoff,html.rf-l .pbar.rfoff{display:none!important}' +
    'html.rf-m aside fieldset,html.rf-l aside fieldset{border-bottom:0}html.rf-m .legend,html.rf-l .legend{display:none}';
  document.head.appendChild(css);
  var mqM = matchMedia('(max-width:900px) and (orientation:portrait), (max-width:600px)'), mqL = matchMedia('(max-height:560px) and (orientation:landscape) and (pointer:coarse)');
  var here = location.pathname.split('/').pop() || 'index';
  function setup() {
    var aside = document.querySelector('main>aside'), fig = document.querySelector('.stage>.fig'); if (!aside || !fig) return;
    // 分頁：每個 fieldset 一頁；沒有標題的併到前一頁；有範例列就多一頁「範例」
    var groups = [];
    [].forEach.call(aside.querySelectorAll(':scope>fieldset'), function (f) {
      var lg = f.querySelector('legend'), t = lg ? lg.textContent.replace(/（.*$/, '').trim() : '';
      if (t && t.length > 7) t = t.slice(0, 7);
      if (!t && groups.length) groups[groups.length - 1].els.push(f); else groups.push({ name: t || '參數', els: [f] });
    });
    var tabs = document.createElement('div'); tabs.className = 'rftabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '參數分頁');
    aside.parentNode.insertBefore(tabs, aside);
    var PB = document.querySelector('.pbar'); function pbar() { return PB; }
    var key = 'rf-tab-' + here, cur = null; try { cur = localStorage.getItem(key); } catch (e) {}
    function render() {
      var list = (pbar() ? [{ name: '範例', els: [] }] : []).concat(groups);
      tabs.innerHTML = list.map(function (g, i) { return '<button role="tab" data-i="' + i + '">' + g.name + '</button>'; }).join('');
      return list;
    }
    var list = render();
    function show(name, scroll) {
      var g = list.filter(function (x) { return x.name === name && x.els.every(function (f) { return f.style.display !== 'none'; }); })[0] || list[0];
      cur = g.name; try { localStorage.setItem(key, cur); } catch (e) {}
      groups.forEach(function (x) { x.els.forEach(function (f) { f.classList.toggle('rfoff', x !== g); }); });
      var pb = pbar(); if (pb) pb.classList.toggle('rfoff', g.name !== '範例');
      [].forEach.call(tabs.children, function (b) { var on = list[+b.dataset.i] === g; b.setAttribute('aria-selected', on); if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
      if (scroll && document.documentElement.classList.contains('rf-m')) {
        // 讓參數頁的開頭剛好在分頁列下面
        var y = aside.getBoundingClientRect().top + scrollY - fig.offsetHeight - tabs.offsetHeight; if (scrollY > y + 2) scrollTo(0, y);
      }
    }
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(list[+b.dataset.i].name, true); });
    // 頁面自己藏起來的 fieldset，分頁按鈕也藏起來
    var sync = function () { [].forEach.call(tabs.children, function (b) { var g = list[+b.dataset.i]; b.hidden = g.els.length > 0 && g.els.every(function (f) { return f.style.display === 'none'; }); }); };
    new MutationObserver(sync).observe(aside, { attributes: true, subtree: true, attributeFilter: ['style'] }); sync();
    var apply = function () {
      var m = mqM.matches && !mqL.matches, l = mqL.matches, r = document.documentElement;
      r.classList.toggle('rf-m', m); r.classList.toggle('rf-l', l);
      if (l) aside.insertBefore(tabs, aside.firstChild); else aside.parentNode.insertBefore(tabs, aside);
      if (PB) { if (l) aside.insertBefore(PB, tabs.nextSibling); else if (PB.parentNode !== fig.parentNode) fig.parentNode.insertBefore(PB, fig); }
      if (m || l) show(cur || list[0].name, false);
      else { groups.forEach(function (x) { x.els.forEach(function (f) { f.classList.remove('rfoff'); }); }); var pb = pbar(); if (pb) pb.classList.remove('rfoff'); }
      dispatchEvent(new Event('resize'));
    };
    [mqM, mqL].forEach(function (q) { q.addEventListener ? q.addEventListener('change', apply) : q.addListener(apply); }); apply();
    // 外部要切到某一頁（例如日晷開啟後）
    window.RF.showTab = function (name) { if (document.documentElement.classList.contains('rf-m') || document.documentElement.classList.contains('rf-l')) show(name, true); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
