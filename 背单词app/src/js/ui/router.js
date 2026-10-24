(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui = VW.ui || {};
  VW.ui.pages = VW.ui.pages || {};

  const ROUTES = ['home', 'study', 'books', 'wrong', 'test', 'stats', 'dict', 'settings'];
  const TITLES = { home: '首页', study: '学习', books: '词书', wrong: '错词', test: '测评', stats: '统计', dict: '词典', settings: '设置' };
  const ICONS = { home: '🏠', study: '📖', books: '📚', wrong: '❌', test: '📝', stats: '📊', dict: '🔍', settings: '⚙️' };
  const MOBILE_MAIN = ['home', 'study', 'books', 'wrong', 'stats'];
  const MOBILE_MORE = ['test', 'dict', 'settings'];

  VW.ui.NAV = { routes: ROUTES, titles: TITLES, icons: ICONS, mobileMain: MOBILE_MAIN, mobileMore: MOBILE_MORE };

  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(h) >= 0 ? h : 'home';
  }
  VW.ui.currentRoute = currentRoute;
  VW.ui.query = function () {
    const q = location.hash.split('?')[1] || '';
    const out = {};
    q.split('&').forEach(function (kv) {
      if (!kv) return;
      const i = kv.indexOf('=');
      if (i >= 0) out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      else out[decodeURIComponent(kv)] = true;
    });
    return out;
  };

  VW.ui.renderRoute = function () {
    const route = currentRoute();
    const def = VW.ui.pages[route];
    document.getElementById('pageTitle').textContent = (def && def.title) || TITLES[route] || '';
    const content = document.getElementById('content');
    content.innerHTML = '';
    if (def && def.render) def.render(content);
    else content.innerHTML = '<div class="page-placeholder">该页面尚未实现</div>';
    document.querySelectorAll('#sideNav a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === route);
    });
    document.querySelectorAll('#bottombar a[data-route]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === route);
    });
    window.scrollTo(0, 0);
  };

  function navLink(route, cls) {
    const a = document.createElement('a');
    a.href = '#/' + route;
    a.dataset.route = route;
    a.className = cls || '';
    a.innerHTML = '<span class="nav-ico">' + ICONS[route] + '</span><span>' + TITLES[route] + '</span>';
    return a;
  }

  function buildNav() {
    const side = document.getElementById('sideNav');
    side.innerHTML = '';
    ROUTES.forEach(function (r) { side.appendChild(navLink(r)); });

    const bb = document.getElementById('bottombar');
    bb.innerHTML = '';
    MOBILE_MAIN.forEach(function (r) { bb.appendChild(navLink(r)); });
    const more = document.createElement('a');
    more.href = '#';
    more.innerHTML = '<span class="nav-ico">⋯</span><span>更多</span>';
    more.onclick = function (e) {
      e.preventDefault();
      const body = VW.ui.el('<div></div>');
      MOBILE_MORE.forEach(function (r) {
        const b = VW.ui.el('<button class="btn btn-block" style="margin-bottom:8px"></button>');
        b.innerHTML = ICONS[r] + ' ' + TITLES[r];
        b.onclick = function () { location.hash = '#/' + r; m.close(); };
        body.appendChild(b);
      });
      const m = VW.ui.openModal({ title: '更多功能', body: body });
    };
    bb.appendChild(more);

    document.getElementById('menuBtn').onclick = function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      VW.ui.toast('点击底部导航切换页面');
    };
  }

  VW.ui.applyTheme = function () {
    return VW.settings.get().then(function (s) {
      let t = s.theme || 'system';
      if (t === 'system') {
        t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      document.documentElement.dataset.theme = t;
      return t;
    });
  };

  VW.boot = function () {
    if (/selftest/.test(location.search)) return Promise.resolve(); // 自检页跳过应用启动
    buildNav();
    return VW.db.open()
      .then(function (ad) { return VW.migrate.run(ad).then(function () { return ad; }); })
      .then(function (ad) { return VW.store.init(ad); })
      .then(function () { return VW.ui.applyTheme(); })
      .then(function () { return VW.seed.ensure(); })
      .then(function (seeded) {
        if (seeded) VW.ui.toast('已载入内置示例词书', 'ok');
        return VW.seedCET4 ? VW.seedCET4.ensure() : false;
      })
      .then(function (seededCET4) {
        if (seededCET4) VW.ui.toast('已载入四级词书（1500核心词 + 1000高频词）', 'ok');
      })
      .catch(function (e) {
        console.error('[boot]', e);
        VW.ui.toast('启动失败：' + e.message, 'err');
      })
      .then(function () {
        VW.ui.renderRoute();
        window.addEventListener('hashchange', VW.ui.renderRoute);
      });
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', VW.boot);
    } else {
      VW.boot();
    }
  }
})();
