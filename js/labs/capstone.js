/* capstone.js: the instruments of part 8 (GE 08, section 7).
   - capstone: put the labels on the arrows of the full system. It is the gate of part 8.
   - recall: four questions in your own words, with your own mark.
   - trace: the run of the learner as a context graph, with the gates to try again. */
(function (GE) {
  'use strict';
  var h = GE.h;
  var MAX_ATTEMPTS = GE.MAX_ATTEMPTS || 2;

  var ARROWS = [
    { letter: 'A', key: 'KG>C', label: 'facts' },
    { letter: 'B', key: 'ONT>D', label: 'rules for the gate' },
    { letter: 'C', key: 'C>MEM', label: 'trace' },
    { letter: 'D', key: 'MEM>ONT', label: 'lessons' },
    { letter: 'E', key: 'D>E', label: 'PASS' },
    { letter: 'F', key: 'D>C', label: 'FAIL' }
  ];

  GE.labs.capstone = function (el, chapter) {
    var src = GE.data.graphs.system;
    var def = Object.assign({}, src, { edges: src.edges.map(function (e) {
      var a = ARROWS.filter(function (x) { return x.key === GE.edgeKey(e); })[0];
      return a ? Object.assign({}, e, { label: a.letter }) : e;
    }) });
    var view = GE.graphView(el, def);
    var attempts = 0;
    var labels = GE.rng(GE.newSeed()).shuffle(ARROWS.map(function (a) { return a.label; }));
    var out = h('div', { class: 'feedback', 'aria-live': 'polite' });
    var rows = h('div', { class: 'capstone-rows' });
    var selects = ARROWS.map(function (a) {
      var sel = h('select', { class: 'input', id: 'cap-' + a.letter }, h('option', { value: '' }, 'Select a label'));
      labels.forEach(function (l) { sel.appendChild(h('option', { value: l }, l)); });
      sel.addEventListener('change', function () { sel.classList.remove('is-wrong'); check.disabled = selects.some(function (s) { return !s.value; }); });
      rows.appendChild(h('div', { class: 'field' }, h('label', { for: 'cap-' + a.letter }, 'Arrow ', h('strong', { class: 'mono' }, a.letter)), sel));
      return sel;
    });
    function close(status) {
      selects.forEach(function (s, i) { s.value = ARROWS[i].label; s.disabled = true; s.classList.remove('is-wrong'); view.setEdgeLabel(ARROWS[i].key, ARROWS[i].label); });
      check.hidden = true; again.hidden = false; again.focus();
      GE.store.setGate('8', { status: status, results: [status], at: Date.now() });
      GE.trace.add('gate', '8', status);
      GE.trace.lab('capstone', chapter);
    }
    var check = h('button', { type: 'button', class: 'btn', disabled: true, onclick: function () {
      attempts++;
      var wrong = 0;
      var last = attempts >= MAX_ATTEMPTS;
      selects.forEach(function (s, i) {
        var bad = s.value !== ARROWS[i].label; if (bad) wrong++;
        s.classList.toggle('is-wrong', bad && last);
        var lab = s.parentNode.querySelector('label');
        var mark = lab.querySelector('.wrong-mark');
        if (bad && last && !mark) lab.appendChild(h('span', { class: 'wrong-mark' }, ' (not correct)'));
        if (!(bad && last) && mark) mark.remove();
      });
      GE.clear(out);
      if (!wrong) {
        out.appendChild(h('p', null, GE.stamp('PASS'), ' Each arrow has its label. You can read the full system: the graph sets the path, the knowledge graph gives the facts, the ontology gives the rules for the gate, and each run writes a trace that gives lessons.'));
        close('PASS');
        out.appendChild(GE.whyCheck('Why does arrow F (FAIL) go back to the agent step, and not to the end?', [
          { text: 'A rejected result is not a final result. The agent gets the reason and tries again, up to a maximum.', correct: true, why: 'Correct. The gate stops an incorrect change before it occurs, and gives the reason back. A maximum stops the loop.' },
          { text: 'Because the knowledge graph must be read again.', correct: false, why: 'Not the reason. Arrow A gives the facts. Arrow F carries the result of the gate.' },
          { text: 'Because each run must have the same number of steps.', correct: false, why: 'Not the reason. The number of steps can change between runs. The path that is permitted does not.' }
        ], 9));
      } else if (last) {
        out.appendChild(h('p', null, GE.stamp('FAIL'), ' Attempt ' + attempts + ' of ' + MAX_ATTEMPTS + ': not correct. This was the last attempt. The gate escalates: the drawing shows the worked answer. ', h('a', { class: 'gate-back', href: '#/0' }, 'Read the five steps of part 0 again')));
        close('ESCALATED');
      } else {
        out.appendChild(h('p', null, GE.stamp('FAIL'), ' Attempt ' + attempts + ' of ' + MAX_ATTEMPTS + ': not correct. ' + (wrong === 1 ? '1 of 6 arrows does' : wrong + ' of 6 arrows do') + ' not have the correct label.'));
        out.appendChild(h('p', null, h('strong', null, 'A hint. '), 'Start at the gate: it has two results, and one of them goes back. Then ask what the agent step gets, and what it writes.'));
      }
    } }, 'Send to the gate');
    var again = h('button', { type: 'button', class: 'btn ghost', hidden: true, onclick: function () {
      attempts = 0; again.hidden = true; check.hidden = false; check.disabled = true; GE.clear(out);
      rows.querySelectorAll('.wrong-mark').forEach(function (m) { m.remove(); });
      selects.forEach(function (s, i) { s.disabled = false; s.value = ''; s.classList.remove('is-wrong'); view.setEdgeLabel(ARROWS[i].key, ARROWS[i].letter); });
      selects[0].focus();
    } }, 'Try again');
    el.appendChild(rows);
    el.appendChild(h('div', { class: 'controls' }, check, again));
    el.appendChild(out);
    var saved = GE.store.gate('8');
    if (saved) out.appendChild(h('p', { class: 'small' }, 'Your last result at this gate: ', GE.stamp(saved.status === 'PASS' ? 'PASS' : 'FAIL'), saved.status === 'PASS' ? '' : ' (escalated)', '. You can do it again.'));
  };

  GE.labs.recall = function (el, chapter) {
    var stored = GE.store.get('recall', {});
    var saved = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    GE.data.reference.giveBack.forEach(function (qa, i) {
      var mine = saved[i] || {};
      var area = h('textarea', { class: 'input', id: 'rc-' + i, rows: 3 });
      area.value = typeof mine.text === 'string' ? mine.text : '';
      var answer = h('div', { class: 'recall-answer', hidden: !mine.shown }, h('p', { class: 'panel-title' }, 'The answer of the notes'), h('p', null, qa[1]));
      var mark = h('p', { class: 'small', 'aria-live': 'polite' }, mine.mark ? 'Your mark: ' + mine.mark + '.' : '');
      var compare = h('button', { type: 'button', class: 'btn', disabled: area.value.trim().length < 12 }, 'Compare with the notes');
      function save(patch) { saved[i] = Object.assign({}, saved[i], { text: area.value.slice(0, 2000) }, patch); GE.store.set('recall', saved); }
      area.addEventListener('input', function () { compare.disabled = area.value.trim().length < 12; });
      area.addEventListener('change', function () { save({}); });
      compare.addEventListener('click', function () { answer.hidden = false; answer.setAttribute('tabindex', '-1'); answer.focus({ preventScroll: true }); save({ shown: true }); GE.trace.lab('recall', chapter); });
      var marks = h('div', { class: 'controls' });
      ['I had the idea', 'A part of the idea', 'Not yet'].forEach(function (m) {
        marks.appendChild(h('button', { type: 'button', class: 'btn ghost small', onclick: function () { save({ mark: m }); mark.textContent = 'Your mark: ' + m + '.' + (m === 'Not yet' ? ' Read the part again, then write your answer one more time.' : ''); } }, m));
      });
      answer.appendChild(h('p', { class: 'small' }, 'Compare the ideas, not the words. What is your mark?'));
      answer.appendChild(marks);
      el.appendChild(h('div', { class: 'recall' },
        h('div', { class: 'field' }, h('label', { for: 'rc-' + i, class: 'recall-q' }, (i + 1) + '. ' + qa[0]), area),
        h('div', { class: 'controls' }, compare), answer, mark));
    });
  };

  /* ---- The trace of the learner ----
     An instrument has a result that the page can examine. A figure is a drawing that you read. */
  var INSTRUMENTS = {
    sampler: 'Ask five times', compounding: 'The compounding machine', ledger: 'The decision ledger', colour: 'Give a type to each node', agentRun: 'Watch one run',
    decide: 'Script, loop, harness or graph?', ownprompt: 'Your own prompt', loan: 'The loan procedure', validator: 'The validator',
    workbench: 'The fact workbench', gates: 'The two-gate bench', reasoner: 'Infer, or reject?', planes: 'The planes',
    transitions: 'The permitted transitions', factory: 'The factory floor', walker: 'From the rule to its test', notecheck: 'The graph validator',
    baseline: 'The baseline', capstone: 'The capstone', recall: 'Four questions'
  };
  GE.instrumentNames = INSTRUMENTS;

  GE.labs.trace = function (el) {
    var box = h('div');
    el.appendChild(box);
    function render() {
      GE.clear(box);
      var events = GE.trace.all(), gates = GE.store.gates();
      var visits = events.filter(function (e) { return e && e.type === 'visit' && /^\d$/.test(e.ch); }).map(function (e) { return e.ch; });
      var visited = {}; visits.forEach(function (c) { visited[c] = true; });
      var usedEdge = {};
      for (var i = 1; i < visits.length; i++) usedEdge[visits[i - 1] + '>' + visits[i]] = true;
      var labs = {};
      events.forEach(function (e) { if (e && e.type === 'lab' && typeof e.detail === 'string') labs[e.detail.replace(/^factory:.*/, 'factory')] = true; });
      var parts = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
      var def = { w: 820, h: 96, label: 'The parts of the course as an execution graph, with your path.',
        nodes: parts.map(function (p, i) { var g = gates[p]; return { id: p, x: 52 + i * 89.5, y: 44, w: 70, label: 'Part ' + p, sub: p === '0' ? 'start' : g ? (g.status === 'PASS' ? 'gate: PASS' : 'gate: FAIL') : 'no gate result' }; }),
        edges: parts.slice(1).map(function (p, i) { return { from: parts[i], to: p }; }) };
      var view = GE.graphView(box, def, { minScale: 0.9 });
      parts.forEach(function (p) { view.mark(p, visited[p] ? 'done' : 'suggested', true); if (gates[p] && gates[p].status !== 'PASS') view.mark(p, 'failed', true); });
      def.edges.forEach(function (e) { view.markEdge(e.from + '>' + e.to, usedEdge[e.from + '>' + e.to] ? 'used' : 'unused', true); });

      var withGate = parts.slice(1);
      var pass = withGate.filter(function (p) { return gates[p] && gates[p].status === 'PASS'; }).length;
      var notPassed = withGate.filter(function (p) { return gates[p] && gates[p].status !== 'PASS'; });
      var names = Object.keys(INSTRUMENTS);
      var used = names.filter(function (n) { return labs[n]; });
      box.appendChild(h('div', { class: 'readouts' },
        h('div', { class: 'readout' }, h('b', null, Object.keys(visited).length + ' of 9'), h('span', null, 'parts that you opened')),
        h('div', { class: 'readout' }, h('b', null, pass + ' of 8'), h('span', null, 'gates with PASS')),
        h('div', { class: 'readout' }, h('b', null, String(notPassed.length)), h('span', null, 'gates that escalated')),
        h('div', { class: 'readout' }, h('b', null, used.length + ' of ' + names.length), h('span', null, 'instruments that you completed'))));

      if (notPassed.length) {
        box.appendChild(h('p', { class: 'panel-title' }, 'Gates to try again'));
        var ul = h('ul', { class: 'gate-list' });
        notPassed.forEach(function (p) {
          ul.appendChild(h('li', null, GE.stamp('FAIL'), ' The gate of part ' + p + ' escalated. ', h('a', { class: 'gate-back', href: p === '8' ? '#/8' : '#gate-' + p }, 'Try it again')));
        });
        box.appendChild(ul);
      }
      box.appendChild(h('dl', { class: 'kv' },
        h('dt', null, 'Path of your run'), h('dd', { class: 'mono' }, visits.join(' → ') || 'no part yet'),
        h('dt', null, 'Parts that you did not open'), h('dd', null, parts.filter(function (p) { return !visited[p]; }).map(function (p) { return 'part ' + p; }).join(', ') || 'none'),
        h('dt', null, 'Gates with no result'), h('dd', null, withGate.filter(function (p) { return !gates[p]; }).map(function (p) { return 'part ' + p; }).join(', ') || 'none'),
        h('dt', null, 'Instruments that you did not complete'), h('dd', null, names.filter(function (n) { return !labs[n]; }).map(function (n) { return INSTRUMENTS[n]; }).join(', ') || 'none')));
      box.appendChild(h('p', { class: 'small muted' }, 'The thick arrows are the steps from one part to the next that your run used. A part or an instrument that you did not use has no evidence from your run. This course does not stop you at a gate with a FAIL result: it records the result and shows it here. A gate in a real system stops the result. The trace is only in this browser, and “New run” removes it.'));
    }
    render();
    var timer = null;
    GE.store.onChange(function () { if (!el.closest('.chapter').classList.contains('is-current')) return; clearTimeout(timer); timer = setTimeout(render, 400); });
  };
})(window.GE);
