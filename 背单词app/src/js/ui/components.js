(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // UI 基础：页面注册表与通用组件
  VW.ui = VW.ui || {};
  VW.ui.pages = VW.ui.pages || {};
  VW.ui.registerPage = function (route, def) { VW.ui.pages[route] = def; };

  // 从 HTML 字符串创建元素
  VW.ui.el = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  // Toast 提示
  VW.ui.toast = function (msg, type) {
    const root = document.getElementById('toastRoot');
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  };

  // 确认弹窗，返回 Promise<boolean>
  VW.ui.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const mask = VW.ui.el('<div class="modal-mask"></div>');
      const modal = VW.ui.el('<div class="modal" style="max-width:420px"></div>');
      modal.innerHTML =
        '<div class="modal-head"><span>' + VW.util.escapeHtml(opts.title || '确认') + '</span></div>' +
        '<div class="modal-body">' + VW.util.escapeHtml(opts.message || '确定要执行此操作吗？') + '</div>' +
        '<div class="modal-foot">' +
        '<button class="btn ghost" data-a="cancel">取消</button>' +
        '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" data-a="ok">' + VW.util.escapeHtml(opts.okText || '确定') + '</button>' +
        '</div>';
      mask.appendChild(modal);
      function close(val) { mask.remove(); resolve(val); }
      modal.querySelector('[data-a=cancel]').onclick = function () { close(false); };
      modal.querySelector('[data-a=ok]').onclick = function () { close(true); };
      mask.onclick = function (e) { if (e.target === mask) close(false); };
      document.getElementById('modalRoot').appendChild(mask);
    });
  };

  // 通用弹窗：opts = {title, body(el|html), lg, onClose}
  VW.ui.openModal = function (opts) {
    const mask = VW.ui.el('<div class="modal-mask"></div>');
    const modal = VW.ui.el('<div class="modal' + (opts.lg ? ' lg' : '') + '"></div>');
    const head = VW.ui.el('<div class="modal-head"><span></span><span class="modal-x">✕</span></div>');
    head.querySelector('span').textContent = opts.title || '';
    const body = VW.ui.el('<div class="modal-body"></div>');
    const foot = VW.ui.el('<div class="modal-foot"></div>');
    modal.appendChild(head);
    modal.appendChild(body);
    modal.appendChild(foot);
    mask.appendChild(modal);
    const api = {
      body: body,
      foot: foot,
      close: function () { mask.remove(); if (opts.onClose) opts.onClose(); }
    };
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    if (opts.buttons && opts.buttons.length) {
      opts.buttons.forEach(function (b) {
        const btn = VW.ui.el('<button class="btn ' + (b.cls || '') + '"></button>');
        btn.textContent = b.text;
        btn.onclick = function () { if (!b.onClick || b.onClick(api) !== false) { if (b.close !== false) api.close(); } };
        foot.appendChild(btn);
      });
    }
    head.querySelector('.modal-x').onclick = api.close;
    mask.onclick = function (e) { if (e.target === mask && opts.dismissable !== false) api.close(); };
    document.getElementById('modalRoot').appendChild(mask);
    return api;
  };

  VW.ui.progress = function (pct, cls) {
    const p = VW.ui.el('<div class="progress ' + (cls || '') + '"><i></i></div>');
    p.querySelector('i').style.width = VW.util.clamp(pct, 0, 100) + '%';
    return p;
  };
  VW.ui.chip = function (text, cls) {
    const c = VW.ui.el('<span class="chip ' + (cls || '') + '"></span>');
    c.textContent = text;
    return c;
  };
  VW.ui.empty = function (text) {
    return VW.ui.el('<div class="empty">' + VW.util.escapeHtml(text || '暂无数据') + '</div>');
  };
  VW.ui.fmtDate = function (dateStr) {
    if (!dateStr) return '';
    const p = String(dateStr).split('-').map(Number);
    if (p.length < 3) return dateStr;
    return p[1] + '月' + p[2] + '日';
  };
  VW.ui.fmtNum = function (n) { return String(n == null ? 0 : n); };
})();
