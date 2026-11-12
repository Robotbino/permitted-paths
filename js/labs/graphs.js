/* graphs.js (labs): the instruments of part 3.
   - lenses: one loan application as four types of graph (GE 03, section 1).
   - loan: the loan procedure as a procedural graph, with path coverage (GE 03, section 5). */
(function (GE) {
  'use strict';
  var h = GE.h, s = GE.s;

  /* Each lens puts the same six node slots in a different position, with a different meaning.
     The entities of the knowledge lens and the run of the context lens are examples by this edition. */
  var LENSES = [
    { id: 'execution', name: 'Execution graph', about: 'control', question: 'What comes next?', nodesAre: 'Units of work',
      life: 'The design is permanent. Each run is one pass through it.',
      note: 'The design has all the permitted branches. This drawing shows one pass through it: the path of this application. The runtime enforces the design as code.',
      nodes: [['Application', 90, 80, ''], ['Policy rules', 305, 80, 'code'], ['Decision model', 560, 80, 'model'], ['Router', 560, 220, 'code'], ['Write the report', 305, 220, 'agent'], ['End', 90, 220, '']],
      edges: [[0, 1], [1, 2, 'no rule decides'], [2, 3], [3, 4, 'no person'], [4, 5]] },
    { id: 'knowledge', name: 'Knowledge graph', about: 'data', question: 'What is in the domain?', nodesAre: 'Entities, for example a customer or a file',
      life: 'Continues across runs',
      note: 'No node here is a step. Each node is a thing in the domain, and each arrow is a relation.',
      nodes: [['Applicant', 110, 70, ''], ['Application', 380, 70, ''], ['Policy rule', 650, 70, ''], ['Older case', 110, 230, ''], ['Loan', 380, 230, ''], ['Decision', 650, 230, '']],
      edges: [[0, 1, 'makes'], [1, 2, 'is examined with'], [0, 3, 'has'], [1, 4, 'is for'], [1, 5, 'gets']] },
    { id: 'context', name: 'Context graph', about: 'data', question: 'What occurred in this run?', nodesAre: 'Steps, tool calls, the records that the run used',
      life: 'Permanent. Each run adds a trace.',
      note: 'This is a graph of traces. It is not the context window of a model. It shows the cause of a decision, but only after the run.',
      nodes: [['Run 12', 82, 150, ''], ['Step: policy rules', 280, 70, 'code'], ['Tool call: get cases', 280, 230, 'code'], ['Record: older case', 500, 230, ''], ['Step: decision model', 500, 70, 'model'], ['Step: report', 682, 150, 'agent']],
      edges: [[0, 1, 'did'], [0, 2, 'did'], [2, 3, 'used'], [3, 4, 'was input for'], [4, 5]] },
    { id: 'procedural', name: 'Procedural graph', about: 'control', question: 'Which paths are permitted for the task?', nodesAre: 'Steps of a procedure',
      life: 'Permanent. Many runs use it again.',
      note: 'All the permitted branches are here, not one pass. A harness loads this graph as data, as a skill.',
      nodes: [['Policy rules', 84, 150, 'code'], ['Automatic decision', 300, 56, 'code'], ['Decision model', 290, 244, 'model'], ['Router', 480, 244, 'code'], ['Review by a person', 680, 150, 'person'], ['Write the report', 680, 262, 'agent']],
      edges: [[0, 1, 'a rule decides'], [0, 2, 'no rule decides'], [2, 3], [3, 4, 'yes'], [3, 5, 'no']] }
  ];
  var W = 146, H = 42;

  GE.labs.lenses = function (el, chapter) {
    var svg = s('svg', { class: 'gv lens-svg', viewBox: '0 0 760 300', role: 'img' });
    svg.style.minWidth = '560px';
    svg.appendChild(s('defs', null, s('marker', { id: 'lens-a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto', markerUnits: 'userSpaceOnUse' }, s('path', { class: 'gv-arrow', d: 'M0 0L10 5L0 10z' }))));
    var gEdges = s('g', { class: 'lens-edges' }), gNodes = s('g');
    svg.appendChild(gEdges); svg.appendChild(gNodes);
    var slots = [], current = null, moving = null;
    for (var i = 0; i < 6; i++) {
      var g = s('g', { class: 'gv-node plain' },
        s('rect', { class: 'shape2', x: -W / 2 - 4, y: -H / 2 - 4, width: W + 8, height: H + 8, rx: 6 }),
        s('rect', { class: 'shape', x: -W / 2, y: -H / 2, width: W, height: H, rx: 3 }), s('text', { class: 'lbl' }));
      gNodes.appendChild(g);
      slots.push({ g: g, text: g.querySelector('text'), x: 380, y: 150 });
    }
    function place(slot) { slot.g.setAttribute('transform', 'translate(' + slot.x + ',' + slot.y + ')'); }
    function dress(lens) {
      lens.nodes.forEach(function (n, i) {
        slots[i].text.textContent = n[0];
        slots[i].g.setAttribute('class', 'gv-node ' + (n[3] || 'plain'));
      });
    }
    function drawEdges(lens) {
      GE.clear(gEdges);
      lens.edges.forEach(function (e) {
        var a = lens.nodes[e[0]], b = lens.nodes[e[1]];
        var dx = b[1] - a[1], dy = b[2] - a[2];
        // Stop the line at the border of each rectangle.
        var t = Math.min(dx ? (W / 2 + 5) / Math.abs(dx) : Infinity, dy ? (H / 2 + 5) / Math.abs(dy) : Infinity);
        var x1 = a[1] + dx * t, y1 = a[2] + dy * t, x2 = b[1] - dx * t, y2 = b[2] - dy * t;
        var g = s('g', { class: 'gv-edge fixed' }, s('path', { d: 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2, 'marker-end': 'url(#lens-a)' }));
        if (e[2]) g.appendChild(s('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 8 }, e[2]));
        gEdges.appendChild(g);
      });
    }
    var info = h('div', { class: 'panel lens-info', 'aria-live': 'polite' });
    function describe(lens) {
      GE.clear(info);
      info.appendChild(h('p', { class: 'panel-title' }, lens.name + ' ', h('span', { class: 'stamp none' }, 'about ' + lens.about)));
      info.appendChild(h('dl', { class: 'kv' },
        h('dt', null, 'Question'), h('dd', null, lens.question),
        h('dt', null, 'Nodes are'), h('dd', null, lens.nodesAre),
        h('dt', null, 'Life'), h('dd', null, lens.life)));
      info.appendChild(h('p', { class: 'small' }, lens.note));
      svg.setAttribute('aria-label', lens.name + ' of one loan application. ' + lens.note);
    }
    function show(id) {
      var lens = LENSES.filter(function (l) { return l.id === id; })[0];
      if (moving) moving.cancel();
      describe(lens);
      if (!current) {
        lens.nodes.forEach(function (n, i) { slots[i].x = n[1]; slots[i].y = n[2]; place(slots[i]); });
        dress(lens); drawEdges(lens); current = lens; return;
      }
      var from = slots.map(function (sl) { return [sl.x, sl.y]; });
      var swapped = false;
      gEdges.style.opacity = 0;
      moving = GE.motion.tween({ ms: 460, ease: 'move', update: function (k) {
        lens.nodes.forEach(function (n, i) {
          slots[i].x = from[i][0] + (n[1] - from[i][0]) * k; slots[i].y = from[i][1] + (n[2] - from[i][1]) * k; place(slots[i]);
        });
        if (!swapped && k >= 0.5) { swapped = true; dress(lens); }
        if (k >= 1) { drawEdges(lens); gEdges.style.opacity = 1; }
      } });
      current = lens;
      GE.trace.lab('lenses', chapter);
    }
    var seg = GE.segmented('Lens', LENSES.map(function (l) { return { value: l.id, label: l.name }; }), 'execution', show);
    el.appendChild(h('div', { class: 'controls' }, seg.el));
    el.appendChild(h('div', { class: 'split graph-split' }, h('div', { class: 'gv-wrap' }, svg), info));
    el.appendChild(GE.legend());
    show('execution');
  };

  /* ---- The loan procedure ---- */
  var CASES = [
    { id: 'a', label: 'A policy rule gives the loan', rule: 'give' },
    { id: 'b', label: 'A policy rule refuses the loan', rule: 'refuse' },
    { id: 'c', label: 'No rule decides. The risk is low.', rule: 'none', person: false, lintFails: 0 },
    { id: 'd', label: 'No rule decides. The risk tier is high.', rule: 'none', person: true, lintFails: 0 },
    { id: 'e', label: 'No rule decides. The report gets FAIL two times.', rule: 'none', person: false, lintFails: 2 }
  ];
  function loanGraph() {
    var def = GE.data.graphs.loan;
    var acts = {
      H: function (st, ctx) { return { writes: { rule_result: ctx.scenario.rule }, note: ctx.scenario.rule === 'none' ? 'The scripts examined the policy rules. The rules give no decision.' : 'A script examined the policy rules. A rule ' + (ctx.scenario.rule === 'give' ? 'gives' : 'refuses') + ' the loan.' }; },
      DM: function (st, ctx) { return { writes: { needs_person: ctx.scenario.person, risk_tier: ctx.scenario.person ? 'high' : 'low' }, note: 'The decision model gives the risk tier: ' + (ctx.scenario.person ? 'high' : 'low') + '.' }; },
      R: function (st) { return { note: 'A script reads the risk tier. A person is ' + (st.needs_person ? '' : 'not ') + 'necessary.' }; },
      RP: function (st) { return { writes: { report_attempts: (st.report_attempts || 0) + 1 }, note: 'The agent writes the report. Attempt ' + ((st.report_attempts || 0) + 1) + '.' }; },
      LN: function (st, ctx) { var ok = st.report_attempts > ctx.scenario.lintFails; return { writes: { lint: ok ? 'PASS' : 'FAIL' }, result: ok ? 'PASS' : 'FAIL', note: 'Check and lint: ' + (ok ? 'PASS' : 'FAIL') + '.' }; },
      AP: function () { return { note: 'Automatic approval. No model made this decision.' }; },
      DN: function () { return { note: 'Automatic refusal. No model made this decision.' }; },
      HU: function () { return { note: 'A person does the review.' }; }
    };
    var when = {
      'H>AP': function (st) { return st.rule_result === 'give'; }, 'H>DN': function (st) { return st.rule_result === 'refuse'; },
      'R>HU': function (st) { return st.needs_person; },
      'LN>E': function (st) { return st.lint === 'PASS'; }, 'LN>HU': function (st) { return st.report_attempts >= 2; }
    };
    // The sequence of the edges is the sequence of the checks: the edges with a condition come first.
    var order = ['H>AP', 'H>DN', 'H>DM', 'R>HU', 'R>RP', 'LN>E', 'LN>HU', 'LN>RP'];
    var edges = def.edges.map(function (e) { return { from: e.from, to: e.to, when: when[GE.edgeKey(e)] }; });
    edges.sort(function (a, b) { var i = order.indexOf(GE.edgeKey(a)), j = order.indexOf(GE.edgeKey(b)); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    return {
      start: 'A', edges: edges,
      owners: { rule_result: 'H', needs_person: 'DM', risk_tier: 'DM', report_attempts: 'RP', lint: 'LN' },
      nodes: def.nodes.map(function (n) { return { id: n.id, act: acts[n.id] }; })
    };
  }
  GE.loanGraph = loanGraph; GE.loanCases = CASES;

  GE.labs.loan = function (el, chapter) {
    var def = GE.data.graphs.loan;
    var graph = loanGraph();
    var used = {}, runs = 0, player = null;
    var types = {};
    def.nodes.forEach(function (n) { types[n.id] = n.type; });
    var host = h('div');
    var view = GE.graphView(host, def);
    var log = h('ol', { class: 'log', 'data-empty': 'No run yet. Send a case.', 'aria-live': 'polite' });
    var readouts = h('div', { class: 'readouts' });
    var verdict = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var buttons = [];

    function paintCoverage() {
      view.reset();
      view.edgeKeys().forEach(function (k) { view.markEdge(k, used[k] ? 'used' : 'unused', true); });
      var total = view.edgeKeys().length, n = Object.keys(used).length;
      GE.clear(readouts);
      readouts.appendChild(h('div', { class: 'readout' }, h('b', null, String(runs)), h('span', null, 'runs')));
      readouts.appendChild(h('div', { class: 'readout' }, h('b', null, n + ' of ' + total), h('span', null, 'branches that a run used')));
      readouts.appendChild(h('div', { class: 'readout' }, h('b', null, String(total - n)), h('span', null, 'branches with no evidence')));
    }
    function decidedBy(run) {
      if (run.path.indexOf('AP') >= 0 || run.path.indexOf('DN') >= 0) return 'A policy rule made the decision. A script did the work. The model was not necessary.';
      if (run.path.indexOf('HU') >= 0) return run.state.needs_person ? 'The rules gave no decision. The decision model gave the risk tier, and the router sent the case to a person.' : 'The report got FAIL two times. At the maximum, the case went to a person.';
      return 'The rules gave no decision. The decision model made the decision, and the agent wrote the report.';
    }
    function busy(on) { buttons.forEach(function (b) { b.disabled = on; }); }
    function send(c) {
      if (player) player.stop();
      var run = GE.runGraph(graph, { scenario: c });
      runs++;
      GE.clear(log); verdict.textContent = '';
      view.reset();
      view.edgeKeys().forEach(function (k) { if (!used[k]) view.markEdge(k, 'unused', true); });
      busy(true);
      player = GE.player(view, run.steps, {
        onStep: function (st) {
          if (st.note) log.appendChild(h('li', { class: st.result === 'FAIL' ? 'is-fail' : '' }, h('span', null, types[st.node] || ''), h('span', null, st.note)));
          log.scrollTop = log.scrollHeight;
        },
        onDone: function () {
          run.steps.forEach(function (st) { if (st.edge) used[st.edge] = true; });
          paintCoverage(); busy(false);
          verdict.textContent = decidedBy(run);
          GE.trace.lab('loan', chapter);
        }
      });
      player.play();
    }
    var caseRow = h('div', { class: 'chips' });
    CASES.forEach(function (c) {
      var b = h('button', { type: 'button', class: 'chip', onclick: function () { send(c); } }, c.label);
      buttons.push(b); caseRow.appendChild(b);
    });
    var many = h('button', { type: 'button', class: 'btn ghost', onclick: function () {
      if (player) player.stop();
      var rng = GE.rng(GE.newSeed());
      for (var i = 0; i < 12; i++) {
        var run = GE.runGraph(graph, { scenario: rng.pick(CASES.slice(0, 4)) });
        run.steps.forEach(function (st) { if (st.edge) used[st.edge] = true; });
        runs++;
      }
      GE.clear(log); paintCoverage();
      var left = view.edgeKeys().length - Object.keys(used).length;
      verdict.textContent = left ? 'Twelve usual cases. ' + left + ' branches are thin and gray: no run used them. Which case uses them? Until a run uses a branch, it has no evidence from a real case.' : 'Each branch has evidence from a run now.';
      GE.trace.lab('loan', chapter);
    } }, 'Send 12 usual cases');
    var reset = h('button', { type: 'button', class: 'btn ghost', onclick: function () { if (player) player.stop(); used = {}; runs = 0; GE.clear(log); verdict.textContent = ''; busy(false); paintCoverage(); view.reset(); } }, 'Remove the runs');
    buttons.push(many);

    el.appendChild(h('p', { class: 'panel-title' }, 'Send one case'));
    el.appendChild(caseRow);
    el.appendChild(h('div', { class: 'controls' }, many, reset));
    el.appendChild(h('div', { class: 'split graph-split' }, h('div', null, host, GE.legend(['code', 'model', 'agent', 'person'])), h('div', null, readouts, verdict, h('p', { class: 'panel-title' }, 'The trace of the last run'), log)));
    paintCoverage(); view.reset();
  };
})(window.GE);
