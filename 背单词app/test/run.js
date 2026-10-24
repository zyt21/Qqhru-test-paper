#!/usr/bin/env node
// 测试运行器：加载 src 纯逻辑模块 + 测试用例，全部通过退出码 0，否则退出码 1
'use strict';
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'js');
const order = [
  'core/util.js',
  'core/store.js',
  'core/settings.js',
  'core/migrate.js',
  'logic/scheduler.js',
  'logic/queue.js',
  'logic/quiz.js',
  'logic/import.js',
  'logic/stats.js',
  'logic/points.js',
  'logic/backup.js',
  'export.js',
  'seed-cet4.js',
  'seed.js'
];
for (const f of order) require(path.join(SRC, f));
require(path.join(__dirname, 'memory.js'));
require(path.join(__dirname, 'tests.js'));

const VW = globalThis.VW;
VW.test.run().then(function (results) {
  results.forEach(function (r) {
    console.log((r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : ' — ' + r.err));
  });
  const fails = results.filter(function (r) { return !r.ok; });
  console.log('—— 共 ' + results.length + ' 项，通过 ' + (results.length - fails.length) + ' 项，失败 ' + fails.length + ' 项 ——');
  process.exit(fails.length ? 1 : 0);
});
