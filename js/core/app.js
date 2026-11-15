/* app.js: starts the page. Router (one chapter at a time), path rail, theme,
   source links, and the start of each instrument when its chapter opens.
   Load this file last. */
(function (GE) {
  'use strict';
  var root = document.documentElement;
  var chapters = [].slice.call(document.querySelectorAll('.chapter'));
  var railItems = [].slice.call(document.querySelectorAll('.rail li'));
  var where = document.querySelector('.top-where');
  var started = {};

  /* ---- Source links: each chip opens the note in Obsidian. ---- */
  function linkSources(scope) {
    [].forEach.call(scope.querySelectorAll('a.src[data-n]'), function (a) {
      var note = GE.data.notes[a.dataset.n];
      if (!note) return;
      a.href = GE.data.noteBase + note.page;
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = 'Open the source note: ' + note.file;
    });
  }

  /* ---- Citations: <a class="cite" data-ref="id"></a> becomes a numbered link to the row of the source
     on the reference shelf. The number is the place of the source in GE.data.reference.sources. ---- */
  function linkCitations(scope) {
    var list = (GE.data.reference && GE.data.reference.sources) || [];
    [].forEach.call(scope.querySelectorAll('a.cite[data-ref]'), function (a) {
      var i = -1;
      list.some(function (s, k) { if (s[4] === a.dataset.ref) { i = k; return true; } return false; });
      if (i < 0) { console.warn('No source with the id', a.dataset.ref); return; }
      a.textContent = String(i + 1);
      a.href = '#ref-' + a.dataset.ref;
      a.title = list[i][2] + '. ' + list[i][0];
      a.setAttribute('aria-label', 'Source ' + (i + 1) + ': ' + list[i][2]);
      // The table of sources is made when the reference shelf first opens. Open it, then go to the row.
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        location.hash = '#/ref';
        setTimeout(function () {
          var row = document.getElementById('ref-' + a.dataset.ref);
          if (row) { row.scrollIntoView({ block: 'center' }); row.focus({ preventScroll: true }); }
        }, 60);
      });
    });
  }
  GE.linkCitations = linkCitations;

  /* ---- Instruments: an element with data-lab starts once, when its chapter is first shown. ---- */
  function startLabs(section) {
    var key = section.dataset.chapter;
    if (started[key]) return;
    started[key] = true;
    [].forEach.call(section.querySelectorAll('[data-lab]'), function (el) {
      var make = GE.labs[el.dataset.lab];
      if (!make) return;
      // data-keep: the instrument adds to the HTML that is there (the HTML is the version with no JavaScript).
      try { if (!el.hasAttribute('data-keep')) GE.clear(el); make(el, key); }
      catch (err) {
        console.error('Instrument "' + el.dataset.lab + '" did not start.', err);
        GE.clear(el).appendChild(GE.h('p', { class: 'small' }, GE.stamp('FAIL'), ' This instrument did not start. The text of this part gives the same content.'));
      }
    });
    [].forEach.call(section.querySelectorAll('[data-gate]'), function (el) {
      var def = GE.data.gates[el.dataset.gate];
      if (!def) return;
      try { GE.clear(el); GE.gate(el, el.dataset.gate, def); }
      catch (err) { console.error('The gate of part ' + el.dataset.gate + ' did not start.', err); }
    });
  }

  /* ---- Router ---- */
  function keyFromHash() {
    var m = /^#\/([\w-]+)/.exec(location.hash);
    var key = m ? m[1] : null;
    if (key && chapters.some(function (c) { return c.dataset.chapter === key; })) return key;
    return null;
  }
  function show(key, moveFocus) {
    if (GE.pauseAll) GE.pauseAll();
    chapters.forEach(function (c) { c.classList.toggle('is-current', c.dataset.chapter === key); });
    var section = chapters.filter(function (c) { return c.dataset.chapter === key; })[0];
    railItems.forEach(function (li) {
      var on = li.dataset.ch === key;
      li.classList.toggle('current', on);
      var a = li.querySelector('a');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      // On a narrow screen the rail is a row that scrolls: keep the current part in view.
      if (on) { var rail = li.closest('.rail'); if (rail.scrollWidth > rail.clientWidth) rail.scrollLeft = li.offsetLeft - rail.clientWidth / 2 + li.offsetWidth / 2; }
    });
    var title = section.querySelector('h1').textContent;
    document.title = title + ' · Permitted Paths: Graph Engineering for Agents';
    if (where) {
      // The locator: a small number ("02 / 08", "Lab", "Studio", "Shelf") and the title of the part.
      var no = /^\d$/.test(key) ? '0' + key + ' / 08' : key === 'lab' ? 'Lab' : key === 'studio' ? 'Studio' : 'Shelf';
      GE.clear(where);
      where.appendChild(GE.h('span', { class: 'top-no' }, no));
      where.appendChild(GE.h('span', { class: 'top-title' }, title));
    }
    startLabs(section);
    if (key !== '0') GE.store.set('last', key);
    GE.trace.add('visit', key);
    gateNotice(section, key);
    paintRail();
    window.scrollTo(0, 0);
    if (moveFocus) { var h1 = section.querySelector('h1'); h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }
  function onRoute(moveFocus) {
    var key = keyFromHash();
    if (!key) {
      // A link to an element inside a chapter (for example a glossary term): open its chapter.
      var target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
      var owner = target && target.closest('.chapter');
      if (owner) {
        show(owner.dataset.chapter, false); target.scrollIntoView();
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        return;
      }
      // A target outside the chapters (the skip link goes to <main>): stay on this chapter.
      if (target && document.querySelector('.chapter.is-current')) {
        var h1 = document.querySelector('.chapter.is-current h1');
        h1.setAttribute('tabindex', '-1'); h1.focus();
        return;
      }
      key = '0';
    }
    show(key, moveFocus);
  }

  /* A gate that escalated has an edge back: the next part shows it. */
  function gateNotice(section, key) {
    var old = section.querySelector('.gate-notice'); if (old) old.remove();
    var prev = /^[2-8]$/.test(key) ? String(+key - 1) : null;
    var g = prev && GE.store.gate(prev);
    if (!g || g.status === 'PASS') return;
    var note = GE.h('p', { class: 'callout note gate-notice' }, GE.stamp('FAIL'), ' The gate of part ' + prev + ' escalated. This course does not stop you, but a gate in a real system does. ', GE.h('a', { href: '#gate-' + prev }, 'Go back and try the gate again'), '.');
    var head = section.querySelector('.ch-head');
    head.parentNode.insertBefore(note, head.nextSibling);
  }

  /* The opener of each part: where the part is on the path (a row of nine marks), and the number
     that the figures of the part use ("Fig. 2.3"). The text of the kicker is a CSS string, so the
     search index and a screen reader do not read it two times. */
  function dressChapters() {
    chapters.forEach(function (c) {
      var key = c.dataset.chapter, head = c.querySelector('.ch-head'), h1 = head && head.querySelector('h1');
      c.style.setProperty('--ch-dot', '"' + (/^\d$/.test(key) ? key : key === 'lab' ? 'L' : key === 'studio' ? 'S' : 'R') + '."');
      if (!h1 || !/^\d$/.test(key) || head.querySelector('.ch-kicker')) return;
      var path = GE.h('span', { class: 'ch-path' });
      for (var k = 0; k <= 8; k++) path.appendChild(GE.h('i', { class: k < +key ? 'on' : k === +key ? 'now' : null }));
      head.insertBefore(GE.h('p', { class: 'ch-kicker', 'aria-hidden': 'true', 'data-k': key === '0' ? 'A course in nine parts' : 'Part ' + key + ' of 8' }, path), h1);
    });
  }

  function paintRail() {
    var visited = {}, furthest = 0;
    GE.trace.all().forEach(function (e) { if (e.type === 'visit') visited[e.ch] = true; });
    // The ink part of the path line: to the last part that the learner opened.
    railItems.forEach(function (li, k) { if (visited[li.dataset.ch] || li.classList.contains('current')) furthest = k; });
    var rail = document.querySelector('.rail');
    if (rail && railItems.length > 1) rail.style.setProperty('--progress', String(furthest / (railItems.length - 1)));
    railItems.forEach(function (li) {
      li.classList.toggle('visited', !!visited[li.dataset.ch]);
      var g = GE.store.gate(li.dataset.ch);
      if (g) li.setAttribute('data-gate', g.status); else li.removeAttribute('data-gate');
      var label = li.querySelector('.rail-state');
      if (label) label.textContent = g ? ' (gate: ' + (g.status === 'PASS' ? 'PASS' : 'escalated') + ')' : '';
    });
  }

  /* ---- Theme ---- */
  function applyTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') theme = null;
    if (theme) root.setAttribute('data-theme', theme); else root.removeAttribute('data-theme');
    var dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    var btn = document.getElementById('theme-toggle');
    if (btn) { btn.dataset.dark = String(dark); btn.textContent = dark ? 'Paper' : 'Blueprint'; btn.setAttribute('aria-label', dark ? 'Use the light paper theme' : 'Use the dark blueprint theme'); }
  }
  function initTheme() {
    var theme = null;
    try { theme = localStorage.getItem('permitted-paths.theme'); } catch (e) { /* no storage */ }
    applyTheme(theme);
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var next = btn.dataset.dark === 'true' ? 'light' : 'dark';
      try { localStorage.setItem('permitted-paths.theme', next); } catch (e) { /* no storage */ }
      if (document.startViewTransition && !GE.reduced()) {
        var vt = document.startViewTransition(function () { applyTheme(next); });
        [vt.ready, vt.finished, vt.updateCallbackDone].forEach(function (p) { if (p && p.catch) p.catch(function () {}); });
      }
      else applyTheme(next);
    });
  }

  function initReset() {
    var btn = document.getElementById('new-run');
    if (!btn) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      if (!window.confirm('Start a new run? This removes your answers, your gate results and your trace from this browser.')) return;
      GE.store.reset();
      location.hash = '#/0';
      location.reload();
    });
  }

  /* ---- Parts menu: on a narrow screen the rail is a sheet that this button opens. ---- */
  function initRailMenu() {
    var btn = document.getElementById('rail-toggle'), rail = document.getElementById('rail');
    if (!btn || !rail) return;
    btn.hidden = false;
    function set(open) {
      rail.classList.toggle('open', open);
      root.classList.toggle('rail-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Close' : 'Parts';
      if (open) { var cur = rail.querySelector('[aria-current]') || rail.querySelector('a'); if (cur) cur.focus({ preventScroll: true }); }
    }
    btn.addEventListener('click', function () { set(!rail.classList.contains('open')); });
    rail.addEventListener('click', function (ev) { if (ev.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && rail.classList.contains('open')) { set(false); btn.focus(); } });
    window.addEventListener('hashchange', function () { set(false); });
    window.matchMedia('(min-width: 56.01rem)').addEventListener('change', function (m) { if (m.matches) set(false); });
  }

  /* ---- Start ---- */
  root.classList.add('js');
  try { dressChapters(); } catch (err) { console.error('The openers of the parts did not start.', err); }
  try { linkCitations(document); } catch (err) { console.error('The citations did not start.', err); }
  try { linkSources(document); } catch (err) { console.error('The source links did not start.', err); }
  initTheme();
  initReset();
  initRailMenu();
  try { GE.searchBox = GE.search(); } catch (err) { console.error('The search did not start.', err); }
  GE.store.onChange(paintRail);
  window.addEventListener('beforeprint', function () { if (!root.classList.contains('print-one')) chapters.forEach(startLabs); });
  window.addEventListener('hashchange', function () { onRoute(true); });
  // Continue where the learner stopped, if the address has no chapter.
  if (!location.hash) {
    var last = GE.store.get('last', '0');
    if (last !== '0' && chapters.some(function (c) { return c.dataset.chapter === last; })) { var resume = document.getElementById('resume'); if (resume) { resume.hidden = false; resume.querySelector('a').href = '#/' + last; } }
  }
  onRoute(false);
})(window.GE);
