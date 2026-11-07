/* M10 diagram canvas: the frame only. Pan, zoom, fit and select around SVG a view supplies; layouts belong to the view.
 *   Hub.kit.canvas(id, { w, h, svg }) -> html   svg: inner SVG markup in a w by h space. Marks with data-d open their drawer.
 * Keyboard: the canvas takes focus; arrows pan, + and - zoom, 0 fits. Touch: one finger pans, two pinch. */
(function () {
  var esc = Hub.esc, S = {};
  Hub.labelDefaults({ canvasFit: 'Fit', canvasIn: 'Zoom in', canvasOut: 'Zoom out', canvasHint: 'Drag to pan, wheel to zoom, click an item for its details' });
  function canvas(id, o) {
    S[id] = { o: o, k: 1, tx: 0, ty: 0 };
    return '<div class="cv" data-cv="' + esc(id) + '"><div class="cv-tools"><button type="button" class="btn" data-cv-do="fit">' + esc(Hub.t('canvasFit')) + '</button><button type="button" class="btn" data-cv-do="in" aria-label="' + esc(Hub.t('canvasIn')) + '">+</button><button type="button" class="btn" data-cv-do="out" aria-label="' + esc(Hub.t('canvasOut')) + '">&minus;</button><span class="cv-hint">' + esc(Hub.t('canvasHint')) + '</span></div>' +
      '<svg class="cv-svg" tabindex="0" role="application" aria-label="' + esc(o.title || '') + '"><g class="cv-world">' + o.svg + '</g></svg></div>';
  }
  function apply(id, box) { var s = S[id]; box.querySelector('.cv-world').setAttribute('transform', 'translate(' + s.tx + ',' + s.ty + ') scale(' + s.k + ')'); }
  function fit(id, box) { var s = S[id], r = box.querySelector('.cv-svg').getBoundingClientRect(), pad = 16; s.k = Math.min((r.width - pad * 2) / s.o.w, (r.height - pad * 2) / s.o.h, 1.5) || 1; s.tx = (r.width - s.o.w * s.k) / 2; s.ty = (r.height - s.o.h * s.k) / 2; apply(id, box); }
  function zoom(id, box, f, mx, my) {
    var s = S[id], r = box.querySelector('.cv-svg').getBoundingClientRect(), nk = Math.min(4, Math.max(.15, s.k * f)), q = nk / s.k; if (mx == null) { mx = r.width / 2; my = r.height / 2; }
    s.tx = mx - (mx - s.tx) * q; s.ty = my - (my - s.ty) * q; s.k = nk; apply(id, box);
  }
  function wire() {
    document.querySelectorAll('[data-cv]').forEach(function (box) {
      if (box.hasAttribute('data-wired')) return; box.setAttribute('data-wired', '');
      var id = box.getAttribute('data-cv'), svg = box.querySelector('.cv-svg'), pts = {}, drag = null, moved = false, pinch = 0; fit(id, box);
      svg.addEventListener('wheel', function (e) { e.preventDefault(); var r = svg.getBoundingClientRect(); zoom(id, box, Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      svg.addEventListener('pointerdown', function (e) { pts[e.pointerId] = e; if (Object.keys(pts).length > 1) { drag = null; return; } drag = { x: e.clientX, y: e.clientY, tx: S[id].tx, ty: S[id].ty, hit: e.target.closest('[data-d]') }; moved = false; try { svg.setPointerCapture(e.pointerId); } catch (x) {} });
      svg.addEventListener('pointermove', function (e) {
        if (pts[e.pointerId]) pts[e.pointerId] = e;
        var ks = Object.keys(pts);
        if (ks.length === 2) { var a = pts[ks[0]], b = pts[ks[1]], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) zoom(id, box, d / pinch); pinch = d; moved = true; return; }
        if (!drag) return; if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true; S[id].tx = drag.tx + e.clientX - drag.x; S[id].ty = drag.ty + e.clientY - drag.y; apply(id, box);
      });
      var up = function (e) { delete pts[e.pointerId]; pinch = 0; var hit = drag && drag.hit; drag = null; if (!moved && hit) Hub.open(hit.getAttribute('data-d')); };
      svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
      svg.addEventListener('click', function (e) { if (e.detail) e.stopPropagation(); });   /* a pointer pick is decided on pointerup: capture retargets its click */
      svg.addEventListener('keydown', function (e) {
        var s = S[id], step = 40, map = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        if (map[e.key]) { e.preventDefault(); s.tx += map[e.key][0]; s.ty += map[e.key][1]; apply(id, box); } else if (e.key === '+' || e.key === '=') zoom(id, box, 1.2); else if (e.key === '-') zoom(id, box, 1 / 1.2); else if (e.key === '0') fit(id, box);
      });
    });
  }
  Hub.onRender(wire); Hub.onDrawer(wire);
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-cv-do]'); if (!b) return; var box = b.closest('[data-cv]'), id = box.getAttribute('data-cv'), w = b.getAttribute('data-cv-do'); if (w === 'fit') fit(id, box); else zoom(id, box, w === 'in' ? 1.25 : .8); });
  window.addEventListener('resize', function () { document.querySelectorAll('[data-cv]').forEach(function (b) { fit(b.getAttribute('data-cv'), b); }); });
  Hub.kit = Hub.kit || {}; Hub.kit.canvas = canvas;
})();
