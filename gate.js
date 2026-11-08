/* Personal sign-in gate for the 2human app, following (library/features/auth-gate/key-gated-bundle.md, email-link-sign-in.md), on the
 * chassis' gated page (chassis/index.gated.html, unedited; this file is its `gate.js`).
 *
 * Locally (gate-mode.js says HUB_GATED = false) the plaintext data and views exist, so the hub boots as usual and no
 * one signs in. On the public mirror (publish.sh sets it true) only
 * data/bundle.enc is published: the visitor signs in with their own account by email link, the page reads the hub's keys
 * from Firestore (only accounts with a role may), tries them newest first (AES-256-GCM, then gunzip), runs the files in
 * order and starts. Nothing that opens the hub is stored in the browser, so a removed account stops opening it.
 *
 * The one ordered file list is hub.config.js: `data`, then `dataOptional`, then `views`. tools/hub/publish.sh encrypts
 * exactly that list. Every word here is in hub.config.js `labels` (gate*), the only text that is public. */
(function () {
  var C = window.HUB_CONFIG || {}, L = C.labels || {};
  var bare = function (f) { return String(f).replace(/\?.*$/, ''); };
  var DATA = (C.data || []).map(bare), OPTIONAL = (C.dataOptional || []).map(bare), VIEWS = (C.views || []).map(bare);
  var $ = function (id) { return document.getElementById(id); };
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var emit = function (name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {} };

  function load(src) {
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('could not load ' + src)); }; document.head.appendChild(s); });
  }
  /* an inline script's own error goes to window, not to the caller */
  function run(text, name) {
    var failed = null, watch = function (e) { failed = e.error || new Error(e.message); };
    window.addEventListener('error', watch);
    var s = document.createElement('script'); s.textContent = text + '\n//# sourceURL=' + encodeURI(name); document.head.appendChild(s);
    window.removeEventListener('error', watch);
    if (failed) throw failed;
  }
  function unlock(raw, bundle) {
    return crypto.subtle.importKey('raw', b64(raw), 'AES-GCM', false, ['decrypt'])
      .then(function (key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(bundle.iv) }, key, b64(bundle.ct)); })
      .then(function (gz) { return new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); })
      .then(JSON.parse);
  }
  /* the newest key first; an older one still opens a bundle published moments before */
  function tryKeys(keys, bundle) { return keys.reduce(function (p, k) { return p.catch(function () { return unlock(k, bundle); }); }, Promise.reject(new Error('no key'))); }
  /* the chassis boots as usual, with the data and views coming from the decrypted files instead of the network */
  function start(files) {
    DATA.forEach(function (f) { if (files[f] == null) throw new Error('bundle has no ' + f); });
    Hub.loadData = function () {
      DATA.concat(OPTIONAL, VIEWS).forEach(function (f) { if (files[f] != null) run(files[f], f); });
      return Promise.resolve();
    };
    C.views = [];
    return Hub.boot();
  }

  function gate() {
    var g = $('gate'), form = $('gate-form'), input = $('gate-pw'), msg = $('gate-msg'), out = $('gate-retry'), btn = form.querySelector('button[type=submit]'), A = window.HubAuth;
    /* the hub's own colours on the gate card, as the chassis sets them at boot */
    if (!C.tokensDark && C.theme !== 'auto' && C.theme !== 'dark') document.documentElement.setAttribute('data-theme', 'light');
    if (Hub.applyTokens) {
      Hub.applyTokens(C.tokens || {});
      /* the dark accent on the gate card alone (the chassis sets the page-wide dark rule at boot, after the gate) */
      if (C.tokensDark && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) Hub.applyTokens(C.tokensDark, g);
    }
    input.type = 'email'; input.setAttribute('autocomplete', 'email');
    $('gate-title').textContent = L.gateTitle || ''; $('gate-prompt').textContent = L.gatePrompt || ''; $('gate-label').textContent = L.gateEmail || '';
    btn.textContent = L.gateSend || ''; out.textContent = L.gateSignOut || '';
    var show = function (text, signedIn) {
      g.hidden = false; form.hidden = false; msg.textContent = text || '';
      [$('gate-prompt'), $('gate-label'), input, btn].forEach(function (e) { e.hidden = !!signedIn; });
      out.hidden = !signedIn; btn.disabled = false;
      if (!signedIn) input.focus();
    };
    out.onclick = function () { A.signOut(); };
    form.onsubmit = function (e) {
      e.preventDefault(); var v = input.value.trim(); if (!v) return;
      btn.disabled = true; msg.textContent = L.gateSending || '';
      A.signIn(v).then(function () { msg.textContent = L.gateSent || ''; }, function (x) {
        btn.disabled = false; msg.textContent = x && x.code === 'auth/admin-restricted-operation' ? L.gateNotListed : L.gateSendFailed;
      });
    };
    return fetch('data/bundle.enc', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('no bundle'); return r.json(); }).then(function (bundle) {
      return A.init().then(function () {
        if (A.signInError) { emit('auth-denied', { reason: 'sign-in-failed' }); return show(L.gateLinkFailed); }
        if (!A.user) return show('');
        if (!A.canRead()) { emit('auth-denied', { reason: 'not-allowlisted', email: A.user.email }); return show(String(L.gateNoAccess || '').replace('{email}', A.user.email), true); }
        g.hidden = true;
        return A.gateKeys().then(function (keys) { return tryKeys(keys, bundle); }).then(start).then(function () {
          emit('auth-granted', { email: A.user.email, surface: C.id });
        }, function (e) { console.error('[gate]', e); show(L.gateOpenFailed, true); });
      });
    }).catch(function (e) {
      console.error('[gate]', e); g.hidden = false; form.hidden = false;
      [$('gate-prompt'), $('gate-label'), input, btn, out].forEach(function (x) { x.hidden = true; });
      $('gate-title').textContent = L.gateTitle || ''; msg.textContent = L.gateUnavailable || '';
    });
  }

  /* the mode flag (gate-mode.js), the public web config, the sign-in store (auth.js), the chassis */
  ['gate-mode.js?v=ee9418ffc4', 'firebase-config.js?v=462c02126f', 'auth.js?v=f4a5aa9e24', 'chassis/hub-core.js?v=679b0255c7'].reduce(function (p, f) { return p.then(function () { return load(f); }); }, Promise.resolve())
    .then(function () { return window.HUB_GATED ? gate() : Hub.boot(); })
    .catch(function (e) { console.error('[gate]', e); });
})();
