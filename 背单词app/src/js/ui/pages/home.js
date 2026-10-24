(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('home', { title: '首页', render: function (el) { VW.home.render(el); } });

  VW.home = {
    render: function (el) {
      el.innerHTML = '';
      const api = VW.store.api;
      Promise.all([
        VW.settings.get(), api.books.list(), api.entries.list(), api.states.list(),
        api.logs.list(), api.daily.list(), api.tests.list(), api.marks.get(VW.study.SESSION_KEY)
      ]).then(function (r) {
        const s = r[0], books = r[1], entries = r[2], states = r[3], logs = r[4], daily = r[5], tests = r[6], savedSession = r[7];
        const sm = new Map(states.map(function (x) { return [x.id, x]; }));
        const today = VW.util.todayStr(s.dayStartHour);
        const checked = new Set(daily.filter(function (d) { return d.checkedIn; }).map(function (d) { return d.date; }));
        const streak = VW.points.calcStreak(checked, today).streak;
        const q = VW.queue.build({ books: books, entries: entries, statesById: sm, settings: s, today: today });
        const now = new Date();
        const hour = now.getHours();
        const greeting = hour < 5 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

        // ① 问候栏
        const hello = VW.ui.el('<div class="row-between" style="margin-bottom:12px"></div>');
        hello.innerHTML =
          '<div><div style="font-size:1.3rem;font-weight:700">' + greeting + '！</div>' +
          '<div class="small muted">' + today + ' · 连续打卡 <b style="color:var(--primary)">' + streak + '</b> 天 · 积分 <b>' + (s.points || 0) + '</b> · 补签卡 ' + VW.points.makeupBalance(s) + ' 张</div></div>' +
          '<div style="text-align:right"><div class="stat-num">' + (s.points || 0) + '</div><div class="stat-label">总积分</div></div>';
        el.appendChild(hello);

        // ③ 提醒条（在任务卡上方，醒目）
        const remind = [];
        if (s.remind) {
          if (q.items.length && !(daily.find(function (d) { return d.date === today && d.checkedIn; }))) {
            remind.push('今日任务还没开始');
          }
          if (q.counts.overdue > 0) remind.push(q.counts.overdue + ' 个词已逾期');
          if (!s.backupLastAt || Date.now() - s.backupLastAt > 7 * 86400000) remind.push('超过 7 天未备份，建议到「设置」导出备份');
        }
        if (remind.length) {
          const bar = VW.ui.el('<div class="card" style="margin-bottom:12px;padding:10px 14px;border-color:var(--warn);background:var(--warn-bg)"></div>');
          bar.innerHTML = '🔔 ' + remind.map(VW.util.escapeHtml).join('　·　');
          el.appendChild(bar);
        }

        // ② 今日任务主卡
        const task = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
        const doneToday = daily.find(function (d) { return d.date === today; });
        const plannedTotal = q.counts.stubborn + q.counts.overdue + q.counts.due + q.counts.newCount;
        const doneCount = plannedTotal - q.items.length;
        task.innerHTML =
          '<div class="card-title">📌 今日任务' + (savedSession && savedSession.data ? ' <span class="chip warn">有未完成的学习</span>' : '') + '</div>' +
          '<div class="grid grid-4" style="margin-bottom:12px">' +
          '<div><div class="stat-num" style="color:var(--danger)">' + q.counts.stubborn + '</div><div class="stat-label">顽固词</div></div>' +
          '<div><div class="stat-num" style="color:var(--warn)">' + q.counts.overdue + '</div><div class="stat-label">逾期</div></div>' +
          '<div><div class="stat-num">' + q.counts.due + '</div><div class="stat-label">今日到期</div></div>' +
          '<div><div class="stat-num" style="color:var(--primary)">' + q.counts.newCount + '</div><div class="stat-label">新词</div></div>' +
          '</div>' +
          '<div class="row" style="gap:8px;margin-bottom:10px"><div class="progress" style="flex:1"><i style="width:' + (plannedTotal ? Math.round(doneCount * 100 / plannedTotal) : 0) + '%"></i></div>' +
          '<span class="small muted">已完成 ' + (doneToday ? (doneToday.totalCount || 0) : 0) + ' 题</span></div>' +
          '<button class="btn primary big btn-block" id="home-start">▶ 开始学习</button>';
        task.querySelector('#home-start').onclick = function () {
          VW.study.startSession('all', s.defaultBookId || undefined);
        };
        el.appendChild(task);

        // ④ 快捷入口
        const quick = VW.ui.el('<div class="grid grid-4" style="margin-bottom:14px"></div>');
        const entriesQuick = [
          { route: 'books', name: '词书管理', ico: '📚' },
          { route: 'wrong', name: '错词本', ico: '❌' },
          { route: 'test', name: '测评', ico: '📝' },
          { route: 'dict', name: '词典搜索', ico: '🔍' },
          { route: 'stats', name: '统计报告', ico: '📊' },
          { route: 'settings', name: '设置', ico: '⚙️' }
        ];
        quick.innerHTML = entriesQuick.map(function (x) {
          return '<a class="card clickable" href="#/' + x.route + '" style="text-align:center;padding:12px">' +
            '<div style="font-size:1.5rem">' + x.ico + '</div><div class="small">' + x.name + '</div></a>';
        }).join('');
        el.appendChild(quick);

        // ⑤ 学习模式入口
        const modes = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
        modes.innerHTML = '<div class="card-title">🎮 学习模式</div><div class="grid grid-4"></div>';
        const modeGrid = modes.querySelector('.grid');
        [
          { id: 'unit', name: '闯关模式', ico: '🎮' },
          { id: 'listen', name: '听写模式', ico: '✍️' },
          { id: 'wrong', name: '错词专项', ico: '🎯' },
          { id: 'sprint', name: '考前冲刺', ico: '⚡' }
        ].forEach(function (m) {
          const b = VW.ui.el('<button class="btn" style="padding:12px;text-align:center">' + m.ico + ' ' + m.name + '</button>');
          b.onclick = function () {
            if (m.id === 'unit') VW.study.startUnit(s.defaultBookId || undefined);
            else VW.study.startSession(m.id, s.defaultBookId || undefined);
          };
          modeGrid.appendChild(b);
        });
        el.appendChild(modes);

        // ⑥ 模块摘要卡
        const enabled = books.filter(function (b) { return b.enabled; });
        let total = 0, learned = 0;
        enabled.forEach(function (b) {
          const p = VW.stats.bookProgress(entries, sm, b.id);
          total += p.total; learned += p.learned;
        });
        const plan = VW.stats.planEstimate({ total: total, learned: learned, newPerDay: s.newPerDay, targetDate: s.targetDate, today: today });
        const agg = VW.stats.aggregateDaily(daily, today, 7);
        const wrongCount = states.filter(function (x) { return x.inWrongBook; }).length;
        const lastTest = tests.sort(function (a, b) { return b.at - a.at; })[0];
        const summary = VW.ui.el('<div class="grid grid-3" style="margin-bottom:14px"></div>');
        summary.innerHTML =
          '<a class="card clickable" href="#/books"><div class="card-title">📚 词书进度</div><div class="stat-num">' + learned + '/' + total + '</div><div class="progress" style="margin-top:6px"><i style="width:' + (total ? Math.round(learned * 100 / total) : 0) + '%"></i></div></a>' +
          '<a class="card clickable" href="#/wrong"><div class="card-title">❌ 错词</div><div class="stat-num" style="color:' + (wrongCount ? 'var(--danger)' : 'var(--ok)') + '">' + wrongCount + '</div><div class="stat-label">待消灭错词</div></a>' +
          '<a class="card clickable" href="#/test"><div class="card-title">📝 最近测评</div><div class="stat-num">' + (lastTest ? lastTest.correct + '/' + lastTest.total : '—') + '</div><div class="stat-label">' + (lastTest ? lastTest.typeName + ' · ' + Math.round(lastTest.score) + ' 分' : '还没有测评记录') + '</div></a>' +
          '<a class="card clickable" href="#/stats"><div class="card-title">📊 本周学习</div><div class="stat-num">' + agg.week.totalCount + '</div><div class="stat-label">新词 ' + agg.week.newCount + ' · 复习 ' + agg.week.reviewCount + ' · 正确率 ' + agg.week.accuracy + '%</div></a>' +
          '<div class="card"><div class="card-title">🗓 预计完成</div><div class="stat-num">' + VW.ui.fmtDate(plan.estimatedDate) + '</div><div class="stat-label">剩余 ' + plan.remaining + ' 词' + (plan.suggestedDaily ? ' · 建议每日 ' + plan.suggestedDaily + ' 词' : '') + '</div></div>' +
          '<div class="card"><div class="card-title">🔥 连续打卡</div><div class="stat-num" style="color:var(--primary)">' + streak + ' 天</div><div class="stat-label">补签卡 ' + VW.points.makeupBalance(s) + ' 张</div></div>';
        el.appendChild(summary);

        // ⑦ 学习日历
        const calCard = VW.ui.el('<div class="card"></div>');
        calCard.innerHTML = '<div class="card-title">🗓 学习日历</div>';
        VW.statsPage.renderCalendar(calCard, daily, s, checked, today);
        el.appendChild(calCard);
      });
    }
  };
})();
