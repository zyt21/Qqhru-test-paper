(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui.registerPage('settings', { title: '设置', render: function (el) { VW.settingsPage.render(el); } });

  VW.settingsPage = {
    render: function (el) {
      el.innerHTML = '';
      Promise.all([VW.settings.get(), VW.store.api.books.list(), VW.store.api.entries.list(), VW.store.api.states.list()])
        .then(function (r) {
          const s = r[0], books = r[1], entries = r[2], states = r[3];
          const sm = new Map(states.map(function (x) { return [x.id, x]; }));
          const enabled = books.filter(function (b) { return b.enabled; });
          let total = 0, learned = 0;
          enabled.forEach(function (b) {
            const p = VW.stats.bookProgress(entries, sm, b.id);
            total += p.total; learned += p.learned;
          });
          const today = VW.util.todayStr(s.dayStartHour);
          const plan = VW.stats.planEstimate({ total: total, learned: learned, newPerDay: s.newPerDay, targetDate: s.targetDate, today: today });

          // ---- 学习计划 ----
          const planCard = VW.ui.el('<div class="card"></div>');
          planCard.innerHTML =
            '<div class="card-title">📅 学习计划</div>' +
            '<div class="grid grid-2">' +
            '<div class="field"><label>每日新词量</label><input id="st-new" type="number" min="1" max="500" value="' + s.newPerDay + '"></div>' +
            '<div class="field"><label>每日复习上限</label><input id="st-cap" type="number" min="1" max="2000" value="' + s.reviewCap + '"></div>' +
            '<div class="field"><label>目标完成日期</label><input id="st-target" type="date" value="' + VW.util.escapeHtml(s.targetDate || '') + '"></div>' +
            '<div class="field"><label>学习日边界（凌晨几点算新一天）</label><select id="st-hour">' +
            [0, 2, 4, 6].map(function (h) { return '<option value="' + h + '"' + (s.dayStartHour === h ? ' selected' : '') + '>' + h + ':00</option>'; }).join('') +
            '</select></div>' +
            '</div>' +
            '<div class="small muted" id="st-plan-info"></div>';
          el.appendChild(planCard);

          function refreshPlanInfo() {
            const p = VW.stats.planEstimate({ total: total, learned: learned, newPerDay: parseInt(planCard.querySelector('#st-new').value, 10) || 20, targetDate: planCard.querySelector('#st-target').value, today: today });
            let txt = '启用词书共 ' + total + ' 词，已学 ' + learned + ' 词，剩余 ' + p.remaining + ' 词；按当前速度预计 <b>' + VW.ui.fmtDate(p.estimatedDate) + '</b> 完成。';
            if (p.suggestedDaily) txt += '距目标日期剩 ' + p.daysToTarget + ' 天，建议每日新词 <b>' + p.suggestedDaily + '</b>。';
            else if (s.targetDate && p.daysToTarget <= 0) txt += '目标日期已过或为今天，请重新设置。';
            planCard.querySelector('#st-plan-info').innerHTML = txt;
          }
          refreshPlanInfo();
          planCard.querySelector('#st-new').onchange = refreshPlanInfo;
          planCard.querySelector('#st-target').onchange = refreshPlanInfo;

          // ---- 算法参数 ----
          const algoCard = VW.ui.el('<div class="card" style="margin-top:14px"></div>');
          algoCard.innerHTML =
            '<div class="card-title">🧠 记忆算法（简化艾宾浩斯）</div>' +
            '<div class="grid grid-2">' +
            '<div class="field"><label>间隔序列（天，逗号分隔，对应档位 0~N）</label><input id="al-intervals" type="text" value="' + VW.util.escapeHtml(s.intervals.join(',')) + '"></div>' +
            '<div class="field"><label>顽固词阈值（错误次数 ≥ N 进入顽固队列）</label><input id="al-stub" type="number" min="1" max="20" value="' + s.stubbornThreshold + '"></div>' +
            '<div class="field"><label>错词移出连对次数</label><input id="al-exit" type="number" min="1" max="10" value="' + s.wrongExitStreak + '"></div>' +
            '<div class="field"><label>拼写验证（认词答对后必须拼写确认）</label><label class="row" style="margin:0"><input id="al-spell" type="checkbox"' + (s.spellVerify ? ' checked' : '') + ' style="width:auto"><span class="small">开启</span></label></div>' +
            '</div>' +
            '<div class="small muted">规则：认识 → 升 1 档；模糊 → 原档当日重排；不认识 → 降 1 档并计入错误。</div>';
          el.appendChild(algoCard);

          // ---- 外观与提醒 ----
          const uiCard = VW.ui.el('<div class="card" style="margin-top:14px"></div>');
          uiCard.innerHTML =
            '<div class="card-title">🎨 外观与提醒</div>' +
            '<div class="grid grid-2">' +
            '<div class="field"><label>主题</label><select id="ui-theme">' +
            '<option value="system"' + (s.theme === 'system' ? ' selected' : '') + '>跟随系统</option>' +
            '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>浅色</option>' +
            '<option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>深色</option>' +
            '<option value="eye"' + (s.theme === 'eye' ? ' selected' : '') + '>护眼（米黄）</option>' +
            '</select></div>' +
            '<div class="field"><label>打开页面时的任务提醒</label><label class="row" style="margin:0"><input id="ui-remind" type="checkbox"' + (s.remind ? ' checked' : '') + ' style="width:auto"><span class="small">开启</span></label></div>' +
            '</div>';
          el.appendChild(uiCard);

          // ---- 数据：备份 / 恢复 / 导出 ----
          const dataCard = VW.ui.el('<div class="card" style="margin-top:14px"></div>');
          dataCard.innerHTML = '<div class="card-title">💾 数据</div><div class="small muted" style="margin-bottom:10px">数据保存在当前浏览器本地。建议每 7 天导出一次备份。</div><div class="row" style="flex-wrap:wrap"></div>';
          const dataBtns = dataCard.querySelector('.row');
          function dbtn(text, cls, fn) {
            const b = VW.ui.el('<button class="btn small ' + (cls || '') + '"></button>');
            b.textContent = text; b.onclick = fn; dataBtns.appendChild(b);
          }
          dbtn('⬇ 导出备份文件', 'primary', function () {
            VW.backup.exportData(VW.store.api).then(function (data) {
              VW.export_.download(JSON.stringify(data), 'backup-' + VW.util.todayStr(s.dayStartHour) + '.json', 'application/json');
              return VW.settings.save({ backupLastAt: Date.now() });
            }).then(function () { VW.ui.toast('备份已导出', 'ok'); });
          });
          dbtn('⬆ 导入备份（恢复）', '', function () {
            const inp = VW.ui.el('<input type="file" accept=".json">');
            inp.onchange = function () {
              const f = inp.files[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = function () {
                let data;
                try { data = JSON.parse(reader.result); }
                catch (e) { VW.ui.toast('备份文件解析失败：' + e.message, 'err'); return; }
                const v = VW.backup.validate(data);
                if (!v.ok) { VW.ui.toast(v.reason, 'err'); return; }
                const body = VW.ui.el('<div></div>');
                body.innerHTML = '<div class="small">备份时间：' + VW.util.escapeHtml(data.exportedAt || '未知') + ' · 词条 ' + (data.entries || []).length + ' 个</div>' +
                  '<div class="small" style="margin-top:8px">请选择恢复方式：</div>';
                const m = VW.ui.openModal({
                  title: '恢复备份',
                  body: body,
                  buttons: [
                    { text: '覆盖恢复（清空当前数据）', cls: 'danger', close: false, onClick: function () {
                      VW.ui.confirm({ title: '覆盖恢复', message: '当前全部数据将被清空并替换为备份内容，确定继续？', danger: true, okText: '覆盖' }).then(function (ok) {
                        if (!ok) return;
                        VW.backup.restore(VW.store.api, data, 'overwrite').then(function (res) {
                          VW.ui.toast('恢复完成', 'ok');
                          m.close();
                          location.reload();
                        }).catch(function (e) { VW.ui.toast(e.message, 'err'); });
                      });
                      return false;
                    } },
                    { text: '合并恢复（保留本地数据）', cls: 'primary', close: false, onClick: function () {
                      VW.backup.restore(VW.store.api, data, 'merge').then(function () {
                        VW.ui.toast('合并恢复完成', 'ok');
                        m.close();
                        location.reload();
                      }).catch(function (e) { VW.ui.toast(e.message, 'err'); });
                      return false;
                    } },
                    { text: '取消', cls: 'ghost' }
                  ]
                });
              };
              reader.readAsText(f, 'UTF-8');
            };
            inp.click();
          });
          dbtn('Anki 词表', '', function () { VW.export_.exportBookAnki(s.defaultBookId || (enabled[0] ? enabled[0].id : '')); });
          dbtn('Anki 错词', '', function () { VW.export_.exportWrongAnki(); });
          dbtn('PDF 词表', '', function () { VW.export_.exportBookPDF(s.defaultBookId || (enabled[0] ? enabled[0].id : ''), ''); });
          dbtn('PDF 错词', '', function () { VW.export_.exportWrongPDF(); });
          dbtn('🗑 清空全部数据', 'danger', function () {
            VW.ui.confirm({ title: '清空全部数据', message: '将删除全部词书、学习记录与设置（建议先导出备份）。确定清空？', danger: true, okText: '清空' })
              .then(function (ok) {
                if (!ok) return;
                const jobs = VW.db.STORES.map(function (k) { return VW.store.api[k].clear(); });
                return Promise.all(jobs).then(function () { location.reload(); });
              });
          });
          el.appendChild(dataCard);

          // ---- 限制说明 ----
          const note = VW.ui.el('<div class="card" style="margin-top:14px"></div>');
          note.innerHTML = '<div class="card-title">ℹ️ 使用须知</div><ul class="small muted" style="line-height:1.9">' +
            '<li>· 数据保存在当前浏览器的本地存储中，不联网、无云端。</li>' +
            '<li>· 手机与电脑是两份独立数据，可通过备份文件迁移。</li>' +
            '<li>· 提醒仅在页面打开时生效，页面关闭后无法弹提醒。</li>' +
            '<li>· 本应用不含发音功能（音标仅展示）。</li></ul>';
          el.appendChild(note);

          // ---- 保存 ----
          function collect() {
            const intervals = algoCard.querySelector('#al-intervals').value.split(/[,，]/).map(function (x) { return parseInt(x.trim(), 10); }).filter(function (x) { return !isNaN(x) && x >= 0; });
            if (intervals.length < 2) { VW.ui.toast('间隔序列至少需要 2 档', 'err'); return null; }
            const patch = {
              newPerDay: VW.util.clamp(parseInt(planCard.querySelector('#st-new').value, 10) || 20, 1, 500),
              reviewCap: VW.util.clamp(parseInt(planCard.querySelector('#st-cap').value, 10) || 100, 1, 2000),
              targetDate: planCard.querySelector('#st-target').value,
              dayStartHour: parseInt(planCard.querySelector('#st-hour').value, 10),
              intervals: intervals,
              stubbornThreshold: VW.util.clamp(parseInt(algoCard.querySelector('#al-stub').value, 10) || 3, 1, 20),
              wrongExitStreak: VW.util.clamp(parseInt(algoCard.querySelector('#al-exit').value, 10) || 2, 1, 10),
              spellVerify: algoCard.querySelector('#al-spell').checked,
              theme: uiCard.querySelector('#ui-theme').value,
              remind: uiCard.querySelector('#ui-remind').checked
            };
            return patch;
          }
          const saveBtn = VW.ui.el('<button class="btn primary big" style="margin-top:16px">保存设置</button>');
          saveBtn.onclick = function () {
            const patch = collect();
            if (!patch) return;
            VW.settings.save(patch).then(function () {
              return VW.ui.applyTheme();
            }).then(function () {
              VW.ui.toast('设置已保存', 'ok');
            });
          };
          el.appendChild(saveBtn);
        });
    }
  };
})();
