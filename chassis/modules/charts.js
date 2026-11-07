/* M5 chart kit: hand-drawn SVG and HTML marks, one axis, colours from --hub-s1..s5, a Table toggle on every figure.
 * Tooltips work by mouse, by keyboard (one tab stop per figure, arrow keys walk the marks) and by touch (tap a mark, tap away). */
(function () {
  var esc = Hub.esc, F = Hub.fmt, tip;
  var color = function (s, i) { return s.color || 'var(--hub-s' + (i % 5 + 1) + ')'; };
  Hub.labelDefaults({ chartTable: 'Table', chartChart: 'Chart', chartPoint: 'Point', chartItem: 'Item', chartValue: 'Value', chartOf: 'of {goal}', chartStage: '{pct} of the stage before' });
  function fig(title, sub, plot, table, legend) {
    return '<figure class="fig"><figcaption><div><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' + (table ? '<button type="button" class="linkbtn" data-tbl aria-pressed="false">' + esc(Hub.t('chartTable')) + '</button>' : '') + '</figcaption>' +
      (legend || '') + '<div class="plot">' + plot + '</div>' + (table ? '<div class="scroll fig-table">' + table + '</div>' : '') + '</figure>';
  }
  function legendHtml(series) { return series.length < 2 ? '' : '<div class="legend">' + series.map(function (s, i) { return '<span><i style="background:' + color(s, i) + (s.dash ? ';opacity:.45' : '') + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>'; }
  function ticks(max) {
    var m0 = max || 1, step = Math.pow(10, Math.floor(Math.log10(m0))), m = m0 / step, s = m > 5 ? 2 : m > 2 ? 1 : .5, out = [];
    for (var v = 0; v <= m0 + 1e-9; v += s * step) out.push(v);
    if (out[out.length - 1] < m0) out.push(out[out.length - 1] + s * step);
    return out;
  }
  /* series: [{ name, color?, values, dash? }]  labels: x labels */
  function line(title, sub, labels, series, fmt, h) {
    fmt = fmt || F.k; h = h || 220;
    var W = 720, L = 48, R = 20, T = 12, B = 26, all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    var tk = ticks(Math.max.apply(null, all.concat(0))), top = tk[tk.length - 1];
    var x = function (i) { return L + (W - L - R) * (labels.length < 2 ? 0 : i / (labels.length - 1)); }, y = function (v) { return T + (h - T - B) * (1 - v / top); };
    var grid = tk.map(function (v) { return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" class="ax" text-anchor="end">' + esc(fmt(v)) + '</text>'; }).join('');
    var nx = Math.min(7, labels.length), every = Math.max(1, Math.ceil((labels.length - 1) / (nx - 1 || 1)));
    var xl = labels.map(function (l, i) { return i % every === 0 ? '<text x="' + x(i) + '" y="' + (h - 6) + '" class="ax" text-anchor="middle">' + esc(l) + '</text>' : ''; }).join('');
    var paths = series.map(function (s, n) {
      var d = '', on = false, li = -1; s.values.forEach(function (v, i) { if (v == null) { on = false; return; } d += (on ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); on = true; li = i; });
      return '<path d="' + d + '" fill="none" stroke="' + color(s, n) + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' opacity=".45"' : '') + '/>' + (li >= 0 && !s.dash ? '<circle cx="' + x(li) + '" cy="' + y(s.values[li]) + '" r="4" fill="' + color(s, n) + '" stroke="var(--hub-card)" stroke-width="2"/>' : '');
    }).join('');
    var bw = (W - L - R) / Math.max(1, labels.length - 1);
    var hit = labels.map(function (l, i) {
      var rows = series.map(function (s, n) { return s.values[i] == null ? '' : '<div><i style="background:' + color(s, n) + '"></i>' + esc(s.name) + ' <b>' + esc(fmt(s.values[i])) + '</b></div>'; }).join('');
      return '<rect class="hit" x="' + (x(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + (h - T - B) + '" data-tip="' + esc('<div class="tt-h">' + esc(l) + '</div>' + rows) + '"/>';
    }).join('');
    var table = '<table class="tbl"><thead><tr><th>' + esc(Hub.t('chartPoint')) + '</th>' + series.map(function (s) { return '<th class="num">' + esc(s.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      labels.map(function (l, i) { return '<tr><td>' + esc(l) + '</td>' + series.map(function (s) { return '<td class="num">' + esc(fmt(s.values[i])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    return fig(title, sub, '<svg viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="' + esc(title) + '">' + grid + xl + paths + hit + '</svg>', table, legendHtml(series));
  }
  /* rows: [{ label, value, sub?, color? }]  horizontal bars, the value at the tip */
  function bars(title, sub, rows, fmt) {
    fmt = fmt || F.n0;
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    var html = '<div class="hbars">' + rows.map(function (r, i) {
      return '<div class="hbar" data-tip="' + esc('<b>' + esc(r.label) + '</b> ' + esc(fmt(r.value)) + (r.sub ? '<div>' + esc(r.sub) + '</div>' : '')) + '"><div class="l">' + esc(r.label) + '</div><div class="t"><i style="width:' + (r.value / max * 100).toFixed(1) + '%;background:' + (r.color || 'var(--hub-s1)') + '"></i><b>' + esc(fmt(r.value)) + '</b></div></div>';
    }).join('') + '</div>';
    var table = '<table class="tbl"><thead><tr><th>' + esc(Hub.t('chartItem')) + '</th><th class="num">' + esc(Hub.t('chartValue')) + '</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + esc(r.label) + '</td><td class="num">' + esc(fmt(r.value)) + '</td></tr>'; }).join('') + '</tbody></table>';
    return fig(title, sub, html, table);
  }
  /* stages: [{ label, value }]  each stage shows its share of the stage before it */
  function funnel(title, sub, stages) {
    var max = stages[0].value || 1;
    var html = '<div class="funnel">' + stages.map(function (s, i) {
      var conv = i ? s.value / (stages[i - 1].value || 1) : null;
      return '<div class="fstep" data-tip="' + esc('<b>' + esc(s.label) + '</b> ' + F.n0(s.value) + (conv != null ? '<div>' + esc(Hub.t('chartStage', { pct: F.pct(conv) })) + '</div>' : '')) + '"><div class="l">' + esc(s.label) + '</div><div class="t"><i style="width:' + Math.max(1.5, s.value / max * 100).toFixed(1) + '%"></i></div><div class="v"><b>' + F.n0(s.value) + '</b><span>' + (conv != null ? F.pct(conv, 0) : '') + '</span></div></div>';
    }).join('') + '</div>';
    return fig(title, sub, html);
  }
  function meter(value, goal, fmt, label) {
    fmt = fmt || F.n0; var p = goal ? value / goal : 0;
    return '<div class="meter"><div class="meter-t"><b>' + esc(fmt(value)) + '</b><span>' + esc(Hub.t('chartOf', { goal: fmt(goal) })) + (label ? ' ' + esc(label) : '') + ' · ' + F.pct(p, 0) + '</span></div><div class="meter-b" role="progressbar" aria-valuenow="' + Math.round(p * 100) + '" aria-valuemin="0" aria-valuemax="100"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '><i style="width:' + Math.min(100, p * 100).toFixed(1) + '%"></i></div></div>';
  }
  function spark(values, c) {
    var w = 96, h = 26, max = Math.max.apply(null, values), min = Math.min.apply(null, values), r = (max - min) || 1;
    var d = values.map(function (v, i) { return (i ? 'L' : 'M') + (w * i / Math.max(1, values.length - 1)).toFixed(1) + ' ' + (h - 3 - (h - 6) * (v - min) / r).toFixed(1); }).join('');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (c || 'var(--hub-s1)') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  /* tooltip */
  function tipEl() { if (!tip) { tip = document.createElement('div'); tip.id = 'chart-tip'; tip.className = 'chart-tip'; tip.hidden = true; document.body.appendChild(tip); } return tip; }
  function show(mark, x, y) {
    var el = tipEl(); el.innerHTML = mark.getAttribute('data-tip'); el.hidden = false;
    el.style.left = Math.max(8, Math.min(x, innerWidth - el.offsetWidth - 8)) + 'px'; el.style.top = Math.max(8, Math.min(y, innerHeight - el.offsetHeight - 8)) + 'px';
  }
  function hide() { if (tip) { tip.hidden = true; tip.removeAttribute('data-hub-esc'); } }
  function showAt(mark, keep) { var r = mark.getBoundingClientRect(); show(mark, r.left + r.width / 2, r.top - 8 < 60 ? r.bottom + 8 : r.top + 8); if (keep) tipEl().setAttribute('data-hub-esc', ''); }
  function arm() { document.querySelectorAll('.plot').forEach(function (p) { if (p.hasAttribute('data-armed')) return; p.setAttribute('data-armed', ''); [].forEach.call(p.querySelectorAll('[data-tip]'), function (m, i) { m.setAttribute('tabindex', i ? -1 : 0); }); }); }
  Hub.onRender(arm); Hub.onDrawer(arm);
  var touching = false;
  document.addEventListener('pointerdown', function (e) { touching = e.pointerType === 'touch'; }, true);
  document.addEventListener('mousemove', function (e) {
    if (touching) return;
    var m = e.target.closest && e.target.closest('[data-tip]');
    if (m) show(m, e.clientX + 14, e.clientY + 14); else if (!tipEl().hasAttribute('data-hub-esc')) hide();
  });
  document.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('[data-tip]') && e.target.matches(':focus-visible')) showAt(e.target, true); });
  document.addEventListener('focusout', function (e) { if (e.target.matches && e.target.matches('[data-tip]')) hide(); });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key === 'Escape' && tip && !tip.hidden) { hide(); return; }
    if (!t.matches || !t.matches('[data-tip]') || !/^Arrow/.test(e.key)) return;
    var all = [].slice.call(t.closest('.plot').querySelectorAll('[data-tip]')), i = all.indexOf(t), to = all[i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1)];
    if (!to) return; e.preventDefault(); t.setAttribute('tabindex', -1); to.setAttribute('tabindex', 0); to.focus();
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var tg = e.target.closest('[data-tbl]');
    if (tg) { var f = tg.closest('.fig'), on = f.classList.toggle('as-table'); tg.setAttribute('aria-pressed', on); tg.textContent = Hub.t(on ? 'chartChart' : 'chartTable'); return; }
    if (touching) { var m = e.target.closest('[data-tip]'); if (m) showAt(m); else hide(); }
  });
  Hub.chart = { line: line, bars: bars, funnel: funnel, meter: meter, spark: spark };
})();
