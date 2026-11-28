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
  var nav = document.createElement('nav'); nav.className = 'rfnav'; nav.setAttribute('aria-label', '模式');
  items.forEach(function (it) { var a = document.createElement('a'); a.href = it[0] + (dev ? '#dev' : ''); a.textContent = it[1]; if (it[0] === here) a.setAttribute('aria-current', 'page'); nav.appendChild(a); });
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
