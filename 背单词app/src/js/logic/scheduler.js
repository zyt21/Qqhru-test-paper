(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 简化艾宾浩斯调度（纯函数）
  // stage 0..6 对应间隔 [0,1,2,4,7,15,30] 天（可配置）
  // 结果：know（认识，含拼写验证）/ fuzzy（模糊，当日重排）/ unknown（不认识，降档+计错）
  VW.scheduler = {
    // 新词初始状态
    newState: function (key, nowIso) {
      return {
        id: key,
        firstLearnedAt: null,
        lastReviewedAt: null,
        nextDueAt: '',
        nextDueDate: '',
        stage: 0,
        consecutiveCorrect: 0,
        errorCount: 0,
        mastery: 'new',
        inWrongBook: false,
        inRawBook: false,
        stubborn: false,
        createdAt: nowIso || new Date().toISOString()
      };
    },

    // 应用一次作答结果，返回新状态（不修改原对象）
    applyResult: function (state, result, opts) {
      opts = opts || {};
      const s = Object.assign({}, state);
      const today = opts.today || VW.util.todayStr(opts.dayStartHour);
      const intervals = opts.intervals || [0, 1, 2, 4, 7, 15, 30];
      const maxStage = Math.max(0, intervals.length - 1);
      const nowIso = opts.nowIso || new Date().toISOString();

      if (result === 'know') {
        s.stage = Math.min((s.stage || 0) + 1, maxStage);
        s.consecutiveCorrect = (s.consecutiveCorrect || 0) + 1;
      } else if (result === 'unknown') {
        s.stage = Math.max(0, (s.stage || 0) - 1);
        s.consecutiveCorrect = 0;
        s.errorCount = (s.errorCount || 0) + 1;
        s.inWrongBook = true;
      } // fuzzy：阶段不变，当日重排

      // 错词本自动移出：连对达到阈值
      const exitStreak = opts.wrongExitStreak != null ? opts.wrongExitStreak : 2;
      if (s.inWrongBook && s.consecutiveCorrect >= exitStreak) {
        s.inWrongBook = false;
        s.wrongClearedAt = nowIso;
      }

      // 顽固词：错误次数达到阈值进入；连对 2 次退出
      const threshold = opts.stubbornThreshold != null ? opts.stubbornThreshold : 3;
      if (!s.stubborn && s.errorCount >= threshold) {
        s.stubborn = true;
        s.stubbornSince = nowIso;
      }
      if (s.stubborn && s.consecutiveCorrect >= 2) {
        s.stubborn = false;
      }

      // 到期时间：模糊 → 当日重排；stage 0 → 当天；stage>=1 → 今天 + intervals[stage] 天
      if (result === 'fuzzy') {
        s.nextDueDate = today;
      } else if (s.stage <= 0) {
        s.nextDueDate = today;
      } else {
        s.nextDueDate = VW.util.addDays(today, intervals[s.stage]);
      }
      s.lastReviewedAt = nowIso;
      s.mastery = VW.scheduler.masteryOf(s);
      return s;
    },

    // 新词首次学完
    firstLearn: function (state, opts) {
      opts = opts || {};
      const s = Object.assign({}, state);
      const today = opts.today || VW.util.todayStr(opts.dayStartHour);
      const nowIso = opts.nowIso || new Date().toISOString();
      s.firstLearnedAt = nowIso;
      s.lastReviewedAt = nowIso;
      s.stage = 0;
      s.nextDueDate = today;
      s.mastery = 'learning';
      return s;
    },

    masteryOf: function (state) {
      if (!state || !state.firstLearnedAt) return 'new';
      if (state.stubborn) return 'stubborn';
      if ((state.stage || 0) >= 5) return 'mastered';
      if ((state.stage || 0) >= 3) return 'familiar';
      return 'learning';
    },

    isDue: function (state, today) {
      if (!state || !state.firstLearnedAt) return false;
      if (state.stubborn) return true;
      return !!state.nextDueDate && state.nextDueDate <= today;
    },

    isOverdue: function (state, today) {
      if (!state || !state.firstLearnedAt) return false;
      return !!state.nextDueDate && state.nextDueDate < today;
    },

    // 逾期天数（正数表示逾期）
    overdueDays: function (state, today) {
      if (!state || !state.nextDueDate) return 0;
      return VW.util.diffDays(state.nextDueDate, today);
    },

    // 手动移入/移出错词本
    manualWrong: function (state, inBook, nowIso) {
      const s = Object.assign({}, state);
      s.inWrongBook = !!inBook;
      if (!inBook) s.wrongClearedAt = nowIso || new Date().toISOString();
      return s;
    }
  };
})();
