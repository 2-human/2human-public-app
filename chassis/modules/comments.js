/* M12 comments adapter. The review widget is the only comment channel; this module only reads its records, so a Comments tab or
 * a count on a drawer stays a view of that one store. It reads when a page or drawer changes, repaints what is on screen, and never polls.
 *   Hub.comments.source(fn() -> Promise of [{ id, anchor, ref?, route?, author, text, status, at }])   connect the store
 *   Hub.comments.view(ref?) -> html    a page or tab listing the records, or one entity's; a record with ref opens that drawer
 *   Hub.comments.forRef(ref)       the records on one entity
 *   Hub.comments.read()            read again now; the store's owner calls it when its records change */
(function () {
  var esc = Hub.esc, src = null, recs = [], loaded = false;
  Hub.labelDefaults({ cmNone: 'No comments yet.', cmCount: '{n} comments', cmOn: 'On {place}', cmOpenReview: 'Add one in review mode.' });
  function read() { if (!src) return Promise.resolve(recs); return src().then(function (r) { recs = r || []; loaded = true; paint(); return recs; }, function () { return recs; }); }
  /* a view is painted before the read finishes, so a read repaints it in place */
  function paint() {
    document.querySelectorAll('[data-cm-view]').forEach(function (e) { var h = rows(e.getAttribute('data-cm-view')); if (e.cmHtml !== h) { e.cmHtml = h; e.innerHTML = h; } });
    chip(Hub.state.d);
  }
  function chip(ref) {
    var head = document.getElementById('drawer-sub'), old = document.getElementById('cm-chip'), n = ref ? forRef(ref).length : 0;
    if (old) old.remove(); if (!ref || !n) return;
    var s = document.createElement('span'); s.id = 'cm-chip'; s.className = 'chip'; s.textContent = Hub.t('cmCount', { n: n }); head.appendChild(s);
  }
  function forRef(ref) { return recs.filter(function (r) { return r.ref === ref; }); }
  function view(ref) { return '<div data-cm-view="' + esc(ref || '') + '" data-review-skip>' + rows(ref) + '</div>'; }
  function rows(ref) {
    var list = ref ? forRef(ref) : recs;
    if (!list.length) return '<p class="empty">' + esc(Hub.t('cmNone')) + ' ' + esc(Hub.t('cmOpenReview')) + '</p>';
    return Hub.parts.table(['', '', ''], list.map(function (r) {
      return '<tr' + (r.ref ? ' data-d="' + esc(r.ref) + '" tabindex="0"' : '') + '><td>' + esc(r.author) + '<br><span class="chip">' + esc(r.status) + '</span></td><td>' + esc(r.text) + '</td><td>' + esc(Hub.fmt.day(r.at)) + '</td></tr>';
    }));
  }
  Hub.onRender(read); Hub.onDrawer(read);
  Hub.comments = { source: function (fn) { src = fn; return read(); }, read: read, view: view, forRef: forRef, loaded: function () { return loaded; } };
})();
