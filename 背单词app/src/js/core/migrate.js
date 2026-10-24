(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // schema 版本迁移：settings 文档中的 schemaVersion 记录当前版本
  VW.migrate = {
    STEPS: [
      { to: 1, fn: function (ad) { return Promise.resolve(); } } // v1 初始版本，无需迁移
    ],
    run: function (ad) {
      return ad.get('settings', 'main').then(function (doc) {
        let v = (doc && doc.schemaVersion) || 0;
        let p = Promise.resolve();
        VW.migrate.STEPS.forEach(function (step) {
          if (v < step.to) {
            p = p.then(function () { return step.fn(ad); });
            v = step.to;
          }
        });
        return p.then(function () {
          const merged = Object.assign({}, doc || {}, { id: 'main', schemaVersion: v });
          return ad.put('settings', merged).then(function () { return v; });
        });
      });
    }
  };
})();
