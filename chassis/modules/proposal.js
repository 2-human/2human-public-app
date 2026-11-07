/* Proposal section: a full hub can carry pitch content as a section. It reads the proposal hub's content shape unchanged (one
 * window.HUB object, validated against schema/proposal.schema.json) and ports its view types into chassis routes:
 *   Hub.proposal.mount({ route:'/pitch', content:window.HUB })       adds the navigation sections and one route per view
 *   Hub.proposal.viewType(name, fn(view, meta, el))                  a new kind of view; the same open registry
 * Differences from the stand-alone chassis: identity and navigation belong to the hub, a lead opens in the hub's drawer, and the
 * site pane is a drawer. Pinned stand-alone proposal hubs stay on library/features/proposal-hub/. */
(function () {
  var esc = Hub.esc, P = null, base = '/pitch', crm = { stage: 'all' }, soc = { platform: 'all', article: null };
  Hub.css('proposal.css');
  Hub.labelDefaults({ phOpen: 'Open ↗', phInfo: 'More about this', phAll: 'All', phAllPlatforms: 'All platforms', phShowAll: 'show all articles', phFiltered: 'Filtered to', phViewArticle: 'View article ↗', phPosts: '{n} posts · {a} articles · {p} platforms', phLeadsHead: 'Leads', phLeadsLede: 'Every enquiry with source, attribution, the converting page and stage. Click a lead to open it.', phColLead: 'Lead', phColProject: 'Project', phColSource: 'Source', phColStage: 'Stage', phColDate: 'Received', phStage: 'Stage', phContact: 'Contact', phEmail: 'Email', phPhone: 'Phone', phPostcode: 'Postcode', phProject: 'Project', phType: 'Type', phStart: 'Ideal start', phAttribution: 'Attribution', phConverted: 'Converted on', phNotes: 'Notes', phNotesKept: 'Notes stay on this page only (preview).', phAbout: 'About this view', phLeadDone: 'Thanks, your enquiry is in.', phLeadWho: '{who} will be in touch within one business day.', phPreview: 'This is a preview. On a live campaign the lead is captured in the ad platform and flows into the CRM.' });
  var mountEl = function (el) { return el.querySelector('[data-hub-mount]'); };
  var href = function (v) { return '#' + base + '/' + v; };
  function renderSocial(el) {
    var DATA = P.social || [], PF = P.PF || {}, meta = P.socialMeta || {}, V = P.VIEWS || {};
    var present = Object.keys(PF).filter(function (k) { return DATA.some(function (a) { return a.posts && a.posts[k]; }); });
    var total = DATA.reduce(function (n, a) { return n + Object.keys(a.posts || {}).length; }, 0);
    var arts = soc.article ? DATA.filter(function (a) { return a.slug === soc.article; }) : DATA, keys = soc.platform === 'all' ? present : [soc.platform];
    var chip = function (k, label) { return '<button type="button" class="chip' + (soc.platform === k ? ' active' : '') + '" data-pf="' + esc(k) + '">' + label + '</button>'; };
    el.innerHTML = '<div class="social"><h1>' + esc(meta.heading || (V.social && V.social.title) || '') + '</h1><p class="lede">' + (meta.lede || esc(Hub.t('phPosts', { n: total, a: DATA.length, p: present.length }))) + '</p><div class="filters">' + chip('all', esc(meta.allLabel || Hub.t('phAllPlatforms'))) +
      present.map(function (k) { return chip(k, '<span class="dot" style="background:var(--' + esc(PF[k].cls) + ', #8a8f98)"></span>' + esc(PF[k].name)); }).join('') + (soc.article ? '<span class="article-filter">' + esc(Hub.t('phFiltered')) + ' <b>' + esc(arts[0].title) + '</b> <button type="button" class="linkbtn" data-art-clear>' + esc(Hub.t('phShowAll')) + '</button></span>' : '') + '</div>' +
      arts.map(function (a) {
        var pk = keys.filter(function (k) { return a.posts && a.posts[k]; });
        return '<div class="art-group"><div class="art-head">' + (a.img ? '<img src="' + esc(a.img) + '" alt="">' : '') + '<div class="meta"><h3>' + esc(a.title) + '</h3><span>' + esc(a.location) + '</span></div><div class="links">' + (a.article ? '<a href="' + esc(a.article) + '" target="_blank" rel="noopener">' + esc(Hub.t('phViewArticle')) + '</a>' : '') + '</div></div><div class="posts">' +
          pk.map(function (k) { var p = a.posts[k]; return Hub.previews.post({ platform: PF[k], img: a.img, title: a.title, location: a.location, cap: p.cap, tags: p.tags }); }).join('') + '</div></div>';
      }).join('') + '</div>';
  }
  function renderCrm(el) {
    var L = P.leads || [], S = P.STAGES || {}, meta = P.crmMeta || {}, V = P.VIEWS || {}, t = Hub.t, counts = {};
    L.forEach(function (l) { counts[l.stage] = (counts[l.stage] || 0) + 1; });
    var sf = function (k, label, n) { return '<button type="button" class="sfil' + (crm.stage === k ? ' active' : '') + '" data-stage="' + esc(k) + '">' + esc(label) + ' <span class="n">' + n + '</span></button>'; };
    el.innerHTML = '<div class="crm"><h1>' + esc(meta.heading || (V.crm && V.crm.title) || t('phLeadsHead')) + '</h1><p class="lede">' + (meta.lede || esc(t('phLeadsLede'))) + '</p><div class="stage-filter">' + sf('all', t('phAll'), L.length) + Object.keys(S).filter(function (s) { return counts[s]; }).map(function (s) { return sf(s, s, counts[s]); }).join('') + '</div>' +
      '<div class="table-scroll"><table class="lead-table"><thead><tr>' + ['phColLead', 'phColProject', 'phColSource', 'phColStage', 'phColDate'].map(function (k) { return '<th>' + esc(t(k)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      L.filter(function (l) { return crm.stage === 'all' || l.stage === crm.stage; }).map(function (l) {
        return '<tr' + Hub.parts.ref('lead', l.id) + '><td><div class="nm">' + esc(l.name) + '</div><div class="sub">' + esc(l.email) + '</div></td><td>' + esc(l.projectType) + '</td><td><span class="src-pill ' + esc(l.srcKind) + '">' + esc(l.srcShort) + '</span></td><td><span class="badge-stage ' + esc(S[l.stage]) + '">' + esc(l.stage) + '</span></td><td class="sub">' + esc(l.date) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }
  function who() { return (P.brand && P.brand.proposalFor) || ''; }
  var TYPES = {
    static: function () {},
    social: function (v, m, el) { renderSocial(el); },
    crm: function (v, m, el) { renderCrm(el); },
    gbp: function (v, m, el) { var x = mountEl(el); if (x && P.gbp) x.innerHTML = Hub.previews.gbp(P.gbp, who()); },
    tp: function (v, m, el) { var x = mountEl(el); if (x && P.tp) x.innerHTML = Hub.previews.review(P.tp, who()); },
    clients: function (v, m, el) {
      var x = mountEl(el); if (!x) return;
      x.innerHTML = (P.clients || []).map(function (c) { return '<div class="ctile"><div class="ctile__mark">' + (c.logo ? '<img class="ctile__img" src="' + esc(c.logo) + '" alt="' + esc(c.name) + '">' : '<div class="ctile__logo">' + esc(c.name) + '</div>') + '</div>' + (c.desc ? '<div class="ctile__desc">' + esc(c.desc) + '</div>' : '') + (c.did ? '<div class="ctile__scope">' + esc(c.did) + '</div>' : '') + '</div>'; }).join('');
    },
    ads: function () { setTimeout(initCarousel, 40); }
  };
  function typeOf(v) { var m = (P.VIEWS || {})[v] || {}; return m.type || (TYPES[v] ? v : v === 'who' ? 'clients' : 'static'); }
  var pending = null;
  function view(v) {
    var m = (P.VIEWS || {})[v] || {}, html = (P.html || {})[v] || '';
    document.getElementById('app-main').classList.add('flush');
    pending = v;
    return '<div class="ph-scope hp"><div class="toolbar"><span class="tb-title">' + esc(m.title || v) + '</span>' + (m.tbBadge ? '<span class="tb-badge">' + esc(m.tbBadge) + '</span>' : '') + (m.sub ? '<span class="tb-sub">' + esc(m.sub) + '</span>' : '') +
      (m.open ? '<a class="tb-open" href="' + esc(m.open) + '" target="_blank" rel="noopener">' + esc(m.openLabel || Hub.t('phOpen')) + '</a>' : '') + (m.infoPane && P.sitepane ? '<button type="button" class="tb-btn"' + Hub.parts.ref('pitch-info', v) + '>' + esc(Hub.t('phInfo')) + '</button>' : '') + '</div><section class="view" id="view-' + esc(v) + '">' + html + '</section></div>';
  }
  Hub.onRender(function () {
    if (!pending) return; var v = pending; pending = null;
    var el = document.getElementById('view-' + v), m = (P.VIEWS || {})[v] || {}, fn = TYPES[typeOf(v)];
    if (el && fn) fn(v, m, el);
    var a = P.agency || {}; if (el && a.tokens) { var box = el.closest('.ph-scope'), map = { accent: '--primary-deep', accentStrong: '--accent-strong', accentSoft: '--accent-soft', ink: '--ink', ink2: '--ink-2', inkMuted: '--ink-muted', bg: '--bg', bgAlt: '--bg-alt', hairline: '--hairline' }; Object.keys(map).forEach(function (k) { if (a.tokens[k]) box.style.setProperty(map[k], a.tokens[k]); }); }
  });
  /* the ad carousel, and the functions the proposal hub's editorial html calls by name */
  function car() { return document.querySelector('#view-ads .carousel'); }
  function step() { var c = car(), cc = c && c.querySelector('.cc'); return cc ? cc.getBoundingClientRect().width + 8 : 0; }
  function arrows() { var c = car(); if (!c) return; var p = document.querySelector('.car-arrow.prev'), n = document.querySelector('.car-arrow.next'); if (p) p.toggleAttribute('disabled', c.scrollLeft <= 18); if (n) n.toggleAttribute('disabled', c.scrollLeft >= c.scrollWidth - c.clientWidth - 18); }
  function initCarousel() { var c = car(); if (!c) return; arrows(); if (!c._wired) { c.addEventListener('scroll', arrows); c._wired = true; } }
  var open = function (v) { location.hash = base + '/' + v; };
  Object.assign(window, {
    carScroll: function (d) { car().scrollBy({ left: d * step(), behavior: 'smooth' }); },
    ccClick: function (cc) { var c = cc.parentElement, a = c.getBoundingClientRect(), r = cc.getBoundingClientRect(); if (r.right > a.right + 2 || r.left < a.left - 2) c.scrollBy({ left: r.left - a.left, behavior: 'smooth' }); },
    openLead: function () { var o = document.getElementById('leadOverlay'); if (o) o.classList.add('open'); },
    closeLead: function () { var o = document.getElementById('leadOverlay'); if (o) o.classList.remove('open'); },
    submitLead: function (e) { e.preventDefault(); var b = document.getElementById('leadBody'); if (b) b.innerHTML = '<div class="done"><div class="tick">&#10003;</div><h3>' + esc(Hub.t('phLeadDone')) + '</h3><p>' + esc(Hub.t('phLeadWho', { who: who() })) + '</p><div class="crm-flag">' + esc(Hub.t('phPreview')) + '</div></div>'; },
    showSocial: function (slug) { soc.article = slug || null; open('social'); }, showAds: function () { open('ads'); }, showCrm: function () { open('crm'); }, showGbp: function () { open('gbp'); }, gotoCluster: function () { open('cluster'); }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return; var c, redo = false;
    if ((c = e.target.closest('.ph-scope [data-pf]'))) { soc.platform = c.getAttribute('data-pf'); redo = true; }
    if (e.target.closest('.ph-scope [data-art-clear]')) { soc.article = null; redo = true; }
    if ((c = e.target.closest('.ph-scope [data-stage]'))) { crm.stage = c.getAttribute('data-stage'); redo = true; }
    if (redo) Hub.render();
  });
  document.addEventListener('change', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-lead-stage'); if (id) { (P.leads.filter(function (l) { return l.id === id; })[0] || {}).stage = e.target.value; Hub.render(); return; }
    id = e.target.getAttribute && e.target.getAttribute('data-lead-note'); if (id) (P.leads.filter(function (l) { return l.id === id; })[0] || {}).notes = e.target.value;
  });
  function row(k, v) { return [Hub.t(k), v]; }
  function leadDrawer(id) {
    var l = (P.leads || []).filter(function (x) { return x.id === id; })[0]; if (!l) return null;
    var u = l.utm || {}, S = Object.keys(P.STAGES || {}), kv = Hub.parts.kv, t = Hub.t;
    return { title: l.name, sub: esc(l.id) + (l.postcode ? ' · ' + esc(l.postcode) : ''), tabs: [
      ['lead', t('phContact'), function () { return '<div class="ph-scope hp"><label>' + esc(t('phStage')) + ' <select data-lead-stage="' + esc(l.id) + '">' + S.map(function (s) { return '<option' + (s === l.stage ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label></div>' + kv([row('phEmail', '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>'), row('phPhone', esc(l.phone)), row('phPostcode', esc(l.postcode))]); }],
      ['project', t('phProject'), function () { return kv([row('phType', esc(l.projectType)), row('phStart', esc(l.idealStart))]) + '<p>' + esc(l.message) + '</p>'; }],
      ['source', t('phAttribution'), function () { return kv([row('phConverted', l.pageUrl ? '<a href="' + esc(l.pageUrl) + '" target="_blank" rel="noopener">' + esc(l.page) + '</a>' : esc(l.page)), ['utm_source', esc(u.source)], ['utm_medium', esc(u.medium)], ['utm_campaign', esc(u.campaign)], ['utm_content', esc(u.content)], ['utm_term', esc(u.term)], row('phColDate', esc(l.date))]); }],
      ['notes', t('phNotes'), function () { return '<textarea rows="5" style="width:100%" aria-label="' + esc(t('phNotes')) + '" data-lead-note="' + esc(l.id) + '">' + esc(l.notes) + '</textarea><p class="cnt">' + esc(t('phNotesKept')) + '</p>'; }]
    ] };
  }
  Hub.proposal = {
    viewType: function (name, fn) { TYPES[name] = fn; },
    mount: function (o) {
      P = o.content; base = o.route || base; if (!P) return;
      var sections = (P.nav || []).map(function (s) { return { sec: s.section, items: s.items.map(function (it) { return { label: it.label, route: base + '/' + it.view, count: it.badge }; }) }; });
      var D = window.HUB_DATA = window.HUB_DATA || {}; D.nav = (D.nav || []).concat(sections);
      Hub.route(base, function (rest) { var v = rest.split('/')[0] || P.defaultView; if (!(P.VIEWS || {})[v] && !(P.html || {})[v] && !TYPES[v]) return '<div class="notfound"><h1>' + esc(Hub.t('notFoundTitle')) + '</h1></div>'; return view(v); });
      Hub.drawer('lead', leadDrawer);
      Hub.drawer('pitch-info', function (v) { return P.sitepane ? { title: ((P.VIEWS || {})[v] || {}).title || Hub.t('phAbout'), tabs: [['about', Hub.t('phAbout'), P.sitepane]] } : null; });
    }
  };
})();
