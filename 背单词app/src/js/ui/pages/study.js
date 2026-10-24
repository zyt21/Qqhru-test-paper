(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('study', { title: '学习', render: function (el) { VW.study.render(el); } });

  VW.study = {
    SESSION_KEY: 'active-session',
    MODES: [
      { id: 'all', name: '今日学习', ico: '📅', desc: '顽固 + 逾期 + 今日到期 + 新词' },
      { id: 'new', name: '新词学习', ico: '🌱', desc: '只学当日新词' },
      { id: 'review', name: '到期复习', ico: '🔁', desc: '今日到期、逾期与顽固词' },
      { id: 'unit', name: '闯关模式', ico: '🎮', desc: '按单元连续答对通关' },
      { id: 'listen', name: '听写模式', ico: '✍️', desc: '看中文释义拼英文（无音频版）' },
      { id: 'wrong', name: '错词专项', ico: '🎯', desc: '错词本集中强化' },
      { id: 'sprint', name: '考前冲刺', ico: '⚡', desc: '5 分钟限时高密度循环' }
    ],
    state: { view: 'overview', session: null, rng: null },

    // ================= 总览 =================
    render: function (el) {
      el.innerHTML = '';
      if (VW.study.state.view === 'session' && VW.study.state.session) {
        VW.study.renderSession(el);
        return;
      }
      if (VW.study.state.view === 'done' && VW.study.state.session) {
        VW.study.renderDone(el);
        return;
      }
      VW.study.state.view = 'overview';
      VW.study.renderOverview(el);
    },

    renderOverview: function (el) {
      const api = VW.store.api;
      Promise.all([api.books.list(), api.entries.list(), api.states.list(), VW.settings.get(), api.marks.get(VW.study.SESSION_KEY)])
        .then(function (r) {
          const books = r[0], entries = r[1], states = r[2], settings = r[3], savedSession = r[4];
          const sm = new Map(states.map(function (s) { return [s.id, s]; }));
          const today = VW.util.todayStr(settings.dayStartHour);
          const q = VW.queue.build({ books: books, entries: entries, statesById: sm, settings: settings, today: today });

          // 今日任务主卡
          const card = VW.ui.el('<div class="card" style="margin-bottom:14px"></div>');
          card.innerHTML =
            '<div class="card-title">📌 今日任务</div>' +
            '<div class="grid grid-4">' +
            '<div><div class="stat-num" style="color:var(--danger)">' + q.counts.stubborn + '</div><div class="stat-label">顽固词</div></div>' +
            '<div><div class="stat-num" style="color:var(--warn)">' + q.counts.overdue + '</div><div class="stat-label">逾期</div></div>' +
            '<div><div class="stat-num">' + q.counts.due + '</div><div class="stat-label">今日到期</div></div>' +
            '<div><div class="stat-num" style="color:var(--primary)">' + q.counts.newCount + '</div><div class="stat-label">新词（上限 ' + settings.newPerDay + '）</div></div>' +
            '</div>';
          const startBtn = VW.ui.el('<button class="btn primary big btn-block" style="margin-top:12px">▶ 开始学习</button>');
          startBtn.onclick = function () { VW.study.startSession('all', bookSel.value); };
          card.appendChild(startBtn);
          el.appendChild(card);

          // 继续上次学习
          if (savedSession && savedSession.data) {
            const s = savedSession.data;
            const c = VW.ui.el('<div class="card clickable" style="margin-bottom:14px;border-color:var(--primary)"></div>');
            c.innerHTML = '<div class="row-between"><div><div class="bold">⏸ 继续上次学习</div>' +
              '<div class="small muted">' + (VW.study.modeName(s.mode) || '') + ' · 进度 ' + s.index + '/' + s.queueKeys.length + '</div></div>' +
              '<button class="btn primary small">继续</button></div>';
            c.onclick = function () { VW.study.resumeSession(s); };
            el.appendChild(c);
          }

          // 词书选择
          const selRow = VW.ui.el('<div class="field"><label>学习词书</label><select id="study-book"></select></div>');
          const enabled = books.filter(function (b) { return b.enabled; });
          selRow.querySelector('select').innerHTML = enabled.map(function (b) {
            return '<option value="' + VW.util.escapeHtml(b.id) + '"' + (settings.defaultBookId === b.id ? ' selected' : '') + '>' + VW.util.escapeHtml(b.name) + '</option>';
          }).join('') || '<option value="">（无启用词书）</option>';
          el.appendChild(selRow);
          const bookSel = selRow.querySelector('select');

          // 模式宫格
          const grid = VW.ui.el('<div class="grid grid-3"></div>');
          VW.study.MODES.forEach(function (m) {
            const c = VW.ui.el('<div class="card clickable"></div>');
            c.innerHTML = '<div class="bold">' + m.ico + ' ' + m.name + '</div><div class="small muted" style="margin-top:4px">' + m.desc + '</div>';
            c.onclick = function () {
              if (m.id === 'unit') {
                VW.study.startUnit(bookSel.value);
              } else {
                VW.study.startSession(m.id, bookSel.value);
              }
            };
            grid.appendChild(c);
          });
          el.appendChild(grid);

          const hint = VW.ui.el('<div class="small muted" style="margin-top:14px">快捷键：<b>1-4</b> 选选项 · <b>→</b> 认识 · <b>←</b> 不认识 · <b>F</b> 翻卡 · <b>Enter</b> 确认</div>');
          el.appendChild(hint);
        });
    },

    modeName: function (id) {
      const m = VW.study.MODES.find(function (x) { return x.id === id; });
      return m ? m.name : id;
    },

    // 进入学习会话视图（自动导航到学习页）
    enterSession: function () {
      VW.study.state.view = 'session';
      if (VW.ui.currentRoute() !== 'study') location.hash = '#/study';
      else VW.ui.renderRoute();
    },

    // ================= 会话创建 =================
    loadContext: function () {
      const api = VW.store.api;
      return Promise.all([api.books.list(), api.entries.list(), api.states.list(), VW.settings.get()]).then(function (r) {
        const sm = new Map(r[2].map(function (s) { return [s.id, s]; }));
        const em = new Map(r[1].map(function (e) { return [e.id, e]; }));
        return { books: r[0], entries: r[1], states: r[2], settings: r[3], sm: sm, em: em };
      });
    },

    buildItems: function (mode, ctx, opts) {
      opts = opts || {};
      const settings = ctx.settings;
      const today = VW.util.todayStr(settings.dayStartHour);
      const base = { books: ctx.books, entries: ctx.entries, statesById: ctx.sm, settings: settings, today: today };
      if (opts.bookId) base.bookId = opts.bookId;
      if (opts.unit) base.unit = opts.unit;
      const q = VW.queue.build(base);
      switch (mode) {
        case 'new': return q.items.filter(function (i) { return i.reason === 'new'; });
        case 'review': return q.items.filter(function (i) { return ['stubborn', 'overdue', 'due'].indexOf(i.reason) >= 0; });
        case 'wrong': return VW.queue.buildWrong(base);
        case 'unit': return q.items.filter(function (i) { return true; });
        case 'listen': return q.items;
        case 'sprint': {
          let entries = ctx.entries.filter(function (e) { return VW.util.inBook(e, opts.bookId || settings.defaultBookId); });
          if (opts.unit) entries = entries.filter(function (e) { return e.unit === opts.unit; });
          return entries.map(function (e) { return { entry: e, state: ctx.sm.get(e.id) || null, reason: 'sprint' }; });
        }
        default: return q.items;
      }
    },

    startSession: function (mode, bookId) {
      VW.study.loadContext().then(function (ctx) {
        const items = VW.study.buildItems(mode, ctx, { bookId: bookId });
        if (!items.length) { VW.ui.toast('队列为空，没有需要学习的词', 'err'); return; }
        VW.study.state.session = VW.study.makeSession(mode, bookId, null, items, ctx);
        VW.study.enterSession();
      });
    },

    startUnit: function (bookId) {
      VW.study.loadContext().then(function (ctx) {
        const book = ctx.books.find(function (b) { return b.id === bookId; });
        if (!book) { VW.ui.toast('请先选择词书', 'err'); return; }
        const entries = ctx.entries.filter(function (e) { return VW.util.inBook(e, bookId); });
        const units = {};
        entries.forEach(function (e) { if (e.unit) units[e.unit] = 1; });
        const keys = Object.keys(units).sort();
        const body = VW.ui.el('<div class="small muted" style="margin-bottom:8px">选择要闯关的单元（全部答对即可通关）</div>');
        keys.forEach(function (u) {
          const cnt = entries.filter(function (e) { return e.unit === u; }).length;
          const b = VW.ui.el('<button class="btn btn-block" style="margin-bottom:8px"></button>');
          b.textContent = u + '（' + cnt + ' 词）';
          b.onclick = function () {
            m.close();
            const items = entries.filter(function (e) { return e.unit === u; }).map(function (e) {
              return { entry: e, state: ctx.sm.get(e.id) || null, reason: 'unit' };
            });
            VW.study.state.session = VW.study.makeSession('unit', bookId, u, items, ctx);
            VW.study.enterSession();
          };
          body.appendChild(b);
        });
        const m = VW.ui.openModal({ title: '闯关模式', body: body });
      });
    },

    makeSession: function (mode, bookId, unit, items, ctx) {
      const s = {
        id: VW.util.uid(),
        mode: mode, bookId: bookId, unit: unit || '',
        queueKeys: items.map(function (i) { return { key: i.entry.id, reason: i.reason }; }),
        index: 0,
        wordDone: {},      // key → {spellPassed, pendingSpell, seenLearn, final}
        wrongKeys: [],
        stats: { newLearned: 0, reviewed: 0, correct: 0, wrong: 0, fuzzy: 0, total: 0 },
        createdAt: Date.now(),
        startAt: Date.now()
      };
      s.ctx = { em: ctx.em, sm: ctx.sm, settings: ctx.settings, books: ctx.books };
      s.current = null;
      VW.study.persist(s);
      return s;
    },

    persist: function (s) {
      if (!s) {
        return VW.store.api.marks.remove(VW.study.SESSION_KEY);
      }
      const minimal = {
        id: s.id, mode: s.mode, bookId: s.bookId, unit: s.unit,
        queueKeys: s.queueKeys, index: s.index, wordDone: s.wordDone,
        wrongKeys: s.wrongKeys, stats: s.stats, createdAt: s.createdAt
      };
      return VW.store.api.marks.save({ id: VW.study.SESSION_KEY, kind: 'session', data: minimal });
    },

    resumeSession: function (saved) {
      VW.study.loadContext().then(function (ctx) {
        const s = saved;
        // 重建词条上下文（词条被删除则跳过）
        s.queueKeys = s.queueKeys.filter(function (it) { return ctx.em.has(it.key); });
        s.ctx = { em: ctx.em, sm: ctx.sm, settings: ctx.settings, books: ctx.books };
        s.current = null;
        VW.study.state.session = s;
        VW.study.enterSession();
      });
    },

    // ================= 会话主流程 =================
    renderSession: function (el) {
      const s = VW.study.state.session;
      if (!s) { VW.study.state.view = 'overview'; VW.study.renderOverview(el); return; }
      const total = s.queueKeys.length;
      const done = s.index;
      el.innerHTML =
        '<div class="row-between" style="margin-bottom:10px">' +
        '<div><span class="small muted">' + VW.study.modeName(s.mode) + (s.unit ? ' · ' + VW.util.escapeHtml(s.unit) : '') + '</span>' +
        '<div class="small bold">' + done + ' / ' + total + '</div></div>' +
        '<button class="btn small ghost" id="st-exit">退出并保存</button>' +
        '</div>' +
        '<div class="progress" style="margin-bottom:16px"><i style="width:' + (total ? done * 100 / total : 0) + '%"></i></div>' +
        '<div id="st-question"></div>' +
        '<div id="st-foot"></div>';
      el.querySelector('#st-exit').onclick = function () {
        VW.study.persist(s).then(function () {
          VW.study.state.view = 'overview';
          VW.ui.toast('进度已保存，下次从这里继续');
          VW.ui.renderRoute();
        });
      };
      VW.study.next(s);
    },

    next: function (s) {
      const qEl = document.getElementById('st-question');
      const fEl = document.getElementById('st-foot');
      if (!qEl) return; // 已离开会话页
      if (s.current && s.current.pendingSpell) {
        VW.study.showSpell(s, s.current);
        return;
      }
      if (s.index >= s.queueKeys.length) {
        VW.study.finish(s);
        return;
      }
      const it = s.queueKeys[s.index];
      const entry = s.ctx.em.get(it.key);
      if (!entry) { s.index++; VW.study.next(s); return; }
      const wd = s.wordDone[it.key] || (s.wordDone[it.key] = { spellPassed: false, pendingSpell: false, seenLearn: false, final: null });
      const isNew = it.reason === 'new' && !s.ctx.sm.get(it.key);
      const cur = s.current = { key: it.key, entry: entry, reason: it.reason, isNew: isNew, pendingSpell: false };
      if (isNew && !wd.seenLearn) {
        wd.seenLearn = true;
        VW.study.showLearn(s, cur);
        return;
      }
      // 选题型
      let kind;
      if (s.mode === 'listen') kind = 'spell';
      else {
        const roll = s.rng ? s.rng() : Math.random();
        if (roll < 0.10) kind = 'card';
        else if (roll < 0.35) kind = 'en2zh';
        else if (roll < 0.55) kind = 'zh2en';
        else if (roll < 0.80) kind = 'spell';
        else if (roll < 0.90) kind = 'example';
        else kind = 'discriminate';
      }
      const pool = Array.from(s.ctx.em.values()).filter(function (e) { return VW.util.sharesBook(e, entry); });
      const q = VW.quiz.buildQuestion(entry, kind, pool, { rng: s.rng || undefined });
      cur.question = q;
      cur.kind = kind;
      VW.study.showQuestion(s, cur);
    },

    // ---- 新词学习卡 ----
    showLearn: function (s, cur) {
      const e = cur.entry;
      const qEl = document.getElementById('st-question');
      qEl.innerHTML =
        '<div class="card" style="text-align:center;padding:26px 20px">' +
        '<div class="chip">新词学习</div>' +
        '<div style="font-size:2rem;font-weight:700;margin:14px 0 4px">' + VW.util.escapeHtml(e.spelling) + '</div>' +
        '<div class="muted">' + VW.util.escapeHtml(e.phoneticUK || '') + (e.phoneticUS ? ' / 美 ' + VW.util.escapeHtml(e.phoneticUS) : '') + '</div>' +
        '<div style="margin-top:14px;font-size:1.05rem">' + (e.senses || []).map(function (s2) {
          return '<div style="margin-bottom:4px"><span class="chip">' + VW.util.escapeHtml(s2.pos || '—') + '</span> ' + VW.util.escapeHtml(s2.zh) + '</div>';
        }).join('') + '</div>' +
        (e.examples && e.examples.length ? '<div class="card" style="margin-top:12px;padding:10px 14px;text-align:left"><div class="small">' + VW.util.escapeHtml(e.examples[0].en) + '</div><div class="small muted">' + VW.util.escapeHtml(e.examples[0].zh) + '</div></div>' : '') +
        (e.collocations && e.collocations.length ? '<div class="small muted" style="margin-top:8px">搭配：' + VW.util.escapeHtml(e.collocations.join('；')) + '</div>' : '') +
        (e.roots ? '<div class="small muted">词根：' + VW.util.escapeHtml(e.roots) + '</div>' : '') +
        (e.mnemonic ? '<div class="small muted">助记：' + VW.util.escapeHtml(e.mnemonic) + '</div>' : '') +
        '</div>';
      const fEl = document.getElementById('st-foot');
      fEl.innerHTML = '<div class="row" style="justify-content:center">' +
        '<button class="btn danger" id="st-unknown">不认识</button>' +
        '<button class="btn primary big" id="st-know">继续 →</button></div>';
      fEl.querySelector('#st-know').onclick = function () { VW.study.showRecognitionAfterLearn(s, cur); };
      fEl.querySelector('#st-unknown').onclick = function () { VW.study.finalize(s, cur, 'unknown'); };
    },

    showRecognitionAfterLearn: function (s, cur) {
      const e = cur.entry;
      const pool = Array.from(s.ctx.em.values()).filter(function (x) { return VW.util.sharesBook(x, e); });
      const q = VW.quiz.buildQuestion(e, 'en2zh', pool, { rng: s.rng || undefined });
      cur.question = q;
      cur.kind = 'en2zh';
      VW.study.showQuestion(s, cur);
    },

    // ---- 普通题 ----
    showQuestion: function (s, cur) {
      const q = cur.question;
      const qEl = document.getElementById('st-question');
      const fEl = document.getElementById('st-foot');
      const kind = q.kind;
      const html = { head: '', body: '', foot: '' };
      if (kind === 'card') {
        html.head = '<div class="chip">卡片 · 先回忆再翻面</div>';
        html.body =
          '<div class="card" id="st-card" style="text-align:center;padding:60px 20px;touch-action:pan-y;user-select:none;cursor:grab">' +
          '<div class="card-inner" style="transition:transform .15s">' +
          '<div style="font-size:2.2rem;font-weight:700">' + VW.util.escapeHtml(q.prompt.spelling) + '</div>' +
          '<div class="muted">' + VW.util.escapeHtml(q.prompt.phonetic) + '</div>' +
          '<div class="muted small" style="margin-top:18px;display:none" id="st-card-back">' + VW.util.escapeHtml(q.prompt.back) + '</div>' +
          '<div class="small muted" style="margin-top:14px">点击或按 F 翻面</div>' +
          '</div></div>';
        html.foot = '<div class="row" style="justify-content:center">' +
          '<button class="btn danger big" id="st-no">← 不认识</button>' +
          '<button class="btn ghost big" id="st-fuzzy">模糊</button>' +
          '<button class="btn ok big" id="st-yes">认识 →</button></div>';
      } else if (kind === 'spell') {
        html.head = '<div class="chip">拼写填空 · ' + (cur.pendingSpell ? '验证' : '') + '</div>';
        html.body =
          '<div class="card">' +
          '<div style="font-size:1.15rem;font-weight:600">' + VW.util.escapeHtml(q.prompt.zh) + '</div>' +
          (q.prompt.example ? '<div class="small muted" style="margin-top:6px">' + VW.util.escapeHtml(q.prompt.example.en) + '</div>' : '') +
          '<div class="row" style="margin-top:14px">' +
          '<input id="st-spell" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="font-size:1.3rem;letter-spacing:2px" placeholder="' + q.prompt.length + ' 个字母，首字母 ' + q.prompt.firstLetter.toUpperCase() + '">' +
          '</div>' +
          '<div class="row" style="margin-top:10px">' +
          '<button class="btn small ghost" id="st-hint1">提示首字母</button>' +
          '<button class="btn small ghost" id="st-hint2">乱序字母</button>' +
          '<span class="small muted" id="st-scrambled" style="display:none"></span>' +
          '</div></div>';
        html.foot = '<div class="row" style="justify-content:center"><button class="btn primary big" id="st-submit">确认</button></div>';
      } else {
        // 选择类
        const kindName = { en2zh: '英→中 · 选择正确释义', zh2en: '中→英 · 选择正确单词', example: '例句填空', discriminate: '易混词辨析' }[kind];
        html.head = '<div class="chip">' + kindName + '</div>';
        let promptHtml = '';
        if (kind === 'en2zh') promptHtml = '<div style="font-size:1.8rem;font-weight:700">' + VW.util.escapeHtml(q.prompt.spelling) + '</div><div class="muted">' + VW.util.escapeHtml(q.prompt.phonetic) + '</div>';
        else if (kind === 'zh2en') promptHtml = '<div style="font-size:1.25rem;font-weight:600">' + VW.util.escapeHtml(q.prompt.zh) + '</div>';
        else if (kind === 'example') promptHtml = '<div class="small muted">' + VW.util.escapeHtml(q.prompt.zh) + '</div><div style="font-size:1.1rem;margin-top:6px">' + VW.util.escapeHtml(q.prompt.sentence) + '</div>';
        else promptHtml = '<div style="font-size:1.25rem;font-weight:600">「' + VW.util.escapeHtml(q.prompt.zh) + '」对应的单词是？</div><div class="small muted">易混：' + VW.util.escapeHtml(q.prompt.confuseZh) + '</div>';
        html.body = '<div class="card">' + promptHtml + '</div><div class="grid grid-2" style="margin-top:12px" id="st-opts">' +
          q.options.map(function (o, i) {
            return '<button class="btn option-btn" data-i="' + i + '" style="padding:14px;font-size:1rem;text-align:left;white-space:normal">' + (i + 1) + '. ' + VW.util.escapeHtml(o) + '</button>';
          }).join('') + '</div>';
        html.foot = '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost" id="st-fuzzy">模糊</button></div>';
      }

      qEl.innerHTML = html.head + html.body;
      fEl.innerHTML = html.foot;

      if (kind === 'card') {
        const card = qEl.querySelector('#st-card');
        const back = qEl.querySelector('#st-card-back');
        let flipped = false;
        function flip() {
          flipped = !flipped;
          back.style.display = flipped ? '' : 'none';
          card.querySelector('.card-inner').style.transform = flipped ? 'rotateY(360deg)' : '';
        }
        card.onclick = flip;
        fEl.querySelector('#st-yes').onclick = function () { VW.study.afterRecognition(s, cur, 'know'); };
        fEl.querySelector('#st-no').onclick = function () { VW.study.finalize(s, cur, 'unknown'); };
        fEl.querySelector('#st-fuzzy').onclick = function () { VW.study.finalize(s, cur, 'fuzzy'); };
        // 左右滑
        let sx = null, dx = 0;
        card.addEventListener('pointerdown', function (ev) { sx = ev.clientX; dx = 0; card.setPointerCapture(ev.pointerId); });
        card.addEventListener('pointermove', function (ev) {
          if (sx == null) return;
          dx = ev.clientX - sx;
          card.querySelector('.card-inner').style.transform = 'translateX(' + dx + 'px)';
        });
        card.addEventListener('pointerup', function () {
          if (sx == null) return;
          if (dx > 80) VW.study.afterRecognition(s, cur, 'know');
          else if (dx < -80) VW.study.finalize(s, cur, 'unknown');
          else card.querySelector('.card-inner').style.transform = '';
          sx = null; dx = 0;
        });
        card.addEventListener('pointercancel', function () { sx = null; card.querySelector('.card-inner').style.transform = ''; });
        VW.study.keyHook = { kind: 'card', onFlip: flip };
      } else if (kind === 'spell') {
        const input = qEl.querySelector('#st-spell');
        input.focus();
        const submit = function () {
          const val = input.value.trim();
          if (!val) return;
          if (VW.quiz.judge(q, val)) VW.study.spellPassed(s, cur, true);
          else VW.study.spellPassed(s, cur, false);
        };
        fEl.querySelector('#st-submit').onclick = submit;
        input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
        qEl.querySelector('#st-hint1').onclick = function () {
          input.value = q.prompt.firstLetter.toLowerCase() + input.value.slice(1);
          input.focus();
        };
        qEl.querySelector('#st-hint2').onclick = function () {
          const el2 = qEl.querySelector('#st-scrambled');
          el2.style.display = '';
          el2.textContent = '乱序字母：' + q.prompt.scrambled;
        };
        VW.study.keyHook = { kind: 'spell' };
      } else {
        qEl.querySelectorAll('.option-btn').forEach(function (b) {
          b.onclick = function () {
            const i = parseInt(b.dataset.i, 10);
            const ok = q.options[i] === q.correct;
            VW.study.afterRecognition(s, cur, ok ? 'know' : 'unknown', b);
          };
        });
        fEl.querySelector('#st-fuzzy').onclick = function () { VW.study.finalize(s, cur, 'fuzzy'); };
        VW.study.keyHook = { kind: 'choice', options: qEl.querySelectorAll('.option-btn') };
      }
    },

    // 认词/选择题：答“认识”可能触发拼写验证
    afterRecognition: function (s, cur, verdict, btnEl) {
      if (verdict === 'unknown') {
        if (btnEl) btnEl.classList.add('danger');
        VW.study.finalize(s, cur, 'unknown', btnEl);
        return;
      }
      const wd = s.wordDone[cur.key];
      const settings = s.ctx.settings;
      if (VW.quiz.needsSpellVerify(cur.kind, settings) && !wd.spellPassed) {
        wd.pendingSpell = true;
        cur.pendingSpell = true;
        VW.study.feedback(s, cur, 'know-pending', '认识！再来一次拼写确认');
      } else {
        VW.study.finalize(s, cur, 'know', btnEl);
      }
    },

    showSpell: function (s, cur) {
      const e = cur.entry;
      const pool = Array.from(s.ctx.em.values()).filter(function (x) { return VW.util.sharesBook(x, e); });
      const q = VW.quiz.buildQuestion(e, 'spell', pool, { rng: s.rng || undefined });
      cur.question = q;
      cur.kind = 'spell';
      VW.study.showQuestion(s, cur);
    },

    spellPassed: function (s, cur, ok) {
      const wd = s.wordDone[cur.key];
      wd.spellPassed = true;
      if (ok) {
        VW.study.finalize(s, cur, 'know');
      } else {
        VW.study.finalize(s, cur, 'unknown');
      }
    },

    // 答题反馈
    feedback: function (s, cur, result, msg) {
      const qEl = document.getElementById('st-question');
      const fEl = document.getElementById('st-foot');
      const e = cur.entry;
      const good = result === 'know' || result === 'know-pending';
      const wrong = result === 'unknown';
      qEl.innerHTML =
        '<div class="card" style="border-color:' + (good ? 'var(--ok)' : wrong ? 'var(--danger)' : 'var(--warn)') + '">' +
        '<div class="bold" style="color:' + (good ? 'var(--ok)' : wrong ? 'var(--danger)' : 'var(--warn)') + '">' +
        (good ? '✓ ' + (msg || '回答正确') : wrong ? '✗ 回答错误' : '△ ' + (msg || '有点模糊')) + '</div>' +
        '<div style="margin-top:10px"><span style="font-size:1.3rem;font-weight:700">' + VW.util.escapeHtml(e.spelling) + '</span> ' +
        '<span class="muted">' + VW.util.escapeHtml(e.phoneticUK || '') + '</span></div>' +
        '<div style="margin-top:6px">' + (e.senses || []).map(function (s2) {
          return '<div><span class="chip">' + VW.util.escapeHtml(s2.pos || '—') + '</span> ' + VW.util.escapeHtml(s2.zh) + '</div>';
        }).join('') + '</div>' +
        (e.examples && e.examples.length ? '<div class="small muted" style="margin-top:8px">' + VW.util.escapeHtml(e.examples[0].en) + '<br>' + VW.util.escapeHtml(e.examples[0].zh) + '</div>' : '') +
        '</div>';
      fEl.innerHTML = '<div class="row" style="justify-content:center"><button class="btn primary big" id="st-continue">继续</button></div>';
      fEl.querySelector('#st-continue').onclick = function () { VW.study.next(s); };
    },

    // 单词结案
    finalize: function (s, cur, verdict, btnEl) {
      const key = cur.key;
      const wd = s.wordDone[key];
      const api = VW.store.api;
      const settings = s.ctx.settings;
      const today = VW.util.todayStr(settings.dayStartHour);
      const nowIso = new Date().toISOString();
      const oldState = s.ctx.sm.get(key);

      // 流水
      api.logs.save({
        id: VW.util.uid(),
        key: key,
        bookId: cur.entry.bookId,
        kind: cur.kind,
        mode: s.mode,
        correct: verdict === 'know',
        verdict: verdict,
        stageBefore: oldState ? (oldState.stage != null ? oldState.stage : -1) : -1,
        at: nowIso,
        date: today
      });

      // 状态更新
      const isFirst = !oldState || !oldState.firstLearnedAt;
      let st = oldState || VW.scheduler.newState(key, nowIso);
      const opts = {
        today: today,
        intervals: settings.intervals,
        stubbornThreshold: settings.stubbornThreshold,
        wrongExitStreak: settings.wrongExitStreak,
        dayStartHour: settings.dayStartHour,
        nowIso: nowIso
      };
      if (isFirst) st = VW.scheduler.firstLearn(st, opts);
      st = VW.scheduler.applyResult(st, verdict, opts);
      api.states.save(st);
      s.ctx.sm.set(key, st);

      // 积分事件统计
      if (verdict === 'know' && cur.kind === 'spell') s.stats.spellPass = (s.stats.spellPass || 0) + 1;
      if (oldState && oldState.inWrongBook && !st.inWrongBook) s.stats.wrongCleared = (s.stats.wrongCleared || 0) + 1;

      // 统计
      if (verdict === 'know') s.stats.correct++;
      else if (verdict === 'wrong' || verdict === 'unknown') { s.stats.wrong++; s.wrongKeys.push(key); }
      else s.stats.fuzzy++;
      s.stats.total++;
      if (isFirst) s.stats.newLearned++; else s.stats.reviewed++;
      wd.final = verdict;
      wd.pendingSpell = false;

      // 闯关/冲刺：未答对 → 队尾重排
      if ((s.mode === 'unit' || s.mode === 'sprint') && verdict !== 'know') {
        s.queueKeys.push({ key: key, reason: 'retry' });
      }

      s.current = null;
      s.index++;
      VW.study.persist(s);
      VW.study.feedback(s, cur, verdict);
      VW.study.afterAnswerHook(s, key, verdict);
    },

    afterAnswerHook: function (s, key, verdict) {
      // P4 积分/成就钩子
      if (VW.points && VW.points.onAnswer) VW.points.onAnswer(s, key, verdict);
    },

    // 结算
    finish: function (s) {
      const api = VW.store.api;
      const settings = s.ctx.settings;
      const today = VW.util.todayStr(settings.dayStartHour);
      api.daily.get(today).then(function (d) {
        const wasChecked = !!(d && d.checkedIn);
        const doc = Object.assign({ id: today, date: today, newCount: 0, reviewCount: 0, correctCount: 0, totalCount: 0, checkedIn: false }, d);
        doc.newCount += s.stats.newLearned;
        doc.reviewCount += s.stats.reviewed;
        doc.correctCount += s.stats.correct;
        doc.totalCount += s.stats.total;
        doc.checkedIn = true;
        return api.daily.save(doc).then(function () {
          if (VW.points && VW.points.recordCheckin) {
            return VW.points.recordCheckin(wasChecked).then(function (chk) {
              if (chk && chk.gained && chk.gained.length) {
                VW.ui.toast('🏆 新成就：' + chk.gained.map(VW.points.achievementName).join('、'), 'ok');
              }
            });
          }
        });
      }).then(function () {
        return VW.study.persist(null);
      }).then(function () {
        if (VW.points && VW.points.recordSession) {
          return VW.points.recordSession(s).then(function (r) {
            if (r && r.gained && r.gained.length) {
              VW.ui.toast('🏆 新成就：' + r.gained.map(VW.points.achievementName).join('、'), 'ok');
            }
            if (r && r.addedPoints) VW.ui.toast('＋' + r.addedPoints + ' 积分', 'ok');
          });
        }
      }).then(function () {
        VW.study.state.view = 'done';
        VW.ui.renderRoute();
      });
    },

    renderDone: function (el) {
      const s = VW.study.state.session;
      const st = s.stats;
      const acc = st.total ? Math.round((st.correct + st.fuzzy) * 100 / st.total) : 0;
      el.innerHTML =
        '<div class="card" style="text-align:center;padding:28px 20px">' +
        '<div style="font-size:2.4rem">🎉</div>' +
        '<div style="font-size:1.3rem;font-weight:700;margin:8px 0">本轮学习完成</div>' +
        '<div class="small muted">' + VW.study.modeName(s.mode) + (s.unit ? ' · ' + VW.util.escapeHtml(s.unit) : '') + '</div>' +
        '<div class="grid grid-4" style="margin-top:18px">' +
        '<div><div class="stat-num">' + st.total + '</div><div class="stat-label">作答</div></div>' +
        '<div><div class="stat-num" style="color:var(--ok)">' + st.correct + '</div><div class="stat-label">认识</div></div>' +
        '<div><div class="stat-num" style="color:var(--warn)">' + st.fuzzy + '</div><div class="stat-label">模糊</div></div>' +
        '<div><div class="stat-num" style="color:var(--danger)">' + st.wrong + '</div><div class="stat-label">不认识</div></div>' +
        '</div>' +
        '<div class="small muted" style="margin-top:10px">新学 ' + st.newLearned + ' 词 · 复习 ' + st.reviewed + ' 词 · 正确率 ' + acc + '%</div>' +
        '</div>';
      const wrongList = VW.ui.el('<div class="card" style="margin-top:14px"></div>');
      const uniqWrong = Array.from(new Set(s.wrongKeys)).map(function (k) { return s.ctx ? s.ctx.em.get(k) : null; }).filter(Boolean);
      if (uniqWrong.length) {
        wrongList.innerHTML = '<div class="card-title">本轮答错的词（' + uniqWrong.length + '）</div>' +
          uniqWrong.map(function (e) {
            return '<div class="list-item"><div><b>' + VW.util.escapeHtml(e.spelling) + '</b> <span class="small muted">' +
              VW.util.escapeHtml((e.senses || []).map(function (x) { return x.zh; }).join('；').slice(0, 50)) + '</span></div></div>';
          }).join('');
      } else {
        wrongList.innerHTML = '<div class="empty">本轮全对，没有错词 🎯</div>';
      }
      el.appendChild(wrongList);
      const foot = VW.ui.el('<div class="row" style="margin-top:16px;justify-content:center;flex-wrap:wrap"></div>');
      const bAgain = VW.ui.el('<button class="btn primary big">🔄 再学一遍错词</button>');
      bAgain.onclick = function () {
        VW.study.loadContext().then(function (ctx) {
          const keys = Array.from(new Set(s.wrongKeys)).filter(function (k) { return ctx.em.has(k); });
          if (!keys.length) { VW.ui.toast('没有错词', 'err'); return; }
          const items = keys.map(function (k) {
            return { entry: ctx.em.get(k), state: ctx.sm.get(k) || null, reason: 'retry' };
          });
          VW.study.state.session = VW.study.makeSession('review', s.bookId, '', items, ctx);
          VW.study.enterSession();
        });
      };
      const bHome = VW.ui.el('<button class="btn big">返回学习页</button>');
      bHome.onclick = function () {
        VW.study.state.session = null;
        VW.study.state.view = 'overview';
        VW.ui.renderRoute();
      };
      if (uniqWrong.length) foot.appendChild(bAgain);
      foot.appendChild(bHome);
      el.appendChild(foot);
    }
  };

  // 全局键盘快捷键
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (ev) {
      const s = VW.study.state.session;
      if (!s || VW.study.state.view !== 'session') return;
      if (!VW.study.keyHook) return;
      const tag = (ev.target && ev.target.tagName) || '';
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
      const hk = VW.study.keyHook;
      if (inInput) return; // 输入框内不劫持
      if (hk.kind === 'choice' && ev.key >= '1' && ev.key <= '9') {
        const idx = parseInt(ev.key, 10) - 1;
        if (hk.options[idx]) hk.options[idx].click();
      } else if (ev.key === 'ArrowRight' || ev.key === 'Enter' || ev.key === ' ') {
        const yes = document.getElementById('st-yes') || document.getElementById('st-know');
        if (yes) yes.click();
        else if (hk.kind === 'card') { /* 无按钮时忽略 */ }
        ev.preventDefault();
      } else if (ev.key === 'ArrowLeft') {
        const no = document.getElementById('st-no') || document.getElementById('st-unknown');
        if (no) no.click();
        ev.preventDefault();
      } else if (ev.key === 'f' || ev.key === 'F') {
        if (hk.onFlip) hk.onFlip();
      }
    });
  }
})();
