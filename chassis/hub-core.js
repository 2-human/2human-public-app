/* hub-chassis core: a three-panel, hash-routed hub (navigation · main · drawer). Version-pinned; never edited per hub.
 *
 * Instance files hold everything specific: hub.config.js (window.HUB_CONFIG: identity, tokens, labels, file lists, storage
 * prefix), data/*.js (window.HUB_DATA: navigation, text, figures) and views.js (layout only):
 *   Hub.route(prefix, fn(rest, query) -> html)                       main panel, longest prefix wins
 *   Hub.drawer(type, fn(id) -> { title, sub?, wide?, tabs, after? })  right panel, opened by [data-d="type:id"]
 *     tabs: [[key, label, html or fn() -> html]]; a function tab renders only when shown
 *   Hub.legacy / Hub.alias                                           old links
 *   Hub.onRender(fn), Hub.onDrawer(fn(ref or null))                  hooks; the review widget and modules use them
 * A drawer keeps a trail of the drawers opened from inside it; the back and forward arrows move along it.
 * Rule: every entity exists once; more information about it is a tab on its drawer. References are stable ids, never labels.
 * Hub.boot() loads modules, data and views, then calls Hub.start(). A gate module may replace Hub.loadData. */
(function () {
  var VERSION = '1.2.0';
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.HUB_CONFIG || {};
  var ROUTES = [], DRAWERS = {}, COUNTS = {}, renderHooks = [], drawerHooks = [], readyHooks = [];
  var state = { path: '', query: {}, d: null, dt: null };
  var started = false, lastMain = null, lastFocus = null, curDrawer = null, statusTimer = null;

  /* ─── text and escaping ─── */
  var DEFAULT_LABELS = {
    skip: 'Skip to the content', menu: 'Show navigation', filter: 'Filter the menu', navigation: 'Hub navigation', breadcrumb: 'Breadcrumb',
    copyLink: 'Copy link', copied: 'Copied', copyFailed: 'Copy failed', closeDrawer: 'Close the details',
    drawerBack: 'Back', drawerForward: 'Forward', backTo: 'Back to: {title}', forwardTo: 'Forward to: {title}',
    switchBeside: 'Switch to another item beside {label}', expand: 'Expand {label}', collapse: 'Collapse {label}', filterItems: 'Filter {n} items',
    notFoundTitle: 'Page not found', notFoundBody: 'There is no page at {path}. The link may be from an older version of this hub.',
    notFoundBack: 'Go to the first page', staleItem: 'That item is no longer in this hub.', loadFailed: 'This hub could not load its data.', empty: '–', searchTable: 'Search this table',
    theme: 'Theme', themeLight: 'Light', themeDark: 'Dark'
  };
  var labels = Object.assign({}, DEFAULT_LABELS, cfg.labels || {});
  function t(key, vars) {
    var s = labels[key] != null ? labels[key] : key;
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/đ/g, 'd').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  function say(msg) {
    var el = $('hub-status'); el.textContent = msg; clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.textContent = ''; }, 3000);
  }

  /* ─── storage: every key carries the hub's prefix, and a blocked store never breaks the page ─── */
  var prefix = (cfg.storage && cfg.storage.prefix) || cfg.id || 'hub';
  var store = {
    get: function (k, area) { try { return (area || localStorage).getItem(prefix + ':' + k); } catch (x) { return null; } },
    set: function (k, v, area) { try { (area || localStorage).setItem(prefix + ':' + k, v); } catch (x) {} },
    del: function (k, area) { try { (area || localStorage).removeItem(prefix + ':' + k); } catch (x) {} }
  };
  var tabStore = function () { try { return sessionStorage; } catch (x) { return null; } };

  /* ─── formats: locale and currency come from the config ─── */
  var locale = cfg.locale || 'en-US', currency = cfg.currency || 'USD';
  var none = function () { return t('empty'); };
  var num = function (o) { return new Intl.NumberFormat(locale, o); };
  var fmt = {
    n0: function (v) { return v == null ? none() : num({ maximumFractionDigits: 0 }).format(v); },
    n1: function (v) { return v == null ? none() : num({ maximumFractionDigits: 1 }).format(v); },
    money: function (v) { return v == null ? none() : num({ style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(v); },
    money2: function (v) { return v == null ? none() : num({ style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); },
    pct: function (v, d) { return v == null ? none() : num({ style: 'percent', minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }).format(v); },
    k: function (v) { return v == null ? none() : num({ notation: 'compact', maximumFractionDigits: 1 }).format(v); },
    day: function (s) { if (!s) return none(); var d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s); return isNaN(d) ? String(s) : d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }); }
  };

  /* ─── identity and tokens (the proposal hub's applyAgency method) ─── */
  var TOKEN_RE = /^[a-z0-9][a-zA-Z0-9-]*$/;
  /* brand keys set the governed token the --hub-* name aliases (branding-atomization); a governed slug is accepted as is */
  var BRAND = { accent: 'primary-deep', bg: 'surface-base', soft: 'surface-tint', line: 'rule', ink: 'text-default', mute: 'text-soft', head: 'neutral-deep' };
  var BRAND_KEY = {}; Object.keys(BRAND).forEach(function (k) { BRAND_KEY[BRAND[k]] = k; });
  var hubVar = function (k) { return '--hub-' + (BRAND_KEY[k] || k).replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); };
  var cssVar = function (k) { return BRAND[k] ? '--' + BRAND[k] : BRAND_KEY[k] ? '--' + k : hubVar(k); };
  /* tokens go in a stylesheet, not on the root element, or light values would beat the dark rules */
  function tokenBody(tokens) { return Object.keys(tokens || {}).filter(function (k) { return TOKEN_RE.test(k); }).map(function (k) { return cssVar(k) + ':' + String(tokens[k]).replace(/[;{}]/g, ''); }).join(';'); }
  function addCss(text) { var st = document.createElement('style'); st.textContent = text; document.head.appendChild(st); }
  function applyTokens(tokens, el) {
    /* on one element the --hub-* name is set: the alias already resolved at the root, so a governed name there would not reach it */
    if (el) Object.keys(tokens || {}).forEach(function (k) { if (TOKEN_RE.test(k)) el.style.setProperty(hubVar(k), tokens[k]); });
    else addCss(':root{' + tokenBody(tokens) + '}');
  }
  function applyDark() {
    var body = tokenBody(cfg.tokensDark); if (!body) return;
    addCss('@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){' + body + '}}:root[data-theme="dark"]{' + body + '}');
  }
  function setTheme(v) {
    if (v) document.documentElement.setAttribute('data-theme', v); else document.documentElement.removeAttribute('data-theme');
    if (v) store.set('theme', v); else store.del('theme');
  }
  function applyConfig() {
    var root = document.documentElement, b = cfg.brand || {}, f = cfg.fonts || {};
    if (cfg.lang) root.setAttribute('lang', cfg.lang);
    if (!cfg.tokensDark && cfg.theme !== 'auto' && cfg.theme !== 'dark') root.setAttribute('data-theme', 'light');
    if (cfg.theme === 'dark') root.setAttribute('data-theme', 'dark');
    applyTokens(cfg.tokens); applyDark();
    var saved = store.get('theme'); if (saved) root.setAttribute('data-theme', saved);
    if (f.body) root.style.setProperty('--hub-font', f.body);
    if (f.display) root.style.setProperty('--hub-font-head', f.display);
    if (f.import) { var fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = f.import; document.head.appendChild(fl); }
    if (b.favicon) { var ic = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' })); ic.href = b.favicon; }
    document.title = cfg.title || b.name || 'Hub';
    var brand = $('app-brand');
    brand.href = '#' + home();
    brand.innerHTML = (b.logo ? (typeof b.logo === 'string' ? b.logo : '<img src="' + esc(b.logo.src) + '" alt="">') : '') + '<span>' + esc(b.name || '') + '</span>' + (b.sub ? '<small>' + esc(b.sub) + '</small>' : '');
    $('app-skip').textContent = t('skip');
    $('app-menu').setAttribute('aria-label', t('menu'));
    $('app-nav').setAttribute('aria-label', t('navigation'));
    $('app-filter').placeholder = t('filter'); $('app-filter').setAttribute('aria-label', t('filter'));
    $('drawer-close').setAttribute('aria-label', t('closeDrawer'));
    drawArrows();
    $('drawer-copy').textContent = t('copyLink');
    var top = document.createElement('button'); top.type = 'button'; top.className = 'topbtn'; top.setAttribute('data-copy', ''); top.textContent = t('copyLink');
    $('app-right').appendChild(top);
    (cfg.chips || []).forEach(function (c) { var s = document.createElement('span'); s.className = 'chip ' + (c.kind || ''); s.textContent = c.text; $('app-right').appendChild(s); });
  }
  function setBarTop() { document.documentElement.style.setProperty('--htop', $('app-bar').offsetHeight + 'px'); }
  function home() { return cfg.home || (Hub.navItems()[0] || {}).route || '/'; }

  /* ─── routing ─── */
  function split(raw) { var i = raw.indexOf('?'); return { path: i < 0 ? raw : raw.slice(0, i), search: i < 0 ? '' : raw.slice(i + 1) }; }
  function queryOf(s) { var q = {}; if (s) new URLSearchParams(s).forEach(function (v, k) { q[k] = v; }); return q; }
  function hashFor(path, query) {
    var u = new URLSearchParams(); Object.keys(query || {}).forEach(function (k) { if (query[k] != null && query[k] !== '') u.set(k, query[k]); });
    var s = u.toString(); return '#' + path + (s ? '?' + s : '');
  }
  function replaceHash(path, query) { history.replaceState(history.state, '', location.pathname + location.search + hashFor(path, query)); }
  /* an old link: the target's own query is kept and the incoming query wins over it, so d= and tab= survive the move */
  function resolve(table, raw) {
    var s = split(raw), target = (table || {})[s.path];
    if (!target) return null;
    var tt = split(target), q = Object.assign(queryOf(tt.search), queryOf(s.search));
    return hashFor(tt.path, q).slice(1);
  }
  function parse() {
    var raw = location.hash.replace(/^#/, '') || home(), unknown = null;
    try { raw = raw.indexOf('%') >= 0 && raw.charAt(0) !== '/' ? decodeURIComponent(raw) : raw; } catch (x) {}
    if (raw.charAt(0) !== '/') {
      var old = resolve(Hub.legacy, raw);
      if (old) { raw = old; var s0 = split(raw); replaceHash(s0.path, queryOf(s0.search)); } else unknown = raw;
    }
    if (!unknown) {
      var moved = resolve(Hub.alias, raw);
      if (moved) { raw = moved; var s1 = split(raw); replaceHash(s1.path, queryOf(s1.search)); }
    }
    if (unknown) return { path: '', query: {}, unknown: unknown };
    var s = split(raw); return { path: s.path, query: queryOf(s.search) };
  }
  function find(path) {
    var best = null;
    ROUTES.forEach(function (r) { if ((path === r.prefix || path.indexOf(r.prefix + '/') === 0) && (!best || r.prefix.length > best.prefix.length)) best = r; });
    return best;
  }
  function notFound(what) {
    return '<div class="notfound"><h1>' + esc(t('notFoundTitle')) + '</h1><p class="lead">' + esc(t('notFoundBody', { path: '\u0000' })).replace('\u0000', '<code>' + esc(what) + '</code>') + '</p><p><a href="#' + esc(home()) + '">' + esc(t('notFoundBack')) + '</a></p></div>';
  }
  function mainKey(p) { var q = Object.assign({}, p.query); delete q.d; delete q.dt; return (p.unknown ? '?' + p.unknown : p.path) + '|' + JSON.stringify(q); }
  /* force: redraw main even when only the drawer part of the address changed */
  function render(force) {
    var p = parse(), key = mainKey(p), main = $('app-main'), first = lastMain === null;
    state.path = p.path; state.query = p.query;
    if (force === true || key !== lastMain) {
      lastMain = key;
      var r = p.unknown ? null : find(p.path), rest = r ? p.path.slice(r.prefix.length + 1) : '';
      main.classList.remove('flush');
      main.innerHTML = r ? crumbs(p.path) + r.fn(rest, p.query) : notFound(p.unknown || p.path);
      main.scrollTop = 0;
      drawTree();
      document.title = (pageTitle(p.path) ? pageTitle(p.path) + ' · ' : '') + (cfg.title || (cfg.brand || {}).name || 'Hub');
      renderHooks.forEach(function (fn) { fn(); });
      if (!first && force !== true && !p.query.d) main.focus({ preventScroll: true });
      $('app-nav').classList.remove('open'); $('app-menu').setAttribute('aria-expanded', 'false');
    }
    if (p.query.d) { if (p.query.d !== state.d || p.query.dt !== state.dt) openDrawer(p.query.d, p.query.dt, true); else markSelected(state.d); } else if (state.d) closeDrawer(true);
  }
  function pageTitle(path) { var hit = navFind(path); return (Hub.titles || {})[path] || (hit && hit.label) || ''; }
  /* main tabs: the address holds the tab. Only the current tab's fn runs. A page opened without ?tab= returns to the tab
   * last used on it in this browser tab, and the address says so, so Copy link stays exact. */
  function tabbed(base, tabs, query) {
    var want = query.tab, mem = tabStore(), keys = tabs.map(function (x) { return x[0]; });
    if (!want && mem) { var m = store.get('tab:' + base, mem); if (m && keys.indexOf(m) > 0) want = m; }
    var cur = keys.indexOf(want) >= 0 ? want : keys[0];
    /* one screen, one address: the first tab is written too, or the menu's link and the tab bar's link would name it differently */
    if (query.tab !== cur) { var q = Object.assign({}, query, { tab: cur }); replaceHash(state.path, q); state.query = q; lastMain = mainKey({ path: state.path, query: q }); }
    if (mem) { if (cur === keys[0]) store.del('tab:' + base, mem); else store.set('tab:' + base, cur, mem); }
    var pick = tabs[keys.indexOf(cur)], id = 'mt-' + base.replace(/[^a-z0-9]+/gi, '-');
    var bar = '<div class="mtabs" role="tablist" aria-label="' + esc(pageTitle(base)) + '">' + tabs.map(function (x) {
      var on = x[0] === cur, keep = Object.assign({}, query); delete keep.d; delete keep.dt; delete keep.tab;
      keep.tab = x[0];   /* always explicit: a bare address means the remembered tab */
      return '<a role="tab" id="' + id + '-' + esc(x[0]) + '" href="' + esc(hashFor(base, keep)) + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '"' + (on ? ' aria-controls="' + id + '-panel"' : '') + '>' + esc(x[1]) + (x[3] != null ? ' <span class="cnt">' + esc(x[3]) + '</span>' : '') + '</a>';
    }).join('') + '</div>';
    return bar + '<div role="tabpanel" id="' + id + '-panel" aria-labelledby="' + id + '-' + esc(cur) + '">' + (typeof pick[2] === 'function' ? pick[2]() : pick[2]) + '</div>';
  }

  /* ─── navigation tree: sections, one expandable level, counts, status dots, accent-insensitive filter ─── */
  var expanded = {}, lastCur = null;
  function navSections() { return (window.HUB_DATA && window.HUB_DATA.nav) || Hub.nav || []; }
  function navItems() { var o = []; navSections().forEach(function (s) { (s.items || []).forEach(function (i) { o.push(i); }); }); return o; }
  function navFind(path) { var hit = null; (function walk(list) { list.some(function (n) { if (n.route === path) { hit = n; return true; } return n.children && walk(n.children); }); })(navItems()); return hit; }
  function trail(path) { var out = []; (function walk(list, tr) { return list.some(function (n) { var t2 = tr.concat([n]); if (n.route === path) { out = t2; return true; } return !!(n.children && walk(n.children, t2)); }); })(navItems(), []); return out; }
  function nearest(path) { var parts = path.split('/').filter(Boolean); while (parts.length) { var c = '/' + parts.join('/'), tr = trail(c); if (tr.length) return tr; parts.pop(); } return []; }
  function countOf(n) { var f = COUNTS[n.route]; return f ? f() : n.count; }
  function drawTree() {
    var q = norm($('app-filter').value.trim()), cur = state.path, tr = nearest(cur);
    if (lastCur !== cur) { if (tr.length) expanded[tr[0].route] = true; lastCur = cur; }
    /* depth rule: only a section's first-level entries expand; a deeper page marks its nearest shown ancestor */
    var shown = tr.length ? tr[Math.min(tr.length, 2) - 1].route : cur;
    var match = function (n) { return !q || norm(n.label).indexOf(q) >= 0 || (n.children || []).some(match); };
    function li(n, depth) {
      if (!match(n)) return '';
      var kids = !depth && n.children && n.children.length, open = kids && (expanded[n.route] || !!q), here = n.route === shown, c = countOf(n);
      return '<li><div class="row' + (here ? ' cur' : '') + '"><button type="button" class="tog' + (kids ? '' : ' leaf') + '"' + (kids ? ' data-tog="' + esc(n.route) + '" aria-expanded="' + !!open + '" aria-label="' + esc(t(open ? 'collapse' : 'expand', { label: n.label })) + '"' : ' tabindex="-1" aria-hidden="true"') + '>&#9654;</button>' +
        '<a href="#' + esc(n.route) + '"' + (here ? ' aria-current="' + (n.route === cur ? 'page' : 'location') + '"' : '') + ' title="' + esc(n.label) + '">' + (n.dot ? '<span class="dot ' + esc(n.dot) + '"></span>' : '') + esc(n.label) + '</a>' +
        (c != null ? '<span class="cnt">' + esc(c) + '</span>' : '') + '</div>' + (open ? '<ul>' + n.children.map(function (k) { return li(k, 1); }).join('') + '</ul>' : '') + '</li>';
    }
    var html = navSections().map(function (s) {
      var rows = (s.items || []).map(function (n) { return li(n, 0); }).join('');
      return rows ? (s.sec ? '<li class="sec">' + esc(s.sec) + '</li>' : '') + rows : '';
    }).join('');
    $('app-tree').innerHTML = '<ul class="tree">' + html + '</ul>';
  }

  /* ─── breadcrumb: a trail with a dropdown of the items beside each step ─── */
  function siblingsOf(route) {
    var found = null;
    (function walk(lists) { lists.some(function (list) { if (list.some(function (n) { return n.route === route; })) { found = list; return true; } return list.some(function (n) { return n.children && walk([n.children]); }); }); })(navSections().map(function (s) { return s.items || []; }));
    return found && found.length > 1 ? found : null;
  }
  var crumbSets = [];
  function crumbs(path) {
    var parts = path.split('/').filter(Boolean), acc = '', tr = [];
    parts.forEach(function (seg) {
      acc += '/' + seg; var n = navFind(acc), ttl = (Hub.titles || {})[acc] || (n && n.label);
      if (!ttl) { if (find(acc) && acc !== path) return; ttl = seg.replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
      tr.push([ttl, acc]);
    });
    crumbSets = tr.map(function (c) { return siblingsOf(c[1]); });
    if (!tr.length || (tr.length === 1 && !crumbSets[0])) return '';
    return '<nav class="crumbs" aria-label="' + esc(t('breadcrumb')) + '">' + tr.map(function (c, i) {
      var last = i === tr.length - 1;
      return (i ? '<span class="sep" aria-hidden="true">›</span>' : '') + '<span class="bc-item' + (last ? ' last' : '') + '"><a href="#' + esc(c[1]) + '"' + (last ? ' aria-current="page"' : '') + '>' + esc(c[0]) + '</a>' +
        (crumbSets[i] ? '<button type="button" class="bc-dd" data-bc="' + i + '" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(t('switchBeside', { label: c[0] })) + '">&#9662;</button>' : '') + '</span>';
    }).join('') + '</nav>';
  }
  function bcClose(refocus) { var m = document.querySelector('.bc-menu'); if (!m) return; var b = m.parentNode.querySelector('.bc-dd'); m.remove(); if (b) { b.setAttribute('aria-expanded', 'false'); if (refocus) b.focus(); } }
  function bcOpen(b) {
    bcClose(); var list = crumbSets[+b.getAttribute('data-bc')], m = document.createElement('div'), here = state.path;
    m.className = 'bc-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = (list.length > 12 ? '<input type="search" class="bc-filter" placeholder="' + esc(t('filterItems', { n: list.length })) + '" aria-label="' + esc(t('filterItems', { n: list.length })) + '">' : '') + '<div class="bc-list">' +
      list.map(function (x) { var on = x.route === here; return '<a role="menuitem" href="#' + esc(x.route) + '"' + (on ? ' aria-current="true" class="cur"' : '') + '><span>' + esc(x.label) + '</span>' + (countOf(x) != null ? '<span class="cnt">' + esc(countOf(x)) + '</span>' : '') + '</a>'; }).join('') + '</div>';
    b.parentNode.appendChild(m); b.setAttribute('aria-expanded', 'true');
    (m.querySelector('.bc-filter') || m.querySelector('a.cur') || m.querySelector('a')).focus();
  }

  /* ─── drawer ─── */
  var drawerEl = function () { return $('app-drawer'); };
  function markSelected(ref) {
    document.querySelectorAll('.sel').forEach(function (e) { e.classList.remove('sel'); });
    if (ref) document.querySelectorAll('[data-d="' + CSS.escape(ref) + '"]').forEach(function (e) { e.classList.add('sel'); });
  }
  /* Trail: the drawers opened since the last one opened from outside the drawer. Arrows move along it without changing it;
   * opening a new drawer from inside cuts anything ahead, and closing the drawer ends it. A step keeps its tab and scroll.
   * "From inside" is read from the last real click or key press, because an anchor opens its drawer later, through
   * hashchange. Only a recent one counts, so browser Back or a module's redraw is never mistaken for a user's choice. */
  var GESTURE_MS = 1000, visits = [], at = -1, gesture = null;
  function noteGesture(e) { gesture = { inside: !!(e.target.closest && e.target.closest('#app-drawer')), t: Date.now() }; }
  function takeGesture() { var g = gesture; gesture = null; return g && Date.now() - g.t < GESTURE_MS ? g : null; }
  document.addEventListener('click', noteGesture, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') noteGesture(e); }, true);
  function stepTrail(ref, item, cur, same, fromRoute, tab) {
    var g = takeGesture(), step = { ref: ref, tab: cur[0], title: item.title, top: 0 };
    if (same && at >= 0) {   /* a redraw or a tab change stays on this step; the same row clicked again in main starts over */
      visits[at].tab = cur[0]; visits[at].title = item.title;
      if (!fromRoute && tab == null && g && !g.inside) { visits = [visits[at]]; at = 0; }
      return;
    }
    if (g && g.inside && at >= 0) { visits[at].top = $('drawer-body').scrollTop; visits = visits.slice(0, at + 1).concat(step); at++; }
    else { visits = [step]; at = 0; }
  }
  function moveTrail(by, btn) {
    var step = visits[at + by]; if (!step) return;
    visits[at].top = $('drawer-body').scrollTop; at += by;
    if (!openDrawer(step.ref, step.tab, false, true)) return;
    $('drawer-body').scrollTop = step.top;
    /* an arrow that just disabled itself can't hold focus: the other arrow takes it, or close */
    if (btn.disabled) { var other = $(by < 0 ? 'drawer-fwd' : 'drawer-back'); (other.disabled ? $('drawer-close') : other).focus({ preventScroll: true }); }
  }
  function drawArrows() {
    [['drawer-back', -1, 'drawerBack', 'backTo'], ['drawer-fwd', 1, 'drawerForward', 'forwardTo']].forEach(function (b) {
      var el = $(b[0]), step = visits[at + b[1]], tip = step ? t(b[3], { title: step.title }) : ''; if (!el) return;
      el.disabled = !step; el.title = tip; el.setAttribute('aria-label', tip || t(b[2]));
    });
  }
  function paintDrawer(item, cur, keep) {
    var tabs = item.tabs, body = $('drawer-body'), bar = '', pos = keep ? body.scrollTop : 0;
    if (tabs.length > 1) bar = '<div class="dtabs" role="tablist">' + tabs.map(function (x) {
      var on = x[0] === cur[0];
      return '<button type="button" role="tab" id="dtab-' + esc(x[0]) + '" aria-controls="dpanel" data-dt="' + esc(x[0]) + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    var html = typeof cur[2] === 'function' ? cur[2]() : cur[2];
    body.innerHTML = bar + '<div class="dpanel" id="dpanel" role="tabpanel"' + (tabs.length > 1 ? ' aria-labelledby="dtab-' + esc(cur[0]) + '"' : ' aria-labelledby="drawer-title"') + ' tabindex="-1">' + html + '</div>';
    body.scrollTop = pos;
  }
  function openDrawer(ref, tab, fromRoute, moving) {
    var i = ref.indexOf(':'), type = i < 0 ? '' : ref.slice(0, i), id = i < 0 ? '' : ref.slice(i + 1), fn = DRAWERS[type], item = fn ? fn(id) : null;
    if (!item) {   /* the item is gone: the page stays, and the address drops the dead reference */
      if (fromRoute || moving) { var q0 = Object.assign({}, state.query); delete q0.d; delete q0.dt; replaceHash(state.path, q0); state.query = q0; say(t('staleItem')); }
      closeDrawer(true); return false;
    }
    var d = drawerEl(), mem = tabStore(), tabs = item.tabs = item.tabs || [['info', '', '']], same = state.d === ref;
    if (!d.classList.contains('open')) lastFocus = document.activeElement;
    /* an explicit tab wins; a permalink without dt= means the first tab; a click reuses the last picked tab if this item has it */
    var want = tab != null ? tab : !fromRoute && mem ? store.get('drawer-tab', mem) : null;
    var cur = tabs.filter(function (x) { return x[0] === want; })[0] || tabs[0];
    if (moving) { gesture = null; visits[at].title = item.title; } else stepTrail(ref, item, cur, same, fromRoute, tab);
    state.d = ref; state.dt = cur[0] === tabs[0][0] ? undefined : cur[0]; curDrawer = item;
    $('drawer-title').textContent = item.title; $('drawer-sub').innerHTML = item.sub || '';
    paintDrawer(item, cur, same);
    d.classList.add('open'); d.classList.toggle('wide', !!item.wide); d.classList.toggle('xwide', item.wide === 'x');
    d.setAttribute('aria-hidden', 'false'); d.removeAttribute('inert');
    document.body.classList.add('has-drawer'); document.body.classList.toggle('drawer-wide', !!item.wide && item.wide !== 'x'); document.body.classList.toggle('drawer-xwide', item.wide === 'x');
    $('app-scrim').hidden = false;
    markSelected(ref);
    if (!fromRoute) {
      var q = Object.assign({}, state.query, { d: ref, dt: state.dt || '' }); if (!state.dt) delete q.dt;
      replaceHash(state.path, q); state.query = q;
      if (tab != null && !moving && mem) store.set('drawer-tab', cur[0], mem);
    }
    if (!same) { var sel = document.querySelector('[data-d="' + CSS.escape(ref) + '"]'); if (sel && sel.scrollIntoView && sel.closest('#app-main')) sel.scrollIntoView({ block: 'nearest' }); if (!moving) $('drawer-close').focus({ preventScroll: true }); }
    drawArrows();
    if (item.after) item.after();
    drawerHooks.forEach(function (f) { f(ref); });
    return true;
  }
  function closeDrawer(fromRoute) {
    var d = drawerEl(), was = d.classList.contains('open');
    d.classList.remove('open', 'wide', 'xwide'); d.setAttribute('aria-hidden', 'true'); d.setAttribute('inert', '');
    document.body.classList.remove('has-drawer', 'drawer-wide', 'drawer-xwide'); $('app-scrim').hidden = true;
    var ref = state.d; state.d = null; state.dt = undefined; curDrawer = null;
    visits = []; at = -1; gesture = null; drawArrows();
    markSelected(null);
    if (!fromRoute && state.query.d) { var q = Object.assign({}, state.query); delete q.d; delete q.dt; replaceHash(state.path, q); state.query = q; }
    if (was) {   /* focus goes back to what opened the drawer; if that was redrawn, to its match; else to main */
      var back = lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : (ref && document.querySelector('[data-d="' + CSS.escape(ref) + '"]')) || $('app-main');
      back.focus({ preventScroll: true }); lastFocus = null;
      drawerHooks.forEach(function (f) { f(null); });
    }
  }
  function pickTab(key) {
    if (!curDrawer) return;
    var cur = curDrawer.tabs.filter(function (x) { return x[0] === key; })[0]; if (!cur) return;
    var mem = tabStore(); if (mem) store.set('drawer-tab', key, mem);
    state.dt = key === curDrawer.tabs[0][0] ? undefined : key;
    if (visits[at]) visits[at].tab = key;
    paintDrawer(curDrawer, cur, false);
    var q = Object.assign({}, state.query); if (state.dt) q.dt = state.dt; else delete q.dt;
    replaceHash(state.path, q); state.query = q;
    var b = $('drawer-body').querySelector('[data-dt="' + CSS.escape(key) + '"]'); if (b) b.focus({ preventScroll: true });
    if (curDrawer.after) curDrawer.after();
    drawerHooks.forEach(function (f) { f(state.d); });
  }

  /* ─── copy link: copy inside the click (it needs the gesture), the Clipboard API if that fails; review mode is not part of the link ─── */
  function copyLink(btn) {
    var u = new URL(location.href), label = btn.textContent, ta = document.createElement('textarea'), ok = false;
    u.searchParams.delete('review');
    var flash = function (msg) { btn.textContent = msg; say(msg); setTimeout(function () { btn.textContent = label; }, 1400); };
    ta.value = u.toString(); ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (x) {}
    ta.remove(); btn.focus({ preventScroll: true });
    if (ok) return flash(t('copied'));
    if (navigator.clipboard) navigator.clipboard.writeText(u.toString()).then(function () { flash(t('copied')); }, function () { flash(t('copyFailed')); });
    else flash(t('copyFailed'));
  }

  /* ─── page parts ─── */
  var parts = {
    head: function (title, lede) { return '<h1>' + esc(title) + '</h1>' + (lede ? '<p class="lead">' + esc(lede) + '</p>' : ''); },
    kv: function (rows) { return '<dl class="kv">' + rows.filter(function (r) { return r[1] != null && r[1] !== ''; }).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; },
    tiles: function (list) { return '<div class="tiles">' + list.map(function (x) { return '<div class="tile"' + (x.ref ? ' data-d="' + esc(x.ref) + '" tabindex="0"' : '') + '><div class="k">' + esc(x.k) + '</div><div class="v">' + esc(x.v) + '</div>' + (x.s ? '<div class="s">' + esc(x.s) + '</div>' : '') + '</div>'; }).join('') + '</div>'; },
    /* plain search: pair with data-scope on any container; rows matching the words stay. The term survives a redraw. */
    search: function (scope, placeholder) { var v = searches[scope] || ''; return '<input class="search" type="search" data-search="' + esc(scope) + '" value="' + esc(v) + '" placeholder="' + esc(placeholder || t('searchTable')) + '" aria-label="' + esc(placeholder || t('searchTable')) + '">'; },
    ref: function (type, id) { return ' data-d="' + esc(type + ':' + id) + '" data-comment-key="' + esc(type + '-' + id) + '" tabindex="0"'; },
    table: function (head, rows, numeric) { return '<div class="scroll"><table class="tbl"><thead><tr>' + head.map(function (h, i) { return '<th' + ((numeric || []).indexOf(i) >= 0 ? ' class="num"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>'; }
  };
  var searches = {};
  function applySearch(scope) {
    var q = norm(searches[scope] || '').split(/\s+/).filter(Boolean);
    document.querySelectorAll('[data-scope="' + CSS.escape(scope) + '"] tbody tr, [data-scope="' + CSS.escape(scope) + '"] [data-row]').forEach(function (r) {
      var text = norm(r.textContent); r.hidden = !q.every(function (w) { return text.indexOf(w) >= 0; });
    });
  }

  /* ─── events ─── */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var c;
    if ((c = e.target.closest('[data-skip]'))) { e.preventDefault(); $('app-main').focus(); return; }
    if ((c = e.target.closest('.bc-dd'))) { e.preventDefault(); if (c.getAttribute('aria-expanded') === 'true') bcClose(true); else bcOpen(c); return; }
    if (!e.target.closest('.bc-menu') || e.target.closest('a')) bcClose();
    if ((c = e.target.closest('[data-tog]'))) { expanded[c.getAttribute('data-tog')] = c.getAttribute('aria-expanded') !== 'true'; var k = c.getAttribute('data-tog'); drawTree(); var again = $('app-tree').querySelector('[data-tog="' + CSS.escape(k) + '"]'); if (again) again.focus(); return; }
    if ((c = e.target.closest('[data-dt]'))) { pickTab(c.getAttribute('data-dt')); return; }
    if ((c = e.target.closest('[data-copy]'))) { copyLink(c); return; }
    var a = e.target.closest('a[href]');
    if (a && a.closest('[data-d]') && a.getAttribute('data-d') == null) return;   /* a real link inside a row keeps its meaning */
    if ((c = e.target.closest('[data-d]'))) { e.preventDefault(); openDrawer(c.getAttribute('data-d')); }
  });
  document.addEventListener('input', function (e) {
    var tg = e.target; if (!tg.getAttribute) return;
    var sc = tg.getAttribute('data-search'); if (sc) { searches[sc] = tg.value; applySearch(sc); return; }
    if (tg.classList.contains('bc-filter')) { var q = norm(tg.value.trim()); tg.parentNode.querySelectorAll('.bc-list a').forEach(function (a) { a.hidden = !!q && norm(a.textContent).indexOf(q) < 0; }); }
  });
  document.addEventListener('keydown', function (e) {
    var m = document.querySelector('.bc-menu'), tg = e.target;
    if (m) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); bcClose(true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var as = [].filter.call(m.querySelectorAll('.bc-list a'), function (a) { return !a.hidden; }), i = as.indexOf(document.activeElement); if (as.length) { e.preventDefault(); as[e.key === 'ArrowDown' ? Math.min(as.length - 1, i + 1) : Math.max(0, i - 1)].focus(); } return; }
    }
    if (e.key === 'Escape') { if (document.querySelector('[data-hub-esc]')) return; if (drawerEl().classList.contains('open')) closeDrawer(); else if ($('app-nav').classList.contains('open')) { $('app-nav').classList.remove('open'); $('app-menu').setAttribute('aria-expanded', 'false'); $('app-menu').focus(); } return; }
    if ((e.key === 'Enter' || e.key === ' ') && tg.matches && tg.matches('[data-d][tabindex]') && !tg.matches('a,button')) { e.preventDefault(); openDrawer(tg.getAttribute('data-d')); return; }
    /* arrow keys walk any tab bar; the matching tab becomes active */
    var bar = tg.closest && tg.closest('[role="tablist"]');
    if (bar && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) {
      var list = [].slice.call(bar.querySelectorAll('[role="tab"]')), at = list.indexOf(tg), to = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      e.preventDefault(); list[to].focus(); if (list[to].click) list[to].click(); return;
    }
    /* below the docking width the drawer is a dialog: Tab stays inside it */
    if (e.key === 'Tab' && drawerEl().classList.contains('open') && !window.matchMedia('(min-width:1200px)').matches) {
      var f = [].filter.call(drawerEl().querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null && !x.disabled; });
      if (!f.length) return;
      if (!drawerEl().contains(document.activeElement)) { e.preventDefault(); f[0].focus(); } else if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ─── boot ─── */
  var base = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  function load(src, optional) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { if (optional) ok(); else no(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  var inOrder = function (list, fn) { return (list || []).reduce(function (p, x) { return p.then(function () { return fn(x); }); }, Promise.resolve()); };
  function fail(err) {
    if (window.console) console.error('hub: ' + (err && err.message || err));
    $('app-main').innerHTML = '<div class="notfound"><h1>' + esc(t('loadFailed')) + '</h1></div>';
  }
  window.Hub = {
    version: VERSION, config: cfg, state: state, esc: esc, norm: norm, fmt: fmt, parts: parts, t: t, store: store, say: say, hashFor: hashFor,
    nav: [], titles: {}, legacy: {}, alias: {},
    navItems: navItems, navSections: navSections, navFind: navFind,
    route: function (prefix, fn) { ROUTES.push({ prefix: prefix, fn: fn }); },
    drawer: function (type, fn) { DRAWERS[type] = fn; },
    count: function (route, fn) { COUNTS[route] = fn; },
    routes: function () { return ROUTES.map(function (r) { return r.prefix; }); },
    drawers: function () { return Object.keys(DRAWERS); },
    match: find, tabbed: tabbed, open: openDrawer, close: closeDrawer, tab: pickTab,
    render: function () { render(true); }, setTheme: setTheme, applyTokens: applyTokens,
    onRender: function (fn) { renderHooks.push(fn); }, onDrawer: function (fn) { drawerHooks.push(fn); },
    /* a module or view that needs the data registers here; it runs after data and views, before the first render */
    ready: function (fn) { readyHooks.push(fn); },
    runReady: function () { var list = readyHooks; readyHooks = []; list.forEach(function (fn) { fn(window.HUB_DATA || {}); }); },
    bar: function (html) { var w = document.createElement('span'); w.style.display = 'contents'; w.innerHTML = html; $('app-right').insertBefore(w, $('app-right').firstChild); return w; },
    load: load,
    labelDefaults: function (o) { Object.keys(o).forEach(function (k) { if (labels[k] == null) labels[k] = o[k]; }); },
    /* a module's own stylesheet; a bundled page carries it inline */
    css: function (file) { if (window.HUB_BUNDLED) return; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = (cfg.chassisBase || base) + 'modules/' + file; document.head.appendChild(l); },
    /* replaceable: a gate module loads the same files from a decrypted bundle. A bundled page has its data inline already. */
    loadData: function () {
      if (window.HUB_BUNDLED) return Promise.resolve();
      return inOrder(cfg.data, function (f) { return load(f); }).then(function () { return inOrder(cfg.dataOptional, function (f) { return load(f, true); }); });
    },
    boot: function () {
      var chassis = cfg.chassisBase || base, modules = window.HUB_BUNDLED ? [] : cfg.modules, views = window.HUB_BUNDLED ? [] : cfg.views;
      applyConfig(); setBarTop();
      window.addEventListener('resize', setBarTop);
      if (window.ResizeObserver) new ResizeObserver(setBarTop).observe($('app-bar'));   /* the bar wraps when modules fill it or a widget narrows the page */
      return inOrder(modules, function (m) { return load(chassis + 'modules/' + m + '.js'); })
        .then(function () { return Hub.loadData(); })
        .then(function () { return inOrder(views, function (v) { return load(v); }); })
        .then(function () { Hub.start(); }, fail);
    },
    /* explicit, so a page can sit behind a gate and start only after it opens */
    start: function () {
      if (started) return; started = true;
      var D = window.HUB_DATA || {};
      Object.assign(Hub.legacy, D.legacy); Object.assign(Hub.alias, D.alias); Object.assign(Hub.titles, D.titles);
      Hub.runReady();
      /* tell the review widget when the screen or a drawer changes; it loads only under ?review=1, so the call tolerates its absence */
      var refreshReview = function () { try { if (window.__rwRefresh) window.__rwRefresh(); } catch (x) {} };
      Hub.onRender(refreshReview); Hub.onDrawer(refreshReview);
      window.addEventListener('hashchange', function () { render(false); });
      $('app-filter').addEventListener('input', drawTree);
      $('drawer-close').addEventListener('click', function () { closeDrawer(); });
      [['drawer-back', -1], ['drawer-fwd', 1]].forEach(function (b) { var el = $(b[0]); if (el) el.addEventListener('click', function () { moveTrail(b[1], el); }); });
      $('app-scrim').addEventListener('click', function () { closeDrawer(); });
      $('app-menu').addEventListener('click', function () { var on = $('app-nav').classList.toggle('open'); this.setAttribute('aria-expanded', on); });
      render(false);
      document.documentElement.setAttribute('data-hub-started', '');
    }
  };
})();
