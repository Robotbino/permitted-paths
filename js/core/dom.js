/* dom.js: the GE namespace and small helpers to make HTML and SVG elements.
   Classic scripts (no modules) so that index.html opens from file://. */
window.GE = window.GE || { labs: {}, data: {} };

(function (GE) {
  'use strict';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function apply(el, attrs, kids) {
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    kids.forEach(function add(kid) {
      if (kid == null || kid === false) return;
      if (Array.isArray(kid)) return kid.forEach(add);
      el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
    });
    return el;
  }

  /** h('button', {class: 'btn', onclick: fn}, 'Label') */
  GE.h = function (tag, attrs) {
    return apply(document.createElement(tag), attrs, [].slice.call(arguments, 2));
  };
  /** s('rect', {x: 0, y: 0}) for SVG elements */
  GE.s = function (tag, attrs) {
    return apply(document.createElementNS(SVG_NS, tag), attrs, [].slice.call(arguments, 2));
  };
  GE.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  GE.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  GE.reduced = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  /** A PASS or FAIL stamp. The word is always there; colour is never the only signal. */
  GE.stamp = function (result) {
    var cls = result === 'PASS' ? 'pass' : result === 'FAIL' ? 'fail' : 'known';
    return GE.h('span', { class: 'stamp ' + cls, text: result });
  };
  /** "Can you say why?" After a PASS, the learner selects the reason for one answer.
      A correct answer is not the same as a correct reason (self-explanation; Chi et al. 1989).
      options: [{text, correct, why}]. The order is shuffled. Feedback uses words, not colour. */
  GE.whyCheck = function (question, options, seed) {
    var h = GE.h;
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var group = h('div', { class: 'chips why-options', role: 'group', 'aria-label': question });
    var list = GE.rng ? GE.rng(seed || 7).shuffle(options.slice()) : options.slice();
    list.forEach(function (o) {
      var b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: function () {
        [].forEach.call(group.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        GE.clear(out);
        out.appendChild(GE.stamp(o.correct ? 'PASS' : 'FAIL'));
        out.appendChild(document.createTextNode(' ' + o.why));
      } }, o.text);
      group.appendChild(b);
    });
    return h('div', { class: 'why-check' }, h('p', null, h('strong', null, 'Can you say why? '), question), group, out);
  };
  /** A group of buttons where exactly one is pressed. Returns {el, value, set}. */
  GE.segmented = function (label, options, value, onChange) {
    var el = GE.h('div', { class: 'seg', role: 'group', 'aria-label': label });
    var api = { el: el, value: value, set: set };
    function set(v, silent) {
      api.value = v;
      [].forEach.call(el.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); });
      if (!silent && onChange) onChange(v);
    }
    options.forEach(function (o) {
      var v = o.value != null ? o.value : o;
      el.appendChild(GE.h('button', { type: 'button', class: 'btn small', 'data-v': v, onclick: function () { set(v); } }, o.label || o));
    });
    set(value, true);
    return api;
  };
})(window.GE);
