// 浏览器环境冒烟测试（jsdom）：加载发布产物，验证启动、页面渲染、学习流程、数据闭环
'use strict';
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const HTML_PATH = path.join(__dirname, '..', '..', 'release', '背单词.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', function (e) { errors.push('jsdomError: ' + e.message); });
vc.on('error', function (e) { errors.push('console.error: ' + (e && e.message || e)); });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function waitFor(fn, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 8000)) {
    try { if (fn()) return true; } catch (e) { /* retry */ }
    await sleep(80);
  }
  throw new Error('等待超时: ' + label);
}
let step = '';
function check(cond, msg) {
  if (!cond) throw new Error('[' + step + '] ' + msg);
}

async function main() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/背单词.html',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const { window } = dom;
  const doc = window.document;

  step = '启动';
  await waitFor(function () { return window.VW && window.VW.store && window.VW.store.api; }, 8000, 'VW.boot 初始化');
  await sleep(300);
  const VW = window.VW;
  check(!!window.XLSX, 'Excel 解析库未内联（window.XLSX 缺失）');

  step = '内置词书装载（示例 + 四级×2）';
  const books = await VW.store.api.books.list();
  check(books.some(function (b) { return b.id === 'sample-book'; }), '示例词书未装载');
  check(books.some(function (b) { return b.id === 'cet4-1500'; }), '四级1500核心词未装载');
  check(books.some(function (b) { return b.id === 'cet4-1000'; }), '四级1000高频词未装载');
  const entries = await VW.store.api.entries.list();
  check(entries.filter(function (e) { return VW.util.inBook(e, 'sample-book'); }).length === 60, '示例词书应为 60 词');
  check(entries.filter(function (e) { return VW.util.inBook(e, 'cet4-1500'); }).length === 1640, '核心词书应为 1640 词');
  check(entries.filter(function (e) { return VW.util.inBook(e, 'cet4-1000'); }).length === 1000, '高频词书应为 1000 词');

  step = '八个页面渲染';
  const routes = ['home', 'study', 'books', 'wrong', 'test', 'stats', 'dict', 'settings'];
  for (const r of routes) {
    window.location.hash = '#/' + r;
    window.dispatchEvent(new window.Event('hashchange'));
    await sleep(150);
    check(doc.getElementById('content').textContent.trim().length > 0, '页面 ' + r + ' 渲染为空');
  }

  step = '设置每日新词 5 以便快速完成一轮';
  await VW.settings.save({ newPerDay: 5 });

  step = '开始新词学习会话';
  VW.study.startSession('new', 'sample-book');
  await waitFor(function () { return VW.study.state.view === 'session' && VW.study.state.session; }, 8000, '会话创建');
  const s = VW.study.state.session;
  check(s.queueKeys.length === 5, '队列应为 5 词，实际 ' + s.queueKeys.length);

  step = '逐词完成学习（学习卡→认词→拼写验证）';
  let guard = 0;
  while (VW.study.state.view !== 'done' && guard < 300) {
    guard++;
    const cur = s.current;
    if (!cur) { await sleep(100); continue; }
    const q = cur.question;
    if (!q) {
      // 新词学习卡（无 question 对象）：点「继续」进入认词题
      const btn = doc.getElementById('st-know');
      if (btn) { console.log('  [smoke] learn card -> 继续'); btn.click(); await sleep(80); continue; }
      await sleep(100);
      continue;
    }
    if (q.kind === 'learn') {
      const btn = doc.getElementById('st-know');
      check(!!btn, '学习卡缺少继续按钮');
      console.log('  [smoke] kind=learn -> 继续');
      btn.click();
    } else if (q.kind === 'spell') {
      const input = doc.getElementById('st-spell');
      check(!!input, '拼写题缺少输入框');
      console.log('  [smoke] kind=spell answer=' + q.correct);
      input.value = q.correct;
      doc.getElementById('st-submit').click();
    } else {
      // 选择类：点正确选项
      const opts = doc.querySelectorAll('.option-btn');
      check(opts.length > 0, '选择题缺少选项');
      let clicked = false;
      for (const b of opts) {
        if (b.textContent.indexOf(q.correct) >= 0) { b.click(); clicked = true; break; }
      }
      check(clicked, '未找到正确选项: ' + q.correct);
      console.log('  [smoke] kind=' + q.kind + ' answer=' + q.correct);
    }
    await sleep(80);
    const cont = doc.getElementById('st-continue');
    if (cont) { console.log('  [smoke] -> 继续'); cont.click(); await sleep(80); }
  }
  console.log('  [smoke] loop end: view=' + VW.study.state.view + ' guard=' + guard);
  check(VW.study.state.view === 'done', '会话未完成（guard 循环结束）');

  step = '数据闭环：状态/每日记录/积分';
  const states = await VW.store.api.states.list();
  check(states.filter(function (x) { return x.firstLearnedAt; }).length >= 5, '新学状态未写入');
  const today = VW.util.todayStr(4);
  const daily = await VW.store.api.daily.get(today);
  check(daily && daily.checkedIn && daily.newCount >= 5, '每日记录/打卡未写入');
  const settings = await VW.settings.get();
  check((settings.points || 0) > 0, '积分未结算');
  check((settings.totalLearned || 0) >= 5, '累计学习量未更新');

  step = '备份导出→清空→覆盖恢复闭环';
  const backup = await VW.backup.exportData(VW.store.api);
  check(backup.entries.length >= 2185, '备份词条数异常：' + backup.entries.length);
  for (const k of VW.db.STORES) { await VW.store.api[k].clear(); }
  check((await VW.store.api.entries.list()).length === 0, '清空失败');
  await VW.backup.restore(VW.store.api, backup, 'overwrite');
  const restored = await VW.store.api.entries.list();
  check(restored.length === backup.entries.length, '恢复后词条数异常：' + restored.length + '/' + backup.entries.length);

  step = 'Anki 导出与主题切换';
  const anki = VW.export_.buildAnkiText(entries);
  check(anki.indexOf('abandon\t') >= 0, 'Anki 文本缺少示例词');
  await VW.settings.save({ theme: 'dark' });
  await VW.ui.applyTheme();
  check(doc.documentElement.dataset.theme === 'dark', '主题未生效');

  step = '控制台错误检查';
  const realErrors = errors.filter(function (e) { return e.indexOf('Not implemented') < 0; });
  check(realErrors.length === 0, '存在控制台错误: ' + realErrors.slice(0, 3).join(' | '));

  console.log('SMOKE OK：启动/渲染/学习流程/数据闭环/备份恢复/导出 全部通过');
  window.close();
  process.exit(0);
}

main().catch(function (e) {
  console.error('SMOKE FAIL [' + step + ']: ' + e.message);
  if (errors.length) console.error('console errors: ' + errors.slice(0, 5).join(' | '));
  process.exit(1);
});
