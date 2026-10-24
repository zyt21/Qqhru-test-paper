(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('dict', { title: '词典', render: function (el) { VW.dict.render(el); } });

  VW.dict = {
    idx: null,
    entriesById: null,

    render: function (el) {
      el.innerHTML = '';
      const box = VW.ui.el('<div class="search-box"><span class="ico">🔍</span><input type="search" placeholder="搜索单词拼写或中文释义，如 abandon / 放弃"></div>');
      el.appendChild(box);
      const list = VW.ui.el('<div id="dict-results"></div>');
      el.appendChild(list);

      const input = box.querySelector('input');
      input.oninput = function () {
        VW.dict.search(input.value, list);
      };
      input.focus();
    },

    ensureLoaded: function () {
      const api = VW.store.api;
      if (!api) return Promise.reject(new Error('store 未初始化'));
      return Promise.all([api.entries.list()]).then(function (r) {
        VW.dict.idx = VW.stats.buildIndex(r[0]);
        VW.dict.entriesById = new Map(r[0].map(function (e) { return [e.id, e]; }));
      });
    },

    search: function (q, listEl) {
      if (!VW.dict.idx) {
        VW.dict.ensureLoaded().then(function () { VW.dict.search(q, listEl); });
        return;
      }
      const hits = VW.stats.queryIndex(VW.dict.idx, q, 50);
      if (!q.trim()) {
        listEl.innerHTML = '<div class="empty">输入关键词开始搜索（支持英文子串与中文释义模糊匹配）</div>';
        return;
      }
      if (!hits.length) {
        listEl.innerHTML = '<div class="empty">没有匹配的词条</div>';
        return;
      }
      const frag = [];
      hits.forEach(function (h) {
        const e = VW.dict.entriesById.get(h.id);
        if (!e) return;
        const zh = (e.senses || []).map(function (s) { return s.zh; }).join('；');
        frag.push(
          '<div class="list-item" data-id="' + VW.util.escapeHtml(e.id) + '" style="cursor:pointer">' +
          '<div><div class="bold">' + VW.util.escapeHtml(e.spelling) + ' <span class="muted small">' + VW.util.escapeHtml(e.phoneticUK || '') + '</span></div>' +
          '<div class="small muted">' + VW.util.escapeHtml(zh.slice(0, 80)) + '</div></div>' +
          '<div>' + (e.examTags || []).slice(0, 2).map(function (t) { return '<span class="chip">' + VW.util.escapeHtml(t) + '</span>'; }).join('') + '</div>' +
          '</div>'
        );
      });
      listEl.innerHTML = frag.join('');
      listEl.querySelectorAll('.list-item').forEach(function (item) {
        item.onclick = function () { VW.dict.showDetail(item.dataset.id); };
      });
    },

    showDetail: function (id) {
      const e = VW.dict.entriesById.get(id);
      if (!e) return;
      const api = VW.store.api;
      Promise.all([api.states.get(id), api.marks.get('raw-' + id)]).then(function (r) {
        const st = r[0], raw = r[1];
        const wrap = VW.ui.el('<div></div>');
        wrap.innerHTML =
          '<div style="margin-bottom:8px"><span style="font-size:1.5rem;font-weight:700">' + VW.util.escapeHtml(e.spelling) + '</span> ' +
          '<span class="muted">' + VW.util.escapeHtml(e.phoneticUK || '') + '</span>' +
          (e.phoneticUS && e.phoneticUS !== e.phoneticUK ? ' <span class="muted small">美 ' + VW.util.escapeHtml(e.phoneticUS) + '</span>' : '') +
          '</div>' +
          '<div>' + VW.books.masteryChip(VW.stats.masteryLabel(st)) +
          (raw ? '<span class="chip warn">生词本</span>' : '') +
          (e.favorite ? '<span class="chip ok">已收藏</span>' : '') + '</div>' +
          '<div style="margin-top:10px">' + (e.senses || []).map(function (s) {
            return '<div style="margin-bottom:6px"><span class="chip">' + VW.util.escapeHtml(s.pos || '—') + '</span> ' + VW.util.escapeHtml(s.zh) + '</div>';
          }).join('') + '</div>' +
          (e.examples && e.examples.length ? '<div class="card" style="margin-top:8px;padding:10px 14px">' +
            e.examples.map(function (x) {
              return '<div class="small" style="margin-bottom:4px">' + VW.util.escapeHtml(x.en) + '</div><div class="small muted">' + VW.util.escapeHtml(x.zh) + '</div>';
            }).join('') + '</div>' : '') +
          (e.collocations && e.collocations.length ? '<div class="small" style="margin-top:8px"><b>搭配：</b>' + VW.util.escapeHtml(e.collocations.join('；')) + '</div>' : '') +
          (e.synonyms && e.synonyms.length ? '<div class="small"><b>同义词：</b>' + VW.util.escapeHtml(e.synonyms.join('、')) + '</div>' : '') +
          (e.antonyms && e.antonyms.length ? '<div class="small"><b>反义词：</b>' + VW.util.escapeHtml(e.antonyms.join('、')) + '</div>' : '') +
          (e.roots ? '<div class="small"><b>词根：</b>' + VW.util.escapeHtml(e.roots) + '</div>' : '') +
          (e.mnemonic ? '<div class="small"><b>助记：</b>' + VW.util.escapeHtml(e.mnemonic) + '</div>' : '') +
          (e.notes ? '<div class="small"><b>笔记：</b>' + VW.util.escapeHtml(e.notes) + '</div>' : '') +
          '<div class="field" style="margin-top:10px"><label>笔记</label><textarea id="d-note" rows="2">' + VW.util.escapeHtml(e.notes || '') + '</textarea></div>';
        const m = VW.ui.openModal({
          title: '词条详情',
          body: wrap,
          buttons: [
            { text: raw ? '移出生词本' : '加入生词本', cls: 'ghost', close: false, onClick: function () {
              const mk = { id: 'raw-' + id, kind: 'raw', key: id, at: Date.now() };
              const p = raw ? api.marks.remove('raw-' + id) : api.marks.save(mk);
              p.then(function () {
                VW.ui.toast(raw ? '已移出生词本' : '已加入生词本', 'ok');
                VW.dict.showDetail(id); m.close();
              });
              return false;
            } },
            { text: e.favorite ? '取消收藏' : '收藏', cls: 'ghost', close: false, onClick: function () {
              api.entries.save(Object.assign({}, e, { favorite: !e.favorite, updatedAt: new Date().toISOString() })).then(function (saved) {
                VW.dict.entriesById.set(id, saved);
                VW.ui.toast(e.favorite ? '已取消收藏' : '已收藏', 'ok');
                VW.dict.showDetail(id); m.close();
              });
              return false;
            } },
            { text: '编辑', cls: 'ghost', close: false, onClick: function () {
              m.close();
              VW.books.openEditor(e);
              return false;
            } },
            { text: '关闭', cls: 'primary' }
          ]
        });
        wrap.querySelector('#d-note').onchange = function () {
          api.entries.save(Object.assign({}, e, { notes: this.value, updatedAt: new Date().toISOString() })).then(function (saved) {
            VW.dict.entriesById.set(id, saved);
            VW.ui.toast('笔记已保存', 'ok');
          });
        };
      });
    }
  };
})();
