/* M3 group filter: one hub, several brands or teams. Groups live in HUB_DATA.groups: [{ id, label, accent? }].
 * Views call Hub.inGroup(item.group). A group with an accent recolours the hub while it is selected. */
(function () {
  var cur = Hub.store.get('group') || 'all';
  function paint() {
    var D = window.HUB_DATA || {}, g = (D.groups || []).filter(function (x) { return x.id === cur; })[0];
    document.body.setAttribute('data-group', cur);
    if (g && g.accent) document.body.style.setProperty('--hub-accent', g.accent); else document.body.style.removeProperty('--hub-accent');
    document.querySelectorAll('#group-seg [data-group]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-group') === cur); });
  }
  Hub.labelDefaults({ groupAll: 'All', groupFilter: 'Filter by group' });
  Hub.inGroup = function (g) { return cur === 'all' || !g || g === cur; };
  Hub.group = function () { return cur; };
  Hub.setGroup = function (g) { cur = g; Hub.store.set('group', g); paint(); Hub.render(); };
  Hub.ready(function (D) {
    var list = D.groups || []; if (!list.length) return;
    if (cur !== 'all' && !list.some(function (x) { return x.id === cur; })) cur = 'all';
    var btn = function (id, label) { return '<button type="button" data-group="' + Hub.esc(id) + '" aria-pressed="false">' + Hub.esc(label) + '</button>'; };
    Hub.bar('<span class="seg" id="group-seg" role="group" aria-label="' + Hub.esc(Hub.t('groupFilter')) + '">' + btn('all', Hub.t('groupAll')) + list.map(function (x) { return btn(x.id, x.label); }).join('') + '</span>');
    paint();
  });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#group-seg [data-group]'); if (b) Hub.setGroup(b.getAttribute('data-group')); });
})();
