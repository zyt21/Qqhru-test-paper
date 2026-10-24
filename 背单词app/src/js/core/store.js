(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 仓储层：基于适配器的实体 CRUD；测试可用内存适配器注入
  function repo(name, ad) {
    return {
      name: name,
      list: function () { return ad.getAll(name); },
      get: function (id) { return ad.get(name, id); },
      save: function (obj) {
        if (!obj || !obj.id) return Promise.reject(new Error(name + ': obj.id required'));
        return ad.put(name, obj).then(function () { return obj; });
      },
      bulkSave: function (arr) { return ad.bulkPut(name, arr || []); },
      remove: function (id) { return ad.del(name, id); },
      clear: function () { return ad.clear(name); }
    };
  }

  VW.store = {
    create: function (ad) {
      return {
        books: repo('books', ad),
        entries: repo('entries', ad),
        states: repo('states', ad),
        logs: repo('logs', ad),
        daily: repo('daily', ad),
        marks: repo('marks', ad),
        groups: repo('groups', ad),
        tests: repo('tests', ad),
        settings: repo('settings', ad)
      };
    },
    api: null,
    init: function (ad) {
      VW.store.api = VW.store.create(ad);
      return Promise.resolve(VW.store.api);
    }
  };
})();
