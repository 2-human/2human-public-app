/* The 2human app's sign-in store: email-link sign-in, the account's role, and the hub's decryption keys. Public page code:
 * it holds no data. Based on the Library's sign-in recipes (library/features/auth-gate/email-link-sign-in.md, key-gated-bundle.md),
 * cut to what a read-only hub needs: no answers, comments or files.
 *
 * Backend: Firebase project app-2human (window.FIREBASE_CONFIG, firebase-config.js), keys at hubs/2human-app/meta/gate.
 * Sign-up is closed; accounts and their `role` claim are set by tools/hub-firebase/firebase-accounts.mjs. Roles that open
 * the hub: admin, team (firebase/firestore.rules enforce the same).
 * A config with `emulator: { auth, firestore }` (ports) connects to the local emulators; the publish script refuses it. */
(function () {
  var ROOT = 'hubs/2human-app', MAILKEY = '2human-app_signin_email', ROLES = ['admin', 'team'];
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-';
  var AU = null, FS = null, INIT = null;
  var words = function (k) { var L = (window.HUB_CONFIG || {}).labels || {}; return L[k] || k; };

  /* A sign-in link lands here with ?mode=signIn&oobCode=…: finish it, then drop only Firebase's parameters. */
  function finishLink(Au, auth) {
    var href = location.href; if (!Au.isSignInWithEmailLink(auth, href)) return null;
    var email = ''; try { email = localStorage.getItem(MAILKEY) || ''; } catch (e) {}
    if (!email) { try { email = (window.prompt(words('signInConfirmEmail')) || '').trim(); } catch (e) {} }
    var u = new URL(href); ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl', 'tenantId'].forEach(function (k) { u.searchParams.delete(k); });
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    if (!email) return null;
    return Au.signInWithEmailLink(auth, email, href).then(function () { try { localStorage.removeItem(MAILKEY); } catch (e) {} })
      .catch(function (e) { api.signInError = e.code || 'failed'; console.warn('[auth] sign-in link', e.code || e); });
  }

  function init() {
    var cfg = window.FIREBASE_CONFIG;
    if (!(cfg && cfg.apiKey)) return Promise.reject(new Error('no backend config'));
    if (INIT) return INIT;
    var fb = Object.assign({}, cfg); delete fb.emulator; delete fb.appCheckSiteKey;
    INIT = Promise.all(['app', 'auth', 'firestore'].map(function (m) { return import(SDK + m + '.js'); })).then(function (M) {
      var A = M[0], Au = M[1], Fs = M[2];
      var app = A.getApps().length ? A.getApp() : A.initializeApp(fb), auth = Au.getAuth(app);   /* Auth before the database */
      var emu = cfg.emulator;
      if (emu) Au.connectAuthEmulator(auth, 'http://127.0.0.1:' + emu.auth, { disableWarnings: true });
      AU = { Au: Au, auth: auth, app: app };
      /* App Check (reCAPTCHA Enterprise): every Firestore and Storage request carries a token, so enforcing App Check for
       * the public contact form's sake keeps the hub working. Not on the emulators. */
      var appCheck = !emu && cfg.appCheckSiteKey ? import(SDK + 'app-check.js').then(function (AC) {
        AC.initializeAppCheck(app, { provider: new AC.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
      }).catch(function (e) { console.warn('[auth] app check', e); }) : null;
      return Promise.resolve(appCheck).then(function () { return finishLink(Au, auth); }).then(function () {
        return new Promise(function (ok) {
          var first = true;
          Au.onAuthStateChanged(auth, function (u) {
            /* a sign-in or sign-out after start (another tab, the menu) reloads, so every part of the hub sees one account */
            if (!first) { if ((u ? u.uid : null) !== (api.user ? api.user.uid : null)) location.reload(); return; }
            first = false; if (!u) return ok();
            u.getIdTokenResult().then(function (t) { api.user = { uid: u.uid, email: u.email, name: u.displayName || u.email, role: t.claims.role || '' }; ok(); }, function () { ok(); });
          });
        });
      }).then(function () {
        var store = Fs.getFirestore(app);
        if (emu) Fs.connectFirestoreEmulator(store, '127.0.0.1', emu.firestore);
        FS = { Fs: Fs, store: store };
      });
    });
    return INIT;
  }

  var api = window.HubAuth = {
    user: null, signInError: null,
    init: init,
    canRead: function () { return !!api.user && ROLES.indexOf(api.user.role) >= 0; },
    signIn: function (email) {
      return init().then(function () {
        return AU.Au.sendSignInLinkToEmail(AU.auth, email, { url: location.origin + location.pathname + location.search, handleCodeInApp: true })
          .then(function () { try { localStorage.setItem(MAILKEY, email); } catch (e) {} });
      });
    },
    signOut: function () { return AU ? AU.Au.signOut(AU.auth) : Promise.resolve(); },
    /* the gate's way in: the hub's decryption keys, which only accounts with a role can read (newest first) */
    gateKeys: function () {
      return init().then(function () {
        if (!api.canRead()) return [];
        return FS.Fs.getDoc(FS.Fs.doc(FS.store, ROOT + '/meta', 'gate')).then(function (d) { return (d.exists() && d.data().keys) || []; });
      });
    },

    /* Control requests (plan P4): the hub only writes a request; the runner on the operator's Mac checks it again and
     * carries it out. Admin accounts may ask; team accounts see the queue and the audit log (firestore.rules). */
    canRequest: function () { return !!api.user && api.user.role === 'admin'; },
    /* live list of a collection (requests or audit), newest first; fn(rows) on every change; returns a stop function */
    watch: function (name, fn) {
      var stop = null, stopped = false;
      init().then(function () {
        if (stopped || !api.canRead()) return;
        var F = FS.Fs, q = F.query(F.collection(FS.store, ROOT + '/' + name), F.orderBy(name === 'audit' ? 'finishedAt' : 'createdAt', 'desc'), F.limit(200));
        stop = F.onSnapshot(q, function (snap) { var rows = []; snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); }); fn(rows); },
          function (e) { console.error('[auth] ' + name, e); fn(null); });
      }, function () { fn(null); });
      return function () { stopped = true; if (stop) stop(); };
    },
    request: function (action, params) {
      return init().then(function () {
        if (!api.canRequest()) throw new Error('not admin');
        var id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        return FS.Fs.setDoc(FS.Fs.doc(FS.store, ROOT + '/requests', id), {
          action: action, params: params || {}, status: 'queued', requestedBy: api.user.email, requestedByUid: api.user.uid, createdAt: Date.now()
        }).then(function () { return id; });
      });
    },
    cancel: function (id) {
      return init().then(function () { return FS.Fs.updateDoc(FS.Fs.doc(FS.store, ROOT + '/requests', id), { status: 'cancelled' }); });
    },

    /* Operations data (plan P5, firebase/MODEL.md): CRM and accounting, admin accounts only. Live, straight from
     * Firestore; nothing of it is in the published bundle. */
    canEdit: function () { return !!api.user && api.user.role === 'admin'; },
    /* every document of a collection, live; fn({ id: data }) on each change, fn(null) when it cannot be read */
    opsWatch: function (coll, fn) {
      var stop = null, stopped = false;
      init().then(function () {
        if (stopped) return;
        if (!api.canEdit()) return fn(null);
        stop = FS.Fs.onSnapshot(FS.Fs.collection(FS.store, ROOT + '/' + coll), function (snap) {
          var all = {}; snap.forEach(function (d) { all[d.id] = d.data(); }); fn(all);
        }, function (e) { console.error('[auth] ' + coll, e); fn(null); });
      }, function () { fn(null); });
      return function () { stopped = true; if (stop) stop(); };
    },
    newId: function () { return FS ? FS.Fs.doc(FS.Fs.collection(FS.store, ROOT + '/x')).id : 'n' + Date.now().toString(36); },
    /* replace a document with `data`, stamped; keeps createdAt and the record's provenance (source) */
    opsSave: function (coll, id, data, prev) {
      return init().then(function () {
        var now = Date.now(), d = Object.assign({}, data, {
          createdAt: (prev && prev.createdAt) || now, updatedAt: now, updatedBy: api.user.email, source: (prev && prev.source) || 'hub'
        });
        return FS.Fs.setDoc(FS.Fs.doc(FS.store, ROOT + '/' + coll, id), d);
      });
    },
    /* upload one file to Storage under hubs/2human-app/documents/{docId}/{name}; resolves with the storage path */
    upload: function (docId, file) {
      return init().then(function () { return import(SDK + 'storage.js'); }).then(function (St) {
        var cfg = window.FIREBASE_CONFIG || {}, st = St.getStorage(AU.app);
        if (cfg.emulator && cfg.emulator.storage && !AU.stEmu) { St.connectStorageEmulator(st, '127.0.0.1', cfg.emulator.storage); AU.stEmu = true; }
        var name = String(file.name || 'file').replace(/[^\w.-]+/g, '_').slice(-120), path = ROOT + '/documents/' + docId + '/' + name;
        return St.uploadBytes(St.ref(st, path), file, { contentType: file.type || 'application/octet-stream' }).then(function () { return path; });
      });
    },
    opsDelete: function (coll, id) {
      return init().then(function () { return FS.Fs.deleteDoc(FS.Fs.doc(FS.store, ROOT + '/' + coll, id)); });
    }
  };
})();
