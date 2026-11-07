/* M11 approval and write-back, neutral core only. An approval record plus a hook; publishing stays in the project's own scripts.
 *   Hub.approval.bar(ref) -> html      buttons for a record, put in a drawer
 *   Hub.approval.store(adapter)        { get(ref) -> record, set(ref, record) -> Promise }; the default keeps records in this browser
 *   Hub.approval.onChange(fn(record))  the write-back hook a project connects to its publishing step
 * record: { ref, state, by, at, note }. States and their words live in HUB_DATA.approval.states: [{ id, label, tone, note? }]. */
(function () {
  var esc = Hub.esc, hooks = [];
  Hub.labelDefaults({ apprBy: 'Your name', apprNote: 'Note', apprState: 'State: {state}', apprAt: '{by}, {at}', apprNeedName: 'Enter your name first.', apprNew: 'No decision yet' });
  var local = {
    get: function (ref) { try { return JSON.parse(Hub.store.get('appr:' + ref) || 'null'); } catch (x) { return null; } },
    set: function (ref, rec) { Hub.store.set('appr:' + ref, JSON.stringify(rec)); return Promise.resolve(rec); }
  }, adapter = local;
  var states = function () { return ((window.HUB_DATA || {}).approval || {}).states || []; };
  function bar(ref) {
    var rec = adapter.get(ref), st = rec && states().filter(function (s) { return s.id === rec.state; })[0];
    return '<div class="appr" data-appr="' + esc(ref) + '"><p>' + (st ? '<span class="chip ' + esc(st.tone || '') + '">' + esc(st.label) + '</span>' + esc(Hub.t('apprAt', { by: rec.by, at: Hub.fmt.day(rec.at) })) : esc(Hub.t('apprNew'))) + (rec && rec.note ? '<br>' + esc(rec.note) : '') + '</p>' +
      '<label>' + esc(Hub.t('apprBy')) + ' <input type="text" data-appr-by value="' + esc(Hub.store.get('reviewer') || '') + '" autocomplete="name"></label><label>' + esc(Hub.t('apprNote')) + ' <input type="text" data-appr-note></label>' +
      '<div class="appr-do">' + states().map(function (s) { return '<button type="button" class="btn" data-appr-set="' + esc(s.id) + '">' + esc(s.action || s.label) + '</button>'; }).join('') + '</div></div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-appr-set]'); if (!b) return;
    var box = b.closest('[data-appr]'), ref = box.getAttribute('data-appr'), who = box.querySelector('[data-appr-by]').value.trim();
    if (!who) { Hub.say(Hub.t('apprNeedName')); box.querySelector('[data-appr-by]').focus(); return; }
    Hub.store.set('reviewer', who);
    var rec = { ref: ref, state: b.getAttribute('data-appr-set'), by: who, at: new Date().toISOString(), note: box.querySelector('[data-appr-note]').value.trim() };
    adapter.set(ref, rec).then(function () { var n = document.querySelector('[data-appr="' + CSS.escape(ref) + '"]'); if (n) n.outerHTML = bar(ref); hooks.forEach(function (fn) { fn(rec); }); });
  });
  Hub.approval = { bar: bar, record: function (ref) { return adapter.get(ref); }, store: function (a) { adapter = a; }, onChange: function (fn) { hooks.push(fn); } };
})();
