(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  // 内存存储适配器：实现与 db.js 相同的异步接口，用于自动化测试
  class TestMemoryAdapter {
    constructor() { this.m = new Map(); }
    get(s, id) {
      const a = this.m.get(s) || [];
      for (const x of a) { if (x.id === id) return Promise.resolve(x); }
      return Promise.resolve(null);
    }
    getAll(s) { return Promise.resolve((this.m.get(s) || []).slice()); }
    put(s, obj) {
      let a = this.m.get(s);
      if (!a) { a = []; this.m.set(s, a); }
      const i = a.findIndex(x => x.id === obj.id);
      if (i >= 0) a[i] = obj; else a.push(obj);
      return Promise.resolve(obj);
    }
    bulkPut(s, arr) {
      const self = this;
      return (arr || []).reduce((p, o) => p.then(() => self.put(s, o)), Promise.resolve());
    }
    del(s, id) {
      const a = this.m.get(s);
      if (a) this.m.set(s, a.filter(x => x.id !== id));
      return Promise.resolve();
    }
    clear(s) { this.m.delete(s); return Promise.resolve(); }
    clearAll() { this.m.clear(); return Promise.resolve(); }
  }
  VW.testMemory = TestMemoryAdapter;
})();
