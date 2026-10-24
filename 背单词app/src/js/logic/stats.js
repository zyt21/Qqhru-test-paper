(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  VW.stats = {
    // 掌握度标签（未学/学习中/熟悉/掌握/顽固），统一委托调度器判定
    masteryLabel: function (state) {
      const labels = { new: '未学', learning: '学习中', familiar: '熟悉', mastered: '掌握', stubborn: '顽固' };
      return labels[VW.scheduler.masteryOf(state)] || '未学';
    },
    // 全局词典搜索索引（纯函数）
    buildIndex: function (entries) {
      return (entries || []).map(function (e) {
        return {
          id: e.id,
          spelling: e.spelling,
          low: (e.spelling || '').toLowerCase(),
          zh: (e.senses || []).map(function (s) { return s.zh; }).join(' / ').toLowerCase()
        };
      });
    },
    queryIndex: function (index, q, limit) {
      q = String(q == null ? '' : q).trim().toLowerCase();
      if (!q) return [];
      const out = [];
      const cap = limit || 50;
      for (let i = 0; i < index.length; i++) {
        const it = index[i];
        if (it.low.indexOf(q) >= 0 || it.zh.indexOf(q) >= 0) {
          out.push(it);
          if (out.length >= cap) break;
        }
      }
      return out;
    },

    // 学习计划倒推（纯函数）
    // opts: {total, learned, newPerDay, targetDate, today}
    planEstimate: function (opts) {
      const total = opts.total || 0;
      const learned = opts.learned || 0;
      const newPerDay = Math.max(1, opts.newPerDay || 20);
      const today = opts.today;
      const remaining = Math.max(0, total - learned);
      const estimatedDate = VW.util.addDays(today, remaining ? Math.ceil(remaining / newPerDay) : 0);
      let daysToTarget = 0, suggestedDaily = null;
      if (opts.targetDate) {
        daysToTarget = VW.util.diffDays(today, opts.targetDate);
        if (daysToTarget > 0) suggestedDaily = Math.max(1, Math.ceil(remaining / daysToTarget));
      }
      return { remaining: remaining, estimatedDate: estimatedDate, daysToTarget: daysToTarget, suggestedDaily: suggestedDaily };
    },

    // 词书进度（纯函数）：{total, learned, mastered, masteredKeys}
    bookProgress: function (entries, statesById, bookId) {
      let total = 0, learned = 0, mastered = 0;
      (entries || []).forEach(function (e) {
        if (!VW.util.inBook(e, bookId)) return;
        total++;
        const st = statesById.get(e.id);
        if (st && st.firstLearnedAt) {
          learned++;
          if (VW.scheduler.masteryOf(st) === 'mastered') mastered++;
        }
      });
      return { total: total, learned: learned, mastered: mastered };
    },

    // 测评范围选取（纯函数）
    // opts: {type:'daily'|'unit'|'final'|'wrong', logs, entries, statesById, today, bookId, unit, days}
    testScope: function (opts) {
      const sm = opts.statesById || new Map();
      const learnedKeys = new Set();
      sm.forEach(function (st, k) { if (st.firstLearnedAt) learnedKeys.add(k); });
      let keys;
      if (opts.type === 'daily') {
        keys = new Set();
        const from = VW.util.addDays(opts.today, -(opts.days || 7));
        (opts.logs || []).forEach(function (l) {
          if (l.date >= from && l.date <= opts.today) keys.add(l.key);
        });
        sm.forEach(function (st, k) { if (st.inWrongBook) keys.add(k); });
      } else if (opts.type === 'wrong') {
        keys = new Set();
        sm.forEach(function (st, k) { if (st.inWrongBook) keys.add(k); });
      } else if (opts.type === 'unit') {
        keys = new Set();
        (opts.entries || []).forEach(function (e) {
          if (VW.util.inBook(e, opts.bookId) && e.unit === opts.unit && learnedKeys.has(e.id)) keys.add(e.id);
        });
      } else if (opts.type === 'final') {
        keys = new Set();
        (opts.entries || []).forEach(function (e) {
          if (VW.util.inBook(e, opts.bookId) && learnedKeys.has(e.id)) keys.add(e.id);
        });
      }
      const em = new Map((opts.entries || []).map(function (e) { return [e.id, e]; }));
      const out = [];
      keys.forEach(function (k) {
        const e = em.get(k);
        if (e) out.push({ entry: e, state: sm.get(k) || null });
      });
      return out;
    },

    // 聚合统计：今日 / 近 N 天 / 累计
    aggregateDaily: function (dailyList, today, days) {
      const list = dailyList || [];
      const todayRec = list.find(function (d) { return d.date === today; }) || { newCount: 0, reviewCount: 0, correctCount: 0, totalCount: 0 };
      const from = VW.util.addDays(today, -((days || 7) - 1));
      const acc = function (r) { return r.totalCount ? Math.round(r.correctCount * 100 / r.totalCount) : 0; };
      const week = { newCount: 0, reviewCount: 0, correctCount: 0, totalCount: 0, days: 0 };
      const total = { newCount: 0, reviewCount: 0, correctCount: 0, totalCount: 0, days: 0 };
      list.forEach(function (d) {
        total.newCount += d.newCount || 0;
        total.reviewCount += d.reviewCount || 0;
        total.correctCount += d.correctCount || 0;
        total.totalCount += d.totalCount || 0;
        if ((d.newCount || 0) + (d.reviewCount || 0) > 0) total.days++;
        if (d.date >= from && d.date <= today) {
          week.newCount += d.newCount || 0;
          week.reviewCount += d.reviewCount || 0;
          week.correctCount += d.correctCount || 0;
          week.totalCount += d.totalCount || 0;
          if ((d.newCount || 0) + (d.reviewCount || 0) > 0) week.days++;
        }
      });
      return {
        today: Object.assign({}, todayRec, { accuracy: acc(todayRec) }),
        week: Object.assign({}, week, { accuracy: acc(week) }),
        total: Object.assign({}, total, { accuracy: acc(total) })
      };
    },

    // 遗忘曲线：按作答前档位分组统计正确率（纯函数）
    forgettingCurve: function (logs, intervals) {
      const order = ['新词', '0天', '1天', '2天', '4天', '7天', '15天', '30天'];
      const buckets = {};
      (logs || []).forEach(function (l) {
        let label;
        if (l.stageBefore == null || l.stageBefore < 0) label = '新词';
        else {
          const d = (intervals && intervals[l.stageBefore] != null) ? intervals[l.stageBefore] : 0;
          label = d + '天';
        }
        const b = buckets[label] || (buckets[label] = { n: 0, c: 0 });
        b.n++;
        if (l.correct) b.c++;
      });
      return Object.keys(buckets).sort(function (a, b) {
        return order.indexOf(a) - order.indexOf(b);
      }).map(function (k) {
        const b = buckets[k];
        return { label: k, n: b.n, accuracy: b.n ? Math.round(b.c * 100 / b.n) : 0 };
      });
    },

    // 掌握度分布（纯函数）
    masteryDistribution: function (states) {
      const dist = { new: 0, learning: 0, familiar: 0, mastered: 0, stubborn: 0 };
      (states || []).forEach(function (s) {
        const m = VW.scheduler.masteryOf(s);
        dist[m] = (dist[m] || 0) + 1;
      });
      return dist;
    },

    // 月历格子（纯函数）：周一起始，返回 42 格
    calendarMonth: function (year, month) {
      const firstStr = year + '-' + String(month).padStart(2, '0') + '-01';
      const first = new Date(year, month - 1, 1);
      const startDow = (first.getDay() + 6) % 7; // 周一=0
      const daysInMonth = new Date(year, month, 0).getDate();
      const days = [];
      for (let i = 0; i < 42; i++) {
        const date = VW.util.addDays(firstStr, i - startDow);
        const p = date.split('-').map(Number);
        const inMonth = p[1] === month;
        days.push({ date: date, inMonth: inMonth, day: p[2] });
        if (inMonth && p[2] === daysInMonth && i >= startDow + 6) {
          // 已到月末，补满整行后结束
          if ((i - startDow + 1) % 7 === 0) break;
        }
      }
      // 统一补齐到整周
      while (days.length % 7 !== 0) {
        const last = days[days.length - 1].date;
        days.push({ date: VW.util.addDays(last, 1), inMonth: false, day: parseInt(VW.util.addDays(last, 1).split('-')[2], 10) });
      }
      return { year: year, month: month, days: days };
    }
  };
})();
