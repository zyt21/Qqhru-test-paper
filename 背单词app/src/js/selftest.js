(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  // 浏览器自检页：index.html?selftest
  if (typeof document !== 'undefined' && /selftest/.test(location.search)) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML = '';
      const root = document.createElement('div');
      root.className = 'selftest';
      root.innerHTML = '<h1>🧪 自检</h1><ul id="st-ul"><li>运行中…</li></ul><div class="sum" id="st-sum"></div>';
      document.body.appendChild(root);
      const ul = document.getElementById('st-ul');
      const sum = document.getElementById('st-sum');
      VW.test.run().then(function (results) {
        ul.innerHTML = '';
        results.forEach(function (r) {
          const li = document.createElement('li');
          li.className = r.ok ? 'pass' : 'fail';
          li.textContent = (r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : ' — ' + r.err);
          ul.appendChild(li);
        });
        const fails = results.filter(function (r) { return !r.ok; }).length;
        sum.textContent = '共 ' + results.length + ' 项，通过 ' + (results.length - fails) + ' 项，失败 ' + fails + ' 项';
        sum.style.color = fails ? 'var(--danger)' : 'var(--ok)';
      });
    });
  }
})();
