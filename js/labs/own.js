/* own.js: the work with the learner's own material.
   - ownprompt (part 2): GE 08, exercise 2. The learner puts in a system prompt or a skill file,
     and gives each sentence that is a rule its correct location.
   - failures (part 8): four failure stories, as a gate.
   - takeaway (part 8): one page with the six sentences and the learner's own table.
   The text of the learner stays in this browser (localStorage). No part of it goes to a network. */
(function (GE) {
  'use strict';
  var h = GE.h;
  var TAGS = [
    { id: 'Node', help: 'A step that must occur: approval, tests, a review by a different agent.' },
    { id: 'Edge', help: 'A rule about the path: the sequence, a branch, the maximum number of attempts, the stop.' },
    { id: 'Gate', help: 'A rule about a permitted value, or a result that must have a check before a change.' },
    { id: 'Prompt', help: 'Content and voice: the words of a result. This stays with the model.' },
    { id: 'Not a rule', help: 'Context, a description, or an example.' }
  ];
  var MAX_ROWS = 40, MAX_CHARS = 20000;
  /* An example for a learner with no prompt at hand. It is an example by this edition. */
  var EXAMPLE = 'You are a support agent for a game store. Always be friendly and short. Never give a refund of more than the payment. Get approval from a team lead before you change an order. If a tool call fails, try again two times at most, then stop. The status of an order must be one of the values in the list. Do the tests before you say that the work is complete. The store sells digital games.';

  function sentences(text) {
    var out = [];
    String(text).slice(0, MAX_CHARS).split(/\n+/).forEach(function (line) {
      line = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
      (line.match(/[^.!?]+(?:[.!?]+|$)/g) || []).forEach(function (s) {
        s = s.trim();
        if (s.length >= 12 && /[A-Za-z]/.test(s)) out.push(s.length > 300 ? s.slice(0, 297) + '…' : s);
      });
    });
    return out.slice(0, MAX_ROWS);
  }
  GE.splitSentences = sentences;

  function load() {
    var saved = GE.store.get('ownprompt', null);
    if (!saved || !Array.isArray(saved.rows)) return [];
    return saved.rows.filter(function (r) { return r && typeof r.text === 'string'; }).slice(0, MAX_ROWS).map(function (r) { return { text: r.text.slice(0, 300), tag: typeof r.tag === 'string' ? r.tag : null }; });
  }
  function counts(rows) {
    var c = { Node: 0, Edge: 0, Gate: 0, Prompt: 0, 'Not a rule': 0, none: 0 };
    rows.forEach(function (r) { if (r.tag && c[r.tag] != null) c[r.tag]++; else c.none++; });
    return c;
  }
  GE.ownRows = load;

  GE.labs.ownprompt = function (el, chapter) {
    var rows = load();
    var area = h('textarea', { class: 'input', id: 'own-text', rows: 6, placeholder: 'Put the text of a system prompt or a skill file here.' });
    var list = h('div', { class: 'gate-assign own-rows' });
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var legend = h('dl', { class: 'kv own-legend' });
    TAGS.forEach(function (t) { legend.appendChild(h('dt', null, t.id)); legend.appendChild(h('dd', null, t.help)); });

    function save() { GE.store.set('ownprompt', { rows: rows }); }
    function summary() {
      if (!rows.length) { out.textContent = ''; return; }
      var c = counts(rows), moved = c.Node + c.Edge + c.Gate;
      GE.clear(out);
      if (c.none) { out.textContent = c.none + ' of ' + rows.length + ' sentences have no location. Select a location for each sentence.'; return; }
      out.appendChild(h('strong', null, moved + ' of ' + rows.length + ' sentences are rules that can be structure: ' + c.Node + ' as a node, ' + c.Edge + ' on an edge, ' + c.Gate + ' at a gate. '));
      out.appendChild(document.createTextNode(moved
        ? 'While such a rule is a sentence in the prompt, it is a suggestion. ' + (c.Prompt === 1 ? '1 sentence stays' : c.Prompt + ' sentences stay') + ' in the prompt. Part 8 shows this table again, as your first work list.'
        : 'This text has no rule about approval, cost, safety or permitted values. Try a prompt of an agent that changes something.'));
      GE.trace.lab('ownprompt', chapter);
    }
    function paint() {
      GE.clear(list);
      rows.forEach(function (r, i) {
        var seg = GE.segmented('Location for sentence ' + (i + 1), TAGS.map(function (t) { return t.id; }), r.tag, function (v) { r.tag = v; save(); summary(); });
        list.appendChild(h('div', { class: 'row' }, h('span', null, r.text), seg.el));
      });
      list.hidden = !rows.length; legend.hidden = !rows.length; clear.hidden = !rows.length;
      summary();
    }
    function divide(text) {
      var parts = sentences(text);
      if (!parts.length) { out.textContent = 'The page found no sentence in this text. Put in some sentences of a prompt, each with 12 characters or more.'; return; }
      rows = parts.map(function (t) { return { text: t, tag: null }; });
      save(); paint();
      if (String(text).length > MAX_CHARS || parts.length === MAX_ROWS) out.textContent = 'The text is long. The table shows the first ' + rows.length + ' sentences.';
      var first = list.querySelector('button'); if (first) first.focus({ preventScroll: true });
    }
    var clear = h('button', { type: 'button', class: 'btn ghost', hidden: true, onclick: function () {
      rows = []; area.value = ''; save(); paint(); out.textContent = 'Your text is removed from this browser.'; area.focus();
    } }, 'Remove my text');
    el.appendChild(h('div', { class: 'field' }, h('label', { for: 'own-text' }, 'Your system prompt or skill file'), area));
    el.appendChild(h('div', { class: 'controls' },
      h('button', { type: 'button', class: 'btn', onclick: function () { divide(area.value); } }, 'Divide into sentences'),
      h('button', { type: 'button', class: 'btn ghost', onclick: function () { area.value = EXAMPLE; divide(EXAMPLE); } }, 'Use an example prompt'),
      clear));
    el.appendChild(h('p', { class: 'small muted' }, 'Do not put in passwords or personal data. The text stays in this browser, and “Remove my text” or “New run” removes it.'));
    el.appendChild(legend);
    el.appendChild(list);
    el.appendChild(out);
    paint();
  };

  GE.labs.failures = function (el) {
    GE.gate(el, '8s', GE.data.gates['8s']);
  };

  GE.labs.takeaway = function (el) {
    var box = h('div', { class: 'takeaway-body' });
    function render() {
      GE.clear(box);
      box.appendChild(h('h3', null, 'The session in six sentences'));
      var ol = h('ol');
      GE.data.reference.sixSentences.forEach(function (s) { ol.appendChild(h('li', null, s)); });
      box.appendChild(ol);

      box.appendChild(h('h3', null, 'Your prompt: the rules to move first'));
      var rows = load().filter(function (r) { return r.tag === 'Node' || r.tag === 'Edge' || r.tag === 'Gate'; });
      if (!rows.length) box.appendChild(h('p', null, 'You did not put a prompt of your own into the table of part 2. ', h('a', { href: '#own-prompt' }, 'Do it now'), ': it is the exercise that the notes give for the end of the session.'));
      else {
        var body = h('tbody');
        rows.forEach(function (r) { body.appendChild(h('tr', null, h('td', null, r.text), h('td', null, r.tag), h('td', null, r.tag === 'Gate' ? 'Write the enumeration or the rule, and a validator function' : r.tag === 'Edge' ? 'Put the rule on an edge, in code' : 'Make the step a node that the run cannot go around'))); });
        box.appendChild(h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Rule in your prompt'), h('th', null, 'Correct location'), h('th', null, 'First step'))), body)));
      }

      box.appendChild(h('h3', null, 'The first hour'));
      box.appendChild(h('p', null, 'Find one rule in one prompt. Move that rule into an enumeration and a validator. Measure the variation before and after: do the same task ten times with the same input, and count the different paths and the different values.'));

      box.appendChild(h('h3', null, 'Your gates'));
      var gates = GE.store.gates(), gl = h('ul', { class: 'gate-list' }), any = false;
      ['1', '2', '3', '4', '5', '6', '7', '8', '8s'].forEach(function (k) {
        var g = gates[k]; if (!g) return; any = true;
        var name = k === '8s' ? 'Four failures' : k === '8' ? 'Capstone of part 8' : 'Gate of part ' + k;
        gl.appendChild(h('li', null, GE.stamp(g.status === 'PASS' ? 'PASS' : 'FAIL'), ' ', name, g.status === 'PASS' ? null : h('a', { class: 'gate-back', href: k === '8' || k === '8s' ? '#/8' : '#gate-' + k }, 'Try it again')));
      });
      box.appendChild(any ? gl : h('p', null, 'No gate has a result yet.'));
    }
    el.appendChild(box);
    el.appendChild(h('div', { class: 'controls' }, h('button', { type: 'button', class: 'btn', onclick: function () {
      document.documentElement.classList.add('print-one');
      var done = function () { document.documentElement.classList.remove('print-one'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 60000); // if the browser gives no afterprint event
    } }, 'Print this page')));
    render();
    var timer = null;
    GE.store.onChange(function () { if (!el.closest('.chapter').classList.contains('is-current')) return; clearTimeout(timer); timer = setTimeout(render, 300); });
    window.addEventListener('hashchange', function () { setTimeout(function () { if (el.closest('.chapter').classList.contains('is-current')) render(); }, 0); });
  };
})(window.GE);
