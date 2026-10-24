(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 题型引擎（纯函数）：出题、干扰项、判分、拼写验证链
  VW.quiz = {
    KINDS: ['learn', 'card', 'en2zh', 'zh2en', 'spell', 'example', 'discriminate'],
    // 认词/选择/卡片类（答“认识”后需拼写验证）
    RECOGNITION: ['card', 'en2zh', 'zh2en', 'example', 'discriminate'],

    zhOf: function (entry) {
      return (entry.senses || []).map(function (s) { return s.zh; }).join('；');
    },

    // 干扰项：优先形近（编辑距离≤2）与近义（同义词交集），不足补随机
    pickDistractors: function (entry, candidates, n, rng) {
      rng = rng || Math.random;
      const pool = (candidates || []).filter(function (e) { return e && e.id !== entry.id && e.spelling; });
      const similar = pool.filter(function (e) { return VW.util.lev(e.spelling, entry.spelling) <= 2; });
      const syn = pool.filter(function (e) {
        return (entry.synonyms || []).some(function (s) {
          return (e.synonyms || []).some(function (s2) { return s2.toLowerCase() === s.toLowerCase(); });
        });
      });
      const picked = [];
      const seen = new Set();
      similar.concat(syn, VW.util.shuffle(pool, rng)).forEach(function (e) {
        if (picked.length >= n) return;
        if (!seen.has(e.id)) { seen.add(e.id); picked.push(e); }
      });
      return picked;
    },

    // 出题：buildQuestion(entry, kind, pool, opts{rng})
    buildQuestion: function (entry, kind, pool, opts) {
      opts = opts || {};
      const rng = opts.rng || Math.random;
      const candidates = (pool || []).filter(function (e) { return e.id !== entry.id; });
      const zh = VW.quiz.zhOf(entry);
      switch (kind) {
        case 'learn':
          return { kind: 'learn', prompt: { entry: entry }, correct: entry.spelling };
        case 'card':
          return {
            kind: 'card',
            prompt: { spelling: entry.spelling, phonetic: entry.phoneticUK || entry.phoneticUS || '', back: zh },
            correct: entry.spelling
          };
        case 'en2zh': {
          const dist = VW.quiz.pickDistractors(entry, candidates, 3, rng).map(function (e) { return VW.quiz.zhOf(e); });
          const options = VW.util.shuffle([zh].concat(dist), rng);
          return { kind: 'en2zh', prompt: { spelling: entry.spelling, phonetic: entry.phoneticUK || '' }, options: options, correct: zh };
        }
        case 'zh2en': {
          const dist = VW.quiz.pickDistractors(entry, candidates, 3, rng).map(function (e) { return e.spelling; });
          const options = VW.util.shuffle([entry.spelling].concat(dist), rng);
          return { kind: 'zh2en', prompt: { zh: zh }, options: options, correct: entry.spelling };
        }
        case 'spell': {
          const ex = (entry.examples && entry.examples[0]) || null;
          return {
            kind: 'spell',
            prompt: {
              zh: zh,
              example: ex ? { en: ex.en, zh: ex.zh } : null,
              firstLetter: entry.spelling.charAt(0).toLowerCase(),
              scrambled: VW.util.shuffle(entry.spelling.toLowerCase().split(''), rng).join(''),
              length: entry.spelling.length
            },
            correct: entry.spelling.toLowerCase()
          };
        }
        case 'example': {
          const ex = (entry.examples && entry.examples[0]) || null;
          const esc = entry.spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const sentence = ex ? ex.en.replace(new RegExp('\\b' + esc + '\\b', 'i'), '____') : '';
          const options = VW.util.shuffle(
            [entry.spelling].concat(VW.quiz.pickDistractors(entry, candidates, 3, rng).map(function (e) { return e.spelling; })),
            rng
          );
          return {
            kind: 'example',
            prompt: { zh: zh, sentence: sentence, exampleZh: ex ? ex.zh : '' },
            options: options,
            correct: entry.spelling
          };
        }
        case 'discriminate': {
          const confuse = VW.quiz.pickDistractors(entry, candidates, 1, rng)[0];
          const options = VW.util.shuffle([entry.spelling, confuse.spelling], rng);
          return {
            kind: 'discriminate',
            prompt: { zh: zh, confuseZh: VW.quiz.zhOf(confuse) },
            options: options,
            correct: entry.spelling
          };
        }
      }
      return null;
    },

    // 判分：答案与正确项比较（拼写类不区分大小写）
    judge: function (question, answer) {
      const a = String(answer == null ? '' : answer).trim().toLowerCase();
      const c = String(question.correct).toLowerCase();
      return a === c;
    },

    // 该题型答“认识”后是否需要拼写验证
    needsSpellVerify: function (kind, settings) {
      return !!(settings && settings.spellVerify) && VW.quiz.RECOGNITION.indexOf(kind) >= 0;
    },

    // 易混词分组：形近（编辑距离≤2）/ 近义（同义词交集）/ 同根（词根相同）
    // 形近采用首字母+尾字母分桶剪枝，避免大词库全量两两比较
    buildConfuseGroups: function (entries, opts) {
      opts = opts || {};
      const list = (entries || []).filter(function (e) { return e && e.spelling; });
      const groups = { '形近': [], '近义': [], '同根': [] };
      const seen = new Set();
      function add(kind, a, b) {
        const k = [a.id, b.id].sort().join('|');
        if (seen.has(k)) return;
        seen.add(k);
        groups[kind].push([a, b]);
      }
      // 形近：按首字母与尾字母分桶，桶内按拼写排序后用滑窗两两比较（避免大词库 O(n²)）
      const buckets = {};
      function put(c, e) {
        (buckets[c] = buckets[c] || []).push(e);
      }
      list.forEach(function (e) {
        put('h' + (e.spelling[0] || '').toLowerCase(), e);
        put('t' + (e.spelling[e.spelling.length - 1] || '').toLowerCase(), e);
      });
      const WINDOW = 64;
      Object.keys(buckets).forEach(function (c) {
        const arr = buckets[c].slice().sort(function (a, b) { return a.spelling.localeCompare(b.spelling); });
        for (let i = 0; i < arr.length; i++) {
          const end = Math.min(arr.length, i + WINDOW);
          for (let j = i + 1; j < end; j++) {
            if (arr[i].id === arr[j].id) continue;
            if (Math.abs(arr[i].spelling.length - arr[j].spelling.length) > 2) continue;
            if (VW.util.lev(arr[i].spelling, arr[j].spelling) <= 2) add('形近', arr[i], arr[j]);
          }
        }
      });
      // 近义：同义词索引
      const synMap = new Map();
      list.forEach(function (e) {
        (e.synonyms || []).forEach(function (s) {
          const k = s.toLowerCase();
          if (!synMap.has(k)) synMap.set(k, []);
          synMap.get(k).push(e);
        });
      });
      synMap.forEach(function (arr) {
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) add('近义', arr[i], arr[j]);
        }
      });
      // 同根：词根文本索引
      const rootMap = new Map();
      list.forEach(function (e) {
        if (e.roots) {
          const k = e.roots.toLowerCase();
          if (!rootMap.has(k)) rootMap.set(k, []);
          rootMap.get(k).push(e);
        }
      });
      rootMap.forEach(function (arr) {
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) add('同根', arr[i], arr[j]);
        }
      });
      const cap = opts.maxPairs || 20;
      return [
        { kind: '形近', pairs: groups['形近'].slice(0, cap) },
        { kind: '近义', pairs: groups['近义'].slice(0, cap) },
        { kind: '同根', pairs: groups['同根'].slice(0, cap) }
      ];
    },

    // 组卷：按比例抽取（P5 测评用，先在此实现便于测试）
    buildPaper: function (items, opts) {
      // items: [{entry, state}]; opts: {count, ratio:{rec,spell,disc}, rng}
      opts = opts || {};
      const rng = opts.rng || Math.random;
      const count = opts.count || 10;
      const ratio = opts.ratio || { rec: 0.4, spell: 0.3, disc: 0.3 };
      const pool = VW.util.shuffle(items.slice(), rng).slice(0, count);
      const recCount = Math.round(pool.length * ratio.rec);
      const spellCount = Math.round(pool.length * ratio.spell);
      const questions = [];
      const entries = items.map(function (i) { return i.entry; });
      pool.forEach(function (it, i) {
        let kind;
        if (i < recCount) kind = rng() < 0.5 ? 'en2zh' : 'zh2en';
        else if (i < recCount + spellCount) kind = 'spell';
        else kind = rng() < 0.6 ? 'discriminate' : 'example';
        const q = VW.quiz.buildQuestion(it.entry, kind, entries, { rng: rng });
        if (q) questions.push({ question: q, entry: it.entry });
      });
      return questions;
    }
  };
})();
