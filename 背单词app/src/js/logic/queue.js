(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 今日队列生成（纯函数）：顽固 → 逾期 → 今日到期 → 新词
  VW.queue = {
    // opts: {books, entries, statesById, settings, today, bookId, unit, newCap, reviewCap}
    build: function (opts) {
      const settings = opts.settings || {};
      const today = opts.today || VW.util.todayStr(settings.dayStartHour);
      const statesById = opts.statesById || new Map();
      const enabledIds = new Set((opts.books || []).filter(function (b) { return b.enabled; }).map(function (b) { return b.id; }));
      function inEnabled(e) {
        return enabledIds.has(e.bookId) || (e.bookIds || []).some(function (id) { return enabledIds.has(id); });
      }
      let entries = (opts.entries || []).filter(inEnabled);
      if (opts.bookId) entries = entries.filter(function (e) { return VW.util.inBook(e, opts.bookId); });
      if (opts.unit) entries = entries.filter(function (e) { return e.unit === opts.unit; });

      const stubborn = [], overdue = [], due = [], newWords = [];
      entries.forEach(function (e) {
        const st = statesById.get(e.id);
        if (!st || !st.firstLearnedAt) { newWords.push({ entry: e, state: st || null, reason: 'new' }); return; }
        if (st.stubborn) { stubborn.push({ entry: e, state: st, reason: 'stubborn' }); return; }
        if (st.nextDueDate && st.nextDueDate < today) { overdue.push({ entry: e, state: st, reason: 'overdue' }); return; }
        if (st.nextDueDate && st.nextDueDate <= today) { due.push({ entry: e, state: st, reason: 'due' }); }
      });

      // 组内排序
      const bySpelling = function (a, b) { return a.entry.spelling.localeCompare(b.entry.spelling); };
      overdue.sort(function (a, b) {
        const d = VW.scheduler.overdueDays(a.state, today) - VW.scheduler.overdueDays(b.state, today);
        return d !== 0 ? d : bySpelling(a, b);
      });
      due.sort(bySpelling);
      newWords.sort(function (a, b) {
        if (a.entry.bookId !== b.entry.bookId) return a.entry.bookId.localeCompare(b.entry.bookId);
        if ((a.entry.unit || '') !== (b.entry.unit || '')) return String(a.entry.unit).localeCompare(String(b.entry.unit));
        return (b.entry.frequency || 0) - (a.entry.frequency || 0);
      });

      const newCap = opts.newCap != null ? opts.newCap : (settings.newPerDay || 20);
      const reviewCap = opts.reviewCap != null ? opts.reviewCap : (settings.reviewCap || 100);
      const reviewPool = stubborn.concat(overdue, due);
      const cappedReview = reviewPool.slice(0, reviewCap);
      const cappedNew = newWords.slice(0, newCap);
      const items = cappedReview.concat(cappedNew);

      return {
        items: items,
        counts: {
          stubborn: stubborn.length,
          overdue: overdue.length,
          due: due.length,
          newCount: newWords.length,
          truncatedReview: reviewPool.length - cappedReview.length,
          truncatedNew: newWords.length - cappedNew.length
        }
      };
    },

    // 错词专项队列
    buildWrong: function (opts) {
      const enabledIds = new Set((opts.books || []).filter(function (b) { return b.enabled; }).map(function (b) { return b.id; }));
      const statesById = opts.statesById || new Map();
      const out = [];
      (opts.entries || []).forEach(function (e) {
        if (!enabledIds.has(e.bookId) && !(e.bookIds || []).some(function (id) { return enabledIds.has(id); })) return;
        const st = statesById.get(e.id);
        if (st && st.inWrongBook) out.push({ entry: e, state: st, reason: 'wrong' });
      });
      out.sort(function (a, b) { return (b.state.errorCount || 0) - (a.state.errorCount || 0); });
      return out;
    },

    // 顽固词队列
    buildStubborn: function (opts) {
      const enabledIds = new Set((opts.books || []).filter(function (b) { return b.enabled; }).map(function (b) { return b.id; }));
      const statesById = opts.statesById || new Map();
      const out = [];
      (opts.entries || []).forEach(function (e) {
        if (!enabledIds.has(e.bookId) && !(e.bookIds || []).some(function (id) { return enabledIds.has(id); })) return;
        const st = statesById.get(e.id);
        if (st && st.stubborn) out.push({ entry: e, state: st, reason: 'stubborn' });
      });
      return out;
    }
  };
})();
