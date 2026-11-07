/* M4 period and metrics tier. Figures may live in an optional data file (HUB_CONFIG.dataOptional) that stays local or behind a
 * stronger gate: HUB_DATA.metrics = { periods: { key: { label, ... } } }. Without it the hub still works and says the metrics are
 * locked. Changing the period redraws in place: page position, open drawer and address stay. */
(function () {
  var key = Hub.store.get('period');
  Hub.labelDefaults({ period: 'Period', metricsOn: 'Metrics on', metricsOff: 'Metrics locked', noMetrics: 'No metrics are loaded here.' });
  var M = function () { return (window.HUB_DATA || {}).metrics || null; };
  Hub.period = function () { var m = M(); return m && m.periods ? m.periods[key] || null : null; };
  Hub.periodLabel = function () { var p = Hub.period(); return p ? p.label : Hub.t('noMetrics'); };
  Hub.setPeriod = function (k) {
    var m = M(), main = document.getElementById('app-main'), top = main.scrollTop; if (!m || !m.periods[k]) return;
    key = k; Hub.store.set('period', k); Hub.render(); main.scrollTop = top;
    if (Hub.state.d) Hub.open(Hub.state.d, Hub.state.dt, true);
  };
  Hub.ready(function () {
    var m = M();
    if (!m || !m.periods) { Hub.bar('<span class="chip warn" id="tier-chip">' + Hub.esc(Hub.t('metricsOff')) + '</span>'); return; }
    var ks = Object.keys(m.periods); if (ks.indexOf(key) < 0) key = ks[0];
    Hub.bar('<label class="bar-field">' + Hub.esc(Hub.t('period')) + ' <select id="hub-period">' + ks.map(function (k) { return '<option value="' + Hub.esc(k) + '"' + (k === key ? ' selected' : '') + '>' + Hub.esc(m.periods[k].label) + '</option>'; }).join('') + '</select></label><span class="chip ok" id="tier-chip">' + Hub.esc(Hub.t('metricsOn')) + '</span>');
    document.getElementById('hub-period').addEventListener('change', function () { Hub.setPeriod(this.value); });
  });
})();
