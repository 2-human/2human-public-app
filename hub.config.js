/* The 2human app (app.2-human.com): CRM and accounting for 2human, on hub-chassis 1.2.0. The thin config: identity,
 * tokens, labels, file lists, storage prefix. Words: data/core.js and data/ops.js. Layout: actions.js and ops.js.
 * Accent: the 2human teal. */
window.HUB_CONFIG = {
  id: '2human-app',
  title: '2human',
  lang: 'en',
  locale: 'en-GB',
  currency: 'RSD',
  home: '/ops/invoices',
  theme: 'auto',
  brand: { name: '2human', sub: 'CRM · accounting' },
  tokens: { accent: '#197a69', accentSoft: '#e3f1ee' },
  tokensDark: { accent: '#34b29a', accentSoft: '#173a33' },
  storage: { prefix: '2human-app' },
  modules: ['tables', 'evidence'],
  /* the one ordered file list: locally these load as files; on the mirror gate.js runs them from data/bundle.enc */
  data: ['data/core.js?v=59c9ab54be', 'data/ops.js?v=74768876fd'],
  views: ['actions.js?v=3ac5c09888', 'ops.js?v=406846fcd9'],
  labels: {
    gateTitle: '2human',
    gatePrompt: 'Sign in with your 2human email. We send you a one-time link; open it in this browser and the app opens.',
    gateEmail: 'Your work email', gateSend: 'Email me a sign-in link', gateSending: 'Sending…',
    gateSent: 'Check your inbox for a sign-in link (from Firebase; look in spam if it does not arrive) and open it in this browser.',
    gateNotListed: 'That address is not on the account list.', gateSendFailed: 'The link could not be sent. Try again.',
    gateLinkFailed: 'That sign-in link did not work. It may have expired or been used already. Ask for a new one below.',
    gateNoAccess: 'Signed in as {email}, but this account has no access to the 2human app. Sign out and use your 2human account.',
    gateOpenFailed: 'The app could not be opened. Reload the page to try again.', gateUnavailable: 'The app is not available right now.',
    gateSignOut: 'Sign out', signInConfirmEmail: 'Confirm your email address to finish signing in',
    filter: 'Filter the menu'
  }
};
