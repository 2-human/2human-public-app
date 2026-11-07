/* M7 evidence and status labels. Every figure says where it comes from. HUB_DATA.evidence holds the words:
 *   { kinds:{ key:{ label, tone } }, notices:{ section or default: text }, noticeLabel, replace:[[section, source, holder]], confirm:[text] }
 * Hub.ev.chip(kind) a label; Hub.ev.bar(kind, text) a dated caution over a figure; Hub.ev.notice(section) a notice over a section;
 * Hub.ev.dataScreen(route) the list of what is sample and what replaces it. */
(function () {
  var esc = Hub.esc, E = function () { return (window.HUB_DATA || {}).evidence || {}; };
  Hub.ev = {
    chip: function (kind, text) { var k = (E().kinds || {})[kind] || {}; return '<span class="chip ' + esc(k.tone || '') + '">' + esc(text || k.label || kind) + '</span>'; },
    bar: function (kind, text) { return '<div class="stalebar">' + Hub.ev.chip(kind) + '<span>' + esc(text) + '</span></div>'; },
    notice: function (section) { var e = E(), n = e.notices || {}, x = n[section] || n['default']; return x ? '<div class="notice" role="note"><b>' + esc(e.noticeLabel || '') + '</b> <span>' + esc(x) + '</span></div>' : ''; },
    dataScreen: function (route) {
      Hub.route(route, function () {
        var e = E(), s = e.screen || {};
        return Hub.parts.head(s.title, s.lede) + Hub.parts.table(s.cols || [], (e.replace || []).map(function (r) { return '<tr><td><b>' + esc(r[0]) + '</b></td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + Hub.ev.chip(r[3] || 'sample') + '</td></tr>'; })) +
          ((e.confirm || []).length ? '<h2>' + esc(s.confirmTitle) + '</h2><ul>' + e.confirm.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '');
      });
    }
  };
})();
