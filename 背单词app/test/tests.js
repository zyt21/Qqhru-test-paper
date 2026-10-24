(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  if (!VW.test) VW.test = { cases: [] };

  VW.test.assert = function (cond, msg) { if (!cond) throw new Error(msg || '断言失败'); };
  VW.test.assertEq = function (a, b, msg) {
    if (a !== b) throw new Error((msg || '值不相等') + '：期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a));
  };

  VW.test.register = function (name, fn) { VW.test.cases.push({ name: name, fn: fn }); };

  VW.test.run = function () {
    let p = Promise.resolve();
    const results = [];
    VW.test.cases.forEach(function (c) {
      p = p.then(function () {
        return Promise.resolve().then(c.fn).then(
          function () { results.push({ name: c.name, ok: true }); },
          function (e) { results.push({ name: c.name, ok: false, err: (e && e.message) || String(e) }); }
        );
      });
    });
    return p.then(function () { return results; });
  };

  // ================= P0 测试用例：工具、存储、设置、迁移 =================

  VW.test.register('P0 util.normalizeKey 归一化', function () {
    VW.test.assertEq(VW.util.normalizeKey('  Hello '), 'hello');
    VW.test.assertEq(VW.util.normalizeKey('WORD'), 'word');
  });

  VW.test.register('P0 util.dateKey 学习日边界(04:00)', function () {
    const d1 = new Date(2026, 9, 21, 3, 59); // 10月21日 03:59
    VW.test.assertEq(VW.util.dateKey(d1, 4), '2026-10-20', '03:59 应属于前一天');
    const d2 = new Date(2026, 9, 21, 4, 0);  // 10月21日 04:00
    VW.test.assertEq(VW.util.dateKey(d2, 4), '2026-10-21', '04:00 应属于当天');
    const d3 = new Date(2026, 9, 21, 23, 30);
    VW.test.assertEq(VW.util.dateKey(d3, 4), '2026-10-21');
  });

  VW.test.register('P0 util.addDays 跨月进位', function () {
    VW.test.assertEq(VW.util.addDays('2026-10-31', 1), '2026-11-01');
    VW.test.assertEq(VW.util.addDays('2026-12-31', 1), '2027-01-01');
    VW.test.assertEq(VW.util.addDays('2026-10-21', 30), '2026-11-20');
  });

  VW.test.register('P0 util.diffDays 计算', function () {
    VW.test.assertEq(VW.util.diffDays('2026-10-20', '2026-10-21'), 1);
    VW.test.assertEq(VW.util.diffDays('2026-10-31', '2026-11-01'), 1);
  });

  VW.test.register('P0 util.lev 编辑距离', function () {
    VW.test.assertEq(VW.util.lev('adapt', 'adopt'), 1);
    VW.test.assertEq(VW.util.lev('affect', 'effect'), 1);
    VW.test.assertEq(VW.util.lev('cat', 'cats'), 1);
    VW.test.assertEq(VW.util.lev('same', 'same'), 0);
  });

  VW.test.register('P0 store 仓储增删查（内存适配器）', function () {
    const st = VW.store.create(new VW.testMemory());
    const b = { id: 'b1', name: '测试词书' };
    return st.books.save(b).then(function () {
      return st.books.get('b1');
    }).then(function (got) {
      VW.test.assert(got && got.name === '测试词书', '读取失败');
      return st.books.list();
    }).then(function (list) {
      VW.test.assertEq(list.length, 1, '列表长度');
      return st.books.remove('b1');
    }).then(function () {
      return st.books.list();
    }).then(function (list) {
      VW.test.assertEq(list.length, 0, '删除后应为空');
    });
  });

  VW.test.register('P0 store 批量写入与覆盖', function () {
    const st = VW.store.create(new VW.testMemory());
    return st.entries.bulkSave([
      { id: 'apple', spelling: 'apple' },
      { id: 'banana', spelling: 'banana' },
      { id: 'cherry', spelling: 'cherry' }
    ]).then(function () {
      return st.entries.bulkSave([{ id: 'apple', spelling: 'apple', extra: true }]);
    }).then(function () {
      return st.entries.list();
    }).then(function (list) {
      VW.test.assertEq(list.length, 3, '覆盖写入不应新增');
      return st.entries.get('apple');
    }).then(function (a) {
      VW.test.assert(a && a.extra === true, '覆盖写入应生效');
    });
  });

  VW.test.register('P0 settings 默认值与保存合并', function () {
    const ad = new VW.testMemory();
    const st = VW.store.create(ad);
    const savedApi = VW.store.api;
    VW.store.api = st;
    return VW.settings.get().then(function (d) {
      VW.test.assertEq(d.newPerDay, 20, '默认每日新词量');
      VW.test.assertEq(d.dayStartHour, 4, '默认日界');
      return VW.settings.save({ newPerDay: 50 });
    }).then(function () {
      return VW.settings.get();
    }).then(function (d) {
      VW.test.assertEq(d.newPerDay, 50, '保存后应生效');
      VW.test.assertEq(d.reviewCap, 100, '未改字段保持默认');
    }).finally(function () {
      VW.store.api = savedApi;
    });
  });

  VW.test.register('P0 migrate 初始建版本', function () {
    const ad = new VW.testMemory();
    return VW.migrate.run(ad).then(function (v) {
      VW.test.assertEq(v, 1, 'schema 版本应为 1');
      return ad.get('settings', 'main');
    }).then(function (doc) {
      VW.test.assert(doc && doc.schemaVersion === 1, '版本应写入 settings 文档');
    });
  });

  // ================= P1 测试用例：导入解析、合并、搜索索引、示例词书 =================

  VW.test.register('P1 parseCSV 引号/逗号/BOM/CRLF', function () {
    const csv = '\uFEFF单词,释义\n"hello, world","你好，世界"\r\nplain,"简单"\n';
    const rows = VW.importer.parseCSV(csv);
    VW.test.assertEq(rows.length, 3, '行数');
    VW.test.assertEq(rows[0][0], '单词', 'BOM 应被去除');
    VW.test.assertEq(rows[1][0], 'hello, world', '引号内逗号');
    VW.test.assertEq(rows[1][1], '你好，世界', '引号内中文逗号');
    VW.test.assertEq(rows[2][1], '简单', '普通行');
  });

  VW.test.register('P1 autoMap 中文表头映射', function () {
    const m = VW.importer.autoMap(['单词', '音标(英)', '释义', '例句', '考试标签', '未知列']);
    VW.test.assertEq(m[0], 'spelling');
    VW.test.assertEq(m[1], 'phoneticUK');
    VW.test.assertEq(m[2], 'zh');
    VW.test.assertEq(m[3], 'exampleEn');
    VW.test.assertEq(m[4], 'examTags');
    VW.test.assertEq(m[5], null, '未知列应为 null');
  });

  VW.test.register('P1 buildDrafts 多义项与标签拆分', function () {
    const rows = [
      ['单词', '词性', '释义', '考试标签', '难度'],
      ['abandon', 'vt.; n.', '抛弃；放弃', 'CET4,考研', '2'],
      ['', 'n.', '无效行']
    ];
    const mapping = VW.importer.autoMap(rows[0]);
    const res = VW.importer.buildDrafts(rows, mapping, 'bk1');
    VW.test.assertEq(res.drafts.length, 1, '有效草稿数');
    const d = res.drafts[0];
    VW.test.assertEq(d.senses.length, 2, '两个义项（词性与释义一一对应）');
    VW.test.assertEq(d.senses[0].pos, 'vt.', '第一义项词性');
    VW.test.assertEq(d.senses[1].pos, 'n.', '第二义项词性');
    VW.test.assertEq(d.senses[1].zh, '放弃', '第二义项释义');
    VW.test.assertEq(d.examTags.length, 2, '两个考试标签');
    VW.test.assertEq(d.difficulty, 2, '难度解析');
    VW.test.assertEq(d.id, 'abandon', 'id 归一化');
    VW.test.assert(res.errors.length === 1 && res.errors[0].row === 3, '缺少拼写应记录错误行号');
  });

  VW.test.register('P1 parseJSON 多结构与 snake_case', function () {
    const d1 = VW.importer.parseJSON('[{"word":"apple","meaning":"n. 苹果"}]', 'bk');
    VW.test.assertEq(d1.length, 1);
    VW.test.assertEq(d1[0].spelling, 'apple');
    VW.test.assertEq(d1[0].senses[0].zh, 'n. 苹果');

    const d2 = VW.importer.parseJSON('{"words":[{"spelling":"banana","phonetic_uk":"x","senses":[{"pos":"n.","zh":"香蕉"}]}]}', 'bk');
    VW.test.assertEq(d2.length, 1);
    VW.test.assertEq(d2[0].phoneticUK, 'x', 'snake_case 映射');
    VW.test.assertEq(d2[0].senses[0].zh, '香蕉', 'senses 数组解析');

    const d3 = VW.importer.parseJSON('{"apple":"苹果","run":"跑"}', 'bk');
    VW.test.assertEq(d3.length, 2, '键值对象结构');
    VW.test.assertEq(d3[0].senses[0].zh, '苹果');
  });

  VW.test.register('P1 parsePaste 一行一词', function () {
    const d = VW.importer.parsePaste('apple\t苹果\nbanana\n  \ncherry\t樱桃', 'bk');
    VW.test.assertEq(d.length, 3, '跳过空行');
    VW.test.assertEq(d[0].spelling, 'apple');
    VW.test.assertEq(d[0].senses[0].zh, '苹果');
    VW.test.assertEq(d[1].senses.length, 0, '无释义行');
  });

  VW.test.register('P1 mergeDraft 内容覆盖且保留用户字段', function () {
    const existing = {
      id: 'apple', spelling: 'apple', senses: [{ pos: 'n.', zh: '苹果' }],
      notes: '我的笔记', favorite: true, customTags: ['写作词'], createdAt: 't0'
    };
    const draft = {
      id: 'apple', spelling: 'apple', senses: [{ pos: 'n.', zh: '苹果；苹果树' }],
      examTags: ['CET4'], customTags: ['易混']
    };
    const merged = VW.importer.mergeDraft(existing, draft);
    VW.test.assertEq(merged.senses[0].zh, '苹果；苹果树', '内容应覆盖');
    VW.test.assertEq(merged.notes, '我的笔记', '笔记应保留');
    VW.test.assertEq(merged.favorite, true, '收藏应保留');
    VW.test.assertEq(merged.createdAt, 't0', '创建时间应保留');
    VW.test.assert(merged.customTags.indexOf('写作词') >= 0 && merged.customTags.indexOf('易混') >= 0, '自定义标签应合并');
    VW.test.assert(merged.updatedAt, '更新时间为当前');
  });

  VW.test.register('P1 planImport 去重与新建/更新分类', function () {
    const existing = new Map([['apple', { id: 'apple' }]]);
    const drafts = [
      { id: 'apple', spelling: 'apple', senses: [] },
      { id: 'apple', spelling: 'apple', senses: [] },
      { id: 'banana', spelling: 'banana', senses: [] }
    ];
    const plan = VW.importer.planImport(existing, drafts);
    VW.test.assertEq(plan.dupInFile, 1, '文件内重复');
    VW.test.assertEq(plan.create.length, 1, '新建 1 个');
    VW.test.assertEq(plan.update.length, 1, '更新 1 个');
    VW.test.assert(plan.update[0].merged, '更新项应包含合并结果');
  });

  VW.test.register('P1 搜索索引：英文子串与中文模糊', function () {
    const entries = [
      { id: 'abandon', spelling: 'abandon', senses: [{ pos: '', zh: '抛弃；放弃' }] },
      { id: 'ability', spelling: 'ability', senses: [{ pos: '', zh: '能力' }] },
      { id: 'apple', spelling: 'apple', senses: [{ pos: '', zh: '苹果' }] }
    ];
    const idx = VW.stats.buildIndex(entries);
    const r1 = VW.stats.queryIndex(idx, 'ban', 10);
    VW.test.assertEq(r1.length, 1);
    VW.test.assertEq(r1[0].id, 'abandon', '英文子串命中');
    const r2 = VW.stats.queryIndex(idx, '能力', 10);
    VW.test.assertEq(r2.length, 1);
    VW.test.assertEq(r2[0].id, 'ability', '中文命中');
    const r3 = VW.stats.queryIndex(idx, 'a', 2);
    VW.test.assertEq(r3.length, 2, '限制条数');
    VW.test.assertEq(VW.stats.queryIndex(idx, '').length, 0, '空查询返回空');
  });

  VW.test.register('P1 掌握度标签映射', function () {
    VW.test.assertEq(VW.stats.masteryLabel(null), '未学');
    VW.test.assertEq(VW.stats.masteryLabel({ firstLearnedAt: 'x', stage: 1 }), '学习中');
    VW.test.assertEq(VW.stats.masteryLabel({ firstLearnedAt: 'x', stage: 4 }), '熟悉');
    VW.test.assertEq(VW.stats.masteryLabel({ firstLearnedAt: 'x', stage: 6 }), '掌握');
    VW.test.assertEq(VW.stats.masteryLabel({ firstLearnedAt: 'x', stage: 1, stubborn: true }), '顽固', '顽固优先');
  });

  VW.test.register('P1 示例词书完整性', function () {
    const entries = VW.seed.entries;
    VW.test.assertEq(entries.length, 60, '60 个词条');
    const ids = new Set();
    entries.forEach(function (e) {
      VW.test.assert(e.spelling && e.senses && e.senses.length && e.unit, e.spelling + ' 字段不完整');
      VW.test.assert(!ids.has(e.id), 'id 重复: ' + e.id);
      VW.test.assertEq(e.bookId, 'sample-book', '归属示例词书');
      ids.add(e.id);
    });
    VW.test.assert(ids.has('adapt') && ids.has('adopt'), '包含 adapt/adopt 形近对');
    VW.test.assert(ids.has('affect') && ids.has('effect'), '包含 affect/effect 形近对');
    VW.test.assert(ids.has('arise') && ids.has('arouse'), '包含 arise/arouse 形近对');
    const units = new Set(entries.map(function (e) { return e.unit; }));
    VW.test.assertEq(units.size, 3, '3 个 List');
    const tags = new Set();
    entries.forEach(function (e) { (e.examTags || []).forEach(function (t) { tags.add(t); }); });
    VW.test.assert(tags.has('CET4') && tags.has('考研') && tags.has('雅思'), '考试标签覆盖');
  });

  VW.test.register('P1 示例词书首次装载幂等', function () {
    const ad = new VW.testMemory();
    const st = VW.store.create(ad);
    const savedApi = VW.store.api;
    VW.store.api = st;
    return VW.seed.ensure().then(function (first) {
      VW.test.assertEq(first, true, '首次应装载');
      return st.entries.list();
    }).then(function (list) {
      VW.test.assertEq(list.length, 60, '词条入库');
      return VW.seed.ensure();
    }).then(function (second) {
      VW.test.assertEq(second, false, '第二次不应重复装载');
      return st.entries.list();
    }).then(function (list) {
      VW.test.assertEq(list.length, 60, '不产生重复');
      return VW.settings.get();
    }).then(function (s) {
      VW.test.assertEq(s.defaultBookId, 'sample-book', '默认词书设置');
    }).finally(function () {
      VW.store.api = savedApi;
    });
  });

  // ================= P2 测试用例：调度算法、队列、题型 =================

  const T2 = '2026-10-21';
  const OPT2 = { today: T2, intervals: [0, 1, 2, 4, 7, 15, 30], stubbornThreshold: 3, wrongExitStreak: 2, nowIso: '2026-10-21T10:00:00.000Z' };

  VW.test.register('P2 调度 know 升档与到期日', function () {
    const s0 = VW.scheduler.newState('a');
    const s1 = VW.scheduler.firstLearn(s0, OPT2);
    VW.test.assertEq(s1.stage, 0);
    VW.test.assertEq(s1.nextDueDate, T2, '新词当天再现');
    const s2 = VW.scheduler.applyResult(s1, 'know', OPT2);
    VW.test.assertEq(s2.stage, 1, '认识升 1 档');
    VW.test.assertEq(s2.nextDueDate, '2026-10-22', 'stage1 = +1 天');
    VW.test.assertEq(s2.consecutiveCorrect, 1);
    const s3 = VW.scheduler.applyResult(s2, 'know', OPT2);
    VW.test.assertEq(s3.nextDueDate, '2026-10-23', 'stage2 = +2 天');
    VW.test.assertEq(VW.scheduler.masteryOf(s3), 'learning');
  });

  VW.test.register('P2 调度 unknown 降档计错入错词本', function () {
    let s = VW.scheduler.newState('a');
    s = VW.scheduler.firstLearn(s, OPT2);
    s = VW.scheduler.applyResult(s, 'know', OPT2);
    s = VW.scheduler.applyResult(s, 'know', OPT2); // stage2
    const s2 = VW.scheduler.applyResult(s, 'unknown', OPT2);
    VW.test.assertEq(s2.stage, 1, '降 1 档');
    VW.test.assertEq(s2.errorCount, 1, '计错');
    VW.test.assertEq(s2.consecutiveCorrect, 0, '连对清零');
    VW.test.assertEq(s2.inWrongBook, true, '入错词本');
    VW.test.assertEq(s2.nextDueDate, '2026-10-22', '按降档后间隔重排');
    const s3 = VW.scheduler.applyResult(s2, 'unknown', OPT2);
    VW.test.assertEq(s3.stage, 0, '最低 0 档');
    VW.test.assertEq(s3.errorCount, 2);
  });

  VW.test.register('P2 调度 fuzzy 原档当日重排', function () {
    let s = VW.scheduler.newState('a');
    s = VW.scheduler.firstLearn(s, OPT2);
    s = VW.scheduler.applyResult(s, 'know', OPT2); // stage1
    const s2 = VW.scheduler.applyResult(s, 'fuzzy', OPT2);
    VW.test.assertEq(s2.stage, 1, '阶段不变');
    VW.test.assertEq(s2.nextDueDate, T2, '当日重排');
    VW.test.assertEq(s2.errorCount, 0, '不计错');
  });

  VW.test.register('P2 错词本连对自动移出', function () {
    let s = VW.scheduler.newState('a');
    s = VW.scheduler.firstLearn(s, OPT2);
    s = VW.scheduler.applyResult(s, 'unknown', OPT2); // inWrongBook, error 1
    VW.test.assertEq(s.inWrongBook, true);
    s = VW.scheduler.applyResult(s, 'know', OPT2);    // cc=1
    VW.test.assertEq(s.inWrongBook, true, '连对 1 次不移出');
    s = VW.scheduler.applyResult(s, 'know', OPT2);    // cc=2
    VW.test.assertEq(s.inWrongBook, false, '连对 2 次移出');
    VW.test.assert(s.wrongClearedAt, '记录清除时间');
  });

  VW.test.register('P2 顽固词进入与退出', function () {
    let s = VW.scheduler.newState('a');
    s = VW.scheduler.firstLearn(s, OPT2);
    s = VW.scheduler.applyResult(s, 'unknown', OPT2);
    s = VW.scheduler.applyResult(s, 'unknown', OPT2);
    VW.test.assertEq(s.stubborn, false, '错误 2 次未达阈值');
    s = VW.scheduler.applyResult(s, 'unknown', OPT2);
    VW.test.assertEq(s.stubborn, true, '错误 3 次进入顽固');
    VW.test.assertEq(VW.scheduler.masteryOf(s), 'stubborn');
    VW.test.assertEq(VW.scheduler.isDue(s, '2030-01-01'), true, '顽固词始终到期');
    s = VW.scheduler.applyResult(s, 'know', OPT2);
    VW.test.assertEq(s.stubborn, true, '连对 1 次未退出');
    s = VW.scheduler.applyResult(s, 'know', OPT2);
    VW.test.assertEq(s.stubborn, false, '连对 2 次退出顽固');
  });

  VW.test.register('P2 到期与逾期判定', function () {
    const st = { id: 'a', firstLearnedAt: 'x', nextDueDate: '2026-10-20' };
    VW.test.assertEq(VW.scheduler.isDue(st, T2), true);
    VW.test.assertEq(VW.scheduler.isOverdue(st, T2), true, '10-20 对 10-21 逾期');
    VW.test.assertEq(VW.scheduler.overdueDays(st, T2), 1);
    VW.test.assertEq(VW.scheduler.isDue({ firstLearnedAt: 'x', nextDueDate: '2026-10-22' }, T2), false, '未到期');
    VW.test.assertEq(VW.scheduler.isDue(null, T2), false);
  });

  VW.test.register('P2 队列优先级：顽固→逾期→到期→新词', function () {
    const books = [{ id: 'b1', enabled: true }, { id: 'b2', enabled: false }];
    const mk = function (id, bookId) { return { id: id, spelling: id, senses: [{ pos: '', zh: id }], bookId: bookId, unit: 'L1', frequency: 3 }; };
    const entries = [
      mk('newword', 'b1'),
      mk('dueword', 'b1'),
      mk('overword', 'b1'),
      mk('stubword', 'b1'),
      mk('futureword', 'b1'),
      mk('disabledword', 'b2')
    ];
    const states = new Map([
      ['dueword', { id: 'dueword', firstLearnedAt: 'x', stage: 2, nextDueDate: T2 }],
      ['overword', { id: 'overword', firstLearnedAt: 'x', stage: 1, nextDueDate: '2026-10-19' }],
      ['stubword', { id: 'stubword', firstLearnedAt: 'x', stage: 0, stubborn: true, nextDueDate: T2 }],
      ['futureword', { id: 'futureword', firstLearnedAt: 'x', stage: 3, nextDueDate: '2026-10-25' }]
    ]);
    const q = VW.queue.build({ books: books, entries: entries, statesById: states, settings: {}, today: T2 });
    VW.test.assertEq(q.items.length, 4, '排除未到期与停用词书');
    VW.test.assertEq(q.items[0].reason, 'stubborn');
    VW.test.assertEq(q.items[1].reason, 'overdue');
    VW.test.assertEq(q.items[2].reason, 'due');
    VW.test.assertEq(q.items[3].reason, 'new');
    VW.test.assertEq(q.counts.stubborn, 1);
    VW.test.assertEq(q.counts.overdue, 1);
    VW.test.assertEq(q.counts.due, 1);
    VW.test.assertEq(q.counts.newCount, 1);
  });

  VW.test.register('P2 队列上限截断', function () {
    const books = [{ id: 'b1', enabled: true }];
    const mk = function (id) { return { id: id, spelling: id, senses: [{ pos: '', zh: id }], bookId: 'b1', unit: 'L1', frequency: 3 }; };
    const entries = [mk('d1'), mk('d2'), mk('d3'), mk('n1'), mk('n2')];
    const states = new Map([
      ['d1', { id: 'd1', firstLearnedAt: 'x', stage: 1, nextDueDate: T2 }],
      ['d2', { id: 'd2', firstLearnedAt: 'x', stage: 1, nextDueDate: T2 }],
      ['d3', { id: 'd3', firstLearnedAt: 'x', stage: 1, nextDueDate: T2 }]
    ]);
    const q = VW.queue.build({ books: books, entries: entries, statesById: states, settings: { newPerDay: 1, reviewCap: 2 }, today: T2 });
    VW.test.assertEq(q.items.length, 3, '复习 2 + 新词 1');
    VW.test.assertEq(q.counts.truncatedReview, 1, '1 个复习被截断');
    VW.test.assertEq(q.counts.truncatedNew, 1, '1 个新词被截断');
  });

  VW.test.register('P2 错词/顽固专项队列', function () {
    const books = [{ id: 'b1', enabled: true }];
    const entries = [
      { id: 'w1', spelling: 'w1', senses: [{ pos: '', zh: 'x' }], bookId: 'b1' },
      { id: 'w2', spelling: 'w2', senses: [{ pos: '', zh: 'x' }], bookId: 'b1' },
      { id: 'w3', spelling: 'w3', senses: [{ pos: '', zh: 'x' }], bookId: 'b1' }
    ];
    const states = new Map([
      ['w1', { id: 'w1', firstLearnedAt: 'x', inWrongBook: true, errorCount: 2 }],
      ['w2', { id: 'w2', firstLearnedAt: 'x', inWrongBook: true, errorCount: 5, stubborn: true }],
      ['w3', { id: 'w3', firstLearnedAt: 'x' }]
    ]);
    const wrong = VW.queue.buildWrong({ books: books, entries: entries, statesById: states });
    VW.test.assertEq(wrong.length, 2);
    VW.test.assertEq(wrong[0].entry.id, 'w2', '错误次数多者优先');
    const st = VW.queue.buildStubborn({ books: books, entries: entries, statesById: states });
    VW.test.assertEq(st.length, 1);
    VW.test.assertEq(st[0].entry.id, 'w2');
  });

  VW.test.register('P2 题型构建：结构与干扰项', function () {
    const rng = VW.util.makeRng(42);
    const pool = VW.seed.entries;
    const e = pool.find(function (x) { return x.id === 'adapt'; });
    // 每种题型结构
    const q1 = VW.quiz.buildQuestion(e, 'en2zh', pool, { rng: rng });
    VW.test.assertEq(q1.options.length, 4, '4 个选项');
    VW.test.assertEq(q1.correct, VW.quiz.zhOf(e));
    VW.test.assert(q1.options.indexOf(q1.correct) >= 0, '正确项在选项中');
    VW.test.assertEq(new Set(q1.options).size, 4, '选项不重复');

    const q2 = VW.quiz.buildQuestion(e, 'zh2en', pool, { rng: rng });
    VW.test.assert(q2.options.indexOf('adapt') >= 0, 'zh2en 含正确拼写');
    VW.test.assertEq(q2.correct, 'adapt');

    const q3 = VW.quiz.buildQuestion(e, 'spell', pool, { rng: rng });
    VW.test.assertEq(q3.correct, 'adapt', '拼写答案小写');
    VW.test.assertEq(q3.prompt.firstLetter, 'a', '首字母提示');
    VW.test.assertEq(q3.prompt.scrambled.split('').sort().join(''), 'aadpt', '乱序字母为原字母重排');
    VW.test.assertEq(q3.prompt.length, 5);

    const q4 = VW.quiz.buildQuestion(e, 'example', pool, { rng: rng });
    VW.test.assert(q4.prompt.sentence.indexOf('____') >= 0, '例句挖空');
    VW.test.assertEq(q4.options.length, 4);

    const q5 = VW.quiz.buildQuestion(e, 'discriminate', pool, { rng: rng });
    VW.test.assertEq(q5.options.length, 2, '辨析 2 选 1');
    VW.test.assert(q5.prompt.confuseZh, '含易混词释义');
    VW.test.assert(q5.options[0] !== q5.options[1], '辨析选项不同');
  });

  VW.test.register('P2 判分与拼写验证链开关', function () {
    const q = { correct: 'Hello' };
    VW.test.assertEq(VW.quiz.judge(q, 'hello'), true, '忽略大小写');
    VW.test.assertEq(VW.quiz.judge(q, ' helLo '), true, '忽略首尾空格');
    VW.test.assertEq(VW.quiz.judge(q, 'hell'), false);
    VW.test.assertEq(VW.quiz.needsSpellVerify('spell', { spellVerify: true }), false, '拼写题本身不需要再验证');
    VW.test.assertEq(VW.quiz.needsSpellVerify('en2zh', { spellVerify: true }), true);
    VW.test.assertEq(VW.quiz.needsSpellVerify('card', { spellVerify: true }), true);
    VW.test.assertEq(VW.quiz.needsSpellVerify('en2zh', { spellVerify: false }), false, '开关关闭不验证');
    VW.test.assertEq(VW.quiz.needsSpellVerify('en2zh', {}), false);
  });

  VW.test.register('P2 组卷：题数与比例', function () {
    const rng = VW.util.makeRng(7);
    const items = VW.seed.entries.slice(0, 12).map(function (e) { return { entry: e, state: null }; });
    const paper = VW.quiz.buildPaper(items, { count: 10, ratio: { rec: 0.4, spell: 0.3, disc: 0.3 }, rng: rng });
    VW.test.assertEq(paper.length, 10, '组卷 10 题');
    const kinds = {};
    const ids = new Set();
    paper.forEach(function (p) {
      kinds[p.question.kind] = (kinds[p.question.kind] || 0) + 1;
      ids.add(p.entry.id);
      VW.test.assert(p.question.prompt, '每题有题干');
    });
    VW.test.assert((kinds.en2zh || 0) + (kinds.zh2en || 0) >= 3, '认词题占比');
    VW.test.assertEq(kinds.spell || 0, 3, '拼写题 3 题');
    VW.test.assert((kinds.discriminate || 0) + (kinds.example || 0) >= 2, '辨析/例句题占比');
    VW.test.assertEq(ids.size, 10, '同一词不重复出现');
  });

  // ================= P3 测试用例：易混词分组、手动错词 =================

  VW.test.register('P3 易混词分组：形近/近义识别', function () {
    const groups = VW.quiz.buildConfuseGroups(VW.seed.entries, { maxPairs: 50 });
    const shape = groups.find(function (g) { return g.kind === '形近'; });
    const syn = groups.find(function (g) { return g.kind === '近义'; });
    function hasPair(pairs, a, b) {
      const want = [a, b].sort();
      return pairs.some(function (p) {
        const ids = p.map(function (x) { return x.id; }).sort();
        return ids[0] === want[0] && ids[1] === want[1];
      });
    }
    VW.test.assert(hasPair(shape.pairs, 'adapt', 'adopt'), 'adapt/adopt 形近');
    VW.test.assert(hasPair(shape.pairs, 'affect', 'effect'), 'affect/effect 形近');
    VW.test.assert(hasPair(shape.pairs, 'arise', 'arouse'), 'arise/arouse 形近');
    VW.test.assert(hasPair(syn.pairs, 'adapt', 'adjust'), 'adapt/adjust 近义（共享 modify）');
    VW.test.assert(hasPair(syn.pairs, 'alter', 'adjust'), 'alter/adjust 近义（共享 modify）');
    // 无自配对、无重复
    const all = [];
    groups.forEach(function (g) {
      g.pairs.forEach(function (p) {
        VW.test.assert(p[0].id !== p[1].id, '不自配对');
        all.push([p[0].id, p[1].id].sort().join('|'));
      });
    });
    VW.test.assertEq(new Set(all).size, all.length, '跨类别不重复');
  });

  VW.test.register('P3 易混词分组：性能剪枝（5000 词可控）', function () {
    const t0 = Date.now();
    const fake = [];
    for (let i = 0; i < 5000; i++) {
      fake.push({ id: 'w' + i, spelling: 'word' + i, senses: [{ pos: '', zh: 'x' }], synonyms: [], roots: '' });
    }
    const groups = VW.quiz.buildConfuseGroups(fake, { maxPairs: 5 });
    VW.test.assertEq(groups.length, 3);
    const ms = Date.now() - t0;
    VW.test.assert(ms < 5000, '5000 词分组应在 5 秒内完成（实际 ' + ms + 'ms）');
  });

  VW.test.register('P3 手动移入/移出错词本', function () {
    const base = VW.scheduler.newState('a', '2026-10-21T00:00:00.000Z');
    const s1 = VW.scheduler.manualWrong(base, true, '2026-10-21T01:00:00.000Z');
    VW.test.assertEq(s1.inWrongBook, true, '移入');
    VW.test.assertEq(base.inWrongBook, false, '原对象不被修改');
    const s2 = VW.scheduler.manualWrong(s1, false, '2026-10-21T02:00:00.000Z');
    VW.test.assertEq(s2.inWrongBook, false, '移出');
    VW.test.assertEq(s2.wrongClearedAt, '2026-10-21T02:00:00.000Z', '记录移出时间');
  });

  // ================= P4 测试用例：打卡、补签、积分、成就、计划倒推 =================

  VW.test.register('P4 连续打卡天数计算', function () {
    const T = '2026-10-21';
    const set3 = new Set(['2026-10-19', '2026-10-20', '2026-10-21']);
    const r3 = VW.points.calcStreak(set3, T);
    VW.test.assertEq(r3.streak, 3, '连续 3 天');
    VW.test.assertEq(r3.lastDate, '2026-10-19');

    const rTodayOff = VW.points.calcStreak(new Set(['2026-10-19', '2026-10-20']), T);
    VW.test.assertEq(rTodayOff.streak, 2, '今天未打卡从昨天起算');

    const rGap = VW.points.calcStreak(new Set(['2026-10-18', '2026-10-19']), T);
    VW.test.assertEq(rGap.streak, 0, '昨天未打卡则为 0');

    const rNone = VW.points.calcStreak(new Set(), T);
    VW.test.assertEq(rNone.streak, 0, '无记录为 0');
  });

  VW.test.register('P4 打卡结算：积分与成就', function () {
    const T = '2026-10-21';
    const checked = new Set(['2026-10-19', '2026-10-20', '2026-10-21']);
    const base = { points: 0, totalLearned: 5, achievements: [] };
    const res = VW.points.applyCheckin(base, checked, T);
    VW.test.assertEq(res.settings.points, 10, '打卡 +10');
    VW.test.assertEq(res.streak, 3, '连续 3 天');
    VW.test.assert(res.gained.indexOf('streak-3') >= 0, '达成三日之约');
    VW.test.assert(res.gained.indexOf('first-word') >= 0, '达成初学乍练');
    VW.test.assertEq(res.addedPoints, 10);
  });

  VW.test.register('P4 连续 7 天里程碑与补签卡', function () {
    const T = '2026-10-21';
    const days = [];
    for (let i = 0; i < 7; i++) days.push(VW.util.addDays(T, -i));
    const checked = new Set(days);
    const base = { points: 0, totalLearned: 0, achievements: [], streakMilestones: 0, makeupUsed: 0, lastMilestoneStreak: 0 };
    const r1 = VW.points.applyCheckin(base, checked, T);
    VW.test.assertEq(r1.streak, 7, '连续 7 天');
    VW.test.assertEq(r1.settings.streakMilestones, 1, '里程碑 +1');
    VW.test.assertEq(VW.points.makeupBalance(r1.settings), 1, '补签卡余额 1');
    // 同日再次结算不重复计
    const r2 = VW.points.applyCheckin(r1.settings, checked, T);
    VW.test.assertEq(r2.settings.streakMilestones, 1, '里程碑不重复计');
  });

  VW.test.register('P4 补签卡使用规则', function () {
    const T = '2026-10-21';
    const checked = new Set(['2026-10-20', '2026-10-21']);
    const s = { points: 0, streakMilestones: 1, makeupUsed: 0 };
    VW.test.assertEq(VW.points.makeupBalance(s), 1, '余额 1');
    const r1 = VW.points.useMakeup(s, checked, '2026-10-19', T);
    VW.test.assertEq(r1.ok, true, '可补签昨天');
    VW.test.assert(r1.checkedSet.has('2026-10-19'), '补签后计入');
    VW.test.assertEq(r1.settings.makeupUsed, 1);
    const r2 = VW.points.useMakeup(r1.settings, r1.checkedSet, '2026-10-18', T);
    VW.test.assertEq(r2.ok, false, '余额不足');
    const r3 = VW.points.useMakeup(s, checked, '2026-10-20', T);
    VW.test.assertEq(r3.ok, false, '已打卡日期不可补签');
    const r4 = VW.points.useMakeup(s, checked, '2026-10-22', T);
    VW.test.assertEq(r4.ok, false, '未来日期不可补签');
    const s2 = { points: 0, streakMilestones: 5, makeupUsed: 0 };
    VW.test.assertEq(VW.points.makeupBalance(s2), 2, '余额上限 2');
  });

  VW.test.register('P4 事件积分', function () {
    const s = { points: 0 };
    const r = VW.points.applyEvents(s, [['wordLearned', 3], ['spellPass', 2], ['wrongCleared', 1]]);
    VW.test.assertEq(r.addedPoints, 3 + 4 + 5, '3×1 + 2×2 + 1×5');
    VW.test.assertEq(r.settings.points, 12);
    const r2 = VW.points.applyEvents(s, [['unknownEvent', 99]]);
    VW.test.assertEq(r2.addedPoints, 0, '未知事件不计分');
  });

  VW.test.register('P4 成就判定', function () {
    const ctx = { learnedTotal: 100, streak: 3, wrongClearedTotal: 0, booksCompleted: 0, points: 1200, challengeBest: 0, testPerfect: 0 };
    const owned = ['first-word'];
    const gained = VW.points.checkAchievements(ctx, owned);
    VW.test.assert(gained.indexOf('words-100') >= 0, '百词斩');
    VW.test.assert(gained.indexOf('streak-3') >= 0, '三日之约');
    VW.test.assert(gained.indexOf('points-1000') >= 0, '千分达人');
    VW.test.assertEq(gained.indexOf('first-word'), -1, '已拥有不重复');
    VW.test.assertEq(gained.indexOf('streak-7'), -1, '未达标不发放');
  });

  VW.test.register('P4 计划倒推', function () {
    const r1 = VW.stats.planEstimate({ total: 60, learned: 0, newPerDay: 20, targetDate: '', today: '2026-10-21' });
    VW.test.assertEq(r1.remaining, 60);
    VW.test.assertEq(r1.estimatedDate, '2026-10-24', '60/20=3 天');
    const r2 = VW.stats.planEstimate({ total: 60, learned: 0, newPerDay: 20, targetDate: '2026-10-31', today: '2026-10-21' });
    VW.test.assertEq(r2.daysToTarget, 10);
    VW.test.assertEq(r2.suggestedDaily, 6, '60/10 向上取整');
    const r3 = VW.stats.planEstimate({ total: 60, learned: 40, newPerDay: 20, targetDate: '', today: '2026-10-21' });
    VW.test.assertEq(r3.remaining, 20);
    VW.test.assertEq(r3.estimatedDate, '2026-10-22');
    const r4 = VW.stats.planEstimate({ total: 60, learned: 0, newPerDay: 20, targetDate: '2026-10-20', today: '2026-10-21' });
    VW.test.assertEq(r4.suggestedDaily, null, '目标已过不给建议');
  });

  VW.test.register('P4 词书进度统计', function () {
    const entries = [
      { id: 'a', bookId: 'b1' },
      { id: 'b', bookId: 'b1' },
      { id: 'c', bookId: 'b2' }
    ];
    const sm = new Map([
      ['a', { firstLearnedAt: 'x', stage: 6, stubborn: false }],
      ['b', { firstLearnedAt: 'x', stage: 1 }]
    ]);
    const p = VW.stats.bookProgress(entries, sm, 'b1');
    VW.test.assertEq(p.total, 2);
    VW.test.assertEq(p.learned, 2);
    VW.test.assertEq(p.mastered, 1, 'stage6 为掌握');
  });

  // ================= P5 测试用例：测评范围选取 =================

  VW.test.register('P5 测评范围：每日小测（近7天+错词）', function () {
    const T = '2026-10-21';
    const entries = [
      { id: 'a', spelling: 'a', senses: [], bookId: 'b1' },
      { id: 'b', spelling: 'b', senses: [], bookId: 'b1' },
      { id: 'c', spelling: 'c', senses: [], bookId: 'b1' },
      { id: 'd', spelling: 'd', senses: [], bookId: 'b1' }
    ];
    const sm = new Map([
      ['a', { id: 'a', firstLearnedAt: 'x' }],
      ['c', { id: 'c', firstLearnedAt: 'x', inWrongBook: true }],
      ['d', { id: 'd', firstLearnedAt: 'x' }]
    ]);
    const logs = [
      { key: 'a', date: '2026-10-20' },
      { key: 'd', date: '2026-10-01' } // 超出 7 天
    ];
    const scope = VW.stats.testScope({ type: 'daily', logs: logs, entries: entries, statesById: sm, today: T, days: 7 });
    const ids = scope.map(function (x) { return x.entry.id; }).sort();
    VW.test.assertEq(ids.join(','), 'a,c', '近7天日志 a + 错词 c');
  });

  VW.test.register('P5 测评范围：单元/结课/错词', function () {
    const entries = [
      { id: 'a', spelling: 'a', senses: [], bookId: 'b1', unit: 'L1' },
      { id: 'b', spelling: 'b', senses: [], bookId: 'b1', unit: 'L1' },
      { id: 'c', spelling: 'c', senses: [], bookId: 'b1', unit: 'L2' },
      { id: 'd', spelling: 'd', senses: [], bookId: 'b2', unit: 'L1' }
    ];
    const sm = new Map([
      ['a', { id: 'a', firstLearnedAt: 'x' }],
      ['b', { id: 'b' }],                       // 未学
      ['c', { id: 'c', firstLearnedAt: 'x', inWrongBook: true }],
      ['d', { id: 'd', firstLearnedAt: 'x' }]
    ]);
    const unitScope = VW.stats.testScope({ type: 'unit', entries: entries, statesById: sm, bookId: 'b1', unit: 'L1' });
    VW.test.assertEq(unitScope.length, 1, '单元测只含该单元已学词');
    VW.test.assertEq(unitScope[0].entry.id, 'a');

    const finalScope = VW.stats.testScope({ type: 'final', entries: entries, statesById: sm, bookId: 'b1' });
    VW.test.assertEq(finalScope.length, 2, '结课测含词书全部已学词');
    VW.test.assert(finalScope.some(function (x) { return x.entry.id === 'c'; }));

    const wrongScope = VW.stats.testScope({ type: 'wrong', entries: entries, statesById: sm });
    VW.test.assertEq(wrongScope.length, 1, '错词测试只含错词本');
    VW.test.assertEq(wrongScope[0].entry.id, 'c');
  });

  // ================= P6 测试用例：聚合、遗忘曲线、掌握度分布、日历 =================

  VW.test.register('P6 聚合统计：今日/近7天/累计', function () {
    const T = '2026-10-21';
    const daily = [
      { date: T, newCount: 20, reviewCount: 30, correctCount: 45, totalCount: 50, checkedIn: true },
      { date: '2026-10-20', newCount: 10, reviewCount: 5, correctCount: 12, totalCount: 15 },
      { date: '2026-10-10', newCount: 8, reviewCount: 2, correctCount: 9, totalCount: 10 },
      { date: '2026-09-01', newCount: 100, reviewCount: 50, correctCount: 140, totalCount: 150 }
    ];
    const agg = VW.stats.aggregateDaily(daily, T, 7);
    VW.test.assertEq(agg.today.newCount, 20, '今日新词');
    VW.test.assertEq(agg.today.accuracy, 90, '今日正确率 45/50');
    VW.test.assertEq(agg.week.newCount, 30, '近7天新词 20+10');
    VW.test.assertEq(agg.week.reviewCount, 35, '近7天复习 30+5');
    VW.test.assertEq(agg.week.accuracy, Math.round(57 * 100 / 65), '近7天正确率');
    VW.test.assertEq(agg.total.newCount, 138, '累计新词');
    VW.test.assertEq(agg.total.days, 4, '累计学习天数');
  });

  VW.test.register('P6 遗忘曲线分档统计', function () {
    const intervals = [0, 1, 2, 4, 7, 15, 30];
    const logs = [
      { stageBefore: -1, correct: true },
      { stageBefore: -1, correct: false },
      { stageBefore: 0, correct: true },
      { stageBefore: 1, correct: true },
      { stageBefore: 1, correct: false },
      { stageBefore: 3, correct: true }
    ];
    const curve = VW.stats.forgettingCurve(logs, intervals);
    const byLabel = {};
    curve.forEach(function (p) { byLabel[p.label] = p; });
    VW.test.assertEq(byLabel['新词'].n, 2, '新词档 2 条');
    VW.test.assertEq(byLabel['新词'].accuracy, 50);
    VW.test.assertEq(byLabel['0天'].accuracy, 100);
    VW.test.assertEq(byLabel['1天'].n, 2);
    VW.test.assertEq(byLabel['1天'].accuracy, 50);
    VW.test.assertEq(byLabel['4天'].n, 1, 'stage3 → 4 天档');
    VW.test.assertEq(curve[0].label, '新词', '排序：新词在最前');
  });

  VW.test.register('P6 掌握度分布', function () {
    const states = [
      { firstLearnedAt: null },
      { firstLearnedAt: 'x', stage: 1, stubborn: false },
      { firstLearnedAt: 'x', stage: 4, stubborn: false },
      { firstLearnedAt: 'x', stage: 6, stubborn: false },
      { firstLearnedAt: 'x', stage: 0, stubborn: true }
    ];
    const d = VW.stats.masteryDistribution(states);
    VW.test.assertEq(d.new, 1);
    VW.test.assertEq(d.learning, 1);
    VW.test.assertEq(d.familiar, 1);
    VW.test.assertEq(d.mastered, 1);
    VW.test.assertEq(d.stubborn, 1);
  });

  VW.test.register('P6 月历生成：周一起始、格数、月末补齐', function () {
    const cal = VW.stats.calendarMonth(2026, 10);
    VW.test.assertEq(cal.days.length % 7, 0, '整周格数');
    VW.test.assertEq(cal.days[0].date, '2026-09-28', '2026-10-01 是周四，网格从周一 9-28 开始');
    VW.test.assert(cal.days.some(function (d) { return d.date === '2026-10-01' && d.inMonth; }), '含 10-01');
    VW.test.assertEq(cal.days[0].inMonth, false, '首格为上月');
    const inMonth = cal.days.filter(function (d) { return d.inMonth; });
    VW.test.assertEq(inMonth.length, 31, '10 月共 31 天');
    // 2 月
    const feb = VW.stats.calendarMonth(2026, 2);
    VW.test.assertEq(feb.days.filter(function (d) { return d.inMonth; }).length, 28, '2026-02 共 28 天');
    VW.test.assertEq(feb.days.length % 7, 0);
  });

  // ================= P7 测试用例：备份校验/合并/恢复、Anki 导出 =================

  function sampleBackup() {
    return {
      app: 'vwordbook', version: 1, exportedAt: '2026-10-21T00:00:00.000Z',
      books: [{ id: 'b1', name: '词书' }],
      entries: [{ id: 'apple', spelling: 'apple', senses: [{ pos: 'n.', zh: '苹果' }], notes: '', favorite: false }],
      states: [{ id: 'apple', firstLearnedAt: 'x', stage: 2, nextDueDate: '2026-10-22' }],
      logs: [{ id: 'l1', key: 'apple', correct: true, date: '2026-10-21' }],
      daily: [{ id: '2026-10-21', date: '2026-10-21', newCount: 1, totalCount: 1, checkedIn: true }],
      marks: [{ id: 'raw-apple', kind: 'raw', key: 'apple' }],
      groups: [{ id: 'g1', kind: 'confuse', members: ['apple'] }],
      tests: [{ id: 't1', type: 'daily', correct: 9, total: 10, score: 90 }],
      settings: [{ id: 'main', schemaVersion: 1, newPerDay: 20, points: 50, achievements: ['first-word'] }]
    };
  }

  VW.test.register('P7 备份校验', function () {
    VW.test.assertEq(VW.backup.validate(sampleBackup()).ok, true);
    VW.test.assertEq(VW.backup.validate({}).ok, false, '空对象不合法');
    VW.test.assertEq(VW.backup.validate({ app: 'other' }).ok, false, '非本应用');
    const bad = sampleBackup();
    delete bad.states;
    VW.test.assertEq(VW.backup.validate(bad).ok, false, '缺数据段');
  });

  VW.test.register('P7 合并恢复计划：本地优先、词条内容覆盖', function () {
    const incoming = sampleBackup();
    const existing = {
      books: [{ id: 'b1', name: '词书（本地改名）' }],
      entries: [{ id: 'apple', spelling: 'apple', senses: [{ pos: 'n.', zh: '旧释义' }], notes: '本地笔记', favorite: true }],
      states: [{ id: 'apple', firstLearnedAt: 'x', stage: 5, nextDueDate: '2026-11-01' }],
      logs: [{ id: 'l0', key: 'apple', date: '2026-10-20' }],
      daily: [{ id: '2026-10-20', date: '2026-10-20', newCount: 5, checkedIn: true }],
      marks: [],
      groups: [],
      tests: [],
      settings: [{ id: 'main', schemaVersion: 1, newPerDay: 40, points: 999, achievements: ['streak-3'] }]
    };
    const plan = VW.backup.planMerge(existing, incoming);
    VW.test.assertEq(plan.books[0].name, '词书（本地改名）', '本地词书保留');
    VW.test.assertEq(plan.entries[0].senses[0].zh, '苹果', '词条内容被备份覆盖');
    VW.test.assertEq(plan.entries[0].notes, '本地笔记', '词条笔记保留');
    VW.test.assertEq(plan.entries[0].favorite, true, '词条收藏保留');
    VW.test.assertEq(plan.states[0].stage, 5, '学习状态本地优先');
    VW.test.assertEq(plan.logs.length, 2, '日志并集');
    VW.test.assertEq(plan.daily.length, 2, '每日记录并集');
    VW.test.assertEq(plan.marks.length, 1, '标记并集');
    VW.test.assertEq(plan.settings[0].newPerDay, 40, '设置本地优先');
    VW.test.assertEq(plan.settings[0].points, 999, '积分本地优先');
    VW.test.assert(plan.settings[0].achievements.indexOf('first-word') >= 0 && plan.settings[0].achievements.indexOf('streak-3') >= 0, '成就并集');
  });

  VW.test.register('P7 备份恢复全流程（内存适配器往返）', function () {
    const stA = VW.store.create(new VW.testMemory());
    const stB = VW.store.create(new VW.testMemory());
    return stA.books.save({ id: 'b1', name: 'A词书' }).then(function () {
      return stA.entries.bulkSave([
        { id: 'apple', spelling: 'apple', senses: [{ pos: '', zh: '苹果' }] },
        { id: 'banana', spelling: 'banana', senses: [{ pos: '', zh: '香蕉' }] }
      ]);
    }).then(function () {
      return VW.backup.exportData(stA);
    }).then(function (data) {
      VW.test.assertEq(data.entries.length, 2);
      return VW.backup.restore(stB, data, 'overwrite');
    }).then(function () {
      return Promise.all([stB.entries.list(), stB.books.list()]);
    }).then(function (r) {
      VW.test.assertEq(r[0].length, 2, '覆盖恢复词条数');
      VW.test.assertEq(r[1][0].name, 'A词书', '覆盖恢复词书');
      // 合并：本地已有 banana（加了笔记），再导入一次
      return stB.entries.save({ id: 'banana', spelling: 'banana', senses: [{ pos: '', zh: '香蕉' }], notes: '本地笔记', favorite: true });
    }).then(function () {
      return VW.backup.exportData(stA);
    }).then(function (data) {
      return VW.backup.restore(stB, data, 'merge');
    }).then(function () {
      return stB.entries.get('banana');
    }).then(function (e) {
      VW.test.assertEq(e.notes, '本地笔记', '合并恢复保留本地用户字段');
      VW.test.assertEq(e.favorite, true);
    });
  });

  VW.test.register('P7 Anki 导出文本格式', function () {
    const text = VW.export_.buildAnkiText([
      { spelling: 'apple', senses: [{ pos: 'n.', zh: '苹果' }, { pos: 'n.', zh: '苹果树' }] },
      { spelling: 'run', senses: [{ pos: 'v.', zh: '跑' }] }
    ]);
    VW.test.assertEq(text, 'apple\tn. 苹果；n. 苹果树\nrun\tv. 跑\n', '拼写<Tab>释义，行尾换行');
  });

  // ================= P8 测试用例：5000 词性能 =================

  VW.test.register('P8 性能：5000 词条搜索/队列/组卷', function () {
    const mk = function (i) {
      return { id: 'w' + i, spelling: 'word' + i, senses: [{ pos: '', zh: '词' + i }], bookId: 'b1', unit: 'L' + (i % 20), frequency: i % 5, synonyms: [], roots: '' };
    };
    const entries = [];
    for (let i = 0; i < 5000; i++) entries.push(mk(i));
    const books = [{ id: 'b1', enabled: true }];
    const sm = new Map();
    for (let i = 0; i < 1000; i++) {
      sm.set('w' + i, { id: 'w' + i, firstLearnedAt: 'x', stage: i % 7, nextDueDate: '2026-10-21', stubborn: false });
    }
    const t0 = Date.now();
    const idx = VW.stats.buildIndex(entries);
    const hits = VW.stats.queryIndex(idx, '词12', 50);
    const t1 = Date.now();
    VW.test.assert(hits.length > 0, '中文搜索命中');
    VW.test.assert(t1 - t0 < 1000, '建索引+搜索应在 1 秒内（实际 ' + (t1 - t0) + 'ms）');
    const q = VW.queue.build({ books: books, entries: entries, statesById: sm, settings: { newPerDay: 20, reviewCap: 100 }, today: '2026-10-21' });
    const t2 = Date.now();
    VW.test.assert(q.items.length > 0, '队列生成');
    VW.test.assert(t2 - t1 < 1000, '队列生成应在 1 秒内（实际 ' + (t2 - t1) + 'ms）');
    const paper = VW.quiz.buildPaper(q.items.slice(0, 100), { count: 20, ratio: { rec: 0.4, spell: 0.3, disc: 0.3 }, rng: VW.util.makeRng(1) });
    const t3 = Date.now();
    VW.test.assertEq(paper.length, 20, '组卷 20 题');
    VW.test.assert(t3 - t2 < 2000, '组卷应在 2 秒内（实际 ' + (t3 - t2) + 'ms）');
  });

  // ================= P9 测试用例：多词书归属 + 四级词库 =================

  VW.test.register('P9 util.inBook 多词书归属', function () {
    const e1 = { bookId: 'b1', bookIds: ['b2'] };
    VW.test.assertEq(VW.util.inBook(e1, 'b1'), true, '主归属');
    VW.test.assertEq(VW.util.inBook(e1, 'b2'), true, '副归属');
    VW.test.assertEq(VW.util.inBook(e1, 'b3'), false);
    VW.test.assertEq(VW.util.inBook({ bookId: 'b1' }, 'b1'), true, '无 bookIds 向后兼容');
    VW.test.assertEq(VW.util.inBook(null, 'b1'), false);
    VW.test.assertEq(VW.util.sharesBook({ bookId: 'b1' }, { bookId: 'b1' }), true);
    VW.test.assertEq(VW.util.sharesBook({ bookId: 'b1', bookIds: ['b2'] }, { bookId: 'b2' }), true, '经由副归属共享');
    VW.test.assertEq(VW.util.sharesBook({ bookId: 'b1' }, { bookId: 'b3' }), false);
  });

  VW.test.register('P9 导入合并：跨词书加入 bookIds', function () {
    const existing = { id: 'apple', spelling: 'apple', senses: [{ pos: 'n.', zh: '苹果' }], bookId: 'b1', notes: 'n' };
    const draft = { id: 'apple', spelling: 'apple', senses: [{ pos: 'n.', zh: '苹果；苹果树' }], bookId: 'b2' };
    const merged = VW.importer.mergeDraft(existing, draft);
    VW.test.assertEq(merged.bookId, 'b1', '主归属不变');
    VW.test.assert(merged.bookIds.indexOf('b2') >= 0, '新词书加入副归属');
    VW.test.assertEq(merged.senses[0].zh, '苹果；苹果树', '内容仍覆盖');
    VW.test.assertEq(merged.notes, 'n', '用户字段保留');
    // 同词书导入不产生副归属
    const same = VW.importer.mergeDraft(existing, { id: 'apple', spelling: 'apple', senses: [], bookId: 'b1' });
    VW.test.assertEq(same.bookIds.length, 0, '同词书不添加 bookIds');
  });

  VW.test.register('P9 四级词库数据完整性', function () {
    const entries = VW.seedCET4.ENTRIES;
    const books = VW.seedCET4.BOOKS;
    VW.test.assertEq(books.length, 2, '两本词书');
    VW.test.assertEq(books[0].id, 'cet4-1500');
    VW.test.assertEq(books[1].id, 'cet4-1000');
    const ids = new Set();
    let noPhonetic = 0;
    entries.forEach(function (e) {
      VW.test.assert(!ids.has(e.id), 'id 重复: ' + e.id);
      ids.add(e.id);
      VW.test.assert(e.spelling && e.senses && e.senses.length, e.spelling + ' 缺释义');
      VW.test.assert(e.unit, e.spelling + ' 缺单元');
      VW.test.assertEq(e.examTags[0], 'CET4', e.spelling + ' 考试标签');
      if (!e.phoneticUK) noPhonetic++;
      e.senses.forEach(function (s) {
        VW.test.assert(s.zh && s.zh.length > 0, e.spelling + ' 释义为空');
      });
    });
    const m1 = entries.filter(function (e) { return VW.util.inBook(e, 'cet4-1500'); }).length;
    const m2 = entries.filter(function (e) { return VW.util.inBook(e, 'cet4-1000'); }).length;
    VW.test.assertEq(m1, 1640, '核心词书 1640 词（文档实际内容）');
    VW.test.assertEq(m2, 1000, '高频词书 1000 词');
    VW.test.assert(entries.some(function (e) { return e.bookIds.length > 0; }), '存在跨书重叠词');
    VW.test.assert(entries.some(function (e) { return e.bookId === 'cet4-1500' && e.phoneticUK; }), '核心词书含音标');
    VW.test.assert(entries.some(function (e) { return e.bookId === 'cet4-1000' && e.frequency >= 2; }), '高频词书含考频档位');
    VW.test.assert(noPhonetic < entries.length * 0.6, '音标覆盖合理（无音标 ' + noPhonetic + '/' + entries.length + '）');
  });

  VW.test.register('P9 四级词库装载幂等与合并', function () {
    const ad = new VW.testMemory();
    const st = VW.store.create(ad);
    const savedApi = VW.store.api;
    VW.store.api = st;
    // 预置示例词书的 adapt（与四级词书重叠）
    const pre = { id: 'adapt', spelling: 'adapt', senses: [{ pos: 'v.', zh: '适应；改编' }], bookId: 'sample-book', notes: 'keep', favorite: true };
    return st.entries.save(pre).then(function () {
      return VW.seedCET4.ensure();
    }).then(function (first) {
      VW.test.assertEq(first, true, '首次应装载');
      return st.entries.list();
    }).then(function (list) {
      VW.test.assertEq(list.length, 2185, '合并后词条总数（union 2185）');
      return st.entries.get('adapt');
    }).then(function (e) {
      VW.test.assertEq(e.bookId, 'sample-book', 'adapt 主归属保持示例词书');
      VW.test.assert(e.bookIds.indexOf('cet4-1500') >= 0, 'adapt 加入核心词书副归属');
      VW.test.assertEq(e.notes, 'keep', '笔记保留');
      VW.test.assertEq(e.favorite, true, '收藏保留');
      VW.test.assertEq(e.senses[0].zh, '适应；改编', '示例词书内容保留');
      return VW.seedCET4.ensure();
    }).then(function (second) {
      VW.test.assertEq(second, false, '第二次不重复装载');
      return st.entries.list();
    }).then(function (list) {
      VW.test.assertEq(list.length, 2185, '装载幂等');
      return st.books.list();
    }).then(function (bl) {
      VW.test.assertEq(bl.length, 2, '两本词书入库');
    }).finally(function () {
      VW.store.api = savedApi;
    });
  });
})();
