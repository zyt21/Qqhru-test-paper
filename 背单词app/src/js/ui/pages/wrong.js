(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('wrong', { title: '错词', render: function (el) { VW.wrong.render(el); } });

  VW.wrong = {
    state: { tab: 'wrong' },
    TABS: [
      { id: 'wrong', name: '错词本', ico: '❌' },
      { id: 'stubborn', name: '顽固词', ico: '🔥' },
      { id: 'raw', name: '生词本', ico: '📥' },
      { id: 'confuse', name: '易混词', ico: '🧩' },
      { id: 'favorite', name: '收藏', ico: '⭐' },
      { id: 'notes', name: '笔记', ico: '📝' }
    ],

    render: function (el) {
      el.innerHTML = '';
      const tabs = VW.ui.el('<div class="tabs"></div>');
      VW.wrong.TABS.forEach(function (t) {
        const b = VW.ui.el('<button class="tab' + (VW.wrong.state.tab === t.id ? ' active' : '') + '"></button>');
        b.textContent = t.ico + ' ' + t.name;
        b.onclick = function () {
          VW.wrong.state.tab = t.id;
          VW.ui.renderRoute();
        };
        tabs.appendChild(b);
      });
      el.appendChild(tabs);
      const body = VW.ui.el('<div id="wrong-body"></div>');
      el.appendChild(body);
      VW.wrong.renderTab(body);
    },

    load: function () {
      const api = VW.store.api;
      return Promise.all([api.entries.list(), api.states.list(), api.marks.list(), api.groups.list()]).then(function (r) {
        return {
          entries: r[0],
          em: new Map(r[0].map(function (e) { return [e.id, e]; })),
          states: r[1],
          sm: new Map(r[1].map(function (s) { return [s.id, s]; })),
          marks: r[2],
          groups: r[3]
        };
      });
    },

    renderTab: function (body) {
      const t = VW.wrong.state.tab;
      VW.wrong.load().then(function (d) {
        body.innerHTML = '';
        if (t === 'wrong') VW.wrong.renderWrong(body, d);
        else if (t === 'stubborn') VW.wrong.renderStubborn(body, d);
        else if (t === 'raw') VW.wrong.renderRaw(body, d);
        else if (t === 'confuse') VW.wrong.renderConfuse(body, d);
        else if (t === 'favorite') VW.wrong.renderFavorite(body, d);
        else VW.wrong.renderNotes(body, d);
      });
    },

    itemHtml: function (e, st, extraRight) {
      return '<div class="list-item"><div style="flex:1;min-width:200px">' +
        '<b>' + VW.util.escapeHtml(e.spelling) + '</b> <span class="small muted">' + VW.util.escapeHtml(e.phoneticUK || '') + '</span>' +
        '<div class="small muted">' + VW.util.escapeHtml((e.senses || []).map(function (s) { return s.zh; }).join('；').slice(0, 60)) + '</div>' +
        (st ? '<div class="small muted" style="margin-top:2px">错误 ' + (st.errorCount || 0) + ' 次 · 连对 ' + (st.consecutiveCorrect || 0) + ' 次 · ' + VW.stats.masteryLabel(st) + '</div>' : '') +
        '</div><div class="row" style="gap:6px">' + (extraRight || '') + '</div></div>';
    },

    // ---- 错词本 ----
    renderWrong: function (body, d) {
      const list = d.states.filter(function (s) { return s.inWrongBook && d.em.has(s.id); });
      const head = VW.ui.el('<div class="row-between" style="margin-bottom:10px"></div>');
      const info = VW.ui.el('<div class="small muted">共 ' + list.length + ' 词 · 连续答对 N 次自动移出</div>');
      VW.settings.get().then(function (s) {
        info.textContent = '共 ' + list.length + ' 词 · 连续答对 ' + s.wrongExitStreak + ' 次自动移出';
      });
      const btns = VW.ui.el('<div class="row"></div>');
      const bReview = VW.ui.el('<button class="btn primary small">🎯 错词专项复习</button>');
      bReview.onclick = function () { VW.study.startSession('wrong'); };
      const bTest = VW.ui.el('<button class="btn small">📝 错词测试</button>');
      bTest.onclick = function () { location.hash = '#/test?range=wrong'; };
      btns.appendChild(bReview); btns.appendChild(bTest);
      head.appendChild(info); head.appendChild(btns);
      body.appendChild(head);
      if (!list.length) { body.appendChild(VW.ui.empty('错词本是空的。学习中答错的词会自动进入这里。')); return; }
      list.sort(function (a, b) { return (b.errorCount || 0) - (a.errorCount || 0); });
      list.forEach(function (st) {
        const e = d.em.get(st.id);
        const item = VW.ui.el(VW.wrong.itemHtml(e, st,
          '<button class="btn small" data-a="view">查看</button>' +
          '<button class="btn small ghost" data-a="out">移出</button>'
        ));
        item.querySelector('[data-a=view]').onclick = function () { VW.dict.showDetail(e.id); };
        item.querySelector('[data-a=out]').onclick = function () {
          VW.store.api.states.save(VW.scheduler.manualWrong(st, false)).then(function () {
            VW.ui.toast('已移出错词本', 'ok');
            VW.ui.renderRoute();
          });
        };
        body.appendChild(item);
      });
    },

    exitStreak: function () {
      return VW.settings.get().then(function (s) { return s.wrongExitStreak; });
    },

    // ---- 顽固词 ----
    renderStubborn: function (body, d) {
      const list = d.states.filter(function (s) { return s.stubborn && d.em.has(s.id); });
      const info = VW.ui.el('<div class="small muted" style="margin-bottom:10px">顽固词每天都会出现在队列最前，连续答对 2 次自动退出。当前 ' + list.length + ' 个。</div>');
      body.appendChild(info);
      const bReview = VW.ui.el('<button class="btn primary small" style="margin-bottom:10px">🔥 强化顽固词</button>');
      bReview.onclick = function () { VW.study.startSession('review'); };
      body.appendChild(bReview);
      if (!list.length) { body.appendChild(VW.ui.empty('暂无顽固词。累计答错 3 次以上的词会进入这里。')); return; }
      list.forEach(function (st) {
        const e = d.em.get(st.id);
        const item = VW.ui.el(VW.wrong.itemHtml(e, st,
          '<button class="btn small" data-a="view">查看</button>'
        ));
        item.querySelector('[data-a=view]').onclick = function () { VW.dict.showDetail(e.id); };
        body.appendChild(item);
      });
    },

    // ---- 生词本 ----
    renderRaw: function (body, d) {
      const raws = d.marks.filter(function (m) { return m.kind === 'raw' && d.em.has(m.key); });
      const head = VW.ui.el('<div class="row-between" style="margin-bottom:10px"></div>');
      const info = VW.ui.el('<div class="small muted">共 ' + raws.length + ' 词（在词典详情页可加入生词本）</div>');
      const btns = VW.ui.el('<div class="row"></div>');
      const bLearn = VW.ui.el('<button class="btn primary small">📖 学习生词本</button>');
      bLearn.onclick = function () {
        VW.study.loadContext().then(function (ctx) {
          const keys = raws.map(function (m) { return m.key; }).filter(function (k) { return ctx.em.has(k); });
          if (!keys.length) { VW.ui.toast('生词本为空', 'err'); return; }
          const items = keys.map(function (k) {
            return { entry: ctx.em.get(k), state: ctx.sm.get(k) || null, reason: 'raw' };
          });
          VW.study.state.session = VW.study.makeSession('review', null, '', items, ctx);
          VW.study.enterSession();
        });
      };
      btns.appendChild(bLearn);
      head.appendChild(info); head.appendChild(btns);
      body.appendChild(head);
      if (!raws.length) { body.appendChild(VW.ui.empty('生词本是空的。')); return; }
      raws.forEach(function (m) {
        const e = d.em.get(m.key);
        const st = d.sm.get(m.key);
        const item = VW.ui.el(VW.wrong.itemHtml(e, st,
          '<button class="btn small" data-a="view">查看</button>' +
          '<button class="btn small ghost" data-a="out">移出</button>'
        ));
        item.querySelector('[data-a=view]').onclick = function () { VW.dict.showDetail(e.id); };
        item.querySelector('[data-a=out]').onclick = function () {
          VW.store.api.marks.remove(m.id).then(function () {
            VW.ui.toast('已移出生词本', 'ok');
            VW.ui.renderRoute();
          });
        };
        body.appendChild(item);
      });
    },

    // ---- 易混词 ----
    renderConfuse: function (body, d) {
      const head = VW.ui.el('<div class="row-between" style="margin-bottom:10px"></div>');
      head.appendChild(VW.ui.el('<div class="small muted">自动推荐形近、近义、同根词对；可手动创建分组</div>'));
      const bNew = VW.ui.el('<button class="btn small">＋ 手动分组</button>');
      bNew.onclick = function () { VW.wrong.openGroupEditor(null, d); };
      head.appendChild(bNew);
      body.appendChild(head);

      const manualGroups = d.groups.filter(function (g) { return g.kind === 'confuse' && g.source === 'manual'; });
      manualGroups.forEach(function (g) {
        const card = VW.ui.el('<div class="card" style="margin-bottom:10px"></div>');
        const members = g.members.map(function (k) { return d.em.get(k); }).filter(Boolean);
        card.innerHTML = '<div class="card-title">' + VW.util.escapeHtml(g.name || '手动分组') +
          '<div class="row" style="gap:6px"><button class="btn small" data-a="edit">编辑</button><button class="btn small danger" data-a="del">删除</button></div></div>' +
          members.map(function (e) {
            return '<div class="list-item"><b>' + VW.util.escapeHtml(e.spelling) + '</b> <span class="small muted">' + VW.util.escapeHtml((e.senses || []).map(function (s) { return s.zh; }).join('；').slice(0, 40)) + '</span></div>';
          }).join('');
        card.querySelector('[data-a=edit]').onclick = function () { VW.wrong.openGroupEditor(g, d); };
        card.querySelector('[data-a=del]').onclick = function () {
          VW.ui.confirm({ title: '删除分组', message: '确定删除该易混分组？', danger: true, okText: '删除' }).then(function (ok) {
            if (ok) VW.store.api.groups.remove(g.id).then(function () { VW.ui.renderRoute(); });
          });
        };
        body.appendChild(card);
      });

      const groups = VW.quiz.buildConfuseGroups(d.entries, { maxPairs: 12 });
      groups.forEach(function (grp) {
        if (!grp.pairs.length) return;
        const card = VW.ui.el('<div class="card" style="margin-bottom:10px"></div>');
        card.innerHTML = '<div class="card-title">' + grp.kind + '词（' + grp.pairs.length + ' 组）</div>';
        grp.pairs.forEach(function (pair) {
          const row = VW.ui.el('<div class="list-item"></div>');
          row.innerHTML = '<div style="flex:1">' + pair.map(function (e) {
            return '<b>' + VW.util.escapeHtml(e.spelling) + '</b> <span class="small muted">' + VW.util.escapeHtml((e.senses || []).map(function (s) { return s.zh; }).join('；').slice(0, 30)) + '</span>';
          }).join(' <span class="muted">⇄</span> ') + '</div>' +
            '<div class="row" style="gap:6px">' +
            '<button class="btn small" data-a="view1">①</button>' +
            '<button class="btn small" data-a="view2">②</button>' +
            '</div>';
          row.querySelector('[data-a=view1]').onclick = function () { VW.dict.showDetail(pair[0].id); };
          row.querySelector('[data-a=view2]').onclick = function () { VW.dict.showDetail(pair[1].id); };
          card.appendChild(row);
        });
        body.appendChild(card);
      });
    },

    openGroupEditor: function (group, d) {
      const wrap = VW.ui.el('<div></div>');
      wrap.innerHTML =
        '<div class="field"><label>分组名称</label><input id="g-name" type="text" value="' + VW.util.escapeHtml(group ? (group.name || '') : '') + '" placeholder="如：形近词 -cept"></div>' +
        '<div class="field"><label>成员（每行一个单词拼写）</label><textarea id="g-members" rows="5">' +
        VW.util.escapeHtml(group ? group.members.map(function (k) { const e = d.em.get(k); return e ? e.spelling : k; }).join('\n') : '') +
        '</textarea></div>';
      const m = VW.ui.openModal({
        title: group ? '编辑易混分组' : '新建易混分组',
        body: wrap,
        buttons: [{
          text: '保存', cls: 'primary', close: false, onClick: function () {
            const members = wrap.querySelector('#g-members').value.split('\n').map(function (l) { return VW.util.normalizeKey(l.trim()); }).filter(Boolean);
            if (members.length < 2) { VW.ui.toast('至少需要 2 个成员', 'err'); return false; }
            const doc = Object.assign({}, group || { id: 'grp-' + VW.util.uid(), createdAt: Date.now() }, {
              kind: 'confuse',
              source: 'manual',
              name: wrap.querySelector('#g-name').value.trim() || '手动分组',
              members: members
            });
            VW.store.api.groups.save(doc).then(function () {
              VW.ui.toast('分组已保存', 'ok');
              m.close();
              VW.ui.renderRoute();
            });
            return false;
          }
        }, { text: '取消', cls: 'ghost' }]
      });
    },

    // ---- 收藏 ----
    renderFavorite: function (body, d) {
      const list = d.entries.filter(function (e) { return e.favorite; });
      if (!list.length) { body.appendChild(VW.ui.empty('还没有收藏的单词。在词典详情页可以收藏。')); return; }
      list.forEach(function (e) {
        const st = d.sm.get(e.id);
        const item = VW.ui.el(VW.wrong.itemHtml(e, st,
          '<button class="btn small" data-a="view">查看</button>' +
          '<button class="btn small ghost" data-a="unfav">取消收藏</button>'
        ));
        item.querySelector('[data-a=view]').onclick = function () { VW.dict.showDetail(e.id); };
        item.querySelector('[data-a=unfav]').onclick = function () {
          VW.store.api.entries.save(Object.assign({}, e, { favorite: false, updatedAt: new Date().toISOString() })).then(function () {
            VW.ui.toast('已取消收藏', 'ok');
            VW.ui.renderRoute();
          });
        };
        body.appendChild(item);
      });
    },

    // ---- 笔记 ----
    renderNotes: function (body, d) {
      const list = d.entries.filter(function (e) { return e.notes; });
      if (!list.length) { body.appendChild(VW.ui.empty('还没有笔记。在词典详情页可以给单词写笔记。')); return; }
      list.forEach(function (e) {
        const st = d.sm.get(e.id);
        const item = VW.ui.el(VW.wrong.itemHtml(e, st,
          '<button class="btn small" data-a="view">查看</button>'
        ));
        item.querySelector('[data-a=view]').onclick = function () { VW.dict.showDetail(e.id); };
        const note = VW.ui.el('<div class="card" style="padding:8px 14px;margin:-4px 0 8px"><span class="small">📝 ' + VW.util.escapeHtml(e.notes) + '</span></div>');
        body.appendChild(item);
        body.appendChild(note);
      });
    }
  };
})();
