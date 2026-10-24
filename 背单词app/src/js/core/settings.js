(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  VW.settings = {
    DEFAULTS: {
      id: 'main',
      schemaVersion: 1,
      newPerDay: 20,          // 每日新词量
      reviewCap: 100,         // 每日复习上限
      dayStartHour: 4,        // 学习日边界（凌晨4点）
      intervals: [0, 1, 2, 4, 7, 15, 30], // stage 0..6 间隔（天）
      stubbornThreshold: 3,   // 错误次数达到该值进入顽固队列
      wrongExitStreak: 2,     // 错词本连对 N 次移出
      spellVerify: true,      // 拼写验证链开关
      targetDate: '',         // 目标日期 YYYY-MM-DD
      theme: 'system',        // light | dark | eye | system
      remind: true,           // 页面打开提醒条
      backupLastAt: 0,        // 上次备份时间戳
      defaultBookId: ''       // 学习时默认选中的词书
    },
    get: function () {
      const api = VW.store.api;
      if (!api) return Promise.resolve(Object.assign({}, VW.settings.DEFAULTS));
      return api.settings.get('main').then(function (doc) {
        return Object.assign({}, VW.settings.DEFAULTS, doc || {});
      });
    },
    save: function (patch) {
      const api = VW.store.api;
      if (!api) return Promise.reject(new Error('store 未初始化'));
      return VW.settings.get().then(function (cur) {
        const merged = Object.assign({}, cur, patch, { id: 'main' });
        return api.settings.save(merged);
      });
    }
  };
})();
