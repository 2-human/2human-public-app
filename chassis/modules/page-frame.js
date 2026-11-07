/* M9 page preview frame. Shows a page in an iframe at its true width (1440 or 390), scaled to fit the panel, cache-busted so an
 * edited page shows at once. Hub.kit.frame({ src, title, open? }) -> html. */
(function () {
  var esc = Hub.esc, W = { desktop: 1440, phone: 390 };
  Hub.labelDefaults({ frameDesktop: 'Desktop', framePhone: 'Phone', frameOpen: 'Open in a new tab', frameScale: '{pct} of {w} px' });
  var mode = function () { return Hub.store.get('frame') === 'phone' ? 'phone' : 'desktop'; };
  function bust(src) { return src + (src.indexOf('?') < 0 ? '?' : '&') + 'v=' + Date.now(); }
  function frame(o) {
    var m = mode();
    return '<div class="pf" data-pf><div class="pf-tools"><button type="button" class="btn" data-pf-mode="desktop" aria-pressed="' + (m === 'desktop') + '">' + esc(Hub.t('frameDesktop')) + '</button><button type="button" class="btn" data-pf-mode="phone" aria-pressed="' + (m === 'phone') + '">' + esc(Hub.t('framePhone')) + '</button>' +
      (o.open !== false ? '<a class="btn" href="' + esc(o.src) + '" target="_blank" rel="noopener">' + esc(Hub.t('frameOpen')) + '</a>' : '') + '<span class="pf-scale"></span></div><div class="pf-wrap"><div class="pf-hold"><iframe src="' + esc(bust(o.src)) + '" title="' + esc(o.title) + '" loading="lazy"></iframe></div></div></div>';
  }
  function fit(box) {
    var m = mode(), w = W[m], wrap = box.querySelector('.pf-wrap'), hold = box.querySelector('.pf-hold'), avail = wrap.clientWidth, s = Math.min(1, avail / w), h = Math.max(420, Math.min(innerHeight - 220, 900));
    hold.style.width = w + 'px'; hold.style.height = Math.round(h / s) + 'px'; hold.style.transform = 'scale(' + s + ')'; wrap.style.height = h + 'px';
    hold.style.marginLeft = Math.max(0, (avail - w * s) / 2) + 'px';
    box.querySelector('.pf-scale').textContent = Hub.t('frameScale', { pct: Hub.fmt.pct(s, 0), w: w });
    box.querySelectorAll('[data-pf-mode]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pf-mode') === m); });
  }
  var all = function () { document.querySelectorAll('[data-pf]').forEach(fit); };
  Hub.onRender(all); Hub.onDrawer(all); window.addEventListener('resize', all);
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-pf-mode]'); if (b) { Hub.store.set('frame', b.getAttribute('data-pf-mode')); all(); } });
  Hub.kit = Hub.kit || {}; Hub.kit.frame = frame;
})();
