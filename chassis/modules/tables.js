/* M6 table kit. Hub.kit.table(id, opts) -> html. Multi-level sort (click, Shift-click adds a level), search, multi-select filters
 * and CSV of what is shown. Sort, search and filters are kept per table id, so they survive a page redraw.
 *   opts: { cols:[{ k, label, num?, val?(row), cell?(row) -> html, fmt?(v) }], rows, ref?(row) -> 'type:id', sort?:[{k,dir}],
 *           search?:true, filters?:[{ k, label, val?(row) -> value or array }], csv?:'file.csv', limit?:n } */
(function () {
  var esc = Hub.esc, T = {};
  Hub.labelDefaults({ tkCsv: 'Export CSV', tkShown: '{n} of {all}', tkClear: 'Clear', tkReset: 'Clear filters', tkShowAll: 'Show all {n}', tkNone: 'Nothing matches.', tkSortHint: 'Click to sort, Shift-click to add a level' });
  var multiSort = {
    click: function (levels, k, add, defDir) {
      var i = levels.map(function (l) { return l.k; }).indexOf(k), out = levels.slice();
      if (add) { if (i >= 0) out[i] = { k: k, dir: -out[i].dir }; else out.push({ k: k, dir: defDir || -1 }); return out; }
      return [{ k: k, dir: levels.length === 1 && i === 0 ? -levels[0].dir : (i >= 0 ? out[i].dir : defDir || -1) }];
    },
    compare: function (levels, val, tie) {   /* val(row, key) -> number, string or null; empty values sort last in both directions */
      return function (a, b) {
        for (var i = 0; i < levels.length; i++) {
          var x = val(a, levels[i].k), y = val(b, levels[i].k);
          if (x === '') x = null; if (y === '') y = null;
          if (x == null && y == null) continue; if (x == null) return 1; if (y == null) return -1;
          var d = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y;
          if (d) return d * levels[i].dir;
        }
        return tie ? tie(a, b) : 0;
      };
    },
    mark: function (levels, k) { var i = levels.map(function (l) { return l.k; }).indexOf(k); return i < 0 ? '' : ' ' + (levels[i].dir < 0 ? '↓' : '↑') + (levels.length > 1 ? '<sup>' + (i + 1) + '</sup>' : ''); }
  };
  var valOf = function (o, row, k) { var c = o.cols.filter(function (x) { return x.k === k; })[0]; return c && c.val ? c.val(row) : row[k]; };
  var fvals = function (f, row) { var v = f.val ? f.val(row) : row[f.k]; return Array.isArray(v) ? v : v == null || v === '' ? [] : [v]; };
  function shown(t) {
    var o = t.o, s = t.s, q = Hub.norm(s.q).split(/\s+/).filter(Boolean);
    var rows = o.rows.filter(function (r) {
      var ok = (o.filters || []).every(function (f) { var on = s.f[f.k]; return !on || !on.length || fvals(f, r).some(function (v) { return on.indexOf(String(v)) >= 0; }); });
      if (!ok || !q.length) return ok;
      var text = Hub.norm(o.cols.map(function (c) { return valOf(o, r, c.k); }).join(' '));
      return q.every(function (w) { return text.indexOf(w) >= 0; });
    });
    return rows.sort(multiSort.compare(s.sort, function (r, k) { return valOf(o, r, k); }));
  }
  function bodyHtml(t) {
    var o = t.o, s = t.s, rows = shown(t), lim = o.limit && !s.all ? rows.slice(0, o.limit) : rows;
    var head = o.cols.map(function (c) {
      var i = s.sort.map(function (l) { return l.k; }).indexOf(c.k);
      return '<th scope="col"' + (c.num ? ' class="num"' : '') + (i >= 0 ? ' aria-sort="' + (s.sort[i].dir < 0 ? 'descending' : 'ascending') + '"' : '') + '><button type="button" class="tk-sort" data-tk-sort="' + esc(c.k) + '" title="' + esc(Hub.t('tkSortHint')) + '">' + esc(c.label) + multiSort.mark(s.sort, c.k) + '</button></th>';
    }).join('');
    var body = lim.map(function (r) {
      var ref = o.ref && o.ref(r);
      return '<tr' + (ref ? ' data-d="' + esc(ref) + '" data-comment-key="' + esc(ref.replace(':', '-')) + '" tabindex="0"' : '') + '>' + o.cols.map(function (c) { var v = valOf(o, r, c.k); return '<td' + (c.num ? ' class="num"' : '') + '>' + (c.cell ? c.cell(r) : esc(c.fmt ? c.fmt(v) : v == null ? Hub.t('empty') : v)) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="tk-count" role="status">' + esc(Hub.t('tkShown', { n: rows.length, all: o.rows.length })) + (lim.length < rows.length ? ' <button type="button" class="linkbtn" data-tk-all>' + esc(Hub.t('tkShowAll', { n: rows.length })) + '</button>' : '') + '</div>' +
      (rows.length ? '<div class="scroll"><table class="tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' : '<p class="empty">' + esc(Hub.t('tkNone')) + '</p>');
  }
  function filtersHtml(t) {
    var o = t.o, s = t.s, any = false;
    var html = (o.filters || []).map(function (f) {
      var seen = {}; o.rows.forEach(function (r) { fvals(f, r).forEach(function (v) { seen[v] = (seen[v] || 0) + 1; }); });
      var on = s.f[f.k] || []; if (on.length) any = true;
      return '<details class="tk-f"' + (s.open === f.k ? ' open' : '') + ' data-tk-f="' + esc(f.k) + '"><summary>' + esc(f.label) + (on.length ? ' <span class="cnt">' + on.length + '</span>' : '') + '</summary><div class="tk-menu">' +
        Object.keys(seen).sort().map(function (v) { return '<label><input type="checkbox" data-tk-v="' + esc(v) + '"' + (on.indexOf(v) >= 0 ? ' checked' : '') + '> ' + esc(v) + ' <span class="cnt">' + seen[v] + '</span></label>'; }).join('') + '</div></details>';
    }).join('');
    return html + (any ? '<button type="button" class="linkbtn" data-tk-reset>' + esc(Hub.t('tkReset')) + '</button>' : '');
  }
  function draw(id, what) {
    var box = document.querySelector('[data-tk="' + CSS.escape(id) + '"]'), t = T[id]; if (!box) return;
    box.querySelector('.tk-body').innerHTML = bodyHtml(t);
    if (what === 'filters') box.querySelector('.tk-filters').innerHTML = filtersHtml(t);
  }
  function csv(t) {
    var o = t.o, safe = function (v) { var s = String(v == null ? '' : v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }, q = function (v) { return '"' + safe(v).replace(/"/g, '""') + '"'; };
    var text = '﻿' + [o.cols.map(function (c) { return q(c.label); }).join(',')].concat(shown(t).map(function (r) { return o.cols.map(function (c) { return q(valOf(o, r, c.k)); }).join(','); })).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = o.csv; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function table(id, o) {
    var t = T[id] = { o: o, s: (T[id] && T[id].s) || { q: '', f: {}, sort: (o.sort || []).slice(), open: null, all: false } };
    return '<div class="tk" data-tk="' + esc(id) + '"><div class="tk-tools">' + (o.search ? '<input class="search" type="search" data-tk-q value="' + esc(t.s.q) + '" placeholder="' + esc(Hub.t('searchTable')) + '" aria-label="' + esc(Hub.t('searchTable')) + '">' : '') +
      '<span class="tk-filters">' + filtersHtml(t) + '</span>' + (o.csv ? '<button type="button" class="btn" data-tk-csv>' + esc(Hub.t('tkCsv')) + '</button>' : '') + '</div><div class="tk-body">' + bodyHtml(t) + '</div></div>';
  }
  var owner = function (e) { var b = e.target.closest && e.target.closest('[data-tk]'); return b ? b.getAttribute('data-tk') : null; };
  document.addEventListener('click', function (e) {
    var id = owner(e), c;
    document.querySelectorAll('.tk-f[open]').forEach(function (d) { if (!d.contains(e.target)) { d.open = false; Object.keys(T).forEach(function (k) { if (T[k].s.open === d.getAttribute('data-tk-f')) T[k].s.open = null; }); } });
    if (!id) return; var t = T[id];
    if ((c = e.target.closest('[data-tk-sort]'))) { var k = c.getAttribute('data-tk-sort'), col = t.o.cols.filter(function (x) { return x.k === k; })[0]; t.s.sort = multiSort.click(t.s.sort, k, e.shiftKey || e.metaKey || e.ctrlKey, col.num ? -1 : 1); draw(id); var again = document.querySelector('[data-tk="' + CSS.escape(id) + '"] [data-tk-sort="' + CSS.escape(k) + '"]'); if (again) again.focus(); return; }
    if (e.target.closest('[data-tk-csv]')) { csv(t); return; }
    if (e.target.closest('[data-tk-all]')) { t.s.all = true; draw(id); return; }
    if (e.target.closest('[data-tk-reset]')) { t.s.f = {}; t.s.open = null; draw(id, 'filters'); }
  });
  document.addEventListener('input', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-tk-q')) { var id = owner(e); T[id].s.q = e.target.value; draw(id); } });
  document.addEventListener('change', function (e) {
    var v = e.target.getAttribute && e.target.getAttribute('data-tk-v'); if (v == null) return;
    var id = owner(e), t = T[id], key = e.target.closest('[data-tk-f]').getAttribute('data-tk-f'), on = t.s.f[key] = (t.s.f[key] || []).filter(function (x) { return x !== v; });
    if (e.target.checked) on.push(v);
    t.s.open = key; draw(id, 'filters');
    var again = document.querySelector('[data-tk="' + CSS.escape(id) + '"] [data-tk-f="' + CSS.escape(key) + '"] [data-tk-v="' + CSS.escape(v) + '"]'); if (again) again.focus();
  });
  Hub.kit = Hub.kit || {}; Hub.kit.table = table; Hub.multiSort = multiSort;
})();
