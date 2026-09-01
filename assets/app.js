/* ============================================================
   方案 X · 视觉壳交互（纯手写 JS，不引库）
   - 色温控制台（4 档，data-temp + localStorage 前缀 vc-x-）
   - 明暗切换（data-theme + localStorage）
   - 侧边栏 / 目录面板折叠（TRAE 式 + rail 展开）
   - 右侧目录锚点高亮（滚动到视口顶部的标题高亮）
   所有逻辑用 try/catch 包裹，避免任何环境下的 console 报错。
   ============================================================ */
(function () {
  'use strict';
  var root = document.documentElement;
  var STORE = {
    temp: 'vc-x-temp',
    theme: 'vc-x-theme'
  };

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* 无存储环境静默降级 */ }
  }

  /* ---------- 初始化 data-temp / data-theme ---------- */
  function init() {
    var savedTemp = read(STORE.temp);
    var savedTheme = read(STORE.theme);
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-temp', savedTemp || 'cool');
    root.setAttribute('data-theme', savedTheme || (prefersDark ? 'dark' : 'light'));
    syncCtl();
  }

  /* ---------- 色温控制台按钮高亮 ---------- */
  function syncCtl() {
    var cur = root.getAttribute('data-temp');
    document.querySelectorAll('.temp-ctl button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-t') === cur);
    });
  }

  /* ---------- 绑定色温按钮 ---------- */
  function bindTemp() {
    document.querySelectorAll('.temp-ctl button').forEach(function (b) {
      b.addEventListener('click', function () {
        root.setAttribute('data-temp', b.getAttribute('data-t'));
        write(STORE.temp, b.getAttribute('data-t'));
        syncCtl();
      });
    });
  }

  /* ---------- 绑定明暗 toggle ---------- */
  function bindTheme() {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        write(STORE.theme, next);
      });
    });
  }

  /* ---------- 面板折叠 / rail 展开 ---------- */
  function bindPanel(panelSel, railSel) {
    var panel = document.querySelector(panelSel);
    var rail = document.querySelector(railSel);
    if (!panel) return;
    panel.querySelectorAll('.panel-toggle').forEach(function (t) {
      t.addEventListener('click', function () { panel.classList.add('collapsed'); });
    });
    if (rail) {
      rail.addEventListener('click', function () { panel.classList.remove('collapsed'); });
    }
  }

  /* ---------- 右侧目录滚动高亮 ---------- */
  function bindToc() {
    var toc = document.querySelector('.toc');
    if (!toc) return;
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var heads = [];
    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) heads.push({ link: a, el: el });
    });
    if (!heads.length) return;

    function setActive(link) {
      links.forEach(function (a) { a.classList.remove('active'); });
      link.classList.add('active');
    }
    // 点击目录 → 平滑滚动并立即高亮
    links.forEach(function (a) {
      a.addEventListener('click', function () { setActive(a); });
    });
    // 滚动监听：标记最接近视口顶部的标题
    function onScroll() {
      var mark = heads[0];
      heads.forEach(function (h) {
        if (h.el.getBoundingClientRect().top <= 90) mark = h;
      });
      setActive(mark.link);
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () { onScroll(); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
  }

  function bindNavDD() {
    document.addEventListener('click', function (e) {
      var dd = e.target.closest('.nav-dd');
      var btn = e.target.closest('.nav-dd-btn');
      var open = document.querySelectorAll('.nav-dd.open');
      if (btn) {
        open.forEach(function (m) { if (m !== dd) { m.classList.remove('open'); m.querySelector('.nav-dd-btn').setAttribute('aria-expanded', 'false'); } });
        dd.classList.toggle('open');
        dd.querySelector('.nav-dd-btn').setAttribute('aria-expanded', dd.classList.contains('open') ? 'true' : 'false');
      } else {
        open.forEach(function (m) { m.classList.remove('open'); m.querySelector('.nav-dd-btn').setAttribute('aria-expanded', 'false'); });
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.querySelectorAll('.nav-dd.open').forEach(function (m) { m.classList.remove('open'); m.querySelector('.nav-dd-btn').setAttribute('aria-expanded', 'false'); });
    });
  }

  init();
  bindTemp();
  bindTheme();
  bindPanel('.sidebar', '.rail-left');
  bindPanel('.toc', '.rail-right');
  bindToc();
  bindNavDD();
})();