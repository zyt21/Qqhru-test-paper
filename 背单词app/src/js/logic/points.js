(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 积分 / 打卡 / 补签卡 / 成就（纯函数，可测试；持久化由调用方负责）
  VW.points = {
    // 事件积分表
    EVENTS: {
      wordLearned: 1,    // 新学一词
      spellPass: 2,      // 拼写验证通过
      checkin: 10,       // 每日打卡
      wrongCleared: 5,   // 消灭错词
      testPass: 20,      // 测评 ≥ 80 分
      timedChallenge: 1  // 限时挑战每分
    },

    ACHIEVEMENTS: [
      { id: 'first-word', name: '初学乍练', desc: '学习第一个单词', check: function (c) { return c.learnedTotal >= 1; } },
      { id: 'words-100', name: '百词斩', desc: '累计学习 100 词', check: function (c) { return c.learnedTotal >= 100; } },
      { id: 'streak-3', name: '三日之约', desc: '连续打卡 3 天', check: function (c) { return c.streak >= 3; } },
      { id: 'streak-7', name: '七日之约', desc: '连续打卡 7 天', check: function (c) { return c.streak >= 7; } },
      { id: 'streak-30', name: '三十而立', desc: '连续打卡 30 天', check: function (c) { return c.streak >= 30; } },
      { id: 'wrong-100', name: '错词克星', desc: '累计消灭 100 个错词', check: function (c) { return c.wrongClearedTotal >= 100; } },
      { id: 'book-done', name: '词书毕业', desc: '完成一本词书的全部单词', check: function (c) { return c.booksCompleted >= 1; } },
      { id: 'points-1000', name: '千分达人', desc: '积分达到 1000', check: function (c) { return c.points >= 1000; } },
      { id: 'challenge-30', name: '极限挑战', desc: '限时挑战得分达到 30', check: function (c) { return c.challengeBest >= 30; } },
      { id: 'perfect-test', name: '全对之星', desc: '一次测评全对', check: function (c) { return c.testPerfect >= 1; } }
    ],

    // 连续打卡天数（今天未打卡则从昨天起算）
    calcStreak: function (checkedSet, today) {
      let d = today;
      if (!checkedSet.has(d)) d = VW.util.addDays(d, -1);
      if (!checkedSet.has(d)) return { streak: 0, lastDate: null };
      let streak = 0;
      while (checkedSet.has(d)) {
        streak++;
        d = VW.util.addDays(d, -1);
      }
      return { streak: streak, lastDate: VW.util.addDays(d, 1) };
    },

    // 补签卡余额：每达成连续 7 天里程碑 +1，上限 2
    makeupBalance: function (settings) {
      const earned = Math.min(2, settings.streakMilestones || 0);
      return Math.max(0, earned - (settings.makeupUsed || 0));
    },

    // 打卡结算（纯函数）：返回更新后的 settings 与新达成成就
    applyCheckin: function (settings, checkedSet, today) {
      const s = Object.assign({}, settings);
      const res = VW.points.calcStreak(checkedSet, today);
      const gained = [];
      const before = s.points || 0;
      s.points = before + VW.points.EVENTS.checkin;
      // 连续 7 天里程碑（每个新档位只计一次）
      if (res.streak >= 7 && res.streak % 7 === 0 && res.streak !== (s.lastMilestoneStreak || 0)) {
        s.lastMilestoneStreak = res.streak;
        s.streakMilestones = (s.streakMilestones || 0) + 1;
      }
      const earned = VW.points.checkAchievements(VW.points.achievementCtx(s, checkedSet, today), s.achievements || []);
      earned.forEach(function (id) { if (gained.indexOf(id) < 0) gained.push(id); });
      s.achievements = (s.achievements || []).concat(gained);
      return { settings: s, streak: res.streak, addedPoints: VW.points.EVENTS.checkin, gained: gained };
    },

    // 使用补签卡（纯函数）：targetDate 需为过去且未打卡
    useMakeup: function (settings, checkedSet, targetDate, today) {
      if (!targetDate || targetDate > today) return { ok: false, reason: '只能补签今天或更早的日期' };
      if (checkedSet.has(targetDate)) return { ok: false, reason: '该日期已打卡' };
      if (VW.points.makeupBalance(settings) <= 0) return { ok: false, reason: '没有可用的补签卡（每连续打卡 7 天获得 1 张，最多持有 2 张）' };
      const s = Object.assign({}, settings);
      s.makeupUsed = (s.makeupUsed || 0) + 1;
      const newSet = new Set(checkedSet);
      newSet.add(targetDate);
      return { ok: true, settings: s, checkedSet: newSet };
    },

    // 事件加分（纯函数）：events = [[eventName, count], ...]
    applyEvents: function (settings, events, ctxExtra) {
      const s = Object.assign({}, settings);
      let added = 0;
      (events || []).forEach(function (e) {
        const val = VW.points.EVENTS[e[0]];
        if (val && e[1]) added += val * e[1];
      });
      s.points = (s.points || 0) + added;
      return { settings: s, addedPoints: added };
    },

    // 成就判定（纯函数）：返回新达成的成就 id 列表
    checkAchievements: function (ctx, owned) {
      const have = new Set(owned || []);
      const out = [];
      VW.points.ACHIEVEMENTS.forEach(function (a) {
        if (!have.has(a.id) && a.check(ctx)) out.push(a.id);
      });
      return out;
    },

    // 成就 id → 名称
    achievementName: function (id) {
      const a = VW.points.ACHIEVEMENTS.find(function (x) { return x.id === id; });
      return a ? a.name : id;
    },

    // 从 settings + 打卡集合构建成就判定上下文
    achievementCtx: function (settings, checkedSet, today) {
      const streak = checkedSet ? VW.points.calcStreak(checkedSet, today).streak : 0;
      return {
        learnedTotal: settings.totalLearned || 0,
        streak: streak,
        wrongClearedTotal: settings.totalWrongCleared || 0,
        booksCompleted: settings.booksCompleted || 0,
        points: settings.points || 0,
        challengeBest: settings.challengeBest || 0,
        testPerfect: settings.testPerfect || 0
      };
    },

    // 会话结算：累计学习量与积分（调用方负责 save）
    recordSession: function (s) {
      const api = VW.store.api;
      return Promise.all([VW.settings.get(), api.daily.list()]).then(function (r) {
        const settings = r[0];
        const today = VW.util.todayStr(settings.dayStartHour);
        const checked = new Set(r[1].filter(function (d) { return d.checkedIn; }).map(function (d) { return d.date; }));
        const streak = VW.points.calcStreak(checked, today).streak;
        const st = s.stats || {};
        const events = [
          ['wordLearned', st.newLearned || 0],
          ['spellPass', st.spellPass || 0],
          ['wrongCleared', st.wrongCleared || 0]
        ];
        const ev = VW.points.applyEvents(settings, events);
        ev.settings.totalLearned = (settings.totalLearned || 0) + (st.newLearned || 0);
        ev.settings.totalWrongCleared = (settings.totalWrongCleared || 0) + (st.wrongCleared || 0);
        const gained = VW.points.checkAchievements(VW.points.achievementCtx(ev.settings, checked, today), ev.settings.achievements || []);
        if (gained.length) ev.settings.achievements = (ev.settings.achievements || []).concat(gained);
        return VW.settings.save(ev.settings).then(function () {
          return { addedPoints: ev.addedPoints, gained: gained, streak: streak, points: ev.settings.points };
        });
      });
    },

    // 打卡结算（含持久化）；wasChecked 表示该日之前已打卡
    recordCheckin: function (wasChecked) {
      if (wasChecked) return Promise.resolve(null);
      const api = VW.store.api;
      return Promise.all([VW.settings.get(), api.daily.list()]).then(function (r) {
        const settings = r[0];
        const today = VW.util.todayStr(settings.dayStartHour);
        const checked = new Set(r[1].filter(function (d) { return d.checkedIn; }).map(function (d) { return d.date; }));
        const res = VW.points.applyCheckin(settings, checked, today);
        return VW.settings.save(res.settings).then(function () {
          return { addedPoints: res.addedPoints, streak: res.streak, gained: res.gained, points: res.settings.points };
        });
      });
    }
  };
})();
