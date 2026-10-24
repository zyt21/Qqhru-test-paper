(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.util = {
    // 词条主键归一化：小写、去首尾空格
    normalizeKey: function (sp) { return String(sp == null ? '' : sp).trim().toLowerCase(); },
    // 本地日期键 YYYY-MM-DD；学习日以 dayStartHour 为界（默认凌晨4点）
    dateKey: function (d, dayStartHour) {
      d = d || new Date();
      const h = (dayStartHour == null ? 4 : dayStartHour);
      const dt = new Date(d.getTime());
      if (dt.getHours() < h) dt.setDate(dt.getDate() - 1);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    },
    todayStr: function (dayStartHour) { return VW.util.dateKey(new Date(), dayStartHour); },
    // 日期字符串加减天数，返回 YYYY-MM-DD
    addDays: function (dateStr, n) {
      const p = String(dateStr).split('-').map(Number);
      const dt = new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
      dt.setDate(dt.getDate() + n);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    },
    // 两个 YYYY-MM-DD 相差天数（b - a）
    diffDays: function (a, b) {
      const pa = String(a).split('-').map(Number), pb = String(b).split('-').map(Number);
      const da = new Date(pa[0], pa[1] - 1, pa[2]);
      const db = new Date(pb[0], pb[1] - 1, pb[2]);
      return Math.round((db - da) / 86400000);
    },
    uid: function () {
      if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    },
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    escapeHtml: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    // 种子随机（rng() 返回 [0,1)）
    makeRng: function (seed) {
      let s = (seed == null ? Date.now() : seed) >>> 0;
      return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    },
    shuffle: function (arr, rng) {
      rng = rng || Math.random;
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    // 编辑距离（用于形近词推荐）
    lev: function (a, b) {
      a = String(a || ''); b = String(b || '');
      const m = a.length, n = b.length;
      if (!m) return n; if (!n) return m;
      const dp = [];
      for (let i = 0; i <= m; i++) { dp[i] = [i]; }
      for (let j = 0; j <= n; j++) { dp[0][j] = j; }
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
      }
      return dp[m][n];
    },

    // 词条是否属于某词书（bookId 主归属 + bookIds 多归属）
    inBook: function (e, bookId) {
      return !!e && (e.bookId === bookId || (Array.isArray(e.bookIds) && e.bookIds.indexOf(bookId) >= 0));
    },

    // 两个词条是否共享任意词书
    sharesBook: function (a, b) {
      if (!a || !b) return false;
      const set = new Set();
      if (a.bookId) set.add(a.bookId);
      (a.bookIds || []).forEach(function (x) { set.add(x); });
      if (b.bookId && set.has(b.bookId)) return true;
      return (b.bookIds || []).some(function (x) { return set.has(x); });
    }
  };
})();
