(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 备份导出 / 校验 / 恢复计划（核心为纯函数，可测试）
  const KEYS = ['books', 'entries', 'states', 'logs', 'daily', 'marks', 'groups', 'tests', 'settings'];
  VW.backup = {
    KEYS: KEYS,

    // 收集全量数据（调用方传入 repos）
    exportData: function (repos) {
      return Promise.all(KEYS.map(function (k) { return repos[k].list(); })).then(function (r) {
        const out = { app: 'vwordbook', version: 1, exportedAt: new Date().toISOString() };
        KEYS.forEach(function (k, i) { out[k] = r[i]; });
        return out;
      });
    },

    // 校验备份数据（纯函数）
    validate: function (data) {
      if (!data || typeof data !== 'object') return { ok: false, reason: '不是有效的备份文件' };
      if (data.app !== 'vwordbook') return { ok: false, reason: '不是本应用的备份文件' };
      for (let i = 0; i < KEYS.length; i++) {
        if (!Array.isArray(data[KEYS[i]])) return { ok: false, reason: '缺少数据段：' + KEYS[i] };
      }
      return { ok: true };
    },

    // 生成合并计划（调用方传入本地数据）
    planMerge: function (existing, incoming) {
      const exMap = new Map();
      (existing || {}).entries.forEach(function (e) { exMap.set(e.id, e); });
      const byId = function (arr) {
        const m = new Map();
        (arr || []).forEach(function (x) { m.set(x.id, x); });
        return m;
      };
      const mergeLists = function (exArr, inArr, key) {
        const m = byId(exArr);
        (inArr || []).forEach(function (x) { if (!m.has(x.id)) m.set(x.id, x); });
        return Array.from(m.values());
      };
      const out = {};
      out.books = mergeLists(existing.books, incoming.books);
      out.entries = mergeLists(existing.entries, incoming.entries).map(function (e) {
        const inc = byId(incoming.entries).get(e.id);
        const isEx = exMap.has(e.id);
        if (isEx && inc) return VW.importer.mergeDraft(e, inc);
        return e;
      });
      out.states = mergeLists(existing.states, incoming.states);
      out.logs = mergeLists(existing.logs, incoming.logs);
      out.daily = mergeLists(existing.daily, incoming.daily);
      out.marks = mergeLists(existing.marks, incoming.marks);
      out.groups = mergeLists(existing.groups, incoming.groups);
      out.tests = mergeLists(existing.tests, incoming.tests);
      // settings：本地为主，成就取并集，保留本地积分
      out.settings = mergeLists(existing.settings, incoming.settings).map(function (s) {
        const inc = byId(incoming.settings).get(s.id);
        const isEx = byId(existing.settings).has(s.id);
        if (isEx && inc) {
          const merged = Object.assign({}, s);
          const ach = new Set((s.achievements || []).concat(inc.achievements || []));
          merged.achievements = Array.from(ach);
          return merged;
        }
        return s;
      });
      return out;
    },

    // 执行恢复（调用方传入 repos 与本地数据）
    restore: function (repos, data, mode) {
      const v = VW.backup.validate(data);
      if (!v.ok) return Promise.reject(new Error(v.reason));
      const jobs = [];
      if (mode === 'overwrite') {
        KEYS.forEach(function (k) {
          jobs.push(repos[k].clear().then(function () {
            return repos[k].bulkSave(data[k] || []);
          }));
        });
        return Promise.all(jobs).then(function () {
          return { created: KEYS.reduce(function (n, k) { return n + (data[k] || []).length; }, 0) };
        });
      }
      return Promise.all(KEYS.map(function (k) { return repos[k].list(); })).then(function (r) {
        const existing = {};
        KEYS.forEach(function (k, i) { existing[k] = r[i]; });
        const plan = VW.backup.planMerge(existing, data);
        KEYS.forEach(function (k) {
          jobs.push(repos[k].bulkSave(plan[k]));
        });
        return Promise.all(jobs).then(function () {
          return { merged: KEYS.reduce(function (n, k) { return n + (plan[k] || []).length; }, 0) };
        });
      });
    }
  };
})();
