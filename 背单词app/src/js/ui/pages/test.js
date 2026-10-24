(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('test', { title: '测评', render: function (el) { VW.testPage.render(el); } });

  VW.testPage = {
    state: { view: 'overview', exam: null },
    TYPES: [
      { id: 'daily', name: '每日小测', ico: '📋', desc: '最近 7 天学过的词 + 错词，共 10 题', count: 10 },
      { id: 'unit', name: '单元测', ico: '📦', desc: '指定词书的某个单元已学词，最多 20 题', count: 20 },
      { id: 'final', name: '词书结课测', ico: '🎓', desc: '词书全部已学词抽样，共 30 题', count: 30 },
      { id: 'challenge', name: '限时挑战', ico: '⚡', desc: '60 秒连续作答，答对 +1 分，答错扣 5 秒' }
    ],

    render: function (el) {
      el.innerHTML = '';
      const q = VW.ui.query();
      if (q.range === 'wrong') { VW.testPage.start('wrong', {}); return; }
      if (VW.testPage.state.view === 'exam' && VW.testPage.state.exam) {
        VW.testPage.renderExam(el);
        return;
      }
      VW.testPage.state.view = 'overview';
      VW.testPage.renderOverview(el);
    },

    renderOverview: function (el) {
      const api = VW.store.api;
      Promise.all([api.books.list(), api.entries.list(), api.states.list(), api.logs.list(), api.tests.list()])
        .then(function (r) {
          const books = r[0].filter(function (b) { return b.enabled; });
          const entries = r[1], states = r[2], logs = r[3], tests = r[4];
          const sm = new Map(states.map(function (s) { return [s.id, s]; }));

          // 最近成绩
          if (tests.length) {
            const last = tests.sort(function (a, b) { return b.at - a.at; })[0];
            const card = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
            card.innerHTML = '<div class="row-between"><div><div class="bold">最近一次：' + VW.util.escapeHtml(last.typeName || '测评') + '</div>' +
              '<div class="small muted">' + VW.ui.fmtDate(last.date) + ' · ' + last.correct + '/' + last.total + ' 题 · ' + Math.round(last.score) + ' 分</div></div>' +
              '<span class="chip ' + (last.score >= 80 ? 'ok' : 'warn') + '">' + (last.score >= 80 ? '通过' : '未通过') + '</span></div>';
            el.appendChild(card);
          }

          // 测试类型
          const grid = VW.ui.el('<div class="grid grid-2"></div>');
          VW.testPage.TYPES.forEach(function (t) {
            const c = VW.ui.el('<div class="card clickable"></div>');
            c.innerHTML = '<div class="bold">' + t.ico + ' ' + t.name + '</div><div class="small muted" style="margin-top:4px">' + t.desc + '</div>';
            c.onclick = function () {
              if (t.id === 'unit') VW.testPage.startUnit(books, entries, sm);
              else if (t.id === 'final') VW.testPage.startFinal(books, entries, sm);
              else VW.testPage.start(t.id, {});
            };
            grid.appendChild(c);
          });
          el.appendChild(grid);

          // 错词测试
          const wrongCount = states.filter(function (s) { return s.inWrongBook; }).length;
          const wrongCard = VW.ui.el('<div class="card clickable" style="margin-top:14px"></div>');
          wrongCard.innerHTML = '<div class="row-between"><div><div class="bold">🎯 错词测试</div><div class="small muted">从错词本组卷（当前 ' + wrongCount + ' 词）</div></div><button class="btn small">开始</button></div>';
          wrongCard.onclick = function () { VW.testPage.start('wrong', {}); };
          el.appendChild(wrongCard);

          // 历史成绩
          if (tests.length) {
            const hist = VW.ui.el('<div class="card" style="margin-top:14px"></div>');
            hist.innerHTML = '<div class="card-title">历史成绩</div>' +
              tests.sort(function (a, b) { return b.at - a.at; }).slice(0, 10).map(function (t) {
                return '<div class="list-item"><div>' + VW.util.escapeHtml(t.typeName || '测评') + ' <span class="small muted">' + VW.ui.fmtDate(t.date) + '</span></div>' +
                  '<div>' + t.correct + '/' + t.total + ' · <b>' + Math.round(t.score) + '</b> 分</div></div>';
              }).join('');
            el.appendChild(hist);
          }
        });
    },

    startUnit: function (books, entries, sm) {
      const body = VW.ui.el('<div></div>');
      const bookSel = VW.ui.el('<select style="margin-bottom:10px"></select>');
      bookSel.innerHTML = books.map(function (b) { return '<option value="' + VW.util.escapeHtml(b.id) + '">' + VW.util.escapeHtml(b.name) + '</option>'; }).join('');
      const unitSel = VW.ui.el('<select style="margin-bottom:10px"></select>');
      function fillUnits() {
        const units = {};
        entries.forEach(function (e) { if (VW.util.inBook(e, bookSel.value) && e.unit) units[e.unit] = 1; });
        unitSel.innerHTML = Object.keys(units).sort().map(function (u) {
          return '<option value="' + VW.util.escapeHtml(u) + '">' + VW.util.escapeHtml(u) + '</option>';
        }).join('');
      }
      bookSel.onchange = fillUnits;
      fillUnits();
      body.appendChild(bookSel);
      body.appendChild(unitSel);
      const m = VW.ui.openModal({
        title: '单元测',
        body: body,
        buttons: [{
          text: '开始', cls: 'primary', onClick: function () {
            VW.testPage.start('unit', { bookId: bookSel.value, unit: unitSel.value });
          }
        }, { text: '取消', cls: 'ghost' }]
      });
    },

    startFinal: function (books, entries, sm) {
      const body = VW.ui.el('<div></div>');
      const bookSel = VW.ui.el('<select></select>');
      bookSel.innerHTML = books.map(function (b) { return '<option value="' + VW.util.escapeHtml(b.id) + '">' + VW.util.escapeHtml(b.name) + '</option>'; }).join('');
      body.appendChild(bookSel);
      VW.ui.openModal({
        title: '词书结课测',
        body: body,
        buttons: [{
          text: '开始', cls: 'primary', onClick: function () {
            VW.testPage.start('final', { bookId: bookSel.value });
          }
        }, { text: '取消', cls: 'ghost' }]
      });
    },

    // 组卷并进入考试视图
    start: function (type, opts) {
      const api = VW.store.api;
      Promise.all([api.books.list(), api.entries.list(), api.states.list(), api.logs.list(), VW.settings.get()])
        .then(function (r) {
          const books = r[0], entries = r[1], states = r[2], logs = r[3], settings = r[4];
          const sm = new Map(states.map(function (s) { return [s.id, s]; }));
          const today = VW.util.todayStr(settings.dayStartHour);
          let scope = [];
          let count = 10;
          if (type === 'daily') {
            scope = VW.stats.testScope({ type: 'daily', logs: logs, entries: entries, statesById: sm, today: today, days: 7 });
          } else if (type === 'wrong') {
            scope = VW.stats.testScope({ type: 'wrong', logs: logs, entries: entries, statesById: sm, today: today });
          } else if (type === 'unit') {
            scope = VW.stats.testScope({ type: 'unit', entries: entries, statesById: sm, bookId: opts.bookId, unit: opts.unit });
            count = 20;
          } else if (type === 'final') {
            scope = VW.stats.testScope({ type: 'final', entries: entries, statesById: sm, bookId: opts.bookId });
            count = 30;
          }
          if (!scope.length) { VW.ui.toast('该范围没有可测的已学词', 'err'); return; }
          const rng = VW.util.makeRng(Date.now() % 100000);
          let questions;
          if (type === 'challenge') {
            questions = VW.quiz.buildPaper(scope, { count: Math.min(scope.length, 999), ratio: { rec: 0.5, spell: 0.25, disc: 0.25 }, rng: rng });
          } else {
            questions = VW.quiz.buildPaper(scope, { count: Math.min(count, scope.length), ratio: { rec: 0.4, spell: 0.3, disc: 0.3 }, rng: rng });
          }
          VW.testPage.state.exam = {
            type: type,
            typeName: VW.testPage.typeName(type),
            questions: questions,
            index: 0,
            correct: 0,
            wrongKeys: [],
            startAt: Date.now(),
            left: 60,
            score: 0,
            timer: null
          };
          VW.testPage.state.view = 'exam';
          VW.ui.renderRoute();
        });
    },

    typeName: function (type) {
      const t = VW.testPage.TYPES.find(function (x) { return x.id === type; });
      if (type === 'wrong') return '错词测试';
      return t ? t.name : type;
    },

    // ============ 考试视图 ============
    renderExam: function (el) {
      const x = VW.testPage.state.exam;
      if (!x) { VW.testPage.state.view = 'overview'; VW.testPage.renderOverview(el); return; }
      if (x.finished) { VW.testPage.renderResult(el); return; }
      const total = x.questions.length;
      el.innerHTML =
        '<div class="row-between" style="margin-bottom:10px">' +
        '<span class="small muted">' + x.typeName + ' · ' + (x.index + 1) + ' / ' + total + '</span>' +
        '<span id="t-timer" class="small bold"></span>' +
        '<button class="btn small ghost" id="t-exit">退出</button>' +
        '</div>' +
        '<div class="progress" style="margin-bottom:16px"><i style="width:' + (x.index * 100 / total) + '%"></i></div>' +
        '<div id="t-question"></div>' +
        '<div id="t-foot"></div>';
      el.querySelector('#t-exit').onclick = function () {
        VW.ui.confirm({ title: '退出测评', message: '确定退出？本次成绩不计入。' }).then(function (ok) {
          if (!ok) return;
          if (x.timer) clearInterval(x.timer);
          VW.testPage.state.exam = null;
          VW.testPage.state.view = 'overview';
          VW.ui.renderRoute();
        });
      };
      if (x.type === 'challenge') {
        const tEl = el.querySelector('#t-timer');
        const tick = function () {
          x.left--;
          tEl.textContent = '⏱ ' + x.left + 's · 得分 ' + x.score;
          if (x.left <= 0) VW.testPage.finishExam();
        };
        x.timer = setInterval(tick, 1000);
        tEl.textContent = '⏱ ' + x.left + 's · 得分 ' + x.score;
      }
      VW.testPage.showQuestion(el, x);
    },

    showQuestion: function (el, x) {
      const qEl = el.querySelector('#t-question');
      const fEl = el.querySelector('#t-foot');
      const item = x.questions[x.index];
      const q = item.question;
      const kind = q.kind;
      let html = '';
      if (kind === 'spell') {
        html =
          '<div class="card">' +
          '<div style="font-size:1.15rem;font-weight:600">' + VW.util.escapeHtml(q.prompt.zh) + '</div>' +
          (q.prompt.example ? '<div class="small muted" style="margin-top:6px">' + VW.util.escapeHtml(q.prompt.example.en) + '</div>' : '') +
          '<div style="margin-top:12px"><input id="t-spell" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="font-size:1.2rem;letter-spacing:2px" placeholder="输入英文拼写"></div></div>';
        fEl.innerHTML = '<div class="row" style="justify-content:center"><button class="btn primary big" id="t-submit">确认</button></div>';
      } else {
        const kindName = { en2zh: '选择正确释义', zh2en: '选择正确单词', example: '例句填空', discriminate: '易混词辨析' }[kind];
        let promptHtml = '';
        if (kind === 'en2zh') promptHtml = '<div style="font-size:1.7rem;font-weight:700">' + VW.util.escapeHtml(q.prompt.spelling) + '</div>';
        else if (kind === 'zh2en') promptHtml = '<div style="font-size:1.2rem;font-weight:600">' + VW.util.escapeHtml(q.prompt.zh) + '</div>';
        else if (kind === 'example') promptHtml = '<div class="small muted">' + VW.util.escapeHtml(q.prompt.zh) + '</div><div style="font-size:1.05rem;margin-top:6px">' + VW.util.escapeHtml(q.prompt.sentence) + '</div>';
        else promptHtml = '<div style="font-size:1.2rem;font-weight:600">「' + VW.util.escapeHtml(q.prompt.zh) + '」对应的单词是？</div>';
        html = '<div class="chip">' + kindName + '</div><div class="card" style="margin-top:8px">' + promptHtml + '</div>' +
          '<div class="grid grid-2" style="margin-top:12px">' +
          q.options.map(function (o, i) {
            return '<button class="btn option-btn" data-i="' + i + '" style="padding:13px;text-align:left;white-space:normal">' + (i + 1) + '. ' + VW.util.escapeHtml(o) + '</button>';
          }).join('') + '</div>';
        fEl.innerHTML = '';
      }
      qEl.innerHTML = html;

      const judge = function (ok, btnEl) {
        if (x.timer) clearInterval(x.timer);
        if (ok) {
          x.correct++;
          if (x.type === 'challenge') x.score++;
        } else {
          x.wrongKeys.push(item.entry.id);
          if (x.type === 'challenge') x.left -= 5;
        }
        VW.testPage.feedback(el, x, item, ok);
      };
      if (kind === 'spell') {
        const input = qEl.querySelector('#t-spell');
        input.focus();
        const submit = function () {
          const val = input.value.trim();
          if (!val) return;
          judge(VW.quiz.judge(q, val));
        };
        fEl.querySelector('#t-submit').onclick = submit;
        input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
        VW.testPage.keyHook = { kind: 'spell' };
      } else {
        qEl.querySelectorAll('.option-btn').forEach(function (b) {
          b.onclick = function () {
            const i = parseInt(b.dataset.i, 10);
            judge(q.options[i] === q.correct, b);
          };
        });
        VW.testPage.keyHook = { kind: 'choice', options: qEl.querySelectorAll('.option-btn') };
      }
    },

    feedback: function (el, x, item, ok) {
      const qEl = el.querySelector('#t-question');
      const fEl = el.querySelector('#t-foot');
      const e = item.entry;
      qEl.innerHTML =
        '<div class="card" style="border-color:' + (ok ? 'var(--ok)' : 'var(--danger)') + '">' +
        '<div class="bold" style="color:' + (ok ? 'var(--ok)' : 'var(--danger)') + '">' + (ok ? '✓ 回答正确' : '✗ 回答错误') + '</div>' +
        '<div style="margin-top:8px"><b style="font-size:1.2rem">' + VW.util.escapeHtml(e.spelling) + '</b> <span class="muted small">' + VW.util.escapeHtml(e.phoneticUK || '') + '</span></div>' +
        '<div class="small" style="margin-top:4px">' + (e.senses || []).map(function (s) {
          return '<div><span class="chip">' + VW.util.escapeHtml(s.pos || '—') + '</span> ' + VW.util.escapeHtml(s.zh) + '</div>';
        }).join('') + '</div></div>';
      fEl.innerHTML = '<div class="row" style="justify-content:center"><button class="btn primary big" id="t-next">下一题</button></div>';
      fEl.querySelector('#t-next').onclick = function () {
        x.index++;
        if (x.type === 'challenge') {
          if (x.left <= 0) { VW.testPage.finishExam(); return; }
          // 挑战模式循环出题
          if (x.index >= x.questions.length) x.index = 0;
          VW.testPage.renderExam(el);
          return;
        }
        if (x.index >= x.questions.length) { VW.testPage.finishExam(); return; }
        VW.testPage.renderExam(el);
      };
    },

    finishExam: function () {
      const x = VW.testPage.state.exam;
      if (!x || x.finished) return;
      if (x.timer) clearInterval(x.timer);
      x.finished = true;
      x.durationMs = Date.now() - x.startAt;
      const api = VW.store.api;
      const today = VW.util.todayStr(4);
      if (x.type === 'challenge') {
        // 更新挑战最佳成绩与积分
        VW.settings.get().then(function (s) {
          const best = Math.max(s.challengeBest || 0, x.score);
          const patch = { challengeBest: best, points: (s.points || 0) + x.score * VW.points.EVENTS.timedChallenge };
          const gained = VW.points.checkAchievements({
            learnedTotal: s.totalLearned || 0, streak: 0, wrongClearedTotal: s.totalWrongCleared || 0,
            booksCompleted: s.booksCompleted || 0, points: patch.points, challengeBest: best, testPerfect: s.testPerfect || 0
          }, s.achievements || []);
          if (gained.length) patch.achievements = (s.achievements || []).concat(gained);
          return VW.settings.save(patch).then(function () {
            if (gained.length) VW.ui.toast('🏆 新成就：' + gained.map(VW.points.achievementName).join('、'), 'ok');
          });
        }).then(function () { VW.ui.renderRoute(); });
        return;
      }
      // 普通测评：成绩落库、错词回收、积分
      const total = x.questions.length;
      const score = total ? x.correct * 100 / total : 0;
      const rec = {
        id: VW.util.uid(),
        type: x.type,
        typeName: x.typeName,
        date: today,
        at: Date.now(),
        total: total,
        correct: x.correct,
        score: Math.round(score),
        durationMs: x.durationMs,
        wrongKeys: Array.from(new Set(x.wrongKeys))
      };
      const uniqWrong = rec.wrongKeys;
      const jobs = [api.tests.save(rec)];
      uniqWrong.forEach(function (k) {
        jobs.push(api.states.get(k).then(function (st) {
          const base = st || VW.scheduler.newState(k);
          return api.states.save(VW.scheduler.manualWrong(base, true));
        }));
      });
      Promise.all(jobs).then(function () {
        return VW.settings.get().then(function (s) {
          const patch = {};
          if (score >= 80) patch.points = (s.points || 0) + VW.points.EVENTS.testPass;
          if (score >= 100) patch.testPerfect = (s.testPerfect || 0) + 1;
          const gained = VW.points.checkAchievements({
            learnedTotal: s.totalLearned || 0, streak: 0, wrongClearedTotal: s.totalWrongCleared || 0,
            booksCompleted: s.booksCompleted || 0, points: patch.points != null ? patch.points : (s.points || 0),
            challengeBest: s.challengeBest || 0, testPerfect: patch.testPerfect != null ? patch.testPerfect : (s.testPerfect || 0)
          }, s.achievements || []);
          if (gained.length) patch.achievements = (s.achievements || []).concat(gained);
          if (!Object.keys(patch).length) return null;
          return VW.settings.save(patch).then(function () { return gained; });
        }).then(function (gained) {
          if (gained && gained.length) VW.ui.toast('🏆 新成就：' + gained.map(VW.points.achievementName).join('、'), 'ok');
          if (score >= 80) VW.ui.toast('测评通过 ＋' + VW.points.EVENTS.testPass + ' 积分', 'ok');
          if (uniqWrong.length) VW.ui.toast(uniqWrong.length + ' 个错词已收入错词本', 'err');
        });
      }).then(function () { VW.ui.renderRoute(); });
    },

    renderResult: function (el) {
      const x = VW.testPage.state.exam;
      const total = x.questions.length;
      const score = x.type === 'challenge' ? x.score : (total ? Math.round(x.correct * 100 / total) : 0);
      el.innerHTML =
        '<div class="card" style="text-align:center;padding:26px 20px">' +
        '<div style="font-size:2.4rem">' + (x.type === 'challenge' ? '⚡' : score >= 80 ? '🎉' : '📝') + '</div>' +
        '<div style="font-size:1.3rem;font-weight:700;margin:8px 0">' + x.typeName + '完成</div>' +
        (x.type === 'challenge'
          ? '<div class="stat-num" style="color:var(--primary)">' + x.score + ' 分</div><div class="stat-label">限时挑战得分</div>'
          : '<div class="stat-num">' + x.correct + ' / ' + total + '</div><div class="stat-label">得分 ' + score + ' 分' + (score >= 80 ? '（通过）' : '') + '</div>') +
        '<div class="small muted" style="margin-top:6px">用时 ' + Math.round(x.durationMs / 1000) + ' 秒</div>' +
        '</div>';
      if (x.type !== 'challenge') {
        const uniq = Array.from(new Set(x.wrongKeys));
        const wrongCard = VW.ui.el('<div class="card" style="margin-top:14px"></div>');
        wrongCard.innerHTML = '<div class="card-title">错题（' + uniq.length + '）</div>' +
          (uniq.length ? uniq.map(function (k) {
            return '<div class="list-item"><b>' + VW.util.escapeHtml(k) + '</b></div>';
          }).join('') : '<div class="empty">全对！</div>');
        el.appendChild(wrongCard);
      }
      const foot = VW.ui.el('<div class="row" style="margin-top:16px;justify-content:center"></div>');
      const bAgain = VW.ui.el('<button class="btn primary big">再来一次</button>');
      bAgain.onclick = function () {
        VW.testPage.state.exam = null;
        VW.testPage.start(x.type, {});
      };
      const bBack = VW.ui.el('<button class="btn big">返回测评</button>');
      bBack.onclick = function () {
        VW.testPage.state.exam = null;
        VW.testPage.state.view = 'overview';
        VW.ui.renderRoute();
      };
      foot.appendChild(bAgain); foot.appendChild(bBack);
      el.appendChild(foot);
    }
  };

  // 键盘
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (ev) {
      if (!VW.testPage.state.exam || VW.testPage.state.view !== 'exam') return;
      if (!VW.testPage.keyHook) return;
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const hk = VW.testPage.keyHook;
      if (hk.kind === 'choice' && ev.key >= '1' && ev.key <= '9') {
        const idx = parseInt(ev.key, 10) - 1;
        if (hk.options[idx]) hk.options[idx].click();
      }
    });
  }
})();
