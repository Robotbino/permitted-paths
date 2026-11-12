/* search.js: find a section, an instrument or a glossary term in the full course.
   The index is made from the page text when the search first opens. Text that only an instrument makes is not in it.
   Open with the Search button, "/" or Ctrl+K. Load this file before app.js: the router opens each result. */
(function (GE) {
  'use strict';
  var h = GE.h;
  var index = null;
  var MAX = 30;

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function slug(s) { return norm(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50); }
  /* The text of an element, with a space between blocks and table cells (textContent joins them). */
  function textOf(el) {
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) if (!w.currentNode.parentNode.closest('script, style, svg')) out.push(w.currentNode.nodeValue);
    return norm(out.join(' '));
  }
  var SKIP = { a: 1, an: 1, the: 1, to: 1, of: 1, and: 1, or: 1, in: 1, on: 1, is: 1, it: 1, for: 1, with: 1, by: 1, at: 1, as: 1, be: 1, do: 1, i: 1 };
  /* The words of a question. Small common words are not used, except when they are the full question. */
  function wordsOf(q) {
    var all = q.toLowerCase().split(/[^a-z0-9%#+-]+/).filter(Boolean);
    var main = all.filter(function (w) { return !SKIP[w]; });
    return main.length ? main : all;
  }
  function esc(w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /* A word matches at the start of a word: "case" finds "cases", but "to" does not find "ontology". */
  function wordRe(w, flags) { return new RegExp('(^|[^a-z0-9])' + esc(w), flags || ''); }

  function partName(ch) {
    var key = ch.dataset.chapter, t = norm(ch.querySelector('h1').textContent);
    return /^\d$/.test(key) ? 'Part ' + key + ' · ' + t : t;
  }

  /* One entry for each part, each h2 and each instrument. The text of an h2 entry is the text up to the next h2. */
  function build() {
    var out = [];
    [].forEach.call(document.querySelectorAll('.chapter'), function (ch) {
      var part = partName(ch);
      var head = ch.querySelector('.ch-head'), lede = ch.querySelector('.lede');
      out.push({ title: norm(ch.querySelector('h1').textContent), part: part, kind: 'Part', href: '#/' + ch.dataset.chapter,
        text: norm((head ? textOf(head) : '') + ' ' + (lede ? textOf(lede) : '')) });
      [].forEach.call(ch.querySelectorAll('h2[id]'), function (h2) {
        var text = '', n = h2.nextElementSibling;
        while (n && n.tagName !== 'H2') {
          if (!n.matches('script, svg, [data-lab]')) text += ' ' + textOf(n);
          n = n.nextElementSibling;
        }
        out.push({ title: norm(h2.textContent), part: part, kind: 'Section', href: '#' + h2.id, text: norm(text) });
      });
      [].forEach.call(ch.querySelectorAll('figure.bench'), function (fig) {
        var t = fig.querySelector('.bench-title');
        if (!t) return;
        if (!fig.id) fig.id = 'i-' + slug(t.textContent);
        var task = fig.querySelector('.bench-task');
        out.push({ title: norm(t.textContent), part: part, kind: 'Instrument', href: '#' + fig.id, text: task ? textOf(task) : '' });
      });
    });
    var gl = (GE.data.reference && GE.data.reference.glossary) || [];
    gl.forEach(function (g) { out.push({ title: g[0], part: 'Glossary', kind: 'Term', href: '#glossary', text: g[1] }); });
    out.forEach(function (e) { e.lt = e.title.toLowerCase(); e.lx = e.text.toLowerCase(); });
    return out;
  }

  /* Each word of the question must be in the title or the text. A word in the title counts more. */
  function find(q) {
    var words = wordsOf(q);
    if (!words.length) return [];
    var tests = words.map(function (w) { return { w: w, one: wordRe(w), all: wordRe(w, 'g') }; });
    var res = [];
    index.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < tests.length; i++) {
        var t = tests[i], inT = t.one.test(e.lt), inX = t.one.test(e.lx);
        if (!inT && !inX) return;
        score += (inT ? 10 : 0) + (inX ? 1 + Math.min(4, (e.lx.match(t.all) || []).length) : 0);
        if (e.lt.indexOf(t.w) === 0) score += 5;
      }
      if (e.kind === 'Part') score += 2;
      res.push({ e: e, score: score });
    });
    return res.sort(function (a, b) { return b.score - a.score; }).slice(0, MAX).map(function (r) { return r.e; });
  }

  /* Text with each word of the question in <mark>, where it starts a word. DOM nodes only, no HTML from strings. */
  function marked(text, words) {
    var frag = document.createDocumentFragment();
    if (!words.length) { frag.appendChild(document.createTextNode(text)); return frag; }
    var r = new RegExp('(^|[^A-Za-z0-9])(' + words.map(esc).join('|') + ')', 'ig'), last = 0, m;
    while ((m = r.exec(text))) {
      var at = m.index + m[1].length;
      if (at > last) frag.appendChild(document.createTextNode(text.slice(last, at)));
      frag.appendChild(h('mark', null, m[2]));
      last = at + m[2].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function snippet(e, words) {
    var at = -1;
    words.forEach(function (w) { var m = wordRe(w).exec(e.lx); var i = m ? m.index + m[1].length : -1; if (i >= 0 && (at < 0 || i < at)) at = i; });
    if (at < 0) return e.text.slice(0, 140) + (e.text.length > 140 ? '…' : '');
    var s = Math.max(0, at - 50), t = e.text.slice(s, s + 160);
    return (s ? '…' : '') + t + (s + 160 < e.text.length ? '…' : '');
  }

  GE.search = function () {
    var input = h('input', { type: 'search', id: 'search-q', autocomplete: 'off', spellcheck: 'false', placeholder: 'For example: when to use a graph', 'aria-controls': 'search-results', 'aria-describedby': 'search-count' });
    var list = h('ol', { class: 'search-results', id: 'search-results', role: 'listbox', 'aria-label': 'Results' });
    var count = h('p', { class: 'small muted search-count', id: 'search-count', 'aria-live': 'polite' });
    var dlg = h('dialog', { class: 'search-dialog', 'aria-label': 'Search the course' },
      h('div', { class: 'search-head' }, h('label', { for: 'search-q', class: 'vh' }, 'Search the course'), input,
        h('button', { type: 'button', class: 'btn ghost small', onclick: function () { dlg.close(); } }, 'Close')),
      count, list);
    document.body.appendChild(dlg);
    var items = [], sel = -1;

    function select(i) {
      if (!items.length) return;
      sel = (i + items.length) % items.length;
      items.forEach(function (li, j) { li.setAttribute('aria-selected', String(j === sel)); });
      items[sel].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', items[sel].id);
    }
    function go(e) {
      dlg.close();
      if (location.hash === e.href) { var t = document.getElementById(e.href.slice(1)); if (t) t.scrollIntoView(); }
      else location.hash = e.href;
    }
    function render() {
      var q = input.value.trim(), words = wordsOf(q);
      GE.clear(list); items = []; sel = -1; input.removeAttribute('aria-activedescendant');
      if (!q) { count.textContent = 'Type a word. Results show parts, sections, instruments and glossary terms.'; return; }
      var res = find(q);
      count.textContent = res.length ? res.length + (res.length === MAX ? '+' : '') + (res.length === 1 ? ' result' : ' results') : 'No results for “' + q + '”. Try one word, or a different word.';
      res.forEach(function (e, i) {
        var li = h('li', { role: 'option', id: 'sr-' + i, 'aria-selected': 'false', onclick: function () { go(e); }, onmousemove: function () { if (sel !== i) select(i); } },
          h('span', { class: 'sr-meta' }, h('span', { class: 'sr-kind' }, e.kind), ' ', e.part),
          h('span', { class: 'sr-title' }, marked(e.title, words)),
          h('span', { class: 'sr-text' }, marked(snippet(e, words), words)));
        list.appendChild(li); items.push(li);
      });
      if (items.length) select(0);
    }
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); select(sel + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); select(sel - 1); }
      else if (ev.key === 'Enter' && sel >= 0) { ev.preventDefault(); items[sel].click(); }
    });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); }); // a click outside the box

    function open() {
      if (!index) index = build();
      if (!dlg.open) dlg.showModal();
      input.select(); render();
    }
    var btn = document.getElementById('search-open');
    if (btn) { btn.hidden = false; btn.addEventListener('click', open); }
    document.addEventListener('keydown', function (ev) {
      var a = document.activeElement, typing = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
      if ((ev.key === 'k' && (ev.ctrlKey || ev.metaKey)) || (ev.key === '/' && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey)) { ev.preventDefault(); open(); }
    });
    return { open: open, find: function (q) { if (!index) index = build(); return find(q); } };
  };
})(window.GE);
