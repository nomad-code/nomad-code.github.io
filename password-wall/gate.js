/* password-wall · gate.js
 * Drop-in password gate, grove-themed and per-world branded.
 * Usage:
 *   <script src="../password-wall/gate.js"
 *           data-brand="Nomad Code"
 *           data-label="Partner Walkthrough"
 *           data-key="bpo-unlocked"></script>
 *
 * data-password (default: "longwalk")
 * data-key      (default: "bpo-unlocked") — shared key = shared unlock
 * data-brand    (default: "Nomad Code")       — wordmark beside the mark
 * data-label    (default: "Private")          — small caps line under the mark
 * data-storage  (default: "local")            — "local" | "session"
 *
 * The script tag must be in <head> (or top of <body>) to gate before paint.
 * Hides the document until unlocked; never sends the password anywhere.
 *
 * Unlock flow: a correct password persists the key, stamps a one-shot
 * "<key>::reveal" flag in sessionStorage, and reloads the page. The reload is
 * the fix for the old unlock-then-refresh dance: while gated the page's
 * load-time scripts (canvas sizing, charts, scale-to-fit) had already run
 * against a hidden layout, so un-hiding in place showed a broken page. After
 * the reload everything boots against a real visible layout — behind an
 * opaque curtain that plays a bar-wave pulse and lifts once the DOM is ready.
 * Pages that want to re-fire intros can still listen for "found:unlock",
 * dispatched as the curtain starts to lift (or immediately when no curtain
 * plays). prefers-reduced-motion collapses the whole show to a quick fade.
 *
 * bpo defaults to "Nomad Code"; the sibling dhamma world (bre) passes its own
 * via data-brand / window.__BPO_GATE__.brand from the same gate.
 *
 * Config can also be supplied via window.__BPO_GATE__ =
 * {password,key,brand,label,storage,assetRoot}
 * for when gate.js is loaded *dynamically* (e.g. by the self-locating loader in
 * gate-snippet.html, where document.currentScript is null). Dataset wins over global.
 */
(function () {
  var script = document.currentScript;
  var ds = (script && script.dataset) || {};
  var g = window.__BPO_GATE__ || {};
  var PASSWORD = ds.password || g.password || 'longwalk';
  var KEY = ds.key || g.key || 'bpo-unlocked';
  var BRAND = ds.brand || g.brand || 'Nomad Code';
  var LABEL = ds.label || g.label || 'Private';
  var STORAGE = ((ds.storage || g.storage) === 'session') ? sessionStorage : localStorage;
  var REVEAL_KEY = KEY + '::reveal';
  var HIDE_ID = '__pw_gate_hide__';
  var MONO = '\'DM Mono\',ui-monospace,\'SF Mono\',Menlo,monospace';
  var REDUCED = false;
  try {
    REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  // Canonical Nomad Code favicon. Resolve from gate.js (or the successful
  // self-locating prefix) so the same link works on file:// at any artifact
  // depth and on the clean hosted URL. Append after parsing too, so an older
  // root-relative declaration cannot win locally.
  function faviconUrl() {
    if (script && script.src) {
      return new URL('../favicon-32x32.png', script.src).href;
    }
    if (g.assetRoot !== undefined) {
      return new URL(g.assetRoot + 'favicon-32x32.png', document.baseURI).href;
    }
    // Existing artifacts embed an older loader without assetRoot. The
    // dynamically inserted gate script is still present in document.scripts
    // even in browsers that report document.currentScript as null here.
    var loadedScripts = document.scripts || [];
    for (var s = loadedScripts.length - 1; s >= 0; s--) {
      if (/\/password-wall\/gate\.js(?:[?#]|$)/.test(loadedScripts[s].src || '')) {
        return new URL('../favicon-32x32.png', loadedScripts[s].src).href;
      }
    }
    try {
      var resources = performance.getEntriesByType('resource');
      for (var r = resources.length - 1; r >= 0; r--) {
        if (/\/password-wall\/gate\.js(?:[?#]|$)/.test(resources[r].name)) {
          return new URL('../favicon-32x32.png', resources[r].name).href;
        }
      }
    } catch (e) {}
    return new URL('/favicon-32x32.png', document.baseURI).href;
  }

  function installFavicon() {
    var icon = document.querySelector('link[data-bpo-site-icon]');
    if (!icon) {
      icon = document.createElement('link');
      icon.setAttribute('data-bpo-site-icon', 'nomad-code');
    } else if (icon.parentNode) {
      icon.parentNode.removeChild(icon);
    }
    icon.rel = 'icon';
    icon.type = 'image/png';
    icon.sizes = '32x32';
    icon.href = faviconUrl();
    (document.head || document.documentElement).appendChild(icon);
  }
  installFavicon();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installFavicon, { once: true });
  }

  // The gate-snippet pre-hider and our own hide style share HIDE_ID, so the
  // old getElementById().remove() left one of the two behind — the "unlocks
  // but stays blank until refresh" bug. Sweep every match.
  function removeHiders() {
    var nodes = document.querySelectorAll('#' + HIDE_ID);
    for (var i = 0; i < nodes.length; i++) nodes[i].parentNode.removeChild(nodes[i]);
  }

  function unlockEvent() {
    try {
      window.dispatchEvent(new CustomEvent('found:unlock', { detail: { key: KEY } }));
    } catch (e) {}
  }

  // The two-rect mark, sized up for the reveal curtain.
  function markSvg(w, h) {
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 22 18" fill="none" aria-hidden="true">' +
      '<rect x="0" y="0" width="15" height="8" rx="1.5" fill="#15201d"/>' +
      '<rect x="7" y="10" width="15" height="8" rx="1.5" fill="#84c241"/>' +
      '</svg>';
  }

  // Post-unlock reveal: the page underneath is booting UNHIDDEN at full size
  // (so every measurement is real); this opaque curtain covers the load,
  // pulses a bar-wave off the mark, and lifts once the DOM is ready.
  function reveal() {
    var pre = document.getElementById('__pw_reveal_pre__'); // snippet's pre-paint cover
    if (document.readyState !== 'loading' && !pre) {
      // We loaded after first paint (deep self-locating lookup) and nothing
      // pre-covered the page — covering visible content now would flash.
      unlockEvent();
      return;
    }

    var bars = '';
    for (var i = 0; i < 24; i++) {
      // Deterministic organic heights — golden-angle sine spread, no RNG.
      var h = 10 + Math.round(24 * Math.abs(Math.sin(i * 2.399963)));
      var ink = (i % 5 === 2) ? 'background:rgba(21,32,29,0.28);' : '';
      bars += '<i style="height:' + h + 'px;animation-delay:' + (i * 38) + 'ms;' + ink + '"></i>';
    }

    var overlay = document.createElement('div');
    overlay.id = '__pw_reveal__';
    overlay.innerHTML =
      '<style>' +
      '#__pw_reveal__{' +
        'position:fixed;inset:0;z-index:2147483647;background:#f4f4ef;' +
        'display:flex;align-items:center;justify-content:center;' +
        'transition:transform .62s cubic-bezier(.65,0,.35,1);will-change:transform;' +
      '}' +
      '#__pw_reveal__.pw-exit{transform:translateY(-101%);}' +
      '#__pw_reveal__.pw-exit-fade{transition:opacity .24s ease;opacity:0;}' +
      '#__pw_reveal__ .pw-rv{display:flex;flex-direction:column;align-items:center;gap:20px;' +
        'transition:opacity .3s ease;}' +
      '#__pw_reveal__.pw-exit .pw-rv{opacity:0;}' +
      '#__pw_reveal__ .pw-rv-bars{display:flex;align-items:flex-end;gap:3px;height:34px;}' +
      '#__pw_reveal__ .pw-rv-bars i{width:3px;border-radius:2px;background:#84c241;' +
        'transform-origin:bottom;animation:pwPulse .9s ease-in-out infinite;}' +
      '@keyframes pwPulse{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}' +
      '#__pw_reveal__ .pw-rv-label{font-family:' + MONO + ';font-size:10px;' +
        'letter-spacing:0.22em;text-transform:uppercase;color:#6f7a76;}' +
      '@media (prefers-reduced-motion: reduce){#__pw_reveal__ .pw-rv-bars i{animation:none;}}' +
      '</style>' +
      '<div class="pw-rv">' +
        markSvg(40, 33) +
        '<div class="pw-rv-bars">' + bars + '</div>' +
        '<span class="pw-rv-label">unlocked</span>' +
      '</div>';
    document.documentElement.appendChild(overlay);
    if (pre) pre.parentNode.removeChild(pre);

    var done = false;
    function exit() {
      if (done) return;
      done = true;
      unlockEvent(); // intros re-fire as the curtain starts to lift
      overlay.classList.add(REDUCED ? 'pw-exit-fade' : 'pw-exit');
      setTimeout(function () { overlay.remove(); }, REDUCED ? 280 : 680);
    }
    function arm() { setTimeout(exit, REDUCED ? 120 : 620); }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arm);
    } else {
      arm();
    }
    setTimeout(exit, 3600); // backstop — never trap the page behind the curtain
  }

  if (STORAGE.getItem(KEY) === 'true') {
    // A pre-hiding loader may have hidden the page before we loaded; unhide it.
    removeHiders();
    var justUnlocked = false;
    try {
      justUnlocked = sessionStorage.getItem(REVEAL_KEY) === '1';
      if (justUnlocked) sessionStorage.removeItem(REVEAL_KEY); // one-shot
    } catch (e) {}
    if (justUnlocked) reveal();
    return;
  }

  // Hide page contents until unlocked — visibility, not display, so layout
  // still computes at full size and load-time measurements stay real.
  removeHiders(); // replace any display:none pre-hider from an older snippet
  var hideStyle = document.createElement('style');
  hideStyle.id = HIDE_ID;
  hideStyle.textContent = 'html > body > *:not(#__pw_gate__) { visibility: hidden !important; }';
  (document.head || document.documentElement).appendChild(hideStyle);

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var existing = document.getElementById('__pw_gate__');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.id = '__pw_gate__';
    wrap.innerHTML =
      '<style>' +
      '#__pw_gate__{' +
        'position:fixed;inset:0;z-index:2147483647;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:#f4f4ef;padding:32px;' +
        'font-family:\'DM Sans\',\'Helvetica Neue\',Arial,sans-serif;' +
        'color:#15201d;' +
      '}' +
      '#__pw_gate__ form{' +
        'width:100%;max-width:384px;background:#FFFFFF;' +
        'border:1px solid #e4eae6;' +
        'border-radius:18px;padding:40px;' +
        'display:flex;flex-direction:column;gap:24px;' +
        'box-shadow:0 1px 2px rgba(20,23,15,0.04);' +
        'transition:transform .4s cubic-bezier(.65,0,.35,1),opacity .4s ease;' +
      '}' +
      '#__pw_gate__.pw-ok form{transform:scale(0.98);opacity:0.9;}' +
      '#__pw_gate__ .pw-head{display:flex;flex-direction:column;gap:12px;align-items:flex-start;}' +
      '#__pw_gate__ .pw-mark{display:flex;align-items:center;gap:8px;}' +
      '#__pw_gate__ .pw-mark span{font-size:14px;letter-spacing:-0.01em;font-weight:400;}' +
      '#__pw_gate__ .pw-eyebrow{' +
        'font-family:' + MONO + ';' +
        'font-size:10px;letter-spacing:0.18em;text-transform:uppercase;' +
        'color:#6f7a76;' +
      '}' +
      '#__pw_gate__ .pw-field{display:flex;flex-direction:column;gap:8px;}' +
      '#__pw_gate__ .pw-label{' +
        'font-family:' + MONO + ';' +
        'font-size:10px;letter-spacing:0.18em;text-transform:uppercase;' +
        'color:#a7a79c;' +
      '}' +
      '#__pw_gate__ input{' +
        'width:100%;background:#f4f4ef;' +
        'border:1px solid #e4eae6;border-radius:9999px;' +
        'padding:10px 16px;font-size:14px;color:#15201d;' +
        'outline:none;transition:border-color 0.15s ease;' +
        'box-sizing:border-box;' +
        'font-family:\'DM Sans\',\'Helvetica Neue\',Arial,sans-serif;' +
      '}' +
      '#__pw_gate__ input::placeholder{color:#a7a79c;}' +
      '#__pw_gate__ input:focus{border-color:#127c70;}' +
      '#__pw_gate__ .pw-error{' +
        'font-family:' + MONO + ';' +
        'font-size:10px;letter-spacing:0.18em;text-transform:uppercase;' +
        'color:#c1502e;' +
      '}' +
      '#__pw_gate__ button{' +
        'width:100%;padding:10px 20px;background:#127c70;color:#f4f4ef;' +
        'font-size:14px;font-weight:500;letter-spacing:0.01em;' +
        'border:none;border-radius:9999px;cursor:pointer;' +
        'transition:background-color 0.15s ease;' +
        'font-family:\'DM Sans\',\'Helvetica Neue\',Arial,sans-serif;' +
        'min-height:38px;' +
      '}' +
      '#__pw_gate__ button:hover{background:#0c5a50;}' +
      '#__pw_gate__ .pw-btnbars{display:inline-flex;align-items:flex-end;gap:3px;height:16px;vertical-align:middle;}' +
      '#__pw_gate__ .pw-btnbars i{width:3px;border-radius:2px;background:#f4f4ef;' +
        'transform-origin:bottom;animation:pwBtnPulse .5s ease-in-out infinite;}' +
      '@keyframes pwBtnPulse{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}' +
      '</style>' +
      '<form autocomplete="off" novalidate>' +
        '<div class="pw-head">' +
          '<div class="pw-mark">' +
            '<svg width="20" height="16" viewBox="0 0 22 18" fill="none" aria-hidden="true">' +
              '<rect x="0" y="0" width="15" height="8" rx="1.5" fill="#15201d"/>' +
              '<rect x="7" y="10" width="15" height="8" rx="1.5" fill="#84c241"/>' +
            '</svg>' +
            '<span class="pw-brand"></span>' +
          '</div>' +
          '<span class="pw-eyebrow"></span>' +
        '</div>' +
        '<div class="pw-field">' +
          '<label class="pw-label" for="__pw_gate_input">Access</label>' +
          '<input id="__pw_gate_input" type="password" placeholder="enter password" autocomplete="off"/>' +
          '<span class="pw-error" hidden>Incorrect — try again</span>' +
        '</div>' +
        '<button type="submit">Continue</button>' +
      '</form>';

    // Inject brand + label text safely (no innerHTML for user-controlled content).
    wrap.querySelector('.pw-brand').textContent = BRAND;
    wrap.querySelector('.pw-eyebrow').textContent = LABEL;

    var attached = document.body || document.documentElement;
    attached.appendChild(wrap);

    var input = wrap.querySelector('#__pw_gate_input');
    var error = wrap.querySelector('.pw-error');
    var form = wrap.querySelector('form');
    var button = wrap.querySelector('button');

    setTimeout(function () { input.focus(); }, 0);

    input.addEventListener('input', function () {
      if (!error.hidden) error.hidden = true;
    });

    var unlocking = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (unlocking) return;
      var v = (input.value || '').trim().toLowerCase();
      if (v !== PASSWORD) {
        error.hidden = false;
        input.value = '';
        input.focus();
        return;
      }

      var persisted = false;
      try {
        STORAGE.setItem(KEY, 'true');
        persisted = STORAGE.getItem(KEY) === 'true';
      } catch (err) {}

      if (!persisted) {
        // Storage blocked (private mode / iframe policy): a reload would just
        // re-prompt, so unhide in place. The visibility-based hide kept layout
        // real, so the page is intact — no refresh needed even on this path.
        removeHiders();
        wrap.remove();
        unlockEvent();
        return;
      }

      // Reload behind the reveal curtain so every load-time script re-runs
      // against a visible, full-size layout. The flag is one-shot: only the
      // very next load of this tab plays the curtain.
      try { sessionStorage.setItem(REVEAL_KEY, '1'); } catch (err) {}
      unlocking = true;
      input.disabled = true;
      button.disabled = true;
      if (REDUCED) {
        location.reload();
        return;
      }
      wrap.classList.add('pw-ok');
      button.innerHTML =
        '<span class="pw-btnbars">' +
        '<i style="height:7px;animation-delay:0ms"></i>' +
        '<i style="height:13px;animation-delay:70ms"></i>' +
        '<i style="height:16px;animation-delay:140ms"></i>' +
        '<i style="height:11px;animation-delay:210ms"></i>' +
        '<i style="height:8px;animation-delay:280ms"></i>' +
        '</span>';
      setTimeout(function () { location.reload(); }, 520);
    });
  });
})();
