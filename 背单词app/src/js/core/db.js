(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 数据层：IndexedDB 主存 + localStorage 降级，同一异步接口
  const DB_NAME = 'vwordbook';
  const DB_VER = 1;
  const STORES = ['books', 'entries', 'states', 'logs', 'daily', 'marks', 'groups', 'tests', 'settings'];
  VW.db = { STORES: STORES, backend: null };

  function openIDB() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        STORES.forEach(function (s) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB open failed')); };
      req.onblocked = function () { reject(new Error('IndexedDB blocked')); };
    });
  }

  function idbAdapter(db) {
    function tx(store, mode, fn) {
      return new Promise(function (res, rej) {
        const t = db.transaction(store, mode);
        const st = t.objectStore(store);
        fn(st, res, rej, t);
      });
    }
    return {
      name: 'idb',
      get: function (s, id) {
        return tx(s, 'readonly', function (st, res, rej) {
          const r = st.get(id);
          r.onsuccess = function () { res(r.result || null); };
          r.onerror = function () { rej(r.error); };
        });
      },
      getAll: function (s) {
        return tx(s, 'readonly', function (st, res, rej) {
          const r = st.getAll();
          r.onsuccess = function () { res(r.result || []); };
          r.onerror = function () { rej(r.error); };
        });
      },
      put: function (s, obj) {
        return tx(s, 'readwrite', function (st, res, rej) {
          const r = st.put(obj);
          r.onsuccess = function () { res(obj); };
          r.onerror = function () { rej(r.error); };
        });
      },
      bulkPut: function (s, arr) {
        if (!arr || !arr.length) return Promise.resolve();
        return tx(s, 'readwrite', function (st, res, rej, t) {
          arr.forEach(function (o) { st.put(o); });
          t.oncomplete = function () { res(); };
          t.onerror = function () { rej(t.error); };
        });
      },
      del: function (s, id) {
        return tx(s, 'readwrite', function (st, res, rej) {
          const r = st.delete(id);
          r.onsuccess = function () { res(); };
          r.onerror = function () { rej(r.error); };
        });
      },
      clear: function (s) {
        return tx(s, 'readwrite', function (st, res, rej) {
          const r = st.clear();
          r.onsuccess = function () { res(); };
          r.onerror = function () { rej(r.error); };
        });
      },
      clearAll: function () {
        const self = this;
        return STORES.reduce(function (p, s) { return p.then(function () { return self.clear(s); }); }, Promise.resolve());
      }
    };
  }

  function lsAdapter() {
    const P = 'vw.db.';
    const cache = {};
    function load(s) {
      if (cache[s]) return cache[s];
      try { cache[s] = JSON.parse(localStorage.getItem(P + s) || '[]'); }
      catch (e) { cache[s] = []; }
      return cache[s];
    }
    function persist(s) {
      try { localStorage.setItem(P + s, JSON.stringify(cache[s])); }
      catch (e) { throw new Error('本地存储空间不足：' + e.message); }
    }
    return {
      name: 'ls',
      get: function (s, id) {
        return Promise.resolve(load(s).find(function (x) { return x.id === id; }) || null);
      },
      getAll: function (s) { return Promise.resolve(load(s).slice()); },
      put: function (s, obj) {
        const a = load(s);
        const i = a.findIndex(function (x) { return x.id === obj.id; });
        if (i >= 0) a[i] = obj; else a.push(obj);
        persist(s);
        return Promise.resolve(obj);
      },
      bulkPut: function (s, arr) {
        const a = load(s);
        (arr || []).forEach(function (obj) {
          const i = a.findIndex(function (x) { return x.id === obj.id; });
          if (i >= 0) a[i] = obj; else a.push(obj);
        });
        if (arr && arr.length) persist(s);
        return Promise.resolve();
      },
      del: function (s, id) {
        const a = load(s);
        const i = a.findIndex(function (x) { return x.id === id; });
        if (i >= 0) { a.splice(i, 1); persist(s); }
        return Promise.resolve();
      },
      clear: function (s) {
        cache[s] = [];
        try { localStorage.removeItem(P + s); } catch (e) { }
        return Promise.resolve();
      },
      clearAll: function () {
        const self = this;
        return STORES.reduce(function (p, s) { return p.then(function () { return self.clear(s); }); }, Promise.resolve());
      }
    };
  }

  VW.db.open = function () {
    if (typeof indexedDB !== 'undefined') {
      return openIDB().then(function (db) {
        VW.db.backend = 'idb';
        return idbAdapter(db);
      }).catch(function () {
        VW.db.backend = 'ls';
        return lsAdapter();
      });
    }
    VW.db.backend = 'ls';
    return Promise.resolve(lsAdapter());
  };
  VW.db.isFallback = function () { return VW.db.backend !== 'idb'; };
})();
