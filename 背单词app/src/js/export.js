(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 导出：Anki txt（纯函数生成文本）、PDF（打印视图，中文友好，零依赖）
  VW.export_ = {
    // Anki 导入格式文本：拼写<Tab>释义
    buildAnkiText: function (entries) {
      return (entries || []).map(function (e) {
        const zh = (e.senses || []).map(function (s) { return (s.pos ? s.pos + ' ' : '') + s.zh; }).join('；');
        return e.spelling + '\t' + zh;
      }).join('\n') + '\n';
    },

    download: function (text, filename, mime) {
      const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },

    // 导出词书为 Anki txt
    exportBookAnki: function (bookId) {
      return VW.store.api.entries.list().then(function (entries) {
        const list = entries.filter(function (e) { return VW.util.inBook(e, bookId); });
        if (!list.length) { VW.ui.toast('该词书没有词条', 'err'); return; }
        VW.export_.download(VW.export_.buildAnkiText(list), '背单词-Anki-' + bookId + '.txt', 'text/plain');
        VW.ui.toast('已导出 ' + list.length + ' 词（Anki 导入格式）', 'ok');
      });
    },

    // 导出错词本为 Anki txt
    exportWrongAnki: function () {
      return Promise.all([VW.store.api.entries.list(), VW.store.api.states.list()]).then(function (r) {
        const sm = new Map(r[1].map(function (s) { return [s.id, s]; }));
        const list = r[0].filter(function (e) { const st = sm.get(e.id); return st && st.inWrongBook; });
        if (!list.length) { VW.ui.toast('错词本为空', 'err'); return; }
        VW.export_.download(VW.export_.buildAnkiText(list), '背单词-错词本-Anki.txt', 'text/plain');
        VW.ui.toast('已导出 ' + list.length + ' 个错词', 'ok');
      });
    },

    // PDF 导出：打开打印视图，选择“另存为 PDF”（系统自带，中文支持好、零依赖）
    printPDF: function (title, rows) {
      const w = window.open('', '_blank', 'width=860,height=640');
      if (!w) { VW.ui.toast('浏览器拦截了弹窗，请允许弹窗后重试', 'err'); return; }
      w.document.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + VW.util.escapeHtml(title) + '</title>' +
        '<style>body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;padding:24px;color:#222}h2{margin:0 0 4px}' +
        '.muted{color:#888;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:13px}' +
        'td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f3f4f8}' +
        '@media print{body{padding:0}}@page{margin:14mm}</style></head><body>' +
        '<h2>' + VW.util.escapeHtml(title) + '</h2>' +
        '<div class="muted">导出于 ' + new Date().toLocaleString() + ' · 共 ' + rows.length + ' 条</div>' +
        '<table><thead><tr><th style="width:140px">单词</th><th>释义</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td><b>' + VW.util.escapeHtml(r.spelling) + '</b></td><td>' + VW.util.escapeHtml(r.zh) + '</td></tr>';
        }).join('') +
        '</tbody></table>' +
        '<script>window.onload=function(){window.print()};</scr' + 'ipt></body></html>'
      );
      w.document.close();
    },

    // 导出词书 PDF
    exportBookPDF: function (bookId, bookName) {
      return VW.store.api.entries.list().then(function (entries) {
        const list = entries.filter(function (e) { return VW.util.inBook(e, bookId); }).map(function (e) {
          return { spelling: e.spelling, zh: (e.senses || []).map(function (s) { return s.zh; }).join('；') };
        });
        if (!list.length) { VW.ui.toast('该词书没有词条', 'err'); return; }
        VW.export_.printPDF('词表 · ' + (bookName || bookId), list);
      });
    },

    // 导出错词本 PDF
    exportWrongPDF: function () {
      return Promise.all([VW.store.api.entries.list(), VW.store.api.states.list()]).then(function (r) {
        const sm = new Map(r[1].map(function (s) { return [s.id, s]; }));
        const list = r[0].filter(function (e) { const st = sm.get(e.id); return st && st.inWrongBook; }).map(function (e) {
          return { spelling: e.spelling, zh: (e.senses || []).map(function (s) { return s.zh; }).join('；') };
        });
        if (!list.length) { VW.ui.toast('错词本为空', 'err'); return; }
        VW.export_.printPDF('错词本', list);
      });
    }
  };
})();
