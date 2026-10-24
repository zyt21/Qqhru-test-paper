(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 导入解析：CSV / JSON / 粘贴文本 / 合并策略（纯函数，可测试）
  VW.importer = {
    // 字段别名表（表头 → 规范字段）
    COLUMNS: [
      { key: 'spelling', aliases: ['单词', '拼写', '词汇', 'word', 'spelling', 'vocabulary'] },
      { key: 'phoneticUK', aliases: ['英音', '音标英', '英式音标', '音标(英)', 'phoneticuk'] },
      { key: 'phoneticUS', aliases: ['美音', '音标美', '美式音标', '音标(美)', 'phoneticus'] },
      { key: 'pos', aliases: ['词性', 'pos', 'partofspeech'] },
      { key: 'zh', aliases: ['释义', '中文', '中文释义', '意思', 'meaning', 'translation', 'zh'] },
      { key: 'exampleEn', aliases: ['例句', '例句英文', 'example', 'sentence', 'exampleen'] },
      { key: 'exampleZh', aliases: ['例句翻译', '例句译文', 'examplezh'] },
      { key: 'collocations', aliases: ['搭配', '短语', '常见搭配', 'collocations'] },
      { key: 'synonyms', aliases: ['同义词', 'synonyms', 'synonym'] },
      { key: 'antonyms', aliases: ['反义词', 'antonyms', 'antonym'] },
      { key: 'roots', aliases: ['词根', '词根词缀', 'roots', 'root'] },
      { key: 'examTags', aliases: ['考试标签', '考试', '标签', 'examtags', 'exam'] },
      { key: 'difficulty', aliases: ['难度', 'difficulty'] },
      { key: 'frequency', aliases: ['词频', 'frequency', 'freq'] },
      { key: 'unit', aliases: ['单元', 'list', '单元/list', 'unit', '章节'] },
      { key: 'customTags', aliases: ['自定义标签', 'customtags'] }
    ],
    aliasMap: null,
    getAliasMap: function () {
      if (!VW.importer.aliasMap) {
        const m = {};
        VW.importer.COLUMNS.forEach(function (c) {
          c.aliases.forEach(function (a) { m[String(a).trim().toLowerCase()] = c.key; });
        });
        VW.importer.aliasMap = m;
      }
      return VW.importer.aliasMap;
    },
    // 解析 CSV 文本 → 二维数组（支持 BOM、引号、转义引号、CRLF）
    parseCSV: function (text) {
      text = String(text == null ? '' : text).replace(/^\uFEFF/, '');
      const rows = [];
      let row = [], cur = '', inQ = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQ) {
          if (ch === '"') {
            if (text[i + 1] === '"') { cur += '"'; i++; }
            else inQ = false;
          } else cur += ch;
        } else if (ch === '"') {
          inQ = true;
        } else if (ch === ',') {
          row.push(cur); cur = '';
        } else if (ch === '\n') {
          row.push(cur); rows.push(row); row = []; cur = '';
        } else if (ch === '\r') {
          // 跳过
        } else {
          cur += ch;
        }
      }
      if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
      return rows.filter(function (r) { return !(r.length === 1 && !r[0].trim()); });
    },
    // 根据表头自动映射 → 每列对应的规范字段（未知列为 null）
    autoMap: function (headerRow) {
      const map = VW.importer.getAliasMap();
      return (headerRow || []).map(function (h) {
        const k = String(h == null ? '' : h).trim().toLowerCase();
        return map[k] || null;
      });
    },
    // 分隔符切分
    splitList: function (s) {
      return String(s == null ? '' : s).split(/[,，;；|、]/).map(function (x) { return x.trim(); }).filter(Boolean);
    },
    // 数据行 + 列映射 → 词条草稿
    buildDrafts: function (rows, mapping, bookId, opts) {
      const drafts = [];
      const errors = [];
      if (!rows.length) return { drafts: drafts, errors: errors };
      const dataRows = rows.slice(1);
      dataRows.forEach(function (cells, idx) {
        const raw = {};
        cells.forEach(function (cell, ci) {
          const key = mapping[ci];
          if (key && cell != null && String(cell).trim() !== '') raw[key] = String(cell).trim();
        });
        if (!raw.spelling) {
          if (Object.keys(raw).length) errors.push({ row: idx + 2, reason: '缺少单词拼写（未映射到“单词”列）' });
          return;
        }
        const draft = VW.importer.rawToDraft(raw, bookId);
        if (!draft) { errors.push({ row: idx + 2, reason: '拼写无效' }); return; }
        drafts.push(draft);
      });
      return { drafts: drafts, errors: errors };
    },
    // 原始键值 → 规范化词条草稿
    rawToDraft: function (raw, bookId) {
      const spelling = String(raw.spelling || '').trim();
      const id = VW.util.normalizeKey(spelling);
      if (!id) return null;
      const posParts = VW.importer.splitList(raw.pos || '');
      const zhParts = VW.importer.splitList(raw.zh || '');
      const senses = [];
      if (zhParts.length) {
        zhParts.forEach(function (zh, i) {
          senses.push({ pos: posParts[i] || (posParts.length ? posParts[0] : ''), zh: zh });
        });
      } else if (posParts.length) {
        posParts.forEach(function (p) { senses.push({ pos: p, zh: '' }); });
      }
      const exEn = VW.importer.splitList(raw.exampleEn || '');
      const exZh = VW.importer.splitList(raw.exampleZh || '');
      const examples = [];
      exEn.forEach(function (en, i) { examples.push({ en: en, zh: exZh[i] || '' }); });
      const diff = parseInt(raw.difficulty, 10);
      const freq = parseInt(raw.frequency, 10);
      return {
        id: id,
        spelling: spelling,
        phoneticUK: raw.phoneticUK || '',
        phoneticUS: raw.phoneticUS || '',
        senses: senses,
        examples: examples,
        collocations: VW.importer.splitList(raw.collocations),
        synonyms: VW.importer.splitList(raw.synonyms),
        antonyms: VW.importer.splitList(raw.antonyms),
        roots: raw.roots || '',
        image: '', mnemonic: '', etymology: '',
        examTags: VW.importer.splitList(raw.examTags),
        difficulty: isNaN(diff) ? 3 : VW.util.clamp(diff, 1, 5),
        frequency: isNaN(freq) ? 3 : freq,
        bookId: bookId || '',
        unit: raw.unit || '',
        customTags: VW.importer.splitList(raw.customTags),
        notes: '', favorite: false
      };
    },
    // JSON 文本 → 草稿列表（支持数组 / {words:[…]} / {entries:[…]} / 键值对象）
    parseJSON: function (text, bookId) {
      let data;
      try { data = JSON.parse(String(text)); }
      catch (e) { throw new Error('JSON 解析失败：' + e.message); }
      let arr = null;
      if (Array.isArray(data)) arr = data;
      else if (data && Array.isArray(data.words)) arr = data.words;
      else if (data && Array.isArray(data.entries)) arr = data.entries;
      else if (data && Array.isArray(data.data)) arr = data.data;
      else if (data && typeof data === 'object') {
        arr = Object.keys(data).map(function (k) {
          const v = data[k];
          if (v && typeof v === 'object' && !Array.isArray(v)) return Object.assign({}, v, { spelling: v.spelling || k });
          return { spelling: k, zh: String(v) };
        });
      }
      if (!arr) throw new Error('无法识别的 JSON 结构（支持数组或 {words:[…]}）');
      const drafts = [];
      arr.forEach(function (item) {
        const raw = {};
        if (typeof item === 'string') { raw.spelling = item; }
        else if (item && typeof item === 'object') {
          raw.spelling = item.spelling || item.word || item.单词 || item.vocabulary || '';
          raw.phoneticUK = item.phoneticUK || item.phonetic_uk || item.音标英 || '';
          raw.phoneticUS = item.phoneticUS || item.phonetic_us || item.音标美 || '';
          raw.pos = item.pos || item.词性 || '';
          raw.zh = item.zh || item.meaning || item.translation || item.释义 || '';
          if (!raw.zh && Array.isArray(item.senses)) {
            raw.zh = item.senses.map(function (s) {
              return typeof s === 'string' ? s : (s.zh || s.meaning || '');
            }).filter(Boolean).join('；');
            raw.pos = item.senses.map(function (s) {
              return s && typeof s === 'object' ? (s.pos || '') : '';
            }).filter(Boolean).join('；') || raw.pos;
          }
          raw.exampleEn = item.exampleEn || item.example || item.sentence || item.例句 || '';
          if (typeof raw.exampleEn === 'object') raw.exampleEn = raw.exampleEn.en || '';
          raw.exampleZh = item.exampleZh || item.例句翻译 || '';
          if (typeof raw.exampleZh === 'object') raw.exampleZh = raw.exampleZh.zh || '';
          raw.collocations = Array.isArray(item.collocations) ? item.collocations.join('；') : (item.collocations || '');
          raw.synonyms = Array.isArray(item.synonyms) ? item.synonyms.join('；') : (item.synonyms || '');
          raw.antonyms = Array.isArray(item.antonyms) ? item.antonyms.join('；') : (item.antonyms || '');
          raw.roots = item.roots || item.词根 || '';
          raw.examTags = Array.isArray(item.examTags) ? item.examTags.join('，') : (item.examTags || item.考试标签 || '');
          raw.difficulty = item.difficulty;
          raw.frequency = item.frequency || item.freq;
          raw.unit = item.unit || item.list || item.单元 || '';
          raw.customTags = Array.isArray(item.customTags) ? item.customTags.join('，') : (item.customTags || '');
        }
        const draft = VW.importer.rawToDraft(raw, bookId);
        if (draft) drafts.push(draft);
      });
      return drafts;
    },
    // 粘贴文本 → 草稿（每行一词，可选 Tab 分隔释义）
    parsePaste: function (text, bookId) {
      const lines = String(text == null ? '' : text).split(/\r?\n/);
      const drafts = [];
      lines.forEach(function (line) {
        line = line.trim();
        if (!line) return;
        const parts = line.split('\t');
        const raw = { spelling: parts[0].trim() };
        if (parts[1]) raw.zh = parts.slice(1).join('\t').trim();
        const draft = VW.importer.rawToDraft(raw, bookId);
        if (draft) drafts.push(draft);
      });
      return drafts;
    },
    // 文件内按拼写去重（后者覆盖前者），返回去重后的草稿与重复数
    dedupeDrafts: function (drafts) {
      const seen = new Map();
      let dup = 0;
      drafts.forEach(function (d) {
        if (seen.has(d.id)) dup++;
        seen.set(d.id, d);
      });
      return { drafts: Array.from(seen.values()), dupInFile: dup };
    },
    // 合并草稿到已有词条：内容字段覆盖、用户字段（笔记/收藏/自定义标签）保留
    // 多词书归属：若导入到不同词书，则加入 bookIds 而不改变主归属
    mergeDraft: function (existing, draft) {
      const out = Object.assign({}, existing || {}, draft);
      if (existing) {
        if (draft.bookId && draft.bookId !== existing.bookId) {
          out.bookId = existing.bookId;
          const ids = new Set(existing.bookIds || []);
          ids.add(draft.bookId);
          out.bookIds = Array.from(ids).filter(function (x) { return x !== out.bookId; });
        } else {
          out.bookIds = existing.bookIds || draft.bookIds || [];
        }
        out.notes = existing.notes || '';
        out.favorite = !!existing.favorite;
        out.createdAt = existing.createdAt;
        if (draft.customTags && draft.customTags.length) {
          const set = {};
          (existing.customTags || []).forEach(function (t) { set[t] = 1; });
          draft.customTags.forEach(function (t) { set[t] = 1; });
          out.customTags = Object.keys(set);
        } else {
          out.customTags = existing.customTags || [];
        }
        if (!(draft.senses && draft.senses.length)) out.senses = existing.senses || [];
        if (!(draft.examples && draft.examples.length)) out.examples = existing.examples || [];
      }
      out.updatedAt = new Date().toISOString();
      return out;
    },
    // 生成导入计划：{create:[草稿], update:[{existing, merged}]}
    planImport: function (existingById, drafts) {
      const dedup = VW.importer.dedupeDrafts(drafts);
      const create = [], update = [];
      dedup.drafts.forEach(function (d) {
        const ex = existingById.get(d.id);
        if (ex) update.push({ existing: ex, merged: VW.importer.mergeDraft(ex, d) });
        else create.push(d);
      });
      return { create: create, update: update, dupInFile: dedup.dupInFile };
    },
    // CSV 模板文本
    templateText: function () {
      return [
        '单词,音标(英),音标(美),词性,释义,例句,例句翻译,搭配,同义词,反义词,词根,考试标签,难度,词频,单元/List,自定义标签',
        'abandon,[əˈbændən],[əˈbændən],vt.,抛弃；放弃,He abandoned the plan.,他放弃了这个计划。,abandon oneself to 沉溺于,desert；give up,keep,CET4；考研,2,4,List 1,写作词'
      ].join('\r\n');
    }
  };
})();
