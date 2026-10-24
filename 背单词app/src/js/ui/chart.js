(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};
  VW.ui = VW.ui || {};

  // 内联 SVG 图表（无第三方库）
  VW.ui.chart = {
    // 折线图：points = [{label, value}]，opts {width, height, color, max}
    line: function (points, opts) {
      opts = opts || {};
      const w = opts.width || 560;
      const h = opts.height || 200;
      const pad = { l: 36, r: 14, t: 14, b: 28 };
      const max = opts.max != null ? opts.max : Math.max(10, Math.ceil(Math.max.apply(null, points.map(function (p) { return p.value; })) / 10) * 10);
      const innerW = w - pad.l - pad.r;
      const innerH = h - pad.t - pad.b;
      const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
      const px = function (i) { return pad.l + (points.length > 1 ? i * stepX : innerW / 2); };
      const py = function (v) { return pad.t + innerH - (v / max) * innerH; };
      let grid = '';
      for (let g = 0; g <= 4; g++) {
        const y = pad.t + (innerH * g / 4);
        const val = Math.round(max - (max * g / 4));
        grid += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (w - pad.r) + '" y2="' + y + '" stroke="var(--border)" stroke-dasharray="3,3"/>' +
          '<text x="' + (pad.l - 6) + '" y="' + (y + 4) + '" font-size="10" fill="var(--text-2)" text-anchor="end">' + val + '</text>';
      }
      const path = points.map(function (p, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(p.value).toFixed(1); }).join(' ');
      const dots = points.map(function (p, i) {
        return '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(p.value).toFixed(1) + '" r="3.5" fill="' + (opts.color || 'var(--primary)') + '">' +
          '<title>' + VW.util.escapeHtml(p.label) + '：' + p.value + '%</title></circle>';
      }).join('');
      const labels = points.map(function (p, i) {
        return '<text x="' + px(i).toFixed(1) + '" y="' + (h - 8) + '" font-size="10" fill="var(--text-2)" text-anchor="middle">' + VW.util.escapeHtml(p.label) + '</text>';
      }).join('');
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto">' + grid +
        '<path d="' + path + '" fill="none" stroke="' + (opts.color || 'var(--primary)') + '" stroke-width="2"/>' + dots + labels + '</svg>';
    },

    // 柱状图：items = [{label, value, color}]
    bars: function (items, opts) {
      opts = opts || {};
      const w = opts.width || 560;
      const h = opts.height || 180;
      const pad = { l: 8, r: 8, t: 14, b: 26 };
      const max = opts.max != null ? opts.max : Math.max(1, Math.max.apply(null, items.map(function (i) { return i.value; })));
      const innerW = w - pad.l - pad.r;
      const innerH = h - pad.t - pad.b;
      const bw = items.length ? innerW / items.length * 0.6 : 0;
      const bars = items.map(function (it, i) {
        const bh = (it.value / max) * innerH;
        const x = pad.l + innerW / items.length * i + (innerW / items.length - bw) / 2;
        const y = pad.t + innerH - bh;
        return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(2, bh).toFixed(1) + '" rx="4" fill="' + (it.color || 'var(--primary)') + '">' +
          '<title>' + VW.util.escapeHtml(it.label) + '：' + it.value + '</title></rect>' +
          '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 8) + '" font-size="10" fill="var(--text-2)" text-anchor="middle">' + VW.util.escapeHtml(it.label) + '</text>';
      }).join('');
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto">' + bars + '</svg>';
    }
  };
})();
