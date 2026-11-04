/* grove · components.js — markup primitives (TECH-550)
 * ---------------------------------------------------------------------------
 * The three-file CSS contract makes *style* propagate (every artifact links
 * one stylesheet); this file makes *markup* propagate. Each diagnostic
 * primitive — section header, insight card, deep-dive block, explanation
 * sidebar, feedback widget — is a light-DOM custom element rendered from ONE
 * template here. Edit the template, every instance on every page that links
 * this file updates. "Make all section headers match" is one edit, not N.
 *
 * Why light DOM (no shadow root): grove styles with plain classes in
 * components.css; light DOM keeps those classes, the tokens, and the studio
 * overlay's selector-based editing (TECH-355) working unchanged.
 *
 * Include (after the grove CSS links, any folder depth — same '../' rule):
 *   <script defer src="../design-repo/grove/components.js"></script>
 *
 * The contract:
 *   • Templates live in GroveComponents.templates[tag] — the single edit
 *     point. A component-level change = edit the template function here.
 *   • Instance-level overrides are EXPLICIT, three ways:
 *       1. attributes  — <grove-section-head kick="By payer" …>
 *       2. content     — the element's children become the body/lede slot
 *       3. static      — <grove-section-head static> renders once and is
 *                        skipped by GroveComponents.refresh(); the opt-out
 *                        for an instance that must not track the component.
 *   • GroveComponents.refresh(tag?) re-renders live instances (used by the
 *     studio to preview a component edit before it ships).
 *
 * Elements:
 *   <grove-section-head kick icon n title>lede html</grove-section-head>
 *   <grove-insight-card variant tag icon title meta>body html</grove-insight-card>
 *   <grove-deep-dive kick title hint open>body html</grove-deep-dive>
 *   <grove-sidebar variant icon title>body html</grove-sidebar>
 *   <grove-feedback src label project page-label to subject></grove-feedback>
 *
 * icon = a page sprite ref ("#ic-flow"); omitted → no icon. Attribute text is
 * escaped; child content is trusted author HTML and passes through.
 * ------------------------------------------------------------------------- */
(function () {
  if (window.GroveComponents || !('customElements' in window)) return;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(ref) {
    return ref ? '<svg class="ic" aria-hidden="true"><use href="' + esc(ref) + '"/></svg> ' : '';
  }

  /* Component-scoped CSS rides with the templates so a component edit is one
     file. Token-driven, no palette literals — same rule as components.css. */
  var CSS = [
    'grove-section-head,grove-insight-card,grove-deep-dive,grove-sidebar{display:block}',
    /* base icon sizing — pages used to each carry this line; canonized here */
    '.ic{width:1em;height:1em;display:inline-block;vertical-align:-.13em;fill:none;stroke:currentColor;stroke-width:1.85;stroke-linecap:round;stroke-linejoin:round;flex:none}',
    'grove-insight-card>.rail-card{height:100%}',
    /* deep-dive: collapsed evidence block */
    '.dive{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);margin:18px 0;box-shadow:var(--shadow-card)}',
    '.dive>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:14px 18px;font-size:13.5px}',
    '.dive>summary::-webkit-details-marker{display:none}',
    '.dive>summary::after{content:"+";margin-left:auto;font-family:var(--font-mono);font-size:15px;color:var(--muted)}',
    '.dive[open]>summary::after{content:"\\2212"}',
    '.dive[open]>summary{border-bottom:1px solid var(--line)}',
    '.dive-kick{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--forest);display:flex;align-items:center;gap:6px;white-space:nowrap}',
    '.dive-title{font-weight:640;color:var(--ink)}',
    '.dive-hint{font-size:11.5px;color:var(--faint)}',
    '.dive-body{padding:16px 18px;font-size:13.5px;line-height:1.6;color:var(--body)}',
    '.dive-body b{color:var(--ink)}',
    /* explanation sidebar */
    '.xside{background:var(--well);border-left:3px solid var(--lime);border-radius:0 var(--r-card) var(--r-card) 0;padding:14px 18px;margin:18px 0}',
    '.xside.warn{border-left-color:var(--warn)}',
    '.xside-h{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--forest-d);display:flex;align-items:center;gap:6px;margin-bottom:6px}',
    '.xside.warn .xside-h{color:var(--warn)}',
    '.xside-b{font-size:13px;line-height:1.6;color:var(--body)}',
    '.xside-b b{color:var(--ink)}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'grove-components-css';
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  /* Templates — the single edit point. state = {attrs…, content} where
     content is the instance's original child HTML. */
  var templates = {
    'grove-section-head': function (s) {
      var lede = s.content || s.lede;
      return '<div class="sec-head">' +
        '<div><div class="sec-kick">' + icon(s.icon) + esc(s.kick || 'Section') + '</div>' +
        '<h2 class="sec-title">' + esc(s.title || '') + '</h2></div>' +
        (s.n ? '<span class="sec-n">' + esc(s.n) + '</span>' : '') +
        '</div>' +
        (lede ? '<p class="lede">' + lede + '</p>' : '');
    },

    'grove-insight-card': function (s) {
      var v = s.variant ? ' ' + esc(s.variant) : '';
      return '<div class="rail-card' + v + '">' +
        '<div class="rc-h">' +
        (s.tag ? '<span class="rc-tag' + v + '">' + esc(s.tag) + '</span>' : '') +
        '<b>' + icon(s.icon) + esc(s.title || '') + '</b></div>' +
        '<p class="rc-p">' + (s.content || '') + '</p>' +
        (s.meta ? '<div class="rc-m">' + esc(s.meta) + '</div>' : '') +
        '</div>';
    },

    'grove-deep-dive': function (s) {
      return '<details class="dive"' + (s.open != null ? ' open' : '') + '>' +
        '<summary><span class="dive-kick">' + icon(s.icon) + esc(s.kick || 'Dive deeper') + '</span>' +
        '<span class="dive-title">' + esc(s.title || '') + '</span>' +
        (s.hint ? '<span class="dive-hint">' + esc(s.hint) + '</span>' : '') +
        '</summary><div class="dive-body">' + (s.content || '') + '</div></details>';
    },

    'grove-sidebar': function (s) {
      var v = s.variant ? ' ' + esc(s.variant) : '';
      return '<aside class="xside' + v + '">' +
        '<div class="xside-h">' + icon(s.icon) + esc(s.title || 'How to read this') + '</div>' +
        '<div class="xside-b">' + (s.content || '') + '</div></aside>';
    }
  };

  var ATTRS = {
    'grove-section-head': ['kick', 'icon', 'title', 'n', 'lede'],
    'grove-insight-card': ['variant', 'tag', 'icon', 'title', 'meta'],
    'grove-deep-dive': ['kick', 'icon', 'title', 'hint', 'open'],
    'grove-sidebar': ['variant', 'icon', 'title']
  };

  function define(tag) {
    var El = function () { return Reflect.construct(HTMLElement, [], El); };
    El.prototype = Object.create(HTMLElement.prototype, { constructor: { value: El } });
    El.observedAttributes = ATTRS[tag];
    El.prototype.connectedCallback = function () {
      if (this.__content == null) this.__content = this.innerHTML.trim();
      this.render();
    };
    El.prototype.attributeChangedCallback = function () {
      if (this.__content != null) this.render();
    };
    El.prototype.render = function () {
      var s = { content: this.__content };
      for (var i = 0; i < ATTRS[tag].length; i++) {
        var a = ATTRS[tag][i];
        if (this.hasAttribute(a)) s[a] = this.getAttribute(a);
      }
      this.innerHTML = templates[tag](s);
    };
    customElements.define(tag, El);
  }
  Object.keys(templates).forEach(define);

  /* <grove-feedback> — loader, not a second implementation. The canonical
     widget stays feedback.js (TECH-518/529, single source); this element just
     standardizes its config + include so every page mounts it the same way.
     No src attribute → renders nothing (safe on pages without a relay). */
  var Fb = function () { return Reflect.construct(HTMLElement, [], Fb); };
  Fb.prototype = Object.create(HTMLElement.prototype, { constructor: { value: Fb } });
  Fb.prototype.connectedCallback = function () {
    var src = this.getAttribute('src');
    if (!src || window.__FOUND_FEEDBACK_MOUNTED__ || document.querySelector('script[data-grove-feedback]')) return;
    var cfg = window.__FOUND_FEEDBACK__ = window.__FOUND_FEEDBACK__ || {};
    var map = { label: 'label', project: 'project', 'page-label': 'pageLabel', to: 'to', subject: 'subject' };
    for (var a in map) {
      if (this.hasAttribute(a) && cfg[map[a]] == null) cfg[map[a]] = this.getAttribute(a);
    }
    var s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.setAttribute('data-grove-feedback', '');
    document.head.appendChild(s);
  };
  customElements.define('grove-feedback', Fb);

  window.GroveComponents = {
    version: '1.0.0',
    templates: templates,
    refresh: function (tag) {
      var tags = tag ? [tag] : Object.keys(templates);
      tags.forEach(function (t) {
        document.querySelectorAll(t + ':not([static])').forEach(function (el) {
          if (el.render) el.render();
        });
      });
    }
  };
})();
