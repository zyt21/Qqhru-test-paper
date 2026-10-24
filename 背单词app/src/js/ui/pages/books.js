(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('books', { title: '词书', render: function (el) { VW.books.render(el); } });

  VW.books = {
    state: { view: 'list', bookId: null, filter: { q: '', unit: '', mastery: '' }, page: 1, pageSize: 50, selected: {} },

    render: function (el) {
      el.innerHTML = '';
      if (VW.books.state.view === 'list') return VW.books.renderList(el);
      return VW.books.renderEntries(el);
    },

    loadData: function () {
      const api = VW.store.api;
      return Promise.all([api.books.list(), api.entries.list(), api.states.list()]).then(function (r) {
        return { books: r[0], entries: r[1], states: r[2] };
      });
    },
    stateMap: function (states) {
      const m = new Map();
      (states || []).forEach(function (s) { m.set(s.id, s); });
      return m;
    },

    // ===== 词书列表 =====
    renderList: function (el) {
      return VW.books.loadData().then(function (d) {
        const sm = VW.books.stateMap(d.states);
        const toolbar = VW.ui.el('<div class="row-between" style="margin-bottom:14px"></div>');
        const left = VW.ui.el('<div class="row"></div>');
        const bNew = VW.ui.el('<button class="btn primary">＋ 新建词书</button>');
        const bImport = VW.ui.el('<button class="btn">⬆ 导入词库</button>');
        bNew.onclick = function () { VW.books.openBookEditor(null); };
        bImport.onclick = function () { VW.books.openImportModal('import'); };
        left.appendChild(bNew); left.appendChild(bImport);
        toolbar.appendChild(left);
        el.appendChild(toolbar);

        if (!d.books.length) {
          el.appendChild(VW.ui.empty('还没有词书。点击「新建词书」创建，或「导入词库」从 Excel/CSV/JSON 导入。'));
          return;
        }
        const grid = VW.ui.el('<div class="grid grid-2"></div>');
        d.books.forEach(function (b) {
          const ents = d.entries.filter(function (e) { return VW.util.inBook(e, b.id); });
          const learned = ents.filter(function (e) { const s = sm.get(e.id); return s && s.firstLearnedAt; }).length;
          const pct = ents.length ? Math.round(learned * 100 / ents.length) : 0;
          const card = VW.ui.el('<div class="card"></div>');
          card.innerHTML =
            '<div class="row-between">' +
            '<div class="bold" style="font-size:1.05rem">' + VW.util.escapeHtml(b.name) + '</div>' +
            '<span class="chip ' + (b.enabled ? 'ok' : '') + '">' + (b.enabled ? '启用' : '停用') + '</span>' +
            '</div>' +
            '<div class="small muted" style="margin:4px 0 8px">' +
            (b.type ? VW.util.escapeHtml(b.type) + ' · ' : '') + 'v' + VW.util.escapeHtml(b.version || '—') + ' · ' + ents.length + ' 词' +
            '</div>' +
            '<div class="row" style="gap:8px">' +
            '<div class="progress" style="flex:1"><i style="width:' + pct + '%"></i></div>' +
            '<span class="small muted">' + learned + '/' + ents.length + '（' + pct + '%）</span>' +
            '</div>' +
            '<div class="row" style="margin-top:12px;flex-wrap:wrap"></div>';
          const actions = card.querySelector('.row:last-child');
          function act(text, cls, fn) {
            const b = VW.ui.el('<button class="btn small ' + (cls || '') + '"></button>');
            b.textContent = text; b.onclick = fn; actions.appendChild(b);
          }
          act('管理词条', '', function () {
            VW.books.state.view = 'entries'; VW.books.state.bookId = b.id;
            VW.books.state.filter = { q: '', unit: '', mastery: '' }; VW.books.state.page = 1;
            VW.ui.renderRoute();
          });
          act('编辑', 'ghost', function () { VW.books.openBookEditor(b); });
          act('导入到此书', 'ghost', function () { VW.books.openImportModal('import', b.id); });
          act('更新版本', 'ghost', function () { VW.books.openImportModal('version', b.id); });
          act(b.enabled ? '停用' : '启用', 'ghost', function () {
            VW.store.api.books.save(Object.assign({}, b, { enabled: !b.enabled })).then(function () {
              VW.ui.toast('已' + (b.enabled ? '停用' : '启用') + '「' + b.name + '」');
              VW.ui.renderRoute();
            });
          });
          act('删除', 'danger', function () {
            VW.ui.confirm({ title: '删除词书', message: '确定删除「' + b.name + '」？其下 ' + ents.length + ' 个词条的学习记录也会被清理。', danger: true, okText: '删除' })
              .then(function (ok) {
                if (!ok) return;
                const api = VW.store.api;
                const jobs = ents.map(function (e) {
                  // 多词书归属：仅从本书移除；若词条只剩本书归属则删除
                  if (e.bookId === b.id) {
                    const rest = (e.bookIds || []).filter(function (x) { return x !== b.id; });
                    if (rest.length) {
                      e.bookId = rest.shift();
                      e.bookIds = rest;
                      e.updatedAt = new Date().toISOString();
                      return api.entries.save(e);
                    }
                    return api.entries.remove(e.id);
                  }
                  e.bookIds = (e.bookIds || []).filter(function (x) { return x !== b.id; });
                  e.updatedAt = new Date().toISOString();
                  return api.entries.save(e);
                });
                return api.books.remove(b.id).then(function () {
                  return Promise.all(jobs);
                }).then(function () { VW.ui.toast('已删除'); VW.ui.renderRoute(); });
              });
          });
          grid.appendChild(card);
        });
        el.appendChild(grid);
      });
    },

    // ===== 词条管理 =====
    renderEntries: function (el) {
      const bid = VW.books.state.bookId;
      return VW.books.loadData().then(function (d) {
        const book = d.books.find(function (b) { return b.id === bid; });
        if (!book) { VW.books.state.view = 'list'; return VW.books.render(el); }
        const sm = VW.books.stateMap(d.states);
        const my = d.entries.filter(function (e) { return VW.util.inBook(e, bid); });

        // 顶部
        const head = VW.ui.el('<div class="row-between" style="margin-bottom:12px"></div>');
        const back = VW.ui.el('<button class="btn small ghost">← 返回词书</button>');
        back.onclick = function () { VW.books.state.view = 'list'; VW.ui.renderRoute(); };
        const headRight = VW.ui.el('<div class="row"></div>');
        const bAdd = VW.ui.el('<button class="btn small primary">＋ 添加单词</button>');
        bAdd.onclick = function () { VW.books.openEditor(null, { bookId: bid, unit: VW.books.state.filter.unit || '' }); };
        const bImp = VW.ui.el('<button class="btn small">⬆ 批量导入</button>');
        bImp.onclick = function () { VW.books.openImportModal('import', bid); };
        headRight.appendChild(bAdd); headRight.appendChild(bImp);
        head.appendChild(back); head.appendChild(headRight);
        el.appendChild(head);

        const info = VW.ui.el('<div class="small muted" style="margin-bottom:10px"></div>');
        info.textContent = book.name + ' · v' + (book.version || '—') + ' · 共 ' + my.length + ' 词';
        el.appendChild(info);

        // 筛选栏
        const bar = VW.ui.el('<div class="row" style="margin-bottom:10px"></div>');
        const q = VW.ui.el('<input type="search" placeholder="搜索拼写或释义">');
        q.value = VW.books.state.filter.q;
        q.style.flex = '1'; q.style.minWidth = '160px';
        const selUnit = VW.ui.el('<select></select>');
        const units = {};
        my.forEach(function (e) { if (e.unit) units[e.unit] = 1; });
        selUnit.innerHTML = '<option value="">全部单元</option>' +
          Object.keys(units).map(function (u) {
            return '<option value="' + VW.util.escapeHtml(u) + '"' + (VW.books.state.filter.unit === u ? ' selected' : '') + '>' + VW.util.escapeHtml(u) + '</option>';
          }).join('');
        const selMastery = VW.ui.el('<select></select>');
        selMastery.innerHTML = '<option value="">全部掌握度</option>' +
          ['未学', '学习中', '熟悉', '掌握', '顽固'].map(function (m) {
            return '<option value="' + m + '"' + (VW.books.state.filter.mastery === m ? ' selected' : '') + '>' + m + '</option>';
          }).join('');
        q.oninput = function () { VW.books.state.filter.q = q.value; VW.books.state.page = 1; VW.books.renderEntriesBody(el, book, d, sm); };
        selUnit.onchange = function () { VW.books.state.filter.unit = selUnit.value; VW.books.state.page = 1; VW.books.renderEntriesBody(el, book, d, sm); };
        selMastery.onchange = function () { VW.books.state.filter.mastery = selMastery.value; VW.books.state.page = 1; VW.books.renderEntriesBody(el, book, d, sm); };
        bar.appendChild(q); bar.appendChild(selUnit); bar.appendChild(selMastery);
        el.appendChild(bar);

        const body = VW.ui.el('<div></div>');
        el.appendChild(body);
        VW.books.renderEntriesBody(el, book, d, sm);
      });
    },

    renderEntriesBody: function (el, book, d, sm) {
      const f = VW.books.state.filter;
      const bid = book.id;
      const my = d.entries.filter(function (e) { return VW.util.inBook(e, bid); });
      const filtered = my.filter(function (e) {
        if (f.q) {
          const low = e.spelling.toLowerCase();
          const zh = (e.senses || []).map(function (s) { return s.zh; }).join(' ').toLowerCase();
          if (low.indexOf(f.q.toLowerCase()) < 0 && zh.indexOf(f.q.toLowerCase()) < 0) return false;
        }
        if (f.unit && e.unit !== f.unit) return false;
        if (f.mastery) {
          if (VW.stats.masteryLabel(sm.get(e.id)) !== f.mastery) return false;
        }
        return true;
      });
      const totalPages = Math.max(1, Math.ceil(filtered.length / VW.books.state.pageSize));
      if (VW.books.state.page > totalPages) VW.books.state.page = totalPages;
      const start = (VW.books.state.page - 1) * VW.books.state.pageSize;
      const pageItems = filtered.slice(start, start + VW.books.state.pageSize);

      let body = el.querySelector('.entries-body');
      if (!body) {
        body = VW.ui.el('<div class="entries-body"></div>');
        el.appendChild(body);
      }
      body.innerHTML = '';

      // 批量操作栏
      const selCount = Object.keys(VW.books.state.selected).length;
      if (selCount) {
        const bb = VW.ui.el('<div class="card" style="padding:10px 14px;margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"></div>');
        const lbl = VW.ui.el('<span class="small bold">已选 ' + selCount + ' 词：</span>');
        const uSel = VW.ui.el('<select style="width:auto"></select>');
        const units = {};
        my.forEach(function (e) { if (e.unit) units[e.unit] = 1; });
        uSel.innerHTML = '<option value="">批量改单元…</option>' + Object.keys(units).map(function (u) {
          return '<option value="' + VW.util.escapeHtml(u) + '">' + VW.util.escapeHtml(u) + '</option>';
        }).join('');
        const dSel = VW.ui.el('<select style="width:auto"></select>');
        dSel.innerHTML = '<option value="">批量改难度…</option>' + [1, 2, 3, 4, 5].map(function (n) {
          return '<option value="' + n + '">难度 ' + n + '</option>';
        }).join('');
        const tSel = VW.ui.el('<input type="text" placeholder="追加自定义标签(逗号分隔)" style="width:190px">');
        const eSel = VW.ui.el('<input type="text" placeholder="追加考试标签(逗号分隔)" style="width:190px">');
        const apply = VW.ui.el('<button class="btn small primary">应用</button>');
        apply.onclick = function () {
          const ids = Object.keys(VW.books.state.selected);
          const u = uSel.value, dv = dSel.value, tv = tSel.value.trim(), ev = eSel.value.trim();
          if (!u && !dv && !tv && !ev) { VW.ui.toast('请先选择要修改的字段'); return; }
          const api = VW.store.api;
          Promise.all(ids.map(function (id) {
            return api.entries.get(id).then(function (e) {
              if (!e) return null;
              if (u) e.unit = u;
              if (dv) e.difficulty = parseInt(dv, 10);
              if (tv) {
                const set = {};
                (e.customTags || []).forEach(function (t) { set[t] = 1; });
                tv.split(/[,，;；]/).forEach(function (t) { if (t.trim()) set[t.trim()] = 1; });
                e.customTags = Object.keys(set);
              }
              if (ev) {
                const set = {};
                (e.examTags || []).forEach(function (t) { set[t] = 1; });
                ev.split(/[,，;；]/).forEach(function (t) { if (t.trim()) set[t.trim()] = 1; });
                e.examTags = Object.keys(set);
              }
              e.updatedAt = new Date().toISOString();
              return api.entries.save(e);
            });
          })).then(function () {
            VW.books.state.selected = {};
            VW.ui.toast('批量修改已应用', 'ok');
            VW.ui.renderRoute();
          });
        };
        const cancel = VW.ui.el('<button class="btn small ghost">取消选择</button>');
        cancel.onclick = function () { VW.books.state.selected = {}; VW.ui.renderRoute(); };
        bb.appendChild(lbl); bb.appendChild(uSel); bb.appendChild(dSel); bb.appendChild(tSel); bb.appendChild(eSel); bb.appendChild(apply); bb.appendChild(cancel);
        body.appendChild(bb);
      }

      if (!filtered.length) {
        body.appendChild(VW.ui.empty('没有匹配的词条'));
        return;
      }

      const tbl = VW.ui.el('<table class="tbl"><thead><tr><th style="width:34px"><input type="checkbox" data-a="all"></th><th>单词</th><th>释义</th><th>单元</th><th>标签</th><th>掌握度</th><th style="width:120px">操作</th></tr></thead><tbody></tbody></table>');
      const tbody = tbl.querySelector('tbody');
      pageItems.forEach(function (e) {
        const st = sm.get(e.id);
        const tr = VW.ui.el('<tr></tr>');
        const checked = VW.books.state.selected[e.id] ? ' checked' : '';
        const zh = (e.senses || []).map(function (s) { return s.zh; }).join('；').slice(0, 60);
        tr.innerHTML =
          '<td><input type="checkbox" data-k="' + VW.util.escapeHtml(e.id) + '"' + checked + '></td>' +
          '<td><div class="bold">' + VW.util.escapeHtml(e.spelling) + '</div>' +
          '<div class="small muted">' + VW.util.escapeHtml(e.phoneticUK || '') + '</div></td>' +
          '<td class="small">' + VW.util.escapeHtml(zh) + '</td>' +
          '<td class="small">' + VW.util.escapeHtml(e.unit || '—') + '</td>' +
          '<td>' + (e.examTags || []).slice(0, 2).map(function (t) { return '<span class="chip">' + VW.util.escapeHtml(t) + '</span>'; }).join('') +
          ((e.customTags || []).length ? '<span class="chip warn">' + VW.util.escapeHtml(e.customTags[0]) + '</span>' : '') + '</td>' +
          '<td>' + VW.books.masteryChip(VW.stats.masteryLabel(st)) + '</td>' +
          '<td><button class="btn small" data-a="edit">编辑</button> <button class="btn small danger" data-a="del">删</button></td>';
        tr.querySelector('input[type=checkbox]').onchange = function () {
          if (this.checked) VW.books.state.selected[e.id] = true;
          else delete VW.books.state.selected[e.id];
          VW.ui.renderRoute();
        };
        tr.querySelector('[data-a=edit]').onclick = function () { VW.books.openEditor(e); };
        tr.querySelector('[data-a=del]').onclick = function () {
          VW.ui.confirm({ title: '删除词条', message: '确定删除 ' + e.spelling + ' 及其学习记录？', danger: true, okText: '删除' })
            .then(function (ok) {
              if (!ok) return;
              return VW.store.api.entries.remove(e.id).then(function () {
                VW.ui.toast('已删除'); VW.ui.renderRoute();
              });
            });
        };
        tbody.appendChild(tr);
      });
      const allCb = tbl.querySelector('[data-a=all]');
      const pageIds = pageItems.map(function (e) { return e.id; });
      allCb.checked = pageIds.every(function (id) { return VW.books.state.selected[id]; });
      allCb.onchange = function () {
        pageIds.forEach(function (id) {
          if (allCb.checked) VW.books.state.selected[id] = true; else delete VW.books.state.selected[id];
        });
        VW.ui.renderRoute();
      };
      body.appendChild(tbl);

      // 分页
      if (totalPages > 1) {
        const pg = VW.ui.el('<div class="row" style="margin-top:10px;justify-content:center"></div>');
        const prev = VW.ui.el('<button class="btn small ghost"' + (VW.books.state.page <= 1 ? ' disabled' : '') + '>上一页</button>');
        const next = VW.ui.el('<button class="btn small ghost"' + (VW.books.state.page >= totalPages ? ' disabled' : '') + '>下一页</button>');
        const lbl = VW.ui.el('<span class="small muted">' + VW.books.state.page + ' / ' + totalPages + '（共 ' + filtered.length + ' 词）</span>');
        prev.onclick = function () { if (VW.books.state.page > 1) { VW.books.state.page--; VW.ui.renderRoute(); } };
        next.onclick = function () { if (VW.books.state.page < totalPages) { VW.books.state.page++; VW.ui.renderRoute(); } };
        pg.appendChild(prev); pg.appendChild(lbl); pg.appendChild(next);
        body.appendChild(pg);
      }
    },

    masteryChip: function (label) {
      const cls = { '未学': 'muted', '学习中': 'warn', '熟悉': '', '掌握': 'ok', '顽固': 'danger' }[label] || '';
      const c = VW.ui.el('<span class="chip ' + cls + '"></span>');
      c.textContent = label;
      return c;
    },

    // ===== 词书编辑弹窗 =====
    openBookEditor: function (book) {
      const isNew = !book;
      const wrap = VW.ui.el('<div></div>');
      wrap.innerHTML =
        '<div class="field"><label>词书名称</label><input id="bk-name" type="text" value="' + VW.util.escapeHtml(book ? book.name : '') + '" placeholder="如：六级核心词汇"></div>' +
        '<div class="field"><label>类型</label><select id="bk-type">' +
        ['考试', '教材', '自定义'].map(function (t) {
          return '<option' + (book && book.type === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label>简介</label><textarea id="bk-desc" rows="2">' + VW.util.escapeHtml(book ? (book.desc || '') : '') + '</textarea></div>' +
        '<div class="field"><label>标签（逗号分隔）</label><input id="bk-tags" type="text" value="' + VW.util.escapeHtml(book ? (book.tags || []).join('，') : '') + '"></div>';
      const m = VW.ui.openModal({
        title: isNew ? '新建词书' : '编辑词书',
        body: wrap,
        buttons: [{
          text: '保存', cls: 'primary', close: false, onClick: function () {
            const name = wrap.querySelector('#bk-name').value.trim();
            if (!name) { VW.ui.toast('请输入词书名称', 'err'); return false; }
            const doc = Object.assign({}, book || {
              id: 'book-' + VW.util.uid(),
              version: '1.0', changelog: '', enabled: true,
              createdAt: new Date().toISOString()
            }, {
              name: name,
              type: wrap.querySelector('#bk-type').value,
              desc: wrap.querySelector('#bk-desc').value.trim(),
              tags: wrap.querySelector('#bk-tags').value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean),
              updatedAt: new Date().toISOString()
            });
            VW.store.api.books.save(doc).then(function () {
              VW.ui.toast(isNew ? '词书已创建' : '已保存', 'ok');
              m.close();
              VW.ui.renderRoute();
            });
            return false;
          }
        }, { text: '取消', cls: 'ghost' }]
      });
    },

    // ===== 词条编辑弹窗（词典页共用） =====
    openEditor: function (entry, defaults) {
      entry = entry || null;
      defaults = defaults || {};
      const bookId = entry ? entry.bookId : defaults.bookId;
      const isNew = !entry;
      const wrap = VW.ui.el('<div></div>');
      wrap.innerHTML =
        '<div class="field"><label>拼写（保存后不可改）</label><input id="e-sp" type="text" value="' + VW.util.escapeHtml(entry ? entry.spelling : '') + '"' + (isNew ? '' : ' disabled') + ' placeholder="单词拼写" autocomplete="off"></div>' +
        '<div class="grid grid-2">' +
        '<div class="field"><label>英式音标</label><input id="e-uk" type="text" value="' + VW.util.escapeHtml(entry ? (entry.phoneticUK || '') : '') + '"></div>' +
        '<div class="field"><label>美式音标</label><input id="e-us" type="text" value="' + VW.util.escapeHtml(entry ? (entry.phoneticUS || '') : '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>义项（每行：词性<空格>中文释义；多行=多义项）</label><textarea id="e-senses" rows="3">' +
        VW.util.escapeHtml((entry ? (entry.senses || []) : []).map(function (s) { return (s.pos ? s.pos + ' ' : '') + s.zh; }).join('\n')) +
        '</textarea></div>' +
        '<div class="field"><label>例句（每行：英文<制表符或 “|” >中文翻译）</label><textarea id="e-ex" rows="2">' +
        VW.util.escapeHtml((entry ? (entry.examples || []) : []).map(function (x) { return x.en + (x.zh ? ' | ' + x.zh : ''); }).join('\n')) +
        '</textarea></div>' +
        '<div class="field"><label>搭配/短语（分号分隔）</label><input id="e-col" type="text" value="' + VW.util.escapeHtml(entry ? (entry.collocations || []).join('；') : '') + '"></div>' +
        '<div class="grid grid-2">' +
        '<div class="field"><label>同义词（分号分隔）</label><input id="e-syn" type="text" value="' + VW.util.escapeHtml(entry ? (entry.synonyms || []).join('；') : '') + '"></div>' +
        '<div class="field"><label>反义词（分号分隔）</label><input id="e-ant" type="text" value="' + VW.util.escapeHtml(entry ? (entry.antonyms || []).join('；') : '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>词根词缀</label><input id="e-roots" type="text" value="' + VW.util.escapeHtml(entry ? (entry.roots || '') : '') + '"></div>' +
        '<div class="field"><label>助记（可选）</label><input id="e-mn" type="text" value="' + VW.util.escapeHtml(entry ? (entry.mnemonic || '') : '') + '"></div>' +
        '<div class="grid grid-2">' +
        '<div class="field"><label>考试标签（逗号分隔）</label><input id="e-tags" type="text" value="' + VW.util.escapeHtml(entry ? (entry.examTags || []).join('，') : '') + '"></div>' +
        '<div class="field"><label>自定义标签（逗号分隔）</label><input id="e-ctags" type="text" value="' + VW.util.escapeHtml(entry ? (entry.customTags || []).join('，') : '') + '"></div>' +
        '</div>' +
        '<div class="grid grid-3">' +
        '<div class="field"><label>难度(1-5)</label><input id="e-diff" type="number" min="1" max="5" value="' + (entry ? (entry.difficulty || 3) : 3) + '"></div>' +
        '<div class="field"><label>词频(1-5)</label><input id="e-freq" type="number" min="1" max="5" value="' + (entry ? (entry.frequency || 3) : 3) + '"></div>' +
        '<div class="field"><label>单元/List</label><input id="e-unit" type="text" value="' + VW.util.escapeHtml(entry ? (entry.unit || '') : (defaults.unit || '')) + '"></div>' +
        '</div>';
      const m = VW.ui.openModal({
        title: isNew ? '添加单词' : '编辑 ' + (entry ? entry.spelling : ''),
        lg: true,
        body: wrap,
        buttons: [{
          text: '保存', cls: 'primary', close: false, onClick: function () {
            const sp = wrap.querySelector('#e-sp').value.trim();
            if (!sp) { VW.ui.toast('请输入拼写', 'err'); return false; }
            const id = VW.util.normalizeKey(sp);
            const senses = wrap.querySelector('#e-senses').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
              const mm = l.match(/^([^\s\u4e00-\u9fa5]+)?\s*(.*)$/);
              return { pos: (mm && mm[1] || '').trim(), zh: (mm && mm[2] || l).trim() };
            });
            const examples = wrap.querySelector('#e-ex').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
              const parts = l.split('|');
              return { en: parts[0].trim(), zh: (parts[1] || '').trim() };
            });
            const doc = Object.assign({}, entry || {
              id: id, bookId: bookId, favorite: false, notes: '', image: '', etymology: '',
              createdAt: new Date().toISOString()
            }, {
              id: id,
              spelling: sp,
              phoneticUK: wrap.querySelector('#e-uk').value.trim(),
              phoneticUS: wrap.querySelector('#e-us').value.trim(),
              senses: senses,
              examples: examples,
              collocations: VW.importer.splitList(wrap.querySelector('#e-col').value),
              synonyms: VW.importer.splitList(wrap.querySelector('#e-syn').value),
              antonyms: VW.importer.splitList(wrap.querySelector('#e-ant').value),
              roots: wrap.querySelector('#e-roots').value.trim(),
              mnemonic: wrap.querySelector('#e-mn').value.trim(),
              examTags: wrap.querySelector('#e-tags').value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean),
              customTags: wrap.querySelector('#e-ctags').value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean),
              difficulty: VW.util.clamp(parseInt(wrap.querySelector('#e-diff').value, 10) || 3, 1, 5),
              frequency: VW.util.clamp(parseInt(wrap.querySelector('#e-freq').value, 10) || 3, 1, 5),
              unit: wrap.querySelector('#e-unit').value.trim(),
              updatedAt: new Date().toISOString()
            });
            const api = VW.store.api;
            api.entries.get(id).then(function (exist) {
              if (exist && isNew) { VW.ui.toast('该单词已存在，请用编辑功能修改', 'err'); return false; }
              return api.entries.save(doc).then(function () {
                VW.ui.toast('已保存', 'ok');
                m.close();
                VW.ui.renderRoute();
              });
            });
            return false;
          }
        }, { text: '取消', cls: 'ghost' }]
      });
    },

    // ===== 导入弹窗 =====
    openImportModal: function (mode, bookId) {
      mode = mode || 'import'; // import | version
      const isVersion = mode === 'version';
      const wrap = VW.ui.el('<div></div>');
      const tabs = VW.ui.el('<div class="tabs"></div>');
      ['CSV', 'Excel', 'JSON', '粘贴文本'].forEach(function (t, i) {
        const b = VW.ui.el('<button class="tab' + (i === 0 ? ' active' : '') + '" data-t="' + t + '"></button>');
        b.textContent = t;
        tabs.appendChild(b);
      });
      const fileBox = VW.ui.el('<div class="field" style="margin-top:10px"><input id="im-file" type="file" accept=".csv,.txt,.xlsx,.xls,.json"></div>');
      const pasteBox = VW.ui.el('<div class="field" style="display:none"><label>每行一个单词，可用 Tab 分隔释义</label><textarea id="im-paste" rows="6" placeholder="abandon\t抛弃；放弃&#10;ability\t能力"></textarea></div>');
      const mapBox = VW.ui.el('<div style="display:none"></div>');
      const bookBox = VW.ui.el('<div class="field" style="margin-top:4px"><label>' + (isVersion ? '更新到词书（不可改）' : '导入到词书') + '</label><select id="im-book"></select></div>');
      const verBox = isVersion ? VW.ui.el('<div class="grid grid-2"><div class="field"><label>新版本号</label><input id="im-ver" type="text" placeholder="如 1.1"></div><div class="field"><label>更新说明</label><input id="im-log" type="text" placeholder="本次更新的内容"></div></div>') : VW.ui.el('<div></div>');
      const preview = VW.ui.el('<div style="margin-top:8px"></div>');
      wrap.appendChild(tabs); wrap.appendChild(fileBox); wrap.appendChild(pasteBox);
      wrap.appendChild(mapBox); wrap.appendChild(bookBox); wrap.appendChild(verBox); wrap.appendChild(preview);

      // 词书下拉
      VW.books.loadData().then(function (d) {
        let opts = '<option value="">（新建词书）</option>';
        d.books.forEach(function (b) {
          opts += '<option value="' + VW.util.escapeHtml(b.id) + '"' + (bookId === b.id ? ' selected' : '') + '>' + VW.util.escapeHtml(b.name) + '</option>';
        });
        bookBox.querySelector('#im-book').innerHTML = opts;
        if (bookId) bookBox.querySelector('#im-book').disabled = true;
      });

      let currentTab = 'CSV';
      let parsedRows = null;   // CSV/Excel 二维数组
      let jsonDrafts = null;   // JSON
      let mapping = null;      // 列映射

      tabs.onclick = function (e) {
        const t = e.target.closest('.tab');
        if (!t) return;
        currentTab = t.dataset.t;
        tabs.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === t); });
        fileBox.style.display = (currentTab === '粘贴文本') ? 'none' : '';
        pasteBox.style.display = (currentTab === '粘贴文本') ? '' : 'none';
        preview.innerHTML = '';
      };

      function loadXLSX() {
        if (window.XLSX) return Promise.resolve();
        return new Promise(function (res, rej) {
          const s = document.createElement('script');
          s.src = 'vendor/xlsx.full.min.js';
          s.onload = function () { res(); };
          s.onerror = function () { rej(new Error('Excel 解析组件缺失：请将文件另存为 CSV 后导入（Excel → 另存为 → CSV）')); };
          document.head.appendChild(s);
        });
      }
      function readText(file) {
        return new Promise(function (res, rej) {
          const r = new FileReader();
          r.onload = function () { res(r.result); };
          r.onerror = function () { rej(r.error); };
          r.readAsText(file, 'UTF-8');
        });
      }
      function readBuf(file) {
        return new Promise(function (res, rej) {
          const r = new FileReader();
          r.onload = function () { res(r.result); };
          r.onerror = function () { rej(r.error); };
          r.readAsArrayBuffer(file);
        });
      }

      fileBox.querySelector('#im-file').onchange = function () {
        const f = this.files[0];
        if (!f) return;
        const name = f.name.toLowerCase();
        preview.innerHTML = '<div class="small muted">正在解析…</div>';
        if (currentTab === 'Excel' || name.endsWith('.xlsx') || name.endsWith('.xls')) {
          loadXLSX().then(function () {
            return readBuf(f);
          }).then(function (buf) {
            const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            parsedRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            renderCSVPreview();
          }).catch(function (err) {
            preview.innerHTML = '<div class="small" style="color:var(--danger)">' + VW.util.escapeHtml(err.message) + '</div>';
          });
        } else if (name.endsWith('.json')) {
          readText(f).then(function (text) {
            jsonDrafts = VW.importer.parseJSON(text, '');
            renderDraftPreview(jsonDrafts, []);
          }).catch(function (err) {
            preview.innerHTML = '<div class="small" style="color:var(--danger)">' + VW.util.escapeHtml(err.message) + '</div>';
          });
        } else {
          readText(f).then(function (text) {
            parsedRows = VW.importer.parseCSV(text);
            renderCSVPreview();
          });
        }
      };

      function renderCSVPreview() {
        if (!parsedRows || !parsedRows.length) {
          preview.innerHTML = '<div class="small muted">文件为空</div>';
          return;
        }
        mapping = VW.importer.autoMap(parsedRows[0]);
        const res = VW.importer.buildDrafts(parsedRows, mapping, '');
        // 列映射 UI
        mapBox.style.display = '';
        mapBox.innerHTML = '<div class="field"><label>列映射（自动识别，可手动调整）</label><div class="grid grid-2"></div></div>';
        const g = mapBox.querySelector('.grid');
        parsedRows[0].forEach(function (h, ci) {
          const fld = VW.ui.el('<div class="row" style="gap:6px"></div>');
          fld.innerHTML = '<span class="small muted" style="flex:1;min-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + VW.util.escapeHtml(h) + '</span>' +
            '<select data-ci="' + ci + '" style="width:120px">' +
            '<option value="">— 忽略 —</option>' +
            VW.importer.COLUMNS.map(function (c) {
              return '<option value="' + c.key + '"' + (mapping[ci] === c.key ? ' selected' : '') + '>' + ({ spelling: '单词', phoneticUK: '英音标', phoneticUS: '美音标', pos: '词性', zh: '释义', exampleEn: '例句', exampleZh: '例句翻译', collocations: '搭配', synonyms: '同义词', antonyms: '反义词', roots: '词根', examTags: '考试标签', difficulty: '难度', frequency: '词频', unit: '单元', customTags: '自定义标签' }[c.key]) + '</option>';
            }).join('') + '</select>';
          fld.querySelector('select').onchange = function () {
            mapping[ci] = this.value || null;
            const r2 = VW.importer.buildDrafts(parsedRows, mapping, '');
            renderDraftPreview(r2.drafts, r2.errors);
          };
          g.appendChild(fld);
        });
        renderDraftPreview(res.drafts, res.errors);
      }

      function renderDraftPreview(drafts, errors) {
        const dedup = VW.importer.dedupeDrafts(drafts);
        preview.innerHTML =
          '<div class="small">解析到 <b>' + drafts.length + '</b> 条（文件内重复 ' + dedup.dupInFile + ' 条，导入时合并）</div>' +
          (errors.length ? '<div class="small" style="color:var(--danger);margin-top:4px">' + errors.length + ' 行未导入：' +
            VW.util.escapeHtml(errors.slice(0, 3).map(function (e2) { return '第' + e2.row + '行 ' + e2.reason; }).join('；')) + (errors.length > 3 ? ' 等' : '') + '</div>' : '');
      }

      const m = VW.ui.openModal({
        title: isVersion ? '词书版本更新' : '导入词库',
        lg: true,
        body: wrap,
        buttons: [
          { text: '下载 CSV 模板', cls: 'ghost', close: false, onClick: function () {
            VW.books.download(VW.importer.templateText(), '背单词导入模板.csv', 'text/csv');
            return false;
          } },
          { text: isVersion ? '开始更新' : '确认导入', cls: 'primary', close: false, onClick: function () {
            let drafts = null;
            if (currentTab === 'JSON') drafts = jsonDrafts;
            else if (currentTab === '粘贴文本') drafts = VW.importer.parsePaste(pasteBox.querySelector('#im-paste').value, '');
            else if (parsedRows) {
              const r = VW.importer.buildDrafts(parsedRows, mapping, '');
              drafts = r.drafts;
            }
            if (!drafts || !drafts.length) { VW.ui.toast('没有可导入的词条', 'err'); return false; }
            const sel = bookBox.querySelector('#im-book');
            const targetBookId = sel.value || (sel.disabled ? bookId : '');
            const api = VW.store.api;
            return api.books.list().then(function (books) {
              const book = books.find(function (b) { return b.id === targetBookId; });
              let bookPromise;
              if (book) bookPromise = Promise.resolve(book);
              else {
                const nb = {
                  id: 'book-' + VW.util.uid(), name: '导入词书 ' + new Date().toLocaleDateString(),
                  type: '自定义', desc: '通过导入创建', tags: [], version: '1.0', changelog: '',
                  enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                };
                bookPromise = api.books.save(nb);
              }
              return bookPromise.then(function (b) {
                drafts.forEach(function (d) { d.bookId = b.id; });
                return api.entries.list().then(function (all) {
                  const byId = new Map(all.map(function (x) { return [x.id, x]; }));
                  const plan = VW.importer.planImport(byId, drafts);
                  const writes = plan.create.concat(plan.update.map(function (u) { return u.merged; }));
                  return api.entries.bulkSave(writes).then(function () {
                    let bookUpdate = null;
                    if (isVersion) {
                      const v = verBox.querySelector('#im-ver').value.trim();
                      const log = verBox.querySelector('#im-log').value.trim();
                      const newVer = v || String((parseFloat(b.version) || 1) + 0.1);
                      bookUpdate = Object.assign({}, b, { version: newVer, changelog: log || b.changelog, updatedAt: new Date().toISOString() });
                      return api.books.save(bookUpdate).then(function () {
                        VW.ui.toast('已更新「' + b.name + '」到 v' + newVer + '（新增 ' + plan.create.length + '，更新 ' + plan.update.length + '，学习状态已保留）', 'ok');
                        m.close();
                        VW.ui.renderRoute();
                      });
                    }
                    VW.ui.toast('导入完成：新增 ' + plan.create.length + ' 词，更新 ' + plan.update.length + ' 词', 'ok');
                    m.close();
                    VW.ui.renderRoute();
                  });
                });
              });
            });
            return false;
          } },
          { text: '取消', cls: 'ghost' }
        ]
      });
    },

    download: function (text, filename, mime) {
      const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };
})();
