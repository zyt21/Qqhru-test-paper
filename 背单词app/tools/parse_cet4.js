// 解析两个四级词库 txt，生成 src/js/seed-cet4.js（结构化词条数据）
'use strict';
const fs = require('fs');
const path = require('path');

const SRC1 = path.join(__dirname, '..', 'convert', 'cet4-1500.txt');
const SRC2 = path.join(__dirname, '..', 'convert', 'cet4-1000.txt');
const OUT = path.join(__dirname, '..', 'src', 'js', 'seed-cet4.js');
const NOW = '2026-10-21T00:00:00.000Z';

// ===== 部首/兼容字符归一化表（codepoint → 标准汉字） =====
const RADMAP = {
  // Kangxi Radicals U+2F00–U+2FD5
  0x2F00: '一', 0x2F01: '丨', 0x2F02: '丶', 0x2F03: '丿', 0x2F04: '乙', 0x2F05: '亅',
  0x2F06: '二', 0x2F07: '亠', 0x2F08: '人', 0x2F09: '儿', 0x2F0A: '入', 0x2F0B: '八',
  0x2F0C: '冂', 0x2F0D: '冖', 0x2F0E: '冫', 0x2F0F: '几', 0x2F10: '凵', 0x2F11: '刀',
  0x2F12: '力', 0x2F13: '勹', 0x2F14: '匕', 0x2F15: '匚', 0x2F16: '匸', 0x2F17: '十',
  0x2F18: '卜', 0x2F19: '卩', 0x2F1A: '厂', 0x2F1B: '厶', 0x2F1C: '又', 0x2F1D: '口',
  0x2F1E: '囗', 0x2F1F: '土', 0x2F20: '士', 0x2F21: '夂', 0x2F22: '夊', 0x2F23: '夕',
  0x2F24: '大', 0x2F25: '女', 0x2F26: '子', 0x2F27: '宀', 0x2F28: '寸', 0x2F29: '小',
  0x2F2A: '尢', 0x2F2B: '尸', 0x2F2C: '屮', 0x2F2D: '山', 0x2F2E: '巛', 0x2F2F: '工',
  0x2F30: '己', 0x2F31: '巾', 0x2F32: '干', 0x2F33: '幺', 0x2F34: '广', 0x2F35: '廴',
  0x2F36: '廾', 0x2F37: '弋', 0x2F38: '弓', 0x2F39: '彐', 0x2F3A: '彡', 0x2F3B: '彳',
  0x2F3C: '心', 0x2F3D: '戈', 0x2F3E: '户', 0x2F3F: '手', 0x2F40: '支', 0x2F41: '攴',
  0x2F42: '文', 0x2F43: '斗', 0x2F44: '斤', 0x2F45: '方', 0x2F46: '无', 0x2F47: '日',
  0x2F48: '曰', 0x2F49: '月', 0x2F4A: '木', 0x2F4B: '欠', 0x2F4C: '止', 0x2F4D: '歹',
  0x2F4E: '殳', 0x2F4F: '母', 0x2F50: '比', 0x2F51: '毛', 0x2F52: '氏', 0x2F53: '气',
  0x2F54: '水', 0x2F55: '火', 0x2F56: '爪', 0x2F57: '父', 0x2F58: '爻', 0x2F59: '爿',
  0x2F5A: '片', 0x2F5B: '牙', 0x2F5C: '牛', 0x2F5D: '犬', 0x2F5E: '玄', 0x2F5F: '玉',
  0x2F60: '瓜', 0x2F61: '瓦', 0x2F62: '甘', 0x2F63: '生', 0x2F64: '用', 0x2F65: '田',
  0x2F66: '疋', 0x2F67: '疒', 0x2F68: '癶', 0x2F69: '白', 0x2F6A: '皮', 0x2F6B: '皿',
  0x2F6C: '目', 0x2F6D: '矛', 0x2F6E: '矢', 0x2F6F: '石', 0x2F70: '示', 0x2F71: '禸',
  0x2F72: '禾', 0x2F73: '穴', 0x2F74: '立', 0x2F75: '竹', 0x2F76: '米', 0x2F77: '糸',
  0x2F78: '缶', 0x2F79: '网', 0x2F7A: '羊', 0x2F7B: '羽', 0x2F7C: '老', 0x2F7D: '而',
  0x2F7E: '耒', 0x2F7F: '耳', 0x2F80: '聿', 0x2F81: '肉', 0x2F82: '臣', 0x2F83: '自',
  0x2F84: '至', 0x2F85: '臼', 0x2F86: '舌', 0x2F87: '舛', 0x2F88: '舟', 0x2F89: '艮',
  0x2F8A: '色', 0x2F8B: '艹', 0x2F8C: '虍', 0x2F8D: '虫', 0x2F8E: '血', 0x2F8F: '行',
  0x2F90: '衣', 0x2F91: '西', 0x2F92: '见', 0x2F93: '角', 0x2F94: '言', 0x2F95: '谷',
  0x2F96: '豆', 0x2F97: '豕', 0x2F98: '豸', 0x2F99: '贝', 0x2F9A: '赤', 0x2F9B: '走',
  0x2F9C: '足', 0x2F9D: '身', 0x2F9E: '车', 0x2F9F: '辛', 0x2FA0: '辰', 0x2FA1: '辶',
  0x2FA2: '邑', 0x2FA3: '酉', 0x2FA4: '釆', 0x2FA5: '里', 0x2FA6: '金', 0x2FA7: '长',
  0x2FA8: '门', 0x2FA9: '阜', 0x2FAA: '隶', 0x2FAB: '隹', 0x2FAC: '雨', 0x2FAD: '青',
  0x2FAE: '非', 0x2FAF: '面', 0x2FB0: '革', 0x2FB1: '韦', 0x2FB2: '韭', 0x2FB3: '音',
  0x2FB4: '页', 0x2FB5: '风', 0x2FB6: '飞', 0x2FB7: '食', 0x2FB8: '首', 0x2FB9: '香',
  0x2FBA: '马', 0x2FBB: '骨', 0x2FBC: '高', 0x2FBD: '髟', 0x2FBE: '鬥', 0x2FBF: '鬯',
  0x2FC0: '鬲', 0x2FC1: '鬼', 0x2FC2: '鱼', 0x2FC3: '鸟', 0x2FC4: '卤', 0x2FC5: '鹿',
  0x2FC6: '麦', 0x2FC7: '麻', 0x2FC8: '黄', 0x2FC9: '黍', 0x2FCA: '黑', 0x2FCB: '黹',
  0x2FCC: '黾', 0x2FCD: '鼎', 0x2FCE: '鼓', 0x2FCF: '鼠', 0x2FD0: '鼻', 0x2FD1: '齐',
  0x2FD2: '齿', 0x2FD3: '龙', 0x2FD4: '龟', 0x2FD5: '龠',
  // CJK Radicals Supplement U+2E80–U+2EFF（简化部首）
  0x2E80: '⺀', 0x2E81: '⺁', 0x2E82: '⺂', 0x2E83: '⺃', 0x2E84: '⺄', 0x2E85: '⺅', 0x2E86: '⺆', 0x2E87: '⺇',
  0x2E88: '⺈', 0x2E89: '⺉', 0x2E8A: '⺊', 0x2E8B: '⺋', 0x2E8C: '⺌', 0x2E8D: '⺍', 0x2E8E: '⺎', 0x2E8F: '⺏',
  0x2E90: '⺐', 0x2E91: '⺑', 0x2E92: '⺒', 0x2E93: '⺓', 0x2E94: '⺔', 0x2E95: '⺕', 0x2E96: '⺖', 0x2E97: '⺗',
  0x2E98: '⺘', 0x2E99: '⺙', 0x2E9A: '⺚', 0x2E9B: '⺛', 0x2E9C: '⺜', 0x2E9D: '⺝', 0x2E9E: '⺞', 0x2E9F: '⺟',
  0x2EA0: '⺠', 0x2EA1: '⺡', 0x2EA2: '⺢', 0x2EA3: '⺣', 0x2EA4: '⺤', 0x2EA5: '⺥', 0x2EA6: '⺦', 0x2EA7: '⺧',
  0x2EA8: '⺨', 0x2EA9: '⺩', 0x2EAA: '⺪', 0x2EAB: '⺫', 0x2EAC: '⺬', 0x2EAD: '⺭', 0x2EAE: '⺮', 0x2EAF: '⺯',
  0x2EB0: '⺰', 0x2EB1: '⺱', 0x2EB2: '⺲', 0x2EB3: '⺳', 0x2EB4: '⺴', 0x2EB5: '⺵', 0x2EB6: '⺶', 0x2EB7: '⺷',
  0x2EB8: '⺸', 0x2EB9: '⺹', 0x2EBA: '⺺', 0x2EBB: '⺻', 0x2EBC: '⺼', 0x2EBD: '⺽', 0x2EBE: '⺾', 0x2EBF: '⺿',
  0x2EC0: '⻀', 0x2EC1: '⻁', 0x2EC2: '⻂', 0x2EC3: '⻃', 0x2EC4: '⻄', 0x2EC5: '见', 0x2EC6: '⻆', 0x2EC7: '⻇',
  0x2EC8: '⻈', 0x2EC9: '⻉', 0x2ECA: '⻊', 0x2ECB: '⻋', 0x2ECC: '⻌', 0x2ECD: '⻍', 0x2ECE: '⻎', 0x2ECF: '⻏',
  0x2ED0: '⻐', 0x2ED1: '⻑', 0x2ED2: '⻒', 0x2ED3: '长', 0x2ED4: '门', 0x2ED5: '⻕', 0x2ED6: '⻖', 0x2ED7: '⻗',
  0x2ED8: '⻘', 0x2ED9: '韦', 0x2EDA: '页', 0x2EDB: '风', 0x2EDC: '飞', 0x2EDD: '饣', 0x2EDE: '食', 0x2EDF: '⻟',
  0x2EE0: '讠', 0x2EE1: '⻡', 0x2EE2: '马', 0x2EE3: '骨', 0x2EE4: '⻤', 0x2EE5: '鱼', 0x2EE6: '鸟', 0x2EE7: '卤',
  0x2EE8: '麦', 0x2EE9: '黄', 0x2EEA: '黾', 0x2EEB: '齐', 0x2EEC: '齿', 0x2EED: '龙', 0x2EEE: '龟', 0x2EEF: '⻯',
  0x2EF0: '⻰', 0x2EF1: '⻱', 0x2EF2: '⻲', 0x2EF3: '⻳'
};

function normalizeRadicals(text) {
  return Array.from(text).map(function (ch) {
    const cp = ch.codePointAt(0);
    if (RADMAP[cp]) return RADMAP[cp];
    if (cp >= 0x2E80 && cp <= 0x2FDF) {
      RADICALS_FOUND[ch] = (RADICALS_FOUND[ch] || 0) + 1;
      return ch; // 未映射的保留，稍后诊断
    }
    return ch;
  }).join('');
}
const RADICALS_FOUND = {};

// ===== 解析定义文本为义项 =====
const POS_RE = /((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|a|ad)\.)(?:\/((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|a|ad)\.))?/g;

function splitSenses(zh, primary, fallback) {
  const parts = zh.split(new RegExp('[' + primary + ']')).map(function (x) { return x.trim(); }).filter(Boolean);
  if (parts.length > 1) return parts;
  return zh.split(new RegExp('[' + fallback + ']')).map(function (x) { return x.trim(); }).filter(Boolean);
}

// file1: 主分隔 ；; 次 ,，、；  file2: 主 ,， 次 ；;
function parseDefs(defText, style) {
  const text = defText.replace(/[，,;；]+$/g, '').trim();
  if (!text) return [];
  // 切分 pos 段
  const segs = [];
  let m;
  POS_RE.lastIndex = 0;
  const starts = [];
  while ((m = POS_RE.exec(text))) {
    starts.push({ idx: m.index, pos: m[1] + (m[2] || '') });
  }
  if (!starts.length) {
    // 无词性标注：整体作为无词性释义
    return splitSenses(text, style === 2 ? ',，' : '；;', style === 2 ? '；;' : ',，、').map(function (zh) { return { pos: '', zh: zh }; });
  }
  starts.forEach(function (s, i) {
    const end = i + 1 < starts.length ? starts[i + 1].idx : text.length;
    let segText = text.slice(s.idx, end);
    const posStr = s.pos.replace(/\.+$/, '');
    segText = segText.replace(/^[^]*?\./, ''); // 去掉 pos 前缀（含复合 /pos.）
    segText = segText.replace(/^\./, '');
    const zhParts = splitSenses(segText, style === 2 ? ',，' : '；;', style === 2 ? '；;' : ',，、');
    const posList = posStr.split('/').map(function (p) { return p.trim(); }).filter(Boolean);
    posList.forEach(function (p) {
      zhParts.forEach(function (zh) {
        if (zh) segs.push({ pos: p + '.', zh: zh });
      });
    });
  });
  return segs;
}

// ===== 行解析 =====
function parseLine(line, style) {
  // style 1: 序号.单词[音标]（注解） 词性.释义
  // style 2: 序号. 单词 (考频X次) 词性.释义
  const m1 = line.match(/^(\d+)[.．]\s*([A-Za-z][A-Za-z\-'']*)\s*(?:（([^）]*)）\s*)?(?:\[([^\]]*)\])?\s*(.*)$/);
  const m2 = line.match(/^(\d+)[.．]\s*([A-Za-z][A-Za-z\-'']*)\s*\(考频\s*(\d+)\s*次\)?\s*(.*)$/);
  if (style === 2 && m2) {
    return { spelling: m2[2], phonetic: '', freqRaw: parseInt(m2[3], 10), defs: m2[4] };
  }
  if (style === 1 && m1) {
    return { spelling: m1[2], phonetic: m1[4] || '', note: m1[3] || '', freqRaw: null, defs: m1[5] };
  }
  return null;
}

// 考频 → 1-5 档
function freqBand(n) {
  if (n >= 40) return 5;
  if (n >= 20) return 4;
  if (n >= 10) return 3;
  if (n >= 5) return 2;
  return 1;
}

function normKey(sp) { return String(sp).trim().toLowerCase(); }

function makeEntry(spelling, senses, opts) {
  const id = normKey(spelling);
  return {
    id: id,
    spelling: spelling,
    phoneticUK: opts.phonetic || '',
    phoneticUS: '',
    senses: senses,
    examples: [],
    collocations: [],
    synonyms: [],
    antonyms: [],
    roots: '',
    image: '', mnemonic: '', etymology: '',
    examTags: ['CET4'],
    difficulty: 3,
    frequency: opts.frequency || 3,
    bookId: opts.bookId,
    bookIds: opts.bookIds || [],
    unit: opts.unit,
    customTags: [], notes: '', favorite: false,
    createdAt: NOW, updatedAt: NOW
  };
}

function unitOf(index, size) {
  return 'List ' + (Math.floor(index / size) + 1);
}

// ===== 主流程 =====
const raw1 = fs.readFileSync(SRC1, 'utf8');
const raw2 = fs.readFileSync(SRC2, 'utf8');

const lines1 = raw1.split(/\r?\n/).map(normalizeRadicals);
const lines2 = raw2.split(/\r?\n/).map(normalizeRadicals);

const skipped1 = [], skipped2 = [];
const parsed1 = [];
lines1.forEach(function (line) {
  const t = line.trim();
  if (!t) return;
  const p = parseLine(t, 1);
  if (!p) { skipped1.push(t); return; }
  const senses = parseDefs(p.defs, 1);
  if (!senses.length) { skipped1.push(t + '  ← 无义项'); return; }
  parsed1.push({ spelling: p.spelling, phonetic: p.phonetic, senses: senses, freqRaw: null });
});
const parsed2 = [];
lines2.forEach(function (line) {
  const t = line.trim();
  if (!t) return;
  const p = parseLine(t, 2);
  if (!p) { skipped2.push(t); return; }
  const senses = parseDefs(p.defs, 2);
  if (!senses.length) { skipped2.push(t + '  ← 无义项'); return; }
  parsed2.push({ spelling: p.spelling, phonetic: '', senses: senses, freqRaw: p.freqRaw });
});

// 文件内去重
function dedupe(arr) {
  const seen = new Map();
  let dup = 0;
  arr.forEach(function (p) {
    const k = normKey(p.spelling);
    if (seen.has(k)) { dup++; const prev = seen.get(k); if ((p.freqRaw || 0) > (prev.freqRaw || 0)) seen.set(k, p); return; }
    seen.set(k, p);
  });
  return { list: Array.from(seen.values()), dup: dup };
}
const d1 = dedupe(parsed1);
const d2 = dedupe(parsed2);

// 合并两书（重叠词 → bookIds 多归属）
const byKey = new Map();
d1.list.forEach(function (p, i) {
  byKey.set(normKey(p.spelling), makeEntry(p.spelling, p.senses, {
    phonetic: p.phonetic, frequency: 3, bookId: 'cet4-1500', unit: unitOf(i, 50)
  }));
});
let overlap = 0;
d2.list.forEach(function (p, i) {
  const k = normKey(p.spelling);
  const band = freqBand(p.freqRaw || 0);
  const existing = byKey.get(k);
  if (existing) {
    overlap++;
    if (!existing.bookIds.includes('cet4-1000')) existing.bookIds.push('cet4-1000');
    if (band > existing.frequency) existing.frequency = band;
    return;
  }
  byKey.set(k, makeEntry(p.spelling, p.senses, {
    phonetic: '', frequency: band, bookId: 'cet4-1000', unit: unitOf(i, 50)
  }));
});
const entries = Array.from(byKey.values());

const BOOKS = [
  {
    id: 'cet4-1500', name: '四级1500核心词', type: '考试',
    desc: '来自桌面文档《四级1500核心词》', tags: ['CET4'], version: '1.0',
    changelog: '导入自本地文档', enabled: true, createdAt: NOW, updatedAt: NOW
  },
  {
    id: 'cet4-1000', name: '四级1000高频词', type: '考试',
    desc: '来自桌面文档《四级1000高频词》（含考频）', tags: ['CET4'], version: '1.0',
    changelog: '导入自本地文档', enabled: true, createdAt: NOW, updatedAt: NOW
  }
];

// 生成 JS 文件
const ensureFn = `(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 内置词书：四级1500核心词 + 四级1000高频词（由 tools/parse_cet4.js 从本地文档生成）
  VW.seedCET4 = {
    BOOKS: __BOOKS__,
    ENTRIES: __ENTRIES__,

    // 首次运行自动装载（幂等）；与已有词条（如示例词书）合并：保留已有内容、补齐字段、合并词书归属
    ensure: function () {
      const api = VW.store.api;
      if (!api) return Promise.resolve(false);
      return Promise.all(VW.seedCET4.BOOKS.map(function (b) { return api.books.get(b.id); })).then(function (books) {
        const missing = VW.seedCET4.BOOKS.filter(function (b, i) { return !books[i]; });
        if (!missing.length) return false;
        const jobs = missing.map(function (b) { return api.books.save(b); });
        return Promise.all(jobs).then(function () {
          return api.entries.list();
        }).then(function (all) {
          const byId = new Map(all.map(function (e) { return [e.id, e]; }));
          const merged = VW.seedCET4.ENTRIES.map(function (ne) {
            const ex = byId.get(ne.id);
            if (!ex) return ne;
            const out = Object.assign({}, ne, ex);
            const ids = new Set();
            [ex.bookId, ne.bookId].concat(ex.bookIds || [], ne.bookIds || []).forEach(function (x) { if (x) ids.add(x); });
            out.bookId = ex.bookId || ne.bookId;
            out.bookIds = Array.from(ids).filter(function (x) { return x !== out.bookId; });
            if (!(out.senses && out.senses.length)) out.senses = ne.senses;
            if (!out.phoneticUK) out.phoneticUK = ne.phoneticUK;
            if ((ne.frequency || 0) > (out.frequency || 0)) out.frequency = ne.frequency;
            if (!out.examTags || !out.examTags.length) out.examTags = ne.examTags;
            out.updatedAt = '__NOW__';
            return out;
          });
          return api.entries.bulkSave(merged);
        }).then(function () { return true; });
      });
    }
  };
})();
`;

const outJs =
  '(function () {\n' +
  "  'use strict';\n" +
  '  const VW = globalThis.VW = globalThis.VW || {};\n' +
  '  // 生成数据：四级1500核心词 + 四级1000高频词（由 tools/parse_cet4.js 生成，勿手改）\n' +
  ensureFn
    .replace('__BOOKS__', JSON.stringify(BOOKS))
    .replace('__ENTRIES__', JSON.stringify(entries))
    .replace('__NOW__', NOW) +
  '\n})();\n';

fs.writeFileSync(OUT, outJs, 'utf8');

// ===== 诊断输出 =====
console.log('parsed1:', parsed1.length, 'dup1:', d1.dup);
console.log('parsed2:', parsed2.length, 'dup2:', d2.dup);
console.log('total entries (union):', entries.length);
console.log('overlap:', overlap);
console.log('book1 members:', entries.filter(function (e) { return e.bookId === 'cet4-1500' || e.bookIds.indexOf('cet4-1500') >= 0; }).length);
console.log('book2 members:', entries.filter(function (e) { return e.bookId === 'cet4-1000' || e.bookIds.indexOf('cet4-1000') >= 0; }).length);
console.log('skipped1:', skipped1.length, 'skipped2:', skipped2.length);
skipped1.slice(0, 15).forEach(function (l) { console.log('  SKIP1:', l.slice(0, 80)); });
skipped2.slice(0, 15).forEach(function (l) { console.log('  SKIP2:', l.slice(0, 80)); });
const rads = Object.keys(RADICALS_FOUND);
console.log('unmapped radicals:', rads.length);
rads.slice(0, 30).forEach(function (r) { console.log('  RAD U+' + r.codePointAt(0).toString(16).toUpperCase() + ' ×' + RADICALS_FOUND[r] + ' 例:' + raw1.substr(raw1.indexOf(r), 12).replace(/\n/g, ' ')); });
console.log('output:', OUT, fs.statSync(OUT).size, 'bytes');
