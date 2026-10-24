(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('stats', { title: '统计', render: function (el) { VW.statsPage.render(el); } });

  VW.statsPage = {
    state: { year: 0, month: 0 },

    render: function (el) {
      el.innerHTML = '';
      const api = VW.store.api;
      Promise.all([VW.settings.get(), api.books.list(), api.entries.list(), api.states.list(), api.logs.list(), api.daily.list()])
        .then(function (r) {
          const s = r[0], books = r[1], entries = r[2], states = r[3], logs = r[4], daily = r[5];
          const sm = new Map(states.map(function (x) { return [x.id, x]; }));
          const today = VW.util.todayStr(s.dayStartHour);
          const now = new Date();
          if (!VW.statsPage.state.year) {
            VW.statsPage.state.year = now.getFullYear();
            VW.statsPage.state.month = now.getMonth() + 1;
          }

          // ===== 顶部摘要 =====
          const agg = VW.stats.aggregateDaily(daily, today, 7);
          const checked = new Set(daily.filter(function (d) { return d.checkedIn; }).map(function (d) { return d.date; }));
          const streak = VW.points.calcStreak(checked, today).streak;
          const enabled = books.filter(function (b) { return b.enabled; });
          let total = 0, learned = 0;
          enabled.forEach(function (b) {
            const p = VW.stats.bookProgress(entries, sm, b.id);
            total += p.total; learned += p.learned;
          });
          const plan = VW.stats.planEstimate({ total: total, learned: learned, newPerDay: s.newPerDay, targetDate: s.targetDate, today: today });

          const summary = VW.ui.el('<div class="grid grid-4" style="margin-bottom:14px"></div>');
          function stat(n, l, color) {
            return '<div class="card" style="padding:12px 14px"><div class="stat-num" style="color:' + (color || 'inherit') + '">' + n + '</div><div class="stat-label">' + l + '</div></div>';
          }
          summary.innerHTML =
            stat(agg.today.newCount, '今日新词') +
            stat(agg.today.reviewCount, '今日复习') +
            stat(agg.today.accuracy + '%', '今日正确率', 'var(--ok)') +
            stat(streak + ' 天', '连续打卡', 'var(--primary)') +
            stat(s.points || 0, '积分') +
            stat(agg.week.newCount, '近 7 天新词') +
            stat(agg.week.reviewCount, '近 7 天复习') +
            stat(VW.ui.fmtDate(plan.estimatedDate), '预计完成', total ? '' : 'var(--text-2)');
          el.appendChild(summary);

          // ===== 近 7 天明细 =====
          const weekCard = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
          const weekList = daily.filter(function (d) { return d.date >= VW.util.addDays(today, -6) && d.date <= today; })
            .sort(function (a, b) { return b.date.localeCompare(a.date); });
          weekCard.innerHTML = '<div class="card-title">📋 近 7 天学习记录</div>' +
            (weekList.length ? '<table class="tbl"><thead><tr><th>日期</th><th>新词</th><th>复习</th><th>正确率</th><th>打卡</th></tr></thead><tbody>' +
              weekList.map(function (d) {
                const acc = d.totalCount ? Math.round(d.correctCount * 100 / d.totalCount) + '%' : '—';
                return '<tr><td>' + VW.ui.fmtDate(d.date) + '</td><td>' + d.newCount + '</td><td>' + d.reviewCount + '</td><td>' + acc + '</td><td>' + (d.checkedIn ? '✅' : '—') + '</td></tr>';
              }).join('') + '</tbody></table>' : VW.ui.empty('还没有学习记录').outerHTML);
          el.appendChild(weekCard);

          // ===== 遗忘曲线 =====
          const curve = VW.stats.forgettingCurve(logs, s.intervals);
          const curveCard = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
          curveCard.innerHTML = '<div class="card-title">📉 遗忘曲线（各间隔档作答正确率）</div>';
          if (curve.length) {
            const div = VW.ui.el('<div></div>');
            div.innerHTML = VW.ui.chart.line(curve, { max: 100, color: 'var(--primary)' });
            curveCard.appendChild(div);
            curveCard.appendChild(VW.ui.el('<div class="small muted">横轴为该词作答前的记忆档位（间隔天数），纵轴为正确率</div>'));
          } else {
            curveCard.appendChild(VW.ui.empty('学几个词后这里会出现曲线'));
          }
          el.appendChild(curveCard);

          // ===== 掌握度分布 =====
          const dist = VW.stats.masteryDistribution(states);
          const distCard = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
          distCard.innerHTML = '<div class="card-title">🎯 掌握度分布</div>';
          const colors = { '未学': 'var(--text-2)', '学习中': 'var(--warn)', '熟悉': 'var(--primary)', '掌握': 'var(--ok)', '顽固': 'var(--danger)' };
          const distItems = [
            { label: '未学', value: dist.new },
            { label: '学习中', value: dist.learning },
            { label: '熟悉', value: dist.familiar },
            { label: '掌握', value: dist.mastered },
            { label: '顽固', value: dist.stubborn }
          ].map(function (d) { return { label: d.label, value: d.value, color: colors[d.label] }; });
          const chartDiv = VW.ui.el('<div></div>');
          chartDiv.innerHTML = VW.ui.chart.bars(distItems);
          distCard.appendChild(chartDiv);
          el.appendChild(distCard);

          // ===== 词书进度 =====
          const bookCard = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
          bookCard.innerHTML = '<div class="card-title">📚 词书进度</div>';
          if (!enabled.length) bookCard.appendChild(VW.ui.empty('没有启用的词书'));
          enabled.forEach(function (b) {
            const p = VW.stats.bookProgress(entries, sm, b.id);
            const pct = p.total ? Math.round(p.learned * 100 / p.total) : 0;
            const row = VW.ui.el('<div style="margin-bottom:10px"></div>');
            row.innerHTML = '<div class="row-between small"><span class="bold">' + VW.util.escapeHtml(b.name) + '</span><span class="muted">' + p.learned + '/' + p.total + ' · 掌握 ' + p.mastered + '</span></div>' +
              '<div class="progress" style="margin-top:4px"><i style="width:' + pct + '%"></i></div>';
            bookCard.appendChild(row);
          });
          el.appendChild(bookCard);

          // ===== 学习日历 =====
          const calCard = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
          calCard.innerHTML = '<div class="card-title">🗓 学习日历 <span class="small muted">（' + VW.statsPage.state.year + ' 年 ' + VW.statsPage.state.month + ' 月）</span></div>';
          VW.statsPage.renderCalendar(calCard, daily, s, checked, today);
          el.appendChild(calCard);

          // ===== 成就 =====
          const achCard = VW.ui.el('<div class="card"></div>');
          const owned = s.achievements || [];
          achCard.innerHTML = '<div class="card-title">🏆 成就徽章（' + owned.length + '/' + VW.points.ACHIEVEMENTS.length + '）</div><div class="grid grid-4">' +
            VW.points.ACHIEVEMENTS.map(function (a) {
              const has = owned.indexOf(a.id) >= 0;
              return '<div class="card" style="text-align:center;padding:12px;opacity:' + (has ? 1 : 0.45) + '">' +
                '<div style="font-size:1.6rem">' + (has ? '🥇' : '🔒') + '</div>' +
                '<div class="small bold">' + VW.util.escapeHtml(a.name) + '</div>' +
                '<div class="small muted" style="font-size:.72rem">' + VW.util.escapeHtml(a.desc) + '</div></div>';
            }).join('') + '</div>';
          el.appendChild(achCard);
        });
    },

    renderCalendar: function (card, daily, settings, checked, today) {
      const st = VW.statsPage.state;
      const dailyMap = new Map(daily.map(function (d) { return [d.date, d]; }));
      const cal = VW.stats.calendarMonth(st.year, st.month);
      const grid = VW.ui.el('<div class="cal-grid"></div>');
      const head = VW.ui.el('<div class="row" style="justify-content:space-between;margin-bottom:8px"></div>');
      const prev = VW.ui.el('<button class="btn small ghost">← 上月</button>');
      const next = VW.ui.el('<button class="btn small ghost">下月 →</button>');
      prev.onclick = function () {
        st.month--;
        if (st.month < 1) { st.month = 12; st.year--; }
        VW.ui.renderRoute();
      };
      next.onclick = function () {
        st.month++;
        if (st.month > 12) { st.month = 1; st.year++; }
        VW.ui.renderRoute();
      };
      head.appendChild(prev); head.appendChild(next);
      card.appendChild(head);

      const weekNames = VW.ui.el('<div class="cal-row cal-head"></div>');
      weekNames.innerHTML = ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<span>' + w + '</span>'; }).join('');
      grid.appendChild(weekNames);
      const rows = [];
      cal.days.forEach(function (d, i) {
        if (i % 7 === 0) rows.push(VW.ui.el('<div class="cal-row"></div>'));
        const cell = VW.ui.el('<span class="cal-cell' + (d.inMonth ? '' : ' out') + (d.date === today ? ' today' : '') + '"></span>');
        const rec = dailyMap.get(d.date);
        const isChecked = checked.has(d.date);
        cell.innerHTML = '<i class="day">' + d.day + '</i>' + (isChecked ? '<i class="dot"></i>' : '');
        if (d.inMonth) {
          cell.onclick = function () { VW.statsPage.showDay(d.date, rec, isChecked, settings, checked, today); };
        }
        rows[rows.length - 1].appendChild(cell);
      });
      rows.forEach(function (r) { grid.appendChild(r); });
      card.appendChild(grid);
      card.appendChild(VW.ui.el('<div class="small muted" style="margin-top:6px">· 带点日期已打卡；点击日期可查看记录、补签或补学</div>'));
    },

    showDay: function (date, rec, isChecked, settings, checked, today) {
      const body = VW.ui.el('<div></div>');
      body.innerHTML =
        '<div class="bold" style="margin-bottom:8px">' + VW.ui.fmtDate(date) + (date === today ? '（今天）' : '') + '</div>' +
        (rec ? '<div class="small">新词 ' + rec.newCount + ' · 复习 ' + rec.reviewCount + ' · 作答 ' + rec.totalCount + ' · 正确率 ' + (rec.totalCount ? Math.round(rec.correctCount * 100 / rec.totalCount) + '%' : '—') + '</div>'
          : '<div class="small muted">当天没有学习记录</div>') +
        '<div class="small" style="margin-top:6px">补签卡余额：' + VW.points.makeupBalance(settings) + ' 张</div>';
      const btns = [];
      if (!isChecked && date <= today && VW.points.makeupBalance(settings) > 0) {
        btns.push({
          text: '🔖 补签', cls: 'primary', close: false, onClick: function () {
            const r = VW.points.useMakeup(settings, checked, date, today);
            if (!r.ok) { VW.ui.toast(r.reason, 'err'); return false; }
            return VW.settings.save(r.settings).then(function () {
              return VW.store.api.daily.save({ id: date, date: date, newCount: 0, reviewCount: 0, correctCount: 0, totalCount: 0, checkedIn: true, makeup: true });
            }).then(function () {
              VW.ui.toast('补签成功，连续打卡 ' + VW.points.calcStreak(r.checkedSet, today).streak + ' 天', 'ok');
              m.close();
              VW.ui.renderRoute();
            });
          }
        });
      }
      if (date < today) {
        btns.push({
          text: '📖 补学（复习逾期词）', cls: '', close: false, onClick: function () {
            m.close();
            VW.study.startSession('review');
            return false;
          }
        });
      }
      btns.push({ text: '关闭', cls: 'ghost' });
      const m = VW.ui.openModal({ title: '学习日历', body: body, buttons: btns });
    }
  };

  // 日历样式（动态注入一次）
  (function () {
    if (document.getElementById('cal-css')) return;
    const css = document.createElement('style');
    css.id = 'cal-css';
    css.textContent =
      '.cal-row{display:flex;gap:4px;margin-bottom:4px}' +
      '.cal-row span{flex:1;text-align:center}' +
      '.cal-head span{font-size:.75rem;color:var(--text-2);padding:2px 0}' +
      '.cal-cell{position:relative;border-radius:8px;padding:4px 0;cursor:pointer;font-size:.85rem;min-height:34px;display:flex;flex-direction:column;align-items:center;justify-content:center}' +
      '.cal-cell:hover{background:var(--bg-soft)}' +
      '.cal-cell.out{color:var(--text-2);opacity:.4;cursor:default}' +
      '.cal-cell.today{border:1.5px solid var(--primary)}' +
      '.cal-cell .dot{width:6px;height:6px;border-radius:50%;background:var(--ok);margin-top:2px}';
    document.head.appendChild(css);
  })();
})();
